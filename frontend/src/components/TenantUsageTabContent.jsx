import React from 'react';

const TenantUsageTabContent = ({ tenant }) => {
  const formatAmount = (amountObj, fallbackCurrency = 'USD') => {
    if (amountObj == null) return fallbackCurrency === 'USD' ? 'US$0.00' : '£0.00';
    
    let currency = fallbackCurrency;
    let value = amountObj;

    if (typeof amountObj === 'object') {
      const entries = Object.entries(amountObj);
      if (entries.length === 0) return fallbackCurrency === 'USD' ? 'US$0.00' : '£0.00';
      currency = entries[0][0];
      value = entries[0][1];
    }

    const formatted = new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currency,
      maximumFractionDigits: 3
    }).format(value);

    // Fix USUS$ issue by matching specific prefixes
    if (currency === 'USD') {
      // Intl format might yield US$0.10 or $0.10 depending on locale settings
      // We want to force $
      return formatted.replace(/^US\$/, '$');
    }
    
    return formatted;
  };

  const vapiComponents = [
    { key: 'transport', label: 'Transport' },
    { key: 'stt', label: 'Transcription' },
    { key: 'llm', label: 'Language model' },
    { key: 'tts', label: 'Voice generation' },
    { key: 'vapi', label: 'Vapi platform' },
    { key: 'chat', label: 'Chat' },
    { key: 'knowledgeBaseCost', label: 'Knowledge base' },
    { key: 'voicemailDetectionCost', label: 'Voicemail detection' }
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
      {/* Vapi Cost Detail */}
      <div className="bg-[#161616] rounded-xl border border-[#262626] p-6 flex flex-col">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-lg font-semibold text-white mb-1">Vapi cost detail</h2>
            <p className="text-[13px] text-gray-400">Assistant call costs · USD</p>
          </div>
          <span className="bg-[#262626] text-gray-300 text-[11px] font-medium px-2 py-0.5 rounded-md uppercase tracking-wider">
            {tenant?.providerStatus?.vapi || 'partial'}
          </span>
        </div>

        <div className="flex-1 space-y-0 border-t border-[#262626]">
          <div className="flex justify-between items-center py-4 border-b border-[#262626]">
            <span className="text-[13px] text-gray-400">Per priced call</span>
            <strong className="text-[14px] text-white font-semibold">
              {formatAmount(tenant?.costPerCall?.vapi, 'USD')}
            </strong>
          </div>
          <div className="flex justify-between items-center py-4 border-b border-[#262626]">
            <span className="text-[13px] text-gray-400">Per measured minute</span>
            <strong className="text-[14px] text-white font-semibold">
              {formatAmount(tenant?.costPerMinute?.vapi, 'USD')}
            </strong>
          </div>

          {vapiComponents.map((comp) => (
            <div key={comp.key} className="flex justify-between items-center py-4 border-b border-[#262626]">
              <span className="text-[13px] text-gray-400">{comp.label}</span>
              <strong className="text-[14px] text-white font-semibold">
                {formatAmount(tenant?.components?.[comp.key], 'USD')}
              </strong>
            </div>
          ))}
        </div>

        <p className="text-[12px] text-gray-500 mt-6 leading-relaxed">
          Unit costs use priced records; per-minute figures also require measured duration. Reported components may be incomplete.
        </p>
      </div>

      {/* Twilio Cost Detail */}
      <div className="bg-[#161616] rounded-xl border border-[#262626] p-6 flex flex-col">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-lg font-semibold text-white mb-1">Twilio cost detail</h2>
            <p className="text-[13px] text-gray-400">Matched call leg costs · provider currency</p>
          </div>
          <span className="bg-[#262626] text-[#4285F4] border border-[#4285F4]/30 text-[11px] font-medium px-2 py-0.5 rounded-md uppercase tracking-wider">
            {tenant?.providerStatus?.twilio || 'connected'}
          </span>
        </div>

        <div className="flex-1 space-y-0 border-t border-[#262626]">
          <div className="flex justify-between items-center py-4 border-b border-[#262626]">
            <span className="text-[13px] text-gray-400">Per priced call leg</span>
            <strong className="text-[14px] text-white font-semibold">
              {formatAmount(tenant?.costPerCall?.twilio, 'GBP')}
            </strong>
          </div>
          <div className="flex justify-between items-center py-4 border-b border-[#262626]">
            <span className="text-[13px] text-gray-400">Per measured minute</span>
            <strong className="text-[14px] text-white font-semibold">
              {formatAmount(tenant?.costPerMinute?.twilio, 'GBP')}
            </strong>
          </div>
        </div>

        <p className="text-[12px] text-gray-500 mt-6 leading-relaxed">
          Tenant call charges are part of the Twilio account total. Number rental and other shared charges are not allocated without an explicit link.
        </p>
      </div>
    </div>
  );
};

export default TenantUsageTabContent;
