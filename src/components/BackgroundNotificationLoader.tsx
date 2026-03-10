import type { Notification } from "@atproto/api/dist/client/types/app/bsky/notification/listNotifications";
import { debug } from "@bsky/shared";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { subDays } from "date-fns";
import React, { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { usePageVisibility } from "../hooks/usePageVisibility";
import { getNotificationService } from "../services/atproto/notifications";
import { NotificationCacheService } from "../services/notification-cache-service";
import { ExtendedFetchCache } from "../utils/extendedFetchCache";
import {
  prefetchNotificationPosts,
  prefetchRootPosts,
} from "../utils/prefetchNotificationPosts";

/**
 * Silently loads 4 weeks of notifications in the background
 * No UI - just data fetching
 */
export const BackgroundNotificationLoader: React.FC = () => {
  const { session, agent } = useAuth();
  const queryClient = useQueryClient();
  const isVisible = usePageVisibility();
  const [cacheService] = useState(() => NotificationCacheService.getInstance());
  const [isIndexedDBReady, setIsIndexedDBReady] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [enablePolling, setEnablePolling] = useState(false);

  // Check if we already have cached data
  const cachedData = queryClient.getQueryData([
    "notifications-extended",
  ]) as any;
  const hasCachedData = cachedData?.pages?.length > 0;

  // Check if cached data is stale (older than 5 minutes)
  const isCachedDataStale = React.useMemo(() => {
    if (!hasCachedData || !cachedData?.pages?.[0]?.notifications?.[0])
      return true;
    const newestNotification = cachedData.pages[0].notifications[0];
    const dataAge =
      Date.now() - new Date(newestNotification.indexedAt).getTime();
    const isStale = dataAge > 30 * 60 * 1000; // 30 minutes

    return isStale;
  }, [hasCachedData, cachedData]);

  const { data, fetchNextPage, refetch } = useInfiniteQuery({
    queryKey: ["notifications-extended"],
    queryFn: async ({ pageParam }) => {
      if (!agent) throw new Error("Not authenticated");
      const notificationService = getNotificationService(agent);
      const result = await notificationService.listNotifications(
        pageParam,
        false,
        100,
      );

      return result;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.cursor,
    maxPages: 10,
    enabled: enablePolling && !!agent, // Enable polling after initial load
    staleTime: 30 * 60 * 1000, // 30 minutes
    refetchInterval: enablePolling && isVisible ? 60 * 1000 : false, // Poll every 60 seconds when enabled and tab visible
  });

  // Initialize IndexedDB
  useEffect(() => {
    const initCache = async () => {
      try {
        await cacheService.init();
        setIsIndexedDBReady(true);
      } catch (error) {
        debug.error(
          "[BackgroundNotificationLoader] Failed to initialize IndexedDB:",
          error,
        );
        setIsIndexedDBReady(false);
      }
    };
    initCache();
  }, [cacheService]);

  // Load from IndexedDB on mount
  useEffect(() => {
    if (!session || (hasCachedData && !isCachedDataStale) || !isIndexedDBReady)
      return;

    const loadCachedData = async () => {
      const hasCached = await cacheService.hasCachedData();

      if (hasCached) {
        const cachedResult = await cacheService.getCachedNotifications(10000);

        if (cachedResult.notifications.length > 0) {
          const pages = [];
          const pageSize = 100;
          for (
            let i = 0;
            i < cachedResult.notifications.length;
            i += pageSize
          ) {
            const pageNotifications = cachedResult.notifications.slice(
              i,
              i + pageSize,
            );
            pages.push({
              notifications: pageNotifications,
              cursor:
                i + pageSize < cachedResult.notifications.length
                  ? `page-${i + pageSize}`
                  : undefined,
            });
          }

          queryClient.setQueryData(["notifications-extended"], {
            pages,
            pageParams: [
              undefined,
              ...pages.slice(0, -1).map((_, i) => `page-${(i + 1) * pageSize}`),
            ],
          });

          // Trigger re-render in components watching this data
          queryClient.invalidateQueries({
            queryKey: ["notifications-extended"],
            refetchType: "none", // Don't refetch, just notify subscribers
          });

          setHasFetched(true);

          // Enable polling after loading from cache
          setEnablePolling(true);

          // Prefetch posts for cached reply notifications in the background
          if (agent) {
            const replyNotifications = cachedResult.notifications.filter(
              (n) => n.reason === "reply",
            );
            if (replyNotifications.length > 0) {
              prefetchNotificationPosts(replyNotifications, agent)
                .then(() => {
                  return prefetchRootPosts(replyNotifications, agent);
                })
                .catch((error) => {
                  debug.error("Error prefetching posts:", error);
                });
            }
          }
        }
      }
    };

    loadCachedData();
  }, [
    session,
    agent,
    hasCachedData,
    isIndexedDBReady,
    queryClient,
    cacheService,
    isCachedDataStale,
  ]);

  // Auto-fetch 4 weeks if no data exists or data is stale
  useEffect(() => {
    if (
      !session ||
      !isIndexedDBReady ||
      hasFetched ||
      (hasCachedData && !isCachedDataStale) ||
      enablePolling
    )
      return;

    const fetchData = async () => {
      setHasFetched(true);

      // Enable the query first to allow manual fetching
      setEnablePolling(true);

      // Start fetching
      const initialResult = await refetch();
      if (!initialResult.isSuccess || !initialResult.data) return;

      const fourWeeksAgo = subDays(new Date(), 28);
      let shouldContinue = true;
      let currentPage = 1;
      // Continue fetching until we reach 4 weeks or 10 pages (whichever comes first)
      while (shouldContinue && currentPage < 10) {
        const result = await fetchNextPage();
        if (result.isError || !result.data) {
          break;
        }

        const latestData = result.data;
        if (latestData?.pages) {
          const allNotifications = latestData.pages.flatMap(
            (page) => page.notifications,
          );

          if (allNotifications.length > 0) {
            const oldestNotification =
              allNotifications[allNotifications.length - 1];
            const oldestDate = new Date(oldestNotification.indexedAt);

            if (oldestDate < fourWeeksAgo) {
              shouldContinue = false;
              break;
            }
          }

          const lastPage = latestData.pages[latestData.pages.length - 1];
          if (!lastPage.cursor) {
            shouldContinue = false;
            break;
          }
        }

        currentPage++;
      }

      // Save to IndexedDB
      const finalData = queryClient.getQueryData([
        "notifications-extended",
      ]) as any;
      if (finalData?.pages && isIndexedDBReady) {
        for (let i = 0; i < finalData.pages.length; i++) {
          const page = finalData.pages[i];
          await cacheService.cacheNotifications(page.notifications, i + 1);
        }

        const allNotifications = finalData.pages.flatMap(
          (page: any) => page.notifications,
        );
        if (allNotifications.length > 0) {
          const oldestDate = new Date(
            allNotifications[allNotifications.length - 1].indexedAt,
          );
          const newestDate = new Date(allNotifications[0].indexedAt);
          const daysReached = Math.floor(
            (new Date().getTime() - oldestDate.getTime()) /
              (1000 * 60 * 60 * 24),
          );

          ExtendedFetchCache.saveMetadata(
            allNotifications.length,
            oldestDate,
            newestDate,
            daysReached,
          );

          // Prefetch posts for reply notifications
          if (agent) {
            const replyNotifications = allNotifications.filter(
              (n: Notification) => n.reason === "reply",
            );
            if (replyNotifications.length > 0) {
              await prefetchNotificationPosts(replyNotifications, agent);
              await prefetchRootPosts(replyNotifications, agent);
            }
          }
        }
      }

      // Invalidate analytics queries
      queryClient.invalidateQueries({ queryKey: ["notifications-analytics"] });

      queryClient.invalidateQueries({
        queryKey: ["notifications-visual-timeline"],
      });
    };

    // Small delay to let component settle
    const timer = setTimeout(fetchData, 1000);
    return () => clearTimeout(timer);
  }, [
    session,
    agent,
    isIndexedDBReady,
    hasFetched,
    hasCachedData,
    enablePolling,
    refetch,
    fetchNextPage,
    queryClient,
    cacheService,
    isCachedDataStale,
  ]);

  // Save new notifications to IndexedDB when data changes (from polling)
  useEffect(() => {
    if (!data?.pages || !isIndexedDBReady || !enablePolling) return;

    const saveNewNotifications = async () => {
      // Get all notifications from the query data
      const allNotifications = data.pages.flatMap(
        (page: any) => page.notifications,
      );

      if (allNotifications.length > 0) {
        // Save to IndexedDB (it will handle deduplication)
        for (let i = 0; i < data.pages.length; i++) {
          const page = data.pages[i];
          await cacheService.cacheNotifications(page.notifications, i + 1);
        }

        // Update metadata
        const oldestDate = new Date(
          allNotifications[allNotifications.length - 1].indexedAt,
        );
        const newestDate = new Date(allNotifications[0].indexedAt);
        const daysReached = Math.floor(
          (new Date().getTime() - oldestDate.getTime()) / (1000 * 60 * 60 * 24),
        );

        ExtendedFetchCache.saveMetadata(
          allNotifications.length,
          oldestDate,
          newestDate,
          daysReached,
        );

        // Prefetch posts for new reply notifications
        if (agent) {
          const replyNotifications = allNotifications.filter(
            (n: Notification) => n.reason === "reply",
          );
          if (replyNotifications.length > 0) {
            await prefetchNotificationPosts(replyNotifications, agent);
            await prefetchRootPosts(replyNotifications, agent);
          }
        }

        // Trigger re-render in components watching this data
        queryClient.invalidateQueries({
          queryKey: ["notifications-extended"],
          refetchType: "none", // Don't refetch, just notify subscribers
        });
      }
    };

    saveNewNotifications();
  }, [data, isIndexedDBReady, enablePolling, cacheService, queryClient, agent]);

  // No UI - just background loading
  return null;
};
