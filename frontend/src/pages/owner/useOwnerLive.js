import {useEffect,useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import Cookies from 'js-cookie';
import useAuth from '../../hooks/useAuth';

export async function ownerGet(path,signal){
  const response=await fetch((import.meta.env.VITE_API_BASE_URL||'https://api.calai.info/api')+'/business-owner/dashboard/'+path,
    {signal,headers:{Authorization:'Bearer '+Cookies.get('Access-Token')}});
  if(!response.ok)throw Error('Dashboard updates are unavailable. Please retry.');
  return (await response.json()).data;
}

export function useOwnerLive(){
  const {user}=useAuth(),[now,setNow]=useState(Date.now);
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
  const query=useQuery({queryKey:['owner-live-calls',user?.id],gcTime:0,refetchInterval:5000,retry:1,staleTime:0,
    queryFn:({signal})=>ownerGet('live',signal)});
  const fresh=!!query.data&&!query.error&&now-Date.parse(query.data.generatedAt)<=20000;
  return {...query,now,fresh,reliable:fresh&&query.data.complete};
}
