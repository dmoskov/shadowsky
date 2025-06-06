import { AtpAgent } from '@atproto/api'
import type { Notification } from '@atproto/api/dist/client/types/app/bsky/notification/listNotifications'
import { mapATProtoError } from '../../lib/errors'

export class NotificationService {
  constructor(private agent: AtpAgent) {}

  async listNotifications(cursor?: string): Promise<{
    notifications: Notification[]
    cursor?: string
  }> {
    try {
      const response = await this.agent.listNotifications({
        limit: 30,
        cursor
      })
      
      return {
        notifications: response.data.notifications,
        cursor: response.data.cursor
      }
    } catch (error) {
      throw mapATProtoError(error)
    }
  }

  async updateSeen(seenAt: string): Promise<void> {
    try {
      await this.agent.updateSeenNotifications(seenAt)
    } catch (error) {
      throw mapATProtoError(error)
    }
  }

  async getUnreadCount(): Promise<number> {
    try {
      const response = await this.agent.countUnreadNotifications()
      return response.data.count
    } catch (error) {
      throw mapATProtoError(error)
    }
  }
}

// Singleton instance
let notificationServiceInstance: NotificationService | null = null

export function getNotificationService(agent: AtpAgent): NotificationService {
  if (!notificationServiceInstance) {
    notificationServiceInstance = new NotificationService(agent)
  }
  return notificationServiceInstance
}