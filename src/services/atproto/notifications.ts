/**
 * Notification service — canonical logic now lives in @bsky/core.
 *
 * This web class is a thin wrapper that binds the agent, injects the web's
 * rate limiting (`rateLimitedNotificationFetch`) and error mapping
 * (`mapATProtoError`), and delegates the actual AT Protocol calls to
 * @bsky/core (shared with mobile).
 */

import type {
  AppBskyNotificationListNotifications,
  BskyAgent,
} from "@atproto/api";
import { notifications } from "@bsky/core";
import { mapATProtoError } from "@bsky/shared";
import { rateLimitedNotificationFetch } from "../rate-limiter";

export class NotificationService {
  constructor(private agent: BskyAgent) {}

  /**
   * List notifications for the current user
   * @param cursor - Pagination cursor
   * @param priority - If true, only show notifications from followed accounts
   * @param limit - Number of notifications to fetch (max 100)
   */
  async listNotifications(
    cursor?: string,
    priority?: boolean,
    limit: number = 100,
  ): Promise<{
    notifications: AppBskyNotificationListNotifications.Notification[];
    cursor?: string;
  }> {
    return rateLimitedNotificationFetch(async () => {
      try {
        return await notifications.getNotifications(this.agent, {
          cursor,
          priority,
          limit: Math.min(limit, 100), // API max is 100
        });
      } catch (error) {
        throw mapATProtoError(error);
      }
    });
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(): Promise<number> {
    return rateLimitedNotificationFetch(async () => {
      try {
        return await notifications.getUnreadCount(this.agent);
      } catch (error) {
        throw mapATProtoError(error);
      }
    });
  }

  /**
   * Update last seen time for notifications
   */
  async updateSeen(seenAt: string): Promise<void> {
    return rateLimitedNotificationFetch(async () => {
      try {
        await notifications.updateSeenNotifications(this.agent, seenAt);
      } catch (error) {
        throw mapATProtoError(error);
      }
    });
  }
}

// Factory function - create new instance per agent
export function getNotificationService(agent: BskyAgent): NotificationService {
  return new NotificationService(agent);
}
