import React, { useState, useEffect } from "react";
import { Icon } from "@iconify/react";
import { Link } from "react-router-dom";
import { UK_TIMEZONE } from "../utils/date";

export default function OwnerLiveActivity({ liveCalls, agentsInUse, live }) {
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Determine the time to show (use generatedAt if available, otherwise current time)
  const timeToFormat = live?.generatedAt ? new Date(live.generatedAt) : new Date();

  // Format to UK timezone (24-hour format matching screenshot e.g. 16:40:54)
  const formattedTime = timeToFormat.toLocaleTimeString("en-GB", {
    timeZone: UK_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const callsList = live?.calls || [];
  const hasLiveCalls = liveCalls > 0 || callsList.length > 0;

  const formatDuration = (call) => {
    let seconds = call.elapsedSeconds || 0;
    if (call.startedAt) {
      const start = new Date(call.startedAt).getTime();
      if (!isNaN(start)) {
        seconds = Math.max(0, Math.floor((currentTime - start) / 1000));
      }
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <div
      className={`bg-[#18181A] rounded-2xl mb-6 flex flex-col transition-all duration-300 ${
        hasLiveCalls
          ? "border border-[#2563EB]/50 shadow-[0_0_25px_rgba(37,99,235,0.08)]"
          : "border border-gray-800/50"
      }`}
    >
      {/* Top Banner Content */}
      <div className="p-6 sm:p-8 flex flex-col lg:flex-row items-center gap-8 lg:gap-10">
        {/* Circular UI */}
        <div
          className={`flex-shrink-0 w-36 h-36 rounded-full flex flex-col items-center justify-center relative transition-all duration-300 ${
            hasLiveCalls
              ? "border-[5px] border-[#2563EB]"
              : "border-[3px] border-gray-800"
          }`}
        >
          <Icon
            icon="lucide:radio"
            className="text-white text-xl mb-1"
          />
          <span className="text-4xl font-bold text-white leading-none">
            {liveCalls}
          </span>
          <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mt-1.5">
            LIVE CALLS
          </span>
        </div>

        {/* Text and stats */}
        <div className="flex-1 w-full text-center lg:text-left">
          <div className="flex items-center justify-center lg:justify-start gap-2 mb-2">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                hasLiveCalls ? "bg-[#38BDF8] animate-ping" : "bg-[#0F42FF]"
              }`}
            ></span>
            <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">
              LIVE ACTIVITY
            </span>
          </div>
          <h2 className="text-2xl font-semibold text-white mb-1">
            {hasLiveCalls
              ? liveCalls === 1
                ? "Live call"
                : `${liveCalls} live calls`
              : "No live calls"}
          </h2>
          <p className="text-gray-400 text-sm mb-6">
            {hasLiveCalls
              ? "Your agents are speaking with customers now."
              : "Keep this page open. New calls appear automatically."}
          </p>

          <div className="flex flex-wrap items-center justify-center lg:justify-start gap-6 text-sm text-gray-300">
            <span className="flex items-center gap-2">
              <Icon icon="lucide:bot" className="text-gray-500" />{" "}
              {agentsInUse} {agentsInUse === 1 ? "agent" : "agents"} in use
            </span>
            <span className="flex items-center gap-2">
              <Icon icon="lucide:phone" className="text-gray-500" />{" "}
              {live?.summary?.ringing || 0} ringing
            </span>
            <span className="flex items-center gap-2">
              <Icon icon="lucide:users" className="text-gray-500" />{" "}
              {live?.summary?.queued || 0} queued
            </span>
            <span className="flex items-center gap-2">
              <Icon icon="lucide:forward" className="text-gray-500" />{" "}
              {live?.summary?.forwarding || 0} forwarded
            </span>
          </div>
        </div>

        {/* Button */}
        <div className="mt-4 lg:mt-0 lg:ml-auto">
          <Link
            to="/owner/call-summary"
            className="px-5 py-2.5 rounded-xl border border-gray-700 text-sm font-medium text-white hover:bg-gray-800 transition-colors flex items-center gap-2"
          >
            Call summary <Icon icon="lucide:arrow-up-right" className="text-[12px]" />
          </Link>
        </div>
      </div>

      {/* Live Calls Table / List (Only shown when there are live calls) */}
      {hasLiveCalls && callsList.length > 0 && (
        <div className="border-t border-gray-800/60">
          {/* Table Header */}
          <div className="px-6 sm:px-8 py-3.5 grid grid-cols-12 text-xs font-medium text-gray-400 border-b border-gray-800/40">
            <div className="col-span-5 text-left">Agent</div>
            <div className="col-span-4 text-left">Call status</div>
            <div className="col-span-3 text-left">Duration</div>
          </div>

          {/* Table Rows */}
          <div className="divide-y divide-gray-800/30">
            {callsList.map((call, idx) => (
              <div
                key={call.id || idx}
                className="px-6 sm:px-8 py-4 grid grid-cols-12 items-center text-sm hover:bg-white/[0.02] transition-colors"
              >
                <div className="col-span-5 text-left font-medium text-white">
                  {call.agentName || "Voice Agent"}
                </div>
                <div className="col-span-4 text-left">
                  <span className="text-[#38BDF8] font-medium flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#38BDF8] animate-pulse"></span>
                    {call.status === "in-progress"
                      ? "Live call"
                      : call.status
                      ? call.status.charAt(0).toUpperCase() + call.status.slice(1)
                      : "Live call"}
                  </span>
                </div>
                <div className="col-span-3 text-left font-mono text-white/90">
                  {formatDuration(call)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-gray-800/50 px-6 sm:px-8 py-3 flex items-center justify-between text-xs text-gray-500 font-medium">
        <span>Updates every 5 seconds · your business only</span>
        <span>Last update {formattedTime}</span>
      </div>
    </div>
  );
}
