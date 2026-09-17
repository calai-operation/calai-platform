export function londonDate(value = new Date()) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
  const part = type => parts.find(p=>p.type===type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function weekRange(now = new Date(), offset = 0) {
  const today = new Date(londonDate(now)+'T12:00:00Z');
  today.setUTCDate(today.getUTCDate()-((today.getUTCDay()+6)%7)+offset*7);
  const start=today.toISOString().slice(0,10);
  today.setUTCDate(today.getUTCDate()+6);
  return {start,end:today.toISOString().slice(0,10)};
}
export function orderInRange(order, range) {
  if (!range.start && !range.end) return true;
  const legacy = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(order.date||'');
  const date = order.createdAt ? londonDate(order.createdAt) : legacy ? `${legacy[3]}-${legacy[2]}-${legacy[1]}` : null;
  return !!date && (!range.start || date>=range.start) && (!range.end || date<=range.end);
}
