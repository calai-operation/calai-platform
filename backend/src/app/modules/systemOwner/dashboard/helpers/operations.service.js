import { readFile } from "node:fs/promises";
import { createDecipheriv } from "node:crypto";
import path from "node:path";
import { Router } from "express";
import { TwilioReporting, reportPeriod } from "./twilio-reporting.js";
import { VapiReporting } from "./vapi-reporting.js";
import { buildReport } from "./report-metrics.js";
import { createLiveUsageService } from "./live-usage.js";

export async function privateConnection(name, directory) {
  if (!directory) return null;
  try {
    const [key, data] = await Promise.all([
      readFile(path.join(directory, "storage.key")),
      readFile(path.join(directory, name + ".enc")),
    ]);
    const decipher = createDecipheriv("aes-256-gcm", key, data.subarray(0, 12));
    decipher.setAuthTag(data.subarray(12, 28));
    return JSON.parse(
      Buffer.concat([
        decipher.update(data.subarray(28)),
        decipher.final(),
      ]).toString("utf8"),
    );
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw Error("REPORTING_CONNECTION_INVALID");
  }
}

export function createOperationsService({
  prisma,
  twilio,
  vapi,
  voiceUrl,
  voiceKey,
  fetchImpl = fetch,
}) {
  const voice = async () => {
    if (!voiceUrl || !voiceKey)
      return { status: "not_connected", calls: [], complete: false };
    const origin = new URL(voiceUrl);
    if (
      origin.protocol !== "https:" ||
      origin.username ||
      origin.password ||
      origin.pathname !== "/" ||
      origin.search ||
      origin.hash
    )
      throw Error("INVALID_VOICE_URL");
    const get = async (endpoint) => {
      const r = await fetchImpl(origin.origin + endpoint, {
        method: "GET",
        redirect: "error",
        headers: { Authorization: "Bearer " + voiceKey },
        signal: AbortSignal.timeout(10000),
      });
      if (!r.ok) throw Error("VOICE_UNAVAILABLE");
      return r.json();
    };
    const [calls, operations] = await Promise.all([
      get("/call?limit=1000"),
      get("/calai/operations"),
    ]);
    if (!Array.isArray(calls)) throw Error("INVALID_VOICE_REPORT");
    return {
      status: calls.length < 1000 ? "connected" : "partial",
      complete: calls.length < 1000,
      calls,
      capacity: operations.capacity,
      generatedAt: new Date().toISOString(),
    };
  };
  const reporting = async (query) => {
    const period = reportPeriod(query),
      range = { gte: new Date(period.startAt), lt: new Date(period.endAt) };
    const [
      businesses,
      localCalls,
      invoices,
      jobs,
      remote,
      subscriptionsStarted,
    ] = await Promise.all([
      prisma.business.findMany({
        select: {
          id: true,
          name: true,
          status: true,
          createdAt: true,
          agents: {
            select: { id: true, name: true, vapiAgentId: true, status: true },
          },
          printers: {
            select: {
              id: true,
              deviceName: true,
              status: true,
              lastSeen: true,
            },
          },
          subscriptions: {
            orderBy: { endDate: "desc" },
            select: {
              plan: { select: { name: true, callMinutesLimit: true } },
              status: true,
              endDate: true,
            },
          },
        },
        orderBy: { name: "asc" },
      }),
      prisma.call.findMany({
        where: { createdAt: range },
        select: {
          id: true,
          businessId: true,
          vapiCallId: true,
          vapiAgentId: true,
          duration: true,
          startTime: true,
          endTime: true,
          status: true,
          type: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 50001,
      }),
      prisma.invoice.findMany({
        where: { status: "paid", createdAt: range },
        select: { businessId: true, amount: true, currency: true },
      }),
      prisma.printJob.groupBy({
        by: ["printerId", "status"],
        where: { status: { in: ["pending", "failed"] } },
        _count: { _all: true },
      }),
      Promise.allSettled([twilio.report(period), vapi.report(period), voice()]),
      prisma.subscription.count({ where: { startDate: range } }),
    ]);
    const printerTenant = new Map(
      businesses.flatMap((b) => b.printers.map((p) => [p.id, b.id])),
    );
    const providers = remote.map((r) =>
      r.status === "fulfilled"
        ? r.value
        : {
            status:
              r.reason?.status === 401 || r.reason?.status === 403
                ? "permission_required"
                : "unavailable",
            calls: [],
            complete: false,
          },
    );
    const local = JSON.parse(
      JSON.stringify({
        businesses,
        localCalls: localCalls.slice(0, 50000),
        invoices,
      }),
    );
    const report = buildReport({
      ...local,
      printJobs: jobs.map((j) => ({
        businessId: printerTenant.get(j.printerId),
        status: j.status,
        count: j._count._all,
      })),
      twilio: providers[0],
      vapi: providers[1],
      voice: providers[2],
      period,
    });
    report.coverage = {
      localComplete: localCalls.length <= 50000,
      vapiComplete: providers[1].complete === true,
      twilioComplete: providers[0].complete === true,
      voiceComplete: providers[2].complete === true,
    };
    report.summary.newTenants = businesses.filter(
      (b) =>
        new Date(b.createdAt) >= range.gte && new Date(b.createdAt) < range.lt,
    ).length;
    report.summary.subscriptionsStarted = subscriptionsStarted;
    const plans = new Map(),
      statuses = new Map();
    for (const b of businesses) {
      statuses.set(b.status, (statuses.get(b.status) || 0) + 1);
      for (const sub of b.subscriptions.filter((s) => s.status === "active"))
        plans.set(sub.plan.name, (plans.get(sub.plan.name) || 0) + 1);
    }
    report.distributions = {
      plans: [...plans].map(([name, count]) => ({ name, count })),
      statuses: [...statuses].map(([name, count]) => ({ name, count })),
    };
    report.notes.push(
      "Tenant totals, active subscriptions, expiring subscriptions, plan distributions and printer health are current snapshots. New tenants and subscription starts use the selected dates. Paid revenue uses paid invoices created in the period, in the invoice currency; it is not a payment-date ledger.",
    );
    return report;
  };
  reporting.live = createLiveUsageService({ prisma, vapi, voice });
  return reporting;
}

export async function configuredOperations(prisma, env = process.env) {
  const [storedTwilio, storedVapi] = await Promise.all([
    privateConnection("twilio", env.ADMIN_REPORTING_SECRET_DIR),
    privateConnection("vapi", env.ADMIN_REPORTING_SECRET_DIR),
  ]);
  return createOperationsService({
    prisma,
    twilio: new TwilioReporting({
      ...storedTwilioFallback(storedTwilio, env),
      includeCosts: true,
    }),
    vapi: new VapiReporting({ token: storedVapi?.token || env.VAPI_API_KEY }),
    voiceUrl: env.CALAI_VAPI_BASE_URL,
    voiceKey: env.CALAI_VAPI_KEY,
  });
}

function storedTwilioFallback(stored, env) {
  return (
    stored || {
      accountSid: env.TWILIO_ACCOUNT_SID,
      apiKeySid: env.TWILIO_API_KEY_SID,
      apiKeySecret: env.TWILIO_API_KEY_SECRET,
      authToken: env.TWILIO_AUTH_TOKEN,
    }
  );
}

export function operationsRouter({ authorize, report, live }) {
  const router = Router();
  if (authorize) router.use(authorize);
  if (live)
    router.get("/live", async (req, res) => {
      res.setHeader("Cache-Control", "private, no-store");
      try {
        return res.json({ success: true, data: await live() });
      } catch {
        return res.status(503).json({
          success: false,
          message: "Live usage is temporarily unavailable. Please retry.",
        });
      }
    });
  router.get("/", async (req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    try {
      return res.json({ success: true, data: await report(req.query) });
    } catch (error) {
      return res.status(error.status === 400 ? 400 : 503).json({
        success: false,
        message:
          error.status === 400
            ? error.message
            : "Admin reports are temporarily unavailable. Please retry.",
      });
    }
  });
  return router;
}
