import {useInfiniteQuery, useQuery, useMutation, useQueryClient} from '@tanstack/react-query';
import {getNotifications, getUnreadCount, updateSeenNotifications} from '../../services/atproto/notifications';
import {useAdaptivePolling} from '../useAdaptivePolling';
import {subDays} from 'date-fns';

// Polling intervals for notifications
const POLL_ACTIVE = 30000;        // 30s when app is active, no real-time
const POLL_ACTIVE_REALTIME = 120000; // 2min safety net when Jetstream connected

/**
 * Hook to fetch notifications with infinite scroll.
 * Polling adapts to app state and Jetstream connection.
 */
export function useNotifications() {
  const refetchInterval = useAdaptivePolling({
    activeInterval: POLL_ACTIVE,
    activeRealtimeInterval: POLL_ACTIVE_REALTIME,
    pauseWhenScrolling: true,
  });

  return useInfiniteQuery({
    queryKey: ['notifications'],
    queryFn: ({pageParam}) => getNotifications({cursor: pageParam}),
    getNextPageParam: (lastPage) => lastPage.cursor,
    initialPageParam: undefined as string | undefined,
    refetchInterval,
    refetchIntervalInBackground: false,
    maxPages: 10,
  });
}

/**
 * Hook to fetch unread notification count.
 * Polling adapts to app state and Jetstream connection.
 */
export function useUnreadCount() {
  const refetchInterval = useAdaptivePolling({
    activeInterval: POLL_ACTIVE,
    activeRealtimeInterval: POLL_ACTIVE_REALTIME,
    pauseWhenScrolling: true,
  });

  return useQuery({
    queryKey: ['unreadCount'],
    queryFn: getUnreadCount,
    refetchInterval,
    refetchIntervalInBackground: false,
  });
}

/**
 * Hook to fetch all notifications within a time range for analytics.
 * Eagerly paginates through all pages until it reaches notifications
 * older than the time range (unlike useNotifications which loads on scroll).
 */
export function useNotificationsForAnalytics(timeRange: 'week' | 'month') {
  const days = timeRange === 'week' ? 7 : 30;
  const cutoffDate = subDays(new Date(), days);

  return useQuery({
    queryKey: ['notifications-analytics', timeRange],
    queryFn: async () => {
      const allNotifications: any[] = [];
      let cursor: string | undefined;
      let hasMore = true;
      let pageCount = 0;
      const maxPages = timeRange === 'week' ? 5 : 15;

      while (hasMore && pageCount < maxPages) {
        const page = await getNotifications({ cursor, limit: 50 });
        for (const notification of page.notifications) {
          const notifDate = new Date(notification.indexedAt);
          if (notifDate >= cutoffDate) {
            allNotifications.push(notification);
          } else {
            hasMore = false;
            break;
          }
        }
        cursor = page.cursor;
        if (!cursor) hasMore = false;
        pageCount++;
      }

      return allNotifications;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to mark notifications as seen
 */
export function useMarkNotificationsSeen() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateSeenNotifications,
    onSuccess: () => {
      // Invalidate queries to refetch with updated seen status
      queryClient.invalidateQueries({queryKey: ['notifications']});
      queryClient.invalidateQueries({queryKey: ['unreadCount']});
    },
  });
}
