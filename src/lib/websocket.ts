import { io, Socket } from 'socket.io-client';
import toast from 'react-hot-toast';
import { getValidToken, handleAuthError } from './auth';

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
  private autoReconnectInterval: any = null;
  private autoReconnectDelay: number = 5000; // 5 seconds

  constructor() {
    // Removed setupSocket() method. All socket creation and reconnection logic is now handled by connect().
  }

  private setupEventHandlers() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('[WebSocket DEBUG] 🔌 WebSocket connected successfully');
      console.log('[WebSocket DEBUG] Socket ID:', this.socket?.id);
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.stopAutoReconnect(); // Stop timer when connected
      
      // Subscribe to updates
      this.socket?.emit('subscribe_orders');
      this.socket?.emit('subscribe_trades');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[WebSocket DEBUG] 🔌 WebSocket disconnected, reason:', reason);
      console.log('[WebSocket DEBUG] Disconnect details:', {
        reason,
        socketId: this.socket?.id,
        connected: this.socket?.connected
      });
      this.isConnected = false;
      this.startAutoReconnect(); // Start timer when disconnected
    });

    this.socket.on('connect_error', (error) => {
      console.error('[WebSocket DEBUG] WebSocket connection error:', error);
      console.error('[WebSocket DEBUG] Error details:', {
        message: error.message,
        description: (error as any).description,
        context: (error as any).context,
        type: (error as any).type
      });
      this.isConnected = false;
      this.startAutoReconnect(); // Start timer on error
      // Handle authentication errors
      if (error.message?.includes('jwt expired') || error.message?.includes('unauthorized')) {
        console.log('[WebSocket DEBUG] WebSocket authentication error, redirecting to login...');
        handleAuthError();
      }
    });

    // Add reconnection event listeners
    this.socket.on('reconnect_attempt', (attempt) => {
      console.log(`WebSocket reconnect attempt #${attempt}`);
      toast('Reconnecting to server... (attempt ' + attempt + ')');
    });
    this.socket.on('reconnect_error', (error) => {
      console.error('WebSocket reconnection error:', error);
      toast.error('WebSocket reconnection error');
    });
    this.socket.on('reconnect_failed', () => {
      console.error('WebSocket reconnection failed');
      toast.error('Unable to reconnect. Please refresh the page.');
    });

    // Handle order events
    this.socket.on('order:created', (event: WebSocketEvent) => {
      console.log('📊 Order created:', event.data);
      toast.success(`New order: ${event.data.action} ${event.data.amount} ${event.data.asset}`);
    });

    this.socket.on('order:updated', (event: WebSocketEvent) => {
      console.log('📊 Order updated:', event.data);
      toast(`Order updated: ${event.data.orderId || event.data.id}`);
      window.dispatchEvent(new CustomEvent('orderUpdated', { detail: event.data }));
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
      
      // Only show toast if priceChanged is true
      if (event.data.priceChanged && event.data.asset) {
        const { asset, bestBid, bestOffer, previousBestBid, previousBestOffer } = event.data;
        let message = `Market updated: ${asset}`;
        
        if (bestBid !== previousBestBid && bestBid !== null) {
          message += `\nBid: ${previousBestBid || 'N/A'} → ${bestBid}`;
        }
        if (bestOffer !== previousBestOffer && bestOffer !== null) {
          message += `\nOffer: ${previousBestOffer || 'N/A'} → ${bestOffer}`;
        }
        toast.success(message);
      }
      window.dispatchEvent(new CustomEvent('marketUpdate', { detail: event.data }));
    });

    // Handle negotiation turn events
    this.socket.on('negotiation:your_turn', (event: WebSocketEvent) => {
      console.log('[FRONTEND] Received negotiation:your_turn event:', event.data);
      window.dispatchEvent(new CustomEvent('negotiationYourTurn', { detail: event.data }));
    });
  }

  public connect(): void {
    console.log('[WebSocket DEBUG] connect() called');
    
    // Check if token is valid before connecting
    const token = getValidToken();
    console.log('[WebSocket DEBUG] Token check result:', token ? 'Token found' : 'No token', token?.slice(0, 20) + '...');
    
    if (!token) {
      console.log('[WebSocket DEBUG] No valid token found, redirecting to login...');
      handleAuthError();
      return;
    }

    if (this.socket) {
      console.log('[WebSocket DEBUG] Existing socket found, connected:', this.socket.connected);
      if (!this.socket.connected) {
        console.log('[WebSocket DEBUG] WebSocket: reconnecting existing socket...');
        this.socket.connect();
      } else {
        console.log('[WebSocket DEBUG] WebSocket already connected');
      }
      return;
    }

    console.log('[WebSocket DEBUG] WebSocket: creating new socket and connecting...');
    console.log('[WebSocket DEBUG] API URL:', process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000');
    console.log('[WebSocket DEBUG] Token for auth:', token.slice(0, 20) + '...');
    
    this.socket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000', {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000
    });
    this.setupEventHandlers();
    console.log('[WebSocket DEBUG] Socket created, calling connect()...');
    this.socket.connect();
    console.log('[WebSocket DEBUG] connect() call completed');
  }

  public disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.isConnected = false;
    }
    this.stopAutoReconnect();
  }

  /**
   * Starts a periodic check to ensure the WebSocket is connected.
   * Call this after login or when the token is available.
   * The timer will keep trying to connect if disconnected.
   */
  public startAutoReconnect() {
    console.log('[WebSocket DEBUG] startAutoReconnect() called, interval exists:', !!this.autoReconnectInterval);
    if (this.autoReconnectInterval) return; // Already running
    
    console.log('[WebSocket DEBUG] Starting auto-reconnect timer with', this.autoReconnectDelay, 'ms interval');
    
    // Try to connect immediately
    console.log('[WebSocket DEBUG] Attempting immediate connection...');
    this.connect();
    
    this.autoReconnectInterval = setInterval(() => {
      console.log('[WebSocket DEBUG] Auto-reconnect timer fired, isConnected:', this.isConnected);
      if (!this.isConnected) {
        console.log('[WebSocket DEBUG] Auto-reconnect: socket not connected, trying to connect...');
        this.connect();
      } else {
        console.log('[WebSocket DEBUG] Auto-reconnect: socket already connected, skipping');
      }
    }, this.autoReconnectDelay);
  }

  /**
   * Stops the auto-reconnect timer. Call this if you want to stop reconnect attempts (e.g., on logout).
   */
  public stopAutoReconnect() {
    if (this.autoReconnectInterval) {
      clearInterval(this.autoReconnectInterval);
      this.autoReconnectInterval = null;
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

  public emitNegotiationResponse(asset: string, improved: boolean, newPrice?: number) {
    if (this.socket && this.isConnected) {
      let payload: any = { asset, improved };
      if (newPrice !== undefined) payload.newPrice = newPrice;
      console.log('[FRONTEND] Emitting negotiation response:', { eventName: 'negotiation:response', payload });
      this.socket.emit('negotiation:response', payload);
    } else {
      console.error('[FRONTEND] Cannot emit negotiation response: socket not connected');
    }
  }

  public isSocketConnected(): boolean {
    return this.isConnected;
  }

  public getSocket(): Socket | null {
    return this.socket;
  }
}

export const wsService = new WebSocketService(); 