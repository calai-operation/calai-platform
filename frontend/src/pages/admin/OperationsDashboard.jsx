import {useState} from 'react';
import {Navigate,useSearchParams} from 'react-router-dom';
import {useOperationsReport} from './useOperationsReport';
import OperationsView from './OperationsView';
import {useLiveUsage} from './useLiveUsage';
export default function OperationsDashboard({businessCards,distributionCharts,refreshBusiness}){
 const today=new Date().toISOString().slice(0,10),[period,setPeriod]=useState({start:today.slice(0,7)+'-01',end:today});const [params,setParams]=useSearchParams();
 const report=useOperationsReport(period);
 const live=useLiveUsage();
 if([401,403].includes(report.error?.status))return <Navigate replace to="/auth/login"/>;
 return <OperationsView data={report.data} live={live} businessCards={businessCards} distributionCharts={distributionCharts} loading={report.isLoading} refreshing={report.isFetching} error={report.error?.message} period={period} onPeriod={setPeriod} onRefresh={()=>{report.refetch();live.refetch();refreshBusiness?.();}} view={params.get('view')||'overview'} onView={view=>setParams(view==='overview'?{}:{view})}/>;
}
