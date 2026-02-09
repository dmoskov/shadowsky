import type { Notification } from "@atproto/api/dist/client/types/app/bsky/notification/listNotifications";

export enum WebSocketEventType {
  // Connection events
  CONNECT = "connect",
  DISCONNECT = "disconnect",
  ERROR = "error",
  RECONNECT = "reconnect",

  // Authentication events
  AUTH = "auth",
  AUTH_SUCCESS = "auth:success",
  AUTH_FAILURE = "auth:failure",
  AUTH_EXPIRED = "auth:expired",

  // Notification events
  NEW_NOTIFICATION = "notification:new",
  NOTIFICATION_READ = "notification:read",
  NOTIFICATION_COUNT = "notification:count",

  // Engagement events (real-time like/repost count updates)
  ENGAGEMENT_SUBSCRIBE = "engagement:subscribe",
  ENGAGEMENT_UNSUBSCRIBE = "engagement:unsubscribe",
  ENGAGEMENT_UPDATE = "engagement:update",

  // System events
  PING = "ping",
  PONG = "pong",
}

export interface WebSocketEvent {
  type: WebSocketEventType;
  timestamp: string;
}

export interface NewNotificationEvent extends WebSocketEvent {
  type: WebSocketEventType.NEW_NOTIFICATION;
  notification: Notification;
}

export interface NotificationCountEvent extends WebSocketEvent {
  type: WebSocketEventType.NOTIFICATION_COUNT;
  count: number;
}

export interface NotificationReadEvent extends WebSocketEvent {
  type: WebSocketEventType.NOTIFICATION_READ;
  notificationIds: string[];
  seenAt: string;
}

export interface WebSocketErrorEvent extends WebSocketEvent {
  type: WebSocketEventType.ERROR;
  error: string;
  code?: string;
}

export interface AuthEvent extends WebSocketEvent {
  type: WebSocketEventType.AUTH;
  token: string;
}

export interface AuthSuccessEvent extends WebSocketEvent {
  type: WebSocketEventType.AUTH_SUCCESS;
}

export interface AuthFailureEvent extends WebSocketEvent {
  type: WebSocketEventType.AUTH_FAILURE;
  error: string;
  statusCode?: number;
  category?: AuthErrorCategory;
}

export interface AuthExpiredEvent extends WebSocketEvent {
  type: WebSocketEventType.AUTH_EXPIRED;
  reason: string;
}

/**
 * Engagement counts for a single post
 */
export interface PostEngagement {
  uri: string;
  likeCount: number;
  repostCount: number;
  replyCount: number;
}

/**
 * Subscribe to engagement updates for specific post URIs
 */
export interface EngagementSubscribeEvent extends WebSocketEvent {
  type: WebSocketEventType.ENGAGEMENT_SUBSCRIBE;
  postUris: string[];
}

/**
 * Unsubscribe from engagement updates
 */
export interface EngagementUnsubscribeEvent extends WebSocketEvent {
  type: WebSocketEventType.ENGAGEMENT_UNSUBSCRIBE;
  postUris: string[];
}

/**
 * Server-sent event containing batched engagement updates
 */
export interface EngagementUpdateEvent extends WebSocketEvent {
  type: WebSocketEventType.ENGAGEMENT_UPDATE;
  updates: PostEngagement[];
}

export enum AuthErrorCategory {
  TOKEN_INVALID = "token_invalid",
  SERVER_ERROR = "server_error",
  NETWORK_ERROR = "network_error",
}

export type WebSocketMessage =
  | NewNotificationEvent
  | NotificationCountEvent
  | NotificationReadEvent
  | WebSocketErrorEvent
  | AuthEvent
  | AuthSuccessEvent
  | AuthFailureEvent
  | AuthExpiredEvent
  | EngagementSubscribeEvent
  | EngagementUnsubscribeEvent
  | EngagementUpdateEvent
  | WebSocketEvent;

export enum WebSocketConnectionState {
  CONNECTING = "connecting",
  CONNECTED = "connected",
  DEGRADED = "degraded",
  DISCONNECTED = "disconnected",
  RECONNECTING = "reconnecting",
  ERROR = "error",
}

export interface WebSocketConfig {
  url: string;
  /** JWT access token for app-password auth (server polls notifications) */
  accessToken?: string;
  /** DID for OAuth auth (client polls notifications, server is webhook-style) */
  did?: string;
  authTimeout?: number;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
  debug?: boolean;
}

export interface WebSocketMetrics {
  /** Percentage of time the connection has been up (0-100) */
  uptimePercent: number;
  /** Total number of reconnection attempts since service started */
  reconnectionCount: number;
  /** Average latency from PING/PONG timing in milliseconds */
  averageLatencyMs: number;
  /** 95th percentile latency in milliseconds */
  p95LatencyMs: number;
  /** Total messages sent */
  messagesSent: number;
  /** Total messages received */
  messagesReceived: number;
  /** Timestamp of last successful connection */
  lastConnectedAt: number | null;
  /** Timestamp of last disconnection */
  lastDisconnectedAt: number | null;
  /** Number of PONG timeouts (packet loss indicator) */
  pongTimeouts: number;
  /** Total PING/PONG exchanges */
  totalPingPongExchanges: number;
  /** Whether the connection is currently degraded */
  isDegraded: boolean;
  /** Reason for degraded state, if applicable */
  degradedReason?: string;
  /** Number of events queued during disconnection */
  queuedEvents?: number;
}

export interface WebSocketStats {
  connectionState: WebSocketConnectionState;
  connectedAt?: Date;
  reconnectAttempts: number;
  messagesSent: number;
  messagesReceived: number;
  lastError?: string;
  lastPingLatency?: number;
  averageLatency?: number;
  /** Extended health metrics */
  metrics?: WebSocketMetrics;
}

/** Debug state for WebSocket stress testing panel */
export interface WebSocketDebugState {
  /** Artificial latency in milliseconds */
  latency: number;
  /** Packet loss percentage (0-100) */
  packetLoss: number;
  /** Number of messages currently queued due to latency simulation */
  queuedMessages: number;
  /** Current connection state */
  connectionState: WebSocketConnectionState;
  /** Whether authenticated with the server */
  isAuthenticated: boolean;
  /** Current reconnect attempt count */
  reconnectAttempts: number;
  /** Raw WebSocket readyState (0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED) */
  wsReadyState: number | null;
  /** Total messages sent */
  messagesSent: number;
  /** Total messages received */
  messagesReceived: number;
  /** Last ping latency in ms */
  lastPingLatency?: number;
  /** Average latency in ms */
  averageLatency?: number;
}
