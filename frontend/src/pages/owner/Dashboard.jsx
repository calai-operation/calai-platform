import React from "react";
import { Link } from "react-router-dom";
import { Icon } from "@iconify/react";
import CallActivityChart from "../../components/CallActivityChart";
import OverallPerformanceReport from "../../components/OverallPerformanceReport";
import { useOwnerDashboard } from "../../hooks/useOwnerDashboard";
import { formatUKDateTime } from "../../utils/date";

import OwnerLiveActivity from "../../components/OwnerLiveActivity";

const StatCard = ({
  title,
  value,
  icon,
  iconBg = "bg-[#262626]",
  trend,
  trendText,
  prefixText,
  showArrow = true,
  isDanger = false,
}) => {
  return (
    <div className={`relative overflow-hidden rounded-2xl p-4 border flex flex-col h-full transition-colors ${
      isDanger ? "bg-[#1E1113] border-[#381B20]" : "bg-[#18181A] border-gray-800/50"
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between relative z-10">
        <span className={`text-[15px] ${isDanger ? "text-[#E74C3C]" : "text-gray-300"}`}>{title}</span>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isDanger ? "bg-transparent" : iconBg}`}>
          <Icon icon={icon} className={`text-lg ${isDanger ? "text-[#E74C3C]" : "text-[#0F42FF]"}`} />
        </div>
      </div>

      {/* Value */}
      <div className="mt-4 mb-2 relative z-10">
        <h3 className={`text-3xl font-medium ${isDanger ? "text-[#E74C3C]" : "text-white"}`}>{value}</h3>
      </div>

      {/* Trend / Subtext */}
      <div className={`mt-auto text-xs relative z-10 ${isDanger ? "text-[#E74C3C]/80" : "text-gray-400"}`}>
        <div className="flex flex-wrap items-center gap-1">
          {prefixText && <span>{prefixText}</span>}
          {trend && (
            <span className="flex items-center gap-0.5 text-white">
              {trend} {showArrow && <Icon icon="lucide:arrow-up-right" className="text-[10px]" />}
            </span>
          )}
          {trend && <span>•</span>}
          <span>{trendText}</span>
        </div>
      </div>

      {/* Background Sparkline (only if not danger and it's a trend card) */}
      {!isDanger && (
        <div className="absolute bottom-0 left-0 w-full h-17 pointer-events-none opacity-80">
          <svg viewBox="0 0 200 50" preserveAspectRatio="none" className="w-full h-full">
            <defs>
              <linearGradient id={`gradient-${title.replace(/\s+/g, "-")}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2563EB" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d="M0,45 C30,45 40,15 65,15 C90,15 100,40 130,40 C155,40 170,20 185,20 C195,20 198,30 200,30 L200,50 L0,50 Z" fill={`url(#gradient-${title.replace(/\s+/g, "-")})`} />
            <path d="M0,45 C30,45 40,15 65,15 C90,15 100,40 130,40 C155,40 170,20 185,20 C195,20 198,30 200,30" fill="none" stroke="#0F42FF" strokeWidth="1.5" strokeOpacity="0.5" />
          </svg>
        </div>
      )}
    </div>
  );
};

export default function Dashboard() {
  const { stats, graphData, overallReport, insights, live, printers, isLoading } = useOwnerDashboard();

  const formatTrendText = (text, defaultText) => {
    if (!text) return defaultText;
    return text.replace(/([+-]?\d+\.?\d*)/, (match) => {
      const num = parseFloat(match);
      return Number.isInteger(num) ? num : num.toFixed(1);
    });
  };

  const remainingMinutes = stats?.usageOverview?.remainingMinutes ?? 0;
  const usedMinutes = stats?.usageOverview?.usedMinutes ?? 0;
  const totalLimitMinutes = stats?.usageOverview?.totalLimitMinutes ?? 0;
  const isOutOfMinutes = remainingMinutes <= 0;

  // Derive data from insights and live
  const totalOrders = insights?.orders?.total ?? stats?.totalOrder?.value ?? 0;
  const todayOrders = insights?.orders?.today ?? stats?.totalOrder?.today ?? 0;
  
  const orderValue = insights?.orders?.value ?? stats?.orderValue?.value ?? 0;
  const unpricedOrders = insights?.orders?.unpriced ?? stats?.orderValue?.noPriceCount ?? 0;
  const currencySymbol = insights?.orders?.currency === "GBP" ? "£" : (insights?.orders?.currency === "USD" ? "$" : "£");

  const liveCalls = live?.summary?.activeCalls ?? stats?.liveCalls?.value ?? 0;
  const agentsInUse = live?.summary?.agentsInUse ?? stats?.liveCalls?.agentsInUse ?? 0;

  // Printer status calculations
  const totalPrinters = printers?.length || 0;
  const offlinePrinters = printers?.filter(p => p.status?.toLowerCase() !== "online") || [];
  const onlinePrinters = printers?.filter(p => p.status?.toLowerCase() === "online") || [];
  const hasOffline = offlinePrinters.length > 0;
  const isPrinterConnected = totalPrinters > 0 && !hasOffline;

  // Safely get today's calls from insights daily array
  const todayCalls = insights?.daily && insights.daily.length > 0 
    ? insights.daily[insights.daily.length - 1].calls 
    : (stats?.todayTotalCall?.today ?? 0);

  const totalCalls = insights?.daily 
    ? insights.daily.reduce((sum, day) => sum + day.calls, 0) 
    : (stats?.todayTotalCall?.value ?? 0);

  const statsData = [
    {
      title: "Total orders",
      value: totalOrders,
      icon: "lucide:shopping-bag",
      iconBg: "bg-transparent",
      trend: stats?.totalOrder?.change ?? "0%",
      trendText: stats?.totalOrder?.weeklyChange ?? "+0 this week",
      prefixText: `${todayOrders} today`,
      showArrow: true
    },
    {
      title: "Order value",
      value: `${currencySymbol}${Number(orderValue).toFixed(2)}`,
      icon: "lucide:pound-sterling",
      iconBg: "bg-transparent",
      trend: "",
      trendText: "recorded value",
      prefixText: `${unpricedOrders} orders without a price`,
      showArrow: false
    },
    {
      title: "Total calls",
      value: totalCalls,
      icon: "lucide:phone",
      iconBg: "bg-transparent",
      trend: stats?.todayTotalCall?.change ?? "0%",
      trendText: stats?.todayTotalCall?.weeklyChange ?? "+0 this week",
      prefixText: `${todayCalls} today`,
      showArrow: true
    },
    {
      title: "Live calls",
      value: liveCalls,
      icon: "lucide:radio",
      iconBg: "bg-transparent",
      trend: "",
      trendText: "right now",
      prefixText: `${agentsInUse} agents in use`,
      showArrow: false
    },
    {
      title: "Total call duration",
      value: stats?.totalCallDuration?.value || "0 hr 0 min",
      icon: "lucide:clock",
      iconBg: "bg-transparent",
      trend: stats?.totalCallDuration?.change || "0%",
      trendText: formatTrendText(
        stats?.totalCallDuration?.weeklyChange,
        "0 min this week"
      ),
      showArrow: true
    },
    {
      title: "Remaining minutes",
      value: `${remainingMinutes.toFixed(2)} min`,
      icon: "lucide:clock",
      iconBg: "bg-transparent",
      trend: "",
      trendText: remainingMinutes <= 0 ? "No minutes remaining" : `${usedMinutes.toFixed(2)} min used`,
      showArrow: false,
      isDanger: remainingMinutes <= 0
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Icon
          icon="lucide:loader-2"
          className="animate-spin text-[#2563EB]"
          width="40"
        />
      </div>
    );
  }

  return (
    <div>
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-white">Dashboard</h1>
        <p className="text-gray-400 text-sm mt-1">Your orders, conversations and live activity in one place.</p>
      </div>

      {/* Live Activity Banner */}
      <OwnerLiveActivity 
        liveCalls={liveCalls} 
        agentsInUse={agentsInUse} 
        live={live} 
      />

      {/* Disconnected / Unconfigured Printer Warning Banner (Only shown when printer is NOT connected or offline) */}
      {!isPrinterConnected && (
        <div className="bg-[#1E1113] border border-[#381B20] rounded-2xl p-4 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-[#E74C3C]/10 border border-[#E74C3C]/20 flex items-center justify-center flex-shrink-0">
              <Icon icon="lucide:printer" className="text-[#E74C3C] text-2xl" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-[#E74C3C] font-semibold text-[15px]">
                  Printer not connected
                </h4>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#E74C3C]/15 text-[#E74C3C] border border-[#E74C3C]/30 uppercase tracking-wide">
                  {totalPrinters === 0 ? "Not Configured" : "Offline"}
                </span>
              </div>
              <div className="text-[#E74C3C]/80 text-xs mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                {totalPrinters === 0 ? (
                  <span className="text-gray-400">
                    No printer configured • Connect your thermal receipt printer to automatically print incoming orders.
                  </span>
                ) : (
                  <>
                    <span className="font-medium text-white/90">
                      {offlinePrinters.map(p => p.deviceName || p.device_name || "Unknown Printer").join(", ")}
                    </span>
                    {offlinePrinters[0]?.ipAddress && (
                      <span className="text-gray-400">
                        • IP: {offlinePrinters[0].ipAddress}
                      </span>
                    )}
                    <span className="text-gray-400">
                      • Last seen: {offlinePrinters[0]?.lastSeen ? formatUKDateTime(offlinePrinters[0].lastSeen) : "Never"}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          <Link
            to="/owner/printer"
            className="text-sm font-medium text-[#E74C3C] hover:underline hover:text-[#E74C3C]/80 flex items-center gap-1.5 flex-shrink-0 self-end sm:self-center"
          >
            {totalPrinters === 0 ? "Connect printer" : "Check printer"} <Icon icon="lucide:arrow-up-right" className="text-xs" />
          </Link>
        </div>
      )}

      <div className="grid grid-cols-12 gap-5 mb-5">
        {statsData.map((stat, index) => (
          <div key={index} className="col-span-12 sm:col-span-6 lg:col-span-4">
            <StatCard {...stat} />
          </div>
        ))}
      </div>

      {isOutOfMinutes && (
        <div className="bg-[#1E1113] border border-[#381B20] rounded-xl p-4 mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Icon icon="lucide:clock" className="text-[#E74C3C] text-xl" />
            <div>
              <h4 className="text-[#E74C3C] font-semibold text-sm">You have no minutes remaining</h4>
              <p className="text-[#E74C3C]/70 text-xs mt-0.5">{usedMinutes.toFixed(0)} minutes used • {totalLimitMinutes} plan minutes</p>
            </div>
          </div>
          <a href="/owner/settings" className="text-sm font-medium text-white hover:underline flex items-center gap-1">
            View subscription <Icon icon="lucide:arrow-up-right" className="text-[12px]" />
          </a>
        </div>
      )}

      {/* Performance Overview Section */}
      <div className="mt-8 mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white">Performance overview</h2>
          <p className="text-gray-400 text-sm mt-1">Call trends and the value of your orders.</p>
        </div>
        <a href="/owner/order-list" className="text-sm font-medium text-[#2563EB] hover:text-[#3B82F6] flex items-center gap-1 transition-colors">
          View orders <Icon icon="lucide:arrow-up-right" className="text-[12px]" />
        </a>
      </div>

      <div className="grid grid-cols-12 gap-5 mb-5">
        <div className="col-span-12 md:col-span-12 lg:col-span-8">
          <CallActivityChart daily={insights?.daily} weekly={insights?.weekly} />
        </div>

        <div className="col-span-12 md:col-span-12 lg:col-span-4">
          <OverallPerformanceReport insights={insights} />
        </div>
      </div>
    </div>
  );
}
