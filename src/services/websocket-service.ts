import { debug } from "@bsky/shared";
import { WS_CONFIG } from "../config/websocket.config";
import {
  AuthErrorCategory,
  WebSocketConnectionState,
  WebSocketEventType,
  type WebSocketConfig,
  type WebSocketDebugState,
  type WebSocketMessage,
  type WebSocketMetrics,
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
  private readonly MAX_LATENCY_SAMPLES = 100; // Expanded for p95 calculation

  // Health metrics tracking
  private metricsStartTime: number = Date.now();
  private totalConnectedTime: number = 0;
  private lastConnectedTimestamp: number | null = null;
  private lastDisconnectedTimestamp: number | null = null;
  private totalReconnections: number = 0;
  private pongTimeoutCount: number = 0;
  private totalPingPongExchanges: number = 0;

  // Degraded state thresholds
  private readonly P95_LATENCY_THRESHOLD_MS = 5000; // 5 seconds
  private readonly PACKET_LOSS_THRESHOLD_PERCENT = 10; // 10%
  private readonly LONG_DISCONNECTION_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

  // Debug mode simulation settings
  private _debugLatency = 0;
  private _debugPacketLossPercent = 0;
  private _debugMessageQueue: Array<{
    message: WebSocketMessage;
    sendAt: number;
  }> = [];
  private _debugQueueTimer: ReturnType<typeof setInterval> | null = null;

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
    return {
      ...this.stats,
      metrics: this.calculateMetrics(),
    };
  }

  /**
   * Calculate the p95 latency from the latency history.
   * Returns the value at the 95th percentile of sorted samples.
   */
  private calculateP95Latency(): number {
    if (this.latencyHistory.length === 0) return 0;

    // Sort a copy of the array
    const sorted = [...this.latencyHistory].sort((a, b) => a - b);
    const p95Index = Math.floor(sorted.length * 0.95);
    return sorted[Math.min(p95Index, sorted.length - 1)];
  }

  /**
   * Calculate the packet loss percentage based on PONG timeouts.
   */
  private calculatePacketLossPercent(): number {
    if (this.totalPingPongExchanges === 0) return 0;
    return (this.pongTimeoutCount / this.totalPingPongExchanges) * 100;
  }

  /**
   * Calculate the uptime percentage since metrics started.
   */
  private calculateUptimePercent(): number {
    const now = Date.now();
    const totalTime = now - this.metricsStartTime;
    if (totalTime === 0) return 0;

    // Add current connected session if connected
    let connectedTime = this.totalConnectedTime;
    if (
      this.lastConnectedTimestamp !== null &&
      (this.stats.connectionState === WebSocketConnectionState.CONNECTED ||
        this.stats.connectionState === WebSocketConnectionState.DEGRADED)
    ) {
      connectedTime += now - this.lastConnectedTimestamp;
    }

    return Math.min(100, (connectedTime / totalTime) * 100);
  }

  /**
   * Check if connection is in a degraded state based on latency and packet loss.
   */
  private checkDegradedState(): { isDegraded: boolean; reason?: string } {
    const p95Latency = this.calculateP95Latency();
    const packetLoss = this.calculatePacketLossPercent();

    if (p95Latency > this.P95_LATENCY_THRESHOLD_MS) {
      return {
        isDegraded: true,
        reason: `High latency: p95 ${p95Latency}ms > ${this.P95_LATENCY_THRESHOLD_MS}ms threshold`,
      };
    }

    if (packetLoss > this.PACKET_LOSS_THRESHOLD_PERCENT) {
      return {
        isDegraded: true,
        reason: `High packet loss: ${packetLoss.toFixed(1)}% > ${this.PACKET_LOSS_THRESHOLD_PERCENT}% threshold`,
      };
    }

    return { isDegraded: false };
  }

  /**
   * Calculate comprehensive connection health metrics.
   */
  private calculateMetrics(): WebSocketMetrics {
    const p95Latency = this.calculateP95Latency();
    const avgLatency =
      this.latencyHistory.length > 0
        ? Math.round(
            this.latencyHistory.reduce((a, b) => a + b, 0) /
              this.latencyHistory.length,
          )
        : 0;
    const degradedState = this.checkDegradedState();

    return {
      uptimePercent: Math.round(this.calculateUptimePercent() * 100) / 100,
      reconnectionCount: this.totalReconnections,
      averageLatencyMs: avgLatency,
      p95LatencyMs: p95Latency,
      messagesSent: this.stats.messagesSent,
      messagesReceived: this.stats.messagesReceived,
      lastConnectedAt: this.lastConnectedTimestamp,
      lastDisconnectedAt: this.lastDisconnectedTimestamp,
      pongTimeouts: this.pongTimeoutCount,
      totalPingPongExchanges: this.totalPingPongExchanges,
      isDegraded: degradedState.isDegraded,
      degradedReason: degradedState.reason,
    };
  }

  /**
   * Reset metrics after a long disconnection period.
   */
  private resetMetricsIfNeeded(): void {
    if (this.lastDisconnectedTimestamp === null) return;

    const disconnectionDuration =
      Date.now() - this.lastDisconnectedTimestamp;
    if (disconnectionDuration > this.LONG_DISCONNECTION_THRESHOLD_MS) {
      this.log(
        `Long disconnection (${Math.round(disconnectionDuration / 1000)}s) - resetting metrics`,
      );
      this.resetMetrics();
    }
  }

  /**
   * Reset all metrics to initial state.
   */
  public resetMetrics(): void {
    this.metricsStartTime = Date.now();
    this.totalConnectedTime = 0;
    this.lastConnectedTimestamp = null;
    this.lastDisconnectedTimestamp = null;
    this.totalReconnections = 0;
    this.pongTimeoutCount = 0;
    this.totalPingPongExchanges = 0;
    this.latencyHistory = [];
    this.log("Metrics reset");
  }

  public getConnectionState(): WebSocketConnectionState {
    return this.stats.connectionState;
  }

  public isConnected(): boolean {
    return (
      this.ws?.readyState === WebSocket.OPEN &&
      (this.stats.connectionState === WebSocketConnectionState.CONNECTED ||
        this.stats.connectionState === WebSocketConnectionState.DEGRADED)
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

    // Track successful PING/PONG exchange
    this.totalPingPongExchanges++;

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

      // Check and update degraded state after receiving latency sample
      this.updateDegradedState();
    } else {
      this.log("PONG received (unsolicited)");
    }
  }

  /**
   * Update connection state to DEGRADED or CONNECTED based on health metrics.
   */
  private updateDegradedState(): void {
    const degradedCheck = this.checkDegradedState();
    const currentState = this.stats.connectionState;

    if (
      degradedCheck.isDegraded &&
      currentState === WebSocketConnectionState.CONNECTED
    ) {
      this.log(`Connection degraded: ${degradedCheck.reason}`, "warn");
      this.updateConnectionState(WebSocketConnectionState.DEGRADED);
    } else if (
      !degradedCheck.isDegraded &&
      currentState === WebSocketConnectionState.DEGRADED
    ) {
      this.log("Connection recovered from degraded state");
      this.updateConnectionState(WebSocketConnectionState.CONNECTED);
    }
  }

  private handlePongTimeout(): void {
    this.log("PONG timeout - server unresponsive, reconnecting...", "warn");
    this.stats.lastError = "PONG timeout - server unresponsive";
    this.lastPingTime = null;

    // Track PONG timeout for packet loss metrics
    this.pongTimeoutCount++;
    this.totalPingPongExchanges++;

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
    const previousState = this.stats.connectionState;
    const now = Date.now();

    // Track connected time when transitioning away from connected/degraded states
    if (
      (previousState === WebSocketConnectionState.CONNECTED ||
        previousState === WebSocketConnectionState.DEGRADED) &&
      state !== WebSocketConnectionState.CONNECTED &&
      state !== WebSocketConnectionState.DEGRADED &&
      this.lastConnectedTimestamp !== null
    ) {
      this.totalConnectedTime += now - this.lastConnectedTimestamp;
      this.lastDisconnectedTimestamp = now;
      this.lastConnectedTimestamp = null;
    }

    // Track when connection is established
    if (
      (state === WebSocketConnectionState.CONNECTED ||
        state === WebSocketConnectionState.DEGRADED) &&
      previousState !== WebSocketConnectionState.CONNECTED &&
      previousState !== WebSocketConnectionState.DEGRADED
    ) {
      // Check if we should reset metrics after long disconnection
      this.resetMetricsIfNeeded();
      this.lastConnectedTimestamp = now;
    }

    // Track reconnections
    if (
      state === WebSocketConnectionState.RECONNECTING &&
      previousState !== WebSocketConnectionState.RECONNECTING
    ) {
      this.totalReconnections++;
    }

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

  // =================================================================
  // DEBUG METHODS - For stress testing and simulation
  // These methods are prefixed with _debug to indicate they should
  // only be used in development/testing scenarios
  // =================================================================

  /**
   * Set artificial latency for all outgoing messages
   * @param ms - Delay in milliseconds (0 to disable)
   */
  public _debugSetLatency(ms: number): void {
    this._debugLatency = Math.max(0, Math.min(ms, 10000)); // Cap at 10 seconds
    this.log(`[DEBUG] Latency set to ${this._debugLatency}ms`, "warn");

    // Start or stop the queue processor based on latency setting
    if (this._debugLatency > 0 && !this._debugQueueTimer) {
      this._debugQueueTimer = setInterval(() => {
        this._processDebugQueue();
      }, 50);
    } else if (this._debugLatency === 0 && this._debugQueueTimer) {
      clearInterval(this._debugQueueTimer);
      this._debugQueueTimer = null;
      // Flush any remaining queued messages
      this._debugMessageQueue.forEach(({ message }) => {
        this._sendImmediate(message);
      });
      this._debugMessageQueue = [];
    }
  }

  /**
   * Get the current artificial latency setting
   */
  public _debugGetLatency(): number {
    return this._debugLatency;
  }

  /**
   * Set packet loss percentage for simulating unreliable networks
   * @param percent - Percentage of messages to drop (0-100)
   */
  public _debugSetPacketLoss(percent: number): void {
    this._debugPacketLossPercent = Math.max(0, Math.min(percent, 100));
    this.log(
      `[DEBUG] Packet loss set to ${this._debugPacketLossPercent}%`,
      "warn",
    );
  }

  /**
   * Get the current packet loss percentage
   */
  public _debugGetPacketLoss(): number {
    return this._debugPacketLossPercent;
  }

  /**
   * Force disconnect with a specific close code
   * @param code - WebSocket close code (1000-4999)
   */
  public _debugForceDisconnect(code: number = 1006): void {
    this.log(`[DEBUG] Forcing disconnect with code ${code}`, "warn");
    if (this.ws) {
      // Mark as not intentionally closed so reconnect will happen
      this.isIntentionallyClosed = false;
      this.ws.close(code, `Debug forced disconnect (code: ${code})`);
    }
  }

  /**
   * Force a reconnection cycle
   */
  public _debugForceReconnect(): void {
    this.log("[DEBUG] Forcing reconnection cycle", "warn");
    if (this.ws) {
      this.isIntentionallyClosed = false;
      this.ws.close(1000, "Debug forced reconnect");
    }
    // Immediately schedule reconnect
    this.scheduleReconnect();
  }

  /**
   * Send multiple messages rapidly for stress testing
   * @param count - Number of messages to send
   * @param intervalMs - Interval between messages (default 10ms)
   * @returns Promise that resolves when flood is complete
   */
  public _debugFloodMessages(
    count: number,
    intervalMs: number = 10,
  ): Promise<number> {
    return new Promise((resolve) => {
      this.log(
        `[DEBUG] Flooding ${count} messages at ${intervalMs}ms interval`,
      );
      let sent = 0;
      const flood = setInterval(() => {
        if (sent >= count || !this.isConnected()) {
          clearInterval(flood);
          this.log(`[DEBUG] Flood complete: sent ${sent} messages`);
          resolve(sent);
          return;
        }
        this.send({
          type: WebSocketEventType.PING,
          timestamp: new Date().toISOString(),
        });
        sent++;
      }, intervalMs);
    });
  }

  /**
   * Get current debug settings and internal state
   */
  public _debugGetState(): WebSocketDebugState {
    return {
      latency: this._debugLatency,
      packetLoss: this._debugPacketLossPercent,
      queuedMessages: this._debugMessageQueue.length,
      connectionState: this.stats.connectionState,
      isAuthenticated: this.isAuthenticated,
      reconnectAttempts: this.stats.reconnectAttempts,
      wsReadyState: this.ws?.readyState ?? null,
      messagesSent: this.stats.messagesSent,
      messagesReceived: this.stats.messagesReceived,
      lastPingLatency: this.stats.lastPingLatency,
      averageLatency: this.stats.averageLatency,
    };
  }

  /**
   * Reset all debug settings to defaults
   */
  public _debugReset(): void {
    this._debugSetLatency(0);
    this._debugSetPacketLoss(0);
    this.log("[DEBUG] All debug settings reset");
  }

  /**
   * Internal method to send a message immediately, bypassing debug simulations
   */
  private _sendImmediate(message: WebSocketMessage): boolean {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      return false;
    }
    try {
      this.ws.send(JSON.stringify(message));
      this.stats.messagesSent++;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Process the debug message queue (used when latency simulation is enabled)
   */
  private _processDebugQueue(): void {
    const now = Date.now();
    const toSend = this._debugMessageQueue.filter((item) => item.sendAt <= now);
    this._debugMessageQueue = this._debugMessageQueue.filter(
      (item) => item.sendAt > now,
    );

    for (const { message } of toSend) {
      this._sendImmediate(message);
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
