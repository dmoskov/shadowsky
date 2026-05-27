import type { AppBskyNotificationListNotifications } from "@atproto/api";
import { debug } from "@bsky/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BatchedNotificationUpdate,
  NotificationBatchingConfig,
  NotificationBatchingService,
} from "../services/notification-batching-service";

export interface UseNotificationBatchingOptions {
  enabled?: boolean;
  config?: Partial<NotificationBatchingConfig>;
  onBatchUpdate?: (update: BatchedNotificationUpdate) => void;
}

export interface UseNotificationBatchingResult {
  batchedNotifications: AppBskyNotificationListNotifications.Notification[];
  pendingCount: number;
  isBatching: boolean;
  lastBatchUpdate: BatchedNotificationUpdate | null;
  processNotifications: (notifications: AppBskyNotificationListNotifications.Notification[]) => void;
  getGroupedNotifications: () => Map<string, AppBskyNotificationListNotifications.Notification[]>;
  stats: {
    totalProcessed: number;
    batchCount: number;
    averageBatchSize: number;
    lastUpdateTime: number;
  };
}

export function useNotificationBatching(
  sourceNotifications: AppBskyNotificationListNotifications.Notification[],
  options: UseNotificationBatchingOptions = {},
): UseNotificationBatchingResult {
  const { enabled = true, config, onBatchUpdate } = options;

  const [batchedNotifications, setBatchedNotifications] = useState<
    AppBskyNotificationListNotifications.Notification[]
  >([]);
  const [lastBatchUpdate, setLastBatchUpdate] =
    useState<BatchedNotificationUpdate | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [isBatching, setIsBatching] = useState(false);

  const statsRef = useRef({
    totalProcessed: 0,
    batchCount: 0,
    totalBatchSize: 0,
    lastUpdateTime: 0,
  });

  const previousNotificationsRef = useRef<string | null>(null);
  const serviceRef = useRef<NotificationBatchingService | null>(null);

  useEffect(() => {
    if (!enabled) {
      serviceRef.current = null;
      return;
    }

    serviceRef.current = NotificationBatchingService.getInstance(config);

    const unsubscribe = serviceRef.current.subscribe((update) => {
      debug.log(
        `[useNotificationBatching] Received batch update: ${update.batchId}`,
      );

      setBatchedNotifications(update.notifications);
      setLastBatchUpdate(update);
      setPendingCount(0);
      setIsBatching(false);

      statsRef.current.batchCount++;
      statsRef.current.totalBatchSize += update.notifications.length;
      statsRef.current.totalProcessed += update.added.length;
      statsRef.current.lastUpdateTime = update.timestamp;

      onBatchUpdate?.(update);
    });

    return () => {
      unsubscribe();
    };
  }, [enabled, config, onBatchUpdate]);

  useEffect(() => {
    if (!enabled || !serviceRef.current || sourceNotifications.length === 0) {
      if (sourceNotifications.length > 0) {
        setBatchedNotifications(sourceNotifications);
      }
      return;
    }

    const currentSignature = sourceNotifications
      .slice(0, 10)
      .map((n) => `${n.uri}-${n.indexedAt}`)
      .join("|");

    if (currentSignature === previousNotificationsRef.current) {
      return;
    }

    previousNotificationsRef.current = currentSignature;

    debug.log(
      `[useNotificationBatching] Processing ${sourceNotifications.length} notifications`,
    );

    const update = serviceRef.current.processFullUpdate(sourceNotifications);
    setBatchedNotifications(update.notifications);
    setLastBatchUpdate(update);

    statsRef.current.batchCount++;
    statsRef.current.totalBatchSize += update.notifications.length;
    statsRef.current.totalProcessed = sourceNotifications.length;
    statsRef.current.lastUpdateTime = update.timestamp;
  }, [sourceNotifications, enabled]);

  useEffect(() => {
    if (!enabled || !serviceRef.current) {
      // Clear state when disabled
      setPendingCount(0);
      setIsBatching(false);
      return;
    }

    const interval = setInterval(() => {
      // Check if service still exists before accessing
      if (serviceRef.current) {
        setPendingCount(serviceRef.current.getPendingCount());
        setIsBatching(serviceRef.current.isBatchingActive());
      }
    }, 500);

    return () => {
      clearInterval(interval);
      // Clean up state on unmount
      setPendingCount(0);
      setIsBatching(false);
    };
  }, [enabled]);

  const processNotifications = useCallback(
    (notifications: AppBskyNotificationListNotifications.Notification[]) => {
      if (!enabled || !serviceRef.current) {
        setBatchedNotifications(notifications);
        return;
      }

      serviceRef.current.queueNotifications(notifications);
      setPendingCount(serviceRef.current.getPendingCount());
      setIsBatching(true);
    },
    [enabled],
  );

  const getGroupedNotifications = useCallback(() => {
    if (!serviceRef.current) {
      const defaultMap = new Map<string, AppBskyNotificationListNotifications.Notification[]>();
      defaultMap.set("all", batchedNotifications);
      return defaultMap;
    }

    return serviceRef.current.groupNotificationsByType(batchedNotifications);
  }, [batchedNotifications]);

  const stats = useMemo(
    () => ({
      totalProcessed: statsRef.current.totalProcessed,
      batchCount: statsRef.current.batchCount,
      averageBatchSize:
        statsRef.current.batchCount > 0
          ? Math.round(
              statsRef.current.totalBatchSize / statsRef.current.batchCount,
            )
          : 0,
      lastUpdateTime: statsRef.current.lastUpdateTime,
    }),
    [lastBatchUpdate],
  );

  return {
    batchedNotifications,
    pendingCount,
    isBatching,
    lastBatchUpdate,
    processNotifications,
    getGroupedNotifications,
    stats,
  };
}

export function useBatchedNotificationTransition(
  notifications: AppBskyNotificationListNotifications.Notification[],
  options: {
    transitionDuration?: number;
    enableAnimation?: boolean;
  } = {},
): {
  displayNotifications: AppBskyNotificationListNotifications.Notification[];
  isTransitioning: boolean;
  newNotificationIds: Set<string>;
} {
  const { transitionDuration = 300, enableAnimation = true } = options;

  const [displayNotifications, setDisplayNotifications] =
    useState<AppBskyNotificationListNotifications.Notification[]>(notifications);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [newNotificationIds, setNewNotificationIds] = useState<Set<string>>(
    new Set(),
  );

  const previousIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const currentIds = new Set(
      notifications.map((n) => `${n.uri}-${n.indexedAt}`),
    );

    const newIds = new Set<string>();
    currentIds.forEach((id) => {
      if (!previousIdsRef.current.has(id)) {
        newIds.add(id);
      }
    });

    if (newIds.size > 0 && enableAnimation) {
      setIsTransitioning(true);
      setNewNotificationIds(newIds);

      const timer = setTimeout(() => {
        setIsTransitioning(false);
        setNewNotificationIds(new Set());
      }, transitionDuration);

      setDisplayNotifications(notifications);
      previousIdsRef.current = currentIds;

      return () => clearTimeout(timer);
    } else {
      setDisplayNotifications(notifications);
      previousIdsRef.current = currentIds;
    }
  }, [notifications, transitionDuration, enableAnimation]);

  return {
    displayNotifications,
    isTransitioning,
    newNotificationIds,
  };
}
