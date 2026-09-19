import React from "react";
import { useParams, Link } from "react-router-dom";
import { Icon } from "@iconify/react";
import TenantCallUsageSection from "../../components/TenantCallUsageSection";
import TenantResourceTabs from "../../components/TenantResourceTabs";
import { useViewTenant } from "../../hooks/useViewTenant";

const formatPrinterLastSeen = (dateString) => {
  if (!dateString) return "No heartbeat recorded";
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return "No heartbeat recorded";
  const day = d.toLocaleString("en-GB", { day: "numeric", timeZone: "Europe/London" });
  const month = d.toLocaleString("en-GB", { month: "short", timeZone: "Europe/London" });
  const year = d.toLocaleString("en-GB", { year: "numeric", timeZone: "Europe/London" });
  const time = d.toLocaleString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
  return `Last seen ${day} ${month} ${year}, ${time}`;
};

const ViewTenant = () => {
  const { id } = useParams();
  const viewTenantData = useViewTenant(id);
  const {
    tenant,
    agentsList,
    liveTenant,
    opTenant,
    isLoading,
    isError,
    error,
  } = viewTenantData;

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

  const totalAgentsCount = agentsList.length;
  const activeAgentsCount = agentsList.filter(
    (a) => (a.status || "").toLowerCase() === "active"
  ).length;

  const usedMinutes =
    tenant.usage?.used !== undefined ? tenant.usage.used : (opTenant?.usage?.used ?? 0);
  const allowanceMinutes =
    tenant.usage?.total || tenant.usage?.allowance || (opTenant?.minuteLimit ?? 0);
  const remainingMinutes =
    tenant.usage?.remaining !== undefined
      ? tenant.usage.remaining
      : Math.max(0, allowanceMinutes - usedMinutes);

  const percentUsed =
    allowanceMinutes > 0
      ? Math.min(100, Math.round((usedMinutes / allowanceMinutes) * 100))
      : 0;
  const progressWidth = percentUsed;

  const statusLower = tenant.status?.toLowerCase() || "active";

  const joinedDate = tenant.joined_date
    ? new Date(tenant.joined_date).toLocaleDateString("en-GB", {
        timeZone: "Europe/London",
      })
    : (tenant.createdAt
      ? new Date(tenant.createdAt).toLocaleDateString("en-GB", {
          timeZone: "Europe/London",
        })
      : "N/A");

  const tenantInitials = tenant.name
    ? tenant.name.substring(0, 2).toUpperCase()
    : "TE";

  const tenantPrinters =
    (tenant.printers && tenant.printers.length > 0)
      ? tenant.printers
      : (liveTenant?.printers && liveTenant.printers.length > 0)
        ? liveTenant.printers
        : (opTenant?.printers && opTenant.printers.length > 0)
          ? opTenant.printers
          : [];

  const hasPrinter = tenantPrinters.length > 0;
  const primaryPrinter = hasPrinter ? tenantPrinters[0] : null;

  const printerName = hasPrinter
    ? (primaryPrinter.name || primaryPrinter.deviceName || "Printer")
    : "No printer connected";

  const isPrinterOnline =
    hasPrinter && (primaryPrinter.status || "").toLowerCase() === "online";

  const printerLastSeenText = hasPrinter
    ? formatPrinterLastSeen(primaryPrinter.lastSeen)
    : "No printer configured for this tenant";

  const pendingJobs = tenant.printJobs?.pending ?? opTenant?.printJobs?.pending ?? 0;
  const failedJobs = tenant.printJobs?.failed ?? opTenant?.printJobs?.failed ?? 0;

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
                    !hasPrinter
                      ? "bg-[#1e293b] border border-[#334155] text-gray-400"
                      : isPrinterOnline
                      ? "bg-[#0B2519] border border-[#164832] text-[#4ADE80]"
                      : "bg-[#281515] border border-[#481E1E] text-[#F87171]"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      !hasPrinter
                        ? "bg-gray-400"
                        : isPrinterOnline
                        ? "bg-[#4ADE80]"
                        : "bg-[#F87171]"
                    }`}
                  />
                  {!hasPrinter ? "not connected" : isPrinterOnline ? "online" : "offline"}
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

      <TenantCallUsageSection tenant={tenant} viewTenantData={viewTenantData} />
      <TenantResourceTabs tenant={tenant} id={id} viewTenantData={viewTenantData} />
    </div>
  );
};

export default ViewTenant;
