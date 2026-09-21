import prisma from "../../../prisma/client.js";
import { VapiLib } from "../../../lib/vapi.js";
import {
  unconfirmedCandidate,
  saveUnconfirmedOrder,
} from "../unconfirmed-order.js";
import { generateReceiptText } from "../../businessowner/printer/printer.service.js";
import { notifyNewOrder } from "../../../utils/socket.js";

/**
 * Schedule automatic delayed self-healing (4s delay) to ensure final Vapi summary,
 * transcript, unconfirmed pilot orders, & duration are properly saved in DB.
 */
export function scheduleAutoSelfHeal({
  vapiCallId,
  assistantId,
  messageType,
  sendOrderConfirmationEmail,
}) {
  if (!vapiCallId || vapiCallId.startsWith("direct-")) {
    return;
  }

  setTimeout(async () => {
    try {
      const vapiCallData = await VapiLib.fetchCallById(vapiCallId);
      if (vapiCallData) {
        const fetchedSummary =
          vapiCallData.analysis?.summary ||
          vapiCallData.summary ||
          "No summary available";
        const fetchedTranscript =
          vapiCallData.analysis?.transcript ||
          vapiCallData.transcript ||
          "No transcript available";

        let fetchedDuration = 0;
        if (vapiCallData.duration !== undefined)
          fetchedDuration = Number(vapiCallData.duration);
        else if (vapiCallData.durationSeconds !== undefined)
          fetchedDuration = Number(vapiCallData.durationSeconds);
        else if (vapiCallData.endedAt && vapiCallData.startedAt)
          fetchedDuration = Math.max(
            0,
            (new Date(vapiCallData.endedAt).getTime() -
              new Date(vapiCallData.startedAt).getTime()) /
              1000,
          );

        const updatedDuration = Math.floor(fetchedDuration);

        const targetCall = await prisma.call.findUnique({
          where: { vapiCallId: vapiCallId },
        });

        if (targetCall) {
          const recovered = unconfirmedCandidate(
            assistantId,
            vapiCallData.analysis?.structuredData,
            vapiCallData,
            { allowAll: true },
          );
          if (recovered && messageType === "end-of-call-report") {
            const created = await saveUnconfirmedOrder({
              prisma,
              call: targetCall,
              candidate: recovered,
              generateReceiptText,
            });
            if (created) {
              if (typeof sendOrderConfirmationEmail === "function") {
                sendOrderConfirmationEmail(created.businessId, created);
              }
              await notifyNewOrder(created.id);
            }
          }
          if (updatedDuration > 0) {
            await prisma.call.update({
              where: { id: targetCall.id },
              data: {
                duration: updatedDuration,
                status:
                  vapiCallData.status === "ended"
                    ? "completed"
                    : targetCall.status,
              },
            });
          }

          if (
            fetchedSummary !== "No summary available" ||
            fetchedTranscript !== "No transcript available"
          ) {
            await prisma.callSummary.upsert({
              where: { callId: targetCall.id },
              update: {
                summary: fetchedSummary,
                transcript: fetchedTranscript,
              },
              create: {
                callId: targetCall.id,
                summary: fetchedSummary,
                transcript: fetchedTranscript,
              },
            });
          }
        }
      }
    } catch (err) {
      console.error(
        `[AutoSelfHeal] Vapi sync failed for ${vapiCallId}:`,
        err.message,
      );
    }
  }, 4000);
}
