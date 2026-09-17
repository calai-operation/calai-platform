import {Link} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import {Phone,ShoppingBag,Clock3,Radio,RefreshCw,ArrowUpRight,Bot,PoundSterling} from 'lucide-react';
import useAuth from '../../hooks/useAuth';
import {useOwnerLive,ownerGet} from './useOwnerLive';
import OwnerCharts from './OwnerCharts';
import PrinterBanner from './PrinterBanner';

const number=value=>typeof value==='number'&&Number.isFinite(value)?new Intl.NumberFormat('en-GB',{maximumFractionDigits:1}).format(value):value??'—';
const money=value=>typeof value==='number'&&Number.isFinite(value)?new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(value):'—';
const duration=(start,now)=>{if(!start)return '—';const seconds=Math.max(0,Math.floor((now-Date.parse(start))/1000));return Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');};
const trend=stat=>stat?[stat.change,stat.weeklyChange?.replace('this week min','min this week').replace(/([+-]?\d+\.\d+)/g,n=>Number(n).toFixed(1))].filter(Boolean).join(' · '):'';
const minutesLow=value=>typeof value==='number'&&Number.isFinite(value)&&value<=30;
function Stat({title,value,note,icon:Icon,active=false,low=false}){
  return <article className={'co-stat'+(active?' co-stat-live':'')+(low?' co-stat-low':'')}><div><span>{title}</span><Icon size={19}/></div><strong>{value}</strong><small>{note}</small></article>;
}
export default function OwnerDashboard(){
  const {user}=useAuth(),live=useOwnerLive();
  const report=useQuery({queryKey:['ownerDashboardStats',user?.id],gcTime:0,refetchInterval:30000,retry:1,queryFn:({signal})=>ownerGet('stats',signal)});
  const insights=useQuery({queryKey:['owner-dashboard-insights',user?.id],gcTime:0,refetchInterval:30000,retry:1,queryFn:({signal})=>ownerGet('insights',signal)});
  const stats=report.error?null:report.data?.stats,overall=report.error?null:report.data?.overallReport,extra=insights.error?null:insights.data;
  const liveCount=live.reliable?live.data.summary.activeCalls:null,onCall=live.fresh&&live.data.summary.activeCalls>0;
  const remaining=stats?.usageOverview?.remainingMinutes,low=minutesLow(remaining);
  const status=live.isLoading?'Checking calls':!live.fresh?'Live updates unavailable':!live.reliable?'Partial live updates':onCall?'Live call'+(liveCount===1?'':'s'):'No live calls';
  return <div className="co-dashboard">
    <div className="co-heading"><div><div className="co-eyebrow">BUSINESS OVERVIEW</div><h1>Dashboard</h1><p>Your orders, conversations and live activity in one place.</p></div><button className="co-button" onClick={()=>{report.refetch();insights.refetch();live.refetch();}} disabled={report.isFetching||live.isFetching||insights.isFetching}><RefreshCw size={16}/>Refresh</button></div>
    <section className={'co-live co-panel'+(onCall?' is-live':'')} aria-label="Live calls">
      <div className="co-live-overview"><div className={'co-call-display'+(onCall?' is-live':'')} aria-label={status+(liveCount!==null?': '+liveCount:'')}><Radio size={24}/><strong>{liveCount??'—'}</strong><span>LIVE CALLS</span></div>
        <div className="co-live-copy"><div className="co-eyebrow"><i className={onCall?'co-pulse':''}/>{live.fresh?'LIVE ACTIVITY':'CALL MONITOR'}</div><h2 role="status" aria-live="polite">{status}</h2><p>{onCall?'Your agents are speaking with customers now.':live.reliable?'Keep this page open. New calls appear automatically.':'We’ll show current activity as soon as a complete update is available.'}</p><div className="co-live-tags"><span><Bot size={14}/>{live.reliable?live.data.summary.agentsInUse:'—'} {live.data?.summary.agentsInUse===1?'agent':'agents'} in use</span><span>{live.fresh?live.data.summary.ringing:'—'} ringing</span><span>{live.fresh?live.data.summary.queued:'—'} queued</span><span>{live.fresh?live.data.summary.forwarding:'—'} forwarded</span></div></div>
        <Link className="co-button co-button-secondary" to="/owner/call-summary">Call summary<ArrowUpRight size={15}/></Link></div>
      {!live.fresh&&!live.isLoading&&<p className="co-notice">Live updates are unavailable. Any call details below are the last known snapshot, not current activity.</p>}
      {live.fresh&&!live.reliable&&<p className="co-notice">Some live data is unavailable. The calls below may not include every active call.</p>}
      {!!live.data?.calls.length&&<div className="co-table-scroll"><table><thead><tr><th>Agent</th><th>Call status</th><th>Duration</th></tr></thead><tbody>{live.data.calls.map(call=><tr key={call.id}><td>{call.agentName}</td><td><span className="co-call-status">{call.status==='in-progress'?'Live call':call.status}</span>{!live.fresh&&' · last known'}</td><td>{duration(call.startedAt,live.fresh?live.now:Date.parse(live.data.generatedAt))}</td></tr>)}</tbody></table></div>}
      <div className="co-live-footer"><span>Updates every 5 seconds · your business only</span><span>{live.data?'Last update '+new Date(live.data.generatedAt).toLocaleTimeString('en-GB'):'Connecting to live activity…'}</span></div>
    </section>
    {(report.error||insights.error)&&<p className="co-notice" role="alert">Some dashboard totals could not be updated. Please refresh to try again.</p>}
    <PrinterBanner now={live.now}/>
    <div className="co-stats">
      <Stat title="Total orders" value={stats?number(Number(stats.totalOrder.value)):'—'} note={extra?number(extra.orders.today)+' today · '+trend(stats?.totalOrder): 'All recorded orders'} icon={ShoppingBag}/>
      <Stat title="Order value" value={money(extra?.orders.value)} note={extra?extra.orders.unpriced+' orders without a price · recorded value':'Recorded order value · not payment receipts'} icon={PoundSterling}/>
      <Stat title="Total calls" value={number(overall?.totalCall)} note={stats?String(stats.todayTotalCall.value).replace(/^Call\s*/,'')+' today · '+trend(stats.todayTotalCall):'All recorded calls'} icon={Phone}/>
      <Stat title="Live calls" value={liveCount??'—'} note={live.reliable?live.data.summary.agentsInUse+(live.data.summary.agentsInUse===1?' agent':' agents')+' in use · right now':status} icon={Radio} active={onCall}/>
      <Stat title="Total call duration" value={stats?.totalCallDuration.value??'—'} note={trend(stats?.totalCallDuration)||'All recorded call minutes'} icon={Clock3}/>
      <Stat title="Remaining minutes" value={typeof remaining==='number'?number(remaining)+' min':'—'} note={low?(remaining<=0?'No minutes remaining':'Low minutes · 30 min or less'):stats?number(stats.usageOverview.usedMinutes)+' used · '+number(stats.usageOverview.totalLimitMinutes)+' plan minutes':'Waiting for your plan usage'} icon={Clock3} low={low}/>
    </div>
    {low&&<div className="co-low-banner" role="status"><Clock3 size={18}/><div><strong>{remaining<=0?'You have no minutes remaining':'Your minutes are running low'}</strong><span>{number(stats.usageOverview.usedMinutes)} minutes used · {number(stats.usageOverview.totalLimitMinutes)} plan minutes</span></div><Link to="/owner/settings/subscription">View subscription<ArrowUpRight size={15}/></Link></div>}
    <div className="co-section-heading"><div><h2>Performance overview</h2><p>Call trends and the value of your orders.</p></div><Link to="/owner/order-list">View orders<ArrowUpRight size={15}/></Link></div>
    <OwnerCharts insights={extra} overall={overall} loading={insights.isLoading}/>
  </div>;
}
