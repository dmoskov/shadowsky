import {useInfiniteQuery, useQuery, useMutation, useQueryClient} from '@tanstack/react-query';
import {getNotifications, getUnreadCount, updateSeenNotifications} from '../../services/atproto/notifications';
import {useAdaptivePolling} from '../useAdaptivePolling';

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
