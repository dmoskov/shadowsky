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
  updateProfile,
  UpdateProfileParams,
  getMutes,
  getBlocks,
} from '../../services/atproto/profiles';
import {mutationQueue} from '../../services/mutation-queue';
import {useToast} from '../../contexts/ToastContext';
import {invalidateMany} from '../../utils/query-helpers';

import { createLogger } from '../../utils/logger';

const logger = createLogger('Useprofile');
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
  const {showToast} = useToast();

  return useMutation({
    mutationFn: followUser,
    onMutate: async (did: string) => {
      await queryClient.cancelQueries({queryKey: ['profile']});

      const previousProfiles = queryClient.getQueriesData({queryKey: ['profile']});

      // Optimistically update the target profile's viewer.following
      queryClient.setQueriesData({queryKey: ['profile']}, (old: any) => {
        if (!old || old.did !== did) return old;
        return {
          ...old,
          viewer: {...old.viewer, following: 'pending'},
        };
      });

      return {previousProfiles};
    },
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ['profile']});
    },
    onError: async (_error, did: string, context) => {
      // Rollback optimistic update
      if (context?.previousProfiles) {
        context.previousProfiles.forEach(([key, data]: [any, any]) => {
          queryClient.setQueryData(key, data);
        });
      }

      showToast('Failed to follow user', {type: 'error'});

      // Queue the mutation for retry
      logger.log('Failed to follow user, queueing for retry');
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
  const {showToast} = useToast();

  return useMutation({
    mutationFn: unfollowUser,
    onMutate: async (followUri: string) => {
      await queryClient.cancelQueries({queryKey: ['profile']});

      const previousProfiles = queryClient.getQueriesData({queryKey: ['profile']});

      // Find the profile whose viewer.following matches this URI and clear it
      queryClient.setQueriesData({queryKey: ['profile']}, (old: any) => {
        if (!old || old.viewer?.following !== followUri) return old;
        return {
          ...old,
          viewer: {...old.viewer, following: undefined},
        };
      });

      return {previousProfiles};
    },
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ['profile']});
    },
    onError: async (_error, followUri: string, context) => {
      // Rollback optimistic update
      if (context?.previousProfiles) {
        context.previousProfiles.forEach(([key, data]: [any, any]) => {
          queryClient.setQueryData(key, data);
        });
      }

      showToast('Failed to unfollow user', {type: 'error'});

      // Queue the mutation for retry
      logger.log('Failed to unfollow user, queueing for retry');
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
    maxPages: 10,
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
    maxPages: 10,
  });
}

/**
 * Hook to mute a user
 */
export function useMuteUser() {
  const queryClient = useQueryClient();
  const {showToast} = useToast();

  return useMutation({
    mutationFn: muteUser,
    onMutate: async (did: string) => {
      await queryClient.cancelQueries({queryKey: ['profile']});

      const previousProfiles = queryClient.getQueriesData({queryKey: ['profile']});

      // Optimistically set muted on the target profile
      queryClient.setQueriesData({queryKey: ['profile']}, (old: any) => {
        if (!old || old.did !== did) return old;
        return {
          ...old,
          viewer: {...old.viewer, muted: true},
        };
      });

      return {previousProfiles};
    },
    onSuccess: () => {
      invalidateMany(queryClient, [
        {queryKey: ['profile']},
        {queryKey: ['mutes']},
        {queryKey: ['mutedAccounts']},
      ]);
    },
    onError: (_error, _did, context) => {
      if (context?.previousProfiles) {
        context.previousProfiles.forEach(([key, data]: [any, any]) => {
          queryClient.setQueryData(key, data);
        });
      }
      showToast('Failed to mute user', {type: 'error'});
    },
  });
}

/**
 * Hook to unmute a user
 */
export function useUnmuteUser() {
  const queryClient = useQueryClient();
  const {showToast} = useToast();

  return useMutation({
    mutationFn: unmuteUser,
    onMutate: async (did: string) => {
      await queryClient.cancelQueries({queryKey: ['profile']});

      const previousProfiles = queryClient.getQueriesData({queryKey: ['profile']});

      // Optimistically clear muted on the target profile
      queryClient.setQueriesData({queryKey: ['profile']}, (old: any) => {
        if (!old || old.did !== did) return old;
        return {
          ...old,
          viewer: {...old.viewer, muted: false},
        };
      });

      return {previousProfiles};
    },
    onSuccess: () => {
      invalidateMany(queryClient, [
        {queryKey: ['profile']},
        {queryKey: ['mutes']},
        {queryKey: ['mutedAccounts']},
      ]);
    },
    onError: (_error, _did, context) => {
      if (context?.previousProfiles) {
        context.previousProfiles.forEach(([key, data]: [any, any]) => {
          queryClient.setQueryData(key, data);
        });
      }
      showToast('Failed to unmute user', {type: 'error'});
    },
  });
}

/**
 * Hook to block a user
 */
export function useBlockUser() {
  const queryClient = useQueryClient();
  const {showToast} = useToast();

  return useMutation({
    mutationFn: blockUser,
    onMutate: async (did: string) => {
      await queryClient.cancelQueries({queryKey: ['profile']});

      const previousProfiles = queryClient.getQueriesData({queryKey: ['profile']});

      // Optimistically set blocking on the target profile
      queryClient.setQueriesData({queryKey: ['profile']}, (old: any) => {
        if (!old || old.did !== did) return old;
        return {
          ...old,
          viewer: {...old.viewer, blocking: 'pending'},
        };
      });

      return {previousProfiles};
    },
    onSuccess: () => {
      invalidateMany(queryClient, [
        {queryKey: ['profile']},
        {queryKey: ['blocks']},
        {queryKey: ['blockedAccounts']},
      ]);
    },
    onError: (_error, _did, context) => {
      if (context?.previousProfiles) {
        context.previousProfiles.forEach(([key, data]: [any, any]) => {
          queryClient.setQueryData(key, data);
        });
      }
      showToast('Failed to block user', {type: 'error'});
    },
  });
}

/**
 * Hook to unblock a user
 */
export function useUnblockUser() {
  const queryClient = useQueryClient();
  const {showToast} = useToast();

  return useMutation({
    mutationFn: unblockUser,
    onMutate: async (blockUri: string) => {
      await queryClient.cancelQueries({queryKey: ['profile']});

      const previousProfiles = queryClient.getQueriesData({queryKey: ['profile']});

      // Find the profile whose viewer.blocking matches this URI and clear it
      queryClient.setQueriesData({queryKey: ['profile']}, (old: any) => {
        if (!old || old.viewer?.blocking !== blockUri) return old;
        return {
          ...old,
          viewer: {...old.viewer, blocking: undefined},
        };
      });

      return {previousProfiles};
    },
    onSuccess: () => {
      invalidateMany(queryClient, [
        {queryKey: ['profile']},
        {queryKey: ['blocks']},
        {queryKey: ['blockedAccounts']},
      ]);
    },
    onError: (_error, _blockUri, context) => {
      if (context?.previousProfiles) {
        context.previousProfiles.forEach(([key, data]: [any, any]) => {
          queryClient.setQueryData(key, data);
        });
      }
      showToast('Failed to unblock user', {type: 'error'});
    },
  });
}

/**
 * Hook to update user profile
 */
export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateProfile,
    onMutate: async (params: UpdateProfileParams) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({queryKey: ['profile']});

      // Snapshot the previous profile data
      const previousProfiles = queryClient.getQueriesData({queryKey: ['profile']});

      // Optimistically update all profile queries
      queryClient.setQueriesData({queryKey: ['profile']}, (old: any) => {
        if (!old) return old;
        return {
          ...old,
          displayName: params.displayName !== undefined ? params.displayName : old.displayName,
          description: params.description !== undefined ? params.description : old.description,
          // Note: avatar URL will be updated after successful upload
        };
      });

      return {previousProfiles};
    },
    onError: (_error, _variables, context) => {
      // Rollback to previous profile data on error
      if (context?.previousProfiles) {
        context.previousProfiles.forEach(([queryKey, data]: [any, any]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSuccess: () => {
      // Invalidate to refetch with the updated data from server
      queryClient.invalidateQueries({queryKey: ['profile']});
    },
  });
}

/**
 * Hook to get muted accounts with infinite scroll
 */
export function useMutedAccounts() {
  return useInfiniteQuery({
    queryKey: ['mutedAccounts'],
    queryFn: ({pageParam}) => getMutes(pageParam),
    getNextPageParam: (lastPage) => lastPage.cursor,
    initialPageParam: undefined as string | undefined,
    maxPages: 10,
  });
}

// Alias for backward compatibility
export const useMutes = useMutedAccounts;

/**
 * Hook to get blocked accounts with infinite scroll
 */
export function useBlockedAccounts() {
  return useInfiniteQuery({
    queryKey: ['blockedAccounts'],
    queryFn: ({pageParam}) => getBlocks(pageParam),
    getNextPageParam: (lastPage) => lastPage.cursor,
    initialPageParam: undefined as string | undefined,
    maxPages: 10,
  });
}

// Alias for backward compatibility
export const useBlocks = useBlockedAccounts;
