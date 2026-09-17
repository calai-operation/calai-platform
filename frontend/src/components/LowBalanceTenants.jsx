import React from 'react';

const LowBalanceTenants = ({ threshold = 61, count = 0 }) => {
  return (
    <div className="bg-[#161616] border border-[#262626] rounded-xl overflow-hidden mt-8 mb-6 p-6">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="text-[15px] font-semibold text-white mb-1">
            Tenants below {threshold} minutes
          </h3>
          <p className="text-[13px] text-gray-400">
            Current active plans · lowest balances first · independent of report dates
          </p>
        </div>
        <div className="text-[13px] font-bold text-white">
          {count} tenants
        </div>
      </div>
      
      <div className="border-t border-[#262626] pt-6">
        {count === 0 ? (
          <p className="text-[13px] text-gray-400">
            No active tenants have fewer than {threshold} minutes remaining.
          </p>
        ) : (
          <p className="text-[13px] text-gray-400">
            {count} tenants found with low balance.
          </p>
        )}
      </div>
    </div>
  );
};

export default LowBalanceTenants;
