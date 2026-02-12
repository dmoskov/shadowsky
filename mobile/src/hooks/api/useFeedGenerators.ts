import {useInfiniteQuery, useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {
  getPopularFeedGenerators,
  getSuggestedFeeds,
  searchFeedGenerators,
  getSavedFeeds,
  saveFeed,
  unsaveFeed,
} from '../../services/atproto/feeds';

/**
 * Hook to fetch popular feed generators with infinite scroll
 */
export function usePopularFeedGenerators() {
  return useInfiniteQuery({
    queryKey: ['popularFeedGenerators'],
    queryFn: ({pageParam}) => getPopularFeedGenerators({cursor: pageParam}),
    getNextPageParam: (lastPage) => lastPage.cursor,
    initialPageParam: undefined as string | undefined,
  });
}

/**
 * Hook to fetch suggested feeds for the current user with infinite scroll
 */
export function useSuggestedFeeds() {
  return useInfiniteQuery({
    queryKey: ['suggestedFeeds'],
    queryFn: ({pageParam}) => getSuggestedFeeds({cursor: pageParam}),
    getNextPageParam: (lastPage) => lastPage.cursor,
    initialPageParam: undefined as string | undefined,
  });
}

/**
 * Hook to search feed generators with infinite scroll
 */
export function useSearchFeedGenerators(query: string) {
  return useInfiniteQuery({
    queryKey: ['searchFeedGenerators', query],
    queryFn: ({pageParam}) => searchFeedGenerators(query, {cursor: pageParam}),
    getNextPageParam: (lastPage) => lastPage.cursor,
    initialPageParam: undefined as string | undefined,
    enabled: !!query,
  });
}

/**
 * Hook to fetch the user's saved feeds
 */
export function useSavedFeeds() {
  return useQuery({
    queryKey: ['savedFeeds'],
    queryFn: () => getSavedFeeds(),
  });
}

/**
 * Hook to save a feed to the user's preferences
 */
export function useSaveFeed() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (feedUri: string) => saveFeed(feedUri),
    onSuccess: () => {
      // Invalidate saved feeds query to refetch
      queryClient.invalidateQueries({queryKey: ['savedFeeds']});
    },
  });
}

/**
 * Hook to remove a feed from the user's preferences
 */
export function useUnsaveFeed() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (feedUri: string) => unsaveFeed(feedUri),
    onSuccess: () => {
      // Invalidate saved feeds query to refetch
      queryClient.invalidateQueries({queryKey: ['savedFeeds']});
    },
  });
}
