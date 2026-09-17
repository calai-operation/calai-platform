import React from 'react';
import Table from './Table';

const PrinterHealthTabContent = ({ tenants = [] }) => {

  const tableHeads = [
    { 
      key: "tenant", 
      Title: "TENANT",
      render: (row) => <span className="font-medium text-[13px] text-white whitespace-nowrap">{row.tenantName}</span>
    },
    { 
      key: "printer", 
      Title: "PRINTER", 
      render: (row) => <span className="font-medium text-[13px] text-white whitespace-nowrap">{row.printer}</span>
    },
    { 
      key: "connection", 
      Title: "CONNECTION",
      render: (row) => (
        <div 
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap"
          style={{ backgroundColor: row.statusBg, color: row.statusColor }}
        >
          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: row.statusColor }}></div>
          {row.status}
        </div>
      )
    },
    { 
      key: "lastSeen", 
      Title: "LAST SEEN (UTC)",
      render: (row) => <span className="whitespace-nowrap text-[13px] font-medium text-white">{row.lastSeen}</span>
    },
    { 
      key: "pendingJobs", 
      Title: "TENANT PENDING JOBS",
      render: (row) => <span className="whitespace-nowrap text-[13px] font-medium text-white">{row.pendingJobs}</span>
    },
    { 
      key: "failedJobs", 
      Title: "TENANT FAILED JOBS",
      render: (row) => <span className="whitespace-nowrap text-[13px] font-medium text-white">{row.failedJobs}</span>
    }
  ];

  const formatDateTime = (dateString) => {
    if (!dateString) return '-';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '-';
    return `${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}, ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
  };

  const mappedPrinters = tenants.flatMap(t => 
    (t.printers || []).map(p => ({
      tenantName: t.name,
      printer: p.name,
      status: p.status === 'online' ? 'Online' : 'Offline',
      statusColor: p.status === 'online' ? '#4ade80' : '#f87171',
      statusBg: p.status === 'online' ? 'rgba(74, 222, 128, 0.1)' : 'rgba(248, 113, 113, 0.1)',
      lastSeen: formatDateTime(p.lastSeen),
      pendingJobs: t.printJobs?.pending?.toString() || '0',
      failedJobs: t.printJobs?.failed?.toString() || '0'
    }))
  );

  return (
    <div className="bg-[#161616] border border-[#262626] rounded-xl overflow-hidden mb-8">
      {/* Header */}
      <div className="p-6 pb-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#262626]">
        <div>
          <h2 className="text-[18px] font-semibold text-white mb-1">Printer health</h2>
          <p className="text-[12px] text-gray-500">
            Connection status by tenant - online requires a heartbeat within 60 seconds
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="w-full">
        <Table 
          TableHeads={tableHeads} 
          TableRows={mappedPrinters} 
          headClass="!bg-[#111111] !text-[10px] !text-gray-500 !tracking-wider !border-b !border-[#262626] uppercase !py-3 !whitespace-nowrap"
          tableClass="!bg-[#161616] !border-none"
        />
      </div>
    </div>
  );
};

export default PrinterHealthTabContent;
