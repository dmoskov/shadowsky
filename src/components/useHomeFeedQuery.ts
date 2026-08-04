import type { BskyAgent } from "@atproto/api";
import { debug } from "@bsky/shared";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useFeedCaching, useOfflineFeedStatus } from "../hooks/useOfflineFeed";
import { offlineStorageDB } from "../services/offline-storage-db";
import { rateLimitedFeedFetch } from "../services/rate-limiter";
import { createLogger } from "../utils/logger";
import { type ApiError, type FeedType, MOBILE_CONFIG } from "./Home.types";

const logger = createLogger("useHomeFeedQuery");

/**
 * Fetch one page of a home feed, dispatching on feed type:
 * standard timeline, custom feed generator (at:// URI), list feed,
 * or a known named feed. Shared by the infinite query below and by
 * useFeedFreshness's single-post "peek" check.
 */
export async function fetchFeedPage(
  agent: BskyAgent,
  selectedFeed: FeedType,
  {
    cursor,
    limit = MOBILE_CONFIG.PAGE_SIZE,
  }: {
    cursor?: string;
    limit?: number;
  } = {},
) {
  switch (selectedFeed) {
    case "following":
    case "recent":
      return agent.getTimeline({ cursor, limit });

    default:
      // Handle custom feed URIs
      if (selectedFeed.startsWith("at://")) {
        // Check if it's a list feed or a regular feed
        if (selectedFeed.includes("/app.bsky.graph.list/")) {
          // It's a list feed
          return agent.app.bsky.feed.getListFeed({
            list: selectedFeed,
            cursor,
            limit,
          });
        } else {
          // It's a regular feed
          return agent.app.bsky.feed.getFeed({
            feed: selectedFeed,
            cursor,
            limit,
          });
        }
      } else {
        // Handle known feed types
        switch (selectedFeed) {
          case "whats-hot":
            return agent.app.bsky.feed.getFeed({
              feed: "at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/whats-hot",
              cursor,
              limit,
            });

          case "popular-with-friends":
            return agent.app.bsky.feed.getFeed({
              feed: "at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/with-friends",
              cursor,
              limit,
            });

          default:
            throw new Error(`Unknown feed type: ${selectedFeed}`);
        }
      }
  }
}

/**
 * Encapsulates the home timeline feed fetching concern:
 * - Online fetch (following / recent / custom feed URIs / list feeds)
 * - Offline cache fallback (serve + persist via offline storage)
 * - Rate limiting, retry/backoff (429 aware), and user-friendly errors
 * - Automatic refresh when coming back online from cached content
 *
 * Extracted from Home.tsx to keep the component focused on rendering/state.
 */
/**
 * @param enabled Set false to hold off fetching entirely — used by deck columns
 *   the user hasn't scrolled to yet, so a wide deck doesn't fire one timeline
 *   request per saved feed on mount.
 */
export function useHomeFeedQuery(selectedFeed: FeedType, enabled = true) {
  const { agent } = useAuth();
  const queryClient = useQueryClient();
  const offlineStatus = useOfflineFeedStatus();
  const { cacheFeedItems } = useFeedCaching("timeline");
  const [isServingCachedFeed, setIsServingCachedFeed] = useState(false);

  const feedQuery = useInfiniteQuery({
    queryKey: ["timeline", selectedFeed],
    queryFn: async ({ pageParam }: { pageParam?: string }) => {
      if (!agent) throw new Error("Not authenticated");

      // If offline and this is the first page, try to serve from cache
      if (!navigator.onLine && !pageParam) {
        logger.info("Offline - attempting to serve cached feed");
        setIsServingCachedFeed(true);

        try {
          await offlineStorageDB.init();
          const cachedItems = await offlineStorageDB.getFeedItems(
            100,
            "timeline",
          );

          if (cachedItems.length > 0) {
            logger.info(`Serving ${cachedItems.length} cached items`);
            // Transform cached items back to feed format
            const transformedFeed = cachedItems.map((item) => ({
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
            }));

            return {
              feed: transformedFeed,
              cursor: undefined,
              _fromCache: true,
            };
          }
        } catch (cacheError) {
          logger.error("Failed to get cached feed:", cacheError);
        }

        throw new Error(
          "You are offline and no cached content is available. Connect to the internet to view your feed.",
        );
      }

      setIsServingCachedFeed(false);
      let response;

      try {
        // Wrap all feed API calls in rate limiter to prevent 429s
        // when multiple columns load simultaneously
        response = await rateLimitedFeedFetch(() =>
          fetchFeedPage(agent, selectedFeed, { cursor: pageParam }),
        );

        // Cache timeline feed items for offline access (only first page)
        if (
          response?.data?.feed &&
          !pageParam &&
          (selectedFeed === "following" || selectedFeed === "recent")
        ) {
          cacheFeedItems(response.data.feed);
        }
      } catch (err: unknown) {
        const error = err as ApiError;
        debug.error(`Failed to fetch feed ${selectedFeed}:`, error);

        // If fetch failed and we're possibly offline, try cache
        if (!navigator.onLine && !pageParam) {
          try {
            await offlineStorageDB.init();
            const cachedItems = await offlineStorageDB.getFeedItems(
              100,
              "timeline",
            );

            if (cachedItems.length > 0) {
              logger.info(
                `Network error - serving ${cachedItems.length} cached items`,
              );
              setIsServingCachedFeed(true);
              const transformedFeed = cachedItems.map((item) => ({
                post: {
                  uri: item.uri,
                  cid: item.cid,
                  indexedAt: item.indexedAt,
                  author: item.author,
                  record: item.record,
                  replyCount: item.replyCount,
                  repostCount: item.repostCount,
                  likeCount: item.likeCount,
                  viewer: {},
                },
                _fromOfflineCache: true,
                _cachedAt: item._offlineCachedAt,
              }));

              return {
                feed: transformedFeed,
                cursor: undefined,
                _fromCache: true,
              };
            }
          } catch {
            // Fall through to error handling
          }
        }

        // Provide more user-friendly error messages
        if (error?.message?.includes("List not found")) {
          throw new Error(
            "This list could not be found. It may have been deleted or you may not have access to it.",
          );
        } else if (error?.message?.includes("Feed not found")) {
          throw new Error(
            "This feed could not be found. It may have been removed or you may not have access to it.",
          );
        } else if (error?.message?.includes("must be a valid at-uri")) {
          throw new Error(
            "Invalid feed URL. Please check the URL and try again.",
          );
        } else if (error?.status === 400) {
          throw new Error("Invalid feed request. Please check the feed URL.");
        } else if (error?.status === 403) {
          throw new Error("You do not have permission to view this feed.");
        } else if (error?.status === 404) {
          throw new Error("Feed not found. It may have been deleted.");
        } else if (error?.status === 429) {
          // Preserve the original error so retry logic can read status/headers
          throw err;
        } else if (error?.status && error.status >= 500) {
          throw new Error("Server error. Please try again later.");
        } else {
          throw new Error(
            error?.message || "Failed to load feed. Please try again.",
          );
        }
      }

      debug.log(`${selectedFeed} feed response:`, response);
      return response.data;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.cursor,
    maxPages: 10,
    enabled: !!agent && enabled,
    staleTime: MOBILE_CONFIG.STALE_TIME,
    gcTime: MOBILE_CONFIG.GC_TIME,
    refetchOnMount: false, // Don't automatically refetch
    retry: (failureCount, error) => {
      // Don't retry if offline
      if (!navigator.onLine) return false;
      const status = (error as ApiError)?.status;
      // Retry 429s up to 3 times (retryDelay handles backoff)
      if (status === 429) return failureCount < 3;
      // Don't retry client errors (except 429)
      if (status && status >= 400 && status < 500) return false;
      // Retry server errors and network errors up to 3 times
      return failureCount < 3;
    },
    retryDelay: (attemptIndex, error) => {
      const apiError = error as ApiError;
      if (apiError?.status === 429) {
        // Respect Retry-After header if present
        const retryAfter =
          apiError?.headers?.["retry-after"] ||
          apiError?.headers?.["Retry-After"];
        if (retryAfter) {
          const seconds = parseInt(retryAfter, 10);
          if (!isNaN(seconds)) return seconds * 1000;
        }
        // Default: aggressive backoff for 429 (2s, 4s, 8s)
        return Math.min(2000 * Math.pow(2, attemptIndex), 10000);
      }
      // Standard exponential backoff for other errors
      return Math.min(1000 * Math.pow(2, attemptIndex), 8000);
    },
  });

  // Refresh feed when coming back online from cached data
  useEffect(() => {
    if (offlineStatus.isOnline && isServingCachedFeed) {
      logger.info("Back online - refreshing feed");
      queryClient.invalidateQueries({ queryKey: ["timeline", selectedFeed] });
    }
  }, [offlineStatus.isOnline, isServingCachedFeed, queryClient, selectedFeed]);

  return feedQuery;
}
