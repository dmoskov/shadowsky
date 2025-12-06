import { debug } from "@bsky/shared";
import { WS_CONFIG } from "../config/websocket.config";
import {
  AuthErrorCategory,
  WebSocketConnectionState,
  WebSocketEventType,
  type WebSocketConfig,
  type WebSocketMessage,
  type WebSocketStats,
} from "../types/websocket";

type EventHandler = (event: WebSocketMessage) => void;

/**
 * Calculate exponential backoff delay with optional jitter.
 * Jitter helps prevent thundering herd when multiple clients reconnect
 * simultaneously after a server restart.
 *
 * @param attempt - The current reconnection attempt number (1-indexed)
 * @param baseDelay - The base delay in milliseconds (default 5000)
 * @param maxDelay - The maximum delay cap in milliseconds (default 30000)
 * @param jitter - Whether to add ±20% randomization (default true)
 * @returns The calculated delay in milliseconds
 */
export function calculateBackoff(
  attempt: number,
  baseDelay: number = WS_CONFIG.INITIAL_RECONNECT_DELAY_MS,
  maxDelay: number = WS_CONFIG.MAX_RECONNECT_DELAY_MS,
  jitter: boolean = true,
): number {
  // Calculate base exponential delay: baseDelay * 2^(attempt-1)
  const exponentialDelay = Math.min(
    baseDelay * Math.pow(2, attempt - 1),
    maxDelay,
  );

  if (!jitter) {
    return exponentialDelay;
  }

  // Add ±20% jitter to spread reconnection attempts
  const jitterFactor = 0.8 + Math.random() * 0.4;
  return Math.floor(exponentialDelay * jitterFactor);
}

type RequiredWebSocketConfig = Required<
  Omit<WebSocketConfig, "accessToken">
> & { accessToken?: string };

export class WebSocketService {
  private ws: WebSocket | null = null;
  private config: RequiredWebSocketConfig;
  private eventHandlers: Map<WebSocketEventType, Set<EventHandler>> = new Map();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private authTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private pongTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private stats: WebSocketStats;
  private isIntentionallyClosed = false;
  private isAuthenticated = false;
  private isAuthFatalError = false;

  // PONG timeout detection for zombie connections
  private readonly PONG_TIMEOUT = WS_CONFIG.PONG_TIMEOUT_MS; // 10 seconds
  private lastPingTime: number | null = null;
  private latencyHistory: number[] = [];
  private readonly MAX_LATENCY_SAMPLES = 10;

  constructor(config: WebSocketConfig) {
    this.config = {
      reconnectDelay: WS_CONFIG.INITIAL_RECONNECT_DELAY_MS,
      maxReconnectAttempts: WS_CONFIG.MAX_RECONNECT_ATTEMPTS,
      heartbeatInterval: WS_CONFIG.HEARTBEAT_INTERVAL_MS,
      authTimeout: WS_CONFIG.AUTH_TIMEOUT_MS,
      debug: false,
      ...config,
    };

    this.stats = {
      connectionState: WebSocketConnectionState.DISCONNECTED,
      reconnectAttempts: 0,
      messagesSent: 0,
      messagesReceived: 0,
    };
  }

  public connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.log("Already connected");
      return;
    }

    if (
      this.ws?.readyState === WebSocket.CONNECTING ||
      this.stats.connectionState === WebSocketConnectionState.CONNECTING
    ) {
      this.log("Connection already in progress");
      return;
    }

    this.isIntentionallyClosed = false;
    this.isAuthenticated = false;
    // Only reset fatal error flag on fresh connect calls, not reconnect attempts
    // This allows fresh connect() to work after user re-authenticates
    if (this.stats.reconnectAttempts === 0) {
      this.isAuthFatalError = false;
    }
    this.updateConnectionState(WebSocketConnectionState.CONNECTING);
    this.log(`Connecting to WebSocket: ${this.config.url}`);

    try {
      this.ws = new WebSocket(this.config.url);
      this.setupEventListeners();
    } catch (error) {
      this.handleError("Failed to create WebSocket connection", error);
      this.scheduleReconnect();
    }
  }

  public disconnect(): void {
    this.log("Disconnecting WebSocket");
    this.isIntentionallyClosed = true;
    this.clearTimers();

    if (this.ws) {
      this.ws.close(1000, "Client disconnect");
      this.ws = null;
    }

    this.updateConnectionState(WebSocketConnectionState.DISCONNECTED);
  }

  public send(message: WebSocketMessage): boolean {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      this.log("Cannot send message: WebSocket not connected", "warn");
      return false;
    }

    try {
      this.ws.send(JSON.stringify(message));
      this.stats.messagesSent++;
      this.log(`Sent message: ${message.type}`);
      return true;
    } catch (error) {
      this.handleError("Failed to send message", error);
      return false;
    }
  }

  public on(eventType: WebSocketEventType, handler: EventHandler): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set());
    }
    this.eventHandlers.get(eventType)!.add(handler);
    this.log(`Registered handler for ${eventType}`);
  }

  public off(eventType: WebSocketEventType, handler: EventHandler): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
      this.log(`Unregistered handler for ${eventType}`);
    }
  }

  public getStats(): WebSocketStats {
    return { ...this.stats };
  }

  public getConnectionState(): WebSocketConnectionState {
    return this.stats.connectionState;
  }

  public isConnected(): boolean {
    return (
      this.ws?.readyState === WebSocket.OPEN &&
      this.stats.connectionState === WebSocketConnectionState.CONNECTED
    );
  }

  private setupEventListeners(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      this.log("WebSocket transport connected, sending authentication...");
      this.stats.reconnectAttempts = 0;
      this.stats.connectedAt = new Date();

      // Send authentication message immediately after connection
      if (this.config.accessToken) {
        this.sendAuthMessage(this.config.accessToken);
        this.startAuthTimeout();
      } else {
        // No token provided, emit connect event immediately
        this.log("No access token configured, skipping authentication");
        this.isAuthenticated = true;
        this.updateConnectionState(WebSocketConnectionState.CONNECTED);
        this.startHeartbeat();
        this.emit({
          type: WebSocketEventType.CONNECT,
          timestamp: new Date().toISOString(),
        });
      }
    };

    this.ws.onclose = (event) => {
      this.log(
        `WebSocket closed: ${event.code} ${event.reason || "No reason"}`,
      );
      this.clearTimers();
      this.updateConnectionState(WebSocketConnectionState.DISCONNECTED);
      this.emit({
        type: WebSocketEventType.DISCONNECT,
        timestamp: new Date().toISOString(),
      });

      if (!this.isIntentionallyClosed && !event.wasClean) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = (event) => {
      this.handleError("WebSocket error occurred", event);
    };

    this.ws.onmessage = (event) => {
      this.handleMessage(event.data);
    };
  }

  private handleMessage(data: string): void {
    this.stats.messagesReceived++;

    try {
      const message: WebSocketMessage = JSON.parse(data);
      this.log(`Received message: ${message.type}`);

      // Handle authentication responses
      if (message.type === WebSocketEventType.AUTH_SUCCESS) {
        this.handleAuthSuccess();
        return;
      }

      if (message.type === WebSocketEventType.AUTH_FAILURE) {
        const authFailure = message as { error?: string; statusCode?: number };
        this.handleAuthFailure(
          authFailure.error || "Authentication failed",
          authFailure.statusCode,
        );
        return;
      }

      if (message.type === WebSocketEventType.PING) {
        this.send({
          type: WebSocketEventType.PONG,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Handle PONG response from server
      if (message.type === WebSocketEventType.PONG) {
        this.handlePong();
        return;
      }

      this.emit(message);
    } catch (error) {
      this.handleError("Failed to parse WebSocket message", error);
    }
  }

  private sendAuthMessage(token: string): void {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      this.handleError("Cannot send auth message: WebSocket not open", null);
      return;
    }

    try {
      const authMessage = {
        type: WebSocketEventType.AUTH,
        token,
        timestamp: new Date().toISOString(),
      };
      this.ws.send(JSON.stringify(authMessage));
      this.stats.messagesSent++;
      this.log("Authentication message sent");
    } catch (error) {
      this.handleError("Failed to send authentication message", error);
      this.scheduleReconnect();
    }
  }

  private startAuthTimeout(): void {
    if (this.authTimeoutTimer) {
      clearTimeout(this.authTimeoutTimer);
    }

    this.authTimeoutTimer = setTimeout(() => {
      if (!this.isAuthenticated) {
        this.handleAuthFailure("Authentication timeout - no response received");
      }
    }, this.config.authTimeout);

    this.log(`Authentication timeout started (${this.config.authTimeout}ms)`);
  }

  private handleAuthSuccess(): void {
    if (this.authTimeoutTimer) {
      clearTimeout(this.authTimeoutTimer);
      this.authTimeoutTimer = null;
    }

    this.isAuthenticated = true;
    this.log("Authentication successful");
    this.updateConnectionState(WebSocketConnectionState.CONNECTED);
    this.startHeartbeat();

    this.emit({
      type: WebSocketEventType.AUTH_SUCCESS,
      timestamp: new Date().toISOString(),
    });

    this.emit({
      type: WebSocketEventType.CONNECT,
      timestamp: new Date().toISOString(),
    });
  }

  private categorizeAuthError(
    error: string,
    statusCode?: number,
  ): AuthErrorCategory {
    // Check status code first
    if (statusCode !== undefined) {
      if (statusCode === 401 || statusCode === 403) {
        return AuthErrorCategory.TOKEN_INVALID;
      }
      if (statusCode >= 500 && statusCode < 600) {
        return AuthErrorCategory.SERVER_ERROR;
      }
    }

    // Check error message patterns for token-related issues
    const tokenInvalidPatterns = [
      "invalid token",
      "token expired",
      "token revoked",
      "unauthorized",
      "forbidden",
      "invalid credentials",
      "authentication required",
      "session expired",
      "invalid session",
    ];

    const lowerError = error.toLowerCase();
    if (tokenInvalidPatterns.some((pattern) => lowerError.includes(pattern))) {
      return AuthErrorCategory.TOKEN_INVALID;
    }

    // Check for network-related patterns
    const networkPatterns = [
      "timeout",
      "network",
      "connection",
      "econnrefused",
      "enotfound",
      "dns",
    ];

    if (networkPatterns.some((pattern) => lowerError.includes(pattern))) {
      return AuthErrorCategory.NETWORK_ERROR;
    }

    // Check for server error patterns
    const serverPatterns = [
      "server error",
      "internal error",
      "service unavailable",
      "bad gateway",
      "gateway timeout",
    ];

    if (serverPatterns.some((pattern) => lowerError.includes(pattern))) {
      return AuthErrorCategory.SERVER_ERROR;
    }

    // Default to server error for unknown cases (allows retry)
    return AuthErrorCategory.SERVER_ERROR;
  }

  private handleAuthFailure(error: string, statusCode?: number): void {
    if (this.authTimeoutTimer) {
      clearTimeout(this.authTimeoutTimer);
      this.authTimeoutTimer = null;
    }

    this.isAuthenticated = false;
    this.stats.lastError = `Authentication failed: ${error}`;

    const category = this.categorizeAuthError(error, statusCode);
    this.log(
      `Authentication failed: ${error} (category: ${category}, status: ${statusCode ?? "unknown"})`,
      "error",
    );

    // Emit AUTH_FAILURE with category information
    this.emit({
      type: WebSocketEventType.AUTH_FAILURE,
      error,
      statusCode,
      category,
      timestamp: new Date().toISOString(),
    });

    // Handle based on error category
    if (category === AuthErrorCategory.TOKEN_INVALID) {
      // Fatal error - don't retry, emit auth expired event
      this.isAuthFatalError = true;
      this.log(
        "Token invalid - stopping reconnection attempts, emitting auth_expired",
        "error",
      );

      this.emit({
        type: WebSocketEventType.AUTH_EXPIRED,
        reason: error,
        timestamp: new Date().toISOString(),
      });

      // Close the connection without scheduling reconnect
      if (this.ws) {
        this.ws.close(4001, "Authentication failed - invalid token");
      }
      this.updateConnectionState(WebSocketConnectionState.ERROR);
      // Do NOT schedule reconnect for token invalid errors
      return;
    }

    // Close the connection
    if (this.ws) {
      this.ws.close(4001, "Authentication failed");
    }
    this.updateConnectionState(WebSocketConnectionState.ERROR);

    if (category === AuthErrorCategory.NETWORK_ERROR) {
      // Network errors - retry without max attempt limit
      this.log(
        "Network error during auth - will retry with backoff (no max attempts)",
        "warn",
      );
      this.scheduleReconnect(true); // true = unlimited retries
    } else {
      // Server errors - normal backoff with max attempts
      this.log("Server error during auth - will retry with backoff", "warn");
      this.scheduleReconnect();
    }
  }

  private emit(event: WebSocketMessage): void {
    const handlers = this.eventHandlers.get(event.type);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(event);
        } catch (error) {
          this.handleError(
            `Error in handler for ${event.type}`,
            error as Error,
          );
        }
      });
    }
  }

  private scheduleReconnect(unlimitedRetries = false): void {
    if (this.isIntentionallyClosed) {
      return;
    }

    // Check for fatal auth errors - don't retry
    if (this.isAuthFatalError) {
      this.log("Skipping reconnect due to fatal auth error", "warn");
      return;
    }

    // Only check max attempts if not doing unlimited retries
    if (
      !unlimitedRetries &&
      this.stats.reconnectAttempts >= this.config.maxReconnectAttempts
    ) {
      this.log(
        `Max reconnection attempts (${this.config.maxReconnectAttempts}) reached`,
        "error",
      );
      this.updateConnectionState(WebSocketConnectionState.ERROR);
      this.stats.lastError = "Max reconnection attempts exceeded";
      return;
    }

    this.updateConnectionState(WebSocketConnectionState.RECONNECTING);
    this.stats.reconnectAttempts++;

    const delay = calculateBackoff(
      this.stats.reconnectAttempts,
      this.config.reconnectDelay,
      WS_CONFIG.MAX_RECONNECT_DELAY_MS,
      true,
    );

    const attemptsDisplay = unlimitedRetries
      ? `${this.stats.reconnectAttempts}/∞`
      : `${this.stats.reconnectAttempts}/${this.config.maxReconnectAttempts}`;

    this.log(
      `Scheduling reconnection attempt ${attemptsDisplay} in ${delay}ms`,
    );

    this.reconnectTimer = setTimeout(() => {
      this.log(`Reconnection attempt ${this.stats.reconnectAttempts}`);
      this.emit({
        type: WebSocketEventType.RECONNECT,
        timestamp: new Date().toISOString(),
      });
      this.connect();
    }, delay);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected()) {
        this.sendPing();
      }
    }, this.config.heartbeatInterval);
    this.log(
      `Heartbeat started (interval: ${this.config.heartbeatInterval}ms)`,
    );
  }

  private sendPing(): void {
    // Record when ping was sent for latency tracking
    this.lastPingTime = Date.now();

    this.send({
      type: WebSocketEventType.PING,
      timestamp: new Date().toISOString(),
    });

    // Start PONG timeout - if no response within PONG_TIMEOUT, connection is zombie
    this.pongTimeoutTimer = setTimeout(() => {
      this.handlePongTimeout();
    }, this.PONG_TIMEOUT);

    this.log(`PING sent, expecting PONG within ${this.PONG_TIMEOUT}ms`);
  }

  private handlePong(): void {
    // Clear the PONG timeout since we received a response
    if (this.pongTimeoutTimer) {
      clearTimeout(this.pongTimeoutTimer);
      this.pongTimeoutTimer = null;
    }

    // Calculate latency if we have a ping time
    if (this.lastPingTime !== null) {
      const latency = Date.now() - this.lastPingTime;
      this.stats.lastPingLatency = latency;

      // Track latency history for average calculation
      this.latencyHistory.push(latency);
      if (this.latencyHistory.length > this.MAX_LATENCY_SAMPLES) {
        this.latencyHistory.shift();
      }

      // Calculate average latency
      const sum = this.latencyHistory.reduce((a, b) => a + b, 0);
      this.stats.averageLatency = Math.round(sum / this.latencyHistory.length);

      this.log(
        `PONG received, latency: ${latency}ms, avg: ${this.stats.averageLatency}ms`,
      );
      this.lastPingTime = null;
    } else {
      this.log("PONG received (unsolicited)");
    }
  }

  private handlePongTimeout(): void {
    this.log("PONG timeout - server unresponsive, reconnecting...", "warn");
    this.stats.lastError = "PONG timeout - server unresponsive";
    this.lastPingTime = null;

    // Clear the timeout reference
    this.pongTimeoutTimer = null;

    // Close the existing connection and reconnect
    if (this.ws) {
      this.ws.close(4002, "PONG timeout");
    }

    this.scheduleReconnect();
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
      this.log("Heartbeat stopped");
    }
    // Also clear any pending PONG timeout
    if (this.pongTimeoutTimer) {
      clearTimeout(this.pongTimeoutTimer);
      this.pongTimeoutTimer = null;
    }
  }

  private clearTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.authTimeoutTimer) {
      clearTimeout(this.authTimeoutTimer);
      this.authTimeoutTimer = null;
    }
    if (this.pongTimeoutTimer) {
      clearTimeout(this.pongTimeoutTimer);
      this.pongTimeoutTimer = null;
    }
    this.stopHeartbeat();
  }

  private updateConnectionState(state: WebSocketConnectionState): void {
    this.stats.connectionState = state;
    this.log(`Connection state: ${state}`);
  }

  private handleError(message: string, error: unknown): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    this.stats.lastError = `${message}: ${errorMessage}`;
    this.log(`${message}: ${errorMessage}`, "error");

    this.emit({
      type: WebSocketEventType.ERROR,
      timestamp: new Date().toISOString(),
      error: this.stats.lastError,
    });
  }

  private log(message: string, level: "log" | "warn" | "error" = "log"): void {
    if (this.config.debug) {
      const prefix = "🔌 [WebSocket]";
      switch (level) {
        case "warn":
          debug.warn(`${prefix} ${message}`);
          break;
        case "error":
          debug.error(`${prefix} ${message}`);
          break;
        default:
          debug.log(`${prefix} ${message}`);
      }
    }
  }
}

let wsService: WebSocketService | null = null;

export function initializeWebSocketService(
  config: WebSocketConfig,
): WebSocketService {
  if (wsService) {
    wsService.disconnect();
  }
  wsService = new WebSocketService(config);
  return wsService;
}

export function getWebSocketService(): WebSocketService | null {
  return wsService;
}

export function disconnectWebSocket(): void {
  if (wsService) {
    wsService.disconnect();
    wsService = null;
  }
}
