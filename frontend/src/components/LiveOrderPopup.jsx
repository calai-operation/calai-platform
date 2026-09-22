import React, { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import Cookies from "js-cookie";
import { X, BellRing, MapPin, Phone, User, ShoppingBag, AlertTriangle, AlertCircle } from "lucide-react";
import useAuth from "../hooks/useAuth";
import toast from "react-hot-toast";

const LiveOrderPopup = () => {
  const [incomingOrder, setIncomingOrder] = useState(null);
  const { user } = useAuth();
  const audioRef = useRef(null);

  // Play a notification sound continuously until acknowledged
  useEffect(() => {
    if (incomingOrder) {
      try {
        const isUnconfirmed =
          incomingOrder.confirmationStatus?.toLowerCase() === "unconfirmed" ||
          incomingOrder.status?.toLowerCase() === "unconfirmed" ||
          incomingOrder.isConfirmed === false;

        const audioPath = isUnconfirmed ? '/unconfirmed-notification.wav' : '/notification.wav';
        const audio = new Audio(audioPath);
        audio.loop = true; // Loop the sound
        audioRef.current = audio;
        audio.play().catch(e => console.log("Audio play blocked by browser", e));
      } catch (e) {
        toast.error("Audio error:", e);
      }
    }
    
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    };
  }, [incomingOrder]);

  useEffect(() => {
    // Determine socket URL from API URL
    const baseUrl = import.meta.env.VITE_API_BASE_URL;
    const urlObj = new URL(baseUrl);
    const socketUrl = urlObj.origin;
    const token = Cookies.get('Access-Token');
    
    // Extract businessId from user context or token payload
    let businessId =  user?.businessId || null;
    if (!businessId && token) {
      try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        const payload = JSON.parse(jsonPayload);
        businessId = payload.businessId || null;
      } catch (e) {
        console.error("Failed to decode token", e);
      }
    }

    // Initialize socket connection (defaults to polling then upgrades to websocket)
    const socket = io(socketUrl, {
      auth: { token: token },
      query: { token: token }
    });

    socket.on("connect_error", (err) => {
      console.error("Socket connection error:", err.message);
    });

    socket.on("connect", () => {
      console.log("Socket connected successfully with ID:", socket.id);
      if (businessId) {
        console.log("Joining business room:", businessId);
        socket.emit("join-business-room", businessId);
      }
    });

    // Catch ALL events to see what the backend is actually sending
    socket.onAny((eventName, ...args) => {
      console.log(`[Socket.io Debug] Received event: '${eventName}'`, args);
    });

    // Listen for new order events
    const handleNewOrder = (order) => {
      console.log("Live order received:", order);
      setIncomingOrder(order);
    };

    socket.on('order:confirmed', handleNewOrder);
    socket.on('order:unconfirmed', handleNewOrder);
    socket.on('new-order', handleNewOrder);

    return () => {
      socket.off('order:confirmed', handleNewOrder);
      socket.off('order:unconfirmed', handleNewOrder);
      socket.off('new-order', handleNewOrder);
      socket.offAny();
      socket.disconnect();
    };
  }, [user]);

  if (!incomingOrder) return null;

  const isUnconfirmed =
    incomingOrder.confirmationStatus?.toLowerCase() === "unconfirmed" ||
    incomingOrder.status?.toLowerCase() === "unconfirmed" ||
    incomingOrder.isConfirmed === false;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
      <div 
        className="relative w-full max-w-[500px] rounded-2xl animate-border-wave"
        style={{ '--wave-color': isUnconfirmed ? 'rgba(245, 158, 11, 0.5)' : 'rgba(59, 130, 246, 0.5)' }}
      >
        <div className={`relative bg-[#0E0E10] border ${isUnconfirmed ? 'border-amber-500 shadow-[0_0_40px_rgba(217,119,6,0.3)]' : 'border-blue-500 shadow-[0_0_40px_rgba(37,99,235,0.3)]'} rounded-2xl w-full overflow-hidden flex flex-col animate-in zoom-in-95 duration-300`}>
        
        {/* Header */}
        <div className={`p-5 relative ${isUnconfirmed ? 'bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700' : 'bg-gradient-to-r from-blue-600 to-indigo-600'}`}>
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-bl-full -z-10"></div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-full animate-pulse">
              {isUnconfirmed ? (
                <AlertTriangle className="w-6 h-6 text-white" />
              ) : (
                <BellRing className="w-6 h-6 text-white" />
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                {isUnconfirmed ? "Unconfirmed order received" : "New Order Received!"}
              </h2>
              {isUnconfirmed && (
                <p className="text-amber-100 text-xs font-medium mt-0.5">
                  Action required: this order is not yet confirmed
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Order Details Body */}
        <div className="p-6 flex-1 max-h-[60vh] overflow-y-auto hide-scrollbar space-y-6">
          
          {/* Unconfirmed Reason Banner */}
          {isUnconfirmed && (
            <div className="bg-[#261706] border border-amber-600/40 p-4 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-semibold text-amber-300 uppercase tracking-wider">
                  Reason not confirmed
                </p>
                <p className="text-amber-200/90 leading-relaxed">
                  {incomingOrder.unconfirmedReason || "The customer ended or left the call before final confirmation."}
                </p>
              </div>
            </div>
          )}

          {/* Customer Info */}
          <div className="bg-[#151515] p-4 rounded-xl border border-white/5 space-y-3">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider">Customer Details</h3>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide uppercase ${
                  isUnconfirmed
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                    : "bg-green-500/20 text-green-400 border border-green-500/40"
                }`}
              >
                {isUnconfirmed ? "Unconfirmed" : "Confirmed"}
              </span>
            </div>
            
            <div className="flex items-start gap-3 text-sm">
              <User className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />
              <span className="text-gray-200 font-medium">
                {!incomingOrder.customerName || incomingOrder.customerName.includes('{{') ? 'Unknown Customer' : incomingOrder.customerName}
              </span>
            </div>
            
            <div className="flex items-start gap-3 text-sm">
              <Phone className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />
              <span className="text-gray-200">
                {!incomingOrder.number || incomingOrder.number.includes('{{') ? 'Web Call (Test)' : incomingOrder.number}
              </span>
            </div>

            <div className="flex items-start gap-3 text-sm">
              <MapPin className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />
              <span className="text-gray-200">
                {incomingOrder.deliveryAddress || 'No Address Provided'}
                {incomingOrder.orderType && <span className="ml-2 px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs">{incomingOrder.orderType}</span>}
              </span>
            </div>
          </div>

          {/* Items */}
          <div>
            <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2">
              <ShoppingBag className="w-4 h-4" /> Ordered Items
            </h3>
            <div className="space-y-3">
              {(incomingOrder.items || []).length > 0 ? (
                incomingOrder.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-start pb-3 border-b border-white/5 last:border-0 last:pb-0">
                    <div>
                      <p className="text-gray-200 font-medium">{item.product_name || item.name || 'Unknown Item'}</p>
                      <p className="text-gray-500 text-sm">Qty: {item.quantity || 1}</p>
                    </div>
                    <p className="text-white font-medium">£{Number(item.unit_prize || item.unit_price || item.price || 0).toFixed(2)}</p>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-sm italic">No items details available.</p>
              )}
            </div>
          </div>

          {/* Total */}
          <div className="flex justify-between items-center pt-4 border-t border-white/10">
            <span className="text-gray-400 font-medium">Total Amount:</span>
            <span className="text-2xl font-bold text-white">£{Number(incomingOrder.totalPrice || 0).toFixed(2)}</span>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-[#272727] bg-[#111111]">
          <button
            onClick={() => setIncomingOrder(null)}
            className={`w-full py-3.5 text-white font-semibold rounded-xl transition-all ${
              isUnconfirmed
                ? "bg-amber-600 hover:bg-amber-700 shadow-[0_0_20px_rgba(217,119,6,0.25)] hover:shadow-[0_0_30px_rgba(217,119,6,0.4)]"
                : "bg-blue-600 hover:bg-blue-700 shadow-[0_0_20px_rgba(37,99,235,0.2)] hover:shadow-[0_0_30px_rgba(37,99,235,0.4)]"
            }`}
          >
            {isUnconfirmed ? "Acknowledge Unconfirmed Order" : "Acknowledge"}
          </button>
        </div>
        
        </div>
        
      </div>
    </div>
  );
};

export default LiveOrderPopup;
