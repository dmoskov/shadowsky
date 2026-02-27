import {useInfiniteQuery, useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {AppBskyFeedDefs} from '@atproto/api';
import {useAuth} from '../../contexts/AuthContext';
import {useToast} from '../../contexts/ToastContext';
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
  FeedGeneratorResponse,
} from '../../services/atproto/feeds';
import {cancelMany, invalidateMany} from '../../utils/query-helpers';

type GeneratorView = AppBskyFeedDefs.GeneratorView;

interface InfiniteData<T> {
  pages: T[];
  pageParams: unknown[];
}

/**
 * Search all feed discovery caches to find a GeneratorView by URI.
 * Used for optimistic updates when saving a feed — the feed data
 * is already in the popular/suggested/search caches.
 */
function findFeedInCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  feedUri: string,
): GeneratorView | undefined {
  const cacheKeys = ['popularFeedGenerators', 'suggestedFeeds', 'searchFeedGenerators'];

  for (const key of cacheKeys) {
    const queries = queryClient.getQueriesData<InfiniteData<FeedGeneratorResponse>>({queryKey: [key]});
    for (const [, data] of queries) {
      if (!data?.pages) continue;
      for (const page of data.pages) {
        const found = page.feeds?.find((f) => f.uri === feedUri);
        if (found) return found;
      }
    }
  }
  return undefined;
}

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
  const {session} = useAuth();
  return useQuery({
    queryKey: ['savedFeeds'],
    queryFn: () => getSavedFeeds(),
    enabled: !!session,
  });
}

/**
 * Hook to save a feed to the user's preferences
 */
export function useSaveFeed() {
  const queryClient = useQueryClient();
  const {showToast} = useToast();

  return useMutation({
    mutationFn: (feedUri: string) => saveFeed(feedUri),
    onMutate: async (feedUri) => {
      await cancelMany(queryClient, [
        {queryKey: ['savedFeeds']},
        {queryKey: ['pinnedFeeds']},
      ]);

      const previousSavedFeeds = queryClient.getQueryData<GeneratorView[]>(['savedFeeds']);

      // Find the full GeneratorView from discovery caches
      const feedView = findFeedInCaches(queryClient, feedUri);
      if (feedView && previousSavedFeeds) {
        queryClient.setQueryData<GeneratorView[]>(
          ['savedFeeds'],
          [...previousSavedFeeds, feedView],
        );
      }

      return {previousSavedFeeds};
    },
    onSuccess: () => {
      invalidateMany(queryClient, [
        {queryKey: ['savedFeeds']},
      ]);
    },
    onError: (_error, _feedUri, context) => {
      if (context?.previousSavedFeeds) {
        queryClient.setQueryData(['savedFeeds'], context.previousSavedFeeds);
      }
      showToast('Failed to save feed', {type: 'error'});
    },
  });
}

/**
 * Hook to remove a feed from the user's preferences
 */
export function useUnsaveFeed() {
  const queryClient = useQueryClient();
  const {showToast} = useToast();

  return useMutation({
    mutationFn: (feedUri: string) => unsaveFeed(feedUri),
    onMutate: async (feedUri) => {
      await cancelMany(queryClient, [
        {queryKey: ['savedFeeds']},
        {queryKey: ['pinnedFeeds']},
      ]);

      const previousSavedFeeds = queryClient.getQueryData<GeneratorView[]>(['savedFeeds']);
      const previousPinnedFeeds = queryClient.getQueryData<string[]>(['pinnedFeeds']);

      // Optimistically remove from saved feeds
      if (previousSavedFeeds) {
        queryClient.setQueryData<GeneratorView[]>(
          ['savedFeeds'],
          previousSavedFeeds.filter((f) => f.uri !== feedUri),
        );
      }

      // Also remove from pinned if present
      if (previousPinnedFeeds) {
        queryClient.setQueryData<string[]>(
          ['pinnedFeeds'],
          previousPinnedFeeds.filter((uri) => uri !== feedUri),
        );
      }

      return {previousSavedFeeds, previousPinnedFeeds};
    },
    onSuccess: () => {
      invalidateMany(queryClient, [
        {queryKey: ['savedFeeds']},
        {queryKey: ['pinnedFeeds']},
      ]);
    },
    onError: (_error, _feedUri, context) => {
      if (context?.previousSavedFeeds) {
        queryClient.setQueryData(['savedFeeds'], context.previousSavedFeeds);
      }
      if (context?.previousPinnedFeeds) {
        queryClient.setQueryData(['pinnedFeeds'], context.previousPinnedFeeds);
      }
      showToast('Failed to remove feed', {type: 'error'});
    },
  });
}

/**
 * Hook to pin a feed to the home screen
 */
export function usePinFeed() {
  const queryClient = useQueryClient();
  const {showToast} = useToast();

  return useMutation({
    mutationFn: (feedUri: string) => pinFeed(feedUri),
    onMutate: async (feedUri) => {
      await cancelMany(queryClient, [
        {queryKey: ['savedFeeds']},
        {queryKey: ['pinnedFeeds']},
      ]);

      const previousSavedFeeds = queryClient.getQueryData<GeneratorView[]>(['savedFeeds']);
      const previousPinnedFeeds = queryClient.getQueryData<string[]>(['pinnedFeeds']);

      // Optimistically add to pinned feeds
      if (previousPinnedFeeds && !previousPinnedFeeds.includes(feedUri)) {
        queryClient.setQueryData<string[]>(
          ['pinnedFeeds'],
          [...previousPinnedFeeds, feedUri],
        );
      }

      // Also ensure it appears in saved feeds
      const feedView = findFeedInCaches(queryClient, feedUri);
      if (feedView && previousSavedFeeds && !previousSavedFeeds.some((f) => f.uri === feedUri)) {
        queryClient.setQueryData<GeneratorView[]>(
          ['savedFeeds'],
          [...previousSavedFeeds, feedView],
        );
      }

      return {previousSavedFeeds, previousPinnedFeeds};
    },
    onSuccess: () => {
      invalidateMany(queryClient, [
        {queryKey: ['savedFeeds']},
        {queryKey: ['pinnedFeeds']},
      ]);
    },
    onError: (_error, _feedUri, context) => {
      if (context?.previousSavedFeeds) {
        queryClient.setQueryData(['savedFeeds'], context.previousSavedFeeds);
      }
      if (context?.previousPinnedFeeds) {
        queryClient.setQueryData(['pinnedFeeds'], context.previousPinnedFeeds);
      }
      showToast('Failed to pin feed', {type: 'error'});
    },
  });
}

/**
 * Hook to unpin a feed from the home screen
 */
export function useUnpinFeed() {
  const queryClient = useQueryClient();
  const {showToast} = useToast();

  return useMutation({
    mutationFn: (feedUri: string) => unpinFeed(feedUri),
    onMutate: async (feedUri) => {
      await queryClient.cancelQueries({queryKey: ['pinnedFeeds']});

      const previousPinnedFeeds = queryClient.getQueryData<string[]>(['pinnedFeeds']);

      // Optimistically remove from pinned feeds
      if (previousPinnedFeeds) {
        queryClient.setQueryData<string[]>(
          ['pinnedFeeds'],
          previousPinnedFeeds.filter((uri) => uri !== feedUri),
        );
      }

      return {previousPinnedFeeds};
    },
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ['pinnedFeeds']});
    },
    onError: (_error, _feedUri, context) => {
      if (context?.previousPinnedFeeds) {
        queryClient.setQueryData(['pinnedFeeds'], context.previousPinnedFeeds);
      }
      showToast('Failed to unpin feed', {type: 'error'});
    },
  });
}

/**
 * Hook to fetch the user's pinned feeds
 */
export function usePinnedFeeds() {
  const {session} = useAuth();
  return useQuery({
    queryKey: ['pinnedFeeds'],
    queryFn: () => getPinnedFeeds(),
    enabled: !!session,
  });
}

/**
 * Hook to reorder saved feeds
 */
export function useReorderSavedFeeds() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (feedUris: string[]) => reorderSavedFeeds(feedUris),
    onMutate: async (feedUris) => {
      await cancelMany(queryClient, [
        {queryKey: ['savedFeeds']},
        {queryKey: ['pinnedFeeds']},
      ]);

      const previousSavedFeeds = queryClient.getQueryData<GeneratorView[]>(['savedFeeds']);
      const previousPinnedFeeds = queryClient.getQueryData<string[]>(['pinnedFeeds']);

      // Optimistically reorder saved feeds
      if (previousSavedFeeds) {
        const feedMap = new Map(previousSavedFeeds.map((f) => [f.uri, f]));
        const reordered = feedUris
          .map((uri) => feedMap.get(uri))
          .filter((f): f is GeneratorView => f != null);
        // Append any feeds not in the reorder list
        const remaining = previousSavedFeeds.filter((f) => !feedUris.includes(f.uri));
        queryClient.setQueryData<GeneratorView[]>(['savedFeeds'], [...reordered, ...remaining]);
      }

      // Update pinned feeds to match the new order
      queryClient.setQueryData<string[]>(['pinnedFeeds'], feedUris);

      return {previousSavedFeeds, previousPinnedFeeds};
    },
    onSuccess: () => {
      invalidateMany(queryClient, [
        {queryKey: ['savedFeeds']},
        {queryKey: ['pinnedFeeds']},
      ]);
    },
    onError: (_error, _feedUris, context) => {
      if (context?.previousSavedFeeds) {
        queryClient.setQueryData(['savedFeeds'], context.previousSavedFeeds);
      }
      if (context?.previousPinnedFeeds) {
        queryClient.setQueryData(['pinnedFeeds'], context.previousPinnedFeeds);
      }
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
      invalidateMany(queryClient, [
        {queryKey: ['popularFeedGenerators']},
        {queryKey: ['suggestedFeeds']},
      ]);
    },
  });
}
