import {createDecipheriv, timingSafeEqual, randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';

export const CARD_TRANSFER_MESSAGE = "Your order's been confirmed. I'll transfer you to the restaurant now to complete the card payment.";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isDefiniteTransferRejection = status => [400,401,403,404,405,410,415,422,429].includes(status);
const failed = () => ({success:false,status:'not_initiated',message:'The payment transfer was not initiated. Explain the problem and offer the supported staff-transfer option. Do not save the order again or claim payment is complete.'});
const uncertain = () => ({success:false,status:'unknown',message:'The transfer request was sent, but its outcome could not be verified. It may already be connecting. Do not retry or call another transfer tool. Keep the caller informed without claiming payment is complete.'});

// Read the existing protected secret without depending on removed reporting modules.
export async function readCardTransferSecret(directory) {
  if (!directory) return null;
  try {
    const [key,data] = await Promise.all([
      readFile(path.join(directory,'storage.key')),
      readFile(path.join(directory,'card-transfer.enc')),
    ]);
    const decipher = createDecipheriv('aes-256-gcm',key,data.subarray(0,12));
    decipher.setAuthTag(data.subarray(12,28));
    const value = JSON.parse(Buffer.concat([decipher.update(data.subarray(28)),decipher.final()]).toString('utf8'));
    return typeof value.token === 'string' ? value.token : null;
  } catch {
    return null;
  }
}

async function bounded(operation) {
  let timer;
  try { return await Promise.race([operation,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Transfer state unavailable')),2000);})]); }
  finally { clearTimeout(timer); }
}

export function createTransferAttemptStore(redis) {
  const key = id=>'calai:card-payment-transfer:'+id;
  return {
    async claim(id) {
      if (!redis.isReady) throw Error('Transfer state unavailable');
      const lease = JSON.stringify({...uncertain(),owner:randomUUID()});
      const acquired = await bounded(redis.set(key(id),lease,{NX:true,EX:86400}));
      if (acquired === 'OK') return {acquired:true,lease};
      const value = await bounded(redis.get(key(id)));
      let prior;
      try { prior = JSON.parse(value); } catch { prior = null; }
      return {acquired:false,result:prior?.status === 'initiated' ? {success:true,status:'initiated',message:prior.message} : uncertain()};
    },
    async finish(id,result,lease) {
      if (!redis.isReady) throw Error('Transfer state unavailable');
      // Compare ownership so an old attempt cannot remove another attempt's marker.
      const script = "if redis.call('GET',KEYS[1]) ~= ARGV[1] then return 0 end if ARGV[2] == 'not_initiated' then return redis.call('DEL',KEYS[1]) end return redis.call('SET',KEYS[1],ARGV[3],'EX',86400)";
      await bounded(redis.eval(script,{keys:[key(id)],arguments:[lease,result.status,JSON.stringify(result)]}));
    },
  };
}

export function createCardPaymentTransfer({getCall,getAssistant,getTool,findOrder,transfer,attemptStore}) {
  // Share in-flight promises and retain uncertain results: retrying an accepted
  // request whose response was lost can otherwise transfer the same call twice.
  const attempts = new Map();
  return async function handle(callId) {
    if (!UUID.test(callId || '')) return failed();
    if (attempts.has(callId)) return attempts.get(callId);
    const run = (async () => {
      const signal = AbortSignal.timeout(22000);
      let dispatched = false;
      let claim;
      let result;
      try {
        const call = await getCall(callId,{signal});
        if (call?.id !== callId || call.status !== 'in-progress' || !UUID.test(call.assistantId || '')) return failed();
        const order = await findOrder(callId,call.assistantId);
        if (!order || order.confirmationStatus !== 'confirmed') return failed();
        const assistant = await getAssistant(call.assistantId,{signal});
        if (assistant?.id !== call.assistantId) return failed();
        const tools = [...(assistant.model?.tools || []),...await Promise.all((assistant.model?.toolIds || []).map(id=>getTool(id,{signal})))];
        const destinations = tools.filter(tool=>tool?.type === 'transferCall').flatMap(tool=>tool.destinations || []);
        if (destinations.length !== 1 || destinations[0].type !== 'number' || !/^\+[1-9]\d{6,14}$/.test(destinations[0].number || '')) return failed();
        const url = new URL(call.monitor?.controlUrl);
        if (url.protocol !== 'https:' || !url.hostname.endsWith('.vapi.ai') || url.username || url.password || (url.port && url.port !== '443')) return failed();
        if (signal.aborted) return failed();
        const destination = {...destinations[0]};
        delete destination.message;
        claim = await attemptStore.claim(callId);
        if (!claim.acquired) return claim.result;
        if (signal.aborted) throw Error('Transfer timed out before dispatch');
        dispatched = true;
        await transfer(url.href,{type:'transfer',destination,content:CARD_TRANSFER_MESSAGE},{signal});
        result = {success:true,status:'initiated',message:'Payment transfer initiated. The saved order is confirmed; payment itself is not complete. Do not initiate another transfer.'};
      } catch (error) {
        // Only an explicit HTTP rejection proves the transfer was not accepted.
        result = dispatched && !error?.definitelyNotInitiated ? uncertain() : failed();
      }
      if (claim?.acquired) {
        try { await attemptStore.finish(callId,result,claim.lease); }
        catch { /* Keep the durable unknown marker if final-state storage fails. */ }
      }
      return result;
    })();
    attempts.set(callId,run);
    const result = await run;
    if (result.status === 'not_initiated') attempts.delete(callId);
    if (attempts.size > 1000) attempts.delete(attempts.keys().next().value);
    return result;
  };
}

export function createCardPaymentTransferController({getSecret,handle}) {
  return async function cardPaymentTransferController(req,res) {
    let secret;
    try { secret = await getSecret(); } catch { secret = null; }
    if (!secret) return res.status(503).json(failed());
    const supplied = Buffer.from(req.get('x-calai-transfer-secret') || '');
    const expected = Buffer.from(secret);
    if (supplied.length !== expected.length || !timingSafeEqual(supplied,expected)) return res.status(401).json(failed());
    const message = req.body?.message;
    const calls = Array.isArray(message?.toolCalls) && message.toolCalls.length ? message.toolCalls : message?.toolCallList;
    if (message?.type !== 'tool-calls' || !Array.isArray(calls) || calls.length !== 1 || !calls[0]?.id || calls[0].function?.name !== 'transferForCardPayment') return res.status(400).json(failed());
    let result;
    try {
      const args = typeof calls[0].function.arguments === 'string' ? JSON.parse(calls[0].function.arguments) : calls[0].function.arguments;
      result = args?.payment_method === 'card' ? await handle(message.call?.id) : failed();
    } catch { result = failed(); }
    return res.status(200).json({results:[{toolCallId:calls[0].id,result:JSON.stringify(result)}]});
  };
}
