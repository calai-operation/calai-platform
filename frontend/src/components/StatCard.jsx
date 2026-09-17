import React from 'react';
import { Icon } from '@iconify/react';

const StatCard = ({
  title,
  value,
  icon,
  iconBg = "bg-transparent",
  trend,
  trendText,
  prefixText,
  subtext,
  showArrow = true,
  isDanger = false,
  variant = "default",
}) => {
  const isHighlight = variant === "highlight";

  let bgClass = "bg-[#18181A] border-gray-800/50";
  let textClass = "text-gray-300";
  let iconColor = "text-[#0F42FF]";
  let valueClass = "text-white";
  let subtextClass = "text-gray-400";
  
  if (isDanger) {
    bgClass = "bg-[#1E1113] border-[#381B20]";
    textClass = "text-[#E74C3C]";
    iconColor = "text-[#E74C3C]";
    valueClass = "text-[#E74C3C]";
    subtextClass = "text-[#E74C3C]/80";
  } else if (isHighlight) {
    bgClass = "bg-[#0B1E32] border-[#1e3a5f]";
    iconColor = "text-[#3b82f6]";
    valueClass = "text-[#3b82f6]";
  }

  return (
    <div className={`relative overflow-hidden rounded-2xl p-5 border flex flex-col h-full transition-colors ${bgClass}`}>
      {/* Header */}
      <div className="flex items-center justify-between relative z-10 mb-2">
        <span className={`text-[14px] font-medium ${textClass}`}>{title}</span>
        <div className={`w-8 h-8 rounded-full flex items-center justify-end ${isDanger || isHighlight ? "bg-transparent" : iconBg}`}>
          <Icon icon={icon} className={`text-[18px] ${iconColor}`} />
        </div>
      </div>

      {/* Value */}
      <div className="mb-2 relative z-10">
        <h3 className={`text-[28px] leading-none font-semibold ${valueClass}`}>{value}</h3>
      </div>

      {/* Trend / Subtext */}
      <div className={`mt-auto pt-2 text-[12px] relative z-10 ${subtextClass}`}>
        {subtext ? (
          <span>{subtext}</span>
        ) : (
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
        )}
      </div>

      {/* Background Sparkline (only if not danger and it's a trend card) */}
      {!isDanger && !isHighlight && (
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

export default StatCard;
