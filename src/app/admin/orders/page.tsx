"use client";

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  ShoppingCart,
  Users,
  Filter,
  Search,
  X,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
  ArrowLeft,
  Download
} from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api';

interface Order {
  id: string;
  action: string;
  asset: string;
  price: number;
  amount: number;
  remaining: number;
  status: string;
  createdAt: string;
  userId: string;
  user: { username: string; phone: string };
}

export default function AdminOrdersPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    status: '',
    asset: '',
    search: ''
  });
  const [cancellingOrder, setCancellingOrder] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Fetch orders with filters
  const { data: ordersData, isLoading, refetch } = useQuery({
    queryKey: ['admin-orders', page, filters],
    queryFn: async () => {
      const params: { page: number; limit: number; status?: string; asset?: string } = { page, limit: 20 };
      if (filters.status) params.status = filters.status;
      if (filters.asset) params.asset = filters.asset;
      return apiClient.getAdminOrders(params);
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const handleCancelOrder = async () => {
    if (!selectedOrder) return;
    
    setCancellingOrder(selectedOrder.id);
    try {
      await apiClient.cancelAdminOrder(selectedOrder.id, cancelReason);
      toast.success('Order cancelled successfully');
      setShowCancelModal(false);
      setSelectedOrder(null);
      setCancelReason('');
      refetch();
    } catch {
      toast.error('Failed to cancel order');
    } finally {
      setCancellingOrder(null);
    }
  };

  const openCancelModal = (order: Order) => {
    setSelectedOrder(order);
    setShowCancelModal(true);
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active': return <Clock className="h-4 w-4 text-blue-500" />;
      case 'matched': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'cancelled': return <XCircle className="h-4 w-4 text-red-500" />;
      default: return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active': return 'bg-blue-100 text-blue-800';
      case 'matched': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredOrders = ordersData?.orders?.filter(order => {
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      return (
        order.user.username.toLowerCase().includes(searchLower) ||
        order.asset.toLowerCase().includes(searchLower) ||
        order.id.toLowerCase().includes(searchLower) ||
        order.user.phone.includes(filters.search)
      );
    }
    return true;
  }) || [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <button
                onClick={() => router.back()}
                className="mr-4 p-2 rounded-lg hover:bg-gray-100"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </button>
              <ShoppingCart className="h-8 w-8 text-indigo-600 mr-3" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Order Management</h1>
                <p className="text-sm text-gray-500">Monitor and manage all customer orders</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <button
                onClick={() => refetch()}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center">
              <Filter className="h-5 w-5 text-gray-600 mr-2" />
              <span className="text-sm font-semibold text-gray-800">Filters:</span>
            </div>
            
            <div className="flex items-center space-x-2">
              <Search className="h-4 w-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search orders, users, assets..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm w-64 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 placeholder-gray-500"
              />
            </div>
            
            <select
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 bg-white"
            >
              <option value="" className="text-gray-900">All Status</option>
              <option value="ACTIVE" className="text-gray-900">Active</option>
              <option value="MATCHED" className="text-gray-900">Matched</option>
              <option value="CANCELLED" className="text-gray-900">Cancelled</option>
            </select>
            
            <select
              value={filters.asset}
              onChange={(e) => setFilters(prev => ({ ...prev, asset: e.target.value }))}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 bg-white"
            >
              <option value="" className="text-gray-900">All Assets</option>
              <option value="dec12-gold" className="text-gray-900">Dec12 Gold</option>
              <option value="dec12-silver" className="text-gray-900">Dec12 Silver</option>
              <option value="jan25-oil" className="text-gray-900">Jan25 Oil</option>
            </select>
            
            {(filters.status || filters.asset || filters.search) && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setFilters({ status: '', asset: '', search: '' })}
                className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-700 bg-white hover:bg-gray-50 focus:ring-2 focus:ring-indigo-500 font-medium"
              >
                <X className="h-4 w-4 mr-1" />
                Clear Filters
              </motion.button>
            )}
          </div>
        </div>

        {/* Orders Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">
              Orders ({filteredOrders.length} of {ordersData?.pagination.total || 0})
            </h3>
          </div>
          
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="mt-2 text-gray-500">Loading orders...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Asset</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Remaining</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredOrders.map((order) => (
                    <motion.tr
                      key={order.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="hover:bg-gray-50"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                        {order.id.slice(0, 8)}...
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-8 w-8 bg-indigo-100 rounded-full flex items-center justify-center">
                            <Users className="h-4 w-4 text-indigo-600" />
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-medium text-gray-900">{order.user.username}</div>
                            <div className="text-sm text-gray-500">{order.user.phone}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          order.action === 'BID' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'
                        }`}>
                          {order.action === 'BID' ? '🟢 BID' : '🟠 OFFER'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {order.asset}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${order.price}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {order.amount}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {order.remaining}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                          {getStatusIcon(order.status)}
                          <span className="ml-1">{order.status}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(order.createdAt).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {order.status === 'ACTIVE' && (
                          <button
                            onClick={() => openCancelModal(order)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Cancel
                          </button>
                        )}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {ordersData?.pagination && (
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing {((page - 1) * 20) + 1} to {Math.min(page * 20, ordersData.pagination.total)} of {ordersData.pagination.total} orders
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={page >= ordersData.pagination.pages}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Cancel Order Modal */}
      {showCancelModal && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/30">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Cancel Order</h3>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to cancel order {selectedOrder.id.slice(0, 8)}... by {selectedOrder.user.username}?
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cancellation Reason (Optional)
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                rows={3}
                placeholder="Enter reason for cancellation..."
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowCancelModal(false);
                  setSelectedOrder(null);
                  setCancelReason('');
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCancelOrder}
                disabled={cancellingOrder === selectedOrder.id}
                className="px-4 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700 disabled:opacity-50"
              >
                {cancellingOrder === selectedOrder.id ? 'Cancelling...' : 'Confirm Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 