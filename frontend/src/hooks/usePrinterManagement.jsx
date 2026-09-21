import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import useAxiosSecure from "./useAxiosSecure";
import toast from "react-hot-toast";

export const usePrinterManagement = () => {
  const axiosSecure = useAxiosSecure();
  const queryClient = useQueryClient();

  const { data: printersResponse, isLoading } = useQuery({
    queryKey: ["printers"],
    queryFn: async () => {
      const res = await axiosSecure.get("/business-owner/printer");
      return res.data;
    },
  });

  const printers = printersResponse?.data || [];

  const addPrinterMutation = useMutation({
    mutationFn: async (newPrinter) => {
      const res = await axiosSecure.post("/business-owner/printer", newPrinter);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["printers"]);
      toast.success("Printer added successfully");
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || "Failed to add printer");
    },
  });

  const editPrinterMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const res = await axiosSecure.patch(`/business-owner/printer/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["printers"]);
      toast.success("Printer updated successfully");
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || "Failed to update printer");
    },
  });

  const deletePrinterMutation = useMutation({
    mutationFn: async (id) => {
      const res = await axiosSecure.delete(`/business-owner/printer/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["printers"]);
      toast.success("Printer deleted successfully");
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || "Failed to delete printer");
    },
  });

  const downloadBridge = async (mac, ip) => {
    if (!mac || !ip) {
      toast.error("Printer must have a MAC address and IP address to download the bridge.");
      return;
    }

    const toastId = toast.loading("Downloading bridge...");

    try {
      const res = await axiosSecure.get(
        `/business-owner/printer/download-bridge?mac=${mac}&ip=${ip}`,
        { responseType: "blob" }
      );

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      
      const contentDisposition = res.headers["content-disposition"];
      let filename = "printer-bridge.zip";
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
        if (filenameMatch && filenameMatch.length === 2) {
          let extractedFilename = filenameMatch[1];
          if (!extractedFilename.endsWith('.zip')) {
            extractedFilename += '.zip';
          }
          filename = extractedFilename;
        }
      }
      
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("Download complete", { id: toastId });
    } catch (err) {
      console.error("Download error:", err);
      toast.error("Failed to download bridge", { id: toastId });
    }
  };

  return {
    printers,
    isLoading,
    addPrinter: addPrinterMutation.mutate,
    editPrinter: editPrinterMutation.mutate,
    deletePrinter: deletePrinterMutation.mutate,
    addPrinterMutation,
    editPrinterMutation,
    deletePrinterMutation,
    downloadBridge,
  };
};
