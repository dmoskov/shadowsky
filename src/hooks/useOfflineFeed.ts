/**
 * useOfflineFeed Hook
 *
 * Bridges feed queries with offline storage for stability-first architecture.
 * Implements stale-while-revalidate pattern for instant loads with background sync.
 *
 * Features:
 * - Stale-while-revalidate: Serve cached data instantly, refresh in background
 * - Transparent caching of feed items on successful fetches
 * - Automatic fallback to cached data when offline
 * - Real-time online/offline detection
 * - Cache status reporting for UI indicators
 * - Background refresh on visibility change
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  offlineStorageDB,
  type OfflineFeedItem,
} from "../services/offline-storage-db";
import { createLogger } from "../utils/logger";

const logger = createLogger("useOfflineFeed");

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
}

/**
 * Transform API feed item to offline storage format
 */
function transformToOfflineItem(
  item: any,
  feedType: "timeline" | "author" | "list" = "timeline",
): Omit<OfflineFeedItem, "_offlineCachedAt"> {
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
      text: post.record?.text || "",
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
function transformFromOfflineItem(item: OfflineFeedItem): any {
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
 * Hook to manage offline feed status and caching
 */
export function useOfflineFeedStatus(): OfflineFeedStatus {
  const [status, setStatus] = useState<OfflineFeedStatus>({
    isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
    isServingCached: false,
    cachedItemCount: 0,
    lastCachedAt: null,
    isInitialized: false,
  });

  // Initialize offline storage and get stats
  useEffect(() => {
    const init = async () => {
      try {
        await offlineStorageDB.init();
        const stats = await offlineStorageDB.getStats();
        const metadata = await offlineStorageDB.getMetadata("feed_timeline");

        setStatus((prev) => ({
          ...prev,
          cachedItemCount: stats.feedItemCount,
          lastCachedAt: metadata?.lastSyncAt || null,
          isInitialized: true,
        }));
      } catch (error) {
        logger.error("Failed to initialize offline storage:", error);
        setStatus((prev) => ({ ...prev, isInitialized: true }));
      }
    };

    init();
  }, []);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      logger.info("Device came online");
      setStatus((prev) => ({
        ...prev,
        isOnline: true,
        isServingCached: false,
      }));
    };

    const handleOffline = () => {
      logger.info("Device went offline");
      setStatus((prev) => ({ ...prev, isOnline: false }));
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return status;
}

/**
 * Hook to cache feed items after successful fetch
 */
export function useFeedCaching(
  feedType: "timeline" | "author" | "list" = "timeline",
) {
  const cacheFeedItems = useCallback(
    async (items: any[]) => {
      if (!items || items.length === 0) return;

      try {
        await offlineStorageDB.init();

        const offlineItems = items.map((item) =>
          transformToOfflineItem(item, feedType),
        );

        await offlineStorageDB.saveFeedItems(offlineItems, feedType);
        logger.info(`Cached ${offlineItems.length} ${feedType} feed items`);
      } catch (error) {
        logger.error("Failed to cache feed items:", error);
      }
    },
    [feedType],
  );

  return { cacheFeedItems };
}

/**
 * Hook to get cached feed items when offline
 */
export function useCachedFeed(
  feedType?: "timeline" | "author" | "list",
  limit = 100,
) {
  return useQuery({
    queryKey: ["offline-feed", feedType, limit],
    queryFn: async () => {
      await offlineStorageDB.init();
      const items = await offlineStorageDB.getFeedItems(limit, feedType);
      return items.map(transformFromOfflineItem);
    },
    enabled: !navigator.onLine, // Only fetch when offline
    staleTime: Infinity, // Cached data doesn't go stale
    gcTime: 30 * 60 * 1000, // Keep in memory for 30 minutes
  });
}

/**
 * Hook for offline-first feed fetching
 *
 * This is the main hook that combines online fetching with offline fallback.
 * It can be used as a wrapper around existing feed queries.
 */
export function useOfflineFirstFeed<T>({
  queryKey,
  queryFn,
  feedType = "timeline",
  enabled = true,
  onSuccess,
}: {
  queryKey: string[];
  queryFn: () => Promise<T>;
  feedType?: "timeline" | "author" | "list";
  enabled?: boolean;
  onSuccess?: (data: T) => void;
}) {
  const queryClient = useQueryClient();
  const status = useOfflineFeedStatus();
  const { cacheFeedItems } = useFeedCaching(feedType);
  const [isServingCached, setIsServingCached] = useState(false);

  // Main query with offline fallback
  const query = useQuery({
    queryKey,
    queryFn: async () => {
      // If offline, try to serve from cache
      if (!navigator.onLine) {
        logger.info("Offline - attempting to serve cached feed");
        setIsServingCached(true);

        try {
          await offlineStorageDB.init();
          const cachedItems = await offlineStorageDB.getFeedItems(
            100,
            feedType,
          );

          if (cachedItems.length > 0) {
            logger.info(`Serving ${cachedItems.length} cached items`);
            // Return in the expected format
            return {
              feed: cachedItems.map(transformFromOfflineItem),
              cursor: undefined,
              _fromCache: true,
            } as unknown as T;
          }
        } catch (error) {
          logger.error("Failed to get cached feed:", error);
        }

        throw new Error(
          "You are offline and no cached content is available. Please connect to the internet to view your feed.",
        );
      }

      // Online - fetch from API
      setIsServingCached(false);
      const data = await queryFn();

      // Cache the results
      if (data && typeof data === "object" && "feed" in data) {
        const feedData = data as { feed: any[] };
        cacheFeedItems(feedData.feed);
      }

      if (onSuccess) {
        onSuccess(data);
      }

      return data;
    },
    enabled,
    retry: (failureCount, _error) => {
      // Don't retry if offline
      if (!navigator.onLine) return false;
      // Otherwise retry up to 3 times
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // When coming back online, invalidate the query to refetch fresh data
  useEffect(() => {
    if (status.isOnline && isServingCached) {
      logger.info("Back online - refreshing feed");
      queryClient.invalidateQueries({ queryKey });
    }
  }, [status.isOnline, isServingCached, queryClient, queryKey]);

  return {
    ...query,
    isServingCached,
    offlineStatus: status,
  };
}

/**
 * Utility to prefetch and cache feed data for offline use
 */
export async function prefetchFeedForOffline(
  agent: any,
  feedType: "timeline" | "author" | "list" = "timeline",
  limit = 50,
): Promise<void> {
  if (!agent) {
    logger.warn("No agent available for prefetching");
    return;
  }

  try {
    logger.info(`Prefetching ${feedType} feed for offline use`);

    let response;
    switch (feedType) {
      case "timeline":
        response = await agent.getTimeline({ limit });
        break;
      default:
        logger.warn(`Unsupported feed type for prefetch: ${feedType}`);
        return;
    }

    if (response?.data?.feed) {
      await offlineStorageDB.init();
      const offlineItems = response.data.feed.map((item: any) =>
        transformToOfflineItem(item, feedType),
      );
      await offlineStorageDB.saveFeedItems(offlineItems, feedType);
      logger.info(`Prefetched ${offlineItems.length} items for offline use`);
    }
  } catch (error) {
    logger.error("Failed to prefetch feed:", error);
  }
}

/**
 * Cache freshness configuration
 */
const CACHE_CONFIG = {
  // Maximum age of cached data before showing stale indicator (5 minutes)
  STALE_THRESHOLD_MS: 5 * 60 * 1000,
  // Maximum age of cached data before forcing refresh (30 minutes)
  MAX_AGE_MS: 30 * 60 * 1000,
  // Minimum time between background refreshes (30 seconds)
  MIN_REFRESH_INTERVAL_MS: 30 * 1000,
  // Time to wait before refreshing after visibility change (100ms for stability)
  VISIBILITY_REFRESH_DELAY_MS: 100,
};

export interface StaleWhileRevalidateStatus {
  /** Whether we're showing cached data */
  isServingCached: boolean;
  /** Whether cache data is considered stale */
  isStale: boolean;
  /** Whether a background refresh is in progress */
  isRefreshing: boolean;
  /** Timestamp when cache was last updated */
  lastCachedAt: number | null;
  /** Time until next refresh is allowed */
  refreshCooldownMs: number;
}

/**
 * Hook for stale-while-revalidate feed caching
 *
 * This hook provides instant loading by serving cached data immediately
 * while fetching fresh data in the background. This improves perceived
 * performance and stability without requiring true offline support.
 *
 * Features:
 * - Serves cached data instantly for faster initial load
 * - Fetches fresh data in background without blocking UI
 * - Automatic refresh when tab becomes visible
 * - Cooldown between refreshes to prevent excessive requests
 * - Stale indicator for UI feedback
 */
export function useStaleWhileRevalidateFeed(
  feedType: "timeline" | "author" | "list" = "timeline",
) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<StaleWhileRevalidateStatus>({
    isServingCached: false,
    isStale: false,
    isRefreshing: false,
    lastCachedAt: null,
    refreshCooldownMs: 0,
  });
  const lastRefreshTimeRef = useRef<number>(0);
  const refreshInProgressRef = useRef<boolean>(false);

  // Get cached data from IndexedDB
  const getCachedFeed = useCallback(async () => {
    try {
      await offlineStorageDB.init();
      const metadata = await offlineStorageDB.getMetadata(`feed_${feedType}`);
      const cachedItems = await offlineStorageDB.getFeedItems(100, feedType);

      if (cachedItems.length > 0) {
        const lastCachedAt = metadata?.lastSyncAt || Date.now();
        const age = Date.now() - lastCachedAt;
        const isStale = age > CACHE_CONFIG.STALE_THRESHOLD_MS;

        return {
          items: cachedItems.map(transformFromOfflineItem),
          lastCachedAt,
          isStale,
          age,
        };
      }
      return null;
    } catch (error) {
      logger.error("Failed to get cached feed:", error);
      return null;
    }
  }, [feedType]);

  // Update status with cache age
  const updateCacheStatus = useCallback(async () => {
    try {
      await offlineStorageDB.init();
      const metadata = await offlineStorageDB.getMetadata(`feed_${feedType}`);

      if (metadata?.lastSyncAt) {
        const age = Date.now() - metadata.lastSyncAt;
        const isStale = age > CACHE_CONFIG.STALE_THRESHOLD_MS;
        const timeSinceLastRefresh = Date.now() - lastRefreshTimeRef.current;
        const cooldown = Math.max(
          0,
          CACHE_CONFIG.MIN_REFRESH_INTERVAL_MS - timeSinceLastRefresh,
        );

        setStatus((prev) => ({
          ...prev,
          lastCachedAt: metadata.lastSyncAt,
          isStale,
          refreshCooldownMs: cooldown,
        }));
      }
    } catch {
      // Ignore errors
    }
  }, [feedType]);

  // Check if refresh is allowed (respects cooldown)
  const canRefresh = useCallback(() => {
    const timeSinceLastRefresh = Date.now() - lastRefreshTimeRef.current;
    return (
      timeSinceLastRefresh >= CACHE_CONFIG.MIN_REFRESH_INTERVAL_MS &&
      !refreshInProgressRef.current
    );
  }, []);

  // Trigger background refresh
  const triggerBackgroundRefresh = useCallback(
    async (queryKey: string[]) => {
      if (!canRefresh()) {
        logger.info(
          "Skipping refresh - cooldown active or refresh in progress",
        );
        return;
      }

      refreshInProgressRef.current = true;
      lastRefreshTimeRef.current = Date.now();
      setStatus((prev) => ({ ...prev, isRefreshing: true }));

      try {
        logger.info("Triggering background feed refresh");
        // Invalidate the query to trigger a refetch
        await queryClient.invalidateQueries({ queryKey });
      } finally {
        refreshInProgressRef.current = false;
        setStatus((prev) => ({ ...prev, isRefreshing: false }));
        await updateCacheStatus();
      }
    },
    [canRefresh, queryClient, updateCacheStatus],
  );

  // Listen for visibility changes to refresh on tab focus
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        // Small delay to let other operations settle
        setTimeout(() => {
          updateCacheStatus();
        }, CACHE_CONFIG.VISIBILITY_REFRESH_DELAY_MS);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [updateCacheStatus]);

  // Initialize cache status on mount
  useEffect(() => {
    updateCacheStatus();
  }, [updateCacheStatus]);

  return {
    status,
    getCachedFeed,
    canRefresh,
    triggerBackgroundRefresh,
    updateCacheStatus,
  };
}

/**
 * Hook for automatic background refresh on visibility change
 *
 * Refreshes feed data when the tab becomes visible after being hidden,
 * ensuring users see fresh content when returning to the app.
 */
export function useVisibilityRefresh(
  queryKey: string[],
  options: {
    enabled?: boolean;
    minHiddenDuration?: number; // Minimum time tab must be hidden before refresh (ms)
  } = {},
) {
  const { enabled = true, minHiddenDuration = 60000 } = options; // Default: 1 minute
  const queryClient = useQueryClient();
  const hiddenAtRef = useRef<number | null>(null);
  const { canRefresh } = useStaleWhileRevalidateFeed();

  useEffect(() => {
    if (!enabled) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        hiddenAtRef.current = Date.now();
      } else if (
        document.visibilityState === "visible" &&
        hiddenAtRef.current
      ) {
        const hiddenDuration = Date.now() - hiddenAtRef.current;
        hiddenAtRef.current = null;

        // Only refresh if tab was hidden long enough and we can refresh
        if (hiddenDuration >= minHiddenDuration && canRefresh()) {
          logger.info(
            `Tab was hidden for ${Math.round(hiddenDuration / 1000)}s - refreshing feed`,
          );
          queryClient.invalidateQueries({ queryKey });
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled, minHiddenDuration, queryKey, queryClient, canRefresh]);
}

/**
 * Hook to pre-populate query cache with cached data for instant first load
 *
 * Call this early in the app lifecycle to ensure cached data is available
 * immediately when the feed component mounts.
 */
export function useFeedCacheWarmup(
  queryKey: string[],
  feedType: "timeline" | "author" | "list" = "timeline",
) {
  const queryClient = useQueryClient();
  const hasWarmedUpRef = useRef(false);

  useEffect(() => {
    if (hasWarmedUpRef.current) return;

    const warmup = async () => {
      try {
        // Check if query already has data
        const existingData = queryClient.getQueryData(queryKey);
        if (existingData) {
          return;
        }

        await offlineStorageDB.init();
        const cachedItems = await offlineStorageDB.getFeedItems(100, feedType);

        if (cachedItems.length > 0) {
          logger.info(
            `Pre-populating cache with ${cachedItems.length} items for instant load`,
          );

          // Pre-populate the query cache with cached data
          // This makes the data available immediately when the component mounts
          queryClient.setQueryData(queryKey, {
            pages: [
              {
                feed: cachedItems.map(transformFromOfflineItem),
                cursor: undefined,
                _fromCache: true,
                _cachedAt: cachedItems[0]?._offlineCachedAt || Date.now(),
              },
            ],
            pageParams: [undefined],
          });

          hasWarmedUpRef.current = true;
        }
      } catch (error) {
        logger.error("Failed to warm up feed cache:", error);
      }
    };

    warmup();
  }, [queryKey, queryClient, feedType]);
}

export default useOfflineFirstFeed;
