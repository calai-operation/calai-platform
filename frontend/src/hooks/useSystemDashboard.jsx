import { useQuery } from "@tanstack/react-query";
import useAxiosSecure from "./useAxiosSecure";

export const useSystemDashboard = (startDate, endDate) => {
  const axiosSecure = useAxiosSecure();

  const { data: dashboardResponse, isLoading: isLoadingDashboard, error: dashboardError } = useQuery({
    queryKey: ["systemDashboardStats"],
    queryFn: async () => {
      const response = await axiosSecure.get("/system-owner/dashboard");
      return response.data;
    },
  });

  const { data: operationsResponse, isLoading: isLoadingOperations, isFetching: isFetchingOperations, error: operationsError, dataUpdatedAt: operationsUpdatedAt } = useQuery({
    queryKey: ["systemDashboardOperations", startDate, endDate],
    queryFn: async () => {
      const response = await axiosSecure.get(`/system-owner/dashboard/operations?start=${startDate}&end=${endDate}`);
      return response.data;
    },
    enabled: !!startDate && !!endDate,
  });

  const { data: liveResponse, isLoading: isLoadingLive, isFetching: isFetchingLive, error: liveError, refetch: refetchLive, dataUpdatedAt: liveUpdatedAt } = useQuery({
    queryKey: ["systemDashboardLive"],
    queryFn: async () => {
      const response = await axiosSecure.get('/system-owner/dashboard/operations/live');
      return response.data;
    },
    refetchInterval: 5000,
  });

  const isLoading = isLoadingDashboard || isLoadingOperations || isLoadingLive;
  const error = dashboardError || operationsError || liveError;

  return {
    dashboardData: dashboardResponse?.data,
    operationsData: operationsResponse?.data,
    liveData: liveResponse?.data,
    isFetchingLive,
    refetchLive,
    isLoadingDashboard,
    isFetchingOperations,
    isLoading,
    error,
    lastUpdated: Math.max(operationsUpdatedAt || 0, liveUpdatedAt || 0)
  };
};
