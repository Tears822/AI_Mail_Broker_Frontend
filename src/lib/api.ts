const API_BASE_URL = 'http://localhost:8000/api';

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
  metadata?: Record<string, any>;
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
  summary: AccountSummary;
  profile: UserProfile;
}

class ApiClient {
  private baseURL: string;
  private token: string | null = null;

  constructor() {
    this.baseURL = API_BASE_URL;
    // Load token from localStorage if available
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('access_token');
    }
  }

  private refreshToken(): void {
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('access_token');
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    // Always refresh token before making request
    this.refreshToken();
    
    const url = `${this.baseURL}${endpoint}`;
    console.log("API Request:", url, options);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers as Record<string, string>,
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Token expired or invalid
        this.logout();
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

    this.token = response.access_token;
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

    this.token = response.access_token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('access_token', response.access_token);
      localStorage.setItem('username', response.user.username);
      localStorage.setItem('user_id', response.user.id);
    }

    return response;
  }

  logout() {
    this.token = null;
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
    const [orders, marketData, trades, summary, profile] = await Promise.all([
      this.request<{ orders: OrderResponse[] }>('/orders'),
      this.request<{ marketData: MarketDataResponse[] }>('/market'),
      this.request<{ trades: TradeResponse[] }>('/trades'),
      this.request<{ summary: AccountSummary }>('/account'),
      this.request<UserProfile>('/profile'),
    ]);

    return {
      orders: orders.orders,
      marketData: marketData.marketData,
      trades: trades.trades,
      summary: summary.summary,
      profile,
    };
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
    return !!this.token;
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
}

export const apiClient = new ApiClient(); 