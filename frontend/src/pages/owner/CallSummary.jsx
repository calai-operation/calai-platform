import React, { useState } from "react";
import { FileText, X, Bot, User, Download, Loader2, Search } from "lucide-react";
import Table from "../../components/Table";
import Breadcrumb from "../../components/Breadcrumb";
import Dropdown from "../../components/Dropdown";
import { useCallSummary } from "../../hooks/useCallSummary";

const CallSummary = () => {
  const { calls, isLoading, downloadPdf } = useCallSummary();
  const [modalState, setModalState] = useState({
    isOpen: false,
    type: null,
    data: null,
  });
  const [searchQuery, setSearchQuery] = useState("");

  const filteredCalls = calls.filter((call) => 
    call.callerId?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleActionSelect = (option, row) => {
    // option will be "Call Summary" or "Call Transcript"
    setModalState({ isOpen: true, type: option, data: row });
  };

  const handleDownload = () => {
    if (!modalState.data?.id) return;
    downloadPdf(modalState.data.id, modalState.type);
  };

  const columns = [
    { key: "callerId", Title: "Caller ID", width: "20%" },
    { key: "duration", Title: "Call Duration", width: "20%" },
    { key: "time", Title: "Time", width: "20%" },
    { key: "date", Title: "Date", width: "20%" },
    {
      key: "action",
      Title: "Summary",
      width: "20%",
      sortable: false,
      render: (row) => (
        <div className="relative w-[180px]">
          {/* Custom icon positioning over the dropdown */}
          <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
            <FileText className="w-4 h-4 text-white" />
          </div>
          <Dropdown
            placeholder="Summary"
            options={["Call Summary", "Call Transcript"]}
            onSelect={(val) => handleActionSelect(val, row)}
            inputClass="!bg-[#1A2255] !placeholder-white !border-none !text-white !rounded-[8px] !py-2.5 !pl-11 !pr-10 !font-medium !text-[13px] !shadow-none !cursor-pointer hover:!bg-[#232D70] transition-colors"
            optionClass="!bg-[#1A2255] !text-white !border border-[#2A3470] !rounded-[8px] !shadow-xl !mt-1.5"
            icon="!text-white !right-3"
          />
        </div>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div>
        <Breadcrumb text="You can see your AI call summary" />
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="animate-spin text-[#2563EB] w-10 h-10" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <Breadcrumb text="You can see your AI call summary" />
        
        {/* Search Bar */}
        <div className="w-full sm:w-auto">
          <div className="relative w-full sm:w-[300px]">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2 border border-[#2A2A2A] rounded-xl leading-5 bg-[#1A1A1A] text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#2563EB] focus:border-[#2563EB] sm:text-sm transition-colors"
              placeholder="Search by Caller ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="bg-[#191919] border border-[#1A1A1A] rounded-2xl shadow-sm overflow-hidden">
        {filteredCalls.length > 0 ? (
          <Table
            TableHeads={columns}
            TableRows={filteredCalls}
            headClass=" border-b border-[#1A1A1A] text-gray-200 whitespace-nowrap"
            tableClass="border-none"
          />
        ) : (
          <div className="p-8 text-center text-gray-400 text-sm">
            {searchQuery ? "No matching call summaries found." : "No call summaries found."}
          </div>
        )}
      </div>

      {/* Dynamic Modal */}
      {modalState.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 text-white">
          <div
            className={`bg-[#111111] border border-[#1A1A1A] rounded-[20px] w-full relative shadow-2xl flex flex-col ${modalState.type === "Call Transcript" ? "max-w-[550px]" : "max-w-[600px]"}`}
          >
            {/* Header */}
            <div className="px-8 py-6 border-b border-[#1A1A1A] flex justify-between items-center">
              <h2 className="text-[17px] font-medium text-gray-200">
                {modalState.type}
              </h2>
              <button
                onClick={() =>
                  setModalState({ isOpen: false, type: null, data: null })
                }
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Call Transcript Content */}
            {modalState.type === "Call Transcript" && (
              <div className="p-8 max-h-[500px] overflow-y-auto space-y-6 custom-scrollbar">
                {modalState.data?.transcript?.length > 0 ? (
                  modalState.data.transcript.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex items-start gap-4 ${msg.role === "User" ? "flex-row-reverse" : ""}`}
                    >
                      <div className="w-10 h-10 rounded-full bg-[#1A2255] flex items-center justify-center shrink-0">
                        {msg.role === "AI" ? (
                          <Bot className="w-5 h-5 text-emerald-400" />
                        ) : (
                          <User className="w-5 h-5 text-blue-300" />
                        )}
                      </div>
                      <div
                        className={`bg-[#1A1A1A] text-gray-200 px-5 py-3.5 rounded-2xl text-[15px] max-w-[80%] ${msg.role === "User" ? "rounded-tr-sm" : "rounded-tl-sm"}`}
                      >
                        {msg.content}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-gray-400">
                    No transcript available.
                  </div>
                )}
              </div>
            )}

            {/* Call Summary Content */}
            {modalState.type === "Call Summary" && (
              <div className="flex flex-col">
                <div className="p-8 max-h-[500px] overflow-y-auto custom-scrollbar">
                  <p className="text-gray-300 text-[15px] leading-[1.8] whitespace-pre-wrap">
                    {modalState.data?.summary || "No summary available."}
                  </p>
                </div>
              </div>
            )}

            {/* Footer Actions */}
            <div className="border-t border-[#1A1A1A] px-8 py-5 flex justify-end mt-auto">
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 bg-[#1A2255] hover:bg-[#232D70] transition-colors text-white px-6 py-2.5 rounded-[10px] text-[14px] font-medium cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Download
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CallSummary;
