/**
 * useGroupedNotifications Hook
 *
 * React hook for managing grouped and threaded notifications with support for:
 * - Smart aggregation (likes, follows, reposts grouped together)
 * - DM conversation threading
 * - Rich notification content
 * - Inline actions
 */

import type { AppBskyNotificationListNotifications } from "@atproto/api";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  type AggregationConfig,
  DEFAULT_AGGREGATION_CONFIG,
  type GroupedNotification,
  notificationGroupingService,
} from "../services/notification-grouping-service";
import { pushNotificationService } from "../services/push-notification-service";
import type { PushNotificationSettings } from "../types/push-notifications";
import { createLogger } from "../utils/logger";
import { useNotifications } from "./useNotifications";

const logger = createLogger("useGroupedNotifications");

type Notification = AppBskyNotificationListNotifications.Notification;

interface UseGroupedNotificationsReturn {
  /** Grouped notifications */
  groupedNotifications: GroupedNotification[];
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
  /** Whether there are more notifications to load */
  hasMore: boolean;
  /** Load more notifications */
  fetchMore: () => void;
  /** Is fetching more notifications */
  isFetchingMore: boolean;
  /** Mark a group as read */
  markGroupAsRead: (groupId: string) => void;
  /** Dismiss a group */
  dismissGroup: (groupId: string) => void;
  /** Refresh notifications */
  refresh: () => Promise<void>;
  /** Total notification count */
  totalCount: number;
  /** Unread count */
  unreadCount: number;
  /** Update aggregation config */
  setAggregationConfig: (config: Partial<AggregationConfig>) => void;
  /** Current aggregation config */
  aggregationConfig: AggregationConfig;
}

/**
 * Hook for managing grouped notifications
 */
export function useGroupedNotifications(): UseGroupedNotificationsReturn {
  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useNotifications();

  const [aggregationConfig, setAggregationConfigState] =
    useState<AggregationConfig>(DEFAULT_AGGREGATION_CONFIG);
  const [dismissedGroups, setDismissedGroups] = useState<Set<string>>(
    new Set(),
  );

  // Sync aggregation config with push notification settings
  useEffect(() => {
    const syncConfig = async () => {
      try {
        const settings = pushNotificationService.getSettings();
        updateConfigFromSettings(settings);
      } catch (err) {
        logger.error("Failed to sync aggregation config:", err);
      }
    };

    syncConfig();
  }, []);

  const updateConfigFromSettings = (settings: PushNotificationSettings) => {
    const newConfig: Partial<AggregationConfig> = {
      timeWindowMs: settings.aggregationWindowHours * 60 * 60 * 1000,
      enableDmThreading: settings.threadDmNotifications,
    };

    notificationGroupingService.setConfig(newConfig);
    setAggregationConfigState(notificationGroupingService.getConfig());
  };

  // Extract all notifications from paginated data
  const allNotifications = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((page) => page.notifications || []);
  }, [data?.pages]);

  // Group notifications using the grouping service
  const groupedNotifications = useMemo(() => {
    if (!allNotifications.length) return [];

    const grouped = notificationGroupingService.groupNotifications(
      allNotifications as Notification[],
    );

    // Filter out dismissed groups
    return grouped.filter((group) => !dismissedGroups.has(group.id));
  }, [allNotifications, dismissedGroups]);

  // Calculate total and unread counts
  const totalCount = allNotifications.length;
  const unreadCount = useMemo(() => {
    return groupedNotifications.reduce((count, group) => {
      return count + (group.isRead ? 0 : group.count);
    }, 0);
  }, [groupedNotifications]);

  // Mark a group as read
  const markGroupAsRead = useCallback((groupId: string) => {
    // In a real implementation, this would call the API to mark notifications as read
    // For now, we just update the local state
    logger.info("Marking group as read:", groupId);
  }, []);

  // Dismiss a group
  const dismissGroup = useCallback((groupId: string) => {
    setDismissedGroups((prev) => new Set([...prev, groupId]));
  }, []);

  // Refresh notifications
  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  // Fetch more notifications
  const fetchMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Update aggregation config
  const setAggregationConfig = useCallback(
    (config: Partial<AggregationConfig>) => {
      notificationGroupingService.setConfig(config);
      setAggregationConfigState(notificationGroupingService.getConfig());
    },
    [],
  );

  return {
    groupedNotifications,
    isLoading,
    error: error as Error | null,
    hasMore: hasNextPage ?? false,
    fetchMore,
    isFetchingMore: isFetchingNextPage,
    markGroupAsRead,
    dismissGroup,
    refresh,
    totalCount,
    unreadCount,
    setAggregationConfig,
    aggregationConfig,
  };
}

/**
 * Hook for DM-specific grouped notifications
 */
export function useDmThreadedNotifications() {
  const { groupedNotifications, ...rest } = useGroupedNotifications();

  // Filter to only DM notifications and group by conversation
  const dmThreads = useMemo(() => {
    return groupedNotifications.filter((group) => group.type === "dm_thread");
  }, [groupedNotifications]);

  return {
    dmThreads,
    ...rest,
  };
}

/**
 * Hook for getting notification counts by type
 */
export function useNotificationCounts() {
  const { groupedNotifications } = useGroupedNotifications();

  const counts = useMemo(() => {
    const result: Record<string, { total: number; unread: number }> = {
      all: { total: 0, unread: 0 },
      likes: { total: 0, unread: 0 },
      reposts: { total: 0, unread: 0 },
      follows: { total: 0, unread: 0 },
      mentions: { total: 0, unread: 0 },
      replies: { total: 0, unread: 0 },
      quotes: { total: 0, unread: 0 },
      dm_thread: { total: 0, unread: 0 },
    };

    for (const group of groupedNotifications) {
      const type = group.type === "single" ? group.reason + "s" : group.type;
      if (result[type]) {
        result[type].total += group.count;
        if (!group.isRead) {
          result[type].unread += group.count;
        }
      }
      result.all.total += group.count;
      if (!group.isRead) {
        result.all.unread += group.count;
      }
    }

    return result;
  }, [groupedNotifications]);

  return counts;
}

export default useGroupedNotifications;
