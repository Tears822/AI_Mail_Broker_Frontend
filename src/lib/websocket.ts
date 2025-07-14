import { io, Socket } from 'socket.io-client';
import toast from 'react-hot-toast';

export interface WebSocketEvent {
  type: string;
  data: any;
  timestamp: string;
}

export class WebSocketService {
  private socket: Socket | null = null;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000;

  constructor() {
    this.setupSocket();
  }

  private setupSocket() {
    const token = localStorage.getItem('access_token');
    console.log('WebSocket token:', token);
    
    if (!token) {
      console.log('No token available for WebSocket connection');
      return;
    }

    this.socket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000', {
      auth: { token },
      transports: ['websocket', 'polling'],
      autoConnect: false
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('🔌 WebSocket connected');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      // Subscribe to updates
      this.socket?.emit('subscribe_orders');
      this.socket?.emit('subscribe_trades');
    });

    this.socket.on('disconnect', () => {
      console.log('🔌 WebSocket disconnected');
      this.isConnected = false;
      this.attemptReconnect();
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      this.isConnected = false;
      this.attemptReconnect();
    });

    // Handle order events
    this.socket.on('order:created', (event: WebSocketEvent) => {
      console.log('📊 Order created:', event.data);
      toast.success(`New order: ${event.data.action} ${event.data.amount} ${event.data.asset}`);
    });

    this.socket.on('order:matched', (event: WebSocketEvent) => {
      console.log('📊 Order matched:', event.data);
      toast.success(`Order matched: ${event.data.filledAmount} ${event.data.asset} @ ${event.data.price}`);
    });

    this.socket.on('order:cancelled', (event: WebSocketEvent) => {
      console.log('📊 Order cancelled:', event.data);
      toast(`Order cancelled: ${event.data.orderId}`);
    });

    // Handle trade events
    this.socket.on('trade:executed', (event: WebSocketEvent) => {
      console.log('💱 Trade executed:', event.data);
      // Only show toast for sellers, not buyers
      if (event.data.side === 'sell') {
        toast.success(`Trade executed: ${event.data.amount} ${event.data.asset} @ ${event.data.price}`);
      }
    });

    // Handle market updates
    this.socket.on('market:update', (event: WebSocketEvent) => {
      console.log('📈 Market update:', event.data);
      // You can emit a custom event for React components to listen to
      window.dispatchEvent(new CustomEvent('marketUpdate', { detail: event.data }));
    });

    // Handle seller approval requests
    this.socket.on('match:approval', (event: WebSocketEvent) => {
      console.log('[FRONTEND] Received match:approval event:', event.data);
      // Dispatch a custom event for React components to listen to
      window.dispatchEvent(new CustomEvent('sellerApproval', { detail: event.data }));
    });
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      toast.error('Connection lost. Please refresh the page.');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      if (this.socket && !this.isConnected) {
        this.socket.connect();
      }
    }, delay);
  }

  public connect() {
    if (this.socket && !this.isConnected) {
      this.socket.connect();
    }
  }

  public disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.isConnected = false;
    }
  }

  public subscribeToMarket(asset: string) {
    if (this.socket && this.isConnected) {
      this.socket.emit('subscribe_market', asset);
    }
  }

  public unsubscribeFromMarket(asset: string) {
    if (this.socket && this.isConnected) {
      this.socket.emit('unsubscribe_market', asset);
    }
  }

  public emitSellerApprovalResponse(offerId: string, bidId: string, approved: boolean, sellerUserId: string) {
    if (this.socket && this.isConnected) {
      const payload = { offerId, bidId, approved };
      console.log('[FRONTEND] Emitting seller approval response:', { eventName: 'match:approval_response', payload });
      this.socket.emit('match:approval_response', payload);
    } else {
      console.error('[FRONTEND] Cannot emit seller approval response: socket not connected');
    }
  }

  public isSocketConnected(): boolean {
    return this.isConnected;
  }

  public getSocket(): Socket | null {
    return this.socket;
  }
} 