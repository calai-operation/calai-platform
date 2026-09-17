import React from "react";

export default function OverallPerformanceReport({ insights }) {
  const orders = insights?.orders || {};
  
  // Calculate averages from daily data for duration and calls
  const daily = insights?.daily || [];
  const totalCallsIn28Days = daily.reduce((sum, d) => sum + Number(d.calls || 0), 0);
  const totalMinutesIn28Days = daily.reduce((sum, d) => sum + Number(d.minutes || 0), 0);
  
  const avgCallDuration = totalCallsIn28Days > 0 
    ? (totalMinutesIn28Days / totalCallsIn28Days).toFixed(1) 
    : "0.0";

  const ordersPer100Calls = totalCallsIn28Days > 0 
    ? Math.round((Number(orders.total || 0) / totalCallsIn28Days) * 100) 
    : 0;

  const currencySymbol = orders.currency === "GBP" ? "£" : (orders.currency === "USD" ? "$" : "£");
  const avgOrderValue = Number(orders.average || 0).toFixed(2);
  const unpricedCount = orders.unpriced || 0;

  return (
    <div className="bg-[#18181A] border border-gray-800/50 rounded-2xl p-6 h-full flex flex-col justify-between">
      <div>
        <h2 className="text-xl font-semibold text-white mb-1">Overall report</h2>
        <p className="text-gray-400 text-sm mb-6">All-time business performance</p>

        <div className="space-y-4 text-sm">
          <div className="flex justify-between items-center py-2 border-b border-gray-800/50">
            <span className="text-gray-400">Average order value</span>
            <span className="text-white font-medium text-base">{currencySymbol}{avgOrderValue}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-800/50">
            <span className="text-gray-400">Orders today</span>
            <span className="text-white font-medium text-base">{orders.today || 0}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-800/50">
            <span className="text-gray-400">Failed calls</span>
            <span className="text-white font-medium text-base">{insights?.failedCalls || 0}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-800/50">
            <span className="text-gray-400">Average call duration</span>
            <span className="text-white font-medium text-base">{avgCallDuration} min</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-800/50">
            <span className="text-gray-400">Orders per 100 calls</span>
            <span className="text-white font-medium text-base">{ordersPer100Calls}</span>
          </div>
        </div>
      </div>

      <div className="mt-8 pt-4 border-t border-gray-800/50">
        <p className="text-[11px] leading-relaxed text-gray-500">
          Order values use recorded prices in {orders.currency || "GBP"}, as in your order list. They do not confirm payment. {unpricedCount} unpriced orders are excluded from value and average.
        </p>
      </div>
    </div>
  );
}
