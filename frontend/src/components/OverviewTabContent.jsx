import React from 'react';
import CallActivityChart from './CallActivityChart';
import ConnectedServices from './ConnectedServices';
import AllTenantsList from './AllTenantsList';
import PlanDistribution from './PlanDistribution';
import TenantDistribution from './TenantDistribution';
import MonthByMonth from './MonthByMonth';

const OverviewTabContent = ({ dashboardData, operationsData, setActiveTab }) => {
  return (
    <>
      {/* Main Table */}
      <AllTenantsList tenants={operationsData?.tenants} setActiveTab={setActiveTab} />
      
      {/* Charts and Services Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8 mt-2">
        <div className="lg:col-span-2">
          <CallActivityChart 
            calls={operationsData?.calls} 
            failedCalls={operationsData?.failedCalls} 
            period={operationsData?.period}
          />
        </div>
        <div className="lg:col-span-1">
          <ConnectedServices />
        </div>
      </div>
      
      {/* Distributions Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-8">
        <PlanDistribution data={dashboardData?.planDistribution} />
        <TenantDistribution data={dashboardData?.tenantStatusDistribution} />
      </div>


      {/* Month by Month */}
      <MonthByMonth />
    </>
  );
};

export default OverviewTabContent;
