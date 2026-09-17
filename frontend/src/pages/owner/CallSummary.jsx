import { useState } from "react";
import { FileText, X, Bot, User, Download, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import useAxiosSecure from "../../hooks/useAxiosSecure";
import toast from "react-hot-toast";
import Table from "../../components/Table";
import Breadcrumb from "../../components/Breadcrumb";
import "./RecordPages.css";

const CallSummary = () => {
  const axiosSecure = useAxiosSecure();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [modalState, setModalState] = useState({
    isOpen: false,
    type: null,
    data: null,
  });

  const { data: callsResponse, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["callSummaries"],
    queryFn: async () => {
      const res = await axiosSecure.get("/business-owner/call-summary");
      return res.data;
    },
  });

  const calls = callsResponse?.data || [];
  const filteredCalls = calls.filter(call =>
    (filter === 'all' || (filter === 'summary' ? Boolean(call.summary) : Boolean(call.transcript?.length))) &&
    [call.callerId, call.duration, call.time, call.date].some(value => String(value ?? '').toLowerCase().includes(search.trim().toLowerCase()))
  );

  const handleActionSelect = (option, row) => {
    // option will be "Call Summary" or "Call Transcript"
    setModalState({ isOpen: true, type: option, data: row });
  };

  const handleDownload = async () => {
    if (!modalState.data?.id) return;
    try {
      const toastId = toast.loading("Downloading PDF...");
      const res = await axiosSecure.get(
        `/business-owner/call-summary/download/${modalState.data.id}`,
        {
          responseType: "blob",
        },
      );
      const url = window.URL.createObjectURL(
        new Blob([res.data], { type: "application/pdf" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `Call_${modalState.type.replace(/\s+/g, "_")}_${modalState.data.id}.pdf`,
      );
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      toast.success("Download complete", { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error("Failed to download PDF");
    }
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
        <div className="record-actions">
          <button className="record-action" onClick={() => handleActionSelect('Call Summary', row)}><FileText size={15} />Summary</button>
          <button className="record-action" onClick={() => handleActionSelect('Call Transcript', row)}>Transcript</button>
        </div>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div>
        <Breadcrumb text="Find conversations, read summaries and transcripts, and download your call records." />
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="animate-spin text-[#2563EB] w-10 h-10" />
        </div>
      </div>
    );
  }

  return (
    <div className="calai-records">
      <Breadcrumb text="Find conversations, read summaries and transcripts, and download your call records." />

      <div className="record-toolbar">
        <label className="record-search">Search calls<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Caller, date, time or duration…" /></label>
        <label>Available content<select value={filter} onChange={event => setFilter(event.target.value)}><option value="all">All calls</option><option value="summary">With summary</option><option value="transcript">With transcript</option></select></label>
        <button className="record-action" onClick={() => refetch()} disabled={isFetching}>{isFetching ? 'Refreshing…' : 'Refresh'}</button>
      </div>
      <div className="record-caption"><span>{isError ? 'Calls unavailable' : `${filteredCalls.length} of ${calls.length} calls`}</span><span>Sort by any column heading</span></div>
      {isError && <p role="alert" className="record-error">Calls could not be loaded. Use Refresh to try again.</p>}
      <div className="record-panel">
        {calls.length > 0 ? (
          <Table
            TableHeads={columns}
            TableRows={filteredCalls}
            emptyState={<div className="record-empty">No calls match your search or filter.</div>}
            headClass=" border-b border-[#1A1A1A] text-gray-200 whitespace-nowrap"
            tableClass="border-none"
            wrapperClass="overflow-x-auto"
          />
        ) : (
          <div className="p-8 text-center text-gray-400 text-sm">
            No call summaries found.
          </div>
        )}
      </div>

      {/* Dynamic Modal */}
      {modalState.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 text-white">
          <div
            role="dialog" aria-modal="true" aria-label={modalState.type}
            className={`record-dialog bg-[#111111] border border-[#1A1A1A] rounded-[20px] w-full relative shadow-2xl flex flex-col ${modalState.type === "Call Transcript" ? "max-w-[550px]" : "max-w-[600px]"}`}
          >
            {/* Header */}
            <div className="px-8 py-6 border-b border-[#1A1A1A] flex justify-between items-center">
              <h2 className="text-[17px] font-medium text-gray-200">
                {modalState.type}
              </h2>
              <button
                aria-label="Close call details"
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
