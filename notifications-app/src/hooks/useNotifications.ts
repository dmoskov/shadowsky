import React from 'react'
import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import { getNotificationService } from '../services/atproto/notifications'
import { useErrorHandler } from './useErrorHandler'
import { NotificationCache } from '../utils/notificationCache'
import type { Notification } from '@atproto/api/dist/client/types/app/bsky/notification/listNotifications'

const MAX_NOTIFICATIONS = 10000
const MAX_DAYS = 28 // 4 weeks

export function useNotifications(priority?: boolean) {
  const { session } = useAuth()

  return useInfiniteQuery({
    queryKey: ['notifications', priority],
    queryFn: async ({ pageParam }) => {
      // This is the ONLY place where rate limiting applies - actual API calls
      const { atProtoClient } = await import('../services/atproto')
      const agent = atProtoClient.agent
      if (!agent) throw new Error('Not authenticated')
      const notificationService = getNotificationService(agent)
      return notificationService.listNotifications(pageParam, priority)
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage, allPages) => {
      // Calculate total notifications loaded
      const totalNotifications = allPages.reduce((sum, page) => sum + page.notifications.length, 0)
      
      // Log progress
      console.log(`Fetched ${totalNotifications} notifications so far...`)
      
      // Stop if we've reached max notifications
      if (totalNotifications >= MAX_NOTIFICATIONS) {
        console.log(`Reached max notifications limit (${MAX_NOTIFICATIONS})`)
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
            console.log(`Reached 4-week limit. Oldest notification: ${oldestDate.toLocaleDateString()}`)
            return undefined
          }
        }
      }

      // Continue pagination if we have a cursor
      return lastPage.cursor
    },
    enabled: !!session,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes (was every minute!)
    // Load from cache WITHOUT any rate limiting - this is just local storage access
    placeholderData: () => {
      const cachedData = NotificationCache.load(priority)
      if (cachedData) {
        console.log(`Loading ${cachedData.pages.reduce((sum, p) => sum + p.notifications.length, 0)} notifications from cache (no rate limit)`)
        return {
          pages: cachedData.pages,
          pageParams: [undefined, ...cachedData.pages.slice(0, -1).map(p => p.cursor)]
        }
      }
      return undefined
    },
    // Save to cache after successful API fetch
    onSuccess: (data) => {
      if (data?.pages && data.pages.length > 0) {
        try {
          console.log(`Saving ${data.pages.reduce((sum, p) => sum + p.notifications.length, 0)} notifications to cache`)
          NotificationCache.save(data.pages, priority)
        } catch (error) {
          console.error('Failed to save to cache:', error)
        }
      }
    }
  })
}

export function useUnreadNotificationCount() {
  const { session } = useAuth()

  return useQuery({
    queryKey: ['notificationCount'],
    queryFn: async () => {
      const { atProtoClient } = await import('../services/atproto')
      const agent = atProtoClient.agent
      if (!agent) throw new Error('Not authenticated')
      const notificationService = getNotificationService(agent)
      return notificationService.getUnreadCount()
    },
    enabled: !!session,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes (was every minute!)
  })
}

// Alias for compatibility
export const useUnreadCount = useUnreadNotificationCount

export function useMarkNotificationsRead() {
  const { handleError } = useErrorHandler()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const { atProtoClient } = await import('../services/atproto')
      const agent = atProtoClient.agent
      if (!agent) throw new Error('Not authenticated')
      const notificationService = getNotificationService(agent)
      const seenAt = new Date().toISOString()
      await notificationService.updateSeen(seenAt)
      return seenAt
    },
    onSuccess: () => {
      // Reset notification count
      queryClient.setQueryData(['notificationCount'], 0)
      
      // Update notifications in place to mark them as read
      queryClient.setQueriesData(
        { queryKey: ['notifications'] },
        (oldData: any) => {
          if (!oldData?.pages) return oldData
          
          return {
            ...oldData,
            pages: oldData.pages.map((page: any) => ({
              ...page,
              notifications: page.notifications.map((notification: Notification) => ({
                ...notification,
                isRead: true
              }))
            }))
          }
        }
      )
    },
    onError: (error) => {
      handleError(error)
    }
  })
}

export function getNotificationText(notification: Notification): string {
  const author = notification.author.displayName || `@${notification.author.handle}`
  
  switch (notification.reason) {
    case 'like':
      return `${author} liked your post`
    case 'repost':
      return `${author} reposted your post`
    case 'follow':
      return `${author} followed you`
    case 'mention':
      return `${author} mentioned you`
    case 'reply':
      return `${author} replied to your post`
    case 'quote':
      return `${author} quoted your post`
    default:
      return `${author} interacted with your post`
  }
}

export function getNotificationIcon(reason: string): string {
  switch (reason) {
    case 'like':
      return '❤️'
    case 'repost':
      return '🔁'
    case 'follow':
      return '👤'
    case 'mention':
      return '@'
    case 'reply':
      return '💬'
    case 'quote':
      return '💭'
    default:
      return '🔔'
  }
}