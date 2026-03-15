import {useInfiniteQuery, useQuery, useMutation, useQueryClient} from '@tanstack/react-query';
import {getNotifications, getUnreadCount, updateSeenNotifications} from '../../services/atproto/notifications';
import {useAdaptivePolling} from '../useAdaptivePolling';
import {cancelMany, invalidateMany} from '../../utils/query-helpers';
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
    retry: (failureCount, error) => {
      // Don't retry rate limit errors — let the user retry manually
      const msg = (error as Error)?.message?.toLowerCase() ?? '';
      if (msg.includes('rate limit') || msg.includes('429')) {
        return false;
      }
      return failureCount < 2;
    },
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
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
    onMutate: async () => {
      await cancelMany(queryClient, [
        {queryKey: ['unreadCount']},
        {queryKey: ['notifications']},
      ]);

      const previousUnreadCount = queryClient.getQueryData<number>(['unreadCount']);

      // Optimistically set unread count to 0
      queryClient.setQueryData<number>(['unreadCount'], 0);

      return {previousUnreadCount};
    },
    onSuccess: () => {
      invalidateMany(queryClient, [
        {queryKey: ['notifications']},
        {queryKey: ['unreadCount']},
      ]);
    },
    onError: (_error, _variables, context) => {
      if (context?.previousUnreadCount !== undefined) {
        queryClient.setQueryData(['unreadCount'], context.previousUnreadCount);
      }
    },
  });
}
