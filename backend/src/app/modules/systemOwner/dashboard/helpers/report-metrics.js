import { round, callSid, allocateTwilio } from "./twilio-reporting.js";

const number = (n) => typeof n === "number" && Number.isFinite(n);
const money = (out, currency, value) => {
  if (number(value) && /^[A-Z]{3}$/.test(currency || ""))
    out[currency] = round((out[currency] || 0) + value);
};
const terminal = new Set([
  "ended",
  "completed",
  "failed",
  "busy",
  "no-answer",
  "canceled",
]);

export function isFailed(call) {
  return (
    ["failed", "busy", "no-answer", "canceled"].includes(call.status) ||
    /(error|failed|exceeded|no-answer|no-customer|silence-timed-out)/i.test(
      call.endedReason || "",
    )
  );
}

export function peakConcurrency(calls, period, now = Date.now()) {
  const events = [];
  for (const c of calls) {
    const start = Date.parse(c.startedAt),
      end = Date.parse(c.endedAt);
    if (!Number.isFinite(start)) continue;
    const stop = Number.isFinite(end)
      ? end
      : !terminal.has(c.status)
        ? now
        : NaN;
    const a = Math.max(start, Date.parse(period.startAt)),
      b = Math.min(stop, Date.parse(period.endAt), now);
    if (Number.isFinite(b) && b > a) events.push([a, 1], [b, -1]);
  }
  events.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let active = 0,
    peak = 0;
  for (const [, delta] of events) {
    active += delta;
    peak = Math.max(peak, active);
  }
  return peak;
}

export function printerProjection(p, now = Date.now()) {
  const last = Date.parse(p.lastSeen),
    fresh = Number.isFinite(last) && now - last <= 60000 && now >= last;
  return {
    id: p.id,
    name: p.deviceName,
    status:
      p.status === "online"
        ? fresh
          ? "online"
          : "offline"
        : p.status || "unknown",
    lastSeen: p.lastSeen || null,
    stale: p.status === "online" && !fresh,
    note: "Connection status uses the printer heartbeat; it does not guarantee paper, ink or successful printing.",
  };
}

export function buildReport({
  businesses = [],
  localCalls = [],
  invoices = [],
  vapi = { calls: [] },
  voice = { calls: [] },
  twilio = { calls: [] },
  printJobs = [],
  period,
  now = Date.now(),
}) {
  const groups = new Map(
    businesses.map((b) => [
      b.id,
      {
        id: b.id,
        name: b.name,
        status: b.status,
        plan: b.subscriptions?.[0]?.plan?.name || "No plan",
        minuteLimit: b.subscriptions?.[0]?.plan?.callMinutesLimit ?? null,
        agents: b.agents || [],
        printers: (b.printers || []).map((p) => printerProjection(p, now)),
        calls: [],
        revenue: {},
        costs: { vapi: {}, twilio: {} },
        pendingCosts: 0,
        printJobs: { pending: 0, failed: 0 },
      },
    ]),
  );
  const ensure = (id, name) => {
    if (!groups.has(id))
      groups.set(id, {
        id,
        name,
        status: "unlinked",
        plan: "Unlinked",
        minuteLimit: null,
        agents: [],
        printers: [],
        calls: [],
        revenue: {},
        costs: { vapi: {}, twilio: {} },
        pendingCosts: 0,
        printJobs: { pending: 0, failed: 0 },
      });
    return groups.get(id);
  };
  const stored = new Map(
    localCalls.filter((c) => c.vapiCallId).map((c) => [c.vapiCallId, c]),
  );
  const agentOwners = new Map(
    businesses.flatMap((b) =>
      (b.agents || [])
        .filter((a) => a.vapiAgentId)
        .map((a) => [a.vapiAgentId, b.id]),
    ),
  );
  const assistantNames = new Map(
    (vapi.assistants || []).map((a) => [a.id, a.name]),
  );
  const seen = new Set(),
    knownTwilio = new Map(),
    all = [];
  for (const [source, rows] of [
    ["vapi", vapi.calls || []],
    ["calaiVapi", voice.calls || []],
  ])
    for (const raw of rows) {
      const created = Date.parse(raw.createdAt);
      if (
        !Number.isFinite(created) ||
        created < Date.parse(period.startAt) ||
        created >= Date.parse(period.endAt)
      )
        continue;
      const local = stored.get(raw.id);
      if (local) seen.add(local.id);
      const tenant =
        local?.businessId ||
        (groups.has(raw.metadata?.calai?.businessId)
          ? raw.metadata.calai.businessId
          : null) ||
        agentOwners.get(raw.assistantId);
      const attribution = local
        ? "recorded_call"
        : groups.has(raw.metadata?.calai?.businessId)
          ? "recorded_tenant"
          : tenant
            ? "current_agent"
            : "unlinked";
      const group = tenant
        ? groups.get(tenant)
        : ensure(
            "unlinked:" + source + ":" + (raw.assistantId || "unknown"),
            assistantNames.get(raw.assistantId) ||
              raw.metadata?.calai?.businessName ||
              "Unlinked " +
                (source === "vapi" ? "Vapi" : "Calai Vapi") +
                " agent",
          );
      if (!group) continue;
      const breakdown = raw.costBreakdown;
      const cost = source === "vapi" && number(raw.cost) ? raw.cost : null;
      const currency = source === "vapi" ? "USD" : null;
      let seconds = number(raw.durationSeconds)
        ? raw.durationSeconds
        : Date.parse(raw.endedAt) - Date.parse(raw.startedAt);
      if (!number(raw.durationSeconds))
        seconds = Number.isFinite(seconds)
          ? Math.max(0, seconds / 1000)
          : !terminal.has(raw.status) && raw.startedAt
            ? Math.max(0, (now - Date.parse(raw.startedAt)) / 1000)
            : null;
      const sid = [
        raw.id,
        raw.phoneCallProviderId,
        raw.transport?.callSid,
        raw.telephony?.callSid,
      ].find(callSid);
      if (sid) knownTwilio.set(sid, group.id);
      const call = {
        id: raw.id,
        source,
        tenantId: group.id,
        tenantName: group.name,
        agentName:
          assistantNames.get(raw.assistantId) || raw.assistantId || "Unknown",
        startedAt: raw.startedAt || null,
        createdAt: raw.createdAt,
        endedAt: raw.endedAt || null,
        status: raw.status,
        reason: raw.endedReason || null,
        failed: isFailed(raw),
        transfer:
          !!raw.transfer || /forward|transfer/i.test(raw.endedReason || ""),
        seconds,
        cost,
        currency,
        estimated: false,
        costApplicable: source === "vapi",
        costComplete: source !== "vapi" || cost !== null,
        latencyMs: raw.latency?.summary?.firstAudioMs?.meanMs ?? null,
        twilioCallSid: sid || null,
      };
      call.attribution = attribution;
      call.components =
        source === "vapi"
          ? Object.fromEntries(
              [
                "transport",
                "stt",
                "llm",
                "tts",
                "vapi",
                "chat",
                "knowledgeBaseCost",
                "voicemailDetectionCost",
              ]
                .filter((k) => number(breakdown?.[k]))
                .map((k) => [k, breakdown[k]]),
            )
          : {};
      group.calls.push(call);
      all.push(call);
      if (source === "vapi") money(group.costs.vapi, currency, cost);
      if (!call.costComplete) group.pendingCosts++;
    }
  for (const c of localCalls) {
    if (seen.has(c.id)) continue;
    const group = groups.get(c.businessId);
    if (!group) continue;
    const call = {
      id: c.vapiCallId || c.id,
      source: "calai",
      tenantId: c.businessId,
      tenantName: group.name,
      agentName: c.vapiAgentId || "Unknown",
      startedAt: c.startTime,
      endedAt: c.endTime,
      createdAt: c.createdAt,
      status: c.status,
      reason: c.status === "failed" ? "Provider details not available" : null,
      failed: c.status === "failed",
      transfer: c.type === "forwarded_call",
      seconds: number(c.duration) ? c.duration : null,
      cost: null,
      currency: null,
      costComplete: false,
      latencyMs: null,
    };
    group.calls.push(call);
    all.push(call);
    group.pendingCosts++;
    if (callSid(c.vapiCallId)) knownTwilio.set(c.vapiCallId, c.businessId);
  }
  for (const row of invoices) {
    const group = groups.get(row.businessId);
    if (group)
      money(
        group.revenue,
        String(row.currency || "").toUpperCase(),
        row.amount,
      );
  }
  for (const job of printJobs) {
    const group = groups.get(job.businessId);
    if (group && ["pending", "failed"].includes(job.status))
      group.printJobs[job.status] += job.count;
  }
  const allocations = allocateTwilio(twilio, knownTwilio);
  for (const a of allocations) {
    const group = a.tenantId
      ? groups.get(a.tenantId)
      : ensure("unlinked:twilio", "Unallocated Twilio");
    if (group) {
      group.twilio = a;
      group.costs.twilio = a.amounts;
    }
  }
  const twilioById = new Map((twilio.calls || []).map((c) => [c.id, c]));
  const twilioFailures = (twilio.calls || [])
    .filter(isFailed)
    .filter((c) => !all.some((a) => a.failed && a.twilioCallSid === c.id))
    .map((c) => {
      let id = c.id,
        tenantId = null;
      const visited = new Set();
      while (id && !visited.has(id)) {
        visited.add(id);
        if (knownTwilio.has(id)) {
          tenantId = knownTwilio.get(id);
          break;
        }
        id = twilioById.get(id)?.parentId;
      }
      const group = tenantId
        ? groups.get(tenantId)
        : ensure("unlinked:twilio", "Unallocated Twilio");
      return {
        id: c.id,
        source: "twilio",
        tenantId: group.id,
        tenantName: group.name,
        agentName: "Telephony leg",
        createdAt: c.startedAt,
        startedAt: c.startedAt,
        endedAt: c.endedAt,
        status: c.status,
        reason: c.status,
        failed: true,
        seconds: c.durationSeconds ?? null,
        cost: c.amount ?? null,
        currency: c.currency || null,
        costApplicable: true,
      };
    });
  const liveRange =
    Date.parse(period.startAt) <= now && Date.parse(period.endAt) > now;
  const tenants = [...groups.values()].map((g) => {
    const minutes = round(
        g.calls.reduce((s, c) => s + (c.seconds || 0) / 60, 0),
      ),
      failures = g.calls.filter((c) => c.failed).length;
    const costPerCall = {},
      costPerMinute = {},
      costSamples = {};
    for (const [provider, amounts] of Object.entries(g.costs)) {
      costPerCall[provider] = {};
      costPerMinute[provider] = {};
      costSamples[provider] = {};
      for (const [currency, amount] of Object.entries(amounts)) {
        const rows = g.calls.filter(
          (c) =>
            c.source === provider && c.currency === currency && number(c.cost),
        );
        const sample =
          provider === "twilio"
            ? g.twilio?.priced[currency]
            : {
                count: rows.length,
                seconds: rows.reduce((s, c) => s + (c.seconds || 0), 0),
                durationAmount: rows
                  .filter((c) => number(c.seconds))
                  .reduce((s, c) => s + c.cost, 0),
                unknownDuration: rows.some((c) => c.seconds === null),
              };
        costSamples[provider][currency] = sample?.count || 0;
        costPerCall[provider][currency] = sample?.count
          ? round(amount / sample.count)
          : null;
        costPerMinute[provider][currency] = sample?.seconds
          ? round(sample.durationAmount / (sample.seconds / 60))
          : null;
      }
    }
    const components = {};
    for (const c of g.calls)
      for (const [key, value] of Object.entries(c.components || {}))
        components[key] = round((components[key] || 0) + value);
    return {
      ...g,
      callCount: g.calls.length,
      minutes,
      unknownDurationCalls: g.calls.filter((c) => c.seconds === null).length,
      active: liveRange
        ? g.calls.filter((c) => c.status === "in-progress").length
        : null,
      peak: peakConcurrency(g.calls, period, now),
      failures,
      failedTwilioLegs: twilioFailures.filter((c) => c.tenantId === g.id)
        .length,
      transfers: g.calls.filter((c) => c.transfer).length,
      failureRate: g.calls.length
        ? round((failures / g.calls.length) * 100)
        : null,
      latencyMs: (() => {
        const rows = g.calls.map((c) => c.latencyMs).filter(number);
        return rows.length
          ? Math.round(rows.reduce((s, n) => s + n, 0) / rows.length)
          : null;
      })(),
      costPerCall,
      costPerMinute,
      costSamples,
      components,
      currentAgentAttributions: g.calls.filter(
        (c) => c.attribution === "current_agent",
      ).length,
      calls: undefined,
    };
  });
  const ordered = all.sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );
  const failedCalls = [
    ...ordered.filter((c) => c.failed),
    ...twilioFailures,
  ].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const revenue = {};
  for (const t of tenants)
    for (const [currency, value] of Object.entries(t.revenue))
      money(revenue, currency, value);
  const subscriptions = businesses
    .flatMap((b) => b.subscriptions || [])
    .filter((s) => s.status === "active");
  return {
    generatedAt: new Date(now).toISOString(),
    period,
    tenants,
    calls: ordered,
    failedCalls,
    summary: {
      tenants: businesses.length,
      revenue,
      activeSubscriptions: subscriptions.length,
      expiringSubscriptions: subscriptions.filter(
        (s) =>
          Date.parse(s.endDate) >= now &&
          Date.parse(s.endDate) <= now + 30 * 86400000,
      ).length,
      calls: all.length,
      minutes: round(tenants.reduce((s, t) => s + t.minutes, 0)),
      failures: all.filter((c) => c.failed).length,
      failedTwilioLegs: twilioFailures.length,
      failureEvents: failedCalls.length,
      active: liveRange
        ? all.filter((c) => c.status === "in-progress").length
        : null,
      peak: peakConcurrency(all, period, now),
      printersOnline: tenants
        .flatMap((t) => t.printers)
        .filter((p) => p.status === "online").length,
      printersTotal: tenants.flatMap((t) => t.printers).length,
    },
    providers: {
      twilio: {
        status: twilio.status,
        complete: twilio.complete,
        callsComplete: twilio.callsComplete,
        usageComplete: twilio.usageComplete,
        generatedAt: twilio.generatedAt,
        total: twilio.total || null,
        categories: twilio.categories || [],
        note: twilio.note,
      },
      vapi: {
        status: vapi.status,
        complete: vapi.complete,
        generatedAt: vapi.generatedAt,
        note: vapi.note,
      },
      calaiVapi: {
        status: voice.status,
        complete: voice.complete,
        capacity: voice.capacity,
        generatedAt: voice.generatedAt,
      },
    },
    notes: [
      "Vapi and Twilio charges are shown separately in their original currencies. Calai Vapi costs are excluded. Twilio tenant call charges are part of its account total, not an additional charge; no combined provider total is assumed.",
      "Tenant links use recorded call ownership, stable tenant metadata or the exact assistant ID stored in Calai. Links using current agent ownership are labelled in tenant details. Phone numbers and names are not used to guess ownership.",
      "Revenue retains invoice currency. Profit is not assumed from incomplete costs or mixed currencies.",
      "Dates use UTC. Call totals and costs use calls created during the selected period. Active counts and peak concurrency cover available call intervals only; calls starting before the range and unavailable providers are excluded.",
    ],
  };
}
