import prisma from "../../prisma/client.js";
import { redisClient } from "../../config/redis.config.js";
import {
  createCardPaymentTransfer,
  createCardPaymentTransferController,
  readCardTransferSecret,
  isDefiniteTransferRejection,
  createTransferAttemptStore,
} from "./card-payment-transfer.js";

async function vget(path, { signal }) {
  const token = process.env.VAPI_API_KEY;
  if (!token) throw Error("Vapi connection unavailable");
  const response = await fetch("https://api.vapi.ai" + path, {
    headers: { Authorization: "Bearer " + token },
    redirect: "error",
    signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]),
  });
  if (!response.ok) throw Error("Vapi lookup failed");
  return response.json();
}

const handle = createCardPaymentTransfer({
  attemptStore: createTransferAttemptStore(redisClient),
  getCall: (id, options) => vget("/call/" + encodeURIComponent(id), options),
  getAssistant: (id, options) =>
    vget("/assistant/" + encodeURIComponent(id), options),
  getTool: (id, options) => vget("/tool/" + encodeURIComponent(id), options),
  findOrder: async (callId, assistantId) => {
    const call = await prisma.call.findUnique({
      where: { vapiCallId: callId },
      select: {
        businessId: true,
        vapiAgentId: true,
        orders: { select: { businessId: true, confirmationStatus: true } },
      },
    });
    if (
      !call ||
      call.vapiAgentId !== assistantId ||
      call.orders?.businessId !== call.businessId
    )
      return null;
    return call.orders;
  },
  transfer: async (url, body, { signal }) => {
    const response = await fetch(url, {
      method: "POST",
      redirect: "error",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]),
    });
    if (!response.ok) {
      const error = Error("Payment transfer rejected");
      // Timeouts/conflicts and 5xx can occur after acceptance; preserve uncertainty.
      error.definitelyNotInitiated = isDefiniteTransferRejection(
        response.status,
      );
      throw error;
    }
  },
});

export const cardPaymentTransferController =
  createCardPaymentTransferController({
    getSecret: () =>
      readCardTransferSecret(process.env.ADMIN_REPORTING_SECRET_DIR),
    handle,
  });
