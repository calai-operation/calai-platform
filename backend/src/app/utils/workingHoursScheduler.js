import cron from "node-cron";
import axios from "axios";
import prisma from "../prisma/client.js";
import { envVars } from "../config/env.js";
import { isBusinessCurrentlyOpen } from "./business-hours.js";

// In-memory cache to prevent unnecessary duplicate API calls
// Key: assistant_id, Value: boolean (true/false)
const agentStatusCache = new Map();

/**
 * Parses time string (24h or 12h AM/PM format) into minutes from midnight (0 - 1439).
 * Returns null if parsing fails.
 */
/**
 * Evaluates and updates the AI agent status for a single business agent.
 */
export const evaluateAndUpdateAgentStatus = async (agent, force = false) => {
  const assistantId = agent.vapiAgentId || agent.id;
  if (!assistantId) return;

  const businessSettings = agent.business?.businessSettings;
  const desiredEnable = isBusinessCurrentlyOpen(businessSettings);

  const businessName = agent.business?.name || "the restaurant";
  const openingTime = businessSettings?.openingTime;
  const closingTime = businessSettings?.closingTime;
  let hoursInfo = "";
  if (openingTime && closingTime) {
    hoursInfo = ` Our regular business hours are from ${openingTime} to ${closingTime}.`;
  }

  console.log(
    `⏰ [WorkingHoursScheduler] Toggling AI Agent status for ${agent.name || assistantId} (Business: ${agent.businessId}) -> Enable: ${desiredEnable}`,
  );

  const managerNumber =
    agent.managerNumber &&
    agent.managerNumber !== "TBD" &&
    agent.managerNumber !== ""
      ? agent.managerNumber
      : null;

  // 1. Directly update Vapi Assistant configuration (firstMessage, prompt override, transferCall)
  if (agent.vapiAgentId && envVars.VAPI_API_KEY) {
    try {
      const vapiHeaders = {
        Authorization: `Bearer ${envVars.VAPI_API_KEY}`,
        "Content-Type": "application/json",
      };

      // Fetch current assistant to read existing model and prompt
      let existingAsst = null;
      try {
        const asstRes = await axios.get(
          `https://api.vapi.ai/assistant/${agent.vapiAgentId}`,
          { headers: vapiHeaders, timeout: 10000 },
        );
        existingAsst = asstRes.data;
      } catch (getErr) {
        console.warn(
          `⚠️ [WorkingHoursScheduler] Could not fetch Vapi assistant details for ${agent.vapiAgentId}:`,
          getErr.message,
        );
      }

      const CLOSED_TAG = "### [RESTAURANT CURRENTLY CLOSED]";
      const END_TAG = "\n\n---END CLOSED NOTICE---\n\n";

      const expectedFirstMessage = desiredEnable
        ? `Hi, you're through to ${businessName} and I'm their virtual assistant. Would you like to place an order?`
        : "";

      const promptHasClosedTag = Boolean(
        existingAsst?.model?.messages?.[0]?.content?.includes(CLOSED_TAG),
      );
      const isAlreadyInSync =
        existingAsst?.firstMessage === expectedFirstMessage &&
        (desiredEnable ? !promptHasClosedTag : promptHasClosedTag);

      if (!force && isAlreadyInSync) {
        // Vapi assistant on server already matches desired status and hours
      } else {
        const vapiPatchPayload = {};

        if (desiredEnable) {
          // RESTAURANT IS OPEN: Restore normal ordering greeting and remove closed prompt override
          vapiPatchPayload.firstMessage = expectedFirstMessage;

          if (existingAsst?.model?.messages?.[0]?.content) {
            const currentContent = existingAsst.model.messages[0].content;
            const tagIdx = currentContent.indexOf(CLOSED_TAG);
            if (tagIdx !== -1) {
              const endIdx = currentContent.indexOf(END_TAG);
              const restoredContent =
                endIdx !== -1
                  ? currentContent.substring(endIdx + END_TAG.length)
                  : currentContent.replace(CLOSED_TAG, "");

              vapiPatchPayload.model = {
                ...existingAsst.model,
                messages: [
                  {
                    role: "system",
                    content: restoredContent,
                  },
                  ...existingAsst.model.messages.slice(1),
                ],
              };
            }
          }
        } else {
          // RESTAURANT IS CLOSED: Do NOT speak. Silently transfer the call immediately to managerNumber.
          vapiPatchPayload.firstMessage = "";

          if (existingAsst?.model?.messages?.[0]?.content) {
            const currentContent = existingAsst.model.messages[0].content;
            let baseContent = currentContent;
            const tagIdx = currentContent.indexOf(CLOSED_TAG);
            if (tagIdx !== -1) {
              const endIdx = currentContent.indexOf(END_TAG);
              if (endIdx !== -1) {
                baseContent = currentContent.substring(endIdx + END_TAG.length);
              }
            }

            const transferDestinationText = managerNumber
              ? `to the restaurant manager at ${managerNumber}`
              : "to the restaurant staff";

            const closedNotice = `${CLOSED_TAG}\nThe restaurant is currently CLOSED for automated AI ordering.\nCRITICAL INSTRUCTION: You must NOT speak, greet the caller, or say any words out loud. Immediately trigger the transferCall tool to transfer this call ${transferDestinationText}. Do NOT ask for orders, mention menu items, or answer any questions under any circumstances.${END_TAG}`;

            vapiPatchPayload.model = {
              ...existingAsst.model,
              messages: [
                {
                  role: "system",
                  content: closedNotice + baseContent,
                },
                ...existingAsst.model.messages.slice(1),
              ],
            };
          }
        }

        await axios.patch(
          `https://api.vapi.ai/assistant/${agent.vapiAgentId}`,
          vapiPatchPayload,
          {
            headers: vapiHeaders,
            timeout: 10000,
          },
        );
        console.log(
          `✅ [WorkingHoursScheduler] Vapi Assistant ${agent.vapiAgentId} updated for Open=${desiredEnable} (Closed Transfer Mode: ${!desiredEnable})`,
        );
      }
    } catch (vapiErr) {
      console.error(
        `⚠️ [WorkingHoursScheduler] Failed to patch Vapi assistant ${agent.vapiAgentId}:`,
        vapiErr.response?.data || vapiErr.message,
      );
    }
  }

  // 2. Notify AI Service if configured
  if (agentStatusCache.get(assistantId) !== desiredEnable) {
    try {
      const aiEndpoint = `${envVars.AI_SERVICE_URL}/api/agent-status`;
      await axios.post(
        aiEndpoint,
        {
          enabled: desiredEnable,
        },
        {
          params: {
            assistant_id: assistantId,
          },
          headers: { "Content-Type": "application/json" },
          timeout: 10000,
        },
      );
    } catch (error) {
      // Non-blocking fallback
    }

    agentStatusCache.set(assistantId, desiredEnable);
  }
};

/**
 * Checks working hours for all active agents across all businesses.
 */
export const checkAllAgentsWorkingHours = async (force = false) => {
  try {
    const agents = await prisma.agent.findMany({
      where: { status: "active" },
      include: {
        business: {
          include: {
            businessSettings: true,
          },
        },
      },
    });

    for (const agent of agents) {
      await evaluateAndUpdateAgentStatus(agent, force);
    }
  } catch (error) {
    console.error(
      "❌ [WorkingHoursScheduler] Error querying active agents:",
      error.message,
    );
  }
};

/**
 * Force sync agent status for a specific business (e.g. after settings update).
 */
export const syncBusinessAgentStatus = async (businessId) => {
  try {
    const agents = await prisma.agent.findMany({
      where: { businessId: businessId, status: "active" },
      include: {
        business: {
          include: {
            businessSettings: true,
          },
        },
      },
    });

    for (const agent of agents) {
      await evaluateAndUpdateAgentStatus(agent, true);
    }
  } catch (error) {
    console.error(
      `❌ [WorkingHoursScheduler] Error syncing business ${businessId}:`,
      error.message,
    );
  }
};

/**
 * Initializes the node-cron working hours scheduler.
 */
export const initWorkingHoursScheduler = () => {
  console.log("⏱️  Initializing Working Hours AI Agent Scheduler...");

  // Run initial check on server startup
  checkAllAgentsWorkingHours(true);

  // Schedule cron job to run every minute
  cron.schedule("* * * * *", () => {
    checkAllAgentsWorkingHours();
  });
};
