export function monthPeriod(month, today = new Date().toISOString().slice(0,10)) {
  const [year, number] = month.split('-').map(Number);
  const end = new Date(Date.UTC(year, number, 0)).toISOString().slice(0,10);
  return {start: month+'-01', end: end > today ? today : end};
}
export function calendarMonths(year, today = new Date().toISOString().slice(0,10)) {
  return Array.from({length:12},(_,i)=>`${year}-${String(i+1).padStart(2,'0')}`).filter(month=>month<=today.slice(0,7));
}
export function csvText(rows) {
  const cell = value => {
    let text = typeof value==='object' && value!==null ? JSON.stringify(value) : String(value??'');
    if (/^\s*[=+@-]/.test(text)) text="'"+text;
    return '"'+text.replaceAll('"','""')+'"';
  };
  return '\uFEFF'+rows.map(row=>row.map(cell).join(',')).join('\r\n');
}
export function saveFile(content, name, type) {
  const url=URL.createObjectURL(new Blob([content],{type}));
  const a=document.createElement('a');a.href=url;a.download=name;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function exportRows(reports, live) {
  const rows=[['Month / period','Dataset','Record','Field','Value']];
  const add=(period, dataset, record, value)=>{
    for(const [key,item] of Object.entries(value||{})) rows.push([period,dataset,record,key,item]);
  };
  for(const report of reports){
    const period=report.period.start+' to '+report.period.end;
    add(period,'Summary','All tenants',report.summary);
    add(period,'Coverage','Availability',report.coverage);
    add(period,'Notes','Definitions',Object.fromEntries((report.notes||[]).map((n,i)=>[i+1,n])));
    for(const tenant of report.tenants||[])add(period,'Tenants',tenant.id,tenant);
    for(const call of report.calls||[])add(period,'Calls',call.source+':'+call.id,call);
    for(const call of report.failedCalls||[])add(period,'Failed calls',call.source+':'+call.id,call);
    for(const [provider,value]of Object.entries(report.providers||{}))add(period,'Providers',provider,value);
    add(period,'Distributions','Current',report.distributions);
  }
  if(live)add('Live snapshot','Live usage',live.generatedAt||'Current',live);
  return rows;
}
