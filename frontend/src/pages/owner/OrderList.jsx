import { useState } from "react";
import { Eye, X, Printer, Download, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import useAxiosSecure from "../../hooks/useAxiosSecure";
import toast from "react-hot-toast";

import Table from "../../components/Table";
import Breadcrumb from "../../components/Breadcrumb";
import "./RecordPages.css";
import {weekRange,orderInRange} from "./order-dates";

const OrderList = () => {
  const axiosSecure = useAxiosSecure();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [range,setRange]=useState(()=>weekRange());
  const [datePreset,setDatePreset]=useState("week");
  const [selectedOrderId, setSelectedOrderId] = useState(null);

  const { data: ordersResponse, isLoading, isError, refetch, isFetching } = useQuery({
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
      const res = await axiosSecure.get(
        `/business-owner/order/${selectedOrderId}`,
      );
      return res.data;
    },
  });

  const orders = ordersResponse?.data || [];
  const orderTypes = [...new Set(orders.map(order => order.orderType).filter(Boolean))];
  const filteredOrders = orders.filter(order =>
    orderInRange(order,range) &&
    (filter === 'all' || order.orderType === filter) &&
    [order.number, order.customerName, order.time, order.date, order.orderType].some(value => String(value ?? '').toLowerCase().includes(search.trim().toLowerCase()))
  );
  const selectedOrder = orderDetailsResponse?.data;
  const orderProducts = selectedOrder?.items || [];

  const handleViewClick = (order) => {
    setSelectedOrderId(order.id);
  };

  const closeModal = () => {
    setSelectedOrderId(null);
  };

  const handleDownload = async () => {
    if (!selectedOrder) return;
    try {
      const toastId = toast.loading("Downloading receipt...");
      const res = await axiosSecure.get(
        `/business-owner/order/download-receipt/${selectedOrder.id}`,
        {
          responseType: "text",
        },
      );
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "text/plain" }));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `Receipt_${selectedOrder.id}.txt`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      toast.success("Download complete", { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error("Failed to download receipt. Please connect your printer.");
    }
  };

  const handlePrint = async () => {
    if (!selectedOrder) return;
    const toastId = toast.loading("Sending to printer...");
    try {
      await axiosSecure.get(`/business-owner/order/download/${selectedOrder.id}`);
      toast.dismiss(toastId);
      toast.success("Order sent to printer successfully!");
    } catch (err) {
      console.error(err);
      toast.dismiss(toastId);
      const errorMessage = err.response?.data?.message || "Failed to print. Please check your printer connection.";
      toast.error(errorMessage);
    }
  };

  const columns = [
    { key: "number", Title: "Phone number", width: "25%" },
    { key: "customerName", Title: "Customer Name", width: "20%" },
    { key: "confirmationStatus", Title: "Status", render: row => <span className={row.confirmationStatus === "unconfirmed" ? "record-badge record-badge-warning" : "record-badge"}>{row.confirmationStatus === "unconfirmed" ? "Unconfirmed Order" : "Confirmed"}</span> },
    { key: "time", Title: "Time", width: "15%" },
    { key: "date", Title: "Date", width: "15%" },
    { key: "orderType", Title: "Order Type", width: "10%", render: row => <span className="record-badge">{row.orderType || "—"}</span> },
    {
      key: "action",
      Title: "Action",
      width: "15%",
      sortable: false,
      render: (row) => (
        <div className="flex justify-center">
          <button
            onClick={() => handleViewClick(row)}
            className="record-action"
          >
            <Eye className="w-4 h-4" /><span>View order</span>
          </button>
        </div>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div>
        <Breadcrumb text="Review incoming orders, view receipts and send them to your printer." />
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="animate-spin text-[#2563EB] w-10 h-10" />
        </div>
      </div>
    );
  }

  return (
    <div className="calai-records">
      <Breadcrumb text="Review incoming orders, view receipts and send them to your printer." />

      <div className="record-toolbar record-date-toolbar">
        <label>Period<select aria-label="Order period" value={datePreset} onChange={e=>{const preset=e.target.value;setDatePreset(preset);if(preset==='week')setRange(weekRange());if(preset==='last-week')setRange(weekRange(new Date(),-1));if(preset==='all')setRange({start:'',end:''});}}><option value="week">This week</option><option value="last-week">Last week</option><option value="custom">Custom range</option><option value="all">All dates</option></select></label>
        <label>From<input aria-label="Orders from date" type="date" value={range.start} max={range.end||undefined} onChange={e=>{setDatePreset('custom');setRange({...range,start:e.target.value});}}/></label>
        <label>To<input aria-label="Orders to date" type="date" value={range.end} min={range.start||undefined} onChange={e=>{setDatePreset('custom');setRange({...range,end:e.target.value});}}/></label>
        <span className="record-date-note">Monday–Sunday · London time</span>
      </div>
      <div className="record-toolbar">
        <label className="record-search">Search orders<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Customer, phone, date or time…" /></label>
        <label>Order type<select value={filter} onChange={event => setFilter(event.target.value)}><option value="all">All order types</option>{orderTypes.map(type => <option key={type} value={type}>{type}</option>)}</select></label>
        <button className="record-action" onClick={() => refetch()} disabled={isFetching}>{isFetching ? 'Refreshing…' : 'Refresh'}</button>
      </div>
      <div className="record-caption"><span>{isError ? 'Orders unavailable' : `${filteredOrders.length} of ${orders.length} orders`}</span><span>Sort by any column heading</span></div>
      {isError && <p role="alert" className="record-error">Orders could not be loaded. Use Refresh to try again.</p>}
      <div className="record-panel">
        {filteredOrders.length > 0 ? (
          <Table
            TableHeads={columns}
            TableRows={filteredOrders}
            emptyState={<div className="record-empty">No orders match your search or filter.</div>}
            headClass=" border-b border-[#1A1A1A] text-gray-200 whitespace-nowrap last:[&>div]:justify-center"
            tableClass="border-none"
          />
        ) : (
          <div className="p-8 text-center text-gray-400 text-sm">
            {orders.length ? "No orders match this date range, search or order type." : "No orders found."}
          </div>
        )}
      </div>

      {/* View Modal */}
      {selectedOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 text-white">
          <div role="dialog" aria-modal="true" aria-label="Order summary" className="record-dialog bg-[#111111] border border-[#1A1A1A] rounded-[20px] w-full max-w-[700px] overflow-hidden relative shadow-2xl">
            {/* Header */}
            <div className="px-4 sm:px-8 py-4 sm:py-6 border-b border-[#1A1A1A] flex justify-between items-center">
              <h2 className="text-[17px] text-gray-200 flex items-center gap-2">
                Order Summary
                {selectedOrder && (
                  <span className="text-gray-400 font-normal">
                    ({selectedOrder.customerName || "Customer"}) {selectedOrder.time ? `• ${selectedOrder.time}` : ""}
                  </span>
                )}
              </h2>
              <button
                aria-label="Close order summary"
                onClick={closeModal}
                className="text-gray-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isDetailsLoading ? (
              <div className="flex items-center justify-center min-h-[200px]">
                <Loader2 className="animate-spin text-[#2563EB] w-8 h-8" />
              </div>
            ) : (
              <>
                {selectedOrder?.confirmationStatus === 'unconfirmed' && <div className="px-4 sm:px-8 py-4 text-orange-200"><strong>Unconfirmed Order</strong><p className="mt-1 text-sm">{selectedOrder.unconfirmedReason}</p></div>}
                {/* Table Content */}
                <div className="px-4 sm:px-8 py-2 max-h-[400px] overflow-y-auto overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#1A1A1A]">
                        <th className="py-4 text-[14px] font-semibold text-white">
                          Product name
                        </th>
                        <th className="py-4 text-[14px] font-semibold text-white text-center">
                          Order Quantity
                        </th>
                        <th className="py-4 text-[14px] font-semibold text-white text-right">
                          Price
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {orderProducts.length > 0 ? (
                        orderProducts.map((product, idx) => (
                          <tr
                            key={product.id || idx}
                            className="border-b border-[#1A1A1A]"
                          >
                            <td className="py-5 text-[14px] text-gray-300">
                              {product.product_name || `Item ${idx + 1}`}
                            </td>
                            <td className="py-5 text-[14px] text-gray-300 text-center">
                              <span className="inline-block px-4">
                                {product.quantity}
                              </span>
                            </td>
                            <td className="py-5 text-[14px] text-gray-300 text-right">
                              {selectedOrder?.confirmationStatus === "unconfirmed" && product.unit_prize === null ? "Price unknown" : `£${Number(product.unit_prize || 0).toFixed(2)}`}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan="4"
                            className="py-8 text-center text-gray-500 text-sm"
                          >
                            No items found for this order.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Footer Actions */}
                <div className="px-4 sm:px-8 py-4 sm:py-6 flex flex-col sm:flex-row justify-between items-center gap-4 mt-2 border-t border-[#1A1A1A]">
                  <div className="text-[15px] font-medium text-white w-full sm:w-auto text-center sm:text-left">
                    Total:{" "}
                    <span className="text-[#2563EB]">
                      {selectedOrder?.confirmationStatus === "unconfirmed" && selectedOrder.totalPrice === null ? "Not confirmed" : `£${Number(selectedOrder?.totalPrice || 0).toFixed(2)}`}
                    </span>
                  </div>
                  <div className="flex gap-3 sm:gap-4 w-full sm:w-auto justify-between sm:justify-start">
                    <button
                      onClick={handlePrint}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-[#1A2255] hover:bg-[#232D70] transition-colors text-white px-4 sm:px-6 py-2.5 rounded-[10px] text-[13px] font-medium cursor-pointer"
                    >
                      <Printer className="w-4 h-4" />
                      Print
                    </button>
                    <button
                      onClick={handleDownload}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-[#1A2255] hover:bg-[#232D70] transition-colors text-white px-4 sm:px-6 py-2.5 rounded-[10px] text-[13px] font-medium cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderList;
