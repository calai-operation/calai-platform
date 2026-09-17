import React from 'react';

const DashboardTabs = ({ activeTab, setActiveTab, failedCallsCount = 0 }) => {
  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'call-log', label: 'Call log' },
    { id: 'failed-calls', label: 'Failed calls', badge: failedCallsCount },
    { id: 'printer-health', label: 'Printer health' },
    { id: 'provider-costs', label: 'Provider costs' },
  ];

  return (
    <div className="flex items-center gap-6 border-b border-[#262626] mb-6 overflow-x-auto hide-scrollbar">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`relative flex items-center gap-2 py-3 transition-colors whitespace-nowrap ${
            activeTab === tab.id 
              ? 'text-[#3b82f6] font-medium after:absolute after:bottom-[-1px] after:left-0 after:w-full after:h-[2px] after:bg-[#3b82f6]' 
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          {tab.label}
          {tab.badge && (
            <span className="bg-[#381B20] text-[#E74C3C] text-[11px] font-bold px-1.5 py-0.5 rounded-md">
              {tab.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
};

export default DashboardTabs;
