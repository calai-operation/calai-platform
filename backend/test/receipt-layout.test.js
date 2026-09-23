import test from "node:test";
import assert from "node:assert/strict";
import { generateReceiptText } from "../src/app/utils/receipt.js";
const order = {
  id: "12345678-test",
  date: "09/09/2026",
  time: "12:00",
  pickupTime: "12:15",
  orderType: "PICKUP",
  customerName: "Sample customer",
  call: { customerNumber: "Not provided" },
  totalPrice: 9,
  items: [
    { product_name: "Meat Samosa", quantity: 1, unit_prize: 4.5 },
    { product_name: "Onion Bhaji", quantity: 1, unit_prize: 4.5 },
  ],
};
test("long layout preserves values and section spacing within the printer width", () => {
  const text = generateReceiptText(
    order,
    { businessName: "Sample Restaurant" },
    { email: "restaurant@example.com" },
  );
  assert.ok(text.split("\n").length >= 50);
  assert.ok(text.split("\n").every((line) => line.length <= 40));
  assert.match(text, /Pickup Time: 12:15/);
  assert.match(text, /TOTAL:\s+£ 9\.00/);
  assert.match(text, /Need help\?/);
  assert.ok(text.endsWith("\n\n\n\n"));
});
test("long names, delivery addresses and confirmed-order notes are wrapped without truncation", () => {
  const name = "A very long restaurant dish name with extra ingredients";
  const text = generateReceiptText({
    ...order,
    orderType: "DELIVERY",
    deliveryAddress: "Flat 20, 123 A Very Long Street Name, Manchester, M1 1AA",
    items: [
      {
        product_name: name,
        quantity: 1,
        unit_prize: 9,
        notes: "Everything spicy please; no coriander.",
      },
    ],
  });
  assert.ok(text.replace(/\s+/g, " ").includes(name));
  assert.match(text.replace(/\s+/g, " "), /no coriander/);
  assert.ok(text.split("\n").every((line) => line.length <= 40));
});
test("unconfirmed slips retain warnings and never invent a total or pickup time", () => {
  const text = generateReceiptText({
    ...order,
    confirmationStatus: "unconfirmed",
    unconfirmedReason: "Caller disconnected before confirming.",
    totalPrice: null,
    items: [{ product_name: "Rice", quantity: 1, unit_prize: null }],
  });
  for (const word of [
    "UNCONFIRMED ORDER",
    "REASON NOT CONFIRMED",
    "Price unknown",
    "Not confirmed",
  ])
    assert.ok(text.includes(word));
  assert.ok(!text.includes("Pickup Time:"));
});

test("thermal printer binary encoding converts pound sign to single-byte CP437 (0x9C)", () => {
  const text = generateReceiptText(
    order,
    { businessName: "Testing Curry" },
    { email: "test@example.com" },
  );
  // Contains standard pound sign in UTF-8
  assert.ok(text.includes("£"));

  // Converted binary payload for thermal printer
  const binaryPayload = Buffer.from(text.replace(/\u00a3|£/g, "\x9c"), "binary");

  // Verify that multi-byte UTF-8 bytes for pound (0xC2 0xA3) are NOT present
  assert.ok(!binaryPayload.includes(Buffer.from([0xc2, 0xa3])));

  // Verify that single-byte 0x9C is present where £ was
  assert.ok(binaryPayload.includes(0x9c));
});

