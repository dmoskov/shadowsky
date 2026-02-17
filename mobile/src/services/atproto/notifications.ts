import {getAtProtoClient} from './client';
import {rateLimited, ATProtoEndpointType} from '../rate-limiter';

export interface NotificationsOptions {
  limit?: number;
  cursor?: string;
  seenAt?: string;
}

/**
 * Get notifications
 */
export async function getNotifications(options: NotificationsOptions = {}) {
  return rateLimited(
    async () => {
        const client = getAtProtoClient();
        const agent = client.getAgent();

        const response = await agent.listNotifications({
          limit: options.limit || 50,
          cursor: options.cursor,
          seenAt: options.seenAt,
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

        const response = await agent.countUnreadNotifications();
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

        await agent.updateSeenNotifications(seenAt as any);
      },
    ATProtoEndpointType.NOTIFICATION
  );
}
