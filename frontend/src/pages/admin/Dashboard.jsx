import React from "react";
import { Icon } from "@iconify/react";
import PlanDistribution from "../../components/PlanDistribution";
import TenantDistribution from "../../components/TenantDistribution";
import LiveAgentUsage from "../../components/LiveAgentUsage";
import LowBalanceTenants from "../../components/LowBalanceTenants";
import PeriodPerformance from "../../components/PeriodPerformance";
import { useSystemDashboard } from "../../hooks/useSystemDashboard";

import StatCard from "../../components/StatCard";
import DashboardTabs from "../../components/DashboardTabs";
import OverviewTabContent from "../../components/OverviewTabContent";
import CallLogTabContent from "../../components/CallLogTabContent";
import FailedCallsTabContent from "../../components/FailedCallsTabContent";
import PrinterHealthTabContent from "../../components/PrinterHealthTabContent";
import ProviderCostsTabContent from "../../components/ProviderCostsTabContent";

const Dashboard = () => {
  const [selectedMonth, setSelectedMonth] = React.useState("2026-09");
  const [startDate, setStartDate] = React.useState("2026-09-01");
  const [endDate, setEndDate] = React.useState("2026-09-17");
  const [activeTab, setActiveTab] = React.useState("overview");

  // Calculate maximum allowed dates (today) in UTC
  const currentUtcDate = new Date();
  const maxMonth = `${currentUtcDate.getUTCFullYear()}-${String(currentUtcDate.getUTCMonth() + 1).padStart(2, '0')}`;
  const maxDate = currentUtcDate.toISOString().split('T')[0];

  const handleMonthChange = (e) => {
    const newMonth = e.target.value; // "YYYY-MM"
    setSelectedMonth(newMonth);

    if (newMonth) {
      const [year, month] = newMonth.split("-");
      const firstDay = `${year}-${month}-01`;
      
      // Get the last day of the selected month
      // month is 1-indexed (e.g. 09), new Date(year, month, 0) gives the last day of that month
      const lastDayDate = new Date(Date.UTC(year, parseInt(month), 0));
      let lastDayStr = lastDayDate.toISOString().split('T')[0];

      // If they select the current month, only show up to today
      if (newMonth === maxMonth) {
        lastDayStr = maxDate;
      }

      setStartDate(firstDay);
      setEndDate(lastDayStr);
    }
  };

  const { dashboardData, operationsData, liveData, isFetchingLive, refetchLive, isLoadingDashboard, isFetchingOperations, isLoading, lastUpdated } = useSystemDashboard(startDate, endDate);

  const formatUpdateTime = (timestamp) => {
    if (!timestamp) return "Updating...";
    const date = new Date(timestamp);
    const day = date.toLocaleString('en-GB', { day: 'numeric', timeZone: 'Europe/London' });
    const month = date.toLocaleString('en-GB', { month: 'short', timeZone: 'Europe/London' });
    const time = date.toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
    return `Updated ${day} ${month}, ${time}`;
  };

  const stats = dashboardData?.stats;
  const summary = operationsData?.summary;
  
  // Calculate provider costs
  const twilioCostGBP = operationsData?.providers?.twilio?.total?.amount || 0;
  const paidRevenueGBP = operationsData?.summary?.revenue?.GBP || 0;
  
  let vapiCostUSD = 0;
  if (operationsData?.tenants) {
    operationsData.tenants.forEach(t => {
      if (t.costs?.vapi?.USD) {
        vapiCostUSD += t.costs.vapi.USD;
      }
    });
  }

  const statsData = [
    {
      title: "Total tenants",
      value: stats?.totalTenants?.value ?? "1",
      icon: "lucide:users",
      subtext: "All registered tenants · current",
    },
    {
      title: "Active subscriptions",
      value: stats?.activeSubscriptions?.value ?? "0",
      icon: "lucide:layers",
      subtext: "Current active subscriptions",
    },
    {
      title: "Expiring subscriptions",
      value: stats?.expiringTenants?.value ?? "0",
      icon: "lucide:clock",
      subtext: "Due within the next 30 days · current",
    },
    {
      title: "Paid invoice revenue",
      value: `≈ £${paidRevenueGBP.toFixed(2)}`,
      icon: "lucide:link-2",
      subtext: "Selected period · GBP estimate at latest reference rates",
    },
    {
      title: "Vapi reported cost",
      value: `US$${vapiCostUSD.toFixed(3)}`,
      icon: "lucide:link-2",
      subtext: "Selected period · USD",
    },
    {
      title: "Twilio account usage",
      value: `£${twilioCostGBP.toFixed(2)}`,
      icon: "lucide:link-2",
      subtext: "Selected period · includes call charges",
    },
  ];

  if (isLoadingDashboard) {
    return (
      <div className="flex justify-center items-center h-64 text-gray-400">
        Loading dashboard data...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header Section */}
      <div>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-white mb-2">Dashboard</h1>
            <p className="text-gray-400 text-[15px]">
              All tenants, subscriptions, provider costs and live agent usage.
            </p>
          </div>
          <button 
            onClick={() => refetchLive()}
            className="bg-[#2563eb] hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors whitespace-nowrap"
          >
            <Icon icon="lucide:refresh-cw" className={`w-4 h-4 ${isFetchingLive ? 'animate-spin' : ''}`} />
            Refresh data
          </button>
        </div>

        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-8 text-sm">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3 text-gray-400">
              <span className="text-[14px]">Reporting month</span>
              <div className="relative bg-[#161616] border border-[#262626] rounded-md flex items-center hover:bg-[#262626] transition-colors overflow-hidden">
                <input
                  type="month"
                  value={selectedMonth}
                  max={maxMonth}
                  onChange={handleMonthChange}
                  className="bg-transparent text-white px-3 py-1.5 text-sm focus:outline-none w-full cursor-pointer [color-scheme:dark]"
                />
              </div>
            </div>
            
            <div className="hidden lg:block w-8"></div>

            <div className="bg-[#161616] border border-[#262626] text-white px-3 py-1.5 rounded-md flex items-center gap-3">
              <Icon icon="lucide:clock" className="w-4 h-4 text-gray-500 shrink-0" />
              <input
                type="date"
                value={startDate}
                max={maxDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent text-[13px] font-medium focus:outline-none text-white cursor-pointer [color-scheme:dark]"
              />
              <span className="text-gray-600">—</span>
              <input
                type="date"
                value={endDate}
                max={maxDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent text-[13px] font-medium focus:outline-none text-white cursor-pointer [color-scheme:dark]"
              />
              <span className="text-gray-500 text-[11px] font-semibold shrink-0 ml-1">UK</span>
            </div>
          </div>
          
          <div className="text-gray-500 text-[13px] flex items-center gap-3">
            <span>{formatUpdateTime(lastUpdated)}</span>
            <span className="text-gray-600">|</span>
            <span>Admin only</span>
          </div>
        </div>

        <div className="space-y-3 mb-8">
          <div className="bg-[#161616] border border-[#262626] rounded-lg p-3 text-[13px] text-gray-400">
            Vapi's current plan allows 14 days of call history. Earlier calls and costs are unavailable; this is not a complete monthly total.
          </div>
          <div className="bg-[#161616] border border-[#262626] rounded-lg p-3 text-[13px] text-gray-400">
            Some provider reports are incomplete or unavailable. Displayed totals cover the records received. Check Connected services for status.
          </div>
        </div>
      </div>
      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
        {statsData.map((stat, index) => (
          <div key={index} className="col-span-1">
            <StatCard {...stat} />
          </div>
        ))}
      </div>

      {/* Live Agent Usage */}
      <LiveAgentUsage 
        liveResponse={liveData} 
        isFetching={isFetchingLive} 
        refetch={refetchLive} 
      />

      {/* Low Balance Tenants */}
      <LowBalanceTenants threshold={61} count={0} />

      {isFetchingOperations ? (
        <div className="flex justify-center items-center h-64 text-gray-400">
          <Icon icon="lucide:refresh-cw" className="w-6 h-6 animate-spin mr-3" />
          <span className="text-[15px]">Loading operations data for selected dates...</span>
        </div>
      ) : (
        <>
          {/* Period Performance */}
          <PeriodPerformance 
            startDate={startDate}
            endDate={endDate}
            callsInPeriod={summary?.calls ?? 0}
            minutesRecorded={summary?.minutes ?? 0}
            failedCalls={summary?.failures ?? 0}
            failedTwilioLegs={summary?.failedTwilioLegs ?? 0}
            peakConcurrency={summary?.peak ?? 0}
            printersOnline={`${summary?.printersOnline ?? 0}/${summary?.printersTotal ?? 0}`}
            calls={operationsData?.calls || []}
          />
          
          {/* Navigation Tabs for Bottom Section */}
          <DashboardTabs 
            activeTab={activeTab} 
            setActiveTab={setActiveTab} 
            failedCallsCount={operationsData?.failedCalls?.length || 0}
          />

          {activeTab === 'overview' ? (
            <OverviewTabContent 
              dashboardData={dashboardData} 
              operationsData={operationsData} 
              setActiveTab={setActiveTab}
            />
          ) : activeTab === 'call-log' ? (
            <CallLogTabContent calls={operationsData?.calls} />
          ) : activeTab === 'failed-calls' ? (
            <FailedCallsTabContent failedCalls={operationsData?.failedCalls} />
          ) : activeTab === 'printer-health' ? (
            <PrinterHealthTabContent tenants={operationsData?.tenants} />
          ) : activeTab === 'provider-costs' ? (
            <ProviderCostsTabContent providers={operationsData?.providers} tenants={operationsData?.tenants} />
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500 bg-[#161616] border border-[#262626] rounded-xl border-dashed mb-8">
              Content for this tab is under construction.
            </div>
          )}
        </>
      )}
     
    </div>
  );
};

export default Dashboard;
