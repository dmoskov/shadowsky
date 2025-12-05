import type { Notification } from "@atproto/api/dist/client/types/app/bsky/notification/listNotifications";
import { debug } from "@bsky/shared";

export interface BatchedNotificationUpdate {
  notifications: Notification[];
  added: Notification[];
  removed: string[];
  updatedCount: number;
  batchId: string;
  timestamp: number;
}

export interface NotificationBatchingConfig {
  batchWindowMs: number;
  maxBatchSize: number;
  enableGrouping: boolean;
  groupingTypes: string[];
}

const DEFAULT_CONFIG: NotificationBatchingConfig = {
  batchWindowMs: 5000, // 5-second batching window
  maxBatchSize: 100, // Maximum notifications per batch
  enableGrouping: true,
  groupingTypes: [
    "like",
    "repost",
    "follow",
    "quote",
    "starterpack-joined",
    "like-via-repost",
    "repost-via-repost",
  ],
};

type BatchListener = (update: BatchedNotificationUpdate) => void;

export class NotificationBatchingService {
  private static instance: NotificationBatchingService;
  private config: NotificationBatchingConfig;
  private pendingNotifications: Map<string, Notification> = new Map();
  private currentNotifications: Map<string, Notification> = new Map();
  private batchTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners: Set<BatchListener> = new Set();
  private batchCounter = 0;
  private lastBatchTime = 0;
  private isBatching = false;

  private constructor(config: Partial<NotificationBatchingConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  static getInstance(
    config?: Partial<NotificationBatchingConfig>,
  ): NotificationBatchingService {
    if (!NotificationBatchingService.instance) {
      NotificationBatchingService.instance = new NotificationBatchingService(
        config,
      );
    }
    return NotificationBatchingService.instance;
  }

  static resetInstance(): void {
    if (NotificationBatchingService.instance) {
      NotificationBatchingService.instance.cleanup();
      NotificationBatchingService.instance =
        undefined as unknown as NotificationBatchingService;
    }
  }

  subscribe(listener: BatchListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(update: BatchedNotificationUpdate): void {
    this.listeners.forEach((listener) => {
      try {
        listener(update);
      } catch (error) {
        debug.error("Error in notification batch listener:", error);
      }
    });
  }

  private getNotificationKey(notification: Notification): string {
    return `${notification.uri}-${notification.indexedAt}`;
  }

  queueNotifications(notifications: Notification[]): void {
    if (notifications.length === 0) return;

    const now = Date.now();

    notifications.forEach((notification) => {
      const key = this.getNotificationKey(notification);
      this.pendingNotifications.set(key, notification);
    });

    debug.log(
      `[NotificationBatching] Queued ${notifications.length} notifications, pending: ${this.pendingNotifications.size}`,
    );

    if (!this.isBatching) {
      this.startBatchWindow();
    } else {
      if (
        this.pendingNotifications.size >= this.config.maxBatchSize ||
        now - this.lastBatchTime > this.config.batchWindowMs * 2
      ) {
        this.flushBatch();
      }
    }
  }

  private startBatchWindow(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }

    this.isBatching = true;
    this.lastBatchTime = Date.now();

    this.batchTimer = setTimeout(() => {
      this.flushBatch();
    }, this.config.batchWindowMs);

    debug.log(
      `[NotificationBatching] Started batch window (${this.config.batchWindowMs}ms)`,
    );
  }

  private flushBatch(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    this.isBatching = false;

    if (this.pendingNotifications.size === 0) {
      debug.log("[NotificationBatching] No pending notifications to flush");
      return;
    }

    const batchId = `batch-${++this.batchCounter}-${Date.now()}`;
    const pendingArray = Array.from(this.pendingNotifications.values());

    const added: Notification[] = [];
    const updated: Notification[] = [];

    pendingArray.forEach((notification) => {
      const key = this.getNotificationKey(notification);
      if (this.currentNotifications.has(key)) {
        updated.push(notification);
      } else {
        added.push(notification);
      }
      this.currentNotifications.set(key, notification);
    });

    const allNotifications = this.getSortedNotifications();

    const update: BatchedNotificationUpdate = {
      notifications: allNotifications,
      added,
      removed: [],
      updatedCount: updated.length,
      batchId,
      timestamp: Date.now(),
    };

    debug.log(
      `[NotificationBatching] Flushing batch ${batchId}: ${added.length} added, ${updated.length} updated, ${allNotifications.length} total`,
    );

    this.pendingNotifications.clear();

    this.notifyListeners(update);
  }

  processFullUpdate(notifications: Notification[]): BatchedNotificationUpdate {
    const batchId = `full-${++this.batchCounter}-${Date.now()}`;

    const newKeys = new Set(
      notifications.map((n) => this.getNotificationKey(n)),
    );

    const added: Notification[] = [];
    const removed: string[] = [];

    notifications.forEach((notification) => {
      const key = this.getNotificationKey(notification);
      if (!this.currentNotifications.has(key)) {
        added.push(notification);
      }
    });

    this.currentNotifications.forEach((_, key) => {
      if (!newKeys.has(key)) {
        removed.push(key);
      }
    });

    this.currentNotifications.clear();
    notifications.forEach((notification) => {
      const key = this.getNotificationKey(notification);
      this.currentNotifications.set(key, notification);
    });

    const update: BatchedNotificationUpdate = {
      notifications,
      added,
      removed,
      updatedCount: 0,
      batchId,
      timestamp: Date.now(),
    };

    debug.log(
      `[NotificationBatching] Full update ${batchId}: ${added.length} added, ${removed.length} removed, ${notifications.length} total`,
    );

    return update;
  }

  private getSortedNotifications(): Notification[] {
    return Array.from(this.currentNotifications.values()).sort(
      (a, b) =>
        new Date(b.indexedAt).getTime() - new Date(a.indexedAt).getTime(),
    );
  }

  groupNotificationsByType(
    notifications: Notification[],
  ): Map<string, Notification[]> {
    const groups = new Map<string, Notification[]>();

    if (!this.config.enableGrouping) {
      groups.set("all", notifications);
      return groups;
    }

    notifications.forEach((notification) => {
      const reason = notification.reason;

      if (this.config.groupingTypes.includes(reason)) {
        const key =
          reason === "follow"
            ? "follow"
            : `${reason}-${notification.reasonSubject || notification.uri}`;

        if (!groups.has(key)) {
          groups.set(key, []);
        }
        groups.get(key)!.push(notification);
      } else {
        const individualKey = this.getNotificationKey(notification);
        groups.set(individualKey, [notification]);
      }
    });

    return groups;
  }

  getGroupedCounts(
    notifications: Notification[],
  ): Map<string, { count: number; latestTimestamp: string }> {
    const groups = this.groupNotificationsByType(notifications);
    const counts = new Map<string, { count: number; latestTimestamp: string }>();

    groups.forEach((groupNotifications, key) => {
      const sorted = groupNotifications.sort(
        (a, b) =>
          new Date(b.indexedAt).getTime() - new Date(a.indexedAt).getTime(),
      );

      counts.set(key, {
        count: groupNotifications.length,
        latestTimestamp: sorted[0]?.indexedAt || new Date().toISOString(),
      });
    });

    return counts;
  }

  getCurrentNotifications(): Notification[] {
    return this.getSortedNotifications();
  }

  getPendingCount(): number {
    return this.pendingNotifications.size;
  }

  isBatchingActive(): boolean {
    return this.isBatching;
  }

  getConfig(): NotificationBatchingConfig {
    return { ...this.config };
  }

  updateConfig(config: Partial<NotificationBatchingConfig>): void {
    this.config = { ...this.config, ...config };
  }

  cleanup(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    this.pendingNotifications.clear();
    this.currentNotifications.clear();
    this.listeners.clear();
    this.isBatching = false;
  }

  getStats(): {
    pendingCount: number;
    currentCount: number;
    listenerCount: number;
    isBatching: boolean;
    batchCounter: number;
    config: NotificationBatchingConfig;
  } {
    return {
      pendingCount: this.pendingNotifications.size,
      currentCount: this.currentNotifications.size,
      listenerCount: this.listeners.size,
      isBatching: this.isBatching,
      batchCounter: this.batchCounter,
      config: this.getConfig(),
    };
  }
}
