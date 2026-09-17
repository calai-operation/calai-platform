import prisma from "../../prisma/client.js";
import { SubscriptionService } from "../businessowner/subscription/subscription.service.js";
import { sendEmail } from "../../utils/sendEmail.js";
import { createOrderEmailSender } from "../../utils/order-email.js";
import { notifyNewOrder } from "../../utils/socket.js";
import {
  UNCONFIRMED_ASSISTANTS,
  unconfirmedCandidate,
  saveUnconfirmedOrder,
} from "./unconfirmed-order.js";
import { generateReceiptText } from "../businessowner/printer/printer.service.js";

import { validateOrderConfirmation } from "./helpers/order-validator.js";
import { syncOrderRecord, cleanupCancelledOrder } from "./helpers/order-sync.js";
import {
  promoteDirectCallIfExist,
  parseCallTiming,
} from "./helpers/call-handler.js";
import { scheduleAutoSelfHeal } from "./helpers/self-heal.js";

// Re-export helper modules for full backward compatibility
export * from "./helpers/order-validator.js";
export * from "./helpers/order-sync.js";
export * from "./helpers/call-handler.js";
export * from "./helpers/self-heal.js";

const sendOrderConfirmationEmail = createOrderEmailSender({
  prisma,
  sendEmail,
});

/**
 * Process Vapi Webhook
 * @param {Object} payload - The webhook payload from Vapi
 */
const processVapiWebhook = async (payload) => {
  const { message } = payload;

  // Intercept assistant-request to check plan limits
  if (message?.type === "assistant-request") {
    const assistantId =
      message.assistantId ||
      payload.assistantId ||
      payload.vapiAgentId ||
      payload.agentId ||
      payload.assistant?.id;

    if (!assistantId) {
      console.error(
        "❌ Webhook Error: No assistantId found in assistant-request payload",
      );
      return { success: false, message: "No assistantId provided" };
    }

    const agent = await prisma.agent.findFirst({
      where: {
        OR: [{ vapiAgentId: assistantId }, { id: assistantId }],
      },
      include: { business: true },
    });

    if (!agent) {
      console.error(`❌ Webhook Error: Agent not found for ID: ${assistantId}`);
      return { success: false, message: "Agent not found" };
    }

    const limits = await SubscriptionService.checkPlanLimits(agent.businessId);

    if (limits.isExceeded) {
      console.log(
        `🚫 Call Blocked: Business ${agent.businessId} has exceeded plan limits. Reason: ${limits.reason}`,
      );
      return {
        isAssistantRequestResponse: true,
        assistant: {
          name: "Limit Exceeded",
          firstMessage:
            "Hello. This business has run out of calling minutes. Please upgrade your subscription to resume calls. Goodbye.",
          model: {
            provider: "openai",
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content:
                  "You are an automated message receptionist. You must politely inform the caller: 'This business has run out of calling minutes. Please upgrade your subscription to resume calls. Goodbye.' and then immediately hang up.",
              },
            ],
          },
        },
      };
    }

    // Otherwise, return the configured assistant ID
    return {
      isAssistantRequestResponse: true,
      assistantId: agent.vapiAgentId || agent.id,
    };
  }

  // 1. Check if this is a "Direct Order" payload (no message/call nesting)
  // This can happen from Vapi Tool Calls or manual API requests
  if (
    !message &&
    (payload.order_items || payload.items || payload.final_items)
  ) {
    const validation = validateOrderConfirmation(payload, "direct_order");
    if (!validation.isValid) {
      console.log(
        `ℹ️ [Direct-Order] Order creation rejected: ${validation.reason}`,
      );
      return {
        success: false,
        message: `Order rejected: ${validation.reason}`,
      };
    }

    const assistantId =
      payload.assistantId ||
      payload.vapiAgentId ||
      payload.assistant_id ||
      payload.assistant?.id ||
      payload.call?.assistantId ||
      payload.call?.assistant_id ||
      payload.agentId;

    let agent = null;
    if (assistantId) {
      agent = await prisma.agent.findFirst({
        where: {
          OR: [{ vapiAgentId: assistantId }, { id: assistantId }],
        },
        include: { business: true },
      });
    }

    if (!agent) {
      console.error(
        `❌ Webhook Error: No agent found in database for assistantId: ${assistantId}`,
      );
      return {
        success: false,
        message: `No agent found in database for assistantId: ${assistantId}`,
      };
    }

    let vapiCallId =
      payload.callId ||
      payload.vapiCallId ||
      payload.call?.id ||
      payload.call?.vapiCallId;

    if (!vapiCallId) {
      const customerPhone =
        payload.customer_phone ||
        payload.phone ||
        payload.call?.customer?.number;
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      let recentCall = null;

      if (customerPhone) {
        recentCall = await prisma.call.findFirst({
          where: {
            businessId: agent.businessId,
            customerNumber: customerPhone,
            startTime: {
              gte: tenMinutesAgo,
            },
            orders: null, // Only pair if the call does not already have an order
          },
          orderBy: { startTime: "desc" },
        });
      }

      // Do NOT pair with random recent call of a different customer if phone number doesn't match,
      // as that leads to order hijacking/overwriting.
      if (recentCall && recentCall.vapiCallId) {
        vapiCallId = recentCall.vapiCallId;
        console.log(
          `🔗 Paired direct order with active call ID: ${vapiCallId}`,
        );
      } else {
        vapiCallId = `direct-${Date.now()}`;
        console.log(
          `⚠️ No active call found for pairing. Created temporary ID: ${vapiCallId}`,
        );
      }
    }

    // Upsert Call to avoid duplicates if status-update or other webhook processed it first
    const call = await prisma.call.upsert({
      where: { vapiCallId: vapiCallId },
      update: {
        customerNumber:
          payload.customer_phone ||
          payload.phone ||
          payload.call?.customer?.number ||
          undefined,
        vapiAgentId: assistantId || undefined,
      },
      create: {
        vapiCallId: vapiCallId,
        businessId: agent.businessId,
        userId: agent.business.ownerId,
        duration: 0,
        startTime: new Date(),
        endTime: new Date(),
        customerNumber:
          payload.customer_phone ||
          payload.phone ||
          payload.call?.customer?.number ||
          "N/A",
        type: "ai_call",
        status: "completed",
        vapiAgentId: assistantId || null,
      },
    });

    await syncOrderRecord({
      businessId: agent.businessId,
      call,
      orderData: payload,
      fallbackCustomer: payload.call?.customer || {},
      sendOrderConfirmationEmail,
    });

    return { success: true, callId: call.id };
  }

  // 2. Handle Tool Calls during the call (e.g. order placement)
  if (message?.type === "tool-calls") {
    const vapiCall = message.call || payload.call;
    const vapiCallId = vapiCall?.id || "N/A";

    const assistantId =
      vapiCall?.assistantId ||
      vapiCall?.assistant_id ||
      message.assistantId ||
      payload.agentId ||
      payload.vapiAgentId;

    let agent = null;
    if (assistantId) {
      agent = await prisma.agent.findFirst({
        where: {
          OR: [{ vapiAgentId: assistantId }, { id: assistantId }],
        },
        include: { business: true },
      });
    }

    if (!agent) {
      console.error(
        `❌ Webhook Error: No agent found for Vapi Assistant ID: ${assistantId}`,
      );
      return { success: false, message: "Unknown assistant" };
    }

    const businessId = agent.businessId;
    const userId = agent.business.ownerId;

    let toolCalls = message.toolCalls || [];
    if (message.toolCallId && message.tool) {
      toolCalls.push({
        id: message.toolCallId,
        function: {
          name: message.tool.name,
          arguments: message.tool.arguments,
        },
      });
    }

    const results = [];

    // Make sure we have a Call record first so the foreign key references exist
    let call;
    if (vapiCallId !== "N/A") {
      const customerNumber = vapiCall?.customer?.number || "Unknown";

      // Try to promote an existing direct call if it exists
      await promoteDirectCallIfExist(
        businessId,
        vapiCallId,
        customerNumber,
        assistantId,
      );

      const startTimeRaw =
        vapiCall?.startedAt || vapiCall?.createdAt || Date.now();
      const startTime = isNaN(new Date(startTimeRaw).getTime())
        ? new Date()
        : new Date(startTimeRaw);

      call = await prisma.call.upsert({
        where: { vapiCallId: vapiCallId },
        update: {
          customerNumber: customerNumber,
          vapiAgentId: assistantId || undefined,
        },
        create: {
          vapiCallId: vapiCallId,
          businessId: businessId,
          userId: userId,
          duration: 0,
          startTime: startTime,
          endTime: startTime,
          customerNumber: customerNumber,
          type: "ai_call",
          status: "completed",
          vapiAgentId: assistantId || null,
        },
      });
    } else {
      call = await prisma.call.findFirst({
        where: { businessId: businessId },
        orderBy: { startTime: "desc" },
      });
    }

    for (const toolCall of toolCalls) {
      const funcName = toolCall.function?.name || "";
      const args = toolCall.function?.arguments || {};

      console.log(
        `🔧 Received Tool Call: ${funcName} with args:`,
        JSON.stringify(args),
      );

      if (funcName.toLowerCase().includes("order")) {
        const validation = validateOrderConfirmation(args, "tool_call");

        if (!validation.isValid) {
          console.warn(
            `⚠️ Tool Call [${funcName}] Order Confirmation Gate Rejected: ${validation.reason}`,
          );
          results.push({
            toolCallId: toolCall.id,
            result: {
              success: false,
              error: "ORDER_NOT_CONFIRMED",
              message: validation.reason,
              instruction:
                "Do not call save_order until you have read the full order summary aloud and received clear, explicit confirmation from the customer.",
            },
          });
          continue;
        }

        if (call) {
          await syncOrderRecord({
            businessId,
            call,
            orderData: args,
            fallbackCustomer: vapiCall?.customer || {},
            sendOrderConfirmationEmail,
          });
          console.log(
            `✅ Order synced successfully in tool call! Total: £${args.total_price || args.totalPrice || args.total || 0}`,
          );
        }

        results.push({
          toolCallId: toolCall.id,
          result: {
            success: true,
            message: "Order successfully placed and recorded in database",
          },
        });
      } else {
        results.push({
          toolCallId: toolCall.id,
          result: { success: true, message: "Tool executed successfully" },
        });
      }
    }

    return {
      isToolCallResponse: true,
      results: results,
    };
  }

  // 3. Handle Standard Vapi Webhooks (end-of-call-report, etc.)
  if (
    message?.type !== "end-of-call-report" &&
    message?.type !== "status-update"
  ) {
    return { success: true, message: "Ignored message type" };
  }

  const vapiCall = message.call || payload.call;
  if (!vapiCall) {
    return { success: false, message: "No call data found" };
  }

  const vapiCallId = vapiCall.id;
  const assistantId =
    vapiCall.assistantId ||
    vapiCall.assistant_id ||
    message.assistantId ||
    payload.agentId ||
    payload.vapiAgentId;

  // Find the business linked to this assistant
  let agent = null;
  if (assistantId) {
    agent = await prisma.agent.findFirst({
      where: {
        OR: [{ vapiAgentId: assistantId }, { id: assistantId }],
      },
      include: { business: true },
    });
  }

  if (!agent) {
    console.error(
      `❌ Webhook Error: No agent found for Vapi Assistant ID: ${assistantId}`,
    );
    return { success: false, message: "Unknown assistant" };
  }

  const businessId = agent.businessId;
  const userId = agent.business.ownerId;
  const customerNumber = vapiCall.customer?.number || "Unknown";

  // Try to promote an existing direct call if it exists
  await promoteDirectCallIfExist(
    businessId,
    vapiCallId,
    customerNumber,
    assistantId,
  );

  // 1. Sync Call with robust date parsing to prevent DB insert crashes
  const { startTime, endTime, durationInSeconds, status } =
    parseCallTiming(vapiCall);

  const call = await prisma.call.upsert({
    where: { vapiCallId: vapiCallId },
    update: {
      duration: Math.floor(durationInSeconds),
      endTime: endTime,
      status: status,
      customerNumber: vapiCall.customer?.number || "Unknown",
      vapiAgentId: assistantId || undefined,
    },
    create: {
      vapiCallId: vapiCallId,
      businessId: businessId,
      userId: userId,
      duration: Math.floor(durationInSeconds),
      startTime: startTime,
      endTime: endTime,
      customerNumber: vapiCall.customer?.number || "Unknown",
      type: "ai_call",
      status: status,
      vapiAgentId: assistantId || null,
    },
  });

  // 2. Sync Summary
  const analysis = vapiCall.analysis || message.analysis;
  if (
    analysis ||
    vapiCall.summary ||
    vapiCall.transcript ||
    message?.transcript
  ) {
    await prisma.callSummary.upsert({
      where: { callId: call.id },
      update: {
        summary:
          analysis?.summary || vapiCall.summary || "No summary available",
        transcript:
          analysis?.transcript ||
          vapiCall.transcript ||
          message?.transcript ||
          "No transcript available",
      },
      create: {
        callId: call.id,
        summary:
          analysis?.summary || vapiCall.summary || "No summary available",
        transcript:
          analysis?.transcript ||
          vapiCall.transcript ||
          message?.transcript ||
          "No transcript available",
      },
    });
  }

  // 3. Sync Order (If structured data exists)
  const structuredData = analysis?.structuredData;
  const pilot = UNCONFIRMED_ASSISTANTS.has(assistantId);
  const existingPilotOrder = pilot
    ? await prisma.order.findUnique({ where: { callId: call.id } })
    : null;
  const candidate =
    message.type === "end-of-call-report"
      ? unconfirmedCandidate(assistantId, structuredData, vapiCall)
      : null;
  if (pilot && candidate && !existingPilotOrder) {
    const created = await saveUnconfirmedOrder({
      prisma,
      call,
      candidate,
      generateReceiptText,
    });
    if (created) {
      sendOrderConfirmationEmail(created.businessId, created);
      await notifyNewOrder(created.id);
    }
  }

  // Preserve saved orders; incomplete analysis must never delete a confirmed pilot order.
  // Non-pilot assistants keep their existing confirmation workflow.
  if (
    structuredData &&
    (!pilot ||
      (message.type === "end-of-call-report" &&
        !existingPilotOrder &&
        !candidate &&
        (!structuredData.calai_unconfirmed_order ||
          structuredData.calai_unconfirmed_order.outcome === "confirmed")))
  ) {
    const validation = validateOrderConfirmation(structuredData, "end_of_call");

    if (!validation.isValid) {
      console.log(
        `ℹ️ [End-of-Call] Order sync skipped for call ${call.id}: ${validation.reason}`,
      );
      // Safety Net: Clean up cancelled/abandoned order
      await cleanupCancelledOrder(call.id);
    } else {
      await syncOrderRecord({
        businessId,
        call,
        orderData: structuredData,
        fallbackCustomer: vapiCall.customer || {},
        sendOrderConfirmationEmail,
      });
      console.log(
        `✅ [End-of-Call] Order confirmed and saved! Total: £${
          structuredData.total_price ||
          structuredData.totalPrice ||
          structuredData.total ||
          0
        }`,
      );
    }
  }

  // Check and update limits (auto-expires subscription if limit exceeded)
  await SubscriptionService.checkPlanLimits(businessId);

  // 4. Schedule automatic delayed self-healing (4s delay) to ensure final Vapi summary & duration are saved in DB
  scheduleAutoSelfHeal({
    vapiCallId,
    assistantId,
    messageType: message.type,
    sendOrderConfirmationEmail,
  });

  return { success: true, callId: call.id };
};

export const WebhookService = {
  processVapiWebhook,
};
