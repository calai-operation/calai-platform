import React, { useEffect } from 'react';
import { Icon } from '@iconify/react';
import { Link } from 'react-router-dom';

const formatCurrency = (amount, currency = 'USD', decimals = 3) => {
  if (amount == null) return '—';
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(amount);
};

const TenantDetailSlideOver = ({ tenant, isOpen, onClose, setActiveTab }) => {
  // Prevent body scrolling when slide-over is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen || !tenant) return null;

  // Safe data extraction based on assumed structure
  const planName = tenant.plan || 'Unknown';
  const statusName = tenant.status ? (tenant.status.charAt(0).toUpperCase() + tenant.status.slice(1)) : 'Unknown';
  const minutes = tenant.minutes != null ? tenant.minutes.toFixed(1) : '0.0';
  const peakConcurrency = tenant.peak || 0;

  // Vapi Costs
  const vapiCost = tenant.costs?.vapi?.USD || 0;
  const vapiCalls = tenant.callCount || 0;
  const vapiPricedCall = vapiCalls > 0 ? (vapiCost / vapiCalls) : 0;
  const vapiMeasuredMinute = tenant.minutes > 0 ? (vapiCost / tenant.minutes) : 0;

  // Twilio Costs
  const twilioCost = tenant.costs?.twilio?.GBP || 0;
  const twilioCalls = tenant.callCount || 0;
  const twilioPricedLeg = twilioCalls > 0 ? (twilioCost / twilioCalls) : 0;
  const twilioMeasuredMinute = tenant.minutes > 0 ? (twilioCost / tenant.minutes) : 0;

  // Vapi Breakdown
  const breakdown = tenant.components || {};
  const transport = breakdown.transport || 0;
  const transcription = breakdown.stt || 0;
  const languageModel = breakdown.llm || 0;
  const voiceGeneration = breakdown.tts || 0;
  const vapiPlatform = breakdown.vapi || 0;
  const chat = breakdown.chat || 0;
  const knowledgeBase = breakdown.knowledgeBaseCost || 0;
  const voicemailDetection = breakdown.voicemailDetectionCost || 0;

  // Other stats
  let paidInvoiceRevenue = 0;
  if (typeof tenant.revenue === 'number') {
    paidInvoiceRevenue = tenant.revenue;
  } else if (tenant.revenue?.GBP != null) {
    paidInvoiceRevenue = tenant.revenue.GBP;
  } else if (tenant.revenueGBP != null) {
    paidInvoiceRevenue = tenant.revenueGBP;
  }
  const callTransfers = tenant.transfers || 0;
  const failedCalls = tenant.failures || tenant.failedCalls || 0;
  const failedCallsPercent = vapiCalls > 0 ? Math.round((failedCalls / vapiCalls) * 100) : 0;
  const averageLatency = tenant.latencyMs || 'Not available';
  const additionalFailedTwilioLegs = tenant.failedTwilioLegs || 0;
  const planMinuteAllowance = tenant.minuteLimit || '—';

  return (
    <>
      {/* Dark overlay backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 z-[100] transition-opacity" 
        onClick={onClose}
      />
      
      {/* Slide-over panel */}
      <div className={`fixed inset-y-0 right-0 z-[110] w-full max-w-[480px] bg-[#161616] border-l border-[#262626] shadow-2xl flex flex-col h-full transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'} overflow-y-auto`}>
        
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <p className="text-[10px] font-bold text-gray-500 tracking-wider mb-2 uppercase">Tenant Detail</p>
              <h2 className="text-2xl font-semibold text-white mb-4">{tenant.name || 'Unknown'}</h2>
              
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5 bg-[#1B2926] text-emerald-500 text-[11px] font-bold px-2.5 py-1 rounded-md">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  {statusName}
                </span>
                {tenant.status?.toLowerCase() === 'active' && (
                  <Link to={`/admin/tenant-management/view/${tenant.id || ''}`} className="bg-[#2563eb] hover:bg-blue-600 text-white px-3 py-1.5 rounded-md text-[13px] font-medium flex items-center gap-2 transition-colors">
                    Open tenant
                    <Icon icon="lucide:arrow-up-right" className="w-4 h-4" />
                  </Link>
                )}
              </div>
            </div>
            
            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-1">
              <Icon icon="lucide:x" className="w-5 h-5" />
            </button>
          </div>

          {/* Cards */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-[#1a1a1a] border border-[#262626] rounded-xl p-4">
              <div className="flex justify-between items-start mb-2">
                <span className="text-[13px] text-gray-400">Minutes</span>
                <Icon icon="lucide:clock" className="w-4 h-4 text-[#3b82f6]" />
              </div>
              <div className="text-2xl font-semibold text-white mb-2">{minutes}</div>
              <div className="text-[12px] text-gray-500">{planName}</div>
            </div>
            
            <div className="bg-[#1a1a1a] border border-[#262626] rounded-xl p-4">
              <div className="flex justify-between items-start mb-2">
                <span className="text-[13px] text-gray-400">Period peak concurrency</span>
                <Icon icon="lucide:activity" className="w-4 h-4 text-[#3b82f6]" />
              </div>
              <div className="text-2xl font-semibold text-white mb-2">{peakConcurrency}</div>
              <div className="text-[12px] text-gray-500">Available calls in selected dates</div>
            </div>
          </div>

          {/* Costs & unit economics */}
          <h3 className="text-[15px] font-semibold text-white mb-4">Costs & unit economics</h3>
          
          <div className="space-y-4 mb-4">
            {/* Vapi Box */}
            <div className="bg-[#1a1a1a] border border-[#262626] rounded-xl p-4">
              <div className="text-[13px] font-semibold text-[#3b82f6] mb-3">Vapi</div>
              <div className="space-y-2">
                <div className="flex justify-between items-center text-[13px]">
                  <span className="text-gray-400">Cost</span>
                  <span className="text-white">{formatCurrency(vapiCost, 'USD')}</span>
                </div>
                <div className="flex justify-between items-center text-[13px]">
                  <span className="text-gray-400">Per priced call</span>
                  <span className="text-white">{formatCurrency(vapiPricedCall, 'USD')}</span>
                </div>
                <div className="flex justify-between items-center text-[13px]">
                  <span className="text-gray-400">Per measured minute</span>
                  <span className="text-white">{formatCurrency(vapiMeasuredMinute, 'USD')}</span>
                </div>
              </div>
            </div>

            {/* Twilio Box */}
            <div className="bg-[#1a1a1a] border border-[#262626] rounded-xl p-4">
              <div className="text-[13px] font-semibold text-[#3b82f6] mb-3">Twilio</div>
              <div className="space-y-2">
                <div className="flex justify-between items-center text-[13px]">
                  <span className="text-gray-400">Cost</span>
                  <span className="text-white">{formatCurrency(twilioCost, 'GBP')}</span>
                </div>
                <div className="flex justify-between items-center text-[13px]">
                  <span className="text-gray-400">Per priced leg</span>
                  <span className="text-white">{formatCurrency(twilioPricedLeg, 'GBP')}</span>
                </div>
                <div className="flex justify-between items-center text-[13px]">
                  <span className="text-gray-400">Per measured minute</span>
                  <span className="text-white">{formatCurrency(twilioMeasuredMinute, 'GBP')}</span>
                </div>
              </div>
            </div>
          </div>

          <p className="text-[12px] text-gray-500 leading-relaxed mb-8">
            0 calls have incomplete costs; {tenant.callCount || 0} have unknown duration. Vapi unit costs use priced calls;
            per-minute figures use only calls with both a known price and measured duration.
          </p>

          {/* Vapi cost breakdown */}
          <h3 className="text-[15px] font-semibold text-white mb-4">Vapi cost breakdown (USD)</h3>
          
          <div className="divide-y divide-[#262626] border-b border-[#262626] mb-4">
            <div className="flex justify-between items-center py-3 text-[13px]">
              <span className="text-gray-400">Transport</span>
              <span className="text-white font-medium">{formatCurrency(transport, 'USD')}</span>
            </div>
            <div className="flex justify-between items-center py-3 text-[13px]">
              <span className="text-gray-400">Transcription</span>
              <span className="text-white font-medium">{formatCurrency(transcription, 'USD')}</span>
            </div>
            <div className="flex justify-between items-center py-3 text-[13px]">
              <span className="text-gray-400">Language model</span>
              <span className="text-white font-medium">{formatCurrency(languageModel, 'USD')}</span>
            </div>
            <div className="flex justify-between items-center py-3 text-[13px]">
              <span className="text-gray-400">Voice generation</span>
              <span className="text-white font-medium">{formatCurrency(voiceGeneration, 'USD')}</span>
            </div>
            <div className="flex justify-between items-center py-3 text-[13px]">
              <span className="text-gray-400">Vapi platform</span>
              <span className="text-white font-medium">{formatCurrency(vapiPlatform, 'USD')}</span>
            </div>
            <div className="flex justify-between items-center py-3 text-[13px]">
              <span className="text-gray-400">Chat</span>
              <span className="text-white font-medium">{formatCurrency(chat, 'USD')}</span>
            </div>
            <div className="flex justify-between items-center py-3 text-[13px]">
              <span className="text-gray-400">Knowledge base</span>
              <span className="text-white font-medium">{formatCurrency(knowledgeBase, 'USD')}</span>
            </div>
            <div className="flex justify-between items-center py-3 text-[13px]">
              <span className="text-gray-400">Voicemail detection</span>
              <span className="text-white font-medium">{formatCurrency(voicemailDetection, 'USD')}</span>
            </div>
          </div>

          <p className="text-[12px] text-gray-500 mb-8">
            Reported components can be incomplete. The provider call total remains authoritative.
          </p>

          {/* Stats List */}
          <div className="divide-y divide-[#262626] border-b border-[#262626] mb-8">
            <div className="flex justify-between items-center py-3 text-[13px]">
              <span className="text-gray-400">Paid invoice revenue</span>
              <span className="text-white font-medium">≈ {formatCurrency(paidInvoiceRevenue, 'GBP', 2)}</span>
            </div>
            <div className="flex justify-between items-center py-3 text-[13px]">
              <span className="text-gray-400">Call transfers</span>
              <span className="text-white font-medium">{callTransfers}</span>
            </div>
            <div className="flex justify-between items-center py-3 text-[13px]">
              <span className="text-gray-400">Failed calls</span>
              <span className="text-white font-medium">{failedCalls} {failedCalls > 0 ? `(${failedCallsPercent}%)` : ''}</span>
            </div>
            <div className="flex justify-between items-center py-3 text-[13px]">
              <span className="text-gray-400">Average first-audio latency</span>
              <span className="text-white font-medium">{averageLatency}</span>
            </div>
            <div className="flex justify-between items-center py-3 text-[13px]">
              <span className="text-gray-400">Additional failed Twilio legs</span>
              <span className="text-white font-medium">{additionalFailedTwilioLegs}</span>
            </div>
            <div className="flex justify-between items-center py-3 text-[13px]">
              <span className="text-gray-400">Plan minute allowance</span>
              <span className="text-white font-medium">{planMinuteAllowance}</span>
            </div>
          </div>

          {/* Printers */}
          <h3 className="text-[15px] font-semibold text-white mb-4">Printers</h3>
          
          <div className="space-y-3 mb-8">
            {tenant.printers && tenant.printers.length > 0 ? (
              tenant.printers.map((printer, idx) => (
                <div key={idx} className="flex justify-between items-center border-b border-[#262626] pb-3 last:border-0 last:pb-0">
                  <div className="flex items-start gap-3">
                    <Icon icon="lucide:printer" className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <div className="text-[13px] font-medium text-white">{printer.name || 'Unknown Printer'}</div>
                      <div className="text-[11px] text-gray-500">Last seen {printer.lastSeen || 'Unknown'} UTC</div>
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 ${printer.status === 'offline' ? 'bg-[#381B20] text-[#E74C3C]' : 'bg-[#1B2926] text-emerald-500'} text-[11px] font-bold px-2.5 py-1 rounded-md`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${printer.status === 'offline' ? 'bg-[#E74C3C]' : 'bg-emerald-500'}`}></span>
                    {printer.status === 'offline' ? 'Offline' : 'Online'}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-[13px] text-gray-500">No printers associated with this tenant.</div>
            )}
          </div>

          {/* Bottom Action Buttons */}
          <div className="flex flex-col gap-3">
            <button 
              onClick={() => {
                if (setActiveTab) setActiveTab('call-log');
                onClose();
              }}
              className="bg-[#2563eb] hover:bg-blue-600 text-white px-4 py-2.5 rounded-lg text-[13px] font-medium flex items-center justify-center gap-2 transition-colors w-full"
            >
              View call log
              <Icon icon="lucide:arrow-up-right" className="w-4 h-4" />
            </button>
            <button 
              onClick={() => {
                if (setActiveTab) setActiveTab('failed-calls');
                onClose();
              }}
              className="bg-[#2563eb] hover:bg-blue-600 text-white px-4 py-2.5 rounded-lg text-[13px] font-medium flex items-center justify-center gap-2 transition-colors w-full"
            >
              View failed calls
              <Icon icon="lucide:arrow-up-right" className="w-4 h-4" />
            </button>
          </div>

        </div>
      </div>
    </>
  );
};

export default TenantDetailSlideOver;
