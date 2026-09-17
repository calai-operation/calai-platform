import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import Cookies from 'js-cookie';
import {ArrowDownToLine, RefreshCw} from 'lucide-react';
import {BarChart,Bar,XAxis,YAxis,Tooltip,ResponsiveContainer,CartesianGrid} from 'recharts';
import {calendarMonths,monthPeriod,csvText,saveFile,exportRows} from './report-export';

const amounts=values=>Object.entries(values||{}).map(([currency,value])=>new Intl.NumberFormat('en-GB',{style:'currency',currency,maximumFractionDigits:2}).format(value)).join(' · ')||'—';
const complete=r=>r.coverage.localComplete&&r.coverage.vapiComplete&&r.coverage.twilioComplete&&(!['connected','partial','unavailable'].includes(r.providers.calaiVapi.status)||r.coverage.voiceComplete);
const cost=r=>{const out={};for(const t of r.tenants)for(const [c,n]of Object.entries(t.costs.vapi||{}))out[c]=(out[c]||0)+n;return out;};

export function DistributionPanels({data}){
  return <div className="ca-distribution-grid">{[['plans','Plan distribution','Active subscriptions · current'],['statuses','Tenant status distribution','All tenants · current']].map(([key,title,note])=>{
    const rows=data?.[key]||[],total=rows.reduce((sum,row)=>sum+row.count,0);
    return <section className="ca-panel" key={key}><div className="ca-panel-heading"><div><h2>{title}</h2><p>{note}</p></div><span className="ca-count">{total}</span></div><div className="ca-distribution-bars">{rows.map(row=><div key={row.name}><div><span>{row.name}</span><strong>{row.count} <small>({total?Math.round(row.count/total*100):0}%)</small></strong></div><div className="ca-track"><i style={{width:(total?row.count/total*100:0)+'%'}}/></div></div>)}{!rows.length&&<p>No records available.</p>}</div></section>;
  })}</div>;
}

export function FullExport({reports,live,label='Export all data',disabled=false}){
  const [format,setFormat]=useState('csv');
  const download=()=>{
    const snapshot={exportedAt:new Date().toISOString(),scope:'All dashboard records for the selected period(s), regardless of on-screen tenant filters. Provider coverage and definitions included.',reports,liveSnapshot:live?.fresh?live.data:null};
    const name='calai-admin-'+reports[0].period.start+'-to-'+reports.at(-1).period.end;
    saveFile(format==='csv'?csvText(exportRows(reports,snapshot.liveSnapshot)):JSON.stringify(snapshot,null,2),name+'.'+format,format==='csv'?'text/csv;charset=utf-8':'application/json');
  };
  return <div className="ca-export-controls"><select aria-label={label+' format'} value={format} onChange={e=>setFormat(e.target.value)}><option value="csv">CSV (Excel)</option><option value="json">JSON (full detail)</option></select><button className="ca-button" disabled={disabled||!reports?.length} onClick={download}><ArrowDownToLine size={15}/>{label}</button></div>;
}

export default function MonthlyReports({live,onPeriod,onView}){
  const today=new Date().toISOString().slice(0,10),[year,setYear]=useState(today.slice(0,4)),[progress,setProgress]=useState(0);
  const query=useQuery({queryKey:['admin-monthly-reports',year],staleTime:300000,retry:false,queryFn:async({signal})=>{
    const reports=[];setProgress(0);
    for(const month of calendarMonths(year,today)){
      const response=await fetch((import.meta.env.VITE_API_BASE_URL||'https://api.calai.info/api')+'/system-owner/dashboard/operations?'+new URLSearchParams(monthPeriod(month,today)),{signal,headers:{Authorization:'Bearer '+Cookies.get('Access-Token')}});
      const body=await response.json();if(!response.ok)throw Error(body.message||'Monthly reports could not be loaded.');
      reports.push(body.data);setProgress(reports.length);
    }
    return reports;
  }});
  const reports=query.data||[],rows=reports.map(r=>({month:r.period.start.slice(0,7),label:new Date(r.period.start).toLocaleDateString('en-GB',{month:'short',timeZone:'UTC'}),calls:r.summary.calls,failures:r.summary.failures,report:r}));
  return <section className="ca-panel ca-monthly-panel"><div className="ca-panel-heading"><div><h2>Month by month</h2><p>Calendar months in UTC · current month to date · blue: calls, orange: failures. Select a month to explore its tenants.</p></div><div className="ca-month-actions"><label>Year <select aria-label="Reporting year" value={year} onChange={e=>setYear(e.target.value)}>{Array.from({length:Number(today.slice(0,4))-1999},(_,i)=>String(Number(today.slice(0,4))-i)).map(y=><option key={y} value={y}>{y}</option>)}</select></label><button className="ca-icon-button" aria-label="Refresh monthly reports" disabled={query.isFetching} onClick={()=>query.refetch()}><RefreshCw size={16}/></button></div></div>
  {query.isFetching&&<p className="ca-panel-note" role="status">Loading monthly reports… {progress} months received.</p>}
  {query.error&&<div className="ca-error" role="alert">{query.error.message} <button className="ca-button" onClick={()=>query.refetch()}>Retry</button></div>}
  {!!reports.length&&<><div className="ca-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={rows}><CartesianGrid vertical={false} stroke="#303033"/><XAxis dataKey="label" stroke="#96959b"/><YAxis allowDecimals={false} stroke="#96959b"/><Tooltip contentStyle={{background:'#191919',border:'1px solid #303033',color:'#fff'}}/><Bar dataKey="calls" name="Calls" fill="#00a6f8" radius={[4,4,0,0]}/><Bar dataKey="failures" name="Failures" fill="#ec8a81" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div><div className="ca-table-scroll"><table className="ca-table"><thead><tr><th>Month</th><th>New tenants</th><th>Subscription starts</th><th>Paid invoice revenue</th><th>Calls</th><th>Minutes</th><th>Failures</th><th>Peak concurrent</th><th>Vapi costs</th><th>Twilio account usage</th><th>Coverage</th></tr></thead><tbody>{rows.map(({month,label,report:r})=><tr key={month}><td><button className="ca-tenant-link" onClick={()=>{onPeriod({start:r.period.start,end:r.period.end});onView('tenants');}}>{label} {year}</button></td><td>{r.summary.newTenants??'—'}</td><td>{r.summary.subscriptionsStarted??'—'}</td><td>{amounts(r.summary.revenue)}</td><td>{r.summary.calls}</td><td>{Number(r.summary.minutes).toLocaleString('en-GB',{maximumFractionDigits:1})}</td><td>{r.summary.failures}</td><td>{r.summary.peak}</td><td>{amounts(cost(r))}</td><td>{r.providers.twilio.total?amounts({[r.providers.twilio.total.currency]:r.providers.twilio.total.amount}):'—'}</td><td>{complete(r)?'Available sources complete':'Partial / unavailable'}{r.providers.vapi.note&&<small title={r.providers.vapi.note}>Vapi history limited by plan</small>}</td></tr>)}</tbody></table></div></>}
  <div className="ca-month-export"><p>Export includes all tenants, call records, failures, costs, printer details and availability notes for every loaded month. Live usage is a separate current snapshot.</p><FullExport label="Export full year data" reports={reports} live={live} disabled={query.isFetching||!!query.error}/></div>
  </section>;
}
