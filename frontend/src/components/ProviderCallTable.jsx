import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import Table from './Table';

const ProviderCallTable = ({ title, description, calls = [], tenantName }) => {
  const formatCost = (costObj, provider) => {
    if (costObj == null) return "Not available";
    
    let currency = provider === 'Twilio' ? 'GBP' : 'USD';
    let value = costObj;

    if (typeof costObj === 'object') {
      const entries = Object.entries(costObj);
      if (entries.length > 0) {
        currency = entries[0][0];
        value = entries[0][1];
      }
    }

    if (value === 0) return currency === 'GBP' ? '£0.00' : 'US$0.00';

    const formatted = new Intl.NumberFormat('en-GB', { 
      style: 'currency', 
      currency: currency, 
      maximumFractionDigits: 3 
    }).format(value);
    
    if (currency === 'USD') {
      return formatted.replace(/^US\$/, '$');
    }
    return formatted;
  };

  const columns = [
    {
      key: 'tenant',
      Title: 'TENANT / AGENT',
      render: (row) => (
        <div className="flex flex-col gap-0.5">
          <span className="text-[13px] font-semibold text-white">{tenantName || row.tenantName || 'Unknown'}</span>
          <span className="text-[11px] text-gray-500">{row.agentName || (row.provider === 'Twilio' ? 'Telephony leg' : tenantName || 'Unknown')}</span>
        </div>
      )
    },
    {
      key: 'time',
      Title: 'TIME (UTC)',
      render: (row) => {
        const date = new Date(row.time || row.createdAt || new Date());
        return (
          <div className="text-[13px] text-white">
            {date.toLocaleString('en-GB', {
              timeZone: 'UTC',
              day: '2-digit',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit'
            }).replace(',', '')}
          </div>
        );
      }
    },
    {
      key: 'provider',
      Title: 'PROVIDER',
      render: (row) => {
        const providerName = row.provider || (row.source === 'vapi' ? 'Vapi' : row.source === 'twilio' ? 'Twilio' : row.source) || 'Unknown';
        return (
          <div className="text-[13px] text-white">
            {providerName}
          </div>
        );
      }
    },
    {
      key: 'duration',
      Title: 'DURATION',
      render: (row) => {
        let dur = row.duration ?? row.measuredMinutes ?? row.minutes;
        if (dur == null && row.seconds != null) {
          dur = row.seconds / 60;
        }

        if (dur == null) return <div className="text-[13px] text-white">Unknown</div>;
        
        // Handle numeric parsing safely
        const numDur = typeof dur === 'string' ? parseFloat(dur) : dur;
        const displayDur = isNaN(numDur) ? dur : Math.round(numDur * 10) / 10;
        
        return (
          <div className="text-[13px] text-white">
            {displayDur} min
          </div>
        );
      }
    },
    {
      key: 'cost',
      Title: 'COST',
      render: (row) => {
        const providerName = row.provider || (row.source === 'vapi' ? 'Vapi' : row.source === 'twilio' ? 'Twilio' : row.source) || 'Unknown';
        // if API provides flat cost and currency instead of object
        let costValue = row.cost;
        if (costValue != null && typeof costValue === 'number' && row.currency) {
          costValue = { [row.currency]: costValue };
        }

        return (
          <div className="flex flex-col gap-0.5">
            <span className="text-[13px] font-semibold text-white">{formatCost(costValue, providerName)}</span>
            <span className="text-[11px] text-gray-500">Provider report</span>
          </div>
        );
      }
    },
    {
      key: 'result',
      Title: 'RESULT / REASON',
      render: (row) => (
        <div className="flex flex-col gap-0.5">
          <span className="text-[13px] text-[#E74C3C]">{row.reason || row.status || 'unknown'}</span>
          <span className="text-[11px] text-gray-500 font-mono tracking-tighter">{row.id || row.callId || 'no-id'}</span>
        </div>
      )
    }
  ];

  return (
    <div className="bg-[#161616] rounded-xl border border-[#262626] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-[#262626]">
        <h2 className="text-lg font-semibold text-white mb-1">{title}</h2>
        <p className="text-[13px] text-gray-400">{description}</p>
      </div>

      {/* Table */}
      <Table 
        TableHeads={columns}
        TableRows={calls}
        headClass="!bg-transparent !text-[10px] !text-gray-500 !tracking-wider !border-b !border-[#262626] uppercase !px-6 !py-4"
        tableClass="!bg-transparent"
        wrapperClass="w-full"
        emptyState={
          <div className="text-center py-12 text-[13px] text-gray-500">
            No records found.
          </div>
        }
      />
    </div>
  );
};

export default ProviderCallTable;
