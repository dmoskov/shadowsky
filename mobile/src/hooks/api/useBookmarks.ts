import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppBskyFeedDefs } from '@atproto/api';
import {
  getBookmarks,
  toggleBookmark as toggleBookmarkService,
  isBookmarked as isBookmarkedService,
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

  // Toggle bookmark mutation
  const toggleBookmarkMutation = useMutation({
    mutationFn: async (post: AppBskyFeedDefs.PostView) => {
      return await toggleBookmarkService(post);
    },
    onSuccess: () => {
      // Invalidate bookmarks query to refetch
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
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

export type { BookmarkPost };
