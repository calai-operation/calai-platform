import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import useAxiosSecure from "./useAxiosSecure";
import { useSystemDashboard } from "./useSystemDashboard";
import toast from "react-hot-toast";
import { getUKToday } from "../utils/date";

export const useViewTenant = (id) => {
  const axiosSecure = useAxiosSecure();
  const queryClient = useQueryClient();

  const today = getUKToday();
  const [period, setPeriod] = useState({
    start: today.slice(0, 7) + "-01",
    end: today,
  });

  // 1. System Dashboard Operations & Live data (Usage & Printer)
  const { operationsData, liveData, isFetchingOperations, lastUpdated } =
    useSystemDashboard(period.start, period.end);

  const liveTenant = liveData?.tenants?.find((t) => t.id === id) || {};
  const opTenant = operationsData?.tenants?.find((t) => t.id === id) || {};
  const tenantDetails = opTenant;

  const tenantCalls = (operationsData?.calls || []).filter(
    (row) => row.tenantId === id
  );
  const tenantFailedCalls = (operationsData?.failedCalls || []).filter(
    (row) => row.tenantId === id
  );

  // 2. Tenant Profile Details
  const {
    data: tenantResponse,
    isLoading: isTenantLoading,
    isError,
    error,
    refetch: refetchTenant,
  } = useQuery({
    queryKey: ["tenant", id],
    enabled: !!id,
    queryFn: async () => {
      const res = await axiosSecure.get(`/system-owner/tenants/${id}`);
      return res.data;
    },
  });

  const tenant = tenantResponse?.data;

  // 3. Tenant Agents
  const {
    data: agentsResponse,
    isLoading: isAgentsLoading,
    refetch: refetchAgents,
  } = useQuery({
    queryKey: ["tenantAgents", id],
    enabled: !!id,
    queryFn: async () => {
      const res = await axiosSecure.get(
        `/system-owner/individual-tenant/${id}/agents`
      );
      return res.data;
    },
  });

  const agentsData =
    agentsResponse?.data || tenant?.agents || liveTenant?.agents || [];

  // 4. Tenant Billing History
  const {
    data: billingResponse,
    isLoading: isBillingLoading,
    refetch: refetchBilling,
  } = useQuery({
    queryKey: ["tenantBilling", id],
    enabled: !!id,
    queryFn: async () => {
      const res = await axiosSecure.get(
        `/system-owner/individual-tenant/${id}/billing`
      );
      return res.data;
    },
  });

  const billingData = billingResponse?.data || tenant?.billingHistory || [];

  // 5. Tenant Calls History
  const {
    data: callsResponse,
    isLoading: isCallsLoading,
    refetch: refetchCalls,
  } = useQuery({
    queryKey: ["tenantCalls", id],
    enabled: !!id,
    queryFn: async () => {
      const res = await axiosSecure.get(
        `/system-owner/individual-tenant/${id}/calls`
      );
      return res.data;
    },
  });

  const callsData =
    callsResponse?.data || tenant?.calls || tenant?.callSummaries || [];

  // 6. Tenant Orders
  const {
    data: ordersResponse,
    isLoading: isOrdersLoading,
    refetch: refetchOrders,
  } = useQuery({
    queryKey: ["tenantOrders", id],
    enabled: !!id,
    queryFn: async () => {
      const res = await axiosSecure.get(
        `/system-owner/individual-tenant/${id}/orders`
      );
      return res.data;
    },
  });

  const ordersData = ordersResponse?.data || tenant?.orders || [];

  // 7. Delete Agent Mutation
  const deleteAgentMutation = useMutation({
    mutationFn: async (agentId) => {
      const res = await axiosSecure.delete(`/system-owner/agent/${agentId}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["tenantAgents", id]);
      toast.success("Agent deleted successfully");
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || "Failed to delete agent");
    },
  });

  // 8. Print Order
  const printOrder = async (orderId) => {
    if (!orderId) return;
    const toastId = toast.loading("Sending to printer...");
    try {
      await axiosSecure.get(`/business-owner/order/download/${orderId}`);
      toast.dismiss(toastId);
      toast.success("Order sent to printer successfully!");
    } catch (err) {
      console.error(err);
      toast.dismiss(toastId);
      const errorMessage =
        err.response?.data?.message ||
        "Failed to print. Please check your printer connection.";
      toast.error(errorMessage);
    }
  };

  // 9. Download Order Receipt
  const downloadOrderReceipt = async (orderId) => {
    if (!orderId) return;
    try {
      const toastId = toast.loading("Downloading receipt...");
      const res = await axiosSecure.get(
        `/business-owner/order/download-receipt/${orderId}`,
        {
          responseType: "text",
        }
      );
      const url = window.URL.createObjectURL(
        new Blob([res.data], { type: "text/plain" })
      );
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `Receipt_${orderId}.txt`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      toast.success("Download complete", { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error("Failed to download receipt.");
    }
  };

  return {
    today,
    tenant,
    agentsList: agentsData,
    agentsData,
    billingData,
    callsData,
    ordersData,
    liveTenant,
    opTenant,
    tenantDetails,
    calls: tenantCalls,
    failedCalls: tenantFailedCalls,
    period,
    setPeriod,
    isFetchingOperations,
    lastUpdated,
    isLoading: isTenantLoading,
    isAgentsLoading,
    isBillingLoading,
    isCallsLoading,
    isOrdersLoading,
    isError,
    error,
    deleteAgentMutation,
    printOrder,
    downloadOrderReceipt,
    refetchTenant,
    refetchAgents,
    refetchBilling,
    refetchCalls,
    refetchOrders,
  };
};

export default useViewTenant;
