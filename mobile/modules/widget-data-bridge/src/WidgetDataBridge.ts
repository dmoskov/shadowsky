import { Platform } from "react-native";

let WidgetDataBridgeModule: {
  updateNotificationData(data: Record<string, unknown>): void;
  updateTrendingData(jsonString: string): void;
  updateDMData(jsonString: string): void;
  updateUserHandle(handle: string): void;
  clearWidgetData(): void;
  reloadAllWidgets(): void;
} | null = null;

try {
  WidgetDataBridgeModule =
    require("expo-modules-core").requireNativeModule("WidgetDataBridge");
} catch {
  // Module not available (web or not built with native modules)
}

export interface NotificationWidgetUpdate {
  unreadCount: number;
  lastNotificationText?: string;
  lastNotificationAuthor?: string;
  lastNotificationReason?: string;
  lastNotificationTimestamp?: number;
}

export interface TrendingTopicWidget {
  topic: string;
  status?: string;
}

export interface DMConversationWidget {
  conversationId: string;
  memberName: string;
  memberHandle: string;
  lastMessageText: string;
  lastMessageTimestamp: number;
  unreadCount: number;
}

/**
 * Update the notification count widget data.
 * Called after fetching notifications or unread count.
 */
export function updateNotificationWidgetData(
  data: NotificationWidgetUpdate
): void {
  if (Platform.OS !== "ios" || !WidgetDataBridgeModule) return;
  try {
    WidgetDataBridgeModule.updateNotificationData({
      unreadCount: data.unreadCount,
      lastNotificationText: data.lastNotificationText || "",
      lastNotificationAuthor: data.lastNotificationAuthor || "",
      lastNotificationReason: data.lastNotificationReason || "",
      lastNotificationTimestamp: data.lastNotificationTimestamp || 0,
    });
  } catch {
    // Silently ignore bridge failures
  }
}

/**
 * Update the trending topics widget data.
 * Called after fetching trending topics.
 */
export function updateTrendingWidgetData(topics: TrendingTopicWidget[]): void {
  if (Platform.OS !== "ios" || !WidgetDataBridgeModule) return;
  try {
    WidgetDataBridgeModule.updateTrendingData(JSON.stringify(topics));
  } catch {
    // Silently ignore bridge failures
  }
}

/**
 * Update the recent DMs widget data.
 * Called after fetching DM conversations.
 */
export function updateDMWidgetData(conversations: DMConversationWidget[]): void {
  if (Platform.OS !== "ios" || !WidgetDataBridgeModule) return;
  try {
    WidgetDataBridgeModule.updateDMData(JSON.stringify(conversations));
  } catch {
    // Silently ignore bridge failures
  }
}

/**
 * Update the user handle for widget display.
 * Called on sign in.
 */
export function updateWidgetUserHandle(handle: string): void {
  if (Platform.OS !== "ios" || !WidgetDataBridgeModule) return;
  try {
    WidgetDataBridgeModule.updateUserHandle(handle);
  } catch {
    // Silently ignore
  }
}

/**
 * Clear all widget data. Called on sign out.
 */
export function clearWidgetData(): void {
  if (Platform.OS !== "ios" || !WidgetDataBridgeModule) return;
  try {
    WidgetDataBridgeModule.clearWidgetData();
  } catch {
    // Silently ignore
  }
}

/**
 * Force reload all widget timelines.
 */
export function reloadAllWidgets(): void {
  if (Platform.OS !== "ios" || !WidgetDataBridgeModule) return;
  try {
    WidgetDataBridgeModule.reloadAllWidgets();
  } catch {
    // Silently ignore
  }
}
