import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import toast from 'react-hot-toast';
import Table from './Table';
import Dropdown from './Dropdown';
import { downloadCSV } from '../utils/export';
import { getUKToday } from '../utils/date';
import TenantDetailSlideOver from './TenantDetailSlideOver';

const AllTenantsList = ({ tenants = [], setActiveTab }) => {
  const [includeUnlinked, setIncludeUnlinked] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPlan, setSelectedPlan] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  
  // Slide-over state
  const [isSlideOverOpen, setIsSlideOverOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState(null);

  const handleOpenTenantDetail = (tenant) => {
    setSelectedTenant(tenant);
    setIsSlideOverOpen(true);
  };

  const handleCloseSlideOver = () => {
    setIsSlideOverOpen(false);
    // Don't clear selectedTenant immediately so animation stays smooth
    setTimeout(() => setSelectedTenant(null), 300);
  };

  const tableHeads = [
    { 
      key: "tenant", 
      Title: "TENANT / AGENT", 
      sortable: true,
      render: (row) => (
        <div 
          className="flex items-center gap-3 cursor-pointer group"
          onClick={() => handleOpenTenantDetail(row.originalTenant)}
        >
          <div className="w-10 h-10 rounded-lg bg-[#0F172A] border border-[#1e293b] flex items-center justify-center text-[#3b82f6] font-medium text-sm shrink-0 group-hover:border-[#3b82f6] transition-colors">
            {row.tenant.initials}
          </div>
          <div>
            <div className="text-[14px] font-semibold text-white mb-0.5 group-hover:text-[#3b82f6] transition-colors">{row.tenant.name}</div>
            <div className="text-[12px] text-gray-500">{row.tenant.plan}</div>
          </div>
        </div>
      )
    },
    { key: "agentsInUse", Title: "AGENTS IN USE", sortable: true },
    { key: "liveCalls", Title: "LIVE CALLS", sortable: true },
    { key: "calls", Title: "CALLS", sortable: true },
    { key: "minutes", Title: "MINUTES", sortable: true },
    { key: "vapiCosts", Title: "VAPI COSTS", sortable: true },
    { 
      key: "twilioCharges", 
      Title: "TWILIO CALL CHARGES", 
      sortable: true,
      render: (row) => (
        <div>
          <div className="text-white">{row.twilioCharges.cost}</div>
          <div className="text-[11px] text-gray-500 mt-0.5">{row.twilioCharges.pending}</div>
        </div>
      )
    },
    { 
      key: "failures", 
      Title: "FAILURES", 
      sortable: true,
      render: (row) => (
        row.failures > 0 ? (
          <span className="bg-[#381B20] text-[#E74C3C] text-[11px] font-bold px-2 py-1 rounded-md">
            {row.failures}
          </span>
        ) : (
          <span>0</span>
        )
      )
    },
    { 
      key: "printers", 
      Title: "PRINTERS", 
      sortable: true,
      render: (row) => (
        <span className={`inline-flex items-center gap-1.5 ${row.printers === 'Offline' ? 'bg-[#381B20] text-[#E74C3C]' : 'bg-[#1B2926] text-emerald-500'} text-[11px] font-bold px-2.5 py-1 rounded-md`}>
          <span className={`w-1.5 h-1.5 rounded-full ${row.printers === 'Offline' ? 'bg-[#E74C3C]' : 'bg-emerald-500'}`}></span>
          {row.printers}
        </span>
      )
    },
    {
      key: "actions",
      Title: "",
      sortable: false,
      render: (row) => (
        <div className="flex justify-end pr-4">
          <Icon 
            icon="lucide:arrow-up-right" 
            className="text-gray-400 w-4 h-4 cursor-pointer hover:text-white transition-colors" 
            onClick={() => handleOpenTenantDetail(row.originalTenant)}
          />
        </div>
      )
    }
  ];

  const unlinkedCount = tenants.filter(t => t.status?.toLowerCase() === 'unlinked').length;
  const filteredTenants = includeUnlinked ? tenants : tenants.filter(t => t.status?.toLowerCase() !== 'unlinked');

  const tableRows = filteredTenants.map(t => ({
    originalTenant: t,
    tenant: { 
      initials: t.name ? t.name.substring(0, 2).toUpperCase() : 'NA', 
      name: t.name || 'Unknown', 
      plan: `${t.plan || 'Unknown'} - ${t.status ? (t.status.charAt(0).toUpperCase() + t.status.slice(1)) : 'Unknown'}` 
    },
    agentsInUse: t.agents?.length || 0,
    liveCalls: t.liveCalls || 0,
    calls: t.callCount || 0,
    minutes: t.minutes != null ? t.minutes.toFixed(1) : 0,
    vapiCosts: t.costs?.vapi?.USD != null ? `$${t.costs.vapi.USD.toFixed(3)}` : 'US$0.000',
    twilioCharges: { 
      cost: t.costs?.twilio?.GBP != null ? `£${t.costs.twilio.GBP.toFixed(3)}` : '£0.000', 
      pending: `${t.twilio?.pendingPrices || 0} prices pending` 
    },
    failures: (t.failedCalls || 0),
    printers: t.printers?.some(p => p.status === 'offline') ? 'Offline' : (t.printers?.length ? 'Online' : 'None')
  }));

  const handleExport = async () => {
    try {
      if (!filteredTenants || filteredTenants.length === 0) {
        toast.error("No tenants available to export.");
        return;
      }

      const exportData = filteredTenants.map(t => ({
        "Tenant Name": t.name || 'Unknown',
        "Status": t.status ? (t.status.charAt(0).toUpperCase() + t.status.slice(1)) : 'Unknown',
        "Plan": t.plan || 'Unknown',
        "Agents In Use": t.agents?.length || 0,
        "Live Calls": t.liveCalls || 0,
        "Total Calls": t.callCount || 0,
        "Minutes": t.minutes != null ? t.minutes.toFixed(1) : 0,
        "Vapi Costs (USD)": t.costs?.vapi?.USD != null ? t.costs.vapi.USD.toFixed(3) : '0.000',
        "Twilio Charges (GBP)": t.costs?.twilio?.GBP != null ? t.costs.twilio.GBP.toFixed(3) : '0.000',
        "Pending Twilio Prices": t.twilio?.pendingPrices || 0,
        "Failures": t.failedCalls || 0,
        "Printers Status": t.printers?.some(p => p.status === 'offline') ? 'Offline' : (t.printers?.length ? 'Online' : 'None')
      }));

      const dateStr = getUKToday();
      await downloadCSV(`Tenants_Export_${dateStr}`, exportData);
      toast.success("CSV file downloaded successfully!");
    } catch (error) {
      if (error.message === "Save cancelled by user") return;
      toast.error(`Export failed: ${error.message}`);
    }
  };

  return (
    <>
      <div className="bg-[#161616] border border-[#262626] rounded-xl overflow-hidden mb-8">
        <div className="p-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start mb-8 gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-[20px] font-semibold text-white">All tenants</h2>
                <span className="bg-[#262626] text-gray-300 text-[12px] font-medium px-2 py-0.5 rounded-md">
                  {filteredTenants.length}
                </span>
              </div>
              <p className="text-[13px] text-gray-400">
                Every registered tenant, with live agent usage and selected-period costs
              </p>
            </div>
            <button 
              onClick={handleExport}
              className="bg-[#2563eb] hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-[13px] font-medium flex items-center gap-2 transition-colors shrink-0"
            >
              <Icon icon="lucide:download" className="w-4 h-4" />
              Export
            </button>
          </div>

          {/* Filters */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
            <div className="relative w-full md:w-[400px]">
              <Icon icon="lucide:search" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
              <input 
                type="text" 
                placeholder="Search tenants or agents..." 
                className="w-full bg-transparent border border-[#333] text-white text-[13px] rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:border-gray-500 placeholder:text-gray-500"
              />
            </div>
            
           
          </div>

          {/* Checkbox */}
          <div className="flex flex-wrap items-center gap-3 text-[13px]">
            <label 
              className="flex items-center gap-2 cursor-pointer text-gray-400 hover:text-gray-300 group select-none"
              onClick={() => setIncludeUnlinked(!includeUnlinked)}
            >
              <div className={`w-4 h-4 rounded-[4px] border flex items-center justify-center transition-colors ${includeUnlinked ? 'border-[#3b82f6] bg-[#3b82f6]' : 'border-gray-600 bg-transparent group-hover:border-gray-400'}`}>
                {includeUnlinked && <Icon icon="lucide:check" className="w-3 h-3 text-white" />}
              </div>
              Include unlinked provider activity ({unlinkedCount})
            </label>
            <span className="text-gray-500">
              Unlinked costs remain included in provider totals.
            </span>
          </div>
        </div>

        {/* Table Component */}
        <Table 
          TableHeads={tableHeads} 
          TableRows={tableRows} 
          headClass="!bg-[#161616] !text-[10px] !text-gray-500 !tracking-wider !border-y !border-[#262626] uppercase"
          tableClass="!bg-[#161616]"
        />
        
        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#262626] flex items-center gap-2 text-gray-500 text-[12px] bg-[#161616]">
          <Icon icon="lucide:shield-check" className="w-[15px] h-[15px]" />
          Vapi and Twilio charges are separate. Unknown costs are never shown as zero.
        </div>
      </div>

      <TenantDetailSlideOver 
        tenant={selectedTenant} 
        isOpen={isSlideOverOpen} 
        onClose={() => setIsSlideOverOpen(false)} 
        setActiveTab={setActiveTab}
      />
    </>
  );
};

export default AllTenantsList;
