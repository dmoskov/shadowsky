import {getAtProtoClient} from './client';
import {rateLimited, ATProtoEndpointType} from '../rate-limiter';

export interface NotificationsOptions {
  limit?: number;
  cursor?: string;
  seenAt?: string;
}

/**
 * Get notifications.
 * Uses the full XRPC path (agent.app.bsky.notification.listNotifications)
 * instead of the convenience wrapper for explicit API clarity.
 */
export async function getNotifications(options: NotificationsOptions = {}) {
  return rateLimited(
    async () => {
        const client = getAtProtoClient();
        const agent = client.getAgent();

        const response = await agent.app.bsky.notification.listNotifications({
          limit: options.limit || 50,
          cursor: options.cursor,
        });

        return {
          notifications: response.data.notifications,
          cursor: response.data.cursor,
          seenAt: response.data.seenAt,
        };
      },
    ATProtoEndpointType.NOTIFICATION
  );
}

/**
 * Get unread notification count
 */
export async function getUnreadCount() {
  return rateLimited(
    async () => {
        const client = getAtProtoClient();
        const agent = client.getAgent();

        const response = await agent.app.bsky.notification.getUnreadCount();
        return response.data.count;
      },
    ATProtoEndpointType.NOTIFICATION
  );
}

/**
 * Mark notifications as seen
 */
export async function updateSeenNotifications(seenAt?: string) {
  return rateLimited(
    async () => {
        const client = getAtProtoClient();
        const agent = client.getAgent();

        await agent.app.bsky.notification.updateSeen({
          seenAt: seenAt || new Date().toISOString(),
        });
      },
    ATProtoEndpointType.NOTIFICATION
  );
}
