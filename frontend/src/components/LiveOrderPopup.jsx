import React, { useEffect, useState } from "react";
import { io } from "socket.io-client";
import Cookies from "js-cookie";
import { BellRing, MapPin, Phone, User, ShoppingBag } from "lucide-react";
import useAuth from "../hooks/useAuth";
import toast from "react-hot-toast";
import "./LiveOrderPopup.css";

const LiveOrderPopup = () => {
  const [incomingOrder, setIncomingOrder] = useState(null);
  const { user } = useAuth();
  const [soundingOrder, setSoundingOrder] = useState(null);

  // Follow actual playback so a blocked or paused alert never shows as sounding.
  useEffect(() => {
    if (!incomingOrder) return;
    let audio;
    let active = true;
    const playing = () => { if (active) setSoundingOrder(incomingOrder); };
    const stopped = () => { if (active) setSoundingOrder(null); };
    const stopEvents = ['pause', 'ended', 'error', 'waiting', 'emptied'];
    try {
      audio = new Audio(incomingOrder.confirmationStatus === 'unconfirmed' ? '/unconfirmed-notification.wav' : '/notification.wav');
      audio.loop = true;
      audio.addEventListener('playing', playing);
      stopEvents.forEach(event => audio.addEventListener(event, stopped));
      audio.play().catch(() => stopped());
    } catch {
      toast.error("The order alert sound could not be played.");
    }
    return () => {
      active = false;
      if (audio) {
        audio.removeEventListener('playing', playing);
        stopEvents.forEach(event => audio.removeEventListener(event, stopped));
        audio.pause();
        audio.currentTime = 0;
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
    // (Common event names: 'new-order', 'new_order', 'order')
    const handleNewOrder = (order) => {
      console.log("Live order received:", order);
      setIncomingOrder(order);
    };

    socket.on('order:confirmed', handleNewOrder);

    return () => {
      socket.off('order:confirmed', handleNewOrder);
      socket.offAny();
      socket.disconnect();
    };
  }, [user]);

  if (!incomingOrder) return null;
  const unconfirmed = incomingOrder.confirmationStatus === "unconfirmed";

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
      <div className={`calai-order-alert w-full max-w-[500px] ${unconfirmed ? "calai-order-alert--unconfirmed" : ""} ${soundingOrder === incomingOrder ? 'calai-order-alert--sounding' : ''}`}>
      <div className="bg-[#0E0E10] border border-[#272727] shadow-[0_0_40px_rgba(37,99,235,0.15)] rounded-2xl w-full max-w-[500px] max-h-[calc(100dvh-32px)] overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className={`bg-gradient-to-r ${unconfirmed ? "from-orange-600 to-amber-500" : "from-blue-600 to-indigo-600"} p-5 relative}`}>
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-bl-full -z-10"></div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-full">
              <BellRing className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{unconfirmed ? "Unconfirmed Order" : "New Order Received!"}</h2>
              {/* <p className="text-blue-100 text-sm">Order #{incomingOrder.id || 'N/A'}</p> */}
            </div>
          </div>
        </div>

        {/* Order Details Body */}
        <div className="p-6 flex-1 min-h-0 max-h-[60vh] overflow-y-auto hide-scrollbar space-y-6">
          
          {/* Customer Info */}
          <div className="bg-[#151515] p-4 rounded-xl border border-white/5 space-y-3">
            <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">Customer Details</h3>
            
            <div className="flex items-start gap-3 text-sm">
              <User className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />
              <span className="text-gray-200 font-medium">{incomingOrder.customerName || 'Unknown Customer'}</span>
            </div>
            
            <div className="flex items-start gap-3 text-sm">
              <Phone className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />
              <span className="text-gray-200">{incomingOrder.number || 'N/A'}</span>
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
                      {unconfirmed && item.notes && <p className="text-gray-400 text-sm">{item.notes}</p>}
                    </div>
                    <p className="text-white font-medium">{unconfirmed && item.unit_prize === null ? "Price unknown" : `£${Number(item.unit_prize || item.unit_price || item.price || 0).toFixed(2)}`}</p>
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
            <span className="text-2xl font-bold text-white">{unconfirmed && incomingOrder.totalPrice === null ? "Not confirmed" : `£${Number(incomingOrder.totalPrice || 0).toFixed(2)}`}</span>
          </div>

        </div>

        {unconfirmed && <div className="max-h-[25vh] overflow-y-auto shrink-0 px-6 py-4 border-t border-orange-500/30 bg-orange-500/10 text-orange-100"><p className="font-semibold text-sm">Reason not confirmed</p><p className="text-sm mt-1 break-words">{incomingOrder.unconfirmedReason || 'The call ended before the order was fully confirmed.'}</p></div>}
        {/* Footer Actions */}
        <div className="shrink-0 p-5 border-t border-[#272727] bg-[#111111]">
          <button
            onClick={() => setIncomingOrder(null)}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all shadow-[0_0_20px_rgba(37,99,235,0.2)] hover:shadow-[0_0_30px_rgba(37,99,235,0.4)]"
          >
            Acknowledge
          </button>
        </div>
        
      </div>
      </div>
    </div>
  );
};

export default LiveOrderPopup;
