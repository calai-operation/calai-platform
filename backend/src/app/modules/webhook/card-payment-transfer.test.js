import test from "node:test";
import assert from "node:assert/strict";
import {
  createCardPaymentTransfer,
  createCardPaymentTransferController,
  readCardTransferSecret,
  isDefiniteTransferRejection,
  createTransferAttemptStore,
  CARD_TRANSFER_MESSAGE,
} from "./card-payment-transfer.js";

const callId = "00000000-0000-4000-8000-000000000001";
const assistantId = "00000000-0000-4000-8000-000000000002";
const activeCall = {
  id: callId,
  status: "in-progress",
  assistantId,
  monitor: { controlUrl: "https://phone-call-websocket.vapi.ai/control" },
};
const destination = {
  type: "number",
  number: "+441234567890",
  message: "Old staff message",
  transferPlan: { mode: "blind-transfer" },
};
const assistant = {
  id: assistantId,
  model: { tools: [{ type: "transferCall", destinations: [destination] }] },
};
function sharedStore() {
  const values = new Map();
  const redis = {
    isReady: true,
    async set(key, value, { NX }) {
      if (NX && values.has(key)) return null;
      values.set(key, value);
      return "OK";
    },
    async get(key) {
      return values.get(key) ?? null;
    },
    async eval(script, { keys: [key], arguments: [lease, status, value] }) {
      if (values.get(key) !== lease) return 0;
      if (status === "not_initiated") {
        values.delete(key);
        return 1;
      }
      values.set(key, value);
      return "OK";
    },
  };
  return { store: createTransferAttemptStore(redis), redis };
}
function setup(overrides = {}) {
  const sent = [];
  const handle = createCardPaymentTransfer({
    attemptStore: sharedStore().store,
    getCall: async () => activeCall,
    getAssistant: async () => assistant,
    getTool: async () => {
      throw Error("Unexpected shared tool");
    },
    findOrder: async () => ({ confirmationStatus: "confirmed" }),
    transfer: async (...args) => sent.push(args),
    ...overrides,
  });
  return { handle, sent };
}

test("saved confirmed order transfers once even for concurrent and repeated requests", async () => {
  const { handle, sent } = setup();
  const results = await Promise.all([
    handle(callId),
    handle(callId),
    handle(callId),
  ]);
  assert.ok(results.every((x) => x.status === "initiated" && x.success));
  assert.equal((await handle(callId)).status, "initiated");
  assert.equal(sent.length, 1);
  assert.equal(sent[0][0], activeCall.monitor.controlUrl);
  assert.equal(sent[0][1].content, CARD_TRANSFER_MESSAGE);
  assert.equal(sent[0][1].destination.number, destination.number);
  assert.equal(sent[0][1].destination.message, undefined);
  assert.deepEqual(
    sent[0][1].destination.transferPlan,
    destination.transferPlan,
  );
  assert.equal(destination.message, "Old staff message");
});
test("missing or unconfirmed saved order cannot transfer", async () => {
  for (const order of [null, { confirmationStatus: "unconfirmed" }, {}]) {
    const { handle, sent } = setup({ findOrder: async () => order });
    assert.equal((await handle(callId)).status, "not_initiated");
    assert.equal(sent.length, 0);
  }
});
test("invalid, mismatched, or inactive calls cannot transfer", async () => {
  const invalid = setup();
  assert.equal((await invalid.handle("invalid")).status, "not_initiated");
  for (const call of [
    { ...activeCall, status: "ended" },
    { ...activeCall, id: assistantId },
    { ...activeCall, assistantId: "invalid" },
    null,
  ]) {
    const { handle, sent } = setup({ getCall: async () => call });
    assert.equal((await handle(callId)).status, "not_initiated");
    assert.equal(sent.length, 0);
  }
});
test("call and assistant identities must match", async () => {
  const { handle, sent } = setup({
    getAssistant: async () => ({ ...assistant, id: callId }),
  });
  assert.equal((await handle(callId)).status, "not_initiated");
  assert.equal(sent.length, 0);
});
test("missing, ambiguous, and invalid destinations fail before dispatch", async () => {
  for (const destinations of [
    [],
    [destination, destination],
    [{ type: "sip", sipUri: "sip:example" }],
    [{ type: "number", number: "invalid" }],
  ]) {
    const { handle, sent } = setup({
      getAssistant: async () => ({
        id: assistantId,
        model: { tools: [{ type: "transferCall", destinations }] },
      }),
    });
    assert.equal((await handle(callId)).status, "not_initiated");
    assert.equal(sent.length, 0);
  }
});
test("shared tool destination is resolved from trusted Vapi configuration", async () => {
  const { handle, sent } = setup({
    getAssistant: async () => ({
      id: assistantId,
      model: { toolIds: ["configured"] },
    }),
    getTool: async (id) => {
      assert.equal(id, "configured");
      return { type: "transferCall", destinations: [destination] };
    },
  });
  assert.equal((await handle(callId)).status, "initiated");
  assert.equal(sent.length, 1);
});
test("untrusted call-control URLs fail before dispatch", async () => {
  for (const url of [
    "https://evil.example/control",
    "https://vapi.ai.evil.example/control",
    "http://phone-call-websocket.vapi.ai/control",
    "https://user@phone-call-websocket.vapi.ai/control",
    "https://phone-call-websocket.vapi.ai:8080/control",
    undefined,
  ]) {
    const { handle, sent } = setup({
      getCall: async () => ({ ...activeCall, monitor: { controlUrl: url } }),
    });
    assert.equal((await handle(callId)).status, "not_initiated");
    assert.equal(sent.length, 0);
  }
});
test("lookup failure is definitely not initiated", async () => {
  const { handle, sent } = setup({
    getCall: async () => {
      throw Error("Lookup unavailable");
    },
  });
  assert.equal((await handle(callId)).status, "not_initiated");
  assert.equal(sent.length, 0);
});
test("dispatch timeout is unknown and never automatically dispatched twice", async () => {
  let count = 0;
  const { handle } = setup({
    transfer: async () => {
      count++;
      throw new DOMException("Timeout", "TimeoutError");
    },
  });
  assert.equal((await handle(callId)).status, "unknown");
  assert.equal((await handle(callId)).status, "unknown");
  assert.equal(count, 1);
});
test("shared claim prevents two worker instances dispatching the same call", async () => {
  const { store } = sharedStore();
  let count = 0;
  const deps = {
    attemptStore: store,
    transfer: async () => {
      count++;
    },
  };
  const a = setup(deps),
    b = setup(deps);
  const results = await Promise.all([a.handle(callId), b.handle(callId)]);
  assert.equal(count, 1);
  assert.ok(results.every((r) => ["initiated", "unknown"].includes(r.status)));
});
test("uncertain dispatch survives handler restart through the shared claim", async () => {
  const { store } = sharedStore();
  let count = 0;
  const deps = {
    attemptStore: store,
    transfer: async () => {
      count++;
      throw Error("Response lost");
    },
  };
  assert.equal((await setup(deps).handle(callId)).status, "unknown");
  assert.equal((await setup(deps).handle(callId)).status, "unknown");
  assert.equal(count, 1);
});
test("unavailable shared state fails closed before dispatch", async () => {
  const { store, redis } = sharedStore();
  redis.isReady = false;
  const { handle, sent } = setup({ attemptStore: store });
  assert.equal((await handle(callId)).status, "not_initiated");
  assert.equal(sent.length, 0);
});
test("accepted transfer remains protected when final-state storage fails", async () => {
  const { store, redis } = sharedStore();
  let count = 0;
  redis.eval = async () => {
    throw Error("State write unavailable");
  };
  const deps = {
    attemptStore: store,
    transfer: async () => {
      count++;
    },
  };
  assert.equal((await setup(deps).handle(callId)).status, "initiated");
  assert.equal((await setup(deps).handle(callId)).status, "unknown");
  assert.equal(count, 1);
});
test("explicit request rejection allows later controlled recovery", async () => {
  let count = 0;
  const { handle } = setup({
    transfer: async () => {
      count++;
      if (count === 1)
        throw Object.assign(Error("Rejected"), {
          definitelyNotInitiated: true,
        });
    },
  });
  assert.equal((await handle(callId)).status, "not_initiated");
  assert.equal((await handle(callId)).status, "initiated");
  assert.equal(count, 2);
});
test("HTTP timeouts, conflicts, and server errors never prove a transfer was rejected", () => {
  for (const status of [408, 409, 500, 502, 503, 504])
    assert.equal(isDefiniteTransferRejection(status), false);
  for (const status of [400, 401, 403, 404, 422, 429])
    assert.equal(isDefiniteTransferRejection(status), true);
});

function request(args = { payment_method: "card" }, extra = {}) {
  return {
    get: () => "test-secret",
    body: {
      message: {
        type: "tool-calls",
        call: { id: callId },
        toolCalls: [
          {
            id: "tool-1",
            function: { name: "transferForCardPayment", arguments: args },
          },
        ],
      },
    },
    ...extra,
  };
}
function response() {
  return {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}
function controllerSetup(extra = {}) {
  const handled = [];
  const controller = createCardPaymentTransferController({
    getSecret: async () => "test-secret",
    handle: async (id) => {
      handled.push(id);
      return { success: true, status: "initiated" };
    },
    ...extra,
  });
  return { controller, handled };
}
test("controller authenticates and returns string result with matching tool-call ID", async () => {
  const { controller, handled } = controllerSetup();
  const res = response();
  await controller(
    request(
      JSON.stringify({ payment_method: "card", number: "+449999999999" }),
    ),
    res,
  );
  assert.equal(res.statusCode, 200);
  assert.deepEqual(handled, [callId]);
  assert.equal(res.body.results[0].toolCallId, "tool-1");
  assert.equal(typeof res.body.results[0].result, "string");
  assert.equal(JSON.parse(res.body.results[0].result).status, "initiated");
});
test("cash, missing payment, and malformed arguments never invoke transfer", async () => {
  for (const args of [{ payment_method: "cash" }, {}, "{invalid", null]) {
    const { controller, handled } = controllerSetup();
    const res = response();
    await controller(request(args), res);
    assert.equal(handled.length, 0);
    assert.equal(
      JSON.parse(res.body.results[0].result).status,
      "not_initiated",
    );
  }
});
test("missing or inaccessible secret fails closed without invoking transfer", async () => {
  for (const getSecret of [
    async () => null,
    async () => {
      throw Error("Missing config");
    },
  ]) {
    const { controller, handled } = controllerSetup({ getSecret });
    const res = response();
    await controller(request(), res);
    assert.equal(res.statusCode, 503);
    assert.equal(handled.length, 0);
  }
});
test("incorrect or missing authentication never invokes transfer", async () => {
  for (const value of ["", undefined, "bad", "same-length"]) {
    const { controller, handled } = controllerSetup();
    const res = response();
    await controller(request(undefined, { get: () => value }), res);
    assert.equal(res.statusCode, 401);
    assert.equal(handled.length, 0);
  }
});
test("controller rejects wrong and multiple tools before transfer", async () => {
  for (const mutate of [
    (m) => (m.type = "other"),
    (m) => (m.toolCalls[0].function.name = "other"),
    (m) => m.toolCalls.push(m.toolCalls[0]),
    (m) => (m.toolCalls[0].id = ""),
  ]) {
    const { controller, handled } = controllerSetup();
    const res = response();
    const req = request();
    mutate(req.body.message);
    await controller(req, res);
    assert.equal(res.statusCode, 400);
    assert.equal(handled.length, 0);
  }
});
test("toolCallList envelope is supported when toolCalls is absent or empty", async () => {
  for (const empty of [undefined, []]) {
    const { controller, handled } = controllerSetup();
    const res = response();
    const req = request();
    req.body.message.toolCallList = req.body.message.toolCalls;
    req.body.message.toolCalls = empty;
    await controller(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(handled.length, 1);
  }
});
test("uncertain result remains explicit in model-visible response", async () => {
  const { controller } = controllerSetup({
    handle: async () => ({ success: false, status: "unknown" }),
  });
  const res = response();
  await controller(request(), res);
  assert.equal(JSON.parse(res.body.results[0].result).status, "unknown");
});
test("missing secret path returns no credential", async () => {
  assert.equal(await readCardTransferSecret(undefined), null);
  assert.equal(
    await readCardTransferSecret("./nonexistent-transfer-secret-directory"),
    null,
  );
});
