"use client";

import React, { useEffect, useState, useRef } from "react";
import { apiClient, DashboardResponse, OrderRequest, OrderResponse } from "@/lib/api";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { WebSocketService, wsService } from '@/lib/websocket';
import toast from 'react-hot-toast';
import { getValidToken, handleAuthError } from '@/lib/auth';

console.log("DashboardPage rendered");

export default function DashboardPage() {
  const [order, setOrder] = useState<OrderRequest>({
    action: "",
    product: "",
    monthyear: "",
    price: 0,
    amount: 0,
  });
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);
  const [cancelLoading, setCancelLoading] = useState<string | null>(null);
  const [negotiationTurn, setNegotiationTurn] = useState<{
    asset: string;
    turn: string;
    bestBid: number;
    bestOffer: number;
    bestBidUserId: string;
    bestOfferUserId: string;
    bestBidUsername: string;
    bestOfferUsername: string;
    message: string;
  } | null>(null);
  const [negotiationLoading, setNegotiationLoading] = useState(false);
  const router = useRouter();
  const websocketServiceRef = useRef<WebSocketService | null>(null);
  const [improvedPrice, setImprovedPrice] = useState<string>("");
  const [negotiationError, setNegotiationError] = useState<string>("");
  const [editOrder, setEditOrder] = useState<OrderResponse | null>(null);
  const [editPrice, setEditPrice] = useState<string>("");
  const [editAmount, setEditAmount] = useState<string>("");
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string>("");
  const [wsConnected, setWsConnected] = useState(false);
  const [wsConnecting, setWsConnecting] = useState(false);

  // Track handled approvals to prevent duplicate modals
  const handledApprovalsRef = useRef<Set<string>>(new Set());

  // Quantity confirmation modal state
  const [quantityConfirmation, setQuantityConfirmation] = useState<{
    asset: string;
    price: number;
    yourQuantity: number;
    additionalQuantity: number;
    side: string;
    confirmationKey: string;
  } | null>(null);
  const [quantityConfirmationLoading, setQuantityConfirmationLoading] = useState(false);

  // Add state for partial fill approval and declined notification
  const [partialFillApproval, setPartialFillApproval] = useState<{
    asset: string;
    price: number;
    yourQuantity: number;
    partialFillQuantity: number;
    side: string;
    confirmationKey: string;
  } | null>(null);
  const [partialFillApprovalLoading, setPartialFillApprovalLoading] = useState(false);
  const [partialFillDeclined, setPartialFillDeclined] = useState<string | null>(null);

  // Use React Query for dashboard data
  const {
    data: dashboard,
    isLoading: loading,
    refetch: refetchDashboard,
    error,
  } = useQuery<DashboardResponse, Error>({
    queryKey: ["dashboard"],
    queryFn: async () => {
      console.log("Fetching dashboard...");
      return apiClient.getDashboard();
    },
    refetchInterval: 10000, // 10 seconds, or remove for manual refresh
  });

  // Redirect on auth error
  if (error && error.message === "Authentication failed") {
    router.push("/");
  }

  // Route guard: redirect to login if no valid token
  useEffect(() => {
    console.log('[DASHBOARD DEBUG] Route guard useEffect running...');
    if (typeof window !== 'undefined') {
      const token = getValidToken();
      console.log('[DASHBOARD DEBUG] Route guard token check:', token ? 'Token valid' : 'No valid token');
      if (!token) {
        console.log('[DASHBOARD DEBUG] No valid token found, redirecting to login...');
        handleAuthError();
      }
    }
  }, []);

  // WebSocket connection
  useEffect(() => {
    console.log('[DASHBOARD DEBUG] WebSocket initialization useEffect running...');
    if (typeof window !== "undefined" && !websocketServiceRef.current) {
      console.log('[DASHBOARD DEBUG] Setting websocketServiceRef to wsService singleton');
      websocketServiceRef.current = wsService;
      
      // Check if we have a valid token and start auto-reconnect (for page refreshes)
      const token = getValidToken();
      if (token) {
        console.log('[DASHBOARD DEBUG] Valid token found, starting auto-reconnect for WebSocket...');
        wsService.startAutoReconnect();
      } else {
        console.log('[DASHBOARD DEBUG] No valid token, WebSocket will connect after login');
      }
    }
    
    // No cleanup - let the shared WebSocket service stay connected for the entire session
    // Only disconnect on logout, not on component unmount
  }, []);

  // Real-time WebSocket connection state
  useEffect(() => {
    const ws = websocketServiceRef.current?.getSocket();
    if (!ws) return;
    const handleConnect = () => {
      setWsConnected(true);
      setWsConnecting(false);
    };
    const handleDisconnect = () => {
      setWsConnected(false);
      setWsConnecting(false);
    };
    const handleConnecting = () => {
      setWsConnecting(true);
    };
    ws.on('connect', handleConnect);
    ws.on('disconnect', handleDisconnect);
    ws.on('connecting', handleConnecting);
    setWsConnected(ws.connected);
    return () => {
      ws.off('connect', handleConnect);
      ws.off('disconnect', handleDisconnect);
      ws.off('connecting', handleConnecting);
    };
  }, []);

  // Listen for market updates
  useEffect(() => {
    const handleMarketUpdate = () => {
      console.log('[DASHBOARD] Market update event received, refetching dashboard...');
      refetchDashboard();
    };

    const handleTradeExecuted = () => {
      console.log('[DASHBOARD] Trade executed event received, refetching dashboard...');
      refetchDashboard();
    };

    const handleOrderPartiallyFilled = () => {
      console.log('[DASHBOARD] Order partially filled event received, refetching dashboard...');
      refetchDashboard();
    };

    const handleOrderFilled = () => {
      console.log('[DASHBOARD] Order filled event received, refetching dashboard...');
      refetchDashboard();
    };

    // Listen for all market and order events
    window.addEventListener('marketUpdate', handleMarketUpdate);
    window.addEventListener('tradeExecuted', handleTradeExecuted);
    window.addEventListener('orderPartiallyFilled', handleOrderPartiallyFilled);
    window.addEventListener('orderFilled', handleOrderFilled);
    
    return () => {
      window.removeEventListener('marketUpdate', handleMarketUpdate);
      window.removeEventListener('tradeExecuted', handleTradeExecuted);
      window.removeEventListener('orderPartiallyFilled', handleOrderPartiallyFilled);
      window.removeEventListener('orderFilled', handleOrderFilled);
    };
  }, [refetchDashboard]);

  // Listen for seller approval events
  useEffect(() => {
    const socket = websocketServiceRef.current?.getSocket();
    if (!socket) return;
    const handler = (event: { data: { offerId: string; bidId: string } }) => {
      const approvalKey = `${event.data.offerId}:${event.data.bidId}`;
      if (!handledApprovalsRef.current.has(approvalKey)) {
        handledApprovalsRef.current.add(approvalKey);
        console.log('[SELLER APPROVAL] Modal should now be visible. Data:', event.data);
      } else {
        console.log('[SELLER APPROVAL] Duplicate approval event ignored for', approvalKey);
      }
    };
    socket.on('match:approval', handler);
    return () => {
      socket.off('match:approval', handler);
    };
  }, []);

  // Listen for negotiation:your_turn events
  useEffect(() => {
    const handleNegotiationTurn = (event: CustomEvent) => {
      setNegotiationTurn(event.detail);
    };
    window.addEventListener('negotiationYourTurn', handleNegotiationTurn as EventListener);
    return () => window.removeEventListener('negotiationYourTurn', handleNegotiationTurn as EventListener);
  }, []);

  // Listen for quantity confirmation requests
  useEffect(() => {
    const handleQuantityConfirmationRequest = (event: CustomEvent) => {
      console.log('[DASHBOARD][DEBUG] ===== QUANTITY CONFIRMATION REQUEST RECEIVED =====');
      console.log('[DASHBOARD][DEBUG] Event detail:', event.detail);
      console.log('[DASHBOARD][DEBUG] Current user ID:', dashboard?.profile?.id);
      console.log('[DASHBOARD][DEBUG] Current username:', dashboard?.profile?.username);
      console.log('[DASHBOARD][DEBUG] Your order ID:', event.detail.yourOrderId);
      console.log('[DASHBOARD][DEBUG] Your quantity:', event.detail.yourQuantity);
      console.log('[DASHBOARD][DEBUG] Additional quantity:', event.detail.additionalQuantity);
      console.log('[DASHBOARD][DEBUG] Side:', event.detail.side);
      console.log('[DASHBOARD][DEBUG] Asset:', event.detail.asset);
      
      // Add validation check
      console.log('[DASHBOARD][DEBUG] ===== FRONTEND VALIDATION =====');
      if (dashboard?.profile?.id) {
        console.log('[DASHBOARD][DEBUG] ✅ Current user is logged in');
        console.log('[DASHBOARD][DEBUG] ✅ Modal will be shown to this user');
      } else {
        console.log('[DASHBOARD][DEBUG] ❌ No current user found - this should not happen');
      }
      console.log('[DASHBOARD][DEBUG] ===============================================');
      
      setQuantityConfirmation(event.detail);
    };
    window.addEventListener('quantityConfirmationRequest', handleQuantityConfirmationRequest as EventListener);
    return () => window.removeEventListener('quantityConfirmationRequest', handleQuantityConfirmationRequest as EventListener);
  }, [dashboard?.profile?.id, dashboard?.profile?.username]);

  // Listen for partial fill approval events
  useEffect(() => {
    const handlePartialFillApproval = (event: CustomEvent) => {
      setPartialFillApproval(event.detail);
    };
    window.addEventListener('quantityPartialFillApproval', handlePartialFillApproval as EventListener);
    return () => window.removeEventListener('quantityPartialFillApproval', handlePartialFillApproval as EventListener);
  }, []);
  // Listen for partial fill declined events
  useEffect(() => {
    const handlePartialFillDeclined = (event: CustomEvent) => {
      setPartialFillDeclined(event.detail?.message || 'Partial fill was declined. No trade was executed.');
      setTimeout(() => setPartialFillDeclined(null), 10000);
    };
    window.addEventListener('quantityPartialFillDeclined', handlePartialFillDeclined as EventListener);
    return () => window.removeEventListener('quantityPartialFillDeclined', handlePartialFillDeclined as EventListener);
  }, []);

  // Update improvedPrice when negotiationTurn changes
  useEffect(() => {
    if (negotiationTurn) {
      setNegotiationError("");
      // If it's your turn as BID, prefill with bestBid; if OFFER, with bestOffer
      setImprovedPrice(
        negotiationTurn.turn === 'BID' ? String(negotiationTurn.bestBid) : String(negotiationTurn.bestOffer)
      );
    }
  }, [negotiationTurn]);

  // Refetch dashboard on order matched or trade executed events
  useEffect(() => {
    const socket = websocketServiceRef.current?.getSocket();
    if (!socket) return;

    const handleOrderMatched = () => {
      console.log('[DASHBOARD] order:matched event received, refetching dashboard...');
      refetchDashboard();
    };
    const handleTradeExecuted = () => {
      console.log('[DASHBOARD] trade:executed event received, refetching dashboard...');
      refetchDashboard();
    };

    socket.on('order:matched', handleOrderMatched);
    socket.on('trade:executed', handleTradeExecuted);

    return () => {
      socket.off('order:matched', handleOrderMatched);
      socket.off('trade:executed', handleTradeExecuted);
    };
  }, [refetchDashboard]);

  // Listen for best order update events
  useEffect(() => {
    const socket = websocketServiceRef.current?.getSocket();
    if (!socket) return;
    const handleBestOrderUpdate = () => {
      refetchDashboard();
      toast.success('Market best price updated!', {
        duration: 4000,
        style: {
          background: '#10b981',
          color: '#fff',
          padding: '16px',
          borderRadius: '8px',
        },
        icon: '📈',
      });
    };
    socket.on('market:bestOrderUpdated', handleBestOrderUpdate);
    return () => {
      socket.off('market:bestOrderUpdated', handleBestOrderUpdate);
    };
  }, [refetchDashboard]);

  const handleOrderChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setOrder((prev) => ({ ...prev, [name]: name === "price" || name === "amount" ? Number(value) : value }));
    setOrderError(null);
    setOrderSuccess(null);
  };

  const handleOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOrderLoading(true);
    setOrderError(null);
    setOrderSuccess(null);
    try {
      await apiClient.createOrder(order);
      setOrderSuccess("Order placed successfully!");
      setOrder({ action: "", product: "", monthyear: "", price: 0, amount: 0 });
      refetchDashboard();
    } catch (err) {
      setOrderError(err instanceof Error ? err.message : "Order failed");
    } finally {
      setOrderLoading(false);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    setCancelLoading(orderId);
    try {
      await apiClient.cancelOrder(orderId);
      refetchDashboard();
    } catch {
      // Error handled silently
    }
    setCancelLoading(null);
  };

  const handleNegotiationResponse = async (improved: boolean) => {
    if (!negotiationTurn) return;
    setNegotiationLoading(true);
    setNegotiationError("");
    try {
      if (improved) {
        const priceNum = Number(improvedPrice);
        if (!priceNum || priceNum <= 0) {
          setNegotiationError('Please enter a valid price.');
          setNegotiationLoading(false);
          return;
        }
        // Validation: improved price must be better than current for your side
        if (negotiationTurn.turn === 'BID' && priceNum <= negotiationTurn.bestBid) {
          setNegotiationError('Your improved bid must be higher than the current best bid.');
          setNegotiationLoading(false);
          return;
        }
        if (negotiationTurn.turn === 'OFFER' && priceNum >= negotiationTurn.bestOffer) {
          setNegotiationError('Your improved offer must be lower than the current best offer.');
          setNegotiationLoading(false);
          return;
        }
        websocketServiceRef.current?.emitNegotiationResponse(negotiationTurn.asset, true, priceNum);
      } else {
        websocketServiceRef.current?.emitNegotiationResponse(negotiationTurn.asset, false);
      }
      setNegotiationTurn(null);
      toast.success(improved ? 'You submitted an improved price!' : 'You passed. Market will be broadcast.', {
        duration: 8000,
        style: {
          background: '#10b981',
          color: '#fff',
          padding: '16px',
          borderRadius: '8px',
        },
        icon: improved ? '💡' : '👋',
      });
    } catch {
      toast.error('Failed to send negotiation response', {
        duration: 8000,
        style: {
          background: '#ef4444',
          color: '#fff',
          padding: '16px',
          borderRadius: '8px',
        },
        icon: '❌',
      });
    } finally {
      setNegotiationLoading(false);
    }
  };

  const handleLogout = () => {
    console.log('[DASHBOARD DEBUG] Logout initiated, disconnecting WebSocket...');
    wsService.disconnect();
    apiClient.logout();
  };

  // Handle quantity confirmation response
  const handleQuantityConfirmationResponse = async (accepted: boolean) => {
    if (!quantityConfirmation) return;
    
    setQuantityConfirmationLoading(true);
    
    try {
      if (accepted) {
        // User wants the additional quantity
        const newQuantity = quantityConfirmation.yourQuantity + quantityConfirmation.additionalQuantity;
        console.log(`[DASHBOARD] User accepted additional quantity. New total: ${newQuantity}`);
        
        websocketServiceRef.current?.emitQuantityConfirmationResponse(
          quantityConfirmation.confirmationKey, 
          true, 
          newQuantity
        );
        
        toast.success(`You accepted the additional ${quantityConfirmation.additionalQuantity} lots. New total: ${newQuantity} lots.`, {
          duration: 12000,
          style: {
            background: '#10b981',
            color: '#fff',
            padding: '16px',
            borderRadius: '8px',
            border: '2px solid #34d399',
          },
          icon: '✅',
        });
      } else {
        // User declined the additional quantity
        console.log('[DASHBOARD] User declined additional quantity');
        
        websocketServiceRef.current?.emitQuantityConfirmationResponse(
          quantityConfirmation.confirmationKey, 
          false
        );
        
        toast.success(`You declined the additional quantity. Waiting for counterparty approval for a partial fill of ${quantityConfirmation.yourQuantity} lots.`, {
          duration: 10000,
          style: {
            background: '#3b82f6',
            color: '#fff',
            padding: '16px',
            borderRadius: '8px',
          },
          icon: '👍',
        });
      }
      
      // Close the modal
      setQuantityConfirmation(null);
      
    } catch (err) {
      console.error('[DASHBOARD] Error responding to quantity confirmation:', err);
      toast.error('Failed to send response. Please try again.', {
        duration: 10000,
        style: {
          background: '#ef4444',
          color: '#fff',
          padding: '16px',
          borderRadius: '8px',
        },
        icon: '❌',
      });
    } finally {
      setQuantityConfirmationLoading(false);
    }
  };

  // Handler for partial fill approval response
  const handlePartialFillApprovalResponse = async (accepted: boolean) => {
    if (!partialFillApproval) return;
    setPartialFillApprovalLoading(true);
    try {
      websocketServiceRef.current?.emitQuantityConfirmationResponse(
        partialFillApproval.confirmationKey,
        accepted
      );
      toast.success(accepted ? `You accepted the partial fill for ${partialFillApproval.partialFillQuantity} lots.` : 'You declined the partial fill.', {
        duration: 10000,
        style: {
          background: accepted ? '#10b981' : '#ef4444',
          color: '#fff',
          padding: '16px',
          borderRadius: '8px',
        },
        icon: accepted ? '✅' : '❌',
      });
      setPartialFillApproval(null);
    } catch (err) {
      toast.error('Failed to send response. Please try again.', {
        duration: 10000,
        style: {
          background: '#ef4444',
          color: '#fff',
          padding: '16px',
          borderRadius: '8px',
        },
        icon: '❌',
      });
    } finally {
      setPartialFillApprovalLoading(false);
    }
  };

  // Helper to determine if it's the user's turn
  const isMyTurn = negotiationTurn && ((negotiationTurn.turn === 'BID' && dashboard?.profile?.id === negotiationTurn.bestBidUserId) || (negotiationTurn.turn === 'OFFER' && dashboard?.profile?.id === negotiationTurn.bestOfferUserId));
  const myUsername = dashboard?.profile?.username || 'You';
  const counterpartyUsername = negotiationTurn && (negotiationTurn.turn === 'BID' ? negotiationTurn.bestOfferUsername : negotiationTurn.bestBidUsername);

  // Analytics placeholder
  useEffect(() => {
    if (negotiationTurn) {
      console.log(`[ANALYTICS] Negotiation turn for ${negotiationTurn.asset}:`, {
        turn: negotiationTurn.turn,
        myUsername,
        counterpartyUsername,
        bestBid: negotiationTurn.bestBid,
        bestOffer: negotiationTurn.bestOffer
      });
    }
  }, [negotiationTurn, myUsername, counterpartyUsername]);

  const openEditModal = (order: OrderResponse) => {
    setEditOrder(order);
    setEditPrice(String(order.price));
    setEditAmount(String(order.amount));
    setEditError("");
  };
  const closeEditModal = () => {
    setEditOrder(null);
    setEditPrice("");
    setEditAmount("");
    setEditError("");
  };
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editOrder) return;
    setEditLoading(true);
    setEditError("");
    try {
      const priceNum = Number(editPrice);
      const amountNum = Number(editAmount);
      if (!priceNum || priceNum <= 0) {
        setEditError('Please enter a valid price.');
        setEditLoading(false);
        return;
      }
      if (!amountNum || amountNum <= 0) {
        setEditError('Please enter a valid amount.');
        setEditLoading(false);
        return;
      }
      await apiClient.updateOrder(editOrder.id, { price: priceNum, amount: amountNum });
      closeEditModal();
      refetchDashboard();
      toast.success('Order updated successfully!', {
        duration: 8000,
        style: {
          background: '#10b981',
          color: '#fff',
          padding: '16px',
          borderRadius: '8px',
        },
        icon: '🔄',
      });
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setEditLoading(false);
    }
  };

  if (loading || !dashboard) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-white">
        <div className="flex flex-col items-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full mb-4"
          />
          <p className="text-lg text-indigo-700 font-medium">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white rounded-2xl shadow-lg p-6"
        >
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 text-white p-3 rounded-xl">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">MaiBroker Pro</h1>
              <p className="text-gray-600">
                Welcome, <span className="font-semibold text-indigo-700">{dashboard.profile.username}</span>
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Admin Panel Link */}
            {dashboard.profile.role === 'ADMIN' && (
              <a
                href="/admin"
                className="inline-flex items-center px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Admin Panel
              </a>
            )}
            
            {/* Connection Status */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleLogout}
              className="flex items-center gap-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-6 py-3 rounded-xl font-medium shadow-md transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Logout
            </motion.button>
          </div>
        </motion.header>

        {/* Connection Status */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Trading Dashboard</h1>
          <p className="text-gray-600">Real-time trading platform</p>
          
          {/* Connection Status */}
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-sm text-gray-600">
                {wsConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            
            {/* Connect Button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setWsConnecting(true);
                toast('Connecting to server...', {
                  duration: 3000,
                  icon: '⚙️',
                });
                websocketServiceRef.current?.manualConnect();
              }}
              disabled={wsConnected || wsConnecting}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium shadow-md transition-all ${
                wsConnected 
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                  : wsConnecting
                  ? 'bg-yellow-500 text-white cursor-not-allowed'
                  : 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white'
              }`}
            >
              {wsConnecting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Connecting...
                </>
              ) : wsConnected ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Connected
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Connect
                </>
              )}
            </motion.button>
            
            {/* Disconnect Button */}
            {wsConnected && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  websocketServiceRef.current?.disconnect();
                  toast('Disconnected from server', {
                    duration: 3000,
                    icon: '👋',
                  });
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium shadow-md transition-all bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Disconnect
              </motion.button>
            )}
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Place New Order Card */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100"
          >
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white">
              <h3 className="text-xl font-bold flex items-center gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                New Order
              </h3>
            </div>
            <div className="p-6">
              <form onSubmit={handleOrderSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Action</label>
                  <select
                    name="action"
                    value={order.action}
                    onChange={handleOrderChange}
                    required
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50 shadow-sm transition-all font-bold text-base"
                    style={{ color: order.action === 'bid' ? '#2563eb' : order.action === 'offer' ? '#ea580c' : '#374151' }}
                  >
                    <option value="">Select Action</option>
                    <option value="bid" style={{ color: '#2563eb', fontWeight: 'bold' }}>🟦 Bid (Buy)</option>
                    <option value="offer" style={{ color: '#ea580c', fontWeight: 'bold' }}>🟧 Offer (Sell)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Product</label>
                  <input
                    name="product"
                    value={order.product}
                    onChange={handleOrderChange}
                    required
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50 shadow-sm transition-all font-bold text-blue-900"
                    placeholder="e.g. Gold, Silver, Oil"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Month & Year</label>
                  <input
                    name="monthyear"
                    value={order.monthyear}
                    onChange={handleOrderChange}
                    required
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50 shadow-sm transition-all font-bold text-blue-900"
                    placeholder="e.g. Dec25, Jan26"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Price</label>
                    <input
                      name="price"
                      type="number"
                      step="0.01"
                      value={order.price || ""}
                      onChange={handleOrderChange}
                      required
                      className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50 shadow-sm transition-all font-bold text-blue-900"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Quantity</label>
                    <input
                      name="amount"
                      type="number"
                      value={order.amount || ""}
                      onChange={handleOrderChange}
                      required
                      className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50 shadow-sm transition-all font-bold text-blue-900"
                      placeholder="0"
                    />
                  </div>
                </div>

                <AnimatePresence>
                  {orderError && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="p-3 bg-red-50 text-red-700 rounded-lg text-sm font-medium"
                    >
                      {orderError}
                    </motion.div>
                  )}
                  {orderSuccess && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="p-3 bg-green-50 text-green-700 rounded-lg text-sm font-medium"
                    >
                      {orderSuccess}
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.button
                  type="submit"
                  disabled={orderLoading}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full bg-gradient-to-r from-green-500 to-indigo-600 hover:from-green-600 hover:to-indigo-700 text-white py-3.5 rounded-xl font-bold shadow-lg disabled:opacity-70 transition-all flex items-center justify-center gap-2"
                >
                  {orderLoading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Place Order
                    </>
                  )}
                </motion.button>
              </form>
            </div>
          </motion.div>

          {/* Market Prices Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100 lg:col-span-2"
          >
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
              <h3 className="text-xl font-bold flex items-center gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                Live Market Prices
              </h3>
            </div>
            <div className="p-6">
              {dashboard.marketData.length ? (
                <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                  {dashboard.marketData.map((data) => {
                    const highestBid = data.bids && data.bids.length > 0 ? data.bids.reduce((max, b) => b.price > max.price ? b : max, data.bids[0]) : null;
                    const lowestBid = data.bids && data.bids.length > 0 ? data.bids.reduce((min, b) => b.price < min.price ? b : min, data.bids[0]) : null;
                    return (
                      <motion.div key={data.asset} whileHover={{ scale: 1.01 }} className="p-4 border rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors duration-200">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="bg-indigo-100 p-2 rounded-lg">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                              </svg>
                            </div>
                            <div>
                              <h4 className="font-bold text-gray-800">{data.asset.toUpperCase()}</h4>
                              <p className="text-xs text-gray-500">Market Depth</p>
                            </div>
                          </div>
                          <div className="flex flex-col md:flex-row md:gap-8 gap-2">
                            <div>
                              <div className="font-semibold text-blue-700 mb-1">Bid Prices</div>
                              {data.bids.length ? (
                                <div className="flex flex-col gap-1">
                                  <div>
                                    <span className="font-bold text-blue-700">Highest: {highestBid ? `$${highestBid.price}` : '-'}</span>
                                    {highestBid && <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-xs font-semibold ml-1">{highestBid.remaining}x</span>}
                                  </div>
                                  <div>
                                    <span className="font-bold text-blue-700">Lowest: {lowestBid ? `$${lowestBid.price}` : '-'}</span>
                                    {lowestBid && <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-xs font-semibold ml-1">{lowestBid.remaining}x</span>}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-gray-400 text-sm">No bids</span>
                              )}
                            </div>
                            <div>
                              <div className="font-semibold text-orange-700 mb-1">Offers</div>
                              {data.offers.length ? (
                                <div className="flex flex-col gap-1">
                                  {data.offers.map((offer) => (
                                    <div key={offer.id} className="flex items-center gap-2 text-base font-mono">
                                      <span className="font-bold text-orange-700">${offer.price}</span>
                                      <span className="bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full text-xs font-semibold ml-1">{offer.remaining}x</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-gray-400 text-sm">No offers</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-lg font-medium">No market data available</p>
                  <p className="text-sm">Market prices will appear here when available</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Your Orders Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100"
        >
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-6 text-white">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold flex items-center gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Your Active Orders
              </h3>
              <span className="bg-white/20 px-4 py-1 rounded-full text-sm font-semibold">
                {dashboard.orders.length} {dashboard.orders.length === 1 ? "order" : "orders"}
              </span>
            </div>
          </div>
          <div className="p-6">
            {dashboard.orders.length ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order ID</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Asset</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Remaining</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {dashboard.orders.map((order) => (
                      <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-gray-900">{order.id.slice(0, 8)}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {order.action.toLowerCase() === "bid" ? (
                            <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800 font-bold">
                              🟢 BID
                            </span>
                          ) : (
                            <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-orange-100 text-orange-800 font-bold">
                              🟠 OFFER
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-blue-900">{order.asset}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-blue-700">${order.price}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{order.amount}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{order.remaining}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            order.status === 'active' ? 'bg-blue-100 text-blue-800' :
                            order.status === 'matched' ? 'bg-green-100 text-green-800' :
                            order.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {order.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                          {(order.status.toLowerCase() === 'active') && (
                            <div className="flex gap-2 items-center">
                              <motion.button
                                whileHover={{ scale: 1.08 }}
                                whileTap={{ scale: 0.96 }}
                                onClick={() => openEditModal(order)}
                                className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 transition disabled:opacity-50"
                                title="Edit Order"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13h3l8-8a2.828 2.828 0 10-4-4l-8 8v3zm0 0v3h3" /></svg>
                                Edit
                              </motion.button>
                              <motion.button
                                whileHover={{ scale: 1.08 }}
                                whileTap={{ scale: 0.96 }}
                                onClick={() => handleCancelOrder(order.id)}
                                disabled={cancelLoading === order.id}
                                className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-red-600 text-white font-semibold shadow hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400 transition disabled:opacity-50"
                                title="Cancel Order"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                {cancelLoading === order.id ? 'Cancelling...' : 'Cancel'}
                              </motion.button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p className="text-lg font-medium">No active orders</p>
                <p className="text-sm">Place your first order to get started</p>
              </div>
            )}
          </div>
        </motion.div>

        {/* My Trades Card - NEW */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100"
        >
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 text-white">
            <h3 className="text-xl font-bold flex items-center gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              My Trades
            </h3>
            <p className="text-purple-100 text-sm mt-1">Your trading history</p>
          </div>
          <div className="p-6">
            {dashboard.userTrades && dashboard.userTrades.length ? (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {dashboard.userTrades.slice(0, 10).map((trade) => {
                  const isUserBuyer = trade.buyerId === dashboard.profile.id;
                  const role = isUserBuyer ? 'BOUGHT' : 'SOLD';
                  const roleColor = isUserBuyer ? 'text-blue-600' : 'text-orange-600';
                  const roleIcon = isUserBuyer ? '🟢' : '🟠';
                  
                  return (
                    <motion.div
                      key={trade.id}
                      whileHover={{ scale: 1.01 }}
                      className="p-4 border rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors duration-200"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{roleIcon}</span>
                            <h4 className="font-semibold text-gray-800">{trade.asset}</h4>
                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${roleColor} bg-gray-100`}>
                              {role}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500 mt-1">
                            {isUserBuyer ? 
                              `Bought from ${trade.sellerId}` : 
                              `Sold to ${trade.buyerId}`
                            }
                          </p>
                          <p className="text-xs text-gray-400">
                            {new Date(trade.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-green-600">${trade.price}</p>
                          <p className="text-sm text-gray-500">{trade.amount} units</p>
                          <p className="text-xs text-gray-400 font-mono">
                            Total: ${(Number(trade.price) * Number(trade.amount)).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <p className="text-lg font-medium">No trades yet</p>
                <p className="text-sm">Your completed trades will appear here</p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Recent Trades Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100"
        >
          <div className="bg-gradient-to-r from-green-600 to-blue-600 p-6 text-white">
            <h3 className="text-xl font-bold flex items-center gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              Recent Trades (All Users)
            </h3>
            <p className="text-green-100 text-sm mt-1">Latest market activity</p>
          </div>
          <div className="p-6">
            {dashboard.trades.length ? (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {dashboard.trades.slice(0, 10).map((trade) => (
                  <motion.div
                    key={trade.id}
                    whileHover={{ scale: 1.01 }}
                    className="p-4 border rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors duration-200"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="font-semibold text-gray-800">{trade.asset}</h4>
                        <p className="text-sm text-gray-500">
                          {trade.buyerId} → {trade.sellerId}
                        </p>
                        <p className="text-xs text-gray-400">
                          {new Date(trade.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-green-600">${trade.price}</p>
                        <p className="text-sm text-gray-500">{trade.amount} units</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                <p className="text-lg font-medium">No recent trades</p>
                <p className="text-sm">Trades will appear here when executed</p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Account Summary Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100"
        >
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white">
            <h3 className="text-xl font-bold flex items-center gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Account Summary
            </h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-xl">
                <p className="text-2xl font-bold text-blue-600">{dashboard.summary.total_orders}</p>
                <p className="text-sm text-gray-600">Total Orders</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-xl">
                <p className="text-2xl font-bold text-green-600">{dashboard.summary.active_orders}</p>
                <p className="text-sm text-gray-600">Active Orders</p>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-xl">
                <p className="text-2xl font-bold text-purple-600">{dashboard.summary.total_trades}</p>
                <p className="text-sm text-gray-600">Total Trades</p>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-xl">
                <p className="text-2xl font-bold text-orange-600">{dashboard.summary.total_volume}</p>
                <p className="text-sm text-gray-600">Total Volume</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
      <AnimatePresence>
        {negotiationTurn && negotiationTurn.turn === 'BID' && dashboard?.profile?.id === negotiationTurn.bestBidUserId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/30"
          >
            <div className="bg-white rounded-3xl shadow-2xl p-10 max-w-md w-full flex flex-col items-center border-2 border-indigo-100">
              <h2 className="text-2xl font-extrabold mb-3 text-indigo-600 tracking-wide">Negotiation Turn</h2>
              <p className="mb-2 text-gray-700 text-base">It&apos;s your turn to respond to the market for <span className="font-bold">{negotiationTurn.asset}</span>:</p>
              <div className="mb-2 text-lg font-bold">
                You are the <span className={negotiationTurn.turn === 'BID' ? 'text-blue-700' : 'text-orange-700'}>{negotiationTurn.turn === 'BID' ? 'Bidder (Buyer)' : 'Seller (Offer)'}</span>
              </div>
              <div className="mb-2 text-base text-gray-700">
                <span className="font-semibold">Your username:</span> {myUsername}<br />
                <span className="font-semibold">Counterparty:</span> {counterpartyUsername || 'Unknown'}
              </div>
              <div className="mb-6 text-center space-y-2">
                <span className="block text-3xl font-extrabold text-indigo-700">Bid: ${negotiationTurn.bestBid}</span>
                <span className="block text-3xl font-extrabold text-orange-700">Offer: ${negotiationTurn.bestOffer}</span>
                <span className="block text-base text-gray-500">{negotiationTurn.message}</span>
              </div>
              <div className="flex flex-col gap-4 w-full items-center">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={improvedPrice}
                  onChange={e => setImprovedPrice(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50 shadow-sm text-lg font-bold text-blue-900 mb-2"
                  placeholder="Enter your improved price"
                  disabled={negotiationLoading || !isMyTurn}
                />
                {negotiationError && (
                  <div className="text-red-600 text-sm font-semibold mb-2">{negotiationError}</div>
                )}
                <div className="flex gap-6 w-full justify-center">
                  <button
                    className="px-8 py-3 rounded-xl bg-gradient-to-r from-green-500 to-blue-600 text-white font-bold text-lg shadow-lg hover:from-green-600 hover:to-blue-700 transition"
                    onClick={() => handleNegotiationResponse(true)}
                    disabled={negotiationLoading || !isMyTurn}
                  >
                    Submit Improved Price
                  </button>
                  <button
                    className="px-8 py-3 rounded-xl bg-gray-200 text-gray-700 font-bold text-lg shadow hover:bg-gray-300 transition"
                    onClick={() => handleNegotiationResponse(false)}
                    disabled={negotiationLoading || !isMyTurn}
                  >
                    Pass
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {editOrder && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/30"
          >
            <div className="bg-white rounded-3xl shadow-2xl p-10 max-w-md w-full flex flex-col items-center border-2 border-indigo-100">
              <h2 className="text-2xl font-extrabold mb-3 text-indigo-600 tracking-wide">Edit Order</h2>
              <form onSubmit={handleEditSubmit} className="w-full flex flex-col gap-4">
                <label className="text-sm font-semibold text-gray-700">Price</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editPrice}
                  onChange={e => setEditPrice(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50 shadow-sm text-lg font-bold text-blue-900"
                  required
                  disabled={editLoading}
                />
                <label className="text-sm font-semibold text-gray-700">Amount</label>
                <input
                  type="number"
                  min="0"
                  value={editAmount}
                  onChange={e => setEditAmount(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50 shadow-sm text-lg font-bold text-blue-900"
                  required
                  disabled={editLoading}
                />
                {editError && <div className="text-red-600 text-sm font-semibold mb-2">{editError}</div>}
                <div className="flex gap-4 mt-2">
                  <button
                    type="submit"
                    className="px-8 py-3 rounded-xl bg-gradient-to-r from-green-500 to-blue-600 text-white font-bold text-lg shadow-lg hover:from-green-600 hover:to-blue-700 transition"
                    disabled={editLoading}
                  >
                    {editLoading ? 'Updating...' : 'Update Order'}
                  </button>
                  <button
                    type="button"
                    className="px-8 py-3 rounded-xl bg-gray-200 text-gray-700 font-bold text-lg shadow hover:bg-gray-300 transition"
                    onClick={closeEditModal}
                    disabled={editLoading}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {quantityConfirmation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/30"
          >
            <div className="bg-white rounded-3xl shadow-2xl p-10 max-w-lg w-full flex flex-col items-center border-2 border-indigo-100">
              <h2 className="text-2xl font-extrabold mb-4 text-indigo-600 tracking-wide">Additional Quantity Available</h2>
              
              <div className="mb-6 text-center space-y-3">
                <div className="bg-blue-50 p-4 rounded-xl">
                  <h3 className="text-lg font-bold text-blue-900">Order Details</h3>
                  <p className="text-blue-800">Asset: <span className="font-bold">{quantityConfirmation.asset}</span></p>
                  <p className="text-blue-800">Price: <span className="font-bold">${quantityConfirmation.price}</span></p>
                  <p className="text-blue-800">Your current quantity: <span className="font-bold">{quantityConfirmation.yourQuantity} lots</span></p>
                  <p className="text-blue-800">Additional available: <span className="font-bold text-green-600">{quantityConfirmation.additionalQuantity} lots</span></p>
                </div>
                
                <div className="bg-green-50 p-4 rounded-xl">
                  <p className="text-green-900 font-semibold">
                    {quantityConfirmation.side === 'BUY' ? 'Do you want to buy' : 'Do you want to sell'} an additional{' '}
                    <span className="font-bold text-lg">{quantityConfirmation.additionalQuantity} lots</span>?
                  </p>
                  <p className="text-green-800 text-sm mt-1">
                    Total would be: <span className="font-bold">{quantityConfirmation.yourQuantity + quantityConfirmation.additionalQuantity} lots</span> at ${quantityConfirmation.price}
                  </p>
                </div>
              </div>
              
              <div className="flex gap-4 w-full justify-center">
                <button
                  className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-green-500 to-green-600 text-white font-bold text-lg shadow-lg hover:from-green-600 hover:to-green-700 transition disabled:opacity-50"
                  onClick={() => handleQuantityConfirmationResponse(true)}
                  disabled={quantityConfirmationLoading}
                >
                  {quantityConfirmationLoading ? 'Processing...' : `Yes, ${quantityConfirmation.side === 'BUY' ? 'Buy' : 'Sell'} ${quantityConfirmation.additionalQuantity} More`}
                </button>
                <button
                  className="flex-1 px-6 py-3 rounded-xl bg-gray-200 text-gray-700 font-bold text-lg shadow hover:bg-gray-300 transition disabled:opacity-50"
                  onClick={() => handleQuantityConfirmationResponse(false)}
                  disabled={quantityConfirmationLoading}
                >
                  {quantityConfirmationLoading ? 'Processing...' : 'No, Keep Original'}
                </button>
              </div>
              
              <p className="text-xs text-gray-500 mt-4 text-center">
                You have 60 seconds to respond. If no response, trade will proceed with original quantity.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {partialFillApproval && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/30"
          >
            <div className="bg-white rounded-3xl shadow-2xl p-10 max-w-lg w-full flex flex-col items-center border-2 border-indigo-100">
              <h2 className="text-2xl font-extrabold mb-4 text-indigo-600 tracking-wide">Partial Fill Approval Needed</h2>
              <div className="mb-6 text-center space-y-3">
                <div className="bg-blue-50 p-4 rounded-xl">
                  <h3 className="text-lg font-bold text-blue-900">Order Details</h3>
                  <p className="text-blue-800">Asset: <span className="font-bold">{partialFillApproval.asset}</span></p>
                  <p className="text-blue-800">Price: <span className="font-bold">${partialFillApproval.price}</span></p>
                  <p className="text-blue-800">Your order: <span className="font-bold">{partialFillApproval.yourQuantity} lots</span></p>
                  <p className="text-blue-800">Counterparty: <span className="font-bold text-green-600">{partialFillApproval.partialFillQuantity} lots</span></p>
                </div>
                <div className="bg-yellow-50 p-4 rounded-xl">
                  <p className="text-yellow-900 font-semibold">
                    Do you want to {partialFillApproval.side === 'BUY' ? 'buy' : 'sell'} only <span className="font-bold text-lg">{partialFillApproval.partialFillQuantity} lots</span> at ${partialFillApproval.price}?
                  </p>
                  <p className="text-yellow-800 text-sm mt-1">
                    If you decline, your order will remain active for the full amount.
                  </p>
                </div>
              </div>
              <div className="flex gap-4 w-full justify-center">
                <button
                  className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-green-500 to-green-600 text-white font-bold text-lg shadow-lg hover:from-green-600 hover:to-green-700 transition disabled:opacity-50"
                  onClick={() => handlePartialFillApprovalResponse(true)}
                  disabled={partialFillApprovalLoading}
                >
                  {partialFillApprovalLoading ? 'Processing...' : `Yes, ${partialFillApproval.side === 'BUY' ? 'Buy' : 'Sell'} ${partialFillApproval.partialFillQuantity}`}
                </button>
                <button
                  className="flex-1 px-6 py-3 rounded-xl bg-gray-200 text-gray-700 font-bold text-lg shadow hover:bg-gray-300 transition disabled:opacity-50"
                  onClick={() => handlePartialFillApprovalResponse(false)}
                  disabled={partialFillApprovalLoading}
                >
                  {partialFillApprovalLoading ? 'Processing...' : 'No, Keep My Order'}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-4 text-center">
                You have 60 seconds to respond. If no response, your order will remain active.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {partialFillDeclined && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/30"
          >
            <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full flex flex-col items-center border-2 border-red-100">
              <h2 className="text-xl font-bold mb-2 text-red-600">Partial Fill Declined</h2>
              <p className="text-gray-700 text-center mb-4">{partialFillDeclined}</p>
              <button
                className="px-6 py-2 rounded-xl bg-red-500 text-white font-bold text-lg shadow hover:bg-red-600 transition"
                onClick={() => setPartialFillDeclined(null)}
              >
                Close
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}