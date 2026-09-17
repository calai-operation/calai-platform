/**
 * Helper to parse and validate Order Type and Delivery Address.
 */
export const parseOrderTypeAndAddress = (data, callStartTime) => {
  let orderType = "PICKUP";
  let deliveryAddress = null;
  let pickupTime = null;

  if (data) {
    const rawOrderType =
      data.order_type ||
      data.orderType ||
      data.type ||
      data.delivery_type ||
      data.deliveryType;
    if (rawOrderType) {
      const normalizedType = rawOrderType.toString().trim().toUpperCase();
      if (normalizedType === "DELIVERY" || normalizedType === "PICKUP") {
        orderType = normalizedType;
      }
    }

    if (orderType === "DELIVERY") {
      deliveryAddress =
        data.delivery_address ||
        data.deliveryAddress ||
        data.address ||
        data.customer_address ||
        data.customerAddress ||
        null;
    } else if (orderType === "PICKUP") {
      const baseDate = callStartTime ? new Date(callStartTime) : new Date();
      const pickupDate = new Date(baseDate.getTime() + 15 * 60 * 1000);
      pickupTime = pickupDate.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Europe/London",
      });
    }
  }

  return { orderType, deliveryAddress, pickupTime };
};

/**
 * 7-Gate Validation for Order Confirmation
 * Ensures an order is NEVER saved if:
 * 1. order_status is "abandoned", "cancelled", "rejected", "failed", etc.
 * 2. customer_confirmed is explicitly false
 * 3. save_order_was_called is explicitly false
 * 4. order_summary_read is explicitly false
 * 5. confirmation_phrase indicates cancellation/rejection
 * 6. items array is empty
 * 7. total_price is <= 0
 */
export const NEGATIVE_CONFIRMATION_WORDS = [
  "cancel",
  "cancle",
  "forget",
  "nevermind",
  "never mind",
  "dont want",
  "don't want",
  "do not want",
  "stop",
  "abort",
  "wrong",
  "not now",
  "changed my mind",
  "no thanks",
];

export const POSITIVE_CONFIRMATION_WORDS = [
  "yes",
  "yeah",
  "yep",
  "yup",
  "sure",
  "correct",
  "right",
  "confirm",
  "confirmed",
  "perfect",
  "good",
  "great",
  "go ahead",
  "sounds good",
  "all good",
  "that's right",
  "thats right",
  "that is right",
  "that's correct",
  "thats correct",
  "please",
  "ok",
  "okay",
  "fine",
  "proceed",
];

export const validateOrderConfirmation = (data, context = "general") => {
  if (!data || typeof data !== "object") {
    return { isValid: false, reason: "No order data provided." };
  }

  // Gate 1: Check order_status
  const rawStatus = data.order_status || data.orderStatus || data.status;
  if (rawStatus && typeof rawStatus === "string") {
    const normalizedStatus = rawStatus.toLowerCase().trim();
    const cancelledStatuses = [
      "abandoned",
      "cancelled",
      "canceled",
      "rejected",
      "failed",
      "incomplete",
      "not_completed",
      "cancel",
      "cancle",
    ];
    if (cancelledStatuses.includes(normalizedStatus)) {
      return {
        isValid: false,
        reason: `Order status is marked as "${normalizedStatus}" (customer cancelled or abandoned).`,
      };
    }
  }

  // Gate 2: Check customer_confirmed flag
  const customerConfirmed = data.customer_confirmed ?? data.customerConfirmed;
  if (customerConfirmed !== undefined) {
    const isConfirmed =
      customerConfirmed === true ||
      customerConfirmed === "true" ||
      customerConfirmed === 1;
    if (!isConfirmed) {
      return {
        isValid: false,
        reason:
          "Customer has not explicitly confirmed the order (customer_confirmed is false).",
      };
    }
  }

  // Gate 3: Check save_order_was_called flag (used in post-call analysis)
  const saveOrderWasCalled =
    data.save_order_was_called ?? data.saveOrderWasCalled;
  if (saveOrderWasCalled !== undefined) {
    const wasCalled =
      saveOrderWasCalled === true ||
      saveOrderWasCalled === "true" ||
      saveOrderWasCalled === 1;
    if (!wasCalled) {
      return {
        isValid: false,
        reason:
          "The save_order tool was not called during the call (save_order_was_called is false).",
      };
    }
  }

  // Gate 4: Check order_summary_read flag (if passed by LLM in tool calls)
  const orderSummaryRead = data.order_summary_read ?? data.orderSummaryRead;
  if (orderSummaryRead !== undefined) {
    const wasRead =
      orderSummaryRead === true ||
      orderSummaryRead === "true" ||
      orderSummaryRead === 1;
    if (!wasRead) {
      return {
        isValid: false,
        reason:
          "Order summary was not read aloud to the customer before calling save_order.",
      };
    }
  }

  // Gate 5: Check confirmation_phrase (soft allowlist / negative filter)
  const confirmationPhrase =
    data.confirmation_phrase || data.confirmationPhrase;
  if (typeof confirmationPhrase === "string") {
    const phrase = confirmationPhrase.toLowerCase().trim();
    if (context === "tool_call" && phrase.length === 0) {
      return {
        isValid: false,
        reason:
          "Confirmation phrase is empty. Explicit customer confirmation statement is required.",
      };
    }

    if (phrase.length > 0) {
      const hasNegative = NEGATIVE_CONFIRMATION_WORDS.some((word) =>
        phrase.includes(word),
      );
      const hasPositive = POSITIVE_CONFIRMATION_WORDS.some((word) =>
        phrase.includes(word),
      );

      // If phrase has negative words and no positive affirmation (e.g. "no cancel it", "forget it")
      if (hasNegative && !hasPositive) {
        return {
          isValid: false,
          reason: `Confirmation phrase "${confirmationPhrase}" indicates order cancellation or refusal.`,
        };
      }
    }
  }

  // Gate 6: Check order items list
  let itemsList = data.final_items || data.order_items || data.items || [];
  if (typeof itemsList === "string") {
    try {
      itemsList = JSON.parse(itemsList);
    } catch {
      itemsList = [];
    }
  }
  if (!Array.isArray(itemsList) || itemsList.length === 0) {
    return {
      isValid: false,
      reason: "Order contains no items.",
    };
  }

  // Gate 7: Check total price
  const totalPrice = Number(
    data.total_price || data.totalPrice || data.total || 0,
  );
  if (isNaN(totalPrice) || totalPrice <= 0) {
    return {
      isValid: false,
      reason: `Order total price must be greater than 0 (received £${totalPrice}).`,
    };
  }

  return { isValid: true };
};
