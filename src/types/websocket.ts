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

  // Notification events
  NEW_NOTIFICATION = "notification:new",
  NOTIFICATION_READ = "notification:read",
  NOTIFICATION_COUNT = "notification:count",

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
}

export type WebSocketMessage =
  | NewNotificationEvent
  | NotificationCountEvent
  | NotificationReadEvent
  | WebSocketErrorEvent
  | AuthEvent
  | AuthSuccessEvent
  | AuthFailureEvent
  | WebSocketEvent;

export enum WebSocketConnectionState {
  CONNECTING = "connecting",
  CONNECTED = "connected",
  DISCONNECTED = "disconnected",
  RECONNECTING = "reconnecting",
  ERROR = "error",
}

export interface WebSocketConfig {
  url: string;
  accessToken?: string;
  authTimeout?: number;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
  debug?: boolean;
}

export interface WebSocketStats {
  connectionState: WebSocketConnectionState;
  connectedAt?: Date;
  reconnectAttempts: number;
  messagesSent: number;
  messagesReceived: number;
  lastError?: string;
}
