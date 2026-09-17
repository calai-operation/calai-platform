import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import toast from 'react-hot-toast';
import Dropdown from './Dropdown';
import StatCard from './StatCard';
import { downloadCSV, downloadJSON } from '../utils/export';

const PeriodPerformance = ({
  startDate = "2026-09-01",
  endDate = "2026-09-17",
  callsInPeriod = 65,
  minutesRecorded = 60.7,
  failedCalls = 8,
  failedTwilioLegs = 9,
  peakConcurrency = 2,
  printersOnline = "0/1",
  calls = []
}) => {
  const [exportFormat, setExportFormat] = useState("CSV");

  const handleExport = async () => {
    try {
      if (!calls || calls.length === 0) {
        toast.error("No data available to export for this period.");
        return;
      }
      
      const exportData = calls.map(c => ({
        ID: c.id,
        Tenant: c.tenantName || 'Unknown',
        Agent: c.agentName || 'Unknown',
        Provider: c.source === 'vapi' ? 'Vapi' : c.source === 'twilio' ? 'Twilio' : c.source,
        Status: c.status,
        Failed: c.failed ? 'Yes' : 'No',
        Seconds: c.seconds != null ? c.seconds : 'N/A',
        Cost: c.cost != null ? c.cost : 'N/A',
        Currency: c.currency || 'N/A',
        StartedAt: c.startedAt || c.createdAt,
        Reason: c.reason || c.status
      }));

      const filename = `All Data ${startDate}_to_${endDate}`;
      
      if (exportFormat === "CSV") {
        await downloadCSV(filename, exportData);
      } else {
        await downloadJSON(filename, exportData);
      }
      
      
    } catch (error) {
      if (error.message === "Save cancelled by user") {
        return; // Don't show toast if user intentionally cancelled
      }
      toast.error(`Export failed: ${error.message}`);
    }
  };

  return (
    <div className="mt-8 mb-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-[20px] font-semibold text-white mb-1.5">Period performance</h2>
          <p className="text-[13px] text-gray-400">
            {startDate} to {endDate} · UTC
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-[140px]">
            <Dropdown 
              options={["CSV", "JSON"]} 
              value={exportFormat}
              onSelect={(val) => setExportFormat(val)}
              inputClass="!bg-[#111111] !border-[#262626] !text-white !px-3 !py-2 !text-[13px] !font-medium hover:!bg-[#1a1a1a] transition-colors"
              optionClass="!bg-[#1a1a1a] !border-[#262626] !text-white !text-[13px]"
              icon="!text-gray-400 !right-2 !w-4 !h-4"
            />
          </div>
          <button 
            onClick={handleExport}
            className="bg-[#2563eb] hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-[13px] font-medium flex items-center gap-2 transition-colors"
          >
            <Icon icon="lucide:download" className="w-4 h-4" />
            Export all data
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard 
          title="Calls in period"
          value={callsInPeriod}
          icon="lucide:phone-call"
          subtext={`${minutesRecorded} minutes recorded`}
        />
        <StatCard 
          title="Failed calls"
          value={failedCalls}
          icon="lucide:activity"
          subtext={`${failedTwilioLegs} additional failed Twilio legs`}
        />
        <StatCard 
          title="Period peak concurrency"
          value={peakConcurrency}
          icon="lucide:radio"
          subtext="Available calls created in selected dates"
        />
        <StatCard 
          title="Printers online"
          value={printersOnline}
          icon="lucide:printer"
          subtext="Based on the latest heartbeat"
        />
      </div>
    </div>
  );
};

export default PeriodPerformance;
