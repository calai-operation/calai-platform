export const UNCONFIRMED_ASSISTANTS = new Set([
  "00f1f28f-2ad0-43b7-8d76-494ed209c5c8", // Test
  "70202223-f39f-4275-90c8-d0e6c4c21f62", // Testing Curry
  "f06cd3ce-646c-4c0f-a058-d20b6d8e9f85", // Testing Spice (Testing Curry template clone)
]);

// Dynamically load any extra assistant IDs from environment configuration
if (process.env.UNCONFIRMED_ASSISTANTS) {
  process.env.UNCONFIRMED_ASSISTANTS.split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .forEach((id) => UNCONFIRMED_ASSISTANTS.add(id));
}

export function registerUnconfirmedAssistant(id) {
  if (id) UNCONFIRMED_ASSISTANTS.add(String(id).trim());
}

export function isUnconfirmedSupported(assistantId) {
  return UNCONFIRMED_ASSISTANTS.has(assistantId);
}

const text = (value) =>
  typeof value === "string"
    ? value.replace(/[\x00-\x1f\x7f]/g, " ").trim()
    : "";
const amount = (value) =>
  value !== null &&
  value !== undefined &&
  value !== "" &&
  Number.isFinite(Number(value)) &&
  Number(value) >= 0
    ? Number(value)
    : null;
const truthy = (value) =>
  value === true ||
  ["true", "yes", "1"].includes(String(value || "").toLowerCase());
const itemArray = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : parsed?.order_details || [];
    } catch {
      return [];
    }
  }
  return value?.order_details || [];
};

const endingReason = (value) => {
  const reason = text(value).toLowerCase();
  if (
    reason.includes("customer-ended") ||
    reason.includes("customer-did-not-answer")
  )
    return "The customer disconnected before the order was confirmed.";
  if (reason.includes("assistant-ended"))
    return "The call ended before the order was confirmed.";
  if (reason.includes("forward") || reason.includes("transfer"))
    return "The call was transferred before the order was confirmed.";
  if (reason.includes("timeout"))
    return "The call timed out before the order was confirmed.";
  if (reason.includes("error") || reason.includes("failed"))
    return "A call error ended the order before confirmation.";
  return "The call ended before the order was fully confirmed.";
};

export function unconfirmedCandidate(
  assistantId,
  structuredData,
  call = {},
  options = {},
) {
  const isAllowed =
    options?.allowAll || UNCONFIRMED_ASSISTANTS.has(assistantId);
  if (!isAllowed) return null;
  if (!structuredData || typeof structuredData !== "object") return null;
  const data = structuredData.calai_unconfirmed_order || {};
  const status = String(
    structuredData.order_status || data.outcome || "",
  ).toLowerCase();
  // A successful save or explicit confirmation must never be duplicated as unconfirmed.
  if (
    ["confirmed", "completed", "complete", "saved"].includes(status) ||
    data.outcome === "confirmed" ||
    truthy(structuredData.customer_confirmed) ||
    truthy(structuredData.save_order_was_called)
  )
    return null;
  const rawItems = itemArray(data.items).length
    ? itemArray(data.items)
    : itemArray(
        structuredData.final_items ||
          structuredData.order_items ||
          structuredData.items,
      );
  const items = rawItems
    .map((item) => ({
      product_name: text(item.product_name).slice(0, 200),
      quantity: Number(item.quantity || 1),
      unit_prize: amount(item.unit_prize ?? item.unit_price ?? item.price),
      notes: text(item.notes).slice(0, 500),
    }))
    .filter(
      (item) =>
        item.product_name &&
        Number.isInteger(item.quantity) &&
        item.quantity > 0 &&
        item.quantity <= 1000,
    );
  // Calls without a captured item are enquiries or empty calls, not printable orders.
  if (!items.length) return null;
  return {
    confirmationStatus: "unconfirmed",
    unconfirmedReason:
      text(
        data.reason ||
          structuredData.unconfirmed_reason ||
          structuredData.reason,
      ).slice(0, 1000) ||
      (truthy(data.explicit_cancellation) ||
      ["cancelled", "canceled", "rejected", "cancel"].includes(status)
        ? "The customer ended or cancelled the order before confirmation."
        : endingReason(call.endedReason)),
    customerName:
      text(
        data.customer_name ||
          structuredData.customer_name ||
          structuredData.customerName,
      ).slice(0, 200) || null,
    items,
    totalPrice: amount(
      data.total_price ??
        structuredData.total_price ??
        structuredData.totalPrice,
    ),
    orderType:
      String(
        data.delivery_type ||
          structuredData.order_type ||
          structuredData.orderType,
      ).toLowerCase() === "delivery"
        ? "DELIVERY"
        : ["pickup", "collection"].includes(
              String(
                data.delivery_type ||
                  structuredData.order_type ||
                  structuredData.orderType,
              ).toLowerCase(),
            )
          ? "PICKUP"
          : "UNKNOWN",
    deliveryAddress:
      text(
        data.delivery_address ||
          structuredData.delivery_address ||
          structuredData.deliveryAddress,
      ).slice(0, 1000) || null,
    pickupTime: null,
  };
}

// The call lock and unique callId make webhook retries/concurrent deliveries idempotent.
// Save the order and its print jobs together, including jobs for offline printers.
export async function saveUnconfirmedOrder({
  prisma,
  call,
  candidate,
  generateReceiptText,
}) {
  try {
    return await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM calls WHERE id = ${call.id}::uuid FOR UPDATE`;
      if (await tx.order.findUnique({ where: { callId: call.id } }))
        return null;
      const order = await tx.order.create({
        data: { ...candidate, businessId: call.businessId, callId: call.id },
      });
      const [printers, settings] = await Promise.all([
        tx.printer.findMany({ where: { businessId: call.businessId } }),
        tx.businessSetting.findUnique({
          where: { businessId: call.businessId },
        }),
      ]);
      const receipt = generateReceiptText({ ...order, call }, settings, {});
      for (const printer of printers)
        await tx.printJob.create({
          data: {
            printerId: printer.id,
            orderId: order.id,
            status: "pending",
            rawReceiptText: receipt,
            retryCount: 0,
          },
        });
      return order;
    });
  } catch (error) {
    if (error.code === "P2002") return null;
    throw error;
  }
}
