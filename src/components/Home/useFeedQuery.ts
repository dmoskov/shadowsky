import { debug } from "@bsky/shared";
import type { BskyAgent } from "@atproto/api";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useState } from "react";
import { useHiddenPosts } from "../../contexts/HiddenPostsContext";
import { useModeration } from "../../contexts/ModerationContext";
import {
  useFeedCaching,
  useOfflineFeedStatus,
} from "../../hooks/useOfflineFeed";
import { useMinDuration } from "../../hooks/useTiming";
import { offlineStorageDB } from "../../services/offline-storage-db";
import { rateLimitedFeedFetch } from "../../services/rate-limiter";
import { createLogger } from "../../utils/logger";
import { MOBILE_CONFIG } from "./constants";
import type { ApiError, FeedQueryData, FeedType } from "./types";

const logger = createLogger("Home");

interface UseFeedQueryOptions {
  agent: BskyAgent | null | undefined;
  selectedFeed: FeedType;
}

export function useFeedQuery({ agent, selectedFeed }: UseFeedQueryOptions) {
  const queryClient = useQueryClient();
  const { isPostHidden } = useHiddenPosts();
  const { isUserMuted, isUserBlocked, isThreadMuted } = useModeration();
  const offlineStatus = useOfflineFeedStatus();
  const { cacheFeedItems } = useFeedCaching("timeline");
  const [isServingCachedFeed, setIsServingCachedFeed] = useState(false);

  const feedQuery = useInfiniteQuery({
    queryKey: ["timeline", selectedFeed],
    queryFn: async ({ pageParam }: { pageParam?: string }) => {
      if (!agent) throw new Error("Not authenticated");

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
        response = await rateLimitedFeedFetch(async () => {
          switch (selectedFeed) {
            case "following":
            case "recent":
              return agent.getTimeline({
                cursor: pageParam,
                limit: MOBILE_CONFIG.PAGE_SIZE,
              });

            default:
              if (selectedFeed.startsWith("at://")) {
                if (selectedFeed.includes("/app.bsky.graph.list/")) {
                  return agent.app.bsky.feed.getListFeed({
                    list: selectedFeed,
                    cursor: pageParam,
                    limit: MOBILE_CONFIG.PAGE_SIZE,
                  });
                } else {
                  return agent.app.bsky.feed.getFeed({
                    feed: selectedFeed,
                    cursor: pageParam,
                    limit: MOBILE_CONFIG.PAGE_SIZE,
                  });
                }
              } else {
                switch (selectedFeed) {
                  case "whats-hot":
                    return agent.app.bsky.feed.getFeed({
                      feed: "at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/whats-hot",
                      cursor: pageParam,
                      limit: MOBILE_CONFIG.PAGE_SIZE,
                    });

                  case "popular-with-friends":
                    return agent.app.bsky.feed.getFeed({
                      feed: "at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/with-friends",
                      cursor: pageParam,
                      limit: MOBILE_CONFIG.PAGE_SIZE,
                    });

                  default:
                    throw new Error(`Unknown feed type: ${selectedFeed}`);
                }
              }
          }
        });

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
    enabled: !!agent,
    staleTime: MOBILE_CONFIG.STALE_TIME,
    gcTime: MOBILE_CONFIG.GC_TIME,
    refetchOnMount: false,
    retry: (failureCount, error) => {
      if (!navigator.onLine) return false;
      const status = (error as ApiError)?.status;
      if (status === 429) return failureCount < 3;
      if (status && status >= 400 && status < 500) return false;
      return failureCount < 3;
    },
    retryDelay: (attemptIndex, error) => {
      const apiError = error as ApiError;
      if (apiError?.status === 429) {
        const retryAfter =
          apiError?.headers?.["retry-after"] ||
          apiError?.headers?.["Retry-After"];
        if (retryAfter) {
          const seconds = parseInt(retryAfter, 10);
          if (!isNaN(seconds)) return seconds * 1000;
        }
        return Math.min(2000 * Math.pow(2, attemptIndex), 10000);
      }
      return Math.min(1000 * Math.pow(2, attemptIndex), 8000);
    },
  });

  const {
    data,
    isLoading: isLoadingRaw,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = feedQuery;

  const isLoading = useMinDuration(isLoadingRaw);

  useEffect(() => {
    if (offlineStatus.isOnline && isServingCachedFeed) {
      logger.info("Back online - refreshing feed");
      queryClient.invalidateQueries({ queryKey: ["timeline", selectedFeed] });
    }
  }, [offlineStatus.isOnline, isServingCachedFeed, queryClient, selectedFeed]);

  const posts = React.useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((page, pageIndex) =>
      page.feed
        .filter((item) => {
          const post = item.post;
          if (isPostHidden(post.uri)) return false;
          if (isUserMuted(post.author.did)) return false;
          if (isUserBlocked(post.author.did)) return false;
          if (isThreadMuted(post.uri)) return false;
          return true;
        })
        .map((item, itemIndex) => ({
          ...item,
          _pageIndex: pageIndex,
          _itemIndex: itemIndex,
        })),
    );
  }, [data, isPostHidden, isUserMuted, isUserBlocked, isThreadMuted]);

  React.useEffect(() => {
    if (data?.pages && data.pages.length > MOBILE_CONFIG.MAX_PAGES) {
      const scrollRatio =
        window.scrollY /
        (document.documentElement.scrollHeight - window.innerHeight || 1);
      if (scrollRatio > 0.5) {
        queryClient.setQueryData(
          ["timeline", selectedFeed],
          (oldData: FeedQueryData | undefined) => {
            if (!oldData) return oldData;
            return {
              ...oldData,
              pages: oldData.pages.slice(-MOBILE_CONFIG.MAX_PAGES),
              pageParams: oldData.pageParams.slice(-MOBILE_CONFIG.MAX_PAGES),
            };
          },
        );
      }
    }
  }, [data?.pages, queryClient, selectedFeed]);

  return {
    posts,
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isServingCachedFeed,
  };
}
