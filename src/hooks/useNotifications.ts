import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import { getNotificationService } from '../services/atproto/notifications'
import { useErrorHandler } from './useErrorHandler'
import type { Notification } from '@atproto/api/dist/client/types/app/bsky/notification/listNotifications'

export function useNotifications(priority?: boolean) {
  const { session } = useAuth()
  const { handleError } = useErrorHandler()

  return useQuery({
    queryKey: ['notifications', priority],
    queryFn: async () => {
      const { atProtoClient } = await import('../services/atproto')
      const agent = atProtoClient.agent
      if (!agent) throw new Error('Not authenticated')
      const notificationService = getNotificationService(agent)
      return notificationService.listNotifications(undefined, priority)
    },
    enabled: !!session,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refetch every minute
    onError: (error) => {
      console.error('Notifications error:', error)
      handleError(error)
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
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refetch every minute
  })
}

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
      // Invalidate notifications to update their seen status
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
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