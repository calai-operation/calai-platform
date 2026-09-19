import { useQuery } from "@tanstack/react-query";
import useAxiosSecure from "./useAxiosSecure";

export const useOwnerDashboard = () => {
  const axiosSecure = useAxiosSecure();

  const { data: statsData, isLoading: isLoadingStats } = useQuery({
    queryKey: ["ownerDashboardStats"],
    queryFn: async () => {
      const response = await axiosSecure.get("/business-owner/dashboard/stats");
      return response.data;
    },
  });

  const { data: insightsData, isLoading: isLoadingInsights } = useQuery({
    queryKey: ["ownerDashboardInsights"],
    queryFn: async () => {
      const response = await axiosSecure.get("/business-owner/dashboard/insights");
      return response.data;
    },
  });

  const { data: liveData, isLoading: isLoadingLive } = useQuery({
    queryKey: ["ownerDashboardLive"],
    queryFn: async () => {
      const response = await axiosSecure.get("/business-owner/dashboard/live");
      return response.data;
    },
    refetchInterval: 5000, // Fetch live data every 5 seconds
  });

  const { data: printersData, isLoading: isLoadingPrinters } = useQuery({
    queryKey: ["printers"],
    queryFn: async () => {
      const response = await axiosSecure.get("/business-owner/printer");
      return response.data;
    },
    refetchInterval: 5000, // Poll every 5 seconds for real-time printer status
  });

  const isLoading = isLoadingStats || isLoadingInsights || isLoadingLive || isLoadingPrinters;

  return {
    stats: statsData?.data?.stats,
    graphData: statsData?.data?.graphData,
    overallReport: statsData?.data?.overallReport,
    insights: insightsData?.data,
    live: liveData?.data,
    printers: printersData?.data || [],
    isLoading,
  };
};
