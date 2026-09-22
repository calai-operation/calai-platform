import React, { useState } from "react";
import { Eye, X, Printer, Download, Loader2, Search } from "lucide-react";
import { useOrderList } from "../../hooks/useOrderList";
import toast from "react-hot-toast";

import Table from "../../components/Table";
import Breadcrumb from "../../components/Breadcrumb";

const OrderList = () => {
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const {
    orders,
    isLoading,
    selectedOrder,
    isDetailsLoading,
    downloadReceipt,
    printOrder,
  } = useOrderList(selectedOrderId);

  const orderProducts = selectedOrder?.items || [];

  const filteredOrders = orders.filter(
    (order) =>
      order.customerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.number?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleViewClick = (order) => {
    setSelectedOrderId(order.id);
  };

  const closeModal = () => {
    setSelectedOrderId(null);
  };

  const handleDownload = () => {
    downloadReceipt(selectedOrder?.id);
  };

  const handlePrint = () => {
    printOrder(selectedOrder?.id);
  };

  const columns = [
    { key: "number", Title: "Number", width: "15%" },
    { 
      key: "customerName", 
      Title: "Customer Name", 
      width: "20%",
      render: (row) => row.customerName || "N/A"
    },
    {
      key: "orderType",
      Title: "Order Type",
      width: "15%",
      render: (row) => {
        const type = (row.orderType || "N/A").toUpperCase();
        if (type === "DELIVERY") {
          return (
            <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-[13px] font-medium text-purple-400 bg-purple-500/10 border border-purple-500/30 whitespace-nowrap uppercase">
              {type}
            </span>
          );
        }
        return (
          <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-[13px] font-medium text-blue-400 bg-blue-500/10 border border-blue-500/30 whitespace-nowrap uppercase">
            {type}
          </span>
        );
      },
    },
    {
      key: "confirmationStatus",
      Title: "Status",
      width: "15%",
      render: (row) => {
        const status = row.confirmationStatus || "Pending";
        const isUnconfirmed = status.toLowerCase().includes("unconfirm");

        if (isUnconfirmed) {
          return (
            <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-[13px] font-medium text-orange-400 bg-orange-500/10 border border-orange-500/30 whitespace-nowrap capitalize">
              {status}
            </span>
          );
        }
        return (
          <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-[13px] font-medium text-blue-400 bg-blue-500/10 border border-blue-500/30 whitespace-nowrap capitalize">
            {status}
          </span>
        );
      },
    },
    { key: "time", Title: "Time", width: "10%" },
    { key: "date", Title: "Date", width: "10%" },
    {
      key: "action",
      Title: "Action",
      width: "10%",
      sortable: false,
      render: (row) => (
        <div className="flex justify-center">
          <button
            onClick={() => handleViewClick(row)}
            className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-800 rounded-lg"
          >
            <Eye className="w-5 h-5" />
          </button>
        </div>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div>
        <Breadcrumb text="You can see your order" />
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="animate-spin text-[#2563EB] w-10 h-10" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <Breadcrumb text="You can see your order" />

        {/* Search Bar */}
        <div className="w-full sm:w-auto">
          <div className="relative w-full sm:w-[300px]">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2 border border-[#2A2A2A] rounded-xl leading-5 bg-[#1A1A1A] text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#2563EB] focus:border-[#2563EB] sm:text-sm transition-colors"
              placeholder="Search by order number or customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="bg-[#191919] border border-[#1A1A1A] rounded-2xl overflow-hidden shadow-sm">
        {filteredOrders.length > 0 ? (
          <Table
            TableHeads={columns}
            TableRows={filteredOrders}
            headClass=" border-b border-[#1A1A1A] text-gray-200 whitespace-nowrap last:[&>div]:justify-center"
            tableClass="border-none"
          />
        ) : (
          <div className="p-8 text-center text-gray-400 text-sm">
            {searchQuery ? "No matching orders found." : "No orders found."}
          </div>
        )}
      </div>

      {/* View Modal */}
      {selectedOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 text-white">
          <div className="bg-[#111111] border border-[#1A1A1A] rounded-[20px] w-full max-w-[700px] overflow-hidden relative shadow-2xl">
            {/* Header */}
            <div className="px-4 sm:px-8 py-4 sm:py-6 border-b border-[#1A1A1A] flex justify-between items-center">
              <h2 className="text-[17px] text-gray-200 flex items-center gap-2">
                Order Summary
                {selectedOrder && (
                  <span className="text-gray-400 font-normal">
                    ({selectedOrder.customerName || "Customer"}){" "}
                    {selectedOrder.time ? `• ${selectedOrder.time}` : ""}
                  </span>
                )}
              </h2>
              <button
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
                {/* Table Content */}
                <div className="px-4 sm:px-8 py-2 max-h-[400px] overflow-y-auto overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#1A1A1A]">
                        <th className="py-4 text-[14px] font-semibold text-white">
                          Product name
                        </th>
                        <th className="py-4 text-[14px] font-semibold text-white text-center">
                          Quantity
                        </th>
                        <th className="py-4 text-[14px] font-semibold text-white text-center">
                          Notes
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
                            <td className="py-5 text-[14px] text-gray-300 text-center">
                            {product.notes || "N/A"}
                          </td>
                            <td className="py-5 text-[14px] text-gray-300 text-right">
                              £{product.unit_prize || 0}
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
                      £{selectedOrder?.totalPrice || 0}
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
