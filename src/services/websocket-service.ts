import { debug } from "@bsky/shared";
import {
  WebSocketConnectionState,
  WebSocketEventType,
  type WebSocketConfig,
  type WebSocketMessage,
  type WebSocketStats,
} from "../types/websocket";

type EventHandler = (event: WebSocketMessage) => void;

export class WebSocketService {
  private ws: WebSocket | null = null;
  private config: Required<WebSocketConfig>;
  private eventHandlers: Map<WebSocketEventType, Set<EventHandler>> = new Map();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private stats: WebSocketStats;
  private isIntentionallyClosed = false;

  constructor(config: WebSocketConfig) {
    this.config = {
      reconnectDelay: 5000,
      maxReconnectAttempts: 10,
      heartbeatInterval: 30000,
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
      this.log("WebSocket connected");
      this.stats.reconnectAttempts = 0;
      this.stats.connectedAt = new Date();
      this.updateConnectionState(WebSocketConnectionState.CONNECTED);
      this.startHeartbeat();
      this.emit({
        type: WebSocketEventType.CONNECT,
        timestamp: new Date().toISOString(),
      });
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

      if (message.type === WebSocketEventType.PING) {
        this.send({
          type: WebSocketEventType.PONG,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      this.emit(message);
    } catch (error) {
      this.handleError("Failed to parse WebSocket message", error);
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

  private scheduleReconnect(): void {
    if (this.isIntentionallyClosed) {
      return;
    }

    if (this.stats.reconnectAttempts >= this.config.maxReconnectAttempts) {
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

    const delay = Math.min(
      this.config.reconnectDelay *
        Math.pow(2, this.stats.reconnectAttempts - 1),
      30000,
    );

    this.log(
      `Scheduling reconnection attempt ${this.stats.reconnectAttempts}/${this.config.maxReconnectAttempts} in ${delay}ms`,
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
        this.send({
          type: WebSocketEventType.PING,
          timestamp: new Date().toISOString(),
        });
      }
    }, this.config.heartbeatInterval);
    this.log(
      `Heartbeat started (interval: ${this.config.heartbeatInterval}ms)`,
    );
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
      this.log("Heartbeat stopped");
    }
  }

  private clearTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
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
