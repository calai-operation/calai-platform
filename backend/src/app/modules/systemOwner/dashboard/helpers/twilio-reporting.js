// Server-only reporting adapter. It never purchases numbers or changes call routing.
const API = "https://api.twilio.com";
const SID = /^AC[0-9a-f]{32}$/i;
export const callSid = (value) => /^CA[0-9a-f]{32}$/i.test(value || "");
export const decimal = (value) =>
  value !== null &&
  value !== undefined &&
  value !== "" &&
  /^-?\d+(\.\d+)?$/.test(String(value)) &&
  Number.isFinite(Number(value))
    ? Number(value)
    : null;
export const round = (value) => Math.round(value * 1e8) / 1e8;

export function reportPeriod(query = {}, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  const today = `${y}-${m}-${d}`;
  const start = query.start || today.slice(0, 7) + "-01",
    end = query.end || today;
  for (const value of [start, end])
    if (
      typeof value !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      !Number.isFinite(Date.parse(value)) ||
      new Date(value).toISOString().slice(0, 10) !== value
    )
      throw Object.assign(Error("Use valid dates."), { status: 400 });
  if (
    start > end ||
    end > today ||
    (Date.parse(end) - Date.parse(start)) / 86400000 > 92
  )
    throw Object.assign(
      Error("Choose a date range of up to 93 days ending today or earlier."),
      { status: 400 },
    );
  return {
    start,
    end,
    startAt: start + "T00:00:00.000Z",
    endAt: new Date(Date.parse(end) + 86400000).toISOString(),
    timezone: "Europe/London",
  };
}

export class TwilioReporting {
  constructor({
    accountSid,
    apiKeySid,
    apiKeySecret,
    authToken,
    fetchImpl = fetch,
    maxPages = 100,
    includeCosts = true,
  } = {}) {
    this.accountSid = accountSid;
    this.includeCosts = includeCosts;
    this.username = apiKeySid || accountSid;
    this.secret = apiKeySid ? apiKeySecret : authToken;
    this.fetch = fetchImpl;
    this.maxPages = maxPages;
    this.cache = new Map();
    this.pending = new Map();
  }
  get connected() {
    return (
      SID.test(this.accountSid || "") &&
      !!this.secret &&
      (!this.username?.startsWith("SK") ||
        /^SK[0-9a-f]{32}$/i.test(this.username))
    );
  }
  async get(path) {
    const url = new URL(path, API);
    if (
      url.origin !== API ||
      url.username ||
      url.password ||
      !url.pathname.startsWith("/2010-04-01/Accounts/" + this.accountSid + "/")
    )
      throw Error("INVALID_TWILIO_PAGE");
    const response = await this.fetch(url, {
      method: "GET",
      redirect: "error",
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(this.username + ":" + this.secret).toString("base64"),
      },
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok)
      throw Object.assign(
        Error(
          [401, 403].includes(response.status)
            ? "TWILIO_PERMISSION_REQUIRED"
            : "TWILIO_UNAVAILABLE",
        ),
        { status: response.status },
      );
    return response.json();
  }
  async pages(path, field) {
    const rows = [],
      visited = new Set();
    for (let page = 0; path && page < this.maxPages; page++) {
      if (visited.has(path)) throw Error("INVALID_TWILIO_PAGE");
      visited.add(path);
      const data = await this.get(path);
      if (!Array.isArray(data[field])) throw Error("INVALID_TWILIO_REPORT");
      rows.push(...data[field]);
      path = data.next_page_uri;
      if (path !== null && path !== undefined && typeof path !== "string")
        throw Error("INVALID_TWILIO_PAGE");
    }
    return { rows, complete: !path };
  }
  async report(period) {
    if (!this.connected)
      return {
        status: "not_connected",
        total: null,
        categories: [],
        calls: [],
        complete: false,
      };
    const key = period.start + ":" + period.end,
      cached = this.cache.get(key);
    if (cached && Date.now() - cached.savedAt < 60000) return cached.value;
    if (this.pending.has(key)) return this.pending.get(key);
    const promise = this.load(period)
      .then((value) => {
        if (this.cache.size >= 16)
          this.cache.delete(this.cache.keys().next().value);
        this.cache.set(key, { savedAt: Date.now(), value });
        return value;
      })
      .finally(() => this.pending.delete(key));
    this.pending.set(key, promise);
    return promise;
  }
  async load(period) {
    const base = "/2010-04-01/Accounts/" + this.accountSid;
    if (!this.includeCosts) {
      const query = new URLSearchParams({
        "StartTime>": period.startAt,
        "StartTime<": period.endAt,
        PageSize: "1000",
      });
      const result = await this.pages(base + "/Calls.json?" + query, "calls");
      const calls = result.rows.map((r) => {
        if (r.account_sid !== this.accountSid)
          throw Error("TWILIO_ACCOUNT_MISMATCH");
        return {
          id: r.sid,
          parentId: r.parent_call_sid || null,
          startedAt: r.start_time,
          endedAt: r.end_time,
          durationSeconds: decimal(r.duration),
          status: r.status,
          direction: r.direction,
          amount: null,
          currency: null,
        };
      });
      return {
        status: result.complete ? "connected" : "partial",
        complete: result.complete,
        callsComplete: result.complete,
        generatedAt: new Date().toISOString(),
        calls,
      };
    }

    const usageQuery = new URLSearchParams({
      StartDate: period.start,
      EndDate: period.end,
      IncludeSubaccounts: "false",
      PageSize: "1000",
    });
    const callQuery = new URLSearchParams({
      "StartTime>": period.startAt,
      "StartTime<": period.endAt,
      PageSize: "1000",
    });
    const results = await Promise.allSettled([
      this.pages(base + "/Usage/Records.json?" + usageQuery, "usage_records"),
      this.pages(base + "/Calls.json?" + callQuery, "calls"),
    ]);
    const usage = results[0].status === "fulfilled" ? results[0].value : null;
    const records = results[1].status === "fulfilled" ? results[1].value : null;
    const validateAccount = (row) => {
      if (row.account_sid !== this.accountSid)
        throw Error("TWILIO_ACCOUNT_MISMATCH");
      return row;
    };
    const categories = (usage?.rows || []).map(validateAccount).map((r) => ({
      category: r.category,
      label: r.description || r.category,
      amount: decimal(r.price),
      currency: /^[A-Z]{3}$/i.test(r.price_unit || "")
        ? r.price_unit.toUpperCase()
        : null,
      usage: decimal(r.usage),
      usageUnit: r.usage_unit,
      count: decimal(r.count),
      asOf: r.as_of || null,
    }));
    const totalRows = categories.filter((r) => r.category === "totalprice");
    const total =
      usage?.complete && totalRows.length === 1 && totalRows[0].currency
        ? totalRows[0]
        : null;
    const calls = (records?.rows || []).map(validateAccount).map((r) => ({
      id: r.sid,
      parentId: r.parent_call_sid || null,
      startedAt: r.start_time,
      endedAt: r.end_time,
      durationSeconds: decimal(r.duration),
      status: r.status,
      direction: r.direction,
      amount: decimal(r.price) === null ? null : -decimal(r.price),
      currency: /^[A-Z]{3}$/i.test(r.price_unit || "")
        ? r.price_unit.toUpperCase()
        : null,
    }));
    const error = results.find((r) => r.status === "rejected")?.reason;
    return {
      status:
        usage || records
          ? error || !usage?.complete || !records?.complete
            ? "partial"
            : "connected"
          : error?.status === 401 || error?.status === 403
            ? "permission_required"
            : "unavailable",
      generatedAt: new Date().toISOString(),
      period,
      total,
      categories,
      calls,
      complete: !!usage?.complete && !!records?.complete,
      callsComplete: !!records?.complete,
      usageComplete: !!usage?.complete,
      note: "Twilio account usage is provider-reported and may arrive later. Tenant call charges are included in the account total, not additional to it. Number rental and other account charges remain unallocated without an explicit billing allocation.",
    };
  }
}

export function allocateTwilio(report, knownCallTenants = new Map()) {
  const byId = new Map(report.calls.map((c) => [c.id, c]));
  const resolve = (id) => {
    const seen = new Set();
    let current = id;
    while (current && !seen.has(current)) {
      if (knownCallTenants.has(current)) return knownCallTenants.get(current);
      seen.add(current);
      current = byId.get(current)?.parentId;
    }
    return null;
  };
  const groups = new Map();
  for (const call of report.calls) {
    const tenantId = resolve(call.id),
      key = tenantId || "__unallocated__";
    const group = groups.get(key) || {
      tenantId,
      legs: 0,
      transferLegs: 0,
      pendingPrices: 0,
      amounts: {},
      priced: {},
    };
    group.legs++;
    if (call.parentId) group.transferLegs++;
    if (call.amount === null || !call.currency) group.pendingPrices++;
    else {
      group.amounts[call.currency] = round(
        (group.amounts[call.currency] || 0) + call.amount,
      );
      const sample = (group.priced[call.currency] ||= {
        count: 0,
        seconds: 0,
        durationAmount: 0,
        unknownDuration: false,
      });
      sample.count++;
      if (typeof call.durationSeconds === "number") {
        sample.seconds += call.durationSeconds;
        sample.durationAmount += call.amount;
      } else sample.unknownDuration = true;
    }
    groups.set(key, group);
  }
  return [...groups.values()];
}
