/**
 * Push Notification Types
 *
 * Defines the types for browser push notifications, subscription management,
 * and notification payloads for background delivery.
 */

import type { Notification } from "@atproto/api/dist/client/types/app/bsky/notification/listNotifications";

/**
 * Push notification subscription state
 */
export type PushPermissionState =
  | "prompt"
  | "granted"
  | "denied"
  | "unsupported";

/**
 * Push subscription status
 */
export interface PushSubscriptionStatus {
  isSupported: boolean;
  permission: PushPermissionState;
  isSubscribed: boolean;
  subscription: PushSubscription | null;
  error?: string;
}

/**
 * Push notification payload sent from server
 */
export interface PushNotificationPayload {
  type: "notification" | "message" | "system";
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  tag?: string;
  data?: PushNotificationData;
  actions?: PushNotificationAction[];
  requireInteraction?: boolean;
  silent?: boolean;
  timestamp?: number;
  renotify?: boolean;
  vibrate?: number[];
}

/**
 * Data attached to push notification for click handling
 */
export interface PushNotificationData {
  url?: string;
  notificationUri?: string;
  authorDid?: string;
  reason?: string;
  postUri?: string;
  threadUri?: string;
  notification?: Notification;
}

/**
 * Action buttons on notifications
 */
export interface PushNotificationAction {
  action: string;
  title: string;
  icon?: string;
}

/**
 * Push subscription for server storage
 */
export interface PushSubscriptionPayload {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  expirationTime: number | null;
  userAgent: string;
  createdAt: number;
}

/**
 * Notification grouping configuration
 */
export interface NotificationGroupConfig {
  maxNotifications: number;
  groupByAuthor: boolean;
  groupByType: boolean;
  collapseDelay: number;
}

/**
 * Grouped notification for stacking
 */
export interface GroupedNotification {
  id: string;
  type: string;
  count: number;
  latestNotification: PushNotificationPayload;
  notifications: PushNotificationPayload[];
  groupKey: string;
}

/**
 * Service worker message types for communication
 */
export enum PushServiceWorkerMessageType {
  // From main thread to service worker
  SUBSCRIBE = "push:subscribe",
  UNSUBSCRIBE = "push:unsubscribe",
  GET_SUBSCRIPTION = "push:getSubscription",
  UPDATE_SETTINGS = "push:updateSettings",
  CLEAR_NOTIFICATIONS = "push:clearNotifications",

  // From service worker to main thread
  SUBSCRIPTION_CHANGE = "push:subscriptionChange",
  NOTIFICATION_CLICK = "push:notificationClick",
  NOTIFICATION_CLOSE = "push:notificationClose",
  PUSH_RECEIVED = "push:received",
}

/**
 * Messages between main thread and service worker
 */
export interface PushServiceWorkerMessage {
  type: PushServiceWorkerMessageType;
  payload?: unknown;
  error?: string;
}

/**
 * Push notification settings stored locally
 */
export interface PushNotificationSettings {
  enabled: boolean;
  likes: boolean;
  reposts: boolean;
  follows: boolean;
  mentions: boolean;
  replies: boolean;
  quotes: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string; // HH:mm format
  quietHoursEnd: string; // HH:mm format
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  groupNotifications: boolean;
}

/**
 * Default push notification settings
 */
export const DEFAULT_PUSH_SETTINGS: PushNotificationSettings = {
  enabled: true,
  likes: true,
  reposts: true,
  follows: true,
  mentions: true,
  replies: true,
  quotes: true,
  quietHoursEnabled: false,
  quietHoursStart: "22:00",
  quietHoursEnd: "08:00",
  soundEnabled: true,
  vibrationEnabled: true,
  groupNotifications: true,
};

/**
 * VAPID public key type (should be set from environment)
 */
export type VAPIDPublicKey = string;
