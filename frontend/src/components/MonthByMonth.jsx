import React, { useState, useMemo } from 'react';
import { Icon } from '@iconify/react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';
import toast from 'react-hot-toast';
import Dropdown from './Dropdown';
import Table from './Table';
import { useQuery } from '@tanstack/react-query';
import useAxiosSecure from '../hooks/useAxiosSecure';
import { downloadCSV, downloadJSON } from '../utils/export';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];

const amounts = (values) =>
  Object.entries(values || {})
    .map(([currency, value]) =>
      new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      }).format(value),
    )
    .join(" · ") || "—";

const complete = (r) =>
  r.coverage.localComplete &&
  r.coverage.vapiComplete &&
  r.coverage.twilioComplete &&
  (!["connected", "partial", "unavailable"].includes(
    r.providers?.voice?.status, // or calaiVapi
  ) ||
    r.coverage.voiceComplete);

const cost = (r) => {
  const out = {};
  for (const t of r.tenants || []) {
    for (const [c, n] of Object.entries(t.costs?.vapi || {})) {
      out[c] = (out[c] || 0) + n;
    }
  }
  return out;
};

const getMonthPeriods = (yearStr) => {
  const todayStr = new Date().toISOString().slice(0, 10);
  const currentYear = todayStr.slice(0, 4);
  const currentMonth = parseInt(todayStr.slice(5, 7), 10);
  
  const periods = [];
  const maxMonth = yearStr === currentYear ? currentMonth : 12;
  
  for (let m = 1; m <= maxMonth; m++) {
    const monthStr = m.toString().padStart(2, '0');
    const start = `${yearStr}-${monthStr}-01`;
    
    let end;
    if (yearStr === currentYear && m === currentMonth) {
      end = todayStr;
    } else {
      end = new Date(Date.UTC(parseInt(yearStr), m, 0)).toISOString().slice(0, 10);
    }
    
    periods.push({ start, end });
  }
  
  return periods;
};

const MonthByMonth = () => {
  const currentDate = new Date();
  const currentYearStr = currentDate.getFullYear().toString();
  const [selectedYear, setSelectedYear] = useState(currentYearStr);
  const [exportFormat, setExportFormat] = useState("CSV");
  const [progress, setProgress] = useState(0);
  
  const axiosSecure = useAxiosSecure();

  const { data: reports, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["dashboard-operations-monthly", selectedYear],
    queryFn: async () => {
      const periods = getMonthPeriods(selectedYear);
      const fetchedReports = [];
      setProgress(0);
      
      for (const p of periods) {
        try {
          const res = await axiosSecure.get(`/system-owner/dashboard/operations?start=${p.start}&end=${p.end}`);
          if (res.data?.data) {
            fetchedReports.push(res.data.data);
            setProgress(fetchedReports.length);
          }
        } catch (error) {
          console.error(`Failed to fetch operations for ${p.start} to ${p.end}:`, error);
        }
      }
      return fetchedReports;
    },
    enabled: !!selectedYear,
  });

  const { displayChart, displayTable, exportData } = useMemo(() => {
    if (!reports || reports.length === 0) return { displayChart: [], displayTable: [], exportData: [] };
    
    const chart = [];
    const table = [];
    const rawExport = [];

    reports.forEach(r => {
      if (!r.period || !r.summary) return;
      
      const label = new Date(r.period.start).toLocaleDateString("en-GB", {
        month: "short",
        timeZone: "UTC",
      });
      const monthStr = `${label} ${selectedYear}`;

      chart.push({
        name: label,
        calls: r.summary.calls || 0,
        failures: r.summary.failures || 0,
      });

      const coverageStatus = complete(r) ? "Available sources complete" : "Partial / unavailable";

      table.push({
        month: monthStr,
        newTenants: r.summary.newTenants ?? "—",
        subStarts: r.summary.subscriptionsStarted ?? "—",
        revenue: amounts(r.summary.revenue),
        calls: r.summary.calls || 0,
        minutes: Number(r.summary.minutes || 0).toFixed(1),
        failures: r.summary.failures || 0,
        peak: r.summary.peak || 0,
        vapi: amounts(cost(r)),
        twilio: r.providers?.twilio?.total 
          ? amounts({ [r.providers.twilio.total.currency]: r.providers.twilio.total.amount })
          : "—",
        coverageRender: () => (
          <div className="whitespace-nowrap">
            <div className="text-white font-medium text-[12px]">
              {coverageStatus}
            </div>
            {r.providers?.vapi?.note && (
              <div className="text-[11px] text-gray-500" title={r.providers.vapi.note}>
                Vapi history limited by plan
              </div>
            )}
          </div>
        )
      });

      rawExport.push({
        "Month": monthStr,
        "New Tenants": r.summary.newTenants ?? 0,
        "Subscription Starts": r.summary.subscriptionsStarted ?? 0,
        "Paid Invoice Revenue": amounts(r.summary.revenue),
        "Calls": r.summary.calls || 0,
        "Minutes": Number(r.summary.minutes || 0).toFixed(1),
        "Failures": r.summary.failures || 0,
        "Peak Concurrent": r.summary.peak || 0,
        "Vapi Costs": amounts(cost(r)),
        "Twilio Account Usage": r.providers?.twilio?.total 
          ? amounts({ [r.providers.twilio.total.currency]: r.providers.twilio.total.amount }) 
          : "—",
        "Coverage": coverageStatus
      });
    });

    return { displayChart: chart, displayTable: table, exportData: rawExport };
  }, [reports, selectedYear]);

  const handleExport = async () => {
    try {
      if (!exportData || exportData.length === 0) {
        toast.error("No data available to export.");
        return;
      }
      
      const filename = `Yearly_Summary_${selectedYear}`;
      if (exportFormat === "CSV") {
        await downloadCSV(filename, exportData);
      } else {
        await downloadJSON(filename, exportData);
      }
    
    } catch (error) {
      toast.error(`Export failed: ${error.message}`);
    }
  };

  const tableHeads = [
    { key: "month", Title: "MONTH", render: (row) => <span className="font-medium whitespace-nowrap">{row.month}</span> },
    { key: "newTenants", Title: "NEW TENANTS", render: (row) => <span className="whitespace-nowrap">{row.newTenants}</span> },
    { key: "subStarts", Title: "SUBSCRIPTION STARTS", render: (row) => <span className="whitespace-nowrap">{row.subStarts}</span> },
    { key: "revenue", Title: "PAID INVOICE REVENUE", render: (row) => <span className="whitespace-nowrap">{row.revenue}</span> },
    { key: "calls", Title: "CALLS", render: (row) => <span className="whitespace-nowrap">{row.calls}</span> },
    { key: "minutes", Title: "MINUTES", render: (row) => <span className="whitespace-nowrap">{row.minutes}</span> },
    { key: "failures", Title: "FAILURES", render: (row) => <span className="whitespace-nowrap">{row.failures}</span> },
    { key: "peak", Title: "PEAK CONCURRENT", render: (row) => <span className="whitespace-nowrap">{row.peak}</span> },
    { key: "vapi", Title: "VAPI COSTS", render: (row) => <span className="whitespace-nowrap">{row.vapi}</span> },
    { key: "twilio", Title: "TWILIO ACCOUNT USAGE", render: (row) => <span className="whitespace-nowrap">{row.twilio}</span> },
    { key: "coverage", Title: "COVERAGE", render: (row) => row.coverageRender() }
  ];

  return (
    <div className="bg-[#161616] border border-[#262626] rounded-xl overflow-hidden mb-8">
      {/* Header */}
      <div className="p-6 pb-2 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-[18px] font-semibold text-white mb-1">Month by month</h2>
          <p className="text-[12px] text-gray-500">
            Calendar months in UTC - current month to date - blue: calls, orange: failures. Select a month to explore its tenants.
          </p>
        </div>
        <div className="flex items-center gap-3 text-[13px] text-gray-400">
          <span>Year</span>
          <div className="w-[100px] relative z-20">
            <Dropdown 
              options={["2026", "2025", "2024"]} 
              value={selectedYear}
              onSelect={(val) => setSelectedYear(val)}
              inputClass="!bg-[#111111] !border-[#333] !text-white !px-3 !py-1.5 !text-[13px] hover:!bg-[#1a1a1a] transition-colors"
              optionClass="!bg-[#1a1a1a] !border-[#333] !text-white !text-[13px]"
              icon="!text-gray-400 !right-2 !w-4 !h-4"
            />
          </div>
          <button 
            className="p-1.5 rounded-lg border border-[#333] hover:bg-[#262626] transition-colors text-gray-400"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <Icon icon="lucide:refresh-cw" className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {isFetching && (
        <div className="px-6 py-4">
          <p className="text-[13px] text-blue-500 font-medium" role="status">
            Loading monthly reports... {progress} months received.
          </p>
        </div>
      )}

      {(!reports || reports.length === 0) && !isFetching && (
        <div className="px-6 py-8 text-center">
          <p className="text-[13px] text-gray-500">No data available for the selected year.</p>
        </div>
      )}

      {reports && reports.length > 0 && (
        <>
          {/* Chart */}
          <div className="w-full h-[220px] px-6 pt-4 pb-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={displayChart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#262626" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#6b7280', fontSize: 11 }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#6b7280', fontSize: 11 }} 
                  dx={-10}
                />
                <Tooltip 
                  cursor={{ fill: '#262626', opacity: 0.4 }}
                  contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', borderRadius: '8px' }}
                  itemStyle={{ color: '#f3f4f6' }}
                />
                <Bar dataKey="calls" fill="#3b82f6" radius={[2, 2, 0, 0]} barSize={40} />
                <Bar dataKey="failures" fill="#f87171" radius={[2, 2, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Table via Component */}
          <div className="mt-4 border-t border-[#262626] overflow-x-auto">
            <Table 
              TableHeads={tableHeads} 
              TableRows={displayTable} 
              headClass="!bg-[#161616] !text-[10px] !text-gray-500 !tracking-wider !border-b !border-[#262626] uppercase !whitespace-nowrap"
              tableClass="!bg-[#161616] !border-none"
            />
          </div>
        </>
      )}

      {/* Footer */}
      <div className="px-6 py-5 bg-[#161616] flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-t border-[#262626]">
        <p className="text-[12px] text-gray-500 leading-relaxed max-w-2xl">
          Export includes all monthly summaries for the selected year.
        </p>
        <div className="flex items-center gap-3 shrink-0 relative z-10">
          <div className="w-[140px]">
            <Dropdown 
              options={["CSV", "JSON"]} 
              value={exportFormat}
              onSelect={(val) => setExportFormat(val)}
              inputClass="!bg-[#111111] !border-[#333] !text-white !px-4 !py-2 !text-[13px] hover:!bg-[#1a1a1a] transition-colors"
              optionClass="!bg-[#1a1a1a] !border-[#333] !text-white !text-[13px]"
              icon="!text-gray-400 !right-3 !w-4 !h-4"
            />
          </div>
          <button 
            onClick={handleExport}
            disabled={isFetching || !reports || reports.length === 0}
            className="bg-[#2563eb] hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-[13px] font-medium flex items-center gap-2 transition-colors"
          >
            <Icon icon="lucide:download" className="w-4 h-4" />
            Export full year data
          </button>
        </div>
      </div>
    </div>
  );
};

export default MonthByMonth;
