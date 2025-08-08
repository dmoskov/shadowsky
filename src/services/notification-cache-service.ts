import { AppBskyNotificationListNotifications } from "@atproto/api";
import { debug } from "@bsky/shared";
import { NotificationStorageDB } from "./notification-storage-db";

type Notification = AppBskyNotificationListNotifications.Notification;

export interface NotificationCacheResult {
  notifications: Notification[];
  hasMore: boolean;
  totalCached: number;
  lastFetch: number;
  pages: number[];
}

export class NotificationCacheService {
  private static instance: NotificationCacheService;
  private db: NotificationStorageDB;
  private initialized = false;

  private constructor() {
    this.db = NotificationStorageDB.getInstance();
  }

  static getInstance(): NotificationCacheService {
    if (!NotificationCacheService.instance) {
      NotificationCacheService.instance = new NotificationCacheService();
    }
    return NotificationCacheService.instance;
  }

  async init(): Promise<void> {
    if (this.initialized) return;

    await this.db.init();

    // Attempt migration from localStorage
    const migrated = await this.db.migrateFromLocalStorage();
    if (migrated) {
      debug.log(
        "Successfully migrated notifications from localStorage to IndexedDB",
      );
    }

    this.initialized = true;
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error(
        "NotificationCacheService not initialized. Call init() first.",
      );
    }
  }

  // Cache new notifications from a page
  async cacheNotifications(
    notifications: Notification[],
    pageNumber: number,
  ): Promise<void> {
    this.ensureInitialized();

    // Save notifications
    await this.db.saveNotifications(notifications);

    // Update metadata
    const meta = (await this.db.getMetadata()) || {
      id: "main",
      lastFetch: Date.now(),
      pages: [],
      totalCount: 0,
    };

    if (!meta.pages.includes(pageNumber)) {
      meta.pages.push(pageNumber);
      meta.pages.sort((a, b) => a - b);
    }

    meta.lastFetch = Date.now();
    meta.totalCount = await this.getTotalCount();

    await this.db.saveMetadata(meta);
  }

  // Get cached notifications
  async getCachedNotifications(
    limit = 100,
    offset = 0,
  ): Promise<NotificationCacheResult> {
    this.ensureInitialized();

    const notifications = await this.db.getAllNotifications(limit, offset);
    const meta = await this.db.getMetadata();
    const totalCount = await this.getTotalCount();

    return {
      notifications,
      hasMore: offset + notifications.length < totalCount,
      totalCached: totalCount,
      lastFetch: meta?.lastFetch || 0,
      pages: meta?.pages || [],
    };
  }

  // Get notifications by type
  async getNotificationsByType(
    reason: string,
    limit = 100,
  ): Promise<Notification[]> {
    this.ensureInitialized();
    return this.db.getNotificationsByReason(reason, limit);
  }

  // Get unread notifications
  async getUnreadNotifications(limit = 100): Promise<Notification[]> {
    this.ensureInitialized();
    return this.db.getUnreadNotifications(limit);
  }

  // Mark notification as read
  async markAsRead(uri: string): Promise<void> {
    this.ensureInitialized();
    return this.db.markAsRead(uri);
  }

  // Mark multiple as read
  async markMultipleAsRead(uris: string[]): Promise<void> {
    this.ensureInitialized();

    for (const uri of uris) {
      await this.db.markAsRead(uri);
    }
  }

  // Check if we have cached data
  async hasCachedData(): Promise<boolean> {
    this.ensureInitialized();

    const meta = await this.db.getMetadata();
    return meta !== null && meta.totalCount > 0;
  }

  // Check if cache is stale (older than specified minutes)
  async isCacheStale(maxAgeMinutes = 5): Promise<boolean> {
    this.ensureInitialized();

    const meta = await this.db.getMetadata();
    if (!meta) return true;

    const ageMs = Date.now() - meta.lastFetch;
    return ageMs > maxAgeMinutes * 60 * 1000;
  }

  // Get total count
  private async getTotalCount(): Promise<number> {
    const stats = await this.db.getStats();
    return stats.totalNotifications;
  }

  // Get cache statistics
  async getCacheStats() {
    this.ensureInitialized();
    return this.db.getStats();
  }

  // Check if IndexedDB is ready
  async isIndexedDBReady(): Promise<boolean> {
    try {
      await this.init();
      return this.initialized;
    } catch (error) {
      debug.error("IndexedDB not ready:", error);
      return false;
    }
  }

  // Clear all cached data
  async clearCache(): Promise<void> {
    this.ensureInitialized();
    return this.db.clearAll();
  }

  // Check if a specific page is cached
  async isPageCached(pageNumber: number): Promise<boolean> {
    this.ensureInitialized();

    const meta = await this.db.getMetadata();
    return meta?.pages.includes(pageNumber) || false;
  }

  // Get cached pages
  async getCachedPages(): Promise<number[]> {
    this.ensureInitialized();

    const meta = await this.db.getMetadata();
    return meta?.pages || [];
  }
}
