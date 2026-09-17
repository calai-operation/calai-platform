import React, { useState, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Icon } from '@iconify/react';

export default function CallActivityChart({ daily = [], weekly = [] }) {
  const [view, setView] = useState('daily'); // 'daily' or 'weekly'
  const [metric, setMetric] = useState('calls'); // 'calls' or 'minutes'
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  const data = useMemo(() => {
    const rawData = view === 'daily' ? daily : weekly;
    return rawData.map(item => ({
      ...item,
      // Format date for the X-axis (e.g., "9 Sept")
      formattedDate: new Date(item.date).toLocaleDateString("en-GB", { 
        day: 'numeric', 
        month: 'short' 
      })
    }));
  }, [daily, weekly, view]);

  const totalInView = data.reduce((sum, item) => sum + Number(item[metric] || 0), 0);
  const totalFormatted = metric === 'minutes' ? totalInView.toFixed(0) : totalInView;
  
  return (
    <div className="bg-[#18181A] border border-gray-800/50 rounded-2xl p-6 h-full flex flex-col relative">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-8">
        <div>
          <h2 className="text-xl font-semibold text-white mb-1">Call activity</h2>
          <p className="text-gray-400 text-sm">Last {view === 'daily' ? '28 days' : '12 weeks'} · UTC</p>
        </div>
        
        {/* Controls */}
        <div className="flex items-center gap-3 mt-4 sm:mt-0">
          <div className="relative">
            <div 
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="bg-[#262626] border border-gray-700/50 rounded-lg px-3 py-1.5 flex items-center justify-between gap-2 cursor-pointer text-sm text-gray-300 min-w-[90px] select-none"
            >
              <span className="capitalize">{metric}</span>
              <Icon icon="lucide:chevron-down" className="text-gray-500 w-4 h-4" />
            </div>
            
            {isDropdownOpen && (
              <div className="absolute top-full right-0 mt-2 w-full bg-[#262626] border border-gray-700/50 rounded-lg shadow-lg overflow-hidden z-20">
                <div 
                  onClick={() => { setMetric('calls'); setIsDropdownOpen(false); }}
                  className="px-3 py-2 text-sm text-gray-300 hover:bg-gray-700/50 hover:text-white cursor-pointer transition-colors"
                >
                  Calls
                </div>
                <div 
                  onClick={() => { setMetric('minutes'); setIsDropdownOpen(false); }}
                  className="px-3 py-2 text-sm text-gray-300 hover:bg-gray-700/50 hover:text-white cursor-pointer transition-colors"
                >
                  Minutes
                </div>
              </div>
            )}
          </div>
          
          <div className="bg-[#262626] p-1 rounded-lg flex text-sm font-medium">
            <button 
              onClick={() => setView('daily')}
              className={`px-4 py-1 rounded-md transition-colors ${view === 'daily' ? 'bg-[#2563EB] text-white' : 'text-gray-400 hover:text-white'}`}
            >
              Daily
            </button>
            <button 
              onClick={() => setView('weekly')}
              className={`px-4 py-1 rounded-md transition-colors ${view === 'weekly' ? 'bg-[#2563EB] text-white' : 'text-gray-400 hover:text-white'}`}
            >
              Weekly
            </button>
          </div>
        </div>
      </div>
      
      {/* Total Metric */}
      <div className="mb-6 flex items-baseline gap-2">
        <span className="text-4xl font-bold text-white">{totalFormatted}</span>
        <span className="text-gray-400 text-sm">{metric} in this view</span>
      </div>

      {/* Chart */}
      <div className="flex-1 w-full h-[250px] min-h-[250px] -ml-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorCalls" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2563EB" stopOpacity={0.4}/>
                <stop offset="95%" stopColor="#2563EB" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#333" opacity={0.5} />
            <XAxis 
              dataKey="formattedDate" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#9CA3AF', fontSize: 12 }} 
              dy={10}
              minTickGap={20}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#9CA3AF', fontSize: 12 }} 
            />
            <Tooltip 
              contentStyle={{ backgroundColor: '#18181A', borderColor: '#333', borderRadius: '8px', color: '#fff' }}
              itemStyle={{ color: '#fff' }}
            />
            <Area 
              type="monotone" 
              dataKey={metric} 
              stroke="#2563EB" 
              strokeWidth={2}
              fillOpacity={1} 
              fill="url(#colorCalls)" 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Footer text */}
      <div className="mt-6 pt-4 border-t border-gray-800/50">
        <p className="text-[11px] text-gray-500">The current day or week is still in progress.</p>
      </div>
    </div>
  );
}
