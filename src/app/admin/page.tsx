"use client";

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  Users, 
  ShoppingCart, 
  TrendingUp, 
  Activity, 
  BarChart3, 
  MessageSquare,
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Database,
  Server
} from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api';

interface AdminDashboardData {
  overview: {
    totalUsers: number;
    activeUsers: number;
    totalOrders: number;
    activeOrders: number;
    totalTrades: number;
    todayTrades: number;
  };
  systemHealth: {
    database: boolean;
    redis: boolean;
    matchingEngine: boolean;
    overall: string;
  };
  whatsappMessages: {
    messages: number;
    orders: number;
    errors: number;
  };
  topAssets: Array<{
    asset: string;
    _count: { asset: number };
    _sum: { amount: number };
  }>;
}

export default function AdminDashboard() {
  const router = useRouter();
  
  // Fetch admin dashboard data
  const { data: dashboard, isLoading, error, refetch } = useQuery<AdminDashboardData>({
    queryKey: ['admin-dashboard'],
    queryFn: async () => {
      console.log('[ADMIN DEBUG] Using apiClient.getAdminDashboard()...');
      
      // Use the apiClient method which has the correct base URL configured
      const response = await apiClient.getAdminDashboard();
      
      console.log('[ADMIN DEBUG] Admin dashboard response received:', response);
      return response as AdminDashboardData;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">You don&apos;t have permission to access the admin panel.</p>
        </div>
      </div>
    );
  }

  const handleRefresh = () => {
    refetch();
    toast.success('Data refreshed');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <Shield className="h-8 w-8 text-indigo-600 mr-3" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">MaiBroker Admin</h1>
                <p className="text-sm text-gray-500">Trading Platform Administration</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* System Health Status */}
              <div className="flex items-center space-x-2">
                <div className={`flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                  dashboard?.systemHealth.overall === 'healthy' 
                    ? 'bg-green-100 text-green-800'
                    : dashboard?.systemHealth.overall === 'degraded'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {dashboard?.systemHealth.overall === 'healthy' ? (
                    <CheckCircle className="h-3 w-3 mr-1" />
                  ) : dashboard?.systemHealth.overall === 'degraded' ? (
                    <AlertTriangle className="h-3 w-3 mr-1" />
                  ) : (
                    <XCircle className="h-3 w-3 mr-1" />
                  )}
                  {dashboard?.systemHealth.overall?.toUpperCase() || 'UNKNOWN'}
                </div>
              </div>

              <button
                onClick={handleRefresh}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg shadow p-4 sm:p-6 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) :
          <div className="space-y-6 sm:space-y-8">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white rounded-lg shadow p-4 sm:p-6"
              >
                <div className="flex items-center">
                  <div className="flex-shrink-0 p-2 sm:p-3 rounded-lg bg-blue-100">
                    <Users className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
                  </div>
                  <div className="ml-3 sm:ml-4 flex-1">
                    <p className="text-xs sm:text-sm font-medium text-gray-600">Total Users</p>
                    <p className="text-xl sm:text-2xl font-semibold text-gray-900">{dashboard?.overview.totalUsers || 0}</p>
                  </div>
                </div>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white rounded-lg shadow p-4 sm:p-6"
              >
                <div className="flex items-center">
                  <div className="flex-shrink-0 p-2 sm:p-3 rounded-lg bg-green-100">
                    <Activity className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
                  </div>
                  <div className="ml-3 sm:ml-4 flex-1">
                    <p className="text-xs sm:text-sm font-medium text-gray-600">Active Users (24h)</p>
                    <p className="text-xl sm:text-2xl font-semibold text-gray-900">{dashboard?.overview.activeUsers || 0}</p>
                  </div>
                </div>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-white rounded-lg shadow p-4 sm:p-6"
              >
                <div className="flex items-center">
                  <div className="flex-shrink-0 p-2 sm:p-3 rounded-lg bg-purple-100">
                    <ShoppingCart className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600" />
                  </div>
                  <div className="ml-3 sm:ml-4 flex-1">
                    <p className="text-xs sm:text-sm font-medium text-gray-600">Active Orders</p>
                    <p className="text-xl sm:text-2xl font-semibold text-gray-900">{dashboard?.overview.activeOrders || 0}</p>
                  </div>
                </div>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-white rounded-lg shadow p-4 sm:p-6"
              >
                <div className="flex items-center">
                  <div className="flex-shrink-0 p-2 sm:p-3 rounded-lg bg-indigo-100">
                    <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-indigo-600" />
                  </div>
                  <div className="ml-3 sm:ml-4 flex-1">
                    <p className="text-xs sm:text-sm font-medium text-gray-600">Total Trades</p>
                    <p className="text-xl sm:text-2xl font-semibold text-gray-900">{dashboard?.overview.totalTrades || 0}</p>
                  </div>
                </div>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="bg-white rounded-lg shadow p-4 sm:p-6"
              >
                <div className="flex items-center">
                  <div className="flex-shrink-0 p-2 sm:p-3 rounded-lg bg-pink-100">
                    <BarChart3 className="h-5 w-5 sm:h-6 sm:w-6 text-pink-600" />
                  </div>
                  <div className="ml-3 sm:ml-4 flex-1">
                    <p className="text-xs sm:text-sm font-medium text-gray-600">Today&apos;s Trades</p>
                    <p className="text-xl sm:text-2xl font-semibold text-gray-900">{dashboard?.overview.todayTrades || 0}</p>
                  </div>
                </div>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="bg-white rounded-lg shadow p-4 sm:p-6"
              >
                <div className="flex items-center">
                  <div className="flex-shrink-0 p-2 sm:p-3 rounded-lg bg-green-100">
                    <MessageSquare className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
                  </div>
                  <div className="ml-3 sm:ml-4 flex-1">
                    <p className="text-xs sm:text-sm font-medium text-gray-600">WhatsApp Messages</p>
                    <p className="text-xl sm:text-2xl font-semibold text-gray-900">{dashboard?.whatsappMessages.messages || 0}</p>
                  </div>
                </div>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="bg-white rounded-lg shadow p-4 sm:p-6"
              >
                <div className="flex items-center">
                  <div className="flex-shrink-0 p-2 sm:p-3 rounded-lg bg-blue-100">
                    <MessageSquare className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
                  </div>
                  <div className="ml-3 sm:ml-4 flex-1">
                    <p className="text-xs sm:text-sm font-medium text-gray-600">WhatsApp Orders</p>
                    <p className="text-xl sm:text-2xl font-semibold text-gray-900">{dashboard?.whatsappMessages.orders || 0}</p>
                  </div>
                </div>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="bg-white rounded-lg shadow p-4 sm:p-6"
              >
                <div className="flex items-center">
                  <div className="flex-shrink-0 p-2 sm:p-3 rounded-lg bg-red-100">
                    <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6 text-red-600" />
                  </div>
                  <div className="ml-3 sm:ml-4 flex-1">
                    <p className="text-xs sm:text-sm font-medium text-gray-600">WhatsApp Errors</p>
                    <p className="text-xl sm:text-2xl font-semibold text-gray-900">{dashboard?.whatsappMessages.errors || 0}</p>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Admin Actions Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white rounded-lg shadow p-4 sm:p-6"
              >
                <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-3 sm:mb-4 flex items-center">
                  <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-purple-600" />
                  Order Management
                </h3>
                <p className="text-sm text-gray-600 mb-3 sm:mb-4">View and manage all customer orders, including active, completed, and cancelled orders.</p>
                <div className="space-y-1 sm:space-y-2 text-sm text-gray-500 mb-4">
                  <p>• View order details and customer info</p>
                  <p>• Cancel orders with admin privileges</p>
                  <p>• Filter by status, asset, and customer</p>
                  <p>• Export order data for analysis</p>
                </div>
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => router.push('/admin/orders')}
                  className="w-full bg-purple-600 text-white px-4 py-3 rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center font-medium shadow-lg text-sm sm:text-base"
                >
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Manage Orders
                </motion.button>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white rounded-lg shadow p-4 sm:p-6"
              >
                <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-3 sm:mb-4 flex items-center">
                  <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-green-600" />
                  Trade Monitoring
                </h3>
                <p className="text-sm text-gray-600 mb-3 sm:mb-4">Monitor all executed trades with detailed buyer and seller information.</p>
                <div className="space-y-1 sm:space-y-2 text-sm text-gray-500 mb-4">
                  <p>• View complete trade history</p>
                  <p>• Track buyer and seller details</p>
                  <p>• Analyze trading volume and patterns</p>
                  <p>• Export trade data for reporting</p>
                </div>
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => router.push('/admin/trades')}
                  className="w-full bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center font-medium shadow-lg text-sm sm:text-base"
                >
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Monitor Trades
                </motion.button>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-white rounded-lg shadow p-4 sm:p-6"
              >
                <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-3 sm:mb-4 flex items-center">
                  <Users className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-blue-600" />
                  User Management
                </h3>
                <p className="text-sm text-gray-600 mb-3 sm:mb-4">Manage user accounts, roles, and monitor user activity across the platform.</p>
                <div className="space-y-1 sm:space-y-2 text-sm text-gray-500 mb-4">
                  <p>• View all registered users</p>
                  <p>• Monitor user activity and login status</p>
                  <p>• Manage user roles and permissions</p>
                  <p>• Track user trading activity</p>
                </div>
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => router.push('/admin/users')}
                  className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center font-medium shadow-lg text-sm sm:text-base"
                >
                  <Users className="h-4 w-4 mr-2" />
                  Manage Users
                </motion.button>
              </motion.div>
            </div>

            {/* System Health */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">System Health</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center">
                  <Database className="h-5 w-5 mr-2" />
                  <span className="text-sm text-gray-600 mr-2">Database:</span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    dashboard?.systemHealth.database ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {dashboard?.systemHealth.database ? 'Healthy' : 'Error'}
                  </span>
                </div>
                <div className="flex items-center">
                  <Server className="h-5 w-5 mr-2" />
                  <span className="text-sm text-gray-600 mr-2">Redis:</span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    dashboard?.systemHealth.redis ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {dashboard?.systemHealth.redis ? 'Healthy' : 'Error'}
                  </span>
                </div>
                <div className="flex items-center">
                  <Activity className="h-5 w-5 mr-2" />
                  <span className="text-sm text-gray-600 mr-2">Matching Engine:</span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    dashboard?.systemHealth.matchingEngine ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {dashboard?.systemHealth.matchingEngine ? 'Running' : 'Stopped'}
                  </span>
                </div>
              </div>
            </div>

            {/* Top Assets */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Top Trading Assets</h3>
              <div className="space-y-3">
                {dashboard?.topAssets?.map((asset, index) => (
                  <div key={asset.asset} className="flex items-center justify-between">
                    <div className="flex items-center">
                      <span className="flex-shrink-0 h-8 w-8 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-sm font-medium">
                        {index + 1}
                      </span>
                      <span className="ml-3 text-sm font-medium text-gray-900">{asset.asset.toUpperCase()}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">{asset._count.asset} trades</p>
                      <p className="text-xs text-gray-500">{asset._sum.amount} volume</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        }
      </div>
    </div>
  );
} 