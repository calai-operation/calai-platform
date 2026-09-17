import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import useAxiosSecure from "./useAxiosSecure";
import toast from "react-hot-toast";
import { useEffect, useState } from "react";

export const useItemManagement = () => {
  const axiosSecure = useAxiosSecure();
  const queryClient = useQueryClient();

  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [uploadAgentId, setUploadAgentId] = useState("");

  const { data: agentsResponse } = useQuery({
    queryKey: ["agents"],
    queryFn: async () => {
      const res = await axiosSecure.get("/business-owner/agent");
      return res.data;
    },
  });
  const agents = agentsResponse?.data || [];

  useEffect(() => {
    if (agents.length > 0) {
      const agent = agents[0];
      const vapiId = agent.agentId || agent.vapiAgentId || agent.vapi_agent_id || agent.id;
      if (!selectedAgentId) setSelectedAgentId(vapiId);
      if (!uploadAgentId) setUploadAgentId(vapiId);
    }
  }, [agents, selectedAgentId, uploadAgentId]);

  const { data: itemsResponse, isLoading } = useQuery({
    queryKey: ["itemManagement", selectedAgentId],
    queryFn: async () => {
      const url = selectedAgentId
        ? `/business-owner/item-management?vapiAgentId=${selectedAgentId}`
        : "/business-owner/item-management";
      const res = await axiosSecure.get(url);
      return res.data;
    },
  });

  const items = itemsResponse?.data || [];

  const uploadMenuMutation = useMutation({
    mutationFn: async ({ agentId, formData }) => {
      const res = await axiosSecure.patch(
        `/business-owner/item-management/update-menu?vapiAgentId=${agentId}`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );
      return res.data;
    },
    onSuccess: () => {
      toast.success("Menu updated successfully");
      queryClient.invalidateQueries({ queryKey: ["itemManagement"] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to update menu");
    },
  });

  const submitUpload = (agentId, files, onSuccessCallback) => {
    if (!agentId) {
      toast.error("Please select an agent");
      return;
    }
    if (!files || files.length === 0) {
      toast.error("Please select at least one file");
      return;
    }

    const formData = new FormData();
    files.forEach((file) => {
      formData.append("menu_file", file);
    });

    uploadMenuMutation.mutate(
      { agentId, formData },
      {
        onSuccess: () => {
          if (onSuccessCallback) onSuccessCallback();
        },
      }
    );
  };

  return {
    agents,
    items,
    isLoading,
    selectedAgentId,
    setSelectedAgentId,
    uploadAgentId,
    setUploadAgentId,
    submitUpload,
  };
};
