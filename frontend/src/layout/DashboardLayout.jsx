import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Cookies from "js-cookie";
import "../pages/admin/admin-theme.css";
import "../pages/owner/owner-theme.css";
import Sidebar from "../components/layout/Sidebar";
import Header from "../components/layout/Header";
import LiveOrderPopup from "../components/LiveOrderPopup";

export default function DashboardLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const isAdmin = Cookies.get("role") === "SYSTEM_OWNER" && location.pathname.startsWith("/admin");
  const isOwner = Cookies.get("role") === "BUSINESS_OWNER" && location.pathname.startsWith("/owner");

  return (
    <div className={`flex h-screen w-full bg-[#0a1024] text-gray-100 ${isAdmin ? "calai-admin-theme" : isOwner ? "calai-owner-theme" : ""}`}>
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <div className="flex flex-1 flex-col overflow-hidden">

        <Header onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)} />


        <main className="flex-1 overflow-y-auto hide-scrollbar bg-[#141416] text-white relative p-6">
          <Outlet />
        </main>
      </div>
      
      {/* Global Live Order Listener */}
      <LiveOrderPopup />
    </div>
  );
}
