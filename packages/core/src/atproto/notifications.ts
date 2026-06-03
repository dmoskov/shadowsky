/**
 * Notification operations against the AT Protocol.
 *
 * Canonical, platform-agnostic functions: each takes a `BskyAgent` explicitly
 * and contains no rate limiting (callers inject that).
 */

import type { BskyAgent } from "@atproto/api";

export interface NotificationsOptions {
  limit?: number;
  cursor?: string;
  /** When true, only return notifications from followed accounts. */
  priority?: boolean;
  seenAt?: string;
}

/** List notifications. */
export async function getNotifications(
  agent: BskyAgent,
  options: NotificationsOptions = {},
) {
  const response = await agent.app.bsky.notification.listNotifications({
    limit: options.limit || 50,
    cursor: options.cursor,
    priority: options.priority,
  });
  return {
    notifications: response.data.notifications,
    cursor: response.data.cursor,
    seenAt: response.data.seenAt,
  };
}

/** Get the unread notification count. */
export async function getUnreadCount(agent: BskyAgent) {
  const response = await agent.app.bsky.notification.getUnreadCount();
  return response.data.count;
}

/** Mark notifications as seen (defaults to now). */
export async function updateSeenNotifications(
  agent: BskyAgent,
  seenAt?: string,
) {
  await agent.app.bsky.notification.updateSeen({
    seenAt: seenAt || new Date().toISOString(),
  });
}
