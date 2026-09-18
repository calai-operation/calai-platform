import React from "react";
import { useParams, Link } from "react-router-dom";
import { Icon } from "@iconify/react";
import TenantCallUsageSection from "../../components/TenantCallUsageSection";
import TenantResourceTabs from "../../components/TenantResourceTabs";
import { useQuery } from "@tanstack/react-query";
import useAxiosSecure from "../../hooks/useAxiosSecure";

const formatPrinterLastSeen = (dateString) => {
  if (!dateString) return "Last seen 16 Sept 2026, 13:17 UTC";
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return "Last seen 16 Sept 2026, 13:17 UTC";
  const day = d.getUTCDate();
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sept",
    "Oct",
    "Nov",
    "Dec",
  ];
  const month = months[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  const hours = String(d.getUTCHours()).padStart(2, "0");
  const minutes = String(d.getUTCMinutes()).padStart(2, "0");
  return `Last seen ${day} ${month} ${year}, ${hours}:${minutes} UTC`;
};

const ViewTenant = () => {
  const { id } = useParams();
  const axiosSecure = useAxiosSecure();

  const {
    data: tenantResponse,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["tenant", id],
    queryFn: async () => {
      const res = await axiosSecure.get(`/system-owner/tenants/${id}`);
      return res.data;
    },
  });

  const { data: agentsResponse } = useQuery({
    queryKey: ["tenantAgents", id],
    queryFn: async () => {
      const res = await axiosSecure.get(
        `/system-owner/individual-tenant/${id}/agents`
      );
      return res.data;
    },
  });

  const tenant = tenantResponse?.data;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-white">
        Loading...
      </div>
    );
  }

  if (isError || !tenant) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-red-500">
        <h2 className="text-2xl font-bold mb-2">Tenant not found</h2>
        <p>
          {error?.response?.data?.message ||
            error?.message ||
            "Failed to fetch tenant"}
        </p>
      </div>
    );
  }

  const agentsList = agentsResponse?.data || tenant.agents || [];
  const totalAgentsCount =
    agentsList.length > 0 ? agentsList.length : 1;
  const activeAgentsCount =
    agentsList.length > 0
      ? agentsList.filter(
          (a) => (a.status || "active").toLowerCase() === "active"
        ).length
      : 1;

  const usedMinutes =
    tenant.usage?.used !== undefined ? tenant.usage.used : 46.3;
  const allowanceMinutes =
    tenant.usage?.total || tenant.usage?.allowance || 25;
  const remainingMinutes =
    tenant.usage?.remaining !== undefined ? tenant.usage.remaining : 0;

  const percentUsed =
    allowanceMinutes > 0
      ? Math.min(100, Math.round((usedMinutes / allowanceMinutes) * 100))
      : 100;
  const progressWidth = percentUsed;

  const statusLower = tenant.status?.toLowerCase() || "active";

  const joinedDate = tenant.joined_date
    ? new Date(tenant.joined_date).toLocaleDateString("en-GB")
    : "09/09/2026";

  const tenantInitials = tenant.name
    ? tenant.name.substring(0, 2).toUpperCase()
    : "TE";

  const primaryPrinter = tenant.printers?.[0] || {};
  const printerName =
    primaryPrinter.name || primaryPrinter.deviceName || "Home Print";
  const isPrinterOnline =
    (primaryPrinter.status || "").toLowerCase() === "online";
  const printerLastSeenText = formatPrinterLastSeen(primaryPrinter.lastSeen);
  const pendingJobs = tenant.printJobs?.pending ?? 0;
  const failedJobs = tenant.printJobs?.failed ?? 0;

  return (
    <div className="space-y-6">
      {/* Back Navigation Link */}
      <div>
        <Link
          to="/admin/tenant-management"
          className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors group"
        >
          <Icon
            icon="lucide:arrow-left"
            className="w-4 h-4 transition-transform group-hover:-translate-x-0.5"
          />
          <span>Tenant Management</span>
        </Link>
      </div>

      {/* Tenant Profile Full-Width Card */}
      <div className="bg-[#161616] rounded-xl p-6 border border-[#262626]">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">
          TENANT PROFILE
        </p>

        <div className="flex items-center gap-4 mb-6">
          {tenant.image || tenant.profile_picture ? (
            <img
              src={tenant.image || tenant.profile_picture}
              alt={tenant.name}
              className="w-14 h-14 rounded-xl object-cover border border-[#1e293b]"
            />
          ) : (
            <div className="w-14 h-14 rounded-xl bg-[#0B1729] border border-[#1e293b] flex items-center justify-center text-[#38BDF8] text-xl font-bold shrink-0">
              {tenantInitials}
            </div>
          )}

          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white mb-1.5">
              {tenant.name || "Unknown Name"}
            </h1>
            <div>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  statusLower === "active"
                    ? "bg-[#0B2519] border border-[#164832] text-[#4ADE80]"
                    : "bg-[#281515] border border-[#481E1E] text-[#F87171]"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    statusLower === "active" ? "bg-[#4ADE80]" : "bg-[#F87171]"
                  }`}
                />
                {statusLower}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-6 sm:gap-8 pt-4 border-t border-[#262626]/60 text-gray-300 text-xs sm:text-[13px]">
          <div className="flex items-center gap-2">
            <Icon icon="lucide:mail" className="text-base text-[#38BDF8]" />
            <span>{tenant.email || "N/A"}</span>
          </div>
          <div className="flex items-center gap-2">
            <Icon icon="lucide:phone" className="text-base text-[#38BDF8]" />
            <span>{tenant.phone || "N/A"}</span>
          </div>
          <div className="flex items-center gap-2">
            <Icon icon="lucide:calendar" className="text-base text-[#38BDF8]" />
            <span>Joined {joinedDate}</span>
          </div>
          <div className="flex items-center gap-2">
            <Icon icon="lucide:bot" className="text-base text-[#38BDF8]" />
            <span>
              {activeAgentsCount} active agents · {totalAgentsCount} total
            </span>
          </div>
        </div>
      </div>

      {/* Usage Overview and Printer Connection 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Usage Overview Card */}
        <div className="bg-[#161616] rounded-xl p-6 border border-[#262626] flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-[17px] font-bold text-white">
                  Usage overview
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Existing subscription allowance and recorded usage
                </p>
              </div>
              <Icon
                icon="lucide:clock"
                className="w-5 h-5 text-gray-400 shrink-0"
              />
            </div>

            <div className="flex items-baseline justify-between mb-2">
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
                  {usedMinutes}
                </span>
                <span className="text-xs sm:text-sm text-gray-400 font-normal">
                  min used
                </span>
              </div>
              <div className="text-xs sm:text-sm text-gray-400 font-medium">
                {allowanceMinutes} min allowance
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-[#262626] h-2 rounded-full overflow-hidden my-3">
              <div
                className="bg-[#3B82F6] h-full rounded-full transition-all duration-500"
                style={{ width: `${progressWidth}%` }}
              />
            </div>

            <div className="flex justify-between items-center text-xs text-gray-400">
              <span>{remainingMinutes} min remaining</span>
              <span>{percentUsed}% used</span>
            </div>
          </div>
        </div>

        {/* Printer Connection Card */}
        <div className="bg-[#161616] rounded-xl p-6 border border-[#262626] flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-[17px] font-bold text-white">
                  Printer connection
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Latest connection status for this tenant
                </p>
              </div>
              <Icon
                icon="lucide:printer"
                className="w-5 h-5 text-gray-400 shrink-0"
              />
            </div>

            {/* Printer Info Row */}
            <div className="flex items-center justify-between py-1">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg border border-[#262626] bg-[#1a1a1a] flex items-center justify-center text-gray-300 shrink-0">
                  <Icon icon="lucide:printer" className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">
                    {printerName}
                  </div>
                  <div className="text-[12px] text-gray-400 mt-0.5">
                    {printerLastSeenText}
                  </div>
                </div>
              </div>

              <div>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium ${
                    isPrinterOnline
                      ? "bg-[#0B2519] border border-[#164832] text-[#4ADE80]"
                      : "bg-[#281515] border border-[#481E1E] text-[#F87171]"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isPrinterOnline ? "bg-[#4ADE80]" : "bg-[#F87171]"
                    }`}
                  />
                  {isPrinterOnline ? "online" : "offline"}
                </span>
              </div>
            </div>
          </div>

          <div className="text-[12px] text-gray-400 mt-6">
            {pendingJobs} pending jobs · {failedJobs} failed jobs. Online
            requires a heartbeat within 60 seconds.
          </div>
        </div>
      </div>

      <TenantCallUsageSection tenant={tenant} />
      <TenantResourceTabs tenant={tenant} id={id} />
    </div>
  );
};

export default ViewTenant;
