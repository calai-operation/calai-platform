import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";
import Image from "../Image";
import { useEffect, useState } from "react";
import { FiX } from "react-icons/fi";
import toast, { Toaster } from "react-hot-toast";
import Cookies from "js-cookie";

export default function Sidebar({ isOpen, onClose, isDesktopCollapsed }) {
  const location = useLocation();
  const navigate = useNavigate();

  

  const isActivePath = (path) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  

  
  const role = Cookies.get("role") || "BUSINESS_OWNER"; 

  const ownerNavLinks = [
    { name: "Dashboard", path: "/owner/dashboard", icon: "lucide:layout-dashboard" },
    { name: "Agents", path: "/owner/agents", icon: "lucide:bot" },
    { name: "Test Call Window", path: "/owner/test-voice", icon: "lucide:phone-call" },
    { name: "Call Summary", path: "/owner/call-summary", icon: "lucide:file-text" },
    { name: "Order list", path: "/owner/order-list", icon: "lucide:list-checks" },
    { name: "Item Management", path: "/owner/item-management", icon: "lucide:monitor-cog" },
    { name: "Printer Management", path: "/owner/printer", icon: "lucide:printer" },
    { name: "Settings", path: "/owner/settings", icon: "lucide:settings" },
  ];

  const adminNavLinks = [
    { name: "Dashboard", path: "/admin/dashboard", icon: "lucide:layout-grid" },
    { name: "AI Training", path: "/admin/ai-training", icon: "lucide:bot" },
    { name: "Tenant Management", path: "/admin/tenant-management", icon: "lucide:users" },
    { name: "Telephony", path: "/admin/telephony-integration", icon: "lucide:phone" },
    { name: "Subscriptions & Billing", path: "/admin/subscriptions-billing", icon: "lucide:credit-card" },
    // { name: "API Keys", path: "/admin/api-keys", icon: "lucide:key" },
    { name: "Settings", path: "/admin/settings", icon: "lucide:settings" },
  ];

  const navLinks = role === "SYSTEM_OWNER" ? adminNavLinks : ownerNavLinks;

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[90] bg-black/50 2xl:hidden"
          onClick={onClose}
        />
      )}
      

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-[100] bg-[#0E0E10] text-[#ffffff]
        border-r border-[#262626]
        transform transition-all duration-300 
        ${isOpen ? "translate-x-0" : "-translate-x-full"}
        2xl:static 2xl:translate-x-0
        ${isDesktopCollapsed ? "2xl:w-[88px] w-64" : "w-64"}`}
      >
        {/* Mobile Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-[110] p-2 rounded-md bg-[#2563EB] text-white 2xl:hidden cursor-pointer"
        >
          <FiX size={20} />
        </button>

        <div className="flex h-full flex-col">
          {/* Header */}
          <div className={`py-6 flex items-center gap-4 transition-all duration-300 ${isDesktopCollapsed ? "px-6 2xl:px-0 2xl:justify-center" : "px-6"}`}>
            <Link to="/">
              <Image src="/logo.png" alt="Company Logo" className={`transition-all duration-300 ${isDesktopCollapsed ? "2xl:hidden" : ""}`} />
              <Image src="/title.png" alt="Company Logo" className={`w-8 h-10 transition-all duration-300 hidden ${isDesktopCollapsed ? "2xl:block" : ""}`} />
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-4 space-y-2 overflow-y-auto overflow-x-hidden">
            {navLinks.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => window.innerWidth < 1536 && onClose()}
                className={`flex items-center gap-4 py-3.5 rounded-xl transition-all border border-l-[4px]
                  ${isDesktopCollapsed ? "px-2 2xl:px-0 2xl:justify-center" : "px-2"}
                  ${
                    isActivePath(item.path)
                      ? "border-[#2563EB]/30 border-l-[#0F42FF] bg-[#18181A] text-white"
                      : "border-transparent border-l-transparent text-[#D1D5DB] hover:bg-[#18181A] hover:text-white"
                  }`}
              >
                <Icon icon={item.icon} width="24" className="text-current shrink-0" />
                <span className={`text-sm whitespace-nowrap transition-all duration-300 ${isDesktopCollapsed ? "2xl:hidden" : ""}`}>{item.name}</span>
              </NavLink>
            ))}
          </nav>

          {/* Logout */}
          {/* <div className="p-4 ">
            <button
              // onClick={handleLogout}
              className="flex w-full items-center gap-3 px-4 py-3 rounded-lg text-[#E7000B] hover:bg-[#F6A62D] hover:text-white transition cursor-pointer"
            >
              <Icon icon="material-symbols:logout" width="20" />
              Log Out
            </button>
          </div> */}
        </div>
      </aside>
    </>
  );
}
