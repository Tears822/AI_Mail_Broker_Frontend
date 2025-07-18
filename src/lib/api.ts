import { getValidToken, handleAuthError } from './auth';

const API_BASE_URL = `${process.env.NEXT_PUBLIC_API_URL || 'https://api.giftcard.88808880.xyz'}/api`;

// Debug logging
console.log('[API DEBUG] Environment variable NEXT_PUBLIC_API_URL:', process.env.NEXT_PUBLIC_API_URL);
console.log('[API DEBUG] Final API_BASE_URL:', API_BASE_URL);

// Types matching the new Supabase backend
export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  phone: string;
  role?: 'trader' | 'admin' | 'TRADER' | 'ADMIN';
}

export interface LoginResponse {
  message: string;
  user: {
    id: string;
    username: string;
    email: string;
    role: string;
  };
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface RegisterResponse {
  message: string;
  user: {
    id: string;
    username: string;
    email: string;
    role: string;
  };
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface OrderRequest {
  action: string;
  price: number;
  monthyear: string;
  product: string;
  amount: number;
  expiresAt?: string;
}

export interface OrderResponse {
  id: string;
  action: 'bid' | 'offer';
  price: number;
  asset: string;
  amount: number;
  remaining: number;
  matched: boolean;
  counterparty?: string;
  status: 'active' | 'matched' | 'cancelled' | 'expired';
  expiresAt?: string;
  metadata?: Record<string, unknown>;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface TradeResponse {
  id: string;
  asset: string;
  price: number;
  amount: number;
  buyerOrderId: string;
  sellerOrderId: string;
  commission?: number;
  buyerId: string;
  sellerId: string;
  createdAt: string;
}

export interface MarketDataResponse {
  asset: string;
  bids: OrderResponse[];
  offers: OrderResponse[];
}

export interface AccountSummary {
  total_orders: number;
  active_orders: number;
  total_trades: number;
  total_volume: number;
  pnl_24h: number;
}

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  phone: string;
  role: string;
  lastLoginAt?: string;
}

export interface DashboardResponse {
  orders: OrderResponse[];
  marketData: MarketDataResponse[];
  trades: TradeResponse[];
  userTrades: TradeResponse[]; // Add user-specific trades
  summary: AccountSummary;
  profile: UserProfile;
}

class ApiClient {
  private baseURL: string;

  constructor() {
    this.baseURL = API_BASE_URL;
    console.log('[API DEBUG] ApiClient initialized with baseURL:', this.baseURL);
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    console.log("[API DEBUG] Making request to URL:", url);
    console.log("[API DEBUG] Request options:", options);
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers as Record<string, string>,
    };

    // Use getValidToken to check expiry before making request
    const token = getValidToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        // Token expired or invalid
        console.log('Authentication error detected, redirecting to login...');
        handleAuthError();
        throw new Error('Authentication failed');
      }
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || errorData.detail || `HTTP ${response.status}`);
    }

    return response.json();
  }

  async register(data: RegisterRequest): Promise<RegisterResponse> {
    const response = await this.request<RegisterResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (typeof window !== 'undefined') {
      localStorage.setItem('access_token', response.access_token);
      localStorage.setItem('username', response.user.username);
      localStorage.setItem('user_id', response.user.id);
    }

    return response;
  }

  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const response = await this.request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });

    if (typeof window !== 'undefined') {
      localStorage.setItem('access_token', response.access_token);
      localStorage.setItem('username', response.user.username);
      localStorage.setItem('user_id', response.user.id);
    }

    return response;
  }

  logout(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('access_token');
      localStorage.removeItem('username');
      localStorage.removeItem('user_id');
    }
  }

  async getProfile(): Promise<UserProfile> {
    return this.request<UserProfile>('/profile');
  }

  async getDashboard(): Promise<DashboardResponse> {
    // Fetch all dashboard data in parallel
    const [orders, marketData, trades, userTrades, summary, profile] = await Promise.all([
      this.request<{ orders: OrderResponse[] }>('/orders'),
      this.request<{ marketData: MarketDataResponse[] }>('/market'),
      this.request<{ trades: TradeResponse[] }>('/trades'),
      this.request<{ trades: TradeResponse[] }>('/my-trades'),
      this.request<{ summary: AccountSummary }>('/account'),
      this.request<UserProfile>('/profile'),
    ]);

    return {
      orders: orders.orders,
      marketData: marketData.marketData,
      trades: trades.trades,
      userTrades: userTrades.trades,
      summary: summary.summary,
      profile,
    };
  }

  async getUserTrades(): Promise<TradeResponse[]> {
    const response = await this.request<{ trades: TradeResponse[] }>('/my-trades');
    return response.trades;
  }

  async createOrder(order: OrderRequest): Promise<OrderResponse> {
    const response = await this.request<{ message: string; order: OrderResponse }>('/orders', {
      method: 'POST',
      body: JSON.stringify(order),
    });
    return response.order;
  }

  async cancelOrder(orderId: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/orders/${orderId}`, {
      method: 'DELETE',
    });
  }

  async updateOrder(orderId: string, updates: { price?: number; amount?: number; expiresAt?: string }): Promise<OrderResponse> {
    const response = await this.request<{ message: string; order: OrderResponse }>(`/orders/${orderId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    return response.order;
  }

  async getMarketData(): Promise<MarketDataResponse[]> {
    const response = await this.request<{ marketData: MarketDataResponse[] }>('/market');
    return response.marketData;
  }

  async getTrades(): Promise<TradeResponse[]> {
    const response = await this.request<{ trades: TradeResponse[] }>('/trades');
    return response.trades;
  }

  async getAccountSummary(): Promise<AccountSummary> {
    const response = await this.request<{ summary: AccountSummary }>('/account');
    return response.summary;
  }

  async getStats(): Promise<unknown> {
    const response = await this.request<{ stats: unknown }>('/stats');
    return response.stats;
  }

  async processNLP(message: string): Promise<unknown> {
    const response = await this.request<{ result: unknown }>('/nlp/process', {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
    return response.result;
  }

  isAuthenticated(): boolean {
    const token = getValidToken();
    return token !== null;
  }

  getUsername(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('username');
    }
    return null;
  }

  getUserId(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('user_id');
    }
    return null;
  }

  // Admin methods
  async getAdminDashboard(): Promise<unknown> {
    return this.request<unknown>('/admin/dashboard');
  }

  async getAdminOrders(params?: {
    page?: number;
    limit?: number;
    status?: string;
    asset?: string;
    userId?: string;
  }): Promise<{
    orders: Array<{
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
    }>;
    pagination: { page: number; limit: number; total: number; pages: number };
  }> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.status) queryParams.append('status', params.status);
    if (params?.asset) queryParams.append('asset', params.asset);
    if (params?.userId) queryParams.append('userId', params.userId);
    
    const url = queryParams.toString() ? `/admin/orders?${queryParams.toString()}` : '/admin/orders';
    return this.request<{
      orders: Array<{
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
      }>;
      pagination: { page: number; limit: number; total: number; pages: number };
    }>(url);
  }

  async getAdminTrades(params?: {
    page?: number;
    limit?: number;
    asset?: string;
    fromDate?: string;
    toDate?: string;
  }): Promise<{
    trades: Array<{
      id: string;
      asset: string;
      price: number;
      amount: number;
      createdAt: string;
      buyerId: string;
      sellerId: string;
      buyer: { username: string };
      seller: { username: string };
      commission: number;
    }>;
    pagination: { page: number; limit: number; total: number; pages: number };
    statistics: { totalVolume: number; averagePrice: number };
  }> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.asset) queryParams.append('asset', params.asset);
    if (params?.fromDate) queryParams.append('fromDate', params.fromDate);
    if (params?.toDate) queryParams.append('toDate', params.toDate);
    
    const url = queryParams.toString() ? `/admin/trades?${queryParams.toString()}` : '/admin/trades';
    return this.request<{
      trades: Array<{
        id: string;
        asset: string;
        price: number;
        amount: number;
        createdAt: string;
        buyerId: string;
        sellerId: string;
        buyer: { username: string };
        seller: { username: string };
        commission: number;
      }>;
      pagination: { page: number; limit: number; total: number; pages: number };
      statistics: { totalVolume: number; averagePrice: number };
    }>(url);
  }

  async getAdminUsers(params?: {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
    status?: string;
  }): Promise<{
    users: Array<{
      id: string;
      username: string;
      email: string;
      phone: string;
      role: string;
      createdAt: string;
      lastLoginAt: string;
      _count: { orders: number };
    }>;
    pagination: { page: number; limit: number; total: number; pages: number };
  }> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.search) queryParams.append('search', params.search);
    if (params?.role) queryParams.append('role', params.role);
    if (params?.status) queryParams.append('status', params.status);
    
    const url = queryParams.toString() ? `/admin/users?${queryParams.toString()}` : '/admin/users';
    return this.request<{
      users: Array<{
        id: string;
        username: string;
        email: string;
        phone: string;
        role: string;
        createdAt: string;
        lastLoginAt: string;
        _count: { orders: number };
      }>;
      pagination: { page: number; limit: number; total: number; pages: number };
    }>(url);
  }

  async cancelAdminOrder(orderId: string, reason?: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/admin/orders/${orderId}/cancel`, {
      method: 'PATCH',
      body: JSON.stringify({ reason })
    });
  }
}

export const apiClient = new ApiClient(); 