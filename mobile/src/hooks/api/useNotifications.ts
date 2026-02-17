import {useInfiniteQuery, useQuery, useMutation, useQueryClient} from '@tanstack/react-query';
import {getNotifications, getUnreadCount, updateSeenNotifications} from '../../services/atproto/notifications';
import {useJetstreamOptional} from '../../contexts/JetstreamContext';

// When Jetstream is connected, real-time events invalidate the cache,
// so we can poll less frequently as a fallback. When disconnected,
// fall back to the original 30s polling interval.
const POLL_INTERVAL_REALTIME = 120000; // 2 minutes (safety net)
const POLL_INTERVAL_POLLING = 30000;   // 30 seconds (original)

/**
 * Hook to fetch notifications with infinite scroll
 */
export function useNotifications() {
  const jetstream = useJetstreamOptional();
  const interval = jetstream?.isConnected ? POLL_INTERVAL_REALTIME : POLL_INTERVAL_POLLING;

  return useInfiniteQuery({
    queryKey: ['notifications'],
    queryFn: ({pageParam}) => getNotifications({cursor: pageParam}),
    getNextPageParam: (lastPage) => lastPage.cursor,
    initialPageParam: undefined as string | undefined,
    refetchInterval: interval,
    refetchIntervalInBackground: false,
    maxPages: 10,
  });
}

/**
 * Hook to fetch unread notification count
 */
export function useUnreadCount() {
  const jetstream = useJetstreamOptional();
  const interval = jetstream?.isConnected ? POLL_INTERVAL_REALTIME : POLL_INTERVAL_POLLING;

  return useQuery({
    queryKey: ['unreadCount'],
    queryFn: getUnreadCount,
    refetchInterval: interval,
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
