import { useQuery } from "@tanstack/react-query";
import useAxiosSecure from "./useAxiosSecure";
import toast from "react-hot-toast";

export const useCallSummary = () => {
  const axiosSecure = useAxiosSecure();

  const { data: callsResponse, isLoading } = useQuery({
    queryKey: ["callSummaries"],
    queryFn: async () => {
      const res = await axiosSecure.get("/business-owner/call-summary");
      return res.data;
    },
  });

  const downloadPdf = async (id, type) => {
    if (!id) return;
    try {
      const toastId = toast.loading("Downloading PDF...");
      const res = await axiosSecure.get(
        `/business-owner/call-summary/download/${id}`,
        {
          responseType: "blob",
        }
      );
      const url = window.URL.createObjectURL(
        new Blob([res.data], { type: "application/pdf" })
      );
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `Call_${type.replace(/\s+/g, "_")}_${id}.pdf`
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

  return {
    calls: callsResponse?.data || [],
    isLoading,
    downloadPdf,
  };
};
