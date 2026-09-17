import cron from "node-cron";
import axios from "axios";
import prisma from "../prisma/client.js";
import { envVars } from "../config/env.js";
import {isBusinessCurrentlyOpen} from './business-hours.js';

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
const evaluateAndUpdateAgentStatus = async (agent, force = false) => {
  const assistantId = agent.vapiAgentId || agent.id;
  if (!assistantId) return;

  const businessSettings = agent.business?.businessSettings;
  const desiredEnable = isBusinessCurrentlyOpen(businessSettings);

  const cachedStatus = agentStatusCache.get(assistantId);

  // Skip API call if status has not changed and force update is false
  if (!force && cachedStatus === desiredEnable) {
    return;
  }

  console.log(
    `⏰ [WorkingHoursScheduler] Toggling AI Agent status for ${agent.name || assistantId} (Business: ${agent.businessId}) -> Enable: ${desiredEnable}`,
  );

  try {
    const aiEndpoint = `${envVars.AI_SERVICE_URL}/api/agent-status`;
    const response = await axios.post(
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

    agentStatusCache.set(assistantId, desiredEnable);
    console.log(
      `✅ [WorkingHoursScheduler] Agent ${assistantId} status updated successfully (${desiredEnable ? "ON" : "OFF"})`,
    );
  } catch (error) {
    console.error(
      `❌ [WorkingHoursScheduler] Failed to update agent status for ${assistantId}:`,
      JSON.stringify(error.response?.data || error.message, null, 2),
    );
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
