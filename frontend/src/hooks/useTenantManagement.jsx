import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import useAxiosSecure from "./useAxiosSecure";
import toast from "react-hot-toast";

export const useTenantManagement = () => {
  const axiosSecure = useAxiosSecure();
  const queryClient = useQueryClient();

  // Fetch all tenants
  const {
    data: tenantsResponse,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["tenants"],
    queryFn: async () => {
      const res = await axiosSecure.get("/system-owner/tenants");
      return res.data;
    },
  });

  const tenants = tenantsResponse?.data || [];

  // Add new tenant
  const addMutation = useMutation({
    mutationFn: async (data) => {
      const res = await axiosSecure.post("/system-owner/tenants", data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
      toast.success("Tenant added successfully");
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Failed to add tenant");
    },
  });

  // Update tenant
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const res = await axiosSecure.patch(`/system-owner/tenants/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
      toast.success("Tenant updated successfully");
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Failed to update tenant");
    },
  });

  // Delete tenant
  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const res = await axiosSecure.delete(`/system-owner/tenants/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
      toast.success("Tenant deleted successfully");
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Failed to delete tenant");
    },
  });

  return {
    tenants,
    isLoading,
    isError,
    error,
    refetch,
    addMutation,
    updateMutation,
    deleteMutation,
    addTenant: addMutation.mutate,
    updateTenant: updateMutation.mutate,
    deleteTenant: deleteMutation.mutate,
  };
};

export default useTenantManagement;
