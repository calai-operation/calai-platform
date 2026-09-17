import { printerProjection } from "./report-metrics.js";

const liveStates = new Set(["in-progress", "ringing", "queued", "forwarding"]);
const validDate = (value) => Number.isFinite(Date.parse(value));

export class VapiLiveReader {
  constructor(client, { now = Date.now, maxRequests = 32 } = {}) {
    this.client = client;
    this.now = now;
    this.maxRequests = maxRequests;
    this.calls = new Map();
    this.cursor = null;
    this.cached = null;
    this.pending = null;
  }
  async report() {
    if (!this.client.token)
      return { status: "not_connected", complete: false, calls: [] };
    if (this.cached && this.now() - this.cached.savedAt < 4000)
      return this.cached.report;
    if (this.pending) return this.pending;
    this.pending = this.load().finally(() => {
      this.pending = null;
    });
    return this.pending;
  }
  async load() {
    const end = this.now(),
      start = this.cursor ? this.cursor - 60000 : end - 86400000;
    const ranges = [[start, end]],
      changed = new Map();
    let requests = 0,
      complete = true;
    while (ranges.length) {
      if (requests++ >= this.maxRequests) {
        complete = false;
        break;
      }
      const [from, to] = ranges.pop();
      const query = new URLSearchParams({
        updatedAtGe: new Date(from).toISOString(),
        updatedAtLt: new Date(to).toISOString(),
        limit: "1000",
      });
      const rows = await this.client.get("/call?" + query);
      if (!Array.isArray(rows)) throw Error("INVALID_LIVE_REPORT");
      for (const row of rows) {
        const updated = Date.parse(row.updatedAt);
        if (
          !row.id ||
          !Number.isFinite(updated) ||
          updated < from ||
          updated >= to
        )
          throw Error("INVALID_LIVE_REPORT_RANGE");
        changed.set(row.id, row);
      }
      if (rows.length >= 1000) {
        if (to - from <= 1) {
          complete = false;
          continue;
        }
        const middle = Math.floor((from + to) / 2);
        ranges.push([from, middle], [middle, to]);
      }
    }
    for (const [id, row] of changed) {
      if (liveStates.has(row.status) && !row.endedAt) this.calls.set(id, row);
      else this.calls.delete(id);
    }
    for (const [id, row] of this.calls)
      if (end - Date.parse(row.updatedAt) > 86400000) this.calls.delete(id);
    if (complete) this.cursor = end;
    const report = {
      status: complete ? "connected" : "partial",
      complete,
      calls: [...this.calls.values()],
      generatedAt: new Date(end).toISOString(),
      windowStart: new Date(end - 86400000).toISOString(),
    };
    this.cached = { report, savedAt: this.now() };
    return report;
  }
}

export function projectLiveUsage({
  businesses,
  localCalls = [],
  vapi,
  voice = { status: "not_connected", calls: [] },
  now = Date.now(),
}) {
  const assistantNames = new Map(
    (vapi.assistants || []).map((a) => [a.id, a.name]),
  );
  const tenants = new Map(
    businesses.map((b) => [
      b.id,
      {
        id: b.id,
        name: b.name,
        status: b.status,
        agentsTotal: b.agents.length,
        printers: (b.printers || []).map((printer) =>
          printerProjection(printer, now),
        ),
        activeCalls: 0,
        agentsInUse: 0,
        ringing: 0,
        queued: 0,
        forwarding: 0,
      },
    ]),
  );
  const agents = new Map(),
    stored = new Map(localCalls.map((c) => [c.vapiCallId, c.businessId]));
  for (const business of businesses)
    for (const agent of business.agents) {
      if (!agent.vapiAgentId) continue;
      const prior = agents.get(agent.vapiAgentId);
      agents.set(
        agent.vapiAgentId,
        prior && prior.businessId !== business.id
          ? { ambiguous: true }
          : { ...agent, businessId: business.id },
      );
    }
  const calls = [],
    seen = new Set();
  for (const [provider, report] of [
    ["vapi", vapi],
    ["calaiVapi", voice],
  ])
    for (const raw of report.calls || []) {
      if (
        !raw.id ||
        !liveStates.has(raw.status) ||
        raw.endedAt ||
        seen.has(provider + ":" + raw.id)
      )
        continue;
      seen.add(provider + ":" + raw.id);
      const agentId = raw.assistantId || raw.assistant?.id || null,
        agent = agents.get(agentId);
      const recorded = stored.get(raw.id),
        metadata = raw.metadata?.calai?.businessId;
      const tenantId = tenants.has(recorded)
        ? recorded
        : tenants.has(metadata)
          ? metadata
          : agent && !agent.ambiguous
            ? agent.businessId
            : null;
      const attribution = tenants.has(recorded)
        ? "recorded_call"
        : tenants.has(metadata)
          ? "recorded_tenant"
          : tenantId
            ? "current_agent"
            : "unlinked";
      const startedAt = validDate(raw.startedAt) ? raw.startedAt : null;
      const call = {
        id: raw.id,
        provider,
        tenantId,
        tenantName: tenants.get(tenantId)?.name || "Unlinked tenant",
        agentId,
        agentKey: provider + ":" + (agentId || "transient:" + raw.id),
        agentName:
          agent?.name ||
          raw.assistant?.name ||
          assistantNames.get(agentId) ||
          agentId ||
          "Transient agent",
        status: raw.status,
        startedAt,
        createdAt: raw.createdAt || null,
        elapsedSeconds: startedAt
          ? Math.max(0, Math.floor((now - Date.parse(startedAt)) / 1000))
          : null,
        attribution,
      };
      calls.push(call);
    }
  const inProgress = calls.filter((c) => c.status === "in-progress");
  for (const tenant of tenants.values()) {
    const rows = calls.filter((c) => c.tenantId === tenant.id),
      active = rows.filter((c) => c.status === "in-progress");
    tenant.activeCalls = active.length;
    tenant.agentsInUse = new Set(active.map((c) => c.agentKey)).size;
    for (const state of ["ringing", "queued", "forwarding"])
      tenant[state] = rows.filter((c) => c.status === state).length;
  }
  const providers = Object.fromEntries(
    [
      ["vapi", vapi],
      ["calaiVapi", voice],
    ].map(([key, p]) => [
      key,
      {
        status: p.status,
        complete: p.complete === true,
        generatedAt: p.generatedAt || null,
      },
    ]),
  );
  const enabled = [vapi, ...(voice.status === "not_connected" ? [] : [voice])],
    complete = enabled.every((p) => p.status === "connected" && p.complete);
  const snapshotTime = Math.min(
    now,
    ...enabled.map((p) => Date.parse(p.generatedAt)).filter(Number.isFinite),
  );
  return {
    generatedAt: new Date(snapshotTime).toISOString(),
    complete,
    providers,
    summary: {
      activeCalls: inProgress.length,
      agentsInUse: new Set(inProgress.map((c) => c.agentKey)).size,
      tenantsInUse: new Set(
        inProgress.filter((c) => c.tenantId).map((c) => c.tenantId),
      ).size,
      unlinkedActiveCalls: inProgress.filter((c) => !c.tenantId).length,
      ringing: calls.filter((c) => c.status === "ringing").length,
      queued: calls.filter((c) => c.status === "queued").length,
      forwarding: calls.filter((c) => c.status === "forwarding").length,
    },
    tenants: [...tenants.values()],
    calls: calls.sort(
      (a, b) => (Date.parse(a.startedAt) || 0) - (Date.parse(b.startedAt) || 0),
    ),
    note: "Live activity is polled every 5 seconds from connected voice providers and is independent of the reporting dates. Agents in use counts distinct assistants; one assistant can handle multiple simultaneous calls. Forwarded calls are shown separately from agents speaking.",
  };
}

export function createLiveUsageService({ prisma, vapi, voice }) {
  const reader = new VapiLiveReader(vapi);
  let pending = null,
    cached = null;
  return async () => {
    if (cached && Date.now() - cached.time < 4000) return cached.data;
    if (pending) return pending;
    pending = (async () => {
      const [businesses, providers] = await Promise.all([
        prisma.business.findMany({
          select: {
            id: true,
            name: true,
            status: true,
            printers: {
              select: {
                id: true,
                deviceName: true,
                status: true,
                lastSeen: true,
              },
            },
            agents: { select: { id: true, name: true, vapiAgentId: true } },
          },
          orderBy: { name: "asc" },
        }),
        Promise.allSettled([reader.report(), voice()]),
      ]);
      const [vapiReport, voiceReport] = providers.map((r) =>
        r.status === "fulfilled"
          ? r.value
          : { status: "unavailable", calls: [], complete: false },
      );
      vapiReport.assistants = vapi.assistants || [];
      const ids = [
        ...(vapiReport.calls || []),
        ...(voiceReport.calls || []),
      ].map((c) => c.id);
      const localCalls = ids.length
        ? await prisma.call.findMany({
            where: { vapiCallId: { in: ids } },
            select: { vapiCallId: true, businessId: true },
          })
        : [];
      const data = projectLiveUsage({
        businesses,
        localCalls,
        vapi: vapiReport,
        voice: voiceReport,
      });
      cached = { time: Date.now(), data };
      return data;
    })().finally(() => {
      pending = null;
    });
    return pending;
  };
}
