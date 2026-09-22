import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { DashboardRouter } from "../src/app/modules/businessowner/dashboard/dashboard.route.js";
import {
  getOwnerInsights,
  getOwnerLiveCalls,
  callSeries,
} from "../src/app/modules/businessowner/dashboard/dashboard.service.js";

const now = Date.parse("2026-09-09T12:00:00Z");
async function withServer(router, fn) {
  const app = express();
  app.use(router);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  try {
    await fn("http://127.0.0.1:" + server.address().port);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}
const authorize = (req, res, next) => {
  if (req.headers.authorization !== "owner-a") return res.sendStatus(401);
  req.user = { id: "user-a" };
  next();
};

test("owner live activity is server-scoped and strips all other tenants and admin fields", async () => {
  let calls = 0;
  const prisma = {
    business: {
      findFirst: async (query) => {
        assert.deepEqual(query, {
          where: { ownerId: "user-a" },
          select: { id: true },
        });
        return { id: "business-a" };
      },
    },
  };
  const shared = {
    generatedAt: new Date(now).toISOString(),
    complete: true,
    summary: { activeCalls: 100 },
    providers: { secret: "never" },
    tenants: [{ name: "Private B" }],
    calls: [
      {
        id: "a1",
        tenantId: "business-a",
        agentKey: "agent-a",
        agentName: "Reception",
        status: "in-progress",
        startedAt: "2026-09-09T11:59:00Z",
        cost: 999,
        customerNumber: "private",
      },
      {
        id: "a2",
        tenantId: "business-a",
        agentKey: "agent-a",
        agentName: "Reception",
        status: "in-progress",
      },
      {
        id: "a3",
        tenantId: "business-a",
        agentKey: "agent-a",
        agentName: "Reception",
        status: "ringing",
      },
      {
        id: "b1",
        tenantId: "business-b",
        agentKey: "agent-b",
        agentName: "Private B",
        status: "in-progress",
      },
      {
        id: "unlinked",
        tenantId: null,
        agentKey: "unknown",
        status: "in-progress",
      },
    ],
  };
  const data = await getOwnerLiveCalls(prisma, "user-a", async () => {
    calls++;
    return shared;
  });
  assert.equal(calls, 1);
  assert.equal(data.summary.activeCalls, 2);
  assert.equal(data.summary.agentsInUse, 1);
  assert.equal(data.summary.ringing, 1);
  assert.deepEqual(
    data.calls.map((c) => c.id),
    ["a1", "a2", "a3"],
  );
  assert.ok(
    !JSON.stringify(data).match(
      /business-b|Private B|private|cost|providers|tenantId|unlinked/,
    ),
  );
});

test("owner missing business fails closed and provider failures do not disclose details", async () => {
  let requested = false;
  await assert.rejects(
    () =>
      getOwnerLiveCalls(
        { business: { findFirst: async () => null } },
        "user-a",
        async () => {
          requested = true;
        },
      ),
    (err) => err.status === 404,
  );
  assert.equal(requested, false);
  await assert.rejects(
    () =>
      getOwnerLiveCalls(
        { business: { findFirst: async () => ({ id: "a" }) } },
        "user-a",
        async () => {
          throw Error("private-key");
        },
      ),
    (err) => Boolean(err),
  );
});
test("daily and weekly graphs use UTC Monday boundaries, zero-fill and exclude out-of-range dates", () => {
  const result = callSeries(
    [
      { date: "2026-09-06", calls: 3n, failed: 1n, seconds: 120n },
      { date: "2026-09-07", calls: 2n, failed: 0n, seconds: 90n },
      { date: "2026-09-10", calls: 99n, failed: 0n, seconds: 0n },
      { date: "2020-01-01", calls: 99n, failed: 0n, seconds: 0n },
    ],
    now,
  );
  assert.equal(result.daily.length, 28);
  assert.equal(result.weekly.length, 12);
  assert.deepEqual(result.weekly.at(-1), {
    date: "2026-09-07",
    calls: 2,
    failed: 0,
    minutes: 1.5,
  });
  assert.equal(result.weekly.at(-2).calls, 3);
  assert.equal(result.daily.at(-1).calls, 0);
  assert.equal(
    result.daily.reduce((sum, row) => sum + row.calls, 0),
    5,
  );
});
test("order values use priced orders, every query binds the authenticated business and no prices are invented", async () => {
  const businessId = "07da9db2-8550-4067-aae8-e7800ab651a0";
  let priced = 2,
    total = 3;
  const prisma = {
    business: {
      findFirst: async (query) => {
        assert.equal(query.where.ownerId, "user-a");
        return { id: businessId };
      },
    },
    order: {
      aggregate: async (query) => {
        assert.deepEqual(query.where, { businessId });
        return {
          _count: { _all: total, totalPrice: priced },
          _sum: { totalPrice: priced ? 42 : null },
          _avg: { totalPrice: priced ? 21 : null },
        };
      },
      count: async (query) => {
        assert.equal(query.where.businessId, businessId);
        return 1;
      },
    },
    call: {
      count: async (query) => {
        assert.deepEqual(query.where, { businessId, status: "failed" });
        return 2;
      },
    },
    $queryRaw: async (strings, ...values) => {
      assert.equal(values[0], businessId);
      assert.ok(strings.join("?").includes('"businessId" = ?::uuid'));
      assert.equal(values.length, 3);
      return [];
    },
  };
  const result = await getOwnerInsights(prisma, "user-a", now);
  assert.equal(result.orders.value, 42);
  assert.equal(result.orders.average, 21);
  assert.equal(result.orders.unpriced, 1);
  priced = 0;
  assert.equal(
    (await getOwnerInsights(prisma, "user-a", now)).orders.value,
    null,
  );
  total = 0;
  assert.equal((await getOwnerInsights(prisma, "user-a", now)).orders.value, 0);
});
test("dashboard route denies anonymous access to stats, insights, and live", async () => {
  await withServer(DashboardRouter, async (base) => {
    assert.equal((await fetch(base + "/stats")).status, 401);
    assert.equal((await fetch(base + "/insights")).status, 401);
    assert.equal((await fetch(base + "/live")).status, 401);
  });
});
