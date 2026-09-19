import { useQuery } from "@tanstack/react-query";
import useAxiosSecure from "./useAxiosSecure";

export const useAdminSubscription = () => {
  const axiosSecure = useAxiosSecure();

  // 1. Fetch Subscription Plans
  const {
    data: plansResponse,
    isLoading: isPlansLoading,
    isError: isPlansError,
    error: plansError,
    refetch: refetchPlans,
  } = useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      const res = await axiosSecure.get(
        "/system-owner/subscription-billing/plans"
      );
      return res.data;
    },
  });

  const rawPlans = Array.isArray(plansResponse?.data) ? plansResponse.data : [];
  const plans = [...rawPlans].sort((a, b) => {
    if (a.name?.toLowerCase() === "enterprise") return 1;
    if (b.name?.toLowerCase() === "enterprise") return -1;
    return 0;
  });

  // 2. Fetch Billings & Stats
  const {
    data: billingsResponse,
    isLoading: isBillingsLoading,
    isError: isBillingsError,
    error: billingsError,
    refetch: refetchBillings,
  } = useQuery({
    queryKey: ["billings"],
    queryFn: async () => {
      const res = await axiosSecure.get(
        "/system-owner/subscription-billing/billings"
      );
      return res.data;
    },
  });

  const billingsData = billingsResponse?.data || {
    stats: {},
    recent_invoices: [],
  };
  const apiStats = billingsData.stats || {};
  const recentInvoices = billingsData.recent_invoices || [];

  return {
    plans,
    billingsData,
    apiStats,
    recentInvoices,
    isPlansLoading,
    isBillingsLoading,
    isLoading: isPlansLoading || isBillingsLoading,
    isPlansError,
    plansError,
    isBillingsError,
    billingsError,
    refetchPlans,
    refetchBillings,
  };
};

export default useAdminSubscription;
