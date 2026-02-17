import {useInfiniteQuery, useQuery, useMutation, useQueryClient} from '@tanstack/react-query';
import {getNotifications, getUnreadCount, updateSeenNotifications} from '../../services/atproto/notifications';

/**
 * Hook to fetch notifications with infinite scroll
 */
export function useNotifications() {
  return useInfiniteQuery({
    queryKey: ['notifications'],
    queryFn: ({pageParam}) => getNotifications({cursor: pageParam}),
    getNextPageParam: (lastPage) => lastPage.cursor,
    initialPageParam: undefined as string | undefined,
    refetchInterval: 30000, // Refetch every 30 seconds
    refetchIntervalInBackground: false, // Don't poll when tab is not focused
  });
}

/**
 * Hook to fetch unread notification count
 */
export function useUnreadCount() {
  return useQuery({
    queryKey: ['unreadCount'],
    queryFn: getUnreadCount,
    refetchInterval: 30000, // Refetch every 30 seconds
    refetchIntervalInBackground: false, // Don't poll when tab is not focused
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
