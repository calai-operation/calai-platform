import test from 'node:test';
import assert from 'node:assert/strict';
import {buildOrderEmail,createOrderEmailSender} from '../src/app/utils/order-email.js';
const order={id:'abcdefgh-123',businessId:'tenant',callId:'call',createdAt:'2026-09-09T10:00:00Z',customerName:'A & B <script>',orderType:'DELIVERY',deliveryAddress:'1 Example Road',totalPrice:9,items:[{product_name:'Main <img>',quantity:2,unit_prize:4.5,notes:'Extra & spicy'}]};
test('confirmed emails are branded, escaped, priced and include text fallback and delivery details',()=>{
  const email=buildOrderEmail({businessName:'Example Kitchen',order,callbackNumber:'07700 900000'});
  assert.match(email.subject,/Calai.*Order Confirmed/);assert.match(email.html,/calai-admin-logo.png/);
  assert.match(email.html,/A &amp; B &lt;script&gt;/);assert.ok(!email.html.includes('<script>'));
  assert.match(email.text,/£9.00/);assert.match(email.text,/Extra & spicy/);assert.match(email.text,/1 Example Road/);assert.match(email.html,/hello@calai.info/);
});
test('unconfirmed emails explain the reason without inventing prices or fulfilment',()=>{
  const email=buildOrderEmail({businessName:'Example Kitchen',order:{...order,confirmationStatus:'unconfirmed',unconfirmedReason:'Call disconnected <unexpectedly>',orderType:'UNKNOWN',totalPrice:null,items:[{name:'Side',quantity:1,unit_prize:null}]}});
  assert.match(email.subject,/Unconfirmed Order/);assert.match(email.html,/#e88722/);assert.match(email.text,/Reason not confirmed: Call disconnected/);
  assert.match(email.html,/&lt;unexpectedly&gt;/);assert.match(email.text,/Order type: Not specified/);assert.match(email.text,/Total: Not confirmed/);assert.ok(!email.text.includes('£0.00'));
});
test('order email recipient comes only from the owning business, including unconfirmed orders',async()=>{
  const sent=[];
  const sender=createOrderEmailSender({prisma:{business:{findUnique:async args=>{assert.equal(args.where.id,'tenant');return {name:'Example',owner:{email:'owner@example.test'}};}},call:{findUnique:async()=>({customerNumber:'07700 900000'})}},sendEmail:async payload=>sent.push(payload)});
  await sender('tenant',{...order,confirmationStatus:'unconfirmed',customerEmail:'customer@example.test'});
  assert.equal(sent.length,1);assert.equal(sent[0].to,'owner@example.test');assert.match(sent[0].subject,/Unconfirmed/);assert.ok(sent[0].html&&sent[0].text);
});
test('missing recipient does not send and transport failure is contained',async()=>{
  let errors=0;
  const sender=createOrderEmailSender({prisma:{business:{findUnique:async()=>({owner:null})}},sendEmail:async()=>{throw Error('Must not send');}});
  await sender('tenant',order);
  const failing=createOrderEmailSender({prisma:{business:{findUnique:async()=>({owner:{email:'owner@example.test'}})},call:{findUnique:async()=>null}},sendEmail:async()=>{throw Error('Transport unavailable');},logger:{error:()=>errors++}});
  await failing('tenant',order);assert.equal(errors,1);
});
