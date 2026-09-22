import test from "node:test";
import assert from "node:assert/strict";
import {
  TwilioReporting,
  allocateTwilio,
  reportPeriod,
} from "../src/app/modules/systemOwner/dashboard/helpers/twilio-reporting.js";
const accountSid = "AC" + "1".repeat(32),
  authToken = "2".repeat(32);
const period = reportPeriod(
  { start: "2026-09-01", end: "2026-09-09" },
  new Date("2026-09-09"),
);
const response = (value) => ({ ok: true, json: async () => value });
test("validates real dates, inclusive UTC end and maximum reporting window", () => {
  assert.equal(period.endAt, "2026-09-10T00:00:00.000Z");
  for (const query of [
    { start: "2026-02-30" },
    { start: ["2026-09-01"] },
    { start: "2026-01-01" },
    { end: "2026-10-01" },
  ])
    assert.throws(() => reportPeriod(query, new Date("2026-09-09")));
});
test("not connected stays unknown and does not call Twilio", async () => {
  const client = new TwilioReporting({
    fetchImpl: () => assert.fail("must not call"),
  });
  assert.equal((await client.report(period)).total, null);
});
test("paginates call legs, uses totalprice, preserves currencies, and only makes GET requests", async () => {
  const seen = [];
  const client = new TwilioReporting({
    accountSid,
    authToken,
    fetchImpl: async (url, options) => {
      seen.push(url.href);
      assert.equal(options.method, "GET");
      assert.equal(options.redirect, "error");
      if (url.pathname.includes("Usage")) {
        assert.equal(url.searchParams.get("IncludeSubaccounts"), "false");
        return response({
          usage_records: [
            {
              account_sid: accountSid,
              category: "totalprice",
              price: "10",
              price_unit: "gbp",
            },
            {
              account_sid: accountSid,
              category: "calls",
              price: "6",
              price_unit: "gbp",
            },
          ],
          next_page_uri: null,
        });
      }
      if (url.searchParams.get("Page") === "1")
        return response({
          calls: [
            {
              account_sid: accountSid,
              sid: "CA2",
              price: null,
              price_unit: "gbp",
            },
          ],
          next_page_uri: null,
        });
      assert.equal(url.searchParams.get("StartTime<"), period.endAt);
      return response({
        calls: [
          {
            account_sid: accountSid,
            sid: "CA1",
            price: "-0.125",
            price_unit: "gbp",
          },
        ],
        next_page_uri:
          "/2010-04-01/Accounts/" + accountSid + "/Calls.json?Page=1",
      });
    },
  });
  const report = await client.report(period);
  assert.equal(report.total.amount, 10);
  assert.equal(report.total.currency, "GBP");
  assert.equal(report.calls[0].amount, 0.125);
  assert.equal(report.calls[1].amount, null);
  assert.equal(report.complete, true);
  await client.report(period);
  assert.equal(seen.length, 3);
  assert.ok(!JSON.stringify(report).includes(authToken));
});
test("rejects cross-origin or different-account pagination without transmitting credentials", async () => {
  const client = new TwilioReporting({
    accountSid,
    authToken,
    fetchImpl: () => assert.fail("must not fetch"),
  });
  await assert.rejects(
    client.get(
      "https://example.com/2010-04-01/Accounts/" + accountSid + "/Calls.json",
    ),
  );
  await assert.rejects(
    client.get("/2010-04-01/Accounts/AC" + "3".repeat(32) + "/Calls.json"),
  );
});
test("retains a usable billing report when call-list permission is missing", async () => {
  const client = new TwilioReporting({
    accountSid,
    authToken,
    fetchImpl: async (url) =>
      url.pathname.includes("Usage")
        ? response({
            usage_records: [
              {
                account_sid: accountSid,
                category: "totalprice",
                price: "0",
                price_unit: "usd",
              },
            ],
            next_page_uri: null,
          })
        : { ok: false, status: 403 },
  });
  const report = await client.report(period);
  assert.equal(report.status, "partial");
  assert.equal(report.total.amount, 0);
  assert.equal(report.callsComplete, false);
});
test("marks truncation and never pretends a capped report is complete", async () => {
  const client = new TwilioReporting({
    accountSid,
    authToken,
    maxPages: 1,
    fetchImpl: async (url) =>
      response({
        [url.pathname.includes("Usage") ? "usage_records" : "calls"]: [],
        next_page_uri:
          "/2010-04-01/Accounts/" + accountSid + "/Calls.json?Page=1",
      }),
  });
  assert.equal((await client.report(period)).complete, false);
});
test("attributes child transfer legs by exact parent, keeps unknown calls unallocated and separates currency", () => {
  const report = {
    calls: [
      { id: "child", parentId: "parent", amount: 0.3, currency: "GBP" },
      { id: "parent", amount: 0.2, currency: "GBP" },
      { id: "usd", amount: 0.4, currency: "USD" },
      { id: "unknown", amount: null, currency: "GBP" },
    ],
  };
  const groups = allocateTwilio(
    report,
    new Map([
      ["parent", "tenant-a"],
      ["usd", "tenant-a"],
    ]),
  );
  assert.deepEqual(groups[0].amounts, { GBP: 0.5, USD: 0.4 });
  assert.equal(groups[0].legs, 3);
  assert.equal(groups[0].transferLegs, 1);
  assert.equal(groups[0].priced.GBP.count, 2);
  assert.equal(groups[1].tenantId, null);
  assert.equal(groups[1].pendingPrices, 1);
});
