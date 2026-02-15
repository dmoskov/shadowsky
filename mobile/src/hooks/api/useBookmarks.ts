import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppBskyFeedDefs } from '@atproto/api';
import {
  getBookmarks,
  getBookmarkCount,
  toggleBookmark as toggleBookmarkService,
  BookmarkPost,
} from '../../services/atproto/bookmarks';

/**
 * Hook for managing bookmarks in the mobile app
 */
export function useBookmarks() {
  const queryClient = useQueryClient();

  // Fetch all bookmarks
  const {
    data: bookmarks = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['bookmarks'],
    queryFn: getBookmarks,
    staleTime: 30000, // 30 seconds
  });

  // Toggle bookmark mutation with optimistic updates
  const toggleBookmarkMutation = useMutation({
    mutationFn: async (post: AppBskyFeedDefs.PostView) => {
      return await toggleBookmarkService(post);
    },
    onMutate: async (post: AppBskyFeedDefs.PostView) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['bookmarks'] });

      // Snapshot the previous value
      const previousBookmarks = queryClient.getQueryData<BookmarkPost[]>(['bookmarks']);

      // Check if currently bookmarked
      const isCurrentlyBookmarked = previousBookmarks?.some((b) => b.postUri === post.uri);

      // Optimistically update to the new value
      queryClient.setQueryData<BookmarkPost[]>(['bookmarks'], (old = []) => {
        if (isCurrentlyBookmarked) {
          // Remove bookmark
          return old.filter((b) => b.postUri !== post.uri);
        } else {
          // Add bookmark
          return [
            {
              postUri: post.uri,
              createdAt: new Date().toISOString(),
              post,
            },
            ...old,
          ];
        }
      });

      // Return context with previous value for potential rollback
      return { previousBookmarks };
    },
    onError: (_error, _post, context) => {
      // Rollback on error
      if (context?.previousBookmarks) {
        queryClient.setQueryData(['bookmarks'], context.previousBookmarks);
      }
    },
    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
      queryClient.invalidateQueries({ queryKey: ['bookmarkCount'] });
    },
  });

  // Check if a post is bookmarked
  const isBookmarked = (postUri: string): boolean => {
    return bookmarks.some((b) => b.postUri === postUri);
  };

  // Toggle bookmark
  const toggleBookmark = (post: AppBskyFeedDefs.PostView) => {
    toggleBookmarkMutation.mutate(post);
  };

  return {
    bookmarks,
    isLoading,
    error,
    refetch,
    isBookmarked,
    toggleBookmark,
    isToggling: toggleBookmarkMutation.isPending,
  };
}

/**
 * Hook to get the bookmark count (lightweight, for badges)
 */
export function useBookmarkCount() {
  const { data: count = 0 } = useQuery({
    queryKey: ['bookmarkCount'],
    queryFn: getBookmarkCount,
    staleTime: 30000,
  });

  return count;
}

export type { BookmarkPost };
