// Read-only Vapi reports. The existing backend private key never reaches the UI.
export class VapiReporting {
  constructor({ token, fetchImpl = fetch, maxRequests = 64 } = {}) {
    this.token = token;
    this.fetch = fetchImpl;
    this.maxRequests = maxRequests;
    this.cache = new Map();
    this.pending = new Map();
  }
  async get(path) {
    const response = await this.fetch("https://api.vapi.ai" + path, {
      method: "GET",
      redirect: "error",
      headers: { Authorization: "Bearer " + this.token },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      if (response.status === 400) {
        const body = await response.json().catch(() => ({}));
        const message = typeof body.message === "string" ? body.message : "";
        const days = message.match(
          /only covers the last (\d+) days of call history/i,
        );
        const date = message.match(
          /adjust your date filter to (.+?) or later/i,
        );
        const retentionStart = date ? Date.parse(date[1] + " UTC") : NaN;
        if (days && Number.isFinite(retentionStart))
          throw Object.assign(Error("VAPI_RETENTION_LIMIT"), {
            status: 400,
            retentionDays: Number(days[1]),
            retentionStart,
          });
      }
      throw Object.assign(
        Error(
          [401, 403].includes(response.status)
            ? "VAPI_PERMISSION_REQUIRED"
            : "VAPI_UNAVAILABLE",
        ),
        { status: response.status },
      );
    }
    return response.json();
  }
  async report(period) {
    if (!this.token)
      return {
        status: "not_connected",
        calls: [],
        assistants: [],
        complete: false,
      };
    const key = period.start + ":" + period.end,
      cached = this.cache.get(key);
    if (cached && Date.now() - cached.savedAt < 60000) return cached.value;
    if (this.pending.has(key)) return this.pending.get(key);
    const request = this.load(period)
      .then((value) => {
        if (this.cache.size >= 16)
          this.cache.delete(this.cache.keys().next().value);
        this.cache.set(key, { savedAt: Date.now(), value });
        return value;
      })
      .finally(() => this.pending.delete(key));
    this.pending.set(key, request);
    return request;
  }
  async load(period) {
    const calls = new Map();
    let requests = 0,
      complete = true,
      note;
    const ranges = [[Date.parse(period.startAt), Date.parse(period.endAt)]];
    while (ranges.length) {
      if (requests++ >= this.maxRequests) {
        complete = false;
        break;
      }
      const [start, end] = ranges.pop();
      const query = new URLSearchParams({
        createdAtGe: new Date(start).toISOString(),
        createdAtLt: new Date(end).toISOString(),
        limit: "1000",
      });
      let rows;
      try {
        rows = await this.get("/call?" + query);
      } catch (error) {
        if (error.message !== "VAPI_RETENTION_LIMIT") throw error;
        complete = false;
        note = `Vapi's current plan allows ${error.retentionDays} days of call history. Earlier calls and costs are unavailable; this is not a complete monthly total.`;
        if (error.retentionStart > start && error.retentionStart < end)
          ranges.push([error.retentionStart, end]);
        continue;
      }
      if (!Array.isArray(rows)) throw Error("INVALID_VAPI_REPORT");
      for (const call of rows) {
        const created = Date.parse(call.createdAt);
        if (
          !call.id ||
          !Number.isFinite(created) ||
          created < start ||
          created >= end
        )
          throw Error("INVALID_VAPI_REPORT_RANGE");
        calls.set(call.id, call);
      }
      if (rows.length >= 1000) {
        if (end - start <= 1) {
          complete = false;
          continue;
        }
        const middle = Math.floor((start + end) / 2);
        ranges.push([start, middle], [middle, end]);
      }
    }
    let assistants = [];
    try {
      const data = await this.get("/assistant");
      if (Array.isArray(data))
        assistants = data.map((a) => ({ id: a.id, name: a.name }));
    } catch {
      /* Calls remain usable when assistant listing is unavailable. */
    }
    this.assistants = assistants;
    return {
      status: complete ? "connected" : "partial",
      generatedAt: new Date().toISOString(),
      period,
      complete,
      note,
      calls: [...calls.values()],
      assistants,
    };
  }
}
