import {useState} from 'react';
import {Link} from 'react-router-dom';
import {ArrowLeft,ArrowUpRight,RefreshCw,Phone,Clock3,Printer,Radio,Activity,Coins,Mail,CalendarDays,Bot} from 'lucide-react';
import {useOperationsReport} from './useOperationsReport';
import {useLiveUsage} from './useLiveUsage';
import {CallTable} from './OperationsView';
import './operations.css';

const num = value => typeof value === 'number' ? new Intl.NumberFormat('en-GB',{maximumFractionDigits:1}).format(value) : '—';
const amounts = values => Object.entries(values || {}).map(([currency,value]) => value === null ? 'Not available' : new Intl.NumberFormat('en-GB',{style:'currency',currency,maximumFractionDigits:3}).format(value)).join(' · ') || 'Not available';
const date = value => value ? new Date(value).toLocaleString('en-GB',{timeZone:'UTC',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : 'Not recorded';
function Metric({label,value,note,icon:Icon}) {
  return <article className="ca-stat"><div className="ca-stat-label">{label}<Icon size={17}/></div><strong>{value}</strong><small>{note}</small></article>;
}

export default function TenantOverview({tenant,agents}) {
  const today = new Date().toISOString().slice(0,10);
  const [period,setPeriod] = useState({start:today.slice(0,7)+'-01',end:today});
  const [tab,setTab] = useState('usage');
  const report = useOperationsReport(period);
  const live = useLiveUsage();
  const liveTenant = live.data?.tenants.find(row => row.id === tenant.id);
  const reportedDetails = report.data?.tenants.find(row => row.id === tenant.id);
  const details = reportedDetails ? {...reportedDetails, printers:live.fresh&&liveTenant?.printers?liveTenant.printers:reportedDetails.printers.map(printer=>({...printer,status:'unknown'}))} : null;
  const failures = (report.data?.failedCalls || []).filter(row => row.tenantId === tenant.id);
  const calls = (report.data?.calls || []).filter(row => row.tenantId === tenant.id);
  const used = tenant.usage?.used ?? 0, remaining = tenant.usage?.remaining ?? 0, allowance = tenant.usage?.total ?? 0;
  const percentage = allowance > 0 ? Math.min(100,used / allowance * 100) : 0;
  const activeAgents = agents.filter(agent => !agent.status || agent.status.toLowerCase() === 'active').length;
  return <section className="calai-admin ca-report-extension ca-tenant-overview" aria-label="Tenant overview">
    <Link to="/admin/tenant-management" className="ca-back"><ArrowLeft size={15}/>Tenant Management</Link>
    <div className="ca-tenant-hero">
      <div className="ca-tenant-profile">
        {tenant.image || tenant.profile_picture ? <img className="ca-profile-avatar" src={tenant.image || tenant.profile_picture} alt={tenant.name}/> : <span className="ca-profile-avatar">{(tenant.name || 'T').slice(0,2).toUpperCase()}</span>}
        <div className="ca-profile-copy"><div className="ca-eyebrow">TENANT PROFILE</div><h1>{tenant.name || 'Unknown tenant'}</h1><span className={'ca-status '+(tenant.status?.toLowerCase()==='active'?'good':'neutral')}><i/>{tenant.status || 'Unknown'}</span></div>
      </div>
      <div className="ca-profile-meta"><span><Mail size={15}/>{tenant.email || 'No email recorded'}</span><span><Phone size={15}/>{tenant.phone || 'No phone recorded'}</span><span><CalendarDays size={15}/>Joined {tenant.joined_date ? new Date(tenant.joined_date).toLocaleDateString('en-GB') : 'Not recorded'}</span><span><Bot size={15}/>{activeAgents} active agents · {agents.length} total</span></div>
    </div>

    <div className="ca-tenant-top-grid">
      <article className="ca-panel"><div className="ca-panel-heading"><div><h2>Usage overview</h2><p>Existing subscription allowance and recorded usage</p></div><Clock3 size={19}/></div><div className="ca-allowance"><div><strong>{num(used)}<small> min used</small></strong><span>{allowance > 0 ? num(allowance)+' min allowance' : 'No minute allowance assigned'}</span></div><div className="ca-track" role="progressbar" aria-label="Subscription minutes used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage}><i style={{width:percentage+'%'}}/></div><div><span>{num(remaining)} min remaining</span><span>{allowance > 0 ? num(percentage)+'% used' : 'Awaiting a plan'}</span></div></div></article>
      <article className="ca-panel"><div className="ca-panel-heading"><div><h2>Printer connection</h2><p>Latest connection status for this tenant</p></div><Printer size={19}/></div>{details?.printers.length ? details.printers.map(printer => <div className="ca-provider-row" key={printer.id}><Printer size={20}/><div><strong>{printer.name}</strong><small>Last seen {date(printer.lastSeen)} UTC</small></div><span className={'ca-status '+(printer.status==='online'?'good':'bad')}><i/>{printer.status}</span></div>) : <p className="ca-panel-note">{report.isLoading ? 'Checking printer records…' : details ? 'No printer is registered to this tenant yet.' : 'Printer status is not available.'}</p>}<p className="ca-panel-note">{details ? details.printJobs.pending+' pending jobs · '+details.printJobs.failed+' failed jobs. ' : ''}Online requires a heartbeat within 60 seconds.</p></article>
    </div>

    <div className="ca-page-heading ca-tenant-report-heading"><div><h2>Call usage & provider costs</h2><p>Choose a reporting period to review this tenant’s activity.</p></div><button className="ca-button" disabled={report.isFetching} onClick={()=>report.refetch()}><RefreshCw size={15} className={report.isFetching?'ca-spin':''}/>Refresh</button></div>
    <div className="ca-filterbar"><div className="ca-period"><CalendarDays size={15}/><input aria-label="Tenant report start date" type="date" value={period.start} max={period.end} onChange={event=>event.target.value&&setPeriod({...period,start:event.target.value})}/><span>—</span><input aria-label="Tenant report end date" type="date" value={period.end} min={period.start} max={today} onChange={event=>event.target.value&&setPeriod({...period,end:event.target.value})}/><span>UTC</span></div><span className="ca-updated">{report.data ? 'Updated '+date(report.data.generatedAt)+' UTC' : 'Loading reports'}</span></div>
    {report.error && <p className="ca-error" role="alert">{report.error.message} {report.data ? 'The last successful report remains visible.' : ''}</p>}
    {report.data && (!report.data.coverage.localComplete || ['vapi','twilio'].some(provider=>report.data.providers[provider].status!=='connected')) && <p className="ca-notice">Some reports are unavailable or incomplete. Figures cover the records received.</p>}
    <div className="ca-stats"><Metric label="Recorded calls" value={num(details?.callCount)} note={num(details?.minutes)+' minutes in this period'} icon={Phone}/><Metric label="Vapi call costs" value={amounts(details?.costs.vapi)} note={(details?.pendingCosts ?? 0)+' cost records pending'} icon={Coins}/><Metric label="Twilio call charges" value={amounts(details?.costs.twilio)} note={details?.twilio ? details.twilio.legs+' matched telephony legs' : 'No matching priced call legs'} icon={Coins}/><Metric label="Concurrent calls" value={live.reliable?num(liveTenant?.activeCalls):'—'} note={(live.reliable?num(liveTenant?.agentsInUse):'—')+' agents in use · live'} icon={Radio}/><Metric label="Failed calls" value={num(details?.failures)} note={num(details?.failedTwilioLegs)+' additional failed Twilio legs'} icon={Activity}/><Metric label="Call transfers" value={num(details?.transfers)} note={details?.latencyMs == null ? 'Audio latency not available' : details.latencyMs+' ms average first audio'} icon={ArrowUpRight}/></div>
    {details && !details.agents.length && <p className="ca-notice">No Vapi assistant is assigned to this tenant. Account activity stays unallocated until an exact assistant or recorded call establishes its ownership.</p>}
    <div className="ca-tabs" role="tablist" aria-label="Tenant reporting"><button role="tab" aria-selected={tab==='usage'} className={tab==='usage'?'selected':''} onClick={()=>setTab('usage')}>Costs & usage</button><button role="tab" aria-selected={tab==='calls'} className={tab==='calls'?'selected':''} onClick={()=>setTab('calls')}>Provider call log</button><button role="tab" aria-selected={tab==='failures'} className={tab==='failures'?'selected':''} onClick={()=>setTab('failures')}>Failed calls{failures.length>0&&<span>{failures.length}</span>}</button></div>
    {tab==='usage' && <div className="ca-tenant-top-grid">{['vapi','twilio'].map(provider=><article className="ca-panel" key={provider}><div className="ca-panel-heading"><div><h2>{provider==='vapi'?'Vapi':'Twilio'} cost detail</h2><p>{provider==='vapi'?'Assistant call costs · USD':'Matched call leg costs · provider currency'}</p></div><span className="ca-status">{report.data?.providers[provider].status?.replaceAll('_',' ') || 'Loading'}</span></div><div className="ca-cost-line"><span>{provider==='twilio'?'Per priced call leg':'Per priced call'}</span><strong>{amounts(details?.costPerCall[provider])}</strong></div><div className="ca-cost-line"><span>Per measured minute</span><strong>{amounts(details?.costPerMinute[provider])}</strong></div>{provider==='vapi'&&Object.entries(details?.components || {}).map(([name,value])=><div className="ca-cost-line" key={name}><span>{{stt:'Transcription',tts:'Voice generation',llm:'Language model',vapi:'Vapi platform',transport:'Transport',chat:'Chat',knowledgeBaseCost:'Knowledge base',voicemailDetectionCost:'Voicemail detection'}[name] || name}</span><strong>{amounts({USD:value})}</strong></div>)}<p className="ca-panel-note">{provider==='vapi'?'Unit costs use priced records; per-minute figures also require measured duration. Reported components may be incomplete.':'Tenant call charges are part of the Twilio account total. Number rental and other shared charges are not allocated without an explicit link.'}</p></article>)}</div>}
    {tab!=='usage' && <section className="ca-panel"><div className="ca-panel-heading"><div><h2>{tab==='failures'?'Failed calls':'Provider call log'}</h2><p>{tab==='failures'?'Failures, reasons and additional failed telephony legs':'Existing call summaries and transcripts remain in the Calls tab below'}</p></div></div><CallTable calls={tab==='failures'?failures:calls}/></section>}
    <p className="ca-coverage-note">Vapi and Twilio charges remain separate; Calai Vapi costs are excluded. Concurrent calls and agents in use refresh every 5 seconds, independently of these dates. {details?.currentAgentAttributions>0 ? details.currentAgentAttributions+' calls use the currently assigned assistant ID; historical ownership is not recorded for those calls.' : ''}</p>
  </section>;
}
