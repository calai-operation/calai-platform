import prisma from "../../../prisma/client.js";

/**
 * Helper to promote and merge a recent temporary direct call into a real Vapi Call ID.
 * This prevents duplicate entries when custom tools create temporary IDs.
 */
export const promoteDirectCallIfExist = async (
  businessId,
  realVapiCallId,
  customerNumber,
  assistantId,
) => {
  if (
    !realVapiCallId ||
    realVapiCallId === "N/A" ||
    realVapiCallId.startsWith("direct-")
  ) {
    return null;
  }

  // Check if a Call with the real vapiCallId already exists
  let callRecord = await prisma.call.findUnique({
    where: { vapiCallId: realVapiCallId },
  });

  if (!callRecord) {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const directCall = await prisma.call.findFirst({
      where: {
        businessId: businessId,
        vapiCallId: {
          startsWith: "direct-",
        },
        OR: [
          { customerNumber: customerNumber },
          { customerNumber: "Unknown" },
          { customerNumber: "N/A" },
        ],
        ...(assistantId ? { vapiAgentId: assistantId } : {}),
        startTime: {
          gte: fifteenMinutesAgo,
        },
      },
      orderBy: {
        startTime: "desc",
      },
    });

    if (directCall) {
      console.log(
        `🚀 Promoting temporary direct call ${directCall.vapiCallId} (ID: ${directCall.id}) to real Vapi Call ID: ${realVapiCallId}`,
      );
      callRecord = await prisma.call.update({
        where: { id: directCall.id },
        data: {
          vapiCallId: realVapiCallId,
          ...(customerNumber &&
          customerNumber !== "Unknown" &&
          customerNumber !== "N/A"
            ? { customerNumber: customerNumber }
            : {}),
        },
      });
    }
  }

  return callRecord;
};

/**
 * Robust date parsing and duration calculation for calls
 */
export const parseCallTiming = (vapiCall) => {
  const startTimeRaw = vapiCall?.startedAt || vapiCall?.createdAt || new Date();
  const endTimeRaw = vapiCall?.endedAt || vapiCall?.createdAt || new Date();
  const startTime = isNaN(new Date(startTimeRaw).getTime())
    ? new Date()
    : new Date(startTimeRaw);
  const endTime = isNaN(new Date(endTimeRaw).getTime())
    ? new Date()
    : new Date(endTimeRaw);

  let durationInSeconds = 0;
  if (vapiCall?.duration !== undefined)
    durationInSeconds = Number(vapiCall.duration);
  else if (vapiCall?.durationSeconds !== undefined)
    durationInSeconds = Number(vapiCall.durationSeconds);
  else if (vapiCall?.endedAt && vapiCall?.startedAt)
    durationInSeconds = Math.max(
      0,
      (endTime.getTime() - startTime.getTime()) / 1000,
    );

  const status = vapiCall?.status === "ended" ? "completed" : "failed";

  return { startTime, endTime, durationInSeconds, status };
};
