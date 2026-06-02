import { useQuery } from "@tanstack/react-query";
import React from "react";
import { useAuth } from "../contexts/AuthContext";
import { usePageVisibility } from "../hooks/usePageVisibility";
import { createLogger } from "../utils/logger";

const logger = createLogger("VisualTimeline");

/**
 * Notification data layer for VisualTimeline: initial load, infinite-scroll
 * pagination, background new-notification polling, and refresh-with-prepend.
 *
 * Extracted from VisualTimeline to keep the component focused on layout/render.
 * DOM-free: pass `scrollToTop` so refresh can scroll the right container.
 */
export function useVisualTimelineNotifications(scrollToTop?: () => void) {
  const { agent } = useAuth();
  const isVisible = usePageVisibility();

  const [cursor, setCursor] = React.useState<string | undefined>(undefined);
  const [allNotifications, setAllNotifications] = React.useState<any[]>([]);
  const [hasMore, setHasMore] = React.useState(true);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [hasNewNotifications, setHasNewNotifications] = React.useState(false);
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  // Initial load query
  const { data, isLoading } = useQuery({
    queryKey: ["notifications-visual-timeline", "initial"],
    queryFn: async () => {
      if (!agent) throw new Error("Not authenticated");
      const response = await agent.listNotifications({ limit: 50 });
      return response.data;
    },
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnMount: false, // Don't refetch on mount - use stale time instead
    refetchInterval: isVisible ? 60 * 1000 : false, // Poll every 60s, paused when hidden
    enabled: !!agent,
  });

  // Update state when initial data loads
  React.useEffect(() => {
    if (data) {
      setAllNotifications(data.notifications || []);
      setCursor(data.cursor);
      setHasMore(!!data.cursor);
    }
  }, [data]);

  // Periodically check for new notifications
  React.useEffect(() => {
    if (!agent || allNotifications.length === 0) return;

    const checkForNew = async () => {
      try {
        const response = await agent.listNotifications({ limit: 1 });
        if (response.data.notifications?.[0]) {
          const latestNotification = response.data.notifications[0];
          const currentLatest = allNotifications[0];

          if (latestNotification.uri !== currentLatest.uri) {
            setHasNewNotifications(true);
          }
        }
      } catch (_error) {
        // Silently fail - this is just a background check
      }
    };

    const interval = setInterval(checkForNew, 30000);
    return () => clearInterval(interval);
  }, [agent, allNotifications]);

  // Load more (infinite scroll)
  const loadMore = React.useCallback(async () => {
    if (!agent || !cursor || isLoadingMore || !hasMore) {
      return;
    }

    setIsLoadingMore(true);
    try {
      const response = await agent.listNotifications({
        limit: 50,
        cursor: cursor,
      });

      if (
        response.data.notifications &&
        response.data.notifications.length > 0
      ) {
        const newNotifications = response.data.notifications;
        setAllNotifications((prev) => [...prev, ...newNotifications]);
        setCursor(response.data.cursor);
        setHasMore(!!response.data.cursor);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      logger.error("Error loading more notifications:", error);
      setHasMore(false);
    } finally {
      setIsLoadingMore(false);
    }
  }, [agent, cursor, isLoadingMore, hasMore]);

  // Refresh: prepend any new notifications and scroll to top
  const refresh = React.useCallback(async () => {
    if (!agent || isRefreshing) return;

    setIsRefreshing(true);
    setHasNewNotifications(false);

    try {
      const response = await agent.listNotifications({ limit: 50 });

      if (response.data.notifications) {
        const latestNotification = response.data.notifications[0];
        const currentLatest = allNotifications[0];

        if (
          latestNotification &&
          currentLatest &&
          latestNotification.uri !== currentLatest.uri
        ) {
          const existingIndex = response.data.notifications.findIndex((n) =>
            allNotifications.some((existing) => existing.uri === n.uri),
          );

          if (existingIndex > 0) {
            const newNotifications = response.data.notifications.slice(
              0,
              existingIndex,
            );
            setAllNotifications((prev) => [...newNotifications, ...prev]);
            scrollToTop?.();
          } else if (existingIndex === -1) {
            setAllNotifications(response.data.notifications);
            setCursor(response.data.cursor);
            setHasMore(!!response.data.cursor);
          }
        }
      }
    } catch (error) {
      logger.error("Error refreshing notifications:", error);
    } finally {
      setIsRefreshing(false);
    }
  }, [agent, allNotifications, isRefreshing, scrollToTop]);

  return {
    notifications: allNotifications,
    isLoading,
    loadMore,
    hasMore,
    isLoadingMore,
    hasNewNotifications,
    refresh,
    isRefreshing,
  };
}
