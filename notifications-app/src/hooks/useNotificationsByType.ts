import { useInfiniteQuery } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import { getNotificationService } from '../services/atproto/notifications'
import type { Notification } from '@atproto/api/dist/client/types/app/bsky/notification/listNotifications'

const MAX_NOTIFICATIONS_PER_TYPE = 5000
const MAX_DAYS = 28 // 4 weeks

type NotificationReason = 'like' | 'repost' | 'follow' | 'mention' | 'reply' | 'quote'

interface UseNotificationsByTypeOptions {
  reasons?: NotificationReason[]
  priority?: boolean
}

export function useNotificationsByType(options: UseNotificationsByTypeOptions = {}) {
  const { session } = useAuth()
  const { reasons, priority } = options

  return useInfiniteQuery({
    queryKey: ['notifications', 'byType', reasons, priority],
    queryFn: async ({ pageParam }) => {
      const { atProtoClient } = await import('../services/atproto')
      const agent = atProtoClient.agent
      if (!agent) throw new Error('Not authenticated')
      const notificationService = getNotificationService(agent)
      
      // Fetch notifications
      const result = await notificationService.listNotifications(pageParam, priority)
      
      // If specific reasons are requested, filter on client side
      // (AT Protocol doesn't support server-side filtering by reason)
      if (reasons && reasons.length > 0) {
        const filteredNotifications = result.notifications.filter(
          (n: Notification) => reasons.includes(n.reason as NotificationReason)
        )
        
        return {
          ...result,
          notifications: filteredNotifications,
          // Keep original cursor for pagination even if we filtered some out
          cursor: result.cursor
        }
      }
      
      return result
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage, allPages) => {
      // Calculate total notifications loaded for the specified types
      const totalNotifications = allPages.reduce((sum, page) => sum + page.notifications.length, 0)
      
      // Log progress
      const typeStr = reasons ? reasons.join(', ') : 'all'
      console.log(`Fetched ${totalNotifications} ${typeStr} notifications so far...`)
      
      // Stop if we've reached max notifications for this type
      if (totalNotifications >= MAX_NOTIFICATIONS_PER_TYPE) {
        console.log(`Reached max notifications limit for ${typeStr} (${MAX_NOTIFICATIONS_PER_TYPE})`)
        return undefined
      }

      // Check if oldest notification is beyond MAX_DAYS (4 weeks)
      if (allPages.length > 0) {
        const allNotifications = allPages.flatMap(page => page.notifications)
        if (allNotifications.length > 0) {
          const oldestNotification = allNotifications[allNotifications.length - 1]
          const oldestDate = new Date(oldestNotification.indexedAt)
          const maxDaysAgo = new Date()
          maxDaysAgo.setDate(maxDaysAgo.getDate() - MAX_DAYS)
          
          if (oldestDate < maxDaysAgo) {
            console.log(`Reached 4-week limit for ${typeStr}. Oldest notification: ${oldestDate.toLocaleDateString()}`)
            return undefined
          }
        }
      }

      // Continue pagination if we have a cursor
      return lastPage.cursor
    },
    enabled: !!session,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  })
}

// Convenience hook for reply notifications specifically
export function useReplyNotifications(priority?: boolean) {
  return useNotificationsByType({ reasons: ['reply'], priority })
}