import React from "react";
import { Icon } from "@iconify/react";
import { Link } from "react-router-dom";

export default function OwnerLiveActivity({ liveCalls, agentsInUse, live }) {
  // Determine the time to show (use generatedAt if available, otherwise current time)
  const timeToFormat = live?.generatedAt ? new Date(live.generatedAt) : new Date();
  
  // Format to UK timezone
  const formattedTime = timeToFormat.toLocaleTimeString("en-GB", {
    timeZone: "Europe/London",
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  }).toUpperCase();

  return (
    <div className="bg-[#18181A] border border-gray-800/50 rounded-2xl mb-6 flex flex-col">
      <div className="p-6 flex flex-col lg:flex-row items-center gap-8 lg:gap-10">
        
        {/* Circular UI */}
        <div className="flex-shrink-0 w-36 h-36 rounded-full border-[3px] border-gray-800 flex flex-col items-center justify-center relative">
          <Icon icon="lucide:radio" className="text-white text-xl mb-1" />
          <span className="text-4xl font-bold text-white leading-none">{liveCalls}</span>
          <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mt-1">LIVE CALLS</span>
        </div>
        
        {/* Text and stats */}
        <div className="flex-1 w-full text-center lg:text-left">
          <div className="flex items-center justify-center lg:justify-start gap-2 mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0F42FF]"></span>
            <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">LIVE ACTIVITY</span>
          </div>
          <h2 className="text-2xl font-semibold text-white mb-1">
            {liveCalls > 0 ? `${liveCalls} live calls` : "No live calls"}
          </h2>
          <p className="text-gray-400 text-sm mb-6">Keep this page open. New calls appear automatically.</p>
          
          <div className="flex flex-wrap items-center justify-center lg:justify-start gap-6 text-sm text-gray-300">
            <span className="flex items-center gap-2"><Icon icon="lucide:bot" className="text-gray-500" /> {agentsInUse} agents in use</span>
            <span className="flex items-center gap-2"><Icon icon="lucide:phone" className="text-gray-500" /> {live?.summary?.ringing || 0} ringing</span>
            <span className="flex items-center gap-2"><Icon icon="lucide:users" className="text-gray-500" /> {live?.summary?.queued || 0} queued</span>
            <span className="flex items-center gap-2"><Icon icon="lucide:forward" className="text-gray-500" /> {live?.summary?.forwarding || 0} forwarded</span>
          </div>
        </div>
        
        {/* Button */}
        <div className="mt-4 lg:mt-0 lg:ml-auto">
          <Link to="/owner/call-summary" className="px-5 py-2.5 rounded-xl border border-gray-700 text-sm font-medium text-white hover:bg-gray-800 transition-colors flex items-center gap-2">
            Call summary <Icon icon="lucide:arrow-up-right" className="text-[12px]" />
          </Link>
        </div>
      </div>
      
      {/* Footer */}
      <div className="border-t border-gray-800/50 px-6 py-3 text-xs text-gray-500 font-medium">
        Last update {formattedTime}
      </div>
    </div>
  );
}
