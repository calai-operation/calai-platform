import prisma from "../../../prisma/client.js";
import { PrinterService } from "../../businessowner/printer/printer.service.js";
import { notifyNewOrder } from "../../../utils/socket.js";
import { parseOrderTypeAndAddress } from "./order-validator.js";

/**
 * Common helper to sync and persist an order to database,
 * queue print jobs, broadcast socket alerts, and send confirmation emails.
 */
export async function syncOrderRecord({
  businessId,
  call,
  orderData,
  fallbackCustomer = {},
  sendOrderConfirmationEmail,
}) {
  const orderItems =
    orderData.final_items || orderData.order_items || orderData.items || [];
  const generalNote =
    orderData.notes ||
    orderData.order_notes ||
    orderData.specialInstructions ||
    orderData.special_instructions;
  if (
    generalNote &&
    Array.isArray(orderItems) &&
    orderItems.length > 0 &&
    typeof orderItems[0] === "object" &&
    orderItems[0] !== null &&
    !orderItems[0].order_notes
  ) {
    orderItems[0].order_notes = String(generalNote).trim();
  }
  const totalPrice = Number(
    orderData.total_price || orderData.totalPrice || orderData.total || 0,
  );
  const customerName =
    orderData.customer_name ||
    orderData.customerName ||
    fallbackCustomer.name ||
    "N/A";
  const customerEmail =
    orderData.customer_email ||
    orderData.customerEmail ||
    orderData.email ||
    fallbackCustomer.email ||
    "N/A";

  const {
    orderType,
    deliveryAddress: parsedAddress,
    pickupTime,
  } = parseOrderTypeAndAddress(orderData, call?.startTime);

  const deliveryAddress = parsedAddress || fallbackCustomer.address || null;

  const existingOrder = await prisma.order.findUnique({
    where: { callId: call.id },
  });

  const orderRecord = await prisma.order.upsert({
    where: { callId: call.id },
    update: {
      customerName,
      customerEmail,
      totalPrice,
      items: orderItems,
      orderType,
      deliveryAddress,
      pickupTime,
    },
    create: {
      businessId,
      callId: call.id,
      customerName,
      customerEmail,
      totalPrice,
      items: orderItems,
      orderType,
      deliveryAddress,
      pickupTime,
    },
  });

  if (!existingOrder) {
    await PrinterService.autoQueueOrderPrint(businessId, orderRecord.id);
    await notifyNewOrder(orderRecord.id);
    if (typeof sendOrderConfirmationEmail === "function") {
      sendOrderConfirmationEmail(businessId, orderRecord);
    }
  }

  return { orderRecord, isNew: !existingOrder };
}

/**
 * Safety Net: Clean up prematurely created order and associated print jobs
 * if the call ended in abandonment or cancellation.
 */
export async function cleanupCancelledOrder(callId) {
  const existingOrder = await prisma.order.findUnique({
    where: { callId },
  });

  if (existingOrder) {
    console.log(
      `🧹 [End-of-Call] Cleaning up cancelled/abandoned order (ID: ${existingOrder.id}) for call ${callId}`,
    );
    await prisma.printJob.deleteMany({
      where: { orderId: existingOrder.id, status: "pending" },
    });
    await prisma.orderItem.deleteMany({
      where: { orderId: existingOrder.id },
    });
    await prisma.order.delete({
      where: { id: existingOrder.id },
    });
  }
}
