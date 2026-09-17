import { UNCONFIRMED_ASSISTANTS } from '../modules/webhook/unconfirmed-order.js';
import { WebhookService } from '../modules/webhook/webhook.service.js';
import prisma from '../prisma/client.js';

const processed = new Set();
let running = false;

const recentEnough = call => {
  const createdAt = new Date(call.createdAt || call.startedAt || 0).getTime();
  return Number.isFinite(createdAt) && createdAt >= Date.now() - (4 * 60 * 60 * 1000);
};

export const reconcilePilotCalls = async () => {
  if (running || !process.env.VAPI_API_KEY) return;
  running = true;
  try {
    const response = await fetch('https://api.vapi.ai/call?limit=100', {
      headers: { Authorization: `Bearer ${process.env.VAPI_API_KEY}` },
    });
    if (!response.ok) throw new Error(`Vapi returned ${response.status}`);
    const calls = await response.json();
    const linkedAgents = await prisma.agent.findMany({
      where:{ OR:[{ id:{ in:[...UNCONFIRMED_ASSISTANTS] } }, { vapiAgentId:{ in:[...UNCONFIRMED_ASSISTANTS] } }] },
      select:{ id:true, vapiAgentId:true },
    });
    const linkedAssistantIds = new Set(linkedAgents.map(agent => agent.vapiAgentId || agent.id));
    const candidates = (Array.isArray(calls) ? calls : [])
      .filter(call => call?.id && call.status === 'ended' && linkedAssistantIds.has(call.assistantId) && recentEnough(call) && !processed.has(call.id))
      .sort((a, b) => new Date(a.createdAt || a.startedAt) - new Date(b.createdAt || b.startedAt));

    for (const call of candidates) {
      try {
        const result = await WebhookService.processVapiWebhook({ message: { type: 'end-of-call-report', call } });
        if (result?.success === false) throw new Error(result.message || 'Call reconciliation was rejected');
        processed.add(call.id);
      } catch (error) {
        console.error(`[PilotCallReconciler] Failed for call ${call.id}:`, error.message);
      }
    }
    if (candidates.length) console.log(`[PilotCallReconciler] Checked ${candidates.length} ended pilot call(s).`);
  } catch (error) {
    console.error('[PilotCallReconciler] Vapi sync failed:', error.message);
  } finally {
    running = false;
  }
};

export const initPilotCallReconciler = () => {
  reconcilePilotCalls();
  setInterval(reconcilePilotCalls, 2 * 60 * 1000);
};
