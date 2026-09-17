import {useEffect,useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import Cookies from 'js-cookie';

export function useLiveUsage() {
  const [now,setNow]=useState(Date.now);
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
  const query=useQuery({queryKey:['admin-live-usage'],refetchInterval:5000,staleTime:0,retry:1,queryFn:async({signal})=>{
    const base=import.meta.env.VITE_API_BASE_URL||'https://api.calai.info/api';
    const response=await fetch(base+'/system-owner/dashboard/operations/live',{signal,headers:{Authorization:'Bearer '+Cookies.get('Access-Token')}});
    const body=await response.json();if(!response.ok)throw Error(body.message||'Live usage is unavailable.');return body.data;
  }});
  const fresh=!!query.data&&now-Date.parse(query.data.generatedAt)<=20000&&!query.error;
  return {...query,now,fresh,reliable:fresh&&query.data.complete};
}
