import {useMutation, useQueryClient} from '@tanstack/react-query';
import {
  createPost,
  deletePost,
  likePost,
  unlikePost,
  repost,
  deleteRepost,
  CreatePostOptions,
} from '../../services/atproto/posts';
import {mutationQueue} from '../../services/mutation-queue';

/**
 * Hook to create a post
 */
export function useCreatePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (options: CreatePostOptions) => createPost(options),
    onSuccess: () => {
      // Invalidate timeline and author feed to show new post
      queryClient.invalidateQueries({queryKey: ['timeline']});
      queryClient.invalidateQueries({queryKey: ['authorFeed']});
    },
  });
}

/**
 * Hook to delete a post
 */
export function useDeletePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deletePost,
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ['timeline']});
      queryClient.invalidateQueries({queryKey: ['authorFeed']});
      queryClient.invalidateQueries({queryKey: ['thread']});
    },
  });
}

/**
 * Hook to like a post
 */
export function useLikePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({uri, cid}: {uri: string; cid: string}) => likePost(uri, cid),
    onMutate: async ({uri}) => {
      // Optimistic update
      await queryClient.cancelQueries({queryKey: ['timeline']});
      await queryClient.cancelQueries({queryKey: ['authorFeed']});

      // We could implement optimistic updates here by updating the cache
      // For simplicity, we'll just invalidate after success
    },
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ['timeline']});
      queryClient.invalidateQueries({queryKey: ['authorFeed']});
      queryClient.invalidateQueries({queryKey: ['thread']});
    },
    onError: async (error, {uri, cid}) => {
      // Queue the mutation for retry
      console.log('[useLikePost] Failed to like post, queueing for retry');
      await mutationQueue.enqueue({
        type: 'like',
        targetUri: uri,
        targetCid: cid,
        maxRetries: 3,
      });
    },
  });
}

/**
 * Hook to unlike a post
 */
export function useUnlikePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: unlikePost,
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ['timeline']});
      queryClient.invalidateQueries({queryKey: ['authorFeed']});
      queryClient.invalidateQueries({queryKey: ['thread']});
    },
    onError: async (error, likeUri: string) => {
      // Queue the mutation for retry
      console.log('[useUnlikePost] Failed to unlike post, queueing for retry');
      await mutationQueue.enqueue({
        type: 'unlike',
        targetUri: likeUri,
        maxRetries: 3,
      });
    },
  });
}

/**
 * Hook to repost
 */
export function useRepost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({uri, cid}: {uri: string; cid: string}) => repost(uri, cid),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ['timeline']});
      queryClient.invalidateQueries({queryKey: ['authorFeed']});
    },
    onError: async (error, {uri, cid}) => {
      // Queue the mutation for retry
      console.log('[useRepost] Failed to repost, queueing for retry');
      await mutationQueue.enqueue({
        type: 'repost',
        targetUri: uri,
        targetCid: cid,
        maxRetries: 3,
      });
    },
  });
}

/**
 * Hook to delete repost
 */
export function useDeleteRepost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteRepost,
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ['timeline']});
      queryClient.invalidateQueries({queryKey: ['authorFeed']});
    },
    onError: async (error, repostUri: string) => {
      // Queue the mutation for retry
      console.log('[useDeleteRepost] Failed to delete repost, queueing for retry');
      await mutationQueue.enqueue({
        type: 'deleteRepost',
        targetUri: repostUri,
        maxRetries: 3,
      });
    },
  });
}
