import {useInfiniteQuery, useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {
  getPopularFeedGenerators,
  getSuggestedFeeds,
  searchFeedGenerators,
  getSavedFeeds,
  saveFeed,
  unsaveFeed,
  pinFeed,
  unpinFeed,
  getPinnedFeeds,
  reorderSavedFeeds,
  createFeedGenerator,
  CreateFeedGeneratorParams,
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
    maxPages: 10,
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
    maxPages: 10,
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
    maxPages: 10,
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
      queryClient.invalidateQueries({queryKey: ['pinnedFeeds']});
    },
  });
}

/**
 * Hook to pin a feed to the home screen
 */
export function usePinFeed() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (feedUri: string) => pinFeed(feedUri),
    onSuccess: () => {
      // Invalidate queries to refetch
      queryClient.invalidateQueries({queryKey: ['savedFeeds']});
      queryClient.invalidateQueries({queryKey: ['pinnedFeeds']});
    },
  });
}

/**
 * Hook to unpin a feed from the home screen
 */
export function useUnpinFeed() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (feedUri: string) => unpinFeed(feedUri),
    onSuccess: () => {
      // Invalidate pinned feeds query to refetch
      queryClient.invalidateQueries({queryKey: ['pinnedFeeds']});
    },
  });
}

/**
 * Hook to fetch the user's pinned feeds
 */
export function usePinnedFeeds() {
  return useQuery({
    queryKey: ['pinnedFeeds'],
    queryFn: () => getPinnedFeeds(),
  });
}

/**
 * Hook to reorder saved feeds
 */
export function useReorderSavedFeeds() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (feedUris: string[]) => reorderSavedFeeds(feedUris),
    onSuccess: () => {
      // Invalidate saved feeds query to refetch
      queryClient.invalidateQueries({queryKey: ['savedFeeds']});
    },
  });
}

/**
 * Hook to create a new feed generator
 */
export function useCreateFeedGenerator() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: CreateFeedGeneratorParams) => createFeedGenerator(params),
    onSuccess: () => {
      // Invalidate feed generator queries to refetch
      queryClient.invalidateQueries({queryKey: ['popularFeedGenerators']});
      queryClient.invalidateQueries({queryKey: ['suggestedFeeds']});
    },
  });
}
