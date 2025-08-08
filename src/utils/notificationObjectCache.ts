import type { Notification } from "@atproto/api/dist/client/types/app/bsky/notification/listNotifications";
import { debug } from "@bsky/shared";

const NOTIFICATION_OBJECT_CACHE_KEY = "bsky_notification_objects_";
const NOTIFICATION_OBJECT_CACHE_VERSION = "v1";
const NOTIFICATION_OBJECT_CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days - notifications don't change after creation

interface CachedNotificationData {
  version: string;
  timestamp: number;
  notifications: Record<string, Notification>; // URI -> Notification mapping
}

/**
 * Cache for individual notification objects (similar to PostCache)
 * This allows quick lookup of notification details without re-fetching
 */
export class NotificationObjectCache {
  private static getCacheKey(): string {
    return `${NOTIFICATION_OBJECT_CACHE_KEY}${NOTIFICATION_OBJECT_CACHE_VERSION}`;
  }

  static save(notifications: Notification[]): void {
    try {
      const cacheKey = this.getCacheKey();

      // Load existing cache to merge with new notifications
      const existingData = this.load();
      const notificationMap = existingData?.notifications || {};

      // Add new notifications to the map
      notifications.forEach((notification) => {
        notificationMap[notification.uri] = notification;
      });

      const data: CachedNotificationData = {
        version: NOTIFICATION_OBJECT_CACHE_VERSION,
        timestamp: Date.now(),
        notifications: notificationMap,
      };

      // Store the cache
      localStorage.setItem(cacheKey, JSON.stringify(data));

      debug.log(
        `🔔 Cached ${notifications.length} new notifications (total: ${Object.keys(notificationMap).length})`,
      );
    } catch (error) {
      debug.error("Failed to cache notifications:", error);
      if (
        error instanceof DOMException &&
        error.name === "QuotaExceededError"
      ) {
        // Clear old notification cache if storage is full
        this.clear();
      }
    }
  }

  static load(): CachedNotificationData | null {
    try {
      const cacheKey = this.getCacheKey();
      const data = localStorage.getItem(cacheKey);
      if (!data) return null;

      const cachedData: CachedNotificationData = JSON.parse(data);

      // Validate version
      if (cachedData.version !== NOTIFICATION_OBJECT_CACHE_VERSION) {
        debug.log("Notification object cache version mismatch, clearing");
        this.clear();
        return null;
      }

      // Check if cache is expired
      if (
        Date.now() - cachedData.timestamp >
        NOTIFICATION_OBJECT_CACHE_DURATION
      ) {
        debug.log("Notification object cache expired, clearing");
        this.clear();
        return null;
      }

      return cachedData;
    } catch (error) {
      debug.error("Failed to load cached notifications:", error);
      this.clear();
      return null;
    }
  }

  static getCachedNotifications(uris: string[]): {
    cached: Notification[];
    missing: string[];
  } {
    const cachedData = this.load();
    if (!cachedData) {
      return { cached: [], missing: uris };
    }

    const cached: Notification[] = [];
    const missing: string[] = [];

    uris.forEach((uri) => {
      const notification = cachedData.notifications[uri];
      if (notification) {
        cached.push(notification);
      } else {
        missing.push(uri);
      }
    });

    if (cached.length > 0) {
      debug.log(
        `🔔 Found ${cached.length} cached notifications out of ${uris.length} requested`,
      );
    }

    return { cached, missing };
  }

  static getNotification(uri: string): Notification | null {
    const cachedData = this.load();
    if (!cachedData) return null;

    return cachedData.notifications[uri] || null;
  }

  static clear(): void {
    try {
      const cacheKey = this.getCacheKey();
      localStorage.removeItem(cacheKey);
      debug.log("Cleared notification object cache");
    } catch (error) {
      debug.error("Failed to clear notification object cache:", error);
    }
  }

  static getCacheInfo(): {
    hasCache: boolean;
    notificationCount: number;
    cacheAge: string | null;
  } {
    const data = this.load();

    if (!data) {
      return {
        hasCache: false,
        notificationCount: 0,
        cacheAge: null,
      };
    }

    const ageMs = Date.now() - data.timestamp;
    const days = Math.floor(ageMs / (24 * 60 * 60 * 1000));
    const hours = Math.floor(
      (ageMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000),
    );

    let ageStr = "";
    if (days > 0) {
      ageStr = `${days}d ${hours}h`;
    } else {
      ageStr = `${hours}h`;
    }

    return {
      hasCache: true,
      notificationCount: Object.keys(data.notifications).length,
      cacheAge: ageStr,
    };
  }

  /**
   * Clean up old notifications to save space
   * @param daysToKeep Number of days of notifications to keep
   */
  static cleanup(daysToKeep: number = 7): void {
    const data = this.load();
    if (!data) return;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoffTime = cutoffDate.getTime();

    let removedCount = 0;
    const newNotifications: Record<string, Notification> = {};

    Object.entries(data.notifications).forEach(([uri, notification]) => {
      const notificationDate = new Date(notification.indexedAt).getTime();
      if (notificationDate >= cutoffTime) {
        newNotifications[uri] = notification;
      } else {
        removedCount++;
      }
    });

    if (removedCount > 0) {
      const newData: CachedNotificationData = {
        version: NOTIFICATION_OBJECT_CACHE_VERSION,
        timestamp: data.timestamp,
        notifications: newNotifications,
      };

      const cacheKey = this.getCacheKey();
      localStorage.setItem(cacheKey, JSON.stringify(newData));

      debug.log(`🧹 Cleaned up ${removedCount} old notifications from cache`);
    }
  }
}
