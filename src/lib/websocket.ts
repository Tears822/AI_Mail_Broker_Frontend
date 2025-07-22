import { io, Socket } from 'socket.io-client';
import toast from 'react-hot-toast';
import { getValidToken, handleAuthError } from './auth';

export interface WebSocketEvent {
  type: string;
  data: any; // eslint-disable-line @typescript-eslint/no-explicit-any -- Dynamic WebSocket payloads are hard to type strictly
  timestamp: string;
}

export class WebSocketService {
  private socket: Socket | null = null;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000;
  private autoReconnectInterval: NodeJS.Timeout | null = null;
  private autoReconnectDelay: number = 5000; // 5 seconds
  private hasConnectedBefore: boolean = false; // Track if we've connected before
  private eventHandlersSetup: boolean = false; // Track if event handlers are already set up

  constructor() {
    // Removed setupSocket() method. All socket creation and reconnection logic is now handled by connect().
  }

  private setupEventHandlers() {
    if (!this.socket || this.eventHandlersSetup) {
      console.log('[WebSocket DEBUG] Skipping event handler setup - already configured');
      return;
    }

    console.log('[WebSocket DEBUG] Setting up event handlers...');
    this.eventHandlersSetup = true;

    this.socket.on('connect', () => {
      console.log('[WebSocket DEBUG] 🔌 WebSocket connected successfully');
      console.log('[WebSocket DEBUG] Socket ID:', this.socket?.id);
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.stopAutoReconnect(); // Stop timer when connected
      
      // Show toast notification only on reconnections, not initial connection
      if (this.hasConnectedBefore) {
        toast.success('Connection restored! You\'re back online.', {
          duration: 5000,
          style: {
            background: '#10b981',
            color: '#fff',
            padding: '16px',
            borderRadius: '8px',
          },
          icon: '🔌',
        });
      }
      this.hasConnectedBefore = true;
      
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
        description: (error as unknown as { description?: string }).description,
        context: (error as unknown as { context?: string }).context,
        type: (error as unknown as { type?: string }).type
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
      toast('Reconnecting to server... (attempt ' + attempt + ')', {
        duration: 8000,
        style: {
          background: '#3b82f6',
          color: '#fff',
          padding: '16px',
          borderRadius: '8px',
        },
        icon: '🔄',
      });
    });
    this.socket.on('reconnect_error', (error) => {
      console.error('WebSocket reconnection error:', error);
      toast.error('WebSocket reconnection error', {
        duration: 10000,
        style: {
          padding: '16px',
          borderRadius: '8px',
        },
        iconTheme: {
          primary: '#ef4444',
          secondary: '#fff',
        },
      });
    });
    this.socket.on('reconnect_failed', () => {
      console.error('WebSocket reconnection failed');
      toast.error('Unable to reconnect. Please refresh the page.', {
        duration: Infinity, // Keep until manually dismissed
        style: {
          padding: '16px',
          borderRadius: '8px',
        },
        iconTheme: {
          primary: '#ef4444',
          secondary: '#fff',
        },
      });
    });

    // Handle order events
    this.socket.on('order:created', (event: WebSocketEvent) => {
      console.log('📊 Order created:', event.data);
      toast.success(`New order: ${event.data.action} ${event.data.amount} ${event.data.asset}`, {
        duration: 8000,
        style: {
          background: '#10b981',
          color: '#fff',
          padding: '16px',
          borderRadius: '8px',
        },
        icon: '📊',
      });
    });

    this.socket.on('order:updated', (event: WebSocketEvent) => {
      console.log('📊 Order updated:', event.data);
      toast(`Order updated: ${event.data.orderId || event.data.id}`, {
        duration: 8000,
        style: {
          background: '#3b82f6',
          color: '#fff',
          padding: '16px',
          borderRadius: '8px',
        },
        icon: '📝',
      });
      window.dispatchEvent(new CustomEvent('orderUpdated', { detail: event.data }));
    });

    this.socket.on('order:matched', (event: WebSocketEvent) => {
      console.log('📊 Order matched:', event.data);
      toast.success(`Order matched: ${event.data.amount} ${event.data.asset} @ ${event.data.price}${event.data.matchType === 'FULL_MATCH' ? '' : ' (partial)'}`, {
        duration: 10000,
        style: {
          background: '#10b981',
          color: '#fff',
          padding: '16px',
          borderRadius: '8px',
        },
        icon: '🎯',
      });
    });

    this.socket.on('order:cancelled', (event: WebSocketEvent) => {
      console.log('📊 Order cancelled:', event.data);
      toast(`Order cancelled: ${event.data.orderId}`, {
        duration: 8000,
        style: {
          background: '#f59e0b',
          color: '#fff',
          padding: '16px',
          borderRadius: '8px',
        },
        icon: '❌',
      });
    });

    // Handle partial fill events (seller quantity > buyer quantity)
    this.socket.on('order:partial_fill', (event: WebSocketEvent) => {
      console.log('🔄 Order partially filled:', event.data);
      toast.success(`Partial fill: ${event.data.filledAmount}/${event.data.originalAmount} ${event.data.asset} @ $${event.data.price}. ${event.data.remainingAmount} remaining.`, { 
        duration: 12000,
        style: {
          background: '#10b981',
          color: '#fff',
          padding: '16px',
          borderRadius: '8px',
        },
        icon: '🔄',
      });
      
      // Trigger dashboard refresh for partial fills
      window.dispatchEvent(new CustomEvent('orderPartiallyFilled', { detail: event.data }));
    });

    // Handle order fully filled events  
    this.socket.on('order:filled', (event: WebSocketEvent) => {
      console.log('✅ Order fully filled:', event.data);
      toast.success(`Order filled: ${event.data.amount} ${event.data.asset} @ $${event.data.price}`, { 
        duration: 10000,
        style: {
          background: '#10b981',
          color: '#fff',
          padding: '16px',
          borderRadius: '8px',
        },
        icon: '✅',
      });
      
      // Trigger dashboard refresh for filled orders
      window.dispatchEvent(new CustomEvent('orderFilled', { detail: event.data }));
    });

    // Handle trade events
    this.socket.on('trade:executed', (event: WebSocketEvent) => {
      console.log('💱 Trade executed:', event.data);
      
      // Use the message from backend if available for perfect consistency with WhatsApp
      if (event.data.message) {
        toast.success(event.data.message, {
          duration: event.data.isFullyFilled ? 12000 : 15000, // Longer for partial fills
          style: {
            background: '#10b981',
            color: '#fff',
            padding: '16px',
            borderRadius: '8px',
            whiteSpace: 'pre-line', // Preserve line breaks
            maxWidth: '500px',
          },
          icon: event.data.isFullyFilled ? '🎉' : '⏳',
        });
      } else {
        // Fallback to old format if message not provided
        const messageText = event.data.side === 'sell' 
          ? `Trade executed: ${event.data.amount} ${event.data.asset} @ ${event.data.price}`
          : `Your order was filled: ${event.data.amount} ${event.data.asset} @ ${event.data.price}`;
        
        toast.success(messageText, {
          duration: 10000,
          style: {
            background: '#10b981',
            color: '#fff',
            padding: '16px',
            borderRadius: '8px',
          },
          icon: event.data.side === 'sell' ? '💱' : '🛒',
        });
      }
      
      // Trigger market update event to refresh dashboard
      window.dispatchEvent(new CustomEvent('tradeExecuted', { detail: event.data }));
      
      // Also trigger market update to refresh order book display
      window.dispatchEvent(new CustomEvent('marketUpdate', { detail: event.data }));
    });

    // Handle market updates
    this.socket.on('market:update', (event: WebSocketEvent) => {
      console.log('📈 Market update:', event.data);
      
      // Handle different types of market updates
      if (event.data.type === 'remaining_quantity_available') {
        // Special handling for remaining quantity broadcasts
        const { asset, action, remainingQuantity, price, message } = event.data;
        
        if (action === 'OFFER') {
          // Remaining quantity available for sale
          toast.success(`🔥 ${asset}: ${remainingQuantity} lots available for sale at $${price}!`, { 
            duration: 15000, // Long duration for trading opportunities
            style: {
              background: '#f59e0b',
              color: '#fff',
              padding: '16px',
              borderRadius: '8px',
              border: '2px solid #fbbf24',
            },
            icon: '💰',
          });
        } else if (action === 'BID') {
          // Remaining quantity wanted for purchase  
          toast.success(`🔥 ${asset}: ${remainingQuantity} lots wanted at $${price}!`, { 
            duration: 15000, // Long duration for trading opportunities
            style: {
              background: '#3b82f6',
              color: '#fff',
              padding: '16px',
              borderRadius: '8px',
              border: '2px solid #60a5fa',
            },
            icon: '🛒',
          });
        }
        
        // Dispatch custom event for any UI components that want to highlight this opportunity
        window.dispatchEvent(new CustomEvent('remainingQuantityAvailable', { 
          detail: {
            asset,
            action,
            remainingQuantity,
            price,
            message,
            timestamp: event.timestamp
          }
        }));
        
      } else if (event.data.type === 'trade_completed') {
        // Full trade completion
        toast.success(event.data.message || 'Trade completed successfully!', {
          duration: 10000,
          style: {
            background: '#10b981',
            color: '#fff',
            padding: '16px',
            borderRadius: '8px',
          },
          icon: '✅',
        });
        
      } else if (event.data.tradeExecuted) {
        // General trade execution with market update
        toast.success(`${event.data.message || 'Market updated after trade'}`, {
          duration: 8000,
          style: {
            background: '#10b981',
            color: '#fff',
            padding: '16px',
            borderRadius: '8px',
          },
          icon: '📈',
        });
        
      } else if (event.data.priceChanged && event.data.asset) {
        // Only show toast if priceChanged is true
        const { asset, bestBid, bestOffer, previousBestBid, previousBestOffer } = event.data;
        let message = `Market updated: ${asset}`;
        
        if (bestBid !== previousBestBid && bestBid !== null) {
          message += `\nBid: ${previousBestBid || 'N/A'} → ${bestBid}`;
        }
        if (bestOffer !== previousBestOffer && bestOffer !== null) {
          message += `\nOffer: ${previousBestOffer || 'N/A'} → ${bestOffer}`;
        }
        toast.success(message, {
          duration: 8000,
          style: {
            background: '#10b981',
            color: '#fff',
            padding: '16px',
            borderRadius: '8px',
          },
          icon: '📈',
        });
      }
      
      window.dispatchEvent(new CustomEvent('marketUpdate', { detail: event.data }));
    });

    // Handle market price changes (highest bid or lowest offer changes)
    this.socket.on('market:priceChanged', (event: WebSocketEvent) => {
      console.log('📈 Market price changed:', event.data);
      
      const { asset, bestBid, bestOffer, previousBestBid, previousBestOffer, changeType } = event.data;
      let message = `Price change for ${asset}:`;
      
      if (changeType?.bidChanged && bestBid !== previousBestBid) {
        message += `\nHighest bid: ${previousBestBid || 'N/A'} → ${bestBid}`;
      }
      if (changeType?.offerChanged && bestOffer !== previousBestOffer) {
        message += `\nLowest offer: ${previousBestOffer || 'N/A'} → ${bestOffer}`;
      }
      
      // Show toast notification for price changes
      toast.success(message, { 
        duration: 10000,
        style: {
          background: '#8b5cf6',
          color: '#fff',
          padding: '16px',
          borderRadius: '8px',
        },
        icon: '📊',
      });
      
      // Dispatch custom event for UI updates
      window.dispatchEvent(new CustomEvent('marketPriceChanged', { detail: event.data }));
    });

    // Handle negotiation turn events
    this.socket.on('negotiation:your_turn', (event: WebSocketEvent) => {
      console.log('[FRONTEND] Received negotiation:your_turn event:', event.data);
      window.dispatchEvent(new CustomEvent('negotiationYourTurn', { detail: event.data }));
    });

    // Handle quantity confirmation requests
    this.socket.on('quantity:confirmation_request', (event: WebSocketEvent) => {
      console.log('[FRONTEND] Received quantity:confirmation_request event:', event.data);
      window.dispatchEvent(new CustomEvent('quantityConfirmationRequest', { detail: event.data }));
    });

    this.socket.on('quantity:partial_fill_approval', (event: WebSocketEvent) => {
      console.log('[FRONTEND] Received quantity:partial_fill_approval event:', event.data);
      window.dispatchEvent(new CustomEvent('quantityPartialFillApproval', { detail: event.data }));
    });
    this.socket.on('quantity:partial_fill_declined', (event: WebSocketEvent) => {
      console.log('[FRONTEND] Received quantity:partial_fill_declined event:', event.data);
      window.dispatchEvent(new CustomEvent('quantityPartialFillDeclined', { detail: event.data }));
    });

    // Add handler for counterparty decline notification
    this.socket.on('quantity:counterparty_declined', (event: WebSocketEvent) => {
      console.log('[FRONTEND] Received quantity:counterparty_declined event:', event.data);
      
      // Show toast notification to inform the larger party about the decline
      toast.error(`Counterparty declined to increase order\n\n${event.data.message}`, {
        duration: 8000,
        style: {
          background: '#ef4444',
          color: '#fff',
          padding: '16px',
          borderRadius: '8px',
        },
        icon: '❌',
      });
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
    
    // Reset event handlers flag for new socket
    this.eventHandlersSetup = false;
    
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
    // Reset event handlers flag so they can be set up again on reconnection
    this.eventHandlersSetup = false;
  }

  /**
   * Manual connect method that can be called from UI
   */
  public manualConnect(): void {
    console.log('[WebSocket DEBUG] Manual connect requested');
    this.stopAutoReconnect(); // Stop any existing auto-reconnect
    this.connect();
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
      const payload: { asset: string; improved: boolean; newPrice?: number } = { asset, improved };
      if (newPrice !== undefined) payload.newPrice = newPrice;
      console.log('[FRONTEND] Emitting negotiation response:', { eventName: 'negotiation:response', payload });
      this.socket.emit('negotiation:response', payload);
    } else {
      console.error('[FRONTEND] Cannot emit negotiation response: socket not connected');
    }
  }

  public emitQuantityConfirmationResponse(confirmationKey: string, accepted: boolean, newQuantity?: number) {
    if (this.socket && this.isConnected) {
      const payload: { confirmationKey: string; accepted: boolean; newQuantity?: number } = { confirmationKey, accepted };
      if (newQuantity !== undefined) payload.newQuantity = newQuantity;
      console.log('[FRONTEND] Emitting quantity confirmation response:', { eventName: 'quantity:confirmation_response', payload });
      this.socket.emit('quantity:confirmation_response', payload);
    } else {
      console.error('[FRONTEND] Cannot emit quantity confirmation response: socket not connected');
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