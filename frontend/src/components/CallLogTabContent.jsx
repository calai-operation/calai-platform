import React from 'react';
import { Icon } from '@iconify/react';
import Table from './Table';
import Dropdown from './Dropdown';
import { UK_TIMEZONE } from '../utils/date';

const CallLogTabContent = ({ calls = [], isLive = true, onSelectTenant, selectedTenant = "All tenants" }) => {



  const tableHeads = [
    { 
      key: "tenant", 
      Title: "TENANT / AGENT",
      render: (row) => (
        <div className="flex flex-col gap-1 whitespace-nowrap">
          <span className="font-semibold text-[13px] text-white">{row.tenantName}</span>
          <span className="text-[12px] text-gray-500">{row.agentName}</span>
        </div>
      )
    },
    { 
      key: "time", 
      Title: "TIME (UTC)", 
      render: (row) => <span className="whitespace-nowrap text-[13px] font-medium text-gray-300">{row.time}</span>
    },
    { 
      key: "provider", 
      Title: "PROVIDER",
      render: (row) => <span className="whitespace-nowrap text-[13px] text-gray-300">{row.provider}</span>
    },
    { 
      key: "duration", 
      Title: "DURATION",
      render: (row) => <span className="whitespace-nowrap text-[13px] text-gray-300">{row.duration}</span>
    },
    { 
      key: "cost", 
      Title: "COST",
      render: (row) => (
        <div className="flex flex-col gap-1 whitespace-nowrap">
          <span className="font-semibold text-[13px] text-white">{row.cost}</span>
          <span className="text-[12px] text-gray-500">Provider report</span>
        </div>
      )
    },
    { 
      key: "result", 
      Title: "RESULT / REASON",
      render: (row) => (
        <div className="flex flex-col gap-1 whitespace-nowrap">
          <span className="text-[13px] font-medium" style={{ color: row.resultColor }}>{row.result}</span>
          <span className="text-[10px] text-gray-600 font-mono">{row.id}</span>
        </div>
      )
    }
  ];

  const formatDateTime = (dateString) => {
    if (!dateString) return '-';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '-';
    return `${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: UK_TIMEZONE })}, ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: UK_TIMEZONE })}`;
  };

  const mappedCalls = calls.map(c => ({
    id: c.id,
    tenantName: c.tenantName || 'Unknown',
    agentName: c.agentName || 'Unknown',
    time: formatDateTime(c.startedAt || c.createdAt),
    provider: c.source === 'vapi' ? 'Vapi' : c.source === 'twilio' ? 'Twilio' : c.source,
    duration: c.seconds != null ? `${(c.seconds / 60).toFixed(1)} min` : 'Unknown',
    cost: c.cost != null ? `${c.currency === 'USD' ? 'US$' : c.currency === 'GBP' ? '£' : ''}${c.cost.toFixed(3)}` : 'Not available',
    result: c.reason || c.status,
    resultColor: c.failed ? '#f87171' : '#d1d5db'
  }));

  return (
    <div className="bg-[#161616] border border-[#262626] rounded-xl overflow-hidden mb-8">
      {/* Header */}
      <div className="p-6 pb-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#262626]">
        <div>
          <h2 className="text-[18px] font-semibold text-white mb-1">Call log</h2>
          <p className="text-[12px] text-gray-500">
            Recorded conversations, duration, provider cost and outcome
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0 relative z-10">
          <div className="w-[160px]">
            <Dropdown 
              options={["All tenants", "Testing Spice"]} 
              value="All tenants"
              inputClass="!bg-[#111111] !border-[#333] !text-white !px-3 !py-2 !text-[13px] hover:!bg-[#1a1a1a] transition-colors"
              optionClass="!bg-[#1a1a1a] !border-[#333] !text-white !text-[13px]"
              icon="!text-gray-400 !right-3 !w-4 !h-4"
            />
          </div>
          <button className="bg-[#2563eb] hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-[13px] font-medium flex items-center gap-2 transition-colors">
            <Icon icon="lucide:download" className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="w-full">
        <Table 
          TableHeads={tableHeads} 
          TableRows={mappedCalls} 
          headClass="!bg-[#111111] !text-[10px] !text-gray-500 !tracking-wider !border-b !border-[#262626] uppercase !py-3 !whitespace-nowrap"
          tableClass="!bg-[#161616] !border-none"
        />
      </div>
    </div>
  );
};

export default CallLogTabContent;
