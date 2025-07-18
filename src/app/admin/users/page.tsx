"use client";

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  Users,
  Filter,
  Search,
  X,
  ArrowLeft,
  Download,
  UserCheck,
  Crown,
  Phone,
  Mail,
  Calendar,
  Activity
} from 'lucide-react';
import { apiClient } from '@/lib/api';

export default function AdminUsersPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    role: '',
    status: '',
    search: ''
  });

  // Fetch users with filters
  const { data: usersData, isLoading, refetch } = useQuery({
    queryKey: ['admin-users', page, filters],
    queryFn: async () => {
      const params: { page: number; limit: number; role?: string; status?: string; search?: string } = { page, limit: 20 };
      if (filters.role) params.role = filters.role;
      if (filters.status) params.status = filters.status;
      if (filters.search) params.search = filters.search;
      return apiClient.getAdminUsers(params);
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const getRoleColor = (role: string) => {
    switch (role.toLowerCase()) {
      case 'admin': return 'bg-purple-100 text-purple-800';
      case 'trader': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role.toLowerCase()) {
      case 'admin': return <Crown className="h-4 w-4" />;
      case 'trader': return <Users className="h-4 w-4" />;
      default: return <Users className="h-4 w-4" />;
    }
  };

  const getActivityStatus = (lastLoginAt: string) => {
    if (!lastLoginAt) return { status: 'never', text: 'Never logged in', color: 'text-gray-500' };
    
    const lastLogin = new Date(lastLoginAt);
    const now = new Date();
    const diffHours = (now.getTime() - lastLogin.getTime()) / (1000 * 60 * 60);
    
    if (diffHours < 24) return { status: 'active', text: 'Active (24h)', color: 'text-green-600' };
    if (diffHours < 168) return { status: 'recent', text: 'Recent (7d)', color: 'text-yellow-600' };
    return { status: 'inactive', text: 'Inactive', color: 'text-red-600' };
  };

  const filteredUsers = usersData?.users || [];
  const activeUsers = filteredUsers.filter(user => getActivityStatus(user.lastLoginAt).status === 'active').length;
  const adminUsers = filteredUsers.filter(user => user.role === 'ADMIN').length;
  const totalOrders = filteredUsers.reduce((sum, user) => sum + user._count.orders, 0);

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
              <Users className="h-8 w-8 text-indigo-600 mr-3" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
                <p className="text-sm text-gray-500">Manage user accounts, roles, and monitor activity</p>
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
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Total Users</p>
                <p className="text-2xl font-bold text-gray-900">{usersData?.pagination.total || 0}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <UserCheck className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Active Users (24h)</p>
                <p className="text-2xl font-bold text-gray-900">{activeUsers}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Crown className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Admin Users</p>
                <p className="text-2xl font-bold text-gray-900">{adminUsers}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Activity className="h-6 w-6 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Total Orders</p>
                <p className="text-2xl font-bold text-gray-900">{totalOrders}</p>
              </div>
            </div>
          </div>
        </div>

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
                placeholder="Search users, email, phone..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm w-64 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 placeholder-gray-500"
              />
            </div>
            
            <select
              value={filters.role}
              onChange={(e) => setFilters(prev => ({ ...prev, role: e.target.value }))}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 bg-white"
            >
              <option value="" className="text-gray-900">All Roles</option>
              <option value="ADMIN" className="text-gray-900">Admin</option>
              <option value="TRADER" className="text-gray-900">Trader</option>
            </select>
            
            <select
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 bg-white"
            >
              <option value="" className="text-gray-900">All Activity</option>
              <option value="active" className="text-gray-900">Active (7d)</option>
              <option value="inactive" className="text-gray-900">Inactive</option>
            </select>
            
            {(filters.role || filters.status || filters.search) && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setFilters({ role: '', status: '', search: '' })}
                className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-700 bg-white hover:bg-gray-50 focus:ring-2 focus:ring-indigo-500 font-medium"
              >
                <X className="h-4 w-4 mr-1" />
                Clear Filters
              </motion.button>
            )}
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">
              Users ({filteredUsers.length} of {usersData?.pagination.total || 0})
            </h3>
          </div>
          
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="mt-2 text-gray-500">Loading users...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Activity</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Orders</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Login</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredUsers.map((user) => {
                    const activityStatus = getActivityStatus(user.lastLoginAt);
                    return (
                      <motion.tr
                        key={user.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="hover:bg-gray-50"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10 bg-indigo-100 rounded-full flex items-center justify-center">
                              <Users className="h-5 w-5 text-indigo-600" />
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">{user.username}</div>
                              <div className="text-sm text-gray-500">{user.id.slice(0, 8)}...</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            <div className="flex items-center mb-1">
                              <Mail className="h-3 w-3 text-gray-400 mr-1" />
                              {user.email}
                            </div>
                            <div className="flex items-center">
                              <Phone className="h-3 w-3 text-gray-400 mr-1" />
                              {user.phone}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                            {getRoleIcon(user.role)}
                            <span className="ml-1">{user.role}</span>
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`text-sm font-medium ${activityStatus.color}`}>
                            {activityStatus.text}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            {user._count.orders} orders
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex items-center">
                            <Calendar className="h-3 w-3 text-gray-400 mr-1" />
                            {new Date(user.createdAt).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {user.lastLoginAt ? (
                            <div className="flex items-center">
                              <Activity className="h-3 w-3 text-gray-400 mr-1" />
                              {new Date(user.lastLoginAt).toLocaleString()}
                            </div>
                          ) : (
                            <span className="text-gray-400">Never</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button className="text-indigo-600 hover:text-indigo-900 mr-3">
                            View Orders
                          </button>
                          <button className="text-blue-600 hover:text-blue-900">
                            Edit
                          </button>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {usersData?.pagination && (
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing {((page - 1) * 20) + 1} to {Math.min(page * 20, usersData.pagination.total)} of {usersData.pagination.total} users
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
                  disabled={page >= usersData.pagination.pages}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User Activity Summary */}
        {filteredUsers.length > 0 && (
          <div className="mt-6 bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">User Activity Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-sm text-green-600 font-medium">Active (24h)</div>
                <div className="text-2xl font-bold text-green-900">
                  {filteredUsers.filter(u => getActivityStatus(u.lastLoginAt).status === 'active').length}
                </div>
              </div>
              <div className="bg-yellow-50 rounded-lg p-4">
                <div className="text-sm text-yellow-600 font-medium">Recent (7d)</div>
                <div className="text-2xl font-bold text-yellow-900">
                  {filteredUsers.filter(u => getActivityStatus(u.lastLoginAt).status === 'recent').length}
                </div>
              </div>
              <div className="bg-red-50 rounded-lg p-4">
                <div className="text-sm text-red-600 font-medium">Inactive</div>
                <div className="text-2xl font-bold text-red-900">
                  {filteredUsers.filter(u => getActivityStatus(u.lastLoginAt).status === 'inactive').length}
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm text-gray-600 font-medium">Never Logged In</div>
                <div className="text-2xl font-bold text-gray-900">
                  {filteredUsers.filter(u => getActivityStatus(u.lastLoginAt).status === 'never').length}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 