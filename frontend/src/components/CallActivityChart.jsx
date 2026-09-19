import React, { useMemo, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';
import { UK_TIMEZONE } from '../utils/date';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#1e2330] border border-[#2e3646] p-3 rounded-xl shadow-lg min-w-[120px]">
        <p className="text-[14px] font-semibold text-white mb-2">{label}</p>
        <p className="text-[14px] text-[#5e8cf2] mb-1">
          calls : {payload[0]?.value || 0}
        </p>
        <p className="text-[14px] text-[#e3716a]">
          failed : {payload[1]?.value || 0}
        </p>
      </div>
    );
  }
  return null;
};

const CallActivityChart = ({ calls = [], failedCalls = [], period, daily = [], weekly = [] }) => {
  const [viewMode, setViewMode] = useState('daily'); // 'daily' | 'weekly'

  const data = useMemo(() => {
    // 1. If daily or weekly series is passed (Owner Dashboard)
    const series = viewMode === 'weekly' ? (weekly?.length ? weekly : daily) : daily;
    if (series && series.length > 0) {
      return series.map((row) => {
        const d = new Date(row.date);
        let name = row.date;
        if (!isNaN(d.getTime())) {
          name = d.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            timeZone: UK_TIMEZONE,
          });
        }
        return {
          name,
          calls: Number(row.calls) || 0,
          failures: Number(row.failed ?? row.failures ?? 0),
        };
      });
    }

    // 2. If raw calls and failedCalls are passed (OverviewTabContent / System Owner)
    const map = {};

    if (period?.start && period?.end) {
      const startDate = new Date(period.start);
      const endDate = new Date(period.end);
      startDate.setUTCHours(0, 0, 0, 0);
      endDate.setUTCHours(0, 0, 0, 0);

      // Pre-fill all dates in range with 0 calls/failures
      for (let d = new Date(startDate); d <= endDate; d.setUTCDate(d.getUTCDate() + 1)) {
        const dateStr = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: UK_TIMEZONE });
        map[dateStr] = { name: dateStr, calls: 0, failures: 0, time: d.getTime() };
      }
    }

    const process = (arr, isFailure) => {
      (arr || []).forEach(c => {
        const d = new Date(c.startedAt || c.createdAt);
        if (isNaN(d.getTime())) return;
        const dateStr = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: UK_TIMEZONE });
        
        if (!map[dateStr]) {
          map[dateStr] = { name: dateStr, calls: 0, failures: 0, time: d.getTime() };
        }
        
        if (isFailure) map[dateStr].failures += 1;
        else map[dateStr].calls += 1;
      });
    };
    
    process(calls, false);
    process(failedCalls, true);
    
    const sortedDates = Object.values(map).sort((a, b) => a.time - b.time);
    if (sortedDates.length > 0) return sortedDates;

    // 3. Clean real fallback (last 7 days with 0 calls - no fake dummy numbers!)
    const fallback = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: UK_TIMEZONE });
      fallback.push({ name: dateStr, calls: 0, failures: 0 });
    }
    return fallback;
  }, [daily, weekly, viewMode, calls, failedCalls, period]);
  
  return (
    <div className="bg-[#161616] border border-[#262626] rounded-xl p-6 h-full flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h2 className="text-[18px] font-semibold text-white mb-1">Call activity</h2>
          <p className="text-[13px] text-gray-400">Your call volume over the selected period</p>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          {/* Daily / Weekly toggle if both exist */}
          {daily?.length > 0 && weekly?.length > 0 && (
            <div className="flex items-center bg-[#111111] p-0.5 rounded-lg border border-[#262626] text-xs">
              <button
                type="button"
                onClick={() => setViewMode('daily')}
                className={`px-3 py-1 rounded-md font-medium transition-all ${
                  viewMode === 'daily'
                    ? 'bg-[#2563EB] text-white shadow'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Daily
              </button>
              <button
                type="button"
                onClick={() => setViewMode('weekly')}
                className={`px-3 py-1 rounded-md font-medium transition-all ${
                  viewMode === 'weekly'
                    ? 'bg-[#2563EB] text-white shadow'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Weekly
              </button>
            </div>
          )}

          {/* Legend */}
          <div className="flex items-center gap-4 text-[11px] text-gray-400">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-[#3b82f6]"></div>
              <span>Calls</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-[#f87171]"></div>
              <span>Failures</span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex-1 w-full h-[250px] -ml-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorCalls" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#262626" strokeDasharray="3 3" />
            <XAxis 
              dataKey="name" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#6b7280', fontSize: 11 }} 
              dy={10}
              minTickGap={20}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#6b7280', fontSize: 11 }} 
              allowDecimals={false}
              domain={[0, 'auto']}
              dx={-10}
            />
            <Tooltip 
              content={<CustomTooltip />}
              cursor={{ stroke: '#fff', strokeWidth: 1.5, opacity: 0.8 }}
            />
            <Area 
              type="monotone" 
              dataKey="calls" 
              stroke="#3b82f6" 
              strokeWidth={2}
              fillOpacity={1} 
              fill="url(#colorCalls)" 
            />
            <Area 
              type="monotone" 
              dataKey="failures" 
              stroke="#f87171" 
              strokeWidth={1.5}
              fillOpacity={0} 
              fill="none" 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default CallActivityChart;
