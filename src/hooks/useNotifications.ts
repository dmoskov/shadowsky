import React from 'react'
import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import { getNotificationService } from '../services/atproto/notifications'
import { useErrorHandler } from './useErrorHandler'
import { NotificationCache } from '../utils/notificationCache'
import { NotificationObjectCache } from '../utils/notificationObjectCache'
import type { Notification } from '@atproto/api/dist/client/types/app/bsky/notification/listNotifications'
import { debug } from '@bsky/shared'

const MAX_NOTIFICATIONS = 10000
const MAX_DAYS = 28 // 4 weeks

export function useNotifications(priority: boolean = false) {
  const { session } = useAuth()
  const queryClient = useQueryClient()

  // Try to load cached data first
  const cachedData = session ? NotificationCache.load(priority) : null
  const timestamp = new Date().toLocaleTimeString()
  
  if (cachedData) {
    debug.log(`🚀 [${timestamp}] React Query: Using cached data as initialData`)
  } else {
    debug.log(`🚀 [${timestamp}] React Query: No cache found, will fetch from API`)
  }

  const query = useInfiniteQuery({
    queryKey: ['notifications', priority],
    queryFn: async ({ pageParam }) => {
      const fetchTimestamp = new Date().toLocaleTimeString()
      debug.log(`🌐 [${fetchTimestamp}] React Query: Making API call (priority: ${priority}, cursor: ${pageParam || 'none'})`)
      
      // This is the ONLY place where rate limiting applies - actual API calls
      const { atProtoClient } = await import('../services/atproto')
      const agent = atProtoClient.agent
      if (!agent) throw new Error('Not authenticated')
      const notificationService = getNotificationService(agent)
      const result = await notificationService.listNotifications(pageParam, priority)
      
      debug.log(`✅ [${fetchTimestamp}] React Query: API call completed, got ${result.notifications.length} notifications`)
      return result
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage, allPages) => {
      // Calculate total notifications loaded
      const totalNotifications = allPages.reduce((sum, page) => sum + page.notifications.length, 0)
      
      // Log progress
      debug.log(`📊 Fetched ${totalNotifications} notifications so far...`)
      
      // Stop if we've reached max notifications
      if (totalNotifications >= MAX_NOTIFICATIONS) {
        debug.log(`🛑 Reached max notifications limit (${MAX_NOTIFICATIONS})`)
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
            debug.log(`⏰ Reached 4-week limit. Oldest notification: ${oldestDate.toLocaleDateString()}`)
            return undefined
          }
        }
      }

      // Continue pagination if we have a cursor
      return lastPage.cursor
    },
    enabled: !!session,
    staleTime: cachedData ? 24 * 60 * 60 * 1000 : 5 * 60 * 1000, // If we have cache, treat as fresh for 24h, otherwise 5min
    refetchInterval: 60 * 1000, // Refetch every 60 seconds - reduced from 10s
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnMount: 'always', // Always fetch fresh data on mount
    // Use cached data as initial data if available
    initialData: cachedData ? {
      pages: cachedData.pages,
      pageParams: [undefined, ...cachedData.pages.slice(0, -1).map(p => p.cursor)]
    } : undefined,
    // Add placeholderData to prevent flickering
    placeholderData: cachedData ? {
      pages: cachedData.pages,
      pageParams: [undefined, ...cachedData.pages.slice(0, -1).map(p => p.cursor)]
    } : undefined
  })

  // Invalidate visual timeline when data changes
  React.useEffect(() => {
    if (query.data) {
      // Also invalidate visual timeline to keep it in sync
      queryClient.invalidateQueries({ queryKey: ['notifications-visual-timeline'] })
    }
  }, [query.data, queryClient])

  // Save to cache after successful data fetch
  React.useEffect(() => {
    if (query.data?.pages && query.data.pages.length > 0 && !query.isLoading) {
      const successTimestamp = new Date().toLocaleTimeString()
      const totalNotifications = query.data.pages.reduce((sum, p) => sum + p.notifications.length, 0)
      debug.log(`💾 [${successTimestamp}] React Query: Saving ${totalNotifications} notifications to cache`)
      NotificationCache.save(query.data.pages, priority)
      
      // Also save individual notifications to object cache
      const allNotifications = query.data.pages.flatMap(page => page.notifications)
      NotificationObjectCache.save(allNotifications)
    }
  }, [query.data, query.isLoading, priority])

  // Log errors for debugging
  React.useEffect(() => {
    if (query.error) {
      const errorTimestamp = new Date().toLocaleTimeString()
      debug.error(`❌ [${errorTimestamp}] React Query error in useNotifications:`, query.error)
    }
  }, [query.error])

  return query
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
    refetchInterval: 60 * 1000, // Refetch every 60 seconds - reduced from 10s
    refetchOnMount: 'always', // Always fetch fresh data on mount
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
  const author = notification.author?.displayName || `@${notification.author?.handle || 'unknown'}`
  
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