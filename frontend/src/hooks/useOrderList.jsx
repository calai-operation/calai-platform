import { useQuery } from "@tanstack/react-query";
import useAxiosSecure from "./useAxiosSecure";
import toast from "react-hot-toast";

export const useOrderList = (selectedOrderId) => {
  const axiosSecure = useAxiosSecure();

  const { data: ordersResponse, isLoading } = useQuery({
    queryKey: ["ordersList"],
    queryFn: async () => {
      const res = await axiosSecure.get("/business-owner/order");
      return res.data;
    },
  });

  const { data: orderDetailsResponse, isLoading: isDetailsLoading } = useQuery({
    queryKey: ["orderDetail", selectedOrderId],
    enabled: !!selectedOrderId,
    queryFn: async () => {
      const res = await axiosSecure.get(`/business-owner/order/${selectedOrderId}`);
      return res.data;
    },
  });

  const downloadReceipt = async (orderId) => {
    if (!orderId) return;
    try {
      const toastId = toast.loading("Downloading receipt...");
      const res = await axiosSecure.get(
        `/business-owner/order/download-receipt/${orderId}`,
        {
          responseType: "text",
        }
      );
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "text/plain" }));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `Receipt_${orderId}.txt`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      toast.success("Download complete", { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error("Failed to download receipt. Please connect your printer.");
    }
  };

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
      const errorMessage = err.response?.data?.message || "Failed to print. Please check your printer connection.";
      toast.error(errorMessage);
    }
  };

  return {
    orders: ordersResponse?.data || [],
    isLoading,
    selectedOrder: orderDetailsResponse?.data || null,
    isDetailsLoading,
    downloadReceipt,
    printOrder,
  };
};
