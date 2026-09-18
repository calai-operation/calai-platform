import React, { useState } from 'react';
import { Icon } from '@iconify/react';

const MetricCard = ({ label, value, note, icon }) => (
  <div className="bg-[#161616] rounded-xl border border-[#262626] p-5 flex flex-col justify-between">
    <div className="flex justify-between items-start mb-4">
      <h3 className="text-[13px] font-medium text-gray-400">{label}</h3>
      <Icon icon={icon} className="w-[18px] h-[18px] text-[#3b82f6]" />
    </div>
    <div>
      <div className="text-[26px] font-bold text-white leading-none mb-2">{value}</div>
      <div className="text-[11px] text-gray-500">{note}</div>
    </div>
  </div>
);

const TenantCallUsageStats = ({ tenant }) => {
  const today = new Date().toISOString().slice(0, 10);
  const [period, setPeriod] = useState({
    start: today.slice(0, 7) + "-01",
    end: today,
  });

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
      return new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency,
        maximumFractionDigits: 3,
      }).format(value).replace('$', 'US$');
    }).join(" · ");
  };

  const formatDate = (date) => {
    if (!date) return "Not recorded";
    return new Date(date).toLocaleString("en-GB", {
      timeZone: "UTC",
      day: "2-digit",
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
        <button className="bg-[#2563eb] hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-[13px] font-medium flex items-center gap-2 transition-colors">
          <Icon icon="lucide:refresh-cw" className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b border-[#262626] pb-4">
        <div className="flex items-center gap-3 bg-[#111111] border border-[#262626] rounded-lg px-3 py-2 text-[13px] text-gray-300">
          <Icon icon="lucide:calendar-days" className="w-4 h-4 text-gray-500" />
          <input
            type="date"
            className="bg-transparent outline-none text-white w-[110px]"
            value={period.start}
            max={period.end}
            onChange={(e) => e.target.value && setPeriod({ ...period, start: e.target.value })}
          />
          <span className="text-gray-500">—</span>
          <input
            type="date"
            className="bg-transparent outline-none text-white w-[110px]"
            value={period.end}
            min={period.start}
            max={today}
            onChange={(e) => e.target.value && setPeriod({ ...period, end: e.target.value })}
          />
          <span className="text-gray-500 border-l border-[#333] pl-3 ml-1">UTC</span>
        </div>
        <div className="text-[12px] text-gray-500">
          Updated {formatDate(new Date())} UTC
        </div>
      </div>

      {/* Notice */}
      <div className="bg-[#1a1f33] border border-[#2a3455] rounded-lg p-3 mb-6 flex items-center">
        <span className="text-[13px] text-blue-300">
          Some reports are unavailable or incomplete. Figures cover the records received.
        </span>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <MetricCard
          label="Recorded calls"
          value={num(tenant?.callCount)}
          note={`${num(tenant?.minutes)} minutes in this period`}
          icon="lucide:phone"
        />
        <MetricCard
          label="Vapi call costs"
          value={amounts(tenant?.costs?.vapi)}
          note={`${tenant?.pendingCosts ?? 0} cost records pending`}
          icon="lucide:coins"
        />
        <MetricCard
          label="Twilio call charges"
          value={amounts(tenant?.costs?.twilio)}
          note={tenant?.twilio ? `${tenant.twilio.legs} matched telephony legs` : "No matching priced call legs"}
          icon="lucide:coins"
        />
        <MetricCard
          label="Concurrent calls"
          value={num(tenant?.liveCalls || 0)}
          note={`${num(tenant?.agents?.length || 0)} agents in use · live`}
          icon="lucide:radio"
        />
        <MetricCard
          label="Failed calls"
          value={num(tenant?.failedCalls?.length || tenant?.failures)}
          note={`${num(tenant?.failedTwilioLegs)} additional failed Twilio legs`}
          icon="lucide:activity"
        />
        <MetricCard
          label="Call transfers"
          value={num(tenant?.transfers)}
          note={tenant?.latencyMs == null ? "Audio latency not available" : `${tenant.latencyMs} ms average first audio`}
          icon="lucide:arrow-up-right"
        />
      </div>
    </div>
  );
};

export default TenantCallUsageStats;
