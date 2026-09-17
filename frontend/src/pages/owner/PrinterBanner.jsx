import {useQuery} from '@tanstack/react-query';
import {Link} from 'react-router-dom';
import {Printer} from 'lucide-react';
import Cookies from 'js-cookie';
import useAuth from '../../hooks/useAuth';

export default function PrinterBanner({now}) {
  const {user}=useAuth();
  const query=useQuery({queryKey:['owner-printer-health',user?.id],gcTime:0,refetchInterval:5000,retry:1,queryFn:async({signal})=>{
    const response=await fetch((import.meta.env.VITE_API_BASE_URL||'https://api.calai.info/api')+'/business-owner/printer',{signal,headers:{Authorization:'Bearer '+Cookies.get('Access-Token')}});
    if(!response.ok)throw Error('Printer status unavailable');
    const body=await response.json();
    if(!Array.isArray(body.data))throw Error('Invalid printer status');
    return body.data;
  }});
  if(query.isLoading)return null;
  if(query.error||!query.data||now-query.dataUpdatedAt>20000)return <p className="co-notice" role="status">Printer connection status is unavailable. <Link to="/owner/printer">Check printers</Link></p>;
  const disconnected=query.data.filter(printer=>printer.status!=='online'||!printer.lastSeen||!Number.isFinite(Date.parse(printer.lastSeen))||now-Date.parse(printer.lastSeen)>60000||Date.parse(printer.lastSeen)>now);
  if(query.data.length&&!disconnected.length)return null;
  return <div className="co-low-banner" role="status"><Printer size={18}/><div><strong>Printer not connected</strong><span>{query.data.length?disconnected.map(printer=>printer.deviceName||'Printer').join(', '):'No printer has been added yet.'}</span></div><Link to="/owner/printer">Check printer</Link></div>;
}
