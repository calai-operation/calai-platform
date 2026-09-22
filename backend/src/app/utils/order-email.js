const escape = value => String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const price = value => value!==null && value!==undefined && value!=='' && Number.isFinite(Number(value)) ? '£'+Number(value).toFixed(2) : 'Not confirmed';

export function buildOrderEmail({businessName,order,callbackNumber}) {
  const pending=order.confirmationStatus==='unconfirmed',status=pending?'Unconfirmed Order':'Order Confirmed',accent=pending?'#e88722':'#008fe8';
  const reference=String(order.id||'').slice(0,8),business=businessName||'Your business';
  let items=order.items||[];
  if(typeof items==='string'){try{items=JSON.parse(items);}catch{items=[];}}
  if(!Array.isArray(items))items=items?.order_details||[];
  if(!Array.isArray(items))items=[];
  const rows=items.map(item=>{
    const name=item.product_name||item.item_name||item.name||'Item',qty=Number(item.quantity)||1;
    const unit=item.unit_prize??item.unit_price??item.price;
    const total=item.total_price??(unit!==null&&unit!==undefined&&unit!==''&&Number.isFinite(Number(unit))?qty*Number(unit):null);
    return {name,qty,total,notes:item.notes};
  });
  const type=order.orderType==='DELIVERY'?'Delivery':order.orderType==='PICKUP'?'Collection':'Not specified';
  const date=order.createdAt?new Date(order.createdAt).toLocaleString('en-GB',{timeZone:'Europe/London',dateStyle:'medium',timeStyle:'short'}):'Not recorded';
  const details=[['Order reference',reference? '#'+reference:'Not recorded'],['Business',business],['Received',date],['Order type',type],['Customer',order.customerName||'Not provided'],['Contact number',callbackNumber||'Not provided']];
  if(order.orderType==='DELIVERY')details.push(['Delivery address',order.deliveryAddress||'Not provided']);
  if(order.pickupTime)details.push(['Collection time',order.pickupTime]);
  const reason=order.unconfirmedReason||'The call ended before the order was confirmed.';
  const intro=pending?'An order was captured but the customer did not complete confirmation. Please review the details and contact the customer before preparing it.':'A customer has confirmed a new order through Calai. The details are below.';
  const notes=order.notes||order.specialInstructions||order.special_instructions;
  const text=['Calai',status,business,intro,'',...details.map(([key,value])=>`${key}: ${value}`),'','ORDER ITEMS',...rows.map(r=>`${r.qty} × ${r.name} — ${price(r.total)}${r.notes?'\nNote: '+r.notes:''}`),...(notes?['','Order notes: '+notes]:[]),'','Total: '+price(order.totalPrice),...(pending?['','Reason not confirmed: '+reason]:[]),'','View orders: https://calai.info/owner/order-list','Need help? Contact hello@calai.info','Calai · Business order notifications'].join('\n');
  const html=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f2f5f9;font-family:Arial,Helvetica,sans-serif;color:#192333"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:#fff;border:1px solid #dce3ec;border-radius:14px;overflow:hidden"><tr><td style="background:#090d15;padding:22px 28px"><img src="https://calai.info/logo.png" width="130" alt="Calai" style="display:block;width:130px;height:auto;border:0"><div style="color:#a6b4c8;font-size:11px;letter-spacing:1.5px;margin-top:8px">BUSINESS ORDER NOTIFICATION</div></td></tr><tr><td style="padding:28px;border-top:4px solid ${accent}"><div style="color:${accent};font-weight:bold;font-size:12px;text-transform:uppercase">${escape(business)}</div><h1 style="font-size:26px;margin:10px 0 12px;color:#152033">${status}</h1><p style="font-size:14px;line-height:1.7;color:#546276;margin:0 0 24px">${intro}</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f8fb;border-radius:8px">${details.map(([key,value])=>`<tr><td style="padding:9px 14px;font-size:12px;color:#64748b;vertical-align:top;width:35%">${key}</td><td style="padding:9px 14px;font-size:13px;color:#192333;overflow-wrap:anywhere">${escape(value)}</td></tr>`).join('')}</table><h2 style="font-size:16px;margin:26px 0 10px">Order items</h2><table width="100%" cellspacing="0" cellpadding="0"><thead><tr><th align="left" style="font-size:11px;color:#64748b;padding:10px 0;border-bottom:1px solid #dde4ed">ITEM</th><th align="right" style="font-size:11px;color:#64748b;padding:10px 0;border-bottom:1px solid #dde4ed">AMOUNT</th></tr></thead><tbody>${rows.map(r=>`<tr><td style="padding:14px 8px 14px 0;font-size:14px;border-bottom:1px solid #edf0f5">${r.qty} × ${escape(r.name)}${r.notes?`<div style="font-size:12px;color:#64748b;margin-top:5px">Note: ${escape(r.notes)}</div>`:''}</td><td align="right" style="padding:14px 0;font-size:14px;white-space:nowrap;border-bottom:1px solid #edf0f5">${price(r.total)}</td></tr>`).join('')}</tbody></table>${notes?`<p style="font-size:13px;line-height:1.6"><strong>Order notes:</strong> ${escape(notes)}</p>`:''}<table role="presentation" width="100%"><tr><td style="padding:20px 0;font-size:15px;font-weight:bold">Total</td><td align="right" style="font-size:23px;font-weight:bold">${price(order.totalPrice)}</td></tr></table>${pending?`<div style="background:#fff5e9;border-left:4px solid ${accent};padding:16px;margin:8px 0 24px"><strong style="font-size:13px;color:#8b470c">Reason not confirmed</strong><p style="margin:8px 0 0;font-size:14px;line-height:1.6;color:#704a29">${escape(reason)}</p></div>`:''}<a href="https://calai.info/owner/order-list" style="display:inline-block;background:${accent};color:#fff;text-decoration:none;font-size:14px;font-weight:bold;padding:14px 22px;border-radius:7px">View orders in Calai</a></td></tr><tr><td style="padding:22px 28px;background:#f6f8fb;border-top:1px solid #e4e9f1;font-size:12px;color:#64748b;line-height:1.8">Need help? <a href="mailto:hello@calai.info" style="color:#007ecc;text-decoration:none">hello@calai.info</a><br>Calai · Business order notifications</td></tr></table></td></tr></table></body></html>`;
  return {subject:`Calai | ${status}${reference?' #'+reference:''}`,text,html};
}

export function createOrderEmailSender({prisma,sendEmail,logger=console}) {
  return async (businessId,order) => {
    try {
      const business=await prisma.business.findUnique({where:{id:businessId},select:{name:true,owner:{select:{email:true}}}});
      if(!business?.owner?.email)return;
      const call=await prisma.call.findUnique({where:{id:order.callId},select:{customerNumber:true}});
      await sendEmail({to:business.owner.email,...buildOrderEmail({businessName:business.name,order,callbackNumber:call?.customerNumber})});
    }catch(error){logger.error('Order notification email could not be sent:',error.message);}
  };
}
