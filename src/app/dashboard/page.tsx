"use client";

import React, { useEffect, useState, useRef } from "react";
import { apiClient, DashboardResponse, OrderRequest, OrderResponse } from "@/lib/api";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { WebSocketService } from '@/lib/websocket';
import toast from 'react-hot-toast';

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
  const [pendingApproval, setPendingApproval] = useState<any>(null);
  const [approvalLoading, setApprovalLoading] = useState(false);
  const router = useRouter();
  const websocketServiceRef = useRef<WebSocketService | null>(null);

  // Track handled approvals to prevent duplicate modals
  const handledApprovalsRef = useRef<Set<string>>(new Set());

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

  // WebSocket connection
  useEffect(() => {
    if (typeof window !== "undefined" && !websocketServiceRef.current) {
      websocketServiceRef.current = new WebSocketService();
      websocketServiceRef.current.connect();
    }
    return () => {
      websocketServiceRef.current?.disconnect();
    };
  }, []);

  // Listen for market updates
  useEffect(() => {
    const handleMarketUpdate = () => {
      refetchDashboard();
    };

    window.addEventListener('marketUpdate', handleMarketUpdate);
    return () => window.removeEventListener('marketUpdate', handleMarketUpdate);
  }, [refetchDashboard]);

  // Listen for seller approval events
  useEffect(() => {
    const socket = websocketServiceRef.current?.getSocket();
    if (!socket) return;
    const handler = (event: any) => {
      const approvalKey = `${event.data.offerId}:${event.data.bidId}`;
      if (!handledApprovalsRef.current.has(approvalKey)) {
        setPendingApproval(event.data);
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

  useEffect(() => {
    if (pendingApproval) {
      console.log('[SELLER APPROVAL] Modal is visible for approval:', pendingApproval);
    } else {
      console.log('[SELLER APPROVAL] Modal is hidden.');
    }
  }, [pendingApproval]);

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
    } catch {}
    setCancelLoading(null);
  };

  // When modal is closed (after approve/reject), allow future approvals for new matches
  const handleSellerApproval = async (approved: boolean) => {
    if (!pendingApproval) return;
    setApprovalLoading(true);
    try {
      const sellerUserId = dashboard?.profile?.id || '';
      websocketServiceRef.current?.emitSellerApprovalResponse(
        pendingApproval.offerId,
        pendingApproval.bidId,
        approved,
        sellerUserId
      );
      setPendingApproval(null);
      refetchDashboard();
      toast.success(approved ? 'Trade approved!' : 'Trade rejected.');
      // Optionally, remove the approvalKey from handledApprovalsRef if you want to allow re-approval in the future
    } catch (err) {
      toast.error('Failed to send approval response');
    } finally {
      setApprovalLoading(false);
    }
  };

  const handleLogout = () => {
    apiClient.logout();
    router.push("/");
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
        </motion.header>

        {/* Connection Status */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Trading Dashboard</h1>
          <p className="text-gray-600">Real-time trading platform</p>
          
          {/* Connection Status */}
          <div className="mt-4 flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${websocketServiceRef.current?.isSocketConnected() ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm text-gray-600">
              {websocketServiceRef.current?.isSocketConnected() ? 'Connected' : 'Disconnected'}
            </span>
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
                  {dashboard.marketData.map((data) => (
                    <motion.div
                      key={data.asset}
                      whileHover={{ scale: 1.01 }}
                      className="p-4 border rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors duration-200"
                    >
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
                            <div className="font-semibold text-blue-700 mb-1">Bids</div>
                            {data.bids && data.bids.length > 0 ? (
                              <ul>
                                {data.bids.map((bid: OrderResponse) => (
                                  <li key={bid.id} className="flex items-center gap-2 text-base font-mono">
                                    <span className="w-3 h-3 bg-blue-500 rounded-full inline-block"></span>
                                    <span className="font-bold text-blue-700">${bid.price}</span>
                                    <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-xs font-semibold ml-1">{bid.remaining}x</span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <span className="text-gray-400 text-sm">No bids</span>
                            )}
                          </div>
                          <div>
                            <div className="font-semibold text-orange-700 mb-1">Offers</div>
                            {data.offers && data.offers.length > 0 ? (
                              <ul>
                                {data.offers.map((offer: OrderResponse) => (
                                  <li key={offer.id} className="flex items-center gap-2 text-base font-mono">
                                    <span className="w-3 h-3 bg-orange-500 rounded-full inline-block"></span>
                                    <span className="font-bold text-orange-700">${offer.price}</span>
                                    <span className="bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full text-xs font-semibold ml-1">{offer.remaining}x</span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <span className="text-gray-400 text-sm">No offers</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
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
                          {order.action === "bid" ? (
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
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => handleCancelOrder(order.id)}
                              disabled={cancelLoading === order.id}
                              className="text-red-600 hover:text-red-900 disabled:opacity-50"
                            >
                              {cancelLoading === order.id ? 'Cancelling...' : 'Cancel'}
                            </motion.button>
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

        {/* Recent Trades Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100"
        >
          <div className="bg-gradient-to-r from-green-600 to-blue-600 p-6 text-white">
            <h3 className="text-xl font-bold flex items-center gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              Recent Trades
            </h3>
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
          transition={{ delay: 0.5 }}
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
        {pendingApproval && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/30"
          >
            <div className="bg-white rounded-3xl shadow-2xl p-10 max-w-md w-full flex flex-col items-center border-2 border-indigo-100">
              <h2 className="text-2xl font-extrabold mb-3 text-orange-600 tracking-wide">Seller Approval Required</h2>
              <p className="mb-4 text-gray-700 text-base">A buyer wants to purchase your offer:</p>
              <div className="mb-6 text-center space-y-2">
                <span className="block text-3xl font-extrabold text-indigo-700">{pendingApproval.amount ?? 'N/A'}x</span>
                <span className="block text-xl font-bold text-indigo-600 uppercase tracking-wider">{pendingApproval.asset ?? 'N/A'}</span>
                <span className="block text-lg font-bold text-green-700">@ ${pendingApproval.price ?? 'N/A'}</span>
                <span className="block text-base text-gray-500">Product: {pendingApproval.product || 'N/A'}</span>
                <span className="block text-base text-gray-500">Contract: {pendingApproval.monthyear || 'N/A'}</span>
                {/* Buyer details section */}
                {(pendingApproval.buyerUsername || pendingApproval.buyerEmail || pendingApproval.buyerPhone || pendingApproval.buyerId) && (
                  <div className="mt-4 p-3 rounded-xl bg-indigo-50 border border-indigo-100 text-left">
                    <div className="font-semibold text-indigo-700 mb-1">Buyer Details</div>
                    {pendingApproval.buyerUsername && (
                      <div className="text-sm text-gray-700">Username: <span className="font-bold">{pendingApproval.buyerUsername}</span></div>
                    )}
                    {pendingApproval.buyerEmail && (
                      <div className="text-sm text-gray-700">Email: <span className="font-bold">{pendingApproval.buyerEmail}</span></div>
                    )}
                    {pendingApproval.buyerPhone && (
                      <div className="text-sm text-gray-700">Phone: <span className="font-bold">{pendingApproval.buyerPhone}</span></div>
                    )}
                    {pendingApproval.buyerId && (
                      <div className="text-sm text-gray-500">User ID: <span className="font-mono">{pendingApproval.buyerId}</span></div>
                    )}
                  </div>
                )}
              </div>
              <div className="flex gap-6 mt-2 w-full justify-center">
                <button
                  className="px-8 py-3 rounded-xl bg-gradient-to-r from-green-500 to-blue-600 text-white font-bold text-lg shadow-lg hover:from-green-600 hover:to-blue-700 transition"
                  onClick={() => handleSellerApproval(true)}
                  disabled={approvalLoading}
                >
                  Approve
                </button>
                <button
                  className="px-8 py-3 rounded-xl bg-gray-200 text-gray-700 font-bold text-lg shadow hover:bg-gray-300 transition"
                  onClick={() => handleSellerApproval(false)}
                  disabled={approvalLoading}
                >
                  Reject
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}