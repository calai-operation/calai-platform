import React from 'react';
import { Icon } from '@iconify/react';
import Dropdown from './Dropdown';
import Table from './Table';

const LiveAgentUsage = ({ liveResponse, isFetching, refetch }) => {
  const liveData = liveResponse || {
    summary: { activeCalls: 0, agentsInUse: 0, tenantsInUse: 0, ringing: 0, queued: 0, forwarding: 0 },
    calls: [],
    tenants: [],
    generatedAt: new Date().toISOString()
  };

  const summary = liveData.summary;
  const snapshotDate = new Date(liveData.generatedAt);
  const snapshotTime = isNaN(snapshotDate.getTime()) 
    ? new Date().toLocaleTimeString('en-GB', { timeZone: 'Europe/London' }) 
    : snapshotDate.toLocaleTimeString('en-GB', { timeZone: 'Europe/London' });

  const tableHeads = [
    { key: "tenant", Title: "TENANT", sortable: false },
    { key: "agent", Title: "AGENT IN USE", sortable: false },
    { key: "status", Title: "STATUS", sortable: false },
    { key: "duration", Title: "LIVE DURATION", sortable: false },
    { key: "provider", Title: "PROVIDER / CALL", sortable: false },
  ];

  const emptyStateContent = (
    <div className="px-6 py-8 text-left">
      <div className="flex items-start gap-4 mb-16">
        <Icon icon="lucide:radio" className="w-[18px] h-[18px] text-[#3b82f6] mt-0.5 shrink-0" />
        <div>
          <h3 className="text-[15px] font-semibold text-white mb-1">No calls in progress</h3>
          <p className="text-[13px] text-gray-400">
            Tenant and agent details appear here automatically when a call starts.
          </p>
        </div>
      </div>
      <p className="text-[12px] text-gray-500">
        One agent can handle multiple concurrent calls. Only connected voice providers are covered; transferred calls are listed separately.
      </p>
    </div>
  );

  return (
    <div className="bg-[#161616] border border-[#262626] rounded-xl overflow-hidden mt-6 mb-6">
      {/* Header */}
      <div className="p-6 flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-[10px] font-bold text-gray-400 tracking-wider">LIVE</span>
          </div>
          <h2 className="text-[22px] font-semibold text-white mb-1">Live agent usage</h2>
          <p className="text-[13px] text-gray-400">
            Who is on a call right now · refreshes every 5 seconds
          </p>
        </div>
        <button 
          onClick={() => refetch()} 
          disabled={isFetching}
          className="bg-[#2563eb] hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-[13px] font-medium flex items-center gap-2 transition-colors disabled:opacity-70"
        >
          <Icon icon="lucide:refresh-cw" className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh live
        </button>
      </div>

      <div className="h-[1px] w-full bg-[#262626]"></div>

      {/* Stats row */}
      <div className="p-6 flex flex-col md:flex-row justify-between items-start md:items-center">
        <div className="flex flex-wrap gap-12 md:gap-24">
          <div>
            <div className="flex items-center gap-2 mb-2 text-gray-400">
              <Icon icon="lucide:radio" className="w-[18px] h-[18px] text-[#3b82f6]" />
              <span className="text-[13px] font-medium">Concurrent calls</span>
            </div>
            <div className="text-[34px] font-semibold text-white leading-none">{summary.activeCalls}</div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2 text-gray-400">
              <Icon icon="lucide:bot" className="w-[18px] h-[18px] text-[#3b82f6]" />
              <span className="text-[13px] font-medium">Agents in use</span>
            </div>
            <div className="text-[34px] font-semibold text-white leading-none">{summary.agentsInUse}</div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2 text-gray-400">
              <Icon icon="lucide:building-2" className="w-[18px] h-[18px] text-[#3b82f6]" />
              <span className="text-[13px] font-medium">Tenants on calls</span>
            </div>
            <div className="text-[34px] font-semibold text-white leading-none">{summary.tenantsInUse}</div>
          </div>
        </div>

        <div className="flex flex-col gap-1.5 text-[13px] text-gray-400 mt-6 md:mt-0 text-right">
          <span>{summary.ringing} ringing</span>
          <span>{summary.queued} queued</span>
          <span>{summary.forwarding} forwarded</span>
        </div>
      </div>

      <div className="h-[1px] w-full bg-[#262626]"></div>

      {/* Filters row */}
      <div className="px-6 py-4 flex justify-between items-center bg-[#18181a]">
        <span className="text-[12px] text-gray-500">
          Snapshot {snapshotTime} UK Time · independent of date filters
        </span>
        <div className="w-[140px]">
          <Dropdown 
            options={["All tenants"]} 
            value="All tenants"
            inputClass="!bg-[#111111] !border-[#262626] !text-white !p-2 !py-1.5 !text-[13px] !font-medium hover:!bg-[#1a1a1a] transition-colors"
            optionClass="!bg-[#1a1a1a] !border-[#262626] !text-white"
            icon="!text-gray-400 !right-2 !w-4 !h-4"
          />
        </div>
      </div>

      {/* Table Component */}
      <Table 
        TableHeads={tableHeads} 
        TableRows={[]} 
        headClass="!bg-[#161616] !text-[11px] !text-gray-500 !tracking-wider !border-y !border-[#262626]"
        emptyState={emptyStateContent}
      />
    </div>
  );
};

export default LiveAgentUsage;
