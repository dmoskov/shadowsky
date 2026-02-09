import { debug } from "@bsky/shared";
import { NotificationStorageDB } from "./notification-storage-db";

/**
 * IndexedDB Cleanup Service
 * Manages IndexedDB storage to prevent quota issues on mobile browsers.
 *
 * Features:
 * - Proactive cleanup on app start
 * - Size monitoring and warnings
 * - LRU eviction for oldest entries
 * - Graceful quota exceeded error handling
 *
 * Target: Keep IndexedDB under 50MB
 * Default retention: 4 weeks (28 days)
 */

export interface StorageStats {
  usage: number; // bytes
  quota: number; // bytes
  usagePercent: number;
  databases: {
    name: string;
    estimatedSize: number;
  }[];
}

export interface CleanupResult {
  deletedCount: number;
  freedBytes: number;
  duration: number;
}

const SIZE_WARNING_THRESHOLD = 40 * 1024 * 1024; // 40MB
const SIZE_CRITICAL_THRESHOLD = 50 * 1024 * 1024; // 50MB
const DEFAULT_RETENTION_DAYS = 28; // 4 weeks
const CLEANUP_BATCH_SIZE = 100;

export class IndexedDBCleanupService {
  private static instance: IndexedDBCleanupService;
  private notificationDB: NotificationStorageDB;
  private lastCleanup: number = 0;
  private cleanupInProgress: boolean = false;

  private constructor() {
    this.notificationDB = NotificationStorageDB.getInstance();
  }

  static getInstance(): IndexedDBCleanupService {
    if (!IndexedDBCleanupService.instance) {
      IndexedDBCleanupService.instance = new IndexedDBCleanupService();
    }
    return IndexedDBCleanupService.instance;
  }

  /**
   * Get current storage usage statistics
   */
  async getStorageStats(): Promise<StorageStats | null> {
    if (!navigator.storage || !navigator.storage.estimate) {
      debug.log("Storage API not available");
      return null;
    }

    try {
      const estimate = await navigator.storage.estimate();
      const usage = estimate.usage || 0;
      const quota = estimate.quota || 0;
      const usagePercent = quota > 0 ? (usage / quota) * 100 : 0;

      // Get individual database sizes (estimates)
      const databases = await this.estimateDatabaseSizes();

      return {
        usage,
        quota,
        usagePercent,
        databases,
      };
    } catch (error) {
      debug.error("Failed to get storage stats:", error);
      return null;
    }
  }

  /**
   * Estimate sizes of individual databases
   */
  private async estimateDatabaseSizes(): Promise<
    { name: string; estimatedSize: number }[]
  > {
    const databases = [
      "bsky_notifications_db",
      "BskyPostCache",
      "BskyOfflineStorage",
      "BlueskyFollowerCache",
      "bsky_media_cache_db",
      "BlueskySearchHistory",
    ];

    const sizes: { name: string; estimatedSize: number }[] = [];

    for (const dbName of databases) {
      try {
        const size = await this.estimateDatabaseSize(dbName);
        sizes.push({ name: dbName, estimatedSize: size });
      } catch (error) {
        debug.error(`Failed to estimate size for ${dbName}:`, error);
      }
    }

    return sizes;
  }

  /**
   * Estimate size of a single database by counting records
   * This is a rough estimate based on record counts
   */
  private async estimateDatabaseSize(dbName: string): Promise<number> {
    return new Promise((resolve) => {
      const request = indexedDB.open(dbName);

      request.onerror = () => resolve(0);

      request.onsuccess = () => {
        const db = request.result;
        let totalRecords = 0;

        try {
          const storeNames = Array.from(db.objectStoreNames);
          let completed = 0;

          if (storeNames.length === 0) {
            db.close();
            resolve(0);
            return;
          }

          for (const storeName of storeNames) {
            const tx = db.transaction(storeName, "readonly");
            const store = tx.objectStore(storeName);
            const countRequest = store.count();

            countRequest.onsuccess = () => {
              totalRecords += countRequest.result;
              completed++;

              if (completed === storeNames.length) {
                db.close();
                // Rough estimate: 1KB per record average
                resolve(totalRecords * 1024);
              }
            };

            countRequest.onerror = () => {
              completed++;
              if (completed === storeNames.length) {
                db.close();
                resolve(totalRecords * 1024);
              }
            };
          }
        } catch (error) {
          db.close();
          resolve(0);
        }
      };
    });
  }

  /**
   * Check if storage is over warning threshold
   */
  async isStorageWarning(): Promise<boolean> {
    const stats = await this.getStorageStats();
    return stats ? stats.usage >= SIZE_WARNING_THRESHOLD : false;
  }

  /**
   * Check if storage is over critical threshold
   */
  async isStorageCritical(): Promise<boolean> {
    const stats = await this.getStorageStats();
    return stats ? stats.usage >= SIZE_CRITICAL_THRESHOLD : false;
  }

  /**
   * Run proactive cleanup on app start
   * This should be called during app initialization
   */
  async runStartupCleanup(): Promise<CleanupResult | null> {
    debug.log("🧹 Running startup cleanup...");

    try {
      // Check if we need cleanup
      const stats = await this.getStorageStats();
      if (!stats) {
        debug.log("Cannot determine storage stats, skipping cleanup");
        return null;
      }

      debug.log(
        `Current storage: ${(stats.usage / 1024 / 1024).toFixed(2)}MB / ${(stats.quota / 1024 / 1024).toFixed(2)}MB (${stats.usagePercent.toFixed(1)}%)`,
      );

      // Log individual database sizes
      for (const db of stats.databases) {
        debug.log(
          `  ${db.name}: ~${(db.estimatedSize / 1024 / 1024).toFixed(2)}MB`,
        );
      }

      // Only run cleanup if we're over warning threshold
      if (stats.usage < SIZE_WARNING_THRESHOLD) {
        debug.log("✅ Storage usage is healthy, no cleanup needed");
        return null;
      }

      debug.log("⚠️ Storage usage is high, running cleanup...");

      // Clean up old notifications
      const result = await this.cleanupOldNotifications(DEFAULT_RETENTION_DAYS);

      debug.log(
        `✅ Cleanup completed: Deleted ${result.deletedCount} notifications in ${result.duration}ms`,
      );

      return result;
    } catch (error) {
      debug.error("Failed to run startup cleanup:", error);
      return null;
    }
  }

  /**
   * Clean up notifications older than the specified number of days
   * Uses LRU eviction strategy (oldest first)
   */
  async cleanupOldNotifications(
    retentionDays: number = DEFAULT_RETENTION_DAYS,
  ): Promise<CleanupResult> {
    if (this.cleanupInProgress) {
      debug.log("Cleanup already in progress, skipping");
      return { deletedCount: 0, freedBytes: 0, duration: 0 };
    }

    this.cleanupInProgress = true;
    const startTime = performance.now();

    try {
      await this.notificationDB.init();

      // Calculate cutoff date
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      debug.log(
        `Deleting notifications older than ${cutoffDate.toLocaleDateString()}`,
      );

      // Get all notifications to filter by date
      const allNotifications = await this.getAllNotificationsForCleanup();
      const notificationsToDelete = allNotifications.filter((notification) => {
        const notificationDate = new Date(notification.indexedAt);
        return notificationDate < cutoffDate;
      });

      debug.log(
        `Found ${notificationsToDelete.length} notifications to delete out of ${allNotifications.length} total`,
      );

      if (notificationsToDelete.length === 0) {
        const duration = performance.now() - startTime;
        this.lastCleanup = Date.now();
        return { deletedCount: 0, freedBytes: 0, duration };
      }

      // Delete in batches to avoid blocking
      let deletedCount = 0;
      for (
        let i = 0;
        i < notificationsToDelete.length;
        i += CLEANUP_BATCH_SIZE
      ) {
        const batch = notificationsToDelete.slice(i, i + CLEANUP_BATCH_SIZE);
        await this.deleteNotificationBatch(batch);
        deletedCount += batch.length;

        // Log progress
        if (deletedCount % 500 === 0) {
          debug.log(`Deleted ${deletedCount} notifications...`);
        }
      }

      // Estimate freed bytes (rough estimate: 1KB per notification)
      const freedBytes = deletedCount * 1024;

      const duration = performance.now() - startTime;
      this.lastCleanup = Date.now();

      return { deletedCount, freedBytes, duration };
    } catch (error) {
      debug.error("Failed to cleanup old notifications:", error);
      throw error;
    } finally {
      this.cleanupInProgress = false;
    }
  }

  /**
   * Get all notifications for cleanup (optimized query)
   */
  private async getAllNotificationsForCleanup(): Promise<
    Array<{ uri: string; indexedAt: string }>
  > {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("bsky_notifications_db", 3);

      request.onerror = () => reject(request.error);

      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(["notifications"], "readonly");
        const store = transaction.objectStore("notifications");
        const index = store.index("by_indexed_at");

        const notifications: Array<{ uri: string; indexedAt: string }> = [];

        const cursorRequest = index.openCursor(null, "next");

        cursorRequest.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;

          if (cursor) {
            notifications.push({
              uri: cursor.value.uri,
              indexedAt: cursor.value.indexedAt,
            });
            cursor.continue();
          } else {
            db.close();
            resolve(notifications);
          }
        };

        cursorRequest.onerror = () => {
          db.close();
          reject(cursorRequest.error);
        };
      };
    });
  }

  /**
   * Delete a batch of notifications by URI
   */
  private async deleteNotificationBatch(
    notifications: Array<{ uri: string; indexedAt: string }>,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("bsky_notifications_db", 3);

      request.onerror = () => reject(request.error);

      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(["notifications"], "readwrite");
        const store = transaction.objectStore("notifications");

        let completed = 0;
        let hasError = false;

        for (const notification of notifications) {
          const deleteRequest = store.delete(notification.uri);

          deleteRequest.onsuccess = () => {
            completed++;
            if (completed === notifications.length && !hasError) {
              db.close();
              resolve();
            }
          };

          deleteRequest.onerror = () => {
            hasError = true;
            db.close();
            reject(deleteRequest.error);
          };
        }

        if (notifications.length === 0) {
          db.close();
          resolve();
        }
      };
    });
  }

  /**
   * Clear all data from notifications database
   * This is a nuclear option for user-initiated cleanup
   */
  async clearAllNotifications(): Promise<void> {
    debug.log("🗑️ Clearing all notifications from IndexedDB");
    await this.notificationDB.init();
    await this.notificationDB.clearAll();
    debug.log("✅ All notifications cleared");
  }

  /**
   * Handle quota exceeded errors
   * This should be called when catching QuotaExceededError
   */
  async handleQuotaExceeded(): Promise<boolean> {
    debug.error("⚠️ Quota exceeded! Running emergency cleanup...");

    try {
      // Run aggressive cleanup (reduce retention to 2 weeks)
      const result = await this.cleanupOldNotifications(14);

      if (result.deletedCount > 0) {
        debug.log(
          `✅ Emergency cleanup freed space: ${result.deletedCount} notifications deleted`,
        );
        return true;
      }

      // If still having issues, try clearing everything
      debug.log(
        "⚠️ Normal cleanup didn't free enough space, considering full clear",
      );
      return false;
    } catch (error) {
      debug.error("Failed to handle quota exceeded:", error);
      return false;
    }
  }

  /**
   * Get time since last cleanup
   */
  getTimeSinceLastCleanup(): number {
    return this.lastCleanup > 0 ? Date.now() - this.lastCleanup : -1;
  }

  /**
   * Check if cleanup is currently running
   */
  isCleanupInProgress(): boolean {
    return this.cleanupInProgress;
  }
}

// Expose to window for debugging
if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).indexedDBCleanup = {
    getStats: () => IndexedDBCleanupService.getInstance().getStorageStats(),
    runCleanup: (days?: number) =>
      IndexedDBCleanupService.getInstance().cleanupOldNotifications(days),
    clearAll: () =>
      IndexedDBCleanupService.getInstance().clearAllNotifications(),
    isWarning: () => IndexedDBCleanupService.getInstance().isStorageWarning(),
    isCritical: () => IndexedDBCleanupService.getInstance().isStorageCritical(),
  };
}
