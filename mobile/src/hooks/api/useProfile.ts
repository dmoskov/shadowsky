import {useQuery, useMutation, useQueryClient, useInfiniteQuery} from '@tanstack/react-query';
import {
  getProfile,
  getProfiles,
  searchActors,
  followUser,
  unfollowUser,
  getFollowers,
  getFollows,
  muteUser,
  unmuteUser,
  blockUser,
  unblockUser,
} from '../../services/atproto/profiles';
import {mutationQueue} from '../../services/mutation-queue';

/**
 * Hook to fetch a user profile
 */
export function useProfile(actor: string) {
  return useQuery({
    queryKey: ['profile', actor],
    queryFn: () => getProfile(actor),
    enabled: !!actor,
  });
}

/**
 * Hook to fetch multiple profiles
 */
export function useProfiles(actors: string[]) {
  return useQuery({
    queryKey: ['profiles', actors],
    queryFn: () => getProfiles(actors),
    enabled: actors.length > 0,
  });
}

/**
 * Hook to search for actors
 */
export function useSearchActors(query: string) {
  return useQuery({
    queryKey: ['searchActors', query],
    queryFn: () => searchActors(query),
    enabled: query.length > 0,
  });
}

/**
 * Hook to follow a user
 */
export function useFollowUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: followUser,
    onSuccess: (_, did) => {
      // Invalidate profile query to refetch updated follow status
      queryClient.invalidateQueries({queryKey: ['profile']});
    },
    onError: async (error, did: string) => {
      // Queue the mutation for retry
      console.log('[useFollowUser] Failed to follow user, queueing for retry');
      await mutationQueue.enqueue({
        type: 'follow',
        targetUri: did,
        maxRetries: 3,
      });
    },
  });
}

/**
 * Hook to unfollow a user
 */
export function useUnfollowUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: unfollowUser,
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ['profile']});
    },
    onError: async (error, followUri: string) => {
      // Queue the mutation for retry
      console.log('[useUnfollowUser] Failed to unfollow user, queueing for retry');
      await mutationQueue.enqueue({
        type: 'unfollow',
        targetUri: followUri,
        maxRetries: 3,
      });
    },
  });
}

/**
 * Hook to get followers with infinite scroll
 */
export function useFollowers(actor: string) {
  return useInfiniteQuery({
    queryKey: ['followers', actor],
    queryFn: ({pageParam}) => getFollowers(actor, pageParam),
    getNextPageParam: (lastPage) => lastPage.cursor,
    initialPageParam: undefined as string | undefined,
    enabled: !!actor,
  });
}

/**
 * Hook to get follows with infinite scroll
 */
export function useFollows(actor: string) {
  return useInfiniteQuery({
    queryKey: ['follows', actor],
    queryFn: ({pageParam}) => getFollows(actor, pageParam),
    getNextPageParam: (lastPage) => lastPage.cursor,
    initialPageParam: undefined as string | undefined,
    enabled: !!actor,
  });
}

/**
 * Hook to mute a user
 */
export function useMuteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: muteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ['profile']});
    },
  });
}

/**
 * Hook to unmute a user
 */
export function useUnmuteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: unmuteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ['profile']});
    },
  });
}

/**
 * Hook to block a user
 */
export function useBlockUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: blockUser,
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ['profile']});
    },
  });
}

/**
 * Hook to unblock a user
 */
export function useUnblockUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: unblockUser,
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ['profile']});
    },
  });
}
