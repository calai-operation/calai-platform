import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import useAxiosSecure from "./useAxiosSecure";
import toast from "react-hot-toast";

export const useTelephony = (businessId = null) => {
  const axiosSecure = useAxiosSecure();
  const queryClient = useQueryClient();

  // 1. Fetch Tenants
  const {
    data: tenantsResponse,
    isLoading: isTenantsLoading,
  } = useQuery({
    queryKey: ["tenants"],
    queryFn: async () => {
      const res = await axiosSecure.get("/system-owner/tenants");
      return res.data;
    },
  });
  const tenants = tenantsResponse?.data || [];
  const tenantNames = tenants.map(
    (t) => t.name || t.business_name || "Unknown"
  );

  // 2. Fetch Unconnected Agents for the selected business
  const {
    data: agentsResponse,
    isLoading: isAgentsLoading,
  } = useQuery({
    queryKey: ["unconnected-agents", businessId],
    queryFn: async () => {
      if (!businessId) return { data: [] };
      try {
        const res = await axiosSecure.get(
          `/system-owner/telephony/unconnected-agents/${businessId}`
        );
        return res.data;
      } catch (err) {
        return { data: [] };
      }
    },
    enabled: !!businessId,
  });
  const unconnectedAgents = agentsResponse?.data || [];
  const agentNames = unconnectedAgents.map(
    (a) => a.name || a.agentName || a.agent_name || "Unnamed Agent"
  );

  // 3. Fetch Telephony configuration
  const {
    data: telephonyResponse,
    isLoading,
    isError,
    error,
    refetch: refetchTelephony,
  } = useQuery({
    queryKey: ["telephony"],
    queryFn: async () => {
      const res = await axiosSecure.get("/system-owner/telephony");
      return res.data;
    },
  });
  const numbers = telephonyResponse?.data || [];

  // 4. Add Telephony Mutation
  const addMutation = useMutation({
    mutationFn: async (data) => {
      const res = await axiosSecure.post("/system-owner/telephony", data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["telephony"] });
      queryClient.invalidateQueries({ queryKey: ["unconnected-agents"] });
      toast.success("Number added successfully");
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Failed to add number");
    },
  });

  // 5. Update Telephony Mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const res = await axiosSecure.patch(
        `/system-owner/telephony/${id}`,
        data
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["telephony"] });
      toast.success("Number updated successfully");
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Failed to update number");
    },
  });

  // 6. Delete Telephony Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const res = await axiosSecure.delete(`/system-owner/telephony/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["telephony"] });
      queryClient.invalidateQueries({ queryKey: ["unconnected-agents"] });
      toast.success("Number deleted successfully");
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Failed to delete number");
    },
  });

  return {
    tenants,
    tenantNames,
    isTenantsLoading,
    unconnectedAgents,
    agentNames,
    isAgentsLoading,
    numbers,
    isLoading,
    isError,
    error,
    refetchTelephony,
    addMutation,
    updateMutation,
    deleteMutation,
    addNumber: addMutation.mutate,
    updateNumber: updateMutation.mutate,
    deleteNumber: deleteMutation.mutate,
  };
};

export default useTelephony;
