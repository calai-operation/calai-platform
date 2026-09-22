import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { once } from "node:events";
import {
  VapiLiveReader,
  projectLiveUsage,
} from "../src/app/modules/systemOwner/dashboard/helpers/live-usage.js";
import { operationsRouter } from "../src/app/modules/systemOwner/dashboard/helpers/operations.service.js";
const now = Date.parse("2026-09-09T12:00:00Z");
const businesses = [
  {
    id: "a",
    name: "Tenant A",
    status: "active",
    agents: [
      { id: "agent-a", name: "Booking agent", vapiAgentId: "assistant-a" },
    ],
  },
  { id: "b", name: "Tenant B", status: "active", agents: [] },
];
const call = {
  id: "1",
  assistantId: "assistant-a",
  createdAt: "2026-08-01T12:00:00Z",
  updatedAt: "2026-09-09T11:59:00Z",
  startedAt: "2026-09-09T11:58:00Z",
  status: "in-progress",
};
const report = (calls) => ({ status: "connected", complete: true, calls });
test("live counts distinct agents, concurrent calls and tenants independently of historical dates", () => {
  const result = projectLiveUsage({
    businesses,
    now,
    vapi: report([
      call,
      { ...call, id: "2" },
      { ...call, id: "3", assistantId: "other" },
      { ...call, id: "4", status: "ringing" },
      { ...call, id: "5", status: "queued" },
      { ...call, id: "6", status: "forwarding" },
      { ...call, id: "7", status: "ended", endedAt: "2026-09-09T11:59Z" },
    ]),
  });
  assert.equal(result.summary.activeCalls, 3);
  assert.equal(result.summary.agentsInUse, 2);
  assert.equal(result.summary.tenantsInUse, 1);
  assert.equal(result.summary.unlinkedActiveCalls, 1);
  assert.equal(result.tenants[0].agentsInUse, 1);
  assert.equal(result.tenants[0].activeCalls, 2);
  assert.equal(result.tenants[1].activeCalls, 0);
  assert.equal(result.summary.ringing, 1);
  assert.equal(result.summary.queued, 1);
  assert.equal(result.summary.forwarding, 1);
  assert.equal(result.calls[0].elapsedSeconds, 120);
  assert.equal(result.complete, true);
});
test("live attribution prefers stored ownership and never projects caller data or secrets", () => {
  const result = projectLiveUsage({
    businesses,
    now,
    localCalls: [{ vapiCallId: "1", businessId: "b" }],
    vapi: report([
      {
        ...call,
        customer: { number: "PRIVATE" },
        transcript: "PRIVATE",
        monitor: { listenUrl: "PRIVATE" },
      },
    ]),
  });
  assert.equal(result.calls[0].tenantId, "b");
  assert.equal(result.calls[0].attribution, "recorded_call");
  assert.ok(!JSON.stringify(result).includes("PRIVATE"));
});
test("failed or truncated provider coverage is explicitly incomplete, not a confirmed zero", () => {
  for (const vapi of [
    { status: "unavailable", calls: [] },
    { status: "partial", complete: false, calls: [call] },
    { status: "not_connected", calls: [] },
  ])
    assert.equal(projectLiveUsage({ businesses, now, vapi }).complete, false);
});
test("updated-time polling catches old scheduled calls, retains unchanged calls, and removes ended calls", async () => {
  let time = now,
    rows = [call],
    requests = 0;
  const client = {
    token: "TEST",
    get: async (path) => {
      requests++;
      const url = new URL(path, "https://api.vapi.ai");
      assert.ok(url.searchParams.has("updatedAtGe"));
      assert.ok(!url.searchParams.has("createdAtGe"));
      return rows;
    },
  };
  const reader = new VapiLiveReader(client, { now: () => time });
  assert.equal((await reader.report()).calls.length, 1);
  assert.equal((await reader.report()).calls.length, 1);
  assert.equal(requests, 1);
  time += 5000;
  rows = [];
  assert.equal((await reader.report()).calls.length, 1);
  time += 5000;
  rows = [
    {
      ...call,
      status: "ended",
      endedAt: new Date(time - 1).toISOString(),
      updatedAt: new Date(time - 1).toISOString(),
    },
  ];
  assert.equal((await reader.report()).calls.length, 0);
});
test("live poll validates provider range, exposes pagination truncation and retries errors", async () => {
  const invalid = new VapiLiveReader(
    { token: "TEST", get: async () => [{ ...call, updatedAt: "2020-01-01" }] },
    { now: () => now },
  );
  await assert.rejects(invalid.report(), /RANGE/);
  const reader = new VapiLiveReader(
    {
      token: "TEST",
      get: async () =>
        Array.from({ length: 1000 }, (_, i) => ({ ...call, id: String(i) })),
    },
    { now: () => now, maxRequests: 1 },
  );
  assert.equal((await reader.report()).complete, false);
  let attempts = 0;
  const retry = new VapiLiveReader(
    {
      token: "TEST",
      get: async () => {
        if (!attempts++) throw Error("temporary");
        return [call];
      },
    },
    { now: () => now },
  );
  await assert.rejects(retry.report());
  assert.equal((await retry.report()).calls.length, 1);
});
test("live route enforces the admin guard before reading live provider activity", async () => {
  let reads = 0;
  const app = express();
  app.use(
    "/operations",
    operationsRouter({
      authorize: (req, res, next) =>
        req.headers["x-role"] === "SYSTEM_OWNER"
          ? next()
          : res.sendStatus(req.headers["x-role"] ? 403 : 401),
      report: async () => ({}),
      live: async () => {
        reads++;
        return { calls: [] };
      },
    }),
  );
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const url = "http://127.0.0.1:" + server.address().port + "/operations/live";
  try {
    assert.equal((await fetch(url)).status, 401);
    assert.equal(
      (await fetch(url, { headers: { "x-role": "BUSINESS_OWNER" } })).status,
      403,
    );
    assert.equal(reads, 0);
    const response = await fetch(url, {
      headers: { "x-role": "SYSTEM_OWNER" },
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.equal(reads, 1);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
