import React from 'react';
import { Icon } from '@iconify/react';

const ConnectedServices = () => {
  return (
    <div className="bg-[#161616] border border-[#262626] rounded-xl p-6 h-full flex flex-col">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h2 className="text-[18px] font-semibold text-white mb-1">Connected services</h2>
          <p className="text-[13px] text-gray-400">Reporting and runtime availability</p>
        </div>
        <div className="w-6 h-6 rounded-full bg-[#262626] flex items-center justify-center shrink-0">
          <Icon icon="lucide:shield-check" className="text-gray-400 w-3.5 h-3.5" />
        </div>
      </div>
      
      <div className="flex flex-col">
        {/* Twilio Row */}
        <div className="flex justify-between items-center py-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-[#381B20] text-[#E74C3C] flex items-center justify-center font-bold text-lg shrink-0">
              T
            </div>
            <div>
              <h3 className="text-[14px] font-semibold text-white mb-0.5">Twilio</h3>
              <p className="text-[12px] text-gray-400">Usage, call costs & failures</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 bg-[#06402b] text-[#22c55e] px-2.5 py-1 rounded-md text-[11px] font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]"></span>
            Connected
          </div>
        </div>

        <div className="h-[1px] w-full bg-[#262626]"></div>

        {/* Vapi Row */}
        <div className="flex justify-between items-center py-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-[#06402b] text-[#22c55e] flex items-center justify-center font-bold text-lg shrink-0">
              V
            </div>
            <div>
              <h3 className="text-[14px] font-semibold text-white mb-0.5">Vapi</h3>
              <p className="text-[12px] text-gray-400">Assistant activity & costs</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 bg-[#1e3a5f] text-[#3b82f6] px-2.5 py-1 rounded-md text-[11px] font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-[#3b82f6]"></span>
            Partial report
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConnectedServices;
