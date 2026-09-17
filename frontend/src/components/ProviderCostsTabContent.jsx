import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import Table from './Table';

const ProviderCostsTabContent = ({ providers, tenants = [] }) => {
  const [isCategoriesOpen, setIsCategoriesOpen] = useState(false);

  const twilioProvider = providers?.twilio || {};
  const categories = twilioProvider.categories || [];
  const chargeCategories = categories
    .filter(c => c.amount > 0)
    .map(c => ({
      name: c.label || c.category,
      cost: `£${c.amount.toFixed(3)}`
    }));

  const twilioTotal = twilioProvider.total?.amount ? `£${twilioProvider.total.amount.toFixed(2)}` : '£0.00';
  const vapiTotal = tenants.reduce((acc, t) => acc + (t.costs?.vapi?.USD || 0), 0);
  const vapiTotalStr = `US$${vapiTotal.toFixed(3)}`;

  const vapiData = tenants.map(t => ({
    tenant: t.name,
    calls: t.callCount?.toString() || '0',
    minutes: t.minutes != null ? t.minutes.toFixed(1) : '0',
    cost: t.costs?.vapi?.USD != null ? `US$${t.costs.vapi.USD.toFixed(3)}` : 'Not available',
    perCall: t.costPerCall?.vapi?.USD != null ? `US$${t.costPerCall.vapi.USD.toFixed(3)}` : 'Not available',
    perMinute: t.costPerMinute?.vapi?.USD != null ? `US$${t.costPerMinute.vapi.USD.toFixed(3)}` : 'Not available'
  }));

  const twilioData = tenants.map(t => ({
    tenant: t.name,
    legs: t.twilio?.legs?.toString() || '0',
    charges: t.twilio?.amounts?.GBP != null ? `£${t.twilio.amounts.GBP.toFixed(3)}` : 'Not available',
    perLeg: t.costPerCall?.twilio?.GBP != null ? `£${t.costPerCall.twilio.GBP.toFixed(3)}` : 'Not available',
    perMinute: t.costPerMinute?.twilio?.GBP != null ? `£${t.costPerMinute.twilio.GBP.toFixed(3)}` : 'Not available',
    pending: t.twilio?.pendingPrices?.toString() || '0'
  }));

  const vapiHeads = [
    { key: "tenant", Title: "TENANT / AGENT", render: (row) => <span className="font-medium text-[13px] text-white whitespace-nowrap">{row.tenant}</span> },
    { key: "calls", Title: "CALLS", render: (row) => <span className="text-[13px] text-white whitespace-nowrap">{row.calls}</span> },
    { key: "minutes", Title: "MINUTES", render: (row) => <span className="text-[13px] text-white whitespace-nowrap">{row.minutes}</span> },
    { key: "cost", Title: "REPORTED COST", render: (row) => <span className="text-[13px] text-white whitespace-nowrap">{row.cost}</span> },
    { key: "perCall", Title: "PER PRICED CALL", render: (row) => <span className="text-[13px] text-white whitespace-nowrap">{row.perCall}</span> },
    { key: "perMinute", Title: "PER MEASURED MINUTE", render: (row) => <span className="text-[13px] text-white whitespace-nowrap">{row.perMinute}</span> },
  ];

  const twilioHeads = [
    { key: "tenant", Title: "TENANT / AGENT", render: (row) => <span className="font-medium text-[13px] text-white whitespace-nowrap">{row.tenant}</span> },
    { key: "legs", Title: "CALL LEGS", render: (row) => <span className="text-[13px] text-white whitespace-nowrap">{row.legs}</span> },
    { key: "charges", Title: "CALL CHARGES", render: (row) => <span className="text-[13px] text-white whitespace-nowrap">{row.charges}</span> },
    { key: "perLeg", Title: "PER PRICED LEG", render: (row) => <span className="text-[13px] text-white whitespace-nowrap">{row.perLeg}</span> },
    { key: "perMinute", Title: "PER MEASURED MINUTE", render: (row) => <span className="text-[13px] text-white whitespace-nowrap">{row.perMinute}</span> },
    { key: "pending", Title: "PENDING PRICES", render: (row) => <span className="text-[13px] text-white whitespace-nowrap">{row.pending}</span> },
  ];

  return (
    <>
      {/* Vapi Costs Table */}
      <div className="bg-[#161616] border border-[#262626] rounded-xl overflow-hidden mb-8">
        <div className="p-6 pb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#262626]">
          <div>
            <h2 className="text-[18px] font-semibold text-white mb-1">Vapi costs</h2>
            <p className="text-[12px] text-gray-500">
              2026-09-01 to 2026-09-17 · provider-reported in USD
            </p>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#262626] bg-[#1a1a1a] text-[12px] text-gray-400 font-medium">
            <div className="w-1.5 h-1.5 rounded-full bg-gray-500"></div>
            Partial report
          </div>
        </div>
        
        <div className="p-6 pb-2">
          <div className="text-4xl text-white tracking-tight">{vapiTotalStr}</div>
        </div>

        <div className="w-full">
          <Table 
            TableHeads={vapiHeads} 
            TableRows={vapiData} 
            headClass="!bg-[#111111] !text-[10px] !text-gray-500 !tracking-wider !border-y !border-[#262626] uppercase !py-3 !whitespace-nowrap"
            tableClass="!bg-[#161616] !border-none"
          />
        </div>

        <div className="p-6 border-t border-[#262626]">
          <p className="text-[12px] text-gray-500 leading-relaxed">
            Vapi call costs are shown independently from Twilio. Tenant details show the reported component breakdown. Unit costs use priced records; per-minute costs also require measured duration.
          </p>
        </div>
      </div>

      {/* Twilio Account Usage Table */}
      <div className="bg-[#161616] border border-[#262626] rounded-xl overflow-hidden mb-8">
        <div className="p-6 pb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#262626]">
          <div>
            <h2 className="text-[18px] font-semibold text-white mb-1">Twilio account usage</h2>
            <p className="text-[12px] text-gray-500">
              Provider-reported usage for the selected dates
            </p>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-900/50 bg-emerald-950/30 text-[12px] text-emerald-500 font-medium">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
            Connected
          </div>
        </div>
        
        <div className="p-6 pb-2">
          <div className="text-4xl text-white tracking-tight">{twilioTotal}</div>
        </div>

        <div className="w-full">
          <Table 
            TableHeads={twilioHeads} 
            TableRows={twilioData} 
            headClass="!bg-[#111111] !text-[10px] !text-gray-500 !tracking-wider !border-y !border-[#262626] uppercase !py-3 !whitespace-nowrap"
            tableClass="!bg-[#161616] !border-none"
          />
        </div>

        <div className="p-6 border-t border-[#262626]">
          <p className="text-[12px] text-gray-500 leading-relaxed mb-4">
            Call charges above are included in the account usage total. Number rental and other account charges remain unallocated. Different currencies and potentially overlapping transport charges are not added together.
          </p>
          <div 
            onClick={() => setIsCategoriesOpen(!isCategoriesOpen)}
            className="flex items-center gap-2 text-[13px] text-gray-400 hover:text-white cursor-pointer transition-colors w-max group select-none"
          >
            <Icon 
              icon={isCategoriesOpen ? "lucide:chevron-down" : "lucide:play"} 
              className={`w-3 h-3 fill-current text-gray-500 group-hover:text-gray-300 transition-transform ${isCategoriesOpen ? '' : ''}`} 
            />
            View account charge categories
          </div>

          {isCategoriesOpen && (
            <div className="mt-4 flex flex-col">
              {chargeCategories.map((cat, idx) => (
                <div key={idx} className="flex justify-between items-center py-4 border-b border-[#262626]">
                  <span className="text-[13px] text-gray-300 pl-4">{cat.name}</span>
                  <span className="text-[13px] text-white pr-4">{cat.cost}</span>
                </div>
              ))}
              <div className="pt-6 pb-2 text-[12px] text-gray-500 pl-4">
                Categories can overlap and should not be summed.
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default ProviderCostsTabContent;
