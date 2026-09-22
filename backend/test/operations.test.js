import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { once } from "node:events";
import {
  buildReport,
  peakConcurrency,
  printerProjection,
} from "../src/app/modules/systemOwner/dashboard/helpers/report-metrics.js";
import { VapiReporting } from "../src/app/modules/systemOwner/dashboard/helpers/vapi-reporting.js";
import {
  createOperationsService,
  operationsRouter,
} from "../src/app/modules/systemOwner/dashboard/helpers/operations.service.js";
const period = {
  start: "2026-09-01",
  end: "2026-09-09",
  startAt: "2026-09-01T00:00:00.000Z",
  endAt: "2026-09-10T00:00:00.000Z",
};
const now = Date.parse("2026-09-09T12:00:00Z");
const business = {
  id: "tenant",
  name: "Test business",
  status: "active",
  agents: [{ vapiAgentId: "assistant", name: "Test agent" }],
  printers: [],
  subscriptions: [],
};
const baseCall = {
  id: "call",
  assistantId: "assistant",
  createdAt: "2026-09-09T10:00:00Z",
  startedAt: "2026-09-09T10:00:00Z",
  endedAt: "2026-09-09T10:02:00Z",
  status: "ended",
  cost: 2,
};
const make = (args) =>
  buildReport({ businesses: [business], period, now, ...args });
test("Vapi retention retrieves the available tail and labels missing history", async () => {
  let calls = 0;
  const vapi = new VapiReporting({
    token: "test",
    fetchImpl: async (url) => {
      if (url.includes("/assistant")) return { ok: true, json: async () => [] };
      calls++;
      if (calls === 1)
        return {
          ok: false,
          status: 400,
          json: async () => ({
            message:
              "Your subscription plan only covers the last 14 days of call history. Please adjust your date filter to Wed Aug 26 2026 or later.",
          }),
        };
      assert.equal(
        new URL(url).searchParams.get("createdAtGe"),
        "2026-08-26T00:00:00.000Z",
      );
      return {
        ok: true,
        json: async () => [
          { id: "retained", createdAt: "2026-08-27T00:00:00Z" },
        ],
      };
    },
  });
  const r = await vapi.report({
    start: "2026-08-01",
    end: "2026-08-31",
    startAt: "2026-08-01T00:00:00Z",
    endAt: "2026-09-01T00:00:00Z",
  });
  assert.equal(r.status, "partial");
  assert.equal(r.complete, false);
  assert.equal(r.calls.length, 1);
  assert.match(r.note, /14 days/);
  assert.equal(calls, 2);
});
test("Vapi fully expired months are explicitly partial without an invalid retry", async () => {
  let calls = 0;
  const vapi = new VapiReporting({
    token: "test",
    fetchImpl: async (url) => {
      if (url.includes("/assistant")) return { ok: true, json: async () => [] };
      calls++;
      return {
        ok: false,
        status: 400,
        json: async () => ({
          message:
            "Your subscription plan only covers the last 14 days of call history. Please adjust your date filter to Wed Aug 26 2026 or later.",
        }),
      };
    },
  });
  const r = await vapi.report({
    start: "2026-07-01",
    end: "2026-07-31",
    startAt: "2026-07-01T00:00:00Z",
    endAt: "2026-08-01T00:00:00Z",
  });
  assert.equal(r.complete, false);
  assert.equal(r.calls.length, 0);
  assert.equal(calls, 1);
  assert.match(r.note, /not a complete monthly total/);
});
test("exact stored ownership wins over current assistant ownership; caller content is never projected", () => {
  const report = make({
    businesses: [business, { ...business, id: "historical", agents: [] }],
    localCalls: [{ id: "local", vapiCallId: "call", businessId: "historical" }],
    vapi: {
      calls: [
        {
          ...baseCall,
          transcript: "PRIVATE_TRANSCRIPT",
          customer: { number: "PRIVATE_NUMBER" },
          recordingUrl: "PRIVATE_RECORDING",
        },
      ],
    },
  });
  assert.equal(report.calls[0].tenantId, "historical");
  assert.equal(report.calls[0].attribution, "recorded_call");
  assert.equal(report.summary.calls, 1);
  assert.ok(!JSON.stringify(report).includes("PRIVATE_"));
});
test("current assistant links are explicit, unknown assistants stay unlinked, invalid dates excluded", () => {
  const report = make({
    vapi: {
      calls: [
        baseCall,
        { ...baseCall, id: "unknown", assistantId: "other" },
        { ...baseCall, id: "bad", createdAt: "not-a-date" },
      ],
    },
  });
  assert.equal(report.summary.calls, 2);
  assert.equal(report.tenants[0].currentAgentAttributions, 1);
  assert.equal(
    report.calls.find((c) => c.id === "unknown").attribution,
    "unlinked",
  );
});
test("unit costs use each provider and currency priced sample; missing costs and durations stay unknown", () => {
  const report = make({
    vapi: {
      calls: [
        baseCall,
        { ...baseCall, id: "pending", cost: null },
        { ...baseCall, id: "zero", cost: 0 },
      ],
    },
    voice: {
      calls: [
        {
          ...baseCall,
          id: "voice",
          metadata: { calai: { businessId: "tenant" } },
          costBreakdown: { knownSubtotal: 3, currency: "GBP", complete: false },
        },
      ],
    },
  });
  const t = report.tenants[0];
  assert.deepEqual(t.costs, { vapi: { USD: 2 }, twilio: {} });
  assert.equal(t.costPerCall.vapi.USD, 1);
  assert.equal(t.costPerMinute.vapi.USD, 0.5);
  assert.equal(t.pendingCosts, 1);
  assert.equal(report.calls.find((c) => c.source === "calaiVapi").cost, null);
  assert.ok(!Object.hasOwn(t.costs, "calaiVapi"));
  const missing = make({
    vapi: { calls: [{ ...baseCall, startedAt: null, endedAt: null }] },
  }).tenants[0];
  assert.equal(missing.costPerMinute.vapi.USD, null);
});
test("child Twilio failures are visible and attributed without inflating AI call counts", () => {
  const parent = "CA" + "1".repeat(32),
    child = "CA" + "2".repeat(32);
  const report = make({
    vapi: { calls: [{ ...baseCall, transport: { callSid: parent } }] },
    twilio: {
      calls: [
        {
          id: parent,
          amount: 0.1,
          currency: "GBP",
          durationSeconds: 120,
          status: "completed",
        },
        {
          id: child,
          parentId: parent,
          amount: 0.2,
          currency: "GBP",
          durationSeconds: 0,
          status: "busy",
        },
      ],
    },
  });
  assert.equal(report.summary.calls, 1);
  assert.equal(report.summary.failures, 0);
  assert.equal(report.summary.failedTwilioLegs, 1);
  assert.equal(report.failedCalls[0].tenantId, "tenant");
  assert.deepEqual(report.tenants[0].costs.twilio, { GBP: 0.3 });
  assert.equal(report.failedCalls[0].cost, 0.2);
  assert.equal(report.tenants[0].costPerCall.twilio.GBP, 0.15);
});
test("equal interval boundaries do not overlap and ended calls without end times do not inflate concurrency", () => {
  const calls = [
    { startedAt: "2026-09-09T10:00Z", endedAt: "2026-09-09T10:01Z" },
    { startedAt: "2026-09-09T10:01Z", endedAt: "2026-09-09T10:02Z" },
    { startedAt: "2026-09-09T10:00Z", status: "ended" },
  ];
  assert.equal(peakConcurrency(calls, period, now), 1);
  assert.equal(
    make({ period: { ...period, endAt: "2026-09-08T00:00:00Z" } }).summary
      .active,
    null,
  );
});
test("unmatched Twilio charges remain unallocated and account totals never inflate tenant costs", () => {
  const report = make({
    twilio: {
      status: "connected",
      total: { amount: 10, currency: "GBP" },
      categories: [{ category: "totalprice", amount: 10, currency: "GBP" }],
      calls: [
        {
          id: "CA" + "3".repeat(32),
          amount: 0.4,
          currency: "GBP",
          durationSeconds: 60,
          status: "completed",
        },
      ],
    },
  });
  assert.deepEqual(
    report.tenants.find((t) => t.id === "tenant").costs.twilio,
    {},
  );
  assert.equal(
    report.tenants.find((t) => t.id === "unlinked:twilio").costs.twilio.GBP,
    0.4,
  );
  assert.equal(report.providers.twilio.total.amount, 10);
  assert.equal(report.summary.calls, 0);
  assert.ok(report.tenants.every((t) => !Object.hasOwn(t.costs, "calaiVapi")));
});
test("printer heartbeat expires at 60 seconds, handles invalid and future times", () => {
  const p = { id: "p", deviceName: "Receipt", status: "online" };
  assert.equal(
    printerProjection(
      { ...p, lastSeen: new Date(now - 60000).toISOString() },
      now,
    ).status,
    "online",
  );
  for (const date of [
    new Date(now - 60001).toISOString(),
    new Date(now + 1000).toISOString(),
    "invalid",
  ])
    assert.equal(
      printerProjection({ ...p, lastSeen: date }, now).status,
      "offline",
    );
});
test("Vapi request caps are marked partial and pagination does not skip calls sharing a timestamp", async () => {
  const rows = Array.from({ length: 1000 }, (_, i) => ({
    ...baseCall,
    id: String(i),
  }));
  const client = new VapiReporting({
    token: "test-only",
    maxRequests: 1,
    fetchImpl: async (url, options) => {
      assert.equal(options.method, "GET");
      assert.equal(options.redirect, "error");
      return {
        ok: true,
        json: async () => (url.includes("/assistant") ? [] : rows),
      };
    },
  });
  const report = await client.report(period);
  assert.equal(report.complete, false);
  assert.equal(report.status, "partial");
  assert.equal(report.calls.length, 1000);
});
test("Vapi rejects out-of-range data and keeps assistant listing failures separate", async () => {
  const client = new VapiReporting({
    token: "test-only",
    fetchImpl: async () => ({
      ok: true,
      json: async () => [{ ...baseCall, createdAt: "2020-01-01" }],
    }),
  });
  await assert.rejects(client.report(period), /RANGE/);
  const client2 = new VapiReporting({
    token: "test-only",
    fetchImpl: async (url) =>
      url.includes("/assistant")
        ? { ok: false, status: 403 }
        : { ok: true, json: async () => [baseCall] },
  });
  assert.equal((await client2.report(period)).complete, true);
});
test("report endpoint denies unauthenticated and tenant requests before calling providers; errors never reveal secrets", async () => {
  let reads = 0;
  const app = express();
  app.use(
    "/report",
    operationsRouter({
      authorize: (req, res, next) =>
        req.headers["x-test-role"] === "SYSTEM_OWNER"
          ? next()
          : res.sendStatus(req.headers["x-test-role"] ? 403 : 401),
      report: async () => {
        reads++;
        throw Error("PRIVATE_TOKEN");
      },
    }),
  );
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const url = "http://127.0.0.1:" + server.address().port + "/report";
  try {
    assert.equal((await fetch(url)).status, 401);
    assert.equal(
      (await fetch(url, { headers: { "x-test-role": "BUSINESS_OWNER" } }))
        .status,
      403,
    );
    assert.equal(reads, 0);
    const response = await fetch(url, {
      headers: { "x-test-role": "SYSTEM_OWNER" },
    });
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.ok(!(await response.text()).includes("PRIVATE_TOKEN"));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
test("database reporting uses read-only projections and retains provider availability", async () => {
  const prisma = {
    subscription: { count: async () => 3 },
    business: {
      findMany: async (args) => {
        assert.ok(!JSON.stringify(args).includes("apiKey"));
        return [business];
      },
    },
    call: { findMany: async () => [] },
    invoice: { findMany: async () => [] },
    printJob: { groupBy: async () => [] },
  };
  const service = createOperationsService({
    prisma,
    twilio: {
      report: async () => ({ status: "connected", calls: [], complete: true }),
    },
    vapi: {
      report: async () => {
        throw Object.assign(Error("PRIVATE_SECRET"), { status: 403 });
      },
    },
  });
  const report = await service({ start: "2026-09-01", end: "2026-09-09" });
  assert.equal(report.summary.subscriptionsStarted, 3);
  assert.ok(report.distributions.plans);
  assert.equal(report.providers.vapi.status, "permission_required");
  assert.equal(report.providers.twilio.status, "connected");
  assert.ok(!JSON.stringify(report).includes("PRIVATE_SECRET"));
});
test("monthly new tenants use exact UTC boundaries and do not rewrite current tenant totals", async () => {
  const dates = [
    "2026-08-31T23:59:59Z",
    "2026-09-01T00:00:00Z",
    "2026-09-09T23:59:59Z",
    "2026-09-10T00:00:00Z",
  ];
  const prisma = {
    business: {
      findMany: async () =>
        dates.map((createdAt, i) => ({
          ...business,
          id: String(i),
          createdAt: new Date(createdAt),
        })),
    },
    call: { findMany: async () => [] },
    invoice: {
      findMany: async () => [
        { businessId: "0", amount: 10, currency: "GBP" },
        { businessId: "1", amount: 20, currency: "USD" },
      ],
    },
    printJob: { groupBy: async () => [] },
    subscription: {
      count: async (args) => {
        assert.equal(
          args.where.startDate.gte.toISOString(),
          "2026-09-01T00:00:00.000Z",
        );
        assert.equal(
          args.where.startDate.lt.toISOString(),
          "2026-09-10T00:00:00.000Z",
        );
        return 2;
      },
    },
  };
  const provider = {
    report: async () => ({ status: "connected", complete: true, calls: [] }),
  };
  const report = await createOperationsService({
    prisma,
    twilio: provider,
    vapi: provider,
  })({ start: "2026-09-01", end: "2026-09-09" });
  assert.equal(report.summary.tenants, 4);
  assert.equal(report.summary.newTenants, 2);
  assert.equal(report.summary.subscriptionsStarted, 2);
  assert.deepEqual(report.summary.revenue, { GBP: 10, USD: 20 });
  assert.deepEqual(report.distributions.statuses, [
    { name: "active", count: 4 },
  ]);
});
