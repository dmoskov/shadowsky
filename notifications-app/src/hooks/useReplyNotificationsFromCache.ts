import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import { useReplyNotifications } from './useNotificationsByType'
import type { Notification } from '@atproto/api/dist/client/types/app/bsky/notification/listNotifications'

/**
 * Hook that first checks the extended notifications cache for reply notifications
 * Falls back to fetching fresh data if cache is not available
 */
export function useReplyNotificationsFromCache() {
  const { session } = useAuth()
  const queryClient = useQueryClient()
  
  // Check if we have extended notifications in cache
  const extendedData = queryClient.getQueryData(['notifications-extended']) as any
  const hasExtendedData = extendedData?.pages?.length > 0
  
  // Extract reply notifications from extended data
  const cachedReplyNotifications = useQuery({
    queryKey: ['reply-notifications-from-cache'],
    queryFn: () => {
      if (!hasExtendedData) return null
      
      // Extract all notifications from paginated data
      const allNotifications = extendedData.pages.flatMap((page: any) => page.notifications)
      
      // Filter for reply notifications
      const replyNotifications = allNotifications.filter(
        (n: Notification) => n.reason === 'reply'
      )
      
      console.log(`📨 Found ${replyNotifications.length} reply notifications in extended cache`)
      
      // Format as paginated data to match the expected structure
      return {
        pages: [{
          notifications: replyNotifications,
          cursor: undefined
        }],
        pageParams: [undefined]
      }
    },
    enabled: !!session && hasExtendedData,
    staleTime: Infinity, // Never consider stale - extended data manages its own freshness
  })
  
  // Fall back to regular reply notifications hook if no cache
  const freshReplyNotifications = useReplyNotifications(undefined, !hasExtendedData)
  
  // Return cached data if available, otherwise fresh data
  if (hasExtendedData && cachedReplyNotifications.data) {
    return {
      data: cachedReplyNotifications.data,
      isLoading: false,
      error: null,
      fetchNextPage: () => Promise.resolve({ data: null, isError: false, isSuccess: true }), // No-op
      hasNextPage: false,
      isFetchingNextPage: false,
      isFromCache: true
    }
  }
  
  return {
    ...freshReplyNotifications,
    isFromCache: false
  }
}