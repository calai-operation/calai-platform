import test from 'node:test';
import assert from 'node:assert/strict';
import {unconfirmedCandidate,saveUnconfirmedOrder} from '../src/app/modules/webhook/unconfirmed-order.js';
const id='70202223-f39f-4275-90c8-d0e6c4c21f62';
const cloneId='f06cd3ce-646c-4c0f-a058-d20b6d8e9f85';
const data=()=>({order_status:'abandoned',calai_unconfirmed_order:{outcome:'unconfirmed',explicit_cancellation:false,reason:'Caller disconnected before confirming the summary.',items:[{product_name:'Rice',quantity:2,unit_prize:'',notes:'No salt'}],total_price:-1,delivery_type:'unknown'}});
test('pilot assistants and the Testing Curry clone recover incomplete orders; every ending reason with captured items is retained',()=>{
 assert.equal(unconfirmedCandidate('other',data()),null);
 assert.equal(unconfirmedCandidate(cloneId,data()).confirmationStatus,'unconfirmed');
 for(const outcome of ['cancelled','no_order']){const d=data();d.calai_unconfirmed_order.outcome=outcome;assert.equal(unconfirmedCandidate(id,d).confirmationStatus,'unconfirmed');}
 const confirmed=data();confirmed.calai_unconfirmed_order.outcome='confirmed';assert.equal(unconfirmedCandidate(id,confirmed),null);
 const d=data();d.calai_unconfirmed_order.explicit_cancellation=true;
 assert.equal(unconfirmedCandidate(id,d).confirmationStatus,'unconfirmed');
 d.order_status='cancelled';assert.equal(unconfirmedCandidate(id,d).confirmationStatus,'unconfirmed');
 assert.equal(unconfirmedCandidate(id,{}),null);
});
test('unknown amounts and fulfilment stay unknown, notes and specific reason survive',()=>{
 const order=unconfirmedCandidate(id,data());assert.equal(order.totalPrice,null);assert.equal(order.items[0].unit_prize,null);assert.equal(order.orderType,'UNKNOWN');assert.equal(order.items[0].notes,'No salt');assert.match(order.unconfirmedReason,/disconnected/);assert.equal(order.confirmationStatus,'unconfirmed');
 const d=data();d.calai_unconfirmed_order.items=[];assert.equal(unconfirmedCandidate(id,d),null);
 d.calai_unconfirmed_order.items=[{product_name:'Rice',quantity:-1}];assert.equal(unconfirmedCandidate(id,d),null);
});
test('legacy analysis recovers captured items when the nested Vapi result is missing',()=>{
 const order=unconfirmedCandidate(id,{order_status:'abandoned',order_items:JSON.stringify([{product_name:'Naan',quantity:'2',unit_price:'3.5',notes:'No butter'}]),customer_name:'Sam',order_type:'pickup',total_price:'7',reason:'Caller disconnected'});
 assert.equal(order.customerName,'Sam');assert.equal(order.items[0].product_name,'Naan');assert.equal(order.items[0].quantity,2);assert.equal(order.items[0].unit_prize,3.5);assert.equal(order.totalPrice,7);assert.equal(order.orderType,'PICKUP');assert.match(order.unconfirmedReason,/disconnected/);
 for(const flag of [{customer_confirmed:true},{save_order_was_called:'yes'}])assert.equal(unconfirmedCandidate(id,{...flag,order_items:[{product_name:'Naan',quantity:1}]}),null);
});
test('the Vapi ending reason supplies a clear fallback reason',()=>{
 const d=data();d.calai_unconfirmed_order.reason='';
 assert.match(unconfirmedCandidate(id,d,{endedReason:'customer-ended-call'}).unconfirmedReason,/customer disconnected/i);
});
test('a replay never creates another order or print job, and printers are scoped to the same tenant',async()=>{
 let saved=null,jobs=[];const call={id:'call',businessId:'tenant',customerNumber:'test'};
 const tx={ $queryRaw:async()=>[],order:{findUnique:async()=>saved,create:async({data})=>saved={id:'order',...data}},printer:{findMany:async({where})=>{assert.equal(where.businessId,'tenant');return [{id:'offline-printer'}];}},businessSetting:{findUnique:async()=>({})},printJob:{create:async({data})=>{jobs.push(data);return data;}}};
 const prisma={$transaction:async fn=>fn(tx)};const args={prisma,call,candidate:unconfirmedCandidate(id,data()),generateReceiptText:order=>{assert.equal(order.confirmationStatus,'unconfirmed');return 'UNCONFIRMED ORDER';}};
 assert.ok(await saveUnconfirmedOrder(args));assert.equal(await saveUnconfirmedOrder(args),null);assert.equal(jobs.length,1);assert.equal(jobs[0].status,'pending');assert.equal(jobs[0].rawReceiptText,'UNCONFIRMED ORDER');
});
