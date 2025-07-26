import { AtpAgent } from '@atproto/api'
import type { Notification } from '@atproto/api/dist/client/types/app/bsky/notification/listNotifications'
import { mapATProtoError } from '@bsky/shared'
import { rateLimiters, withRateLimit } from '@bsky/shared'

export class NotificationService {
  constructor(private agent: AtpAgent) {}

  /**
   * List notifications for the current user
   * @param cursor - Pagination cursor
   * @param priority - If true, only show notifications from followed accounts
   * @param limit - Number of notifications to fetch (max 100)
   */
  async listNotifications(cursor?: string, priority?: boolean, limit: number = 50): Promise<{
    notifications: Notification[]
    cursor?: string
  }> {
    return withRateLimit(rateLimiters.general, 'listNotifications', async () => {
      try {
        const response = await this.agent.app.bsky.notification.listNotifications({
          limit: Math.min(limit, 100), // API max is 100
          cursor,
          priority
        })
        
        return {
          notifications: response.data.notifications,
          cursor: response.data.cursor
        }
      } catch (error) {
        throw mapATProtoError(error)
      }
    })
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(): Promise<number> {
    return withRateLimit(rateLimiters.general, 'getUnreadCount', async () => {
      try {
        const response = await this.agent.app.bsky.notification.getUnreadCount()
        return response.data.count
      } catch (error) {
        throw mapATProtoError(error)
      }
    })
  }

  /**
   * Update last seen time for notifications
   */
  async updateSeen(seenAt: string): Promise<void> {
    return withRateLimit(rateLimiters.general, 'updateSeen', async () => {
      try {
        await this.agent.app.bsky.notification.updateSeen({ seenAt })
      } catch (error) {
        throw mapATProtoError(error)
      }
    })
  }
}

// Factory function - create new instance per agent
export function getNotificationService(agent: AtpAgent): NotificationService {
  return new NotificationService(agent)
}