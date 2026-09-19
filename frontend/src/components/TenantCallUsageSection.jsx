import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import TenantUsageTabContent from './TenantUsageTabContent';
import ProviderCallTable from './ProviderCallTable';
import { useViewTenant } from '../hooks/useViewTenant';
import StatCard from './StatCard';
import { getUKToday } from '../utils/date';

const TenantCallUsageSection = ({ tenant, viewTenantData }) => {
  const hookData = useViewTenant(tenant?.id);
  const data = viewTenantData || hookData || {};

  const [reportTab, setReportTab] = useState('usage');

  const today = data.today || getUKToday();

  const {
    period = { start: today.slice(0, 7) + "-01", end: today },
    setPeriod = () => {},
    operationsData,
    liveData,
    liveTenant = {},
    isFetchingOperations = false,
    lastUpdated,
    tenantDetails = {},
    calls = [],
    failedCalls = [],
  } = data;

  const num = (value) =>
    typeof value === "number"
      ? new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 }).format(value)
      : "—";

  const amounts = (values) => {
    if (!values || typeof values !== 'object') return 'Not available';
    const entries = Object.entries(values);
    if (entries.length === 0) return 'Not available';
    
    return entries.map(([currency, value]) => {
      if (value == null) return "Not available";
      const formatted = new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency,
        maximumFractionDigits: 3,
      }).format(value);
      if (currency === 'USD') return formatted.replace(/^US\$/, '$');
      return formatted;
    }).join(" · ");
  };

  const formatDate = (date) => {
    if (!date) return "Not recorded";
    return new Date(date).toLocaleString("en-GB", {
      timeZone: "Europe/London",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="mb-10">
      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">Call usage & provider costs</h2>
          <p className="text-sm text-gray-400">Choose a reporting period to review this tenant's activity.</p>
        </div>
        <button 
          className="bg-[#2563eb] hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-[13px] font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
          disabled={isFetchingOperations}
        >
          <Icon icon="lucide:refresh-cw" className={`w-4 h-4 ${isFetchingOperations ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b border-[#262626] pb-4">
        <div className="flex items-center gap-3 bg-[#111111] border border-[#262626] rounded-lg px-3 py-2 text-[13px] text-gray-300 [color-scheme:dark]">
          <Icon icon="lucide:calendar-days" className="w-4 h-4 text-gray-500 shrink-0" />
          <input
            type="date"
            className="bg-transparent outline-none text-white w-[115px] cursor-pointer font-medium [color-scheme:dark]"
            style={{ colorScheme: 'dark' }}
            value={period.start}
            max={period.end}
            onChange={(e) => e.target.value && setPeriod({ ...period, start: e.target.value })}
          />
          <span className="text-gray-500">—</span>
          <input
            type="date"
            className="bg-transparent outline-none text-white w-[115px] cursor-pointer font-medium [color-scheme:dark]"
            style={{ colorScheme: 'dark' }}
            value={period.end}
            min={period.start}
            max={today}
            onChange={(e) => e.target.value && setPeriod({ ...period, end: e.target.value })}
          />
          
        </div>
        <div className="text-[12px] text-gray-500">
          Updated {lastUpdated ? formatDate(lastUpdated) : formatDate(new Date())}
        </div>
      </div>

      {/* Notice */}
      <div className="bg-[#1a1f33] border border-[#2a3455] rounded-lg p-3 mb-6 flex items-center">
        <span className="text-[13px] text-blue-300">
          Some reports are unavailable or incomplete. Figures cover the records received.
        </span>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-10">
        <StatCard
          title="Recorded calls"
          value={num(tenantDetails?.callCount)}
          subtext={`${num(tenantDetails?.minutes)} minutes in this period`}
          icon="lucide:phone"
        />
        <StatCard
          title="Vapi call costs"
          value={amounts(tenantDetails?.costs?.vapi)}
          subtext={`${tenantDetails?.pendingCosts ?? 0} cost records pending`}
          icon="lucide:coins"
        />
        <StatCard
          title="Twilio call charges"
          value={amounts(tenantDetails?.costs?.twilio)}
          subtext={tenantDetails?.twilio ? `${tenantDetails.twilio.legs} matched telephony legs` : "No matching priced call legs"}
          icon="lucide:coins"
        />
        <StatCard
          title="Concurrent calls"
          value={num(liveTenant?.activeCalls || 0)}
          subtext={`${num(liveTenant?.agentsInUse || 0)} agents in use · live`}
          icon="lucide:radio"
        />
        <StatCard
          title="Failed calls"
          value={num(tenantDetails?.failures)}
          subtext={`${num(tenantDetails?.failedTwilioLegs)} additional failed Twilio legs`}
          icon="lucide:activity"
        />
        <StatCard
          title="Call transfers"
          value={num(tenantDetails?.transfers)}
          subtext={tenantDetails?.latencyMs == null ? "Audio latency not available" : `${tenantDetails.latencyMs} ms average first audio`}
          icon="lucide:arrow-up-right"
        />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-6 border-b border-[#262626] mb-6 overflow-x-auto hide-scrollbar">
        <button
          onClick={() => setReportTab('usage')}
          className={`relative flex items-center gap-2 py-3 transition-colors whitespace-nowrap ${
            reportTab === 'usage' 
              ? 'text-[#3b82f6] font-medium after:absolute after:bottom-[-1px] after:left-0 after:w-full after:h-[2px] after:bg-[#3b82f6]' 
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          Costs & usage
        </button>
        <button
          onClick={() => setReportTab('calls')}
          className={`relative flex items-center gap-2 py-3 transition-colors whitespace-nowrap ${
            reportTab === 'calls' 
              ? 'text-[#3b82f6] font-medium after:absolute after:bottom-[-1px] after:left-0 after:w-full after:h-[2px] after:bg-[#3b82f6]' 
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          Provider call log
        </button>
        <button
          onClick={() => setReportTab('failures')}
          className={`relative flex items-center gap-2 py-3 transition-colors whitespace-nowrap ${
            reportTab === 'failures' 
              ? 'text-[#3b82f6] font-medium after:absolute after:bottom-[-1px] after:left-0 after:w-full after:h-[2px] after:bg-[#3b82f6]' 
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          Failed calls
          {failedCalls?.length > 0 && (
            <span className="bg-[#381B20] text-[#E74C3C] text-[11px] font-bold px-1.5 py-0.5 rounded-md ml-1">
              {failedCalls.length}
            </span>
          )}
        </button>
      </div>

      {reportTab === 'usage' && <TenantUsageTabContent tenant={tenantDetails} />}
      {reportTab === 'calls' && (
        <ProviderCallTable 
          title="Provider call log"
          description="Existing call summaries and transcripts remain in the Calls tab below"
          calls={calls}
          tenantName={tenant?.name}
        />
      )}
      {reportTab === 'failures' && (
        <ProviderCallTable 
          title="Failed calls"
          description="Failures, reasons and additional failed telephony legs"
          calls={failedCalls}
          tenantName={tenant?.name}
        />
      )}
    </div>
  );
};

export default TenantCallUsageSection;
