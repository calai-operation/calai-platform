import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const COLORS = {
  active: '#10b981',    // green
  suspended: '#ef4444', // red
  trial: '#f59e0b',     // yellow
  expired: '#6b7280'    // gray
};

const TenantDistribution = ({ data: apiData }) => {
  const data = useMemo(() => {
    return (apiData || [
      { status: 'active', percentage: 65, count: 45 },
      { status: 'trial', percentage: 20, count: 14 },
      { status: 'suspended', percentage: 10, count: 7 },
      { status: 'expired', percentage: 5, count: 4 }
    ]).map((item) => ({
      name: item.status.charAt(0).toUpperCase() + item.status.slice(1),
      value: item.percentage || item.value,
      count: item.count,
      color: COLORS[item.status.toLowerCase()] || '#8b5cf6'
    }));
  }, [apiData]);

  const hasData = data.some(d => d.value > 0);
  const renderData = hasData ? data.filter(d => d.value > 0) : [{ name: 'No Data', value: 100, color: '#262626' }];
  const totalCount = data.reduce((acc, curr) => acc + curr.count, 0);

  return (
    <div className="bg-[#161616] border border-[#262626] rounded-xl p-6 h-full flex flex-col">
      <div className="mb-6">
        <h2 className="text-[18px] font-semibold text-white mb-1">Tenant status</h2>
        <p className="text-[13px] text-gray-400">Distribution of tenant accounts</p>
      </div>
      
      <div className="flex-1 flex flex-col sm:flex-row items-center justify-between gap-8 sm:gap-4 mt-2">
        {/* Left: Donut Chart with Center Text */}
        <div className="relative w-[180px] h-[180px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={renderData}
                cx="50%"
                cy="50%"
                innerRadius={65}
                outerRadius={85}
                paddingAngle={4}
                cornerRadius={6}
                dataKey="value"
                stroke="none"
                isAnimationActive={true}
              >
                {renderData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ backgroundColor: '#161616', borderColor: '#262626', borderRadius: '8px', color: '#f3f4f6', fontSize: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5)' }}
                itemStyle={{ color: '#f3f4f6' }}
                formatter={(value, name) => [`${value}%`, name]}
              />
            </PieChart>
          </ResponsiveContainer>
          
          {/* Center Text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-3xl font-bold text-white leading-none">{totalCount}</span>
            <span className="text-[11px] text-gray-500 font-medium mt-1 uppercase tracking-wider">Tenants</span>
          </div>
        </div>

        {/* Right: Detailed Legend with Progress Bars */}
        <div className="flex-1 w-full flex flex-col justify-center gap-4">
          {data.map((entry, index) => (
            <div key={index} className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center text-[13px]">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color, boxShadow: `0 0 8px ${entry.color}66` }}></div>
                  <span className="text-gray-300 font-medium">{entry.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-white font-semibold">{entry.count}</span>
                  <span className="text-gray-500 w-8 text-right">{entry.value}%</span>
                </div>
              </div>
              {/* Progress Bar */}
              <div className="w-full h-1.5 bg-[#262626] rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all duration-1000 ease-out" 
                  style={{ width: `${entry.value}%`, backgroundColor: entry.color }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default TenantDistribution;