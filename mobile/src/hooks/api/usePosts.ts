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
  });
}
