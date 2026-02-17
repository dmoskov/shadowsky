/**
 * useOfflineFeed Hook for Mobile
 *
 * Provides offline-first feed functionality for React Native.
 * Integrates with AsyncStorage-based offline storage and React Query.
 *
 * Features:
 * - Automatic caching of feed items on successful fetches
 * - Offline fallback to cached data
 * - Real-time online/offline status
 * - Stale content indicators
 * - Background refresh on network reconnection
 */

import {useQuery, useQueryClient, UseInfiniteQueryResult} from '@tanstack/react-query';
import {useCallback, useEffect, useState} from 'react';
import {offlineStorage, OfflineFeedItem} from '../services/offline-storage';
import {useNetworkStatus} from './useNetworkStatus';


import { createLogger } from '../utils/logger';

const logger = createLogger('Useofflinefeed');
/**
 * Feed item type for transformations
 */
interface FeedItem {
  post: {
    uri: string;
    cid: string;
    indexedAt?: string;
    author: {
      did: string;
      handle: string;
      displayName?: string;
      avatar?: string;
    };
    record?: {
      text?: string;
      createdAt?: string;
      embed?: unknown;
      facets?: unknown[];
    };
    replyCount?: number;
    repostCount?: number;
    likeCount?: number;
    viewer?: {like?: string; repost?: string; [key: string]: unknown};
  };
  _fromOfflineCache?: boolean;
  _cachedAt?: number;
}

export interface OfflineFeedStatus {
  /** Whether the device is currently online */
  isOnline: boolean;
  /** Whether we're currently serving cached data */
  isServingCached: boolean;
  /** Number of cached feed items available */
  cachedItemCount: number;
  /** Timestamp of last successful cache */
  lastCachedAt: number | null;
  /** Whether offline storage is initialized */
  isInitialized: boolean;
  /** Whether cached data is stale (older than threshold) */
  isStale: boolean;
}

/**
 * Transform API feed item to offline storage format
 */
function transformToOfflineItem(
  item: FeedItem,
  feedType: 'timeline' | 'author' | 'list' = 'timeline'
): Omit<OfflineFeedItem, '_offlineCachedAt'> {
  const post = item.post || item;
  return {
    uri: post.uri,
    cid: post.cid,
    indexedAt: post.indexedAt || new Date().toISOString(),
    author: {
      did: post.author.did,
      handle: post.author.handle,
      displayName: post.author.displayName,
      avatar: post.author.avatar,
    },
    record: {
      text: post.record?.text || '',
      createdAt: post.record?.createdAt || new Date().toISOString(),
      embed: post.record?.embed,
      facets: post.record?.facets,
    },
    replyCount: post.replyCount,
    repostCount: post.repostCount,
    likeCount: post.likeCount,
    _feedType: feedType,
  };
}

/**
 * Transform offline storage item back to feed item format
 */
function transformFromOfflineItem(item: OfflineFeedItem): FeedItem {
  return {
    post: {
      uri: item.uri,
      cid: item.cid,
      indexedAt: item.indexedAt,
      author: item.author,
      record: item.record,
      replyCount: item.replyCount,
      repostCount: item.repostCount,
      likeCount: item.likeCount,
      viewer: {}, // Viewer state not persisted offline
    },
    _fromOfflineCache: true,
    _cachedAt: item._offlineCachedAt,
  };
}

/**
 * Hook to manage offline feed status
 */
export function useOfflineFeedStatus(): OfflineFeedStatus {
  const {isConnected} = useNetworkStatus();
  const [status, setStatus] = useState<OfflineFeedStatus>({
    isOnline: isConnected,
    isServingCached: false,
    cachedItemCount: 0,
    lastCachedAt: null,
    isInitialized: false,
    isStale: false,
  });

  // Initialize offline storage and get stats
  useEffect(() => {
    const init = async () => {
      try {
        await offlineStorage.init();
        const stats = await offlineStorage.getStats();
        const metadata = await offlineStorage.getMetadata('feed_timeline');

        const lastCachedAt = metadata?.lastSyncAt || null;
        const isStale = lastCachedAt ? Date.now() - lastCachedAt > 5 * 60 * 1000 : true; // 5 minutes

        setStatus(prev => ({
          ...prev,
          cachedItemCount: stats.feedItemCount,
          lastCachedAt,
          isInitialized: true,
          isStale,
        }));
      } catch (error) {
        logger.error('Failed to initialize:', error);
        setStatus(prev => ({...prev, isInitialized: true}));
      }
    };

    init();
  }, []);

  // Update online status when network changes
  useEffect(() => {
    setStatus(prev => ({
      ...prev,
      isOnline: isConnected,
    }));
  }, [isConnected]);

  return status;
}

/**
 * Hook to cache feed items after successful fetch
 */
export function useFeedCaching(feedType: 'timeline' | 'author' | 'list' = 'timeline') {
  const cacheFeedItems = useCallback(
    async (items: unknown[]) => {
      if (!items || items.length === 0) return;

      try {
        await offlineStorage.init();

        const offlineItems = items.map(item =>
          transformToOfflineItem(item as FeedItem, feedType)
        );

        await offlineStorage.saveFeedItems(offlineItems, feedType);
        logger.log(`Cached ${offlineItems.length} ${feedType} items`);
      } catch (error) {
        logger.error('Failed to cache feed items:', error);
      }
    },
    [feedType]
  );

  return {cacheFeedItems};
}

/**
 * Hook to get cached feed items
 */
export function useCachedFeed(feedType?: 'timeline' | 'author' | 'list', limit = 100) {
  return useQuery({
    queryKey: ['offline-feed', feedType, limit],
    queryFn: async () => {
      await offlineStorage.init();
      const items = await offlineStorage.getFeedItems(limit, feedType);
      return items.map(transformFromOfflineItem);
    },
    staleTime: Infinity, // Cached data doesn't go stale
    gcTime: 30 * 60 * 1000, // Keep in memory for 30 minutes
  });
}

/**
 * Hook to enhance an existing infinite query with offline support
 *
 * This wraps around existing feed queries (like useTimeline) to add:
 * - Automatic caching on successful fetch
 * - Offline fallback to cached data
 * - Stale indicators
 */
export function useOfflineFeedEnhancer<T extends {pages: Array<{feed: unknown[]}> | undefined}>(
  query: UseInfiniteQueryResult<T>,
  feedType: 'timeline' | 'author' | 'list' = 'timeline',
  queryKey: unknown[] = ['timeline']
) {
  const {isConnected} = useNetworkStatus();
  const {cacheFeedItems} = useFeedCaching(feedType);
  const queryClient = useQueryClient();
  const [offlineStatus, setOfflineStatus] = useState<{
    isServingCached: boolean;
    isStale: boolean;
  }>({
    isServingCached: false,
    isStale: false,
  });

  // Cache successful fetch results
  useEffect(() => {
    if (query.data?.pages && query.isSuccess && isConnected) {
      // Extract all feed items from all pages
      const allFeedItems = query.data.pages.flatMap(page => page.feed || []);

      if (allFeedItems.length > 0) {
        cacheFeedItems(allFeedItems);
      }
    }
  }, [query.data, query.isSuccess, isConnected, cacheFeedItems]);

  // Load cached data when offline
  useEffect(() => {
    const loadCachedData = async () => {
      if (!isConnected && !query.data && query.isError) {
        try {
          await offlineStorage.init();
          const cachedItems = await offlineStorage.getFeedItems(100, feedType);

          if (cachedItems.length > 0) {
            logger.log(`Loading ${cachedItems.length} cached items`);

            // Check if data is stale (older than 5 minutes)
            const metadata = await offlineStorage.getMetadata(`feed_${feedType}`);
            const isStale = metadata?.lastSyncAt
              ? Date.now() - metadata.lastSyncAt > 5 * 60 * 1000
              : true;

            setOfflineStatus({
              isServingCached: true,
              isStale,
            });

            // Inject cached data into query cache
            // This is a workaround to show cached data when offline
            queryClient.setQueryData(queryKey, {
              pages: [
                {
                  feed: cachedItems.map(transformFromOfflineItem),
                  cursor: undefined,
                  _fromCache: true,
                },
              ],
              pageParams: [undefined],
            });
          }
        } catch (error) {
          logger.error('Failed to load cached data:', error);
        }
      } else if (isConnected && offlineStatus.isServingCached) {
        // Back online - clear offline status
        setOfflineStatus({
          isServingCached: false,
          isStale: false,
        });
      }
    };

    loadCachedData();
  }, [isConnected, query.data, query.isError, queryKey, queryClient, feedType, offlineStatus.isServingCached]);

  return {
    ...query,
    isServingCached: offlineStatus.isServingCached,
    isStale: offlineStatus.isStale,
    isOnline: isConnected,
  };
}

/**
 * Hook to cache thread data for offline viewing
 */
export function useThreadCaching() {
  const cacheThread = useCallback(async (threadUri: string, posts: unknown[]) => {
    if (!posts || posts.length === 0) return;

    try {
      await offlineStorage.init();
      await offlineStorage.saveThread(threadUri, posts);
      logger.log(`Cached thread ${threadUri} with ${posts.length} posts`);
    } catch (error) {
      logger.error('Failed to cache thread:', error);
    }
  }, []);

  return {cacheThread};
}

/**
 * Hook to get cached thread
 */
export function useCachedThread(threadUri: string) {
  return useQuery({
    queryKey: ['offline-thread', threadUri],
    queryFn: async () => {
      await offlineStorage.init();
      const thread = await offlineStorage.getThread(threadUri);
      return thread;
    },
    enabled: !!threadUri,
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000,
  });
}

/**
 * Hook to enhance thread query with offline support
 */
export function useOfflineThreadEnhancer<T extends {thread?: {posts?: unknown[]}}>(
  query: {data: T | undefined; isSuccess: boolean; isError: boolean},
  threadUri: string,
  queryKey: unknown[] = ['thread', threadUri]
) {
  const {isConnected} = useNetworkStatus();
  const {cacheThread} = useThreadCaching();
  const queryClient = useQueryClient();
  const [isServingCached, setIsServingCached] = useState(false);

  // Cache successful thread fetch
  useEffect(() => {
    if (query.data?.thread?.posts && query.isSuccess && isConnected) {
      cacheThread(threadUri, query.data.thread.posts);
    }
  }, [query.data, query.isSuccess, isConnected, cacheThread, threadUri]);

  // Load cached thread when offline
  useEffect(() => {
    const loadCachedThread = async () => {
      if (!isConnected && !query.data && query.isError && threadUri) {
        try {
          await offlineStorage.init();
          const cachedThread = await offlineStorage.getThread(threadUri);

          if (cachedThread) {
            logger.log(`Loading cached thread ${threadUri}`);
            setIsServingCached(true);

            // Inject cached data into query cache
            queryClient.setQueryData(queryKey, {
              thread: {
                posts: cachedThread.posts,
                _fromCache: true,
              },
            });
          }
        } catch (error) {
          logger.error('Failed to load cached thread:', error);
        }
      } else if (isConnected && isServingCached) {
        setIsServingCached(false);
      }
    };

    loadCachedThread();
  }, [isConnected, query.data, query.isError, queryKey, queryClient, threadUri, isServingCached]);

  return {
    ...query,
    isServingCached,
    isOnline: isConnected,
  };
}

/**
 * Setup periodic cleanup of old cached data.
 * Call this once during app initialization.
 * Returns a teardown function that clears the periodic timer.
 */
export async function setupOfflineStorageCleanup(): Promise<() => void> {
  let timerId: ReturnType<typeof setInterval> | undefined;

  try {
    await offlineStorage.init();
    await offlineStorage.enforceStorageLimits();
    logger.log('Initial cleanup complete');

    // Schedule periodic cleanup (every 24 hours)
    timerId = setInterval(async () => {
      try {
        await offlineStorage.enforceStorageLimits();
        logger.log('Periodic cleanup complete');
      } catch (error) {
        logger.error('Periodic cleanup failed:', error);
      }
    }, 24 * 60 * 60 * 1000);
  } catch (error) {
    logger.error('Setup failed:', error);
  }

  return () => {
    if (timerId !== undefined) {
      clearInterval(timerId);
    }
  };
}
