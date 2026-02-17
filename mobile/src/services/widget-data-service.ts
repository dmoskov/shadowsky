/**
 * Widget Data Service
 *
 * Syncs app data to WidgetKit widgets via the widget-data-bridge native module.
 * Called from background fetch and when relevant data changes in the foreground.
 */

import { Platform } from "react-native";
import {
  updateNotificationWidgetData,
  updateTrendingWidgetData,
  updateDMWidgetData,
  updateWidgetUserHandle,
  clearWidgetData,
} from "../../modules/widget-data-bridge";
import type {
  TrendingTopicWidget,
  DMConversationWidget,
} from "../../modules/widget-data-bridge";
import { createLogger } from "../utils/logger";

const logger = createLogger("WidgetDataService");

/**
 * Update notification widget with latest unread count and last notification.
 */
export function syncNotificationWidget(
  unreadCount: number,
  notifications?: Array<{
    reason?: string;
    author?: { handle?: string; displayName?: string };
    record?: { text?: string };
    indexedAt?: string;
  }>
): void {
  if (Platform.OS !== "ios") return;
  try {
    let lastText = "";
    let lastAuthor = "";
    let lastReason = "";
    let lastTimestamp = 0;

    if (notifications && notifications.length > 0) {
      const latest = notifications[0];
      lastReason = latest.reason || "";
      lastAuthor =
        latest.author?.displayName || latest.author?.handle || "";

      // Build preview text based on notification type
      switch (lastReason) {
        case "like":
          lastText = `liked your post`;
          break;
        case "repost":
          lastText = `reposted your post`;
          break;
        case "follow":
          lastText = `followed you`;
          break;
        case "mention":
          lastText = latest.record?.text || "mentioned you";
          break;
        case "reply":
          lastText = latest.record?.text || "replied to your post";
          break;
        case "quote":
          lastText = latest.record?.text || "quoted your post";
          break;
        default:
          lastText = latest.record?.text || "";
      }

      if (latest.indexedAt) {
        lastTimestamp = new Date(latest.indexedAt).getTime();
      }
    }

    updateNotificationWidgetData({
      unreadCount,
      lastNotificationText: lastText,
      lastNotificationAuthor: lastAuthor,
      lastNotificationReason: lastReason,
      lastNotificationTimestamp: lastTimestamp,
    });
  } catch (error) {
    logger.error("Failed to sync notification widget:", error);
  }
}

/**
 * Update trending topics widget with latest topics.
 */
export function syncTrendingWidget(
  topics: Array<{ topic: string; status?: string }>
): void {
  if (Platform.OS !== "ios") return;
  try {
    const widgetTopics: TrendingTopicWidget[] = topics
      .slice(0, 5)
      .map((t) => ({
        topic: t.topic,
        status: t.status || undefined,
      }));
    updateTrendingWidgetData(widgetTopics);
  } catch (error) {
    logger.error("Failed to sync trending widget:", error);
  }
}

/**
 * Update recent DMs widget with latest conversations.
 */
export function syncDMWidget(
  conversations: Array<{
    id: string;
    members: Array<{
      did: string;
      handle?: string;
      displayName?: string;
    }>;
    lastMessage?: {
      text: string;
      sentAt: string;
    };
    unreadCount: number;
  }>,
  currentUserDid?: string
): void {
  if (Platform.OS !== "ios") return;
  try {
    const widgetConvos: DMConversationWidget[] = conversations
      .filter((c) => c.lastMessage)
      .slice(0, 5)
      .map((convo) => {
        // Find the other member (not the current user)
        const otherMember =
          convo.members.find((m) => m.did !== currentUserDid) ||
          convo.members[0];
        return {
          conversationId: convo.id,
          memberName: otherMember?.displayName || otherMember?.handle || "Unknown",
          memberHandle: otherMember?.handle || "",
          lastMessageText: convo.lastMessage?.text || "",
          lastMessageTimestamp: convo.lastMessage?.sentAt
            ? new Date(convo.lastMessage.sentAt).getTime()
            : 0,
          unreadCount: convo.unreadCount,
        };
      });
    updateDMWidgetData(widgetConvos);
  } catch (error) {
    logger.error("Failed to sync DM widget:", error);
  }
}

/**
 * Update the user handle stored in widget data.
 * Call on sign in.
 */
export function syncWidgetUserHandle(handle: string): void {
  if (Platform.OS !== "ios") return;
  try {
    updateWidgetUserHandle(handle);
  } catch (error) {
    logger.error("Failed to sync widget user handle:", error);
  }
}

/**
 * Clear all widget data. Call on sign out.
 */
export function clearAllWidgetData(): void {
  if (Platform.OS !== "ios") return;
  try {
    clearWidgetData();
  } catch (error) {
    logger.error("Failed to clear widget data:", error);
  }
}
