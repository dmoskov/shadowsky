import { AppBskyNotificationListNotifications } from "@atproto/api";
import { debug } from "@bsky/shared";
import { withIndexedDBRetry } from "../utils/storage-retry";

type Notification = AppBskyNotificationListNotifications.Notification;

interface NotificationMeta {
  id: string;
  lastFetch: number;
  pages: number[];
  totalCount: number;
}

export class NotificationStorageDB {
  private static instance: NotificationStorageDB;
  private db: IDBDatabase | null = null;
  private readonly DB_NAME = "bsky_notifications_db";
  private readonly DB_VERSION = 3; // Bumped for additional compound indexes

  // Store names
  private readonly NOTIFICATIONS_STORE = "notifications";
  private readonly META_STORE = "metadata";

  // Index names (version 1)
  private readonly INDEXED_AT_INDEX = "by_indexed_at";
  private readonly REASON_INDEX = "by_reason";
  private readonly AUTHOR_INDEX = "by_author";
  private readonly IS_READ_INDEX = "by_is_read";

  // Compound index names (version 2)
  private readonly AUTHOR_INDEXED_AT_INDEX = "by_author_indexed_at";
  private readonly REASON_INDEXED_AT_INDEX = "by_reason_indexed_at";

  // Compound index names (version 3)
  private readonly IS_READ_INDEXED_AT_INDEX = "by_is_read_indexed_at";

  private constructor() {}

  static getInstance(): NotificationStorageDB {
    if (!NotificationStorageDB.instance) {
      NotificationStorageDB.instance = new NotificationStorageDB();
    }
    return NotificationStorageDB.instance;
  }

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => {
        debug.error("Failed to open IndexedDB:", request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const oldVersion = event.oldVersion;

        // Create notifications store (version 1)
        if (!db.objectStoreNames.contains(this.NOTIFICATIONS_STORE)) {
          const notificationsStore = db.createObjectStore(
            this.NOTIFICATIONS_STORE,
            {
              keyPath: "uri",
            },
          );

          // Create indexes for efficient querying
          notificationsStore.createIndex(this.INDEXED_AT_INDEX, "indexedAt", {
            unique: false,
          });
          notificationsStore.createIndex(this.REASON_INDEX, "reason", {
            unique: false,
          });
          notificationsStore.createIndex(this.AUTHOR_INDEX, "author.did", {
            unique: false,
          });
          notificationsStore.createIndex(this.IS_READ_INDEX, "isRead", {
            unique: false,
          });
        }

        // Create metadata store (version 1)
        if (!db.objectStoreNames.contains(this.META_STORE)) {
          db.createObjectStore(this.META_STORE, { keyPath: "id" });
        }

        // Version 2: Add compound indexes for O(log n) query performance
        if (oldVersion < 2) {
          const transaction = (event.target as IDBOpenDBRequest).transaction;
          if (transaction) {
            const notificationsStore = transaction.objectStore(
              this.NOTIFICATIONS_STORE,
            );

            // Compound index: (authorDid, indexedAt) - for author queries sorted by time
            if (
              !notificationsStore.indexNames.contains(
                this.AUTHOR_INDEXED_AT_INDEX,
              )
            ) {
              notificationsStore.createIndex(
                this.AUTHOR_INDEXED_AT_INDEX,
                ["author.did", "indexedAt"],
                { unique: false },
              );
            }

            // Compound index: (reason, indexedAt) - for reason queries sorted by time
            if (
              !notificationsStore.indexNames.contains(
                this.REASON_INDEXED_AT_INDEX,
              )
            ) {
              notificationsStore.createIndex(
                this.REASON_INDEXED_AT_INDEX,
                ["reason", "indexedAt"],
                { unique: false },
              );
            }
          }
        }

        // Version 3: Add compound index for unread notifications sorted by time
        if (oldVersion < 3) {
          const transaction = (event.target as IDBOpenDBRequest).transaction;
          if (transaction) {
            const notificationsStore = transaction.objectStore(
              this.NOTIFICATIONS_STORE,
            );

            // Compound index: (isRead, indexedAt) - for unread notification queries sorted by time
            // Enables efficient "get all unread notifications sorted by date" queries
            // Performance: O(log n + k) instead of O(n) where k is result count
            if (
              !notificationsStore.indexNames.contains(
                this.IS_READ_INDEXED_AT_INDEX,
              )
            ) {
              notificationsStore.createIndex(
                this.IS_READ_INDEXED_AT_INDEX,
                ["isRead", "indexedAt"],
                { unique: false },
              );
            }
          }
        }
      };
    });
  }

  private ensureDB(): void {
    if (!this.db) {
      throw new Error("Database not initialized. Call init() first.");
    }
  }

  // Save individual notification
  async saveNotification(notification: Notification): Promise<void> {
    return withIndexedDBRetry(async () => {
      this.ensureDB();

      const transaction = this.db!.transaction(
        [this.NOTIFICATIONS_STORE],
        "readwrite",
      );
      const store = transaction.objectStore(this.NOTIFICATIONS_STORE);

      return new Promise<void>((resolve, reject) => {
        const request = store.put(notification);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }, "saveNotification");
  }

  // Batch save notifications
  async saveNotifications(notifications: Notification[]): Promise<void> {
    return withIndexedDBRetry(async () => {
      this.ensureDB();

      const transaction = this.db!.transaction(
        [this.NOTIFICATIONS_STORE],
        "readwrite",
      );
      const store = transaction.objectStore(this.NOTIFICATIONS_STORE);

      return new Promise<void>((resolve, reject) => {
        let completed = 0;

        notifications.forEach((notification) => {
          const request = store.put(notification);

          request.onsuccess = () => {
            completed++;
            if (completed === notifications.length) {
              resolve();
            }
          };

          request.onerror = () => reject(request.error);
        });

        if (notifications.length === 0) {
          resolve();
        }
      });
    }, "saveNotifications");
  }

  // Get notification by URI
  async getNotification(uri: string): Promise<Notification | null> {
    this.ensureDB();

    const transaction = this.db!.transaction(
      [this.NOTIFICATIONS_STORE],
      "readonly",
    );
    const store = transaction.objectStore(this.NOTIFICATIONS_STORE);

    return new Promise((resolve, reject) => {
      const request = store.get(uri);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  // Get all notifications (with pagination)
  async getAllNotifications(limit = 100, offset = 0): Promise<Notification[]> {
    this.ensureDB();

    const transaction = this.db!.transaction(
      [this.NOTIFICATIONS_STORE],
      "readonly",
    );
    const store = transaction.objectStore(this.NOTIFICATIONS_STORE);
    const index = store.index(this.INDEXED_AT_INDEX);

    return new Promise((resolve, reject) => {
      const notifications: Notification[] = [];
      let skipped = 0;

      // Open cursor in descending order (newest first)
      const request = index.openCursor(null, "prev");

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;

        if (cursor && notifications.length < limit) {
          if (skipped < offset) {
            skipped++;
            cursor.continue();
          } else {
            notifications.push(cursor.value);
            cursor.continue();
          }
        } else {
          resolve(notifications);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  // Get notifications by reason, sorted by indexedAt (uses compound index for O(log n) performance)
  async getNotificationsByReason(
    reason: string,
    limit = 100,
    direction: "prev" | "next" = "prev",
  ): Promise<Notification[]> {
    this.ensureDB();

    const transaction = this.db!.transaction(
      [this.NOTIFICATIONS_STORE],
      "readonly",
    );
    const store = transaction.objectStore(this.NOTIFICATIONS_STORE);

    return new Promise((resolve, reject) => {
      const notifications: Notification[] = [];

      // Use compound index if available for O(log n) performance
      const hasCompoundIndex = store.indexNames.contains(
        this.REASON_INDEXED_AT_INDEX,
      );

      if (hasCompoundIndex) {
        const index = store.index(this.REASON_INDEXED_AT_INDEX);
        // Create a key range that matches all entries for this reason
        const range = IDBKeyRange.bound([reason, ""], [reason, "\uffff"]);

        const request = index.openCursor(range, direction);

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;

          if (cursor && notifications.length < limit) {
            notifications.push(cursor.value);
            cursor.continue();
          } else {
            resolve(notifications);
          }
        };

        request.onerror = () => reject(request.error);
      } else {
        // Fallback: use single reason index and sort manually
        const index = store.index(this.REASON_INDEX);
        const request = index.openCursor(IDBKeyRange.only(reason));

        const allNotifications: Notification[] = [];

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;

          if (cursor) {
            allNotifications.push(cursor.value);
            cursor.continue();
          } else {
            // Sort manually and return
            allNotifications.sort((a, b) => {
              const dateA = new Date(a.indexedAt).getTime();
              const dateB = new Date(b.indexedAt).getTime();
              return direction === "prev" ? dateB - dateA : dateA - dateB;
            });
            resolve(allNotifications.slice(0, limit));
          }
        };

        request.onerror = () => reject(request.error);
      }
    });
  }

  // Get notifications by author, sorted by indexedAt (uses compound index for O(log n) performance)
  async getNotificationsByAuthor(
    authorDid: string,
    limit = 100,
    direction: "prev" | "next" = "prev",
  ): Promise<Notification[]> {
    this.ensureDB();

    const transaction = this.db!.transaction(
      [this.NOTIFICATIONS_STORE],
      "readonly",
    );
    const store = transaction.objectStore(this.NOTIFICATIONS_STORE);

    return new Promise((resolve, reject) => {
      const notifications: Notification[] = [];

      // Use compound index if available for O(log n) performance
      const hasCompoundIndex = store.indexNames.contains(
        this.AUTHOR_INDEXED_AT_INDEX,
      );

      if (hasCompoundIndex) {
        const index = store.index(this.AUTHOR_INDEXED_AT_INDEX);
        const range = IDBKeyRange.bound([authorDid, ""], [authorDid, "\uffff"]);

        const request = index.openCursor(range, direction);

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;

          if (cursor && notifications.length < limit) {
            notifications.push(cursor.value);
            cursor.continue();
          } else {
            resolve(notifications);
          }
        };

        request.onerror = () => reject(request.error);
      } else {
        // Fallback: use single author index and sort manually
        const index = store.index(this.AUTHOR_INDEX);
        const request = index.openCursor(IDBKeyRange.only(authorDid));

        const allNotifications: Notification[] = [];

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;

          if (cursor) {
            allNotifications.push(cursor.value);
            cursor.continue();
          } else {
            // Sort manually and return
            allNotifications.sort((a, b) => {
              const dateA = new Date(a.indexedAt).getTime();
              const dateB = new Date(b.indexedAt).getTime();
              return direction === "prev" ? dateB - dateA : dateA - dateB;
            });
            resolve(allNotifications.slice(0, limit));
          }
        };

        request.onerror = () => reject(request.error);
      }
    });
  }

  // Get unread notifications (uses compound index for O(log n) performance)
  async getUnreadNotifications(
    limit = 100,
    direction: "prev" | "next" = "prev",
  ): Promise<Notification[]> {
    this.ensureDB();

    const transaction = this.db!.transaction(
      [this.NOTIFICATIONS_STORE],
      "readonly",
    );
    const store = transaction.objectStore(this.NOTIFICATIONS_STORE);

    return new Promise((resolve, reject) => {
      const notifications: Notification[] = [];

      // Use compound index if available for O(log n + k) performance
      const hasCompoundIndex = store.indexNames.contains(
        this.IS_READ_INDEXED_AT_INDEX,
      );

      if (hasCompoundIndex) {
        const index = store.index(this.IS_READ_INDEXED_AT_INDEX);
        // Create a key range that matches all unread notifications (isRead = false)
        const range = IDBKeyRange.bound([false, ""], [false, "\uffff"]);

        const request = index.openCursor(range, direction);

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;

          if (cursor && notifications.length < limit) {
            notifications.push(cursor.value);
            cursor.continue();
          } else {
            resolve(notifications);
          }
        };

        request.onerror = () => reject(request.error);
      } else {
        // Fallback: use single isRead index
        const index = store.index(this.IS_READ_INDEX);
        const request = index.openCursor(IDBKeyRange.only(false));

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;

          if (cursor && notifications.length < limit) {
            notifications.push(cursor.value);
            cursor.continue();
          } else {
            resolve(notifications);
          }
        };

        request.onerror = () => reject(request.error);
      }
    });
  }

  // Mark notification as read
  async markAsRead(uri: string): Promise<void> {
    const notification = await this.getNotification(uri);
    if (notification) {
      notification.isRead = true;
      await this.saveNotification(notification);
    }
  }

  // Save metadata
  async saveMetadata(meta: NotificationMeta): Promise<void> {
    return withIndexedDBRetry(async () => {
      this.ensureDB();

      const transaction = this.db!.transaction([this.META_STORE], "readwrite");
      const store = transaction.objectStore(this.META_STORE);

      return new Promise<void>((resolve, reject) => {
        const request = store.put(meta);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }, "saveMetadata");
  }

  // Get metadata
  async getMetadata(): Promise<NotificationMeta | null> {
    this.ensureDB();

    const transaction = this.db!.transaction([this.META_STORE], "readonly");
    const store = transaction.objectStore(this.META_STORE);

    return new Promise((resolve, reject) => {
      const request = store.get("main");
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  // Clear all data
  async clearAll(): Promise<void> {
    return withIndexedDBRetry(async () => {
      this.ensureDB();

      const transaction = this.db!.transaction(
        [this.NOTIFICATIONS_STORE, this.META_STORE],
        "readwrite",
      );

      return new Promise<void>((resolve, reject) => {
        let completed = 0;
        const stores = [this.NOTIFICATIONS_STORE, this.META_STORE];

        stores.forEach((storeName) => {
          const store = transaction.objectStore(storeName);
          const request = store.clear();

          request.onsuccess = () => {
            completed++;
            if (completed === stores.length) {
              resolve();
            }
          };

          request.onerror = () => reject(request.error);
        });
      });
    }, "clearAll");
  }

  // Get storage stats
  async getStats(): Promise<{
    totalNotifications: number;
    unreadCount: number;
    reasonCounts: Record<string, number>;
    oldestNotification: Date | null;
    newestNotification: Date | null;
  }> {
    this.ensureDB();

    const transaction = this.db!.transaction(
      [this.NOTIFICATIONS_STORE],
      "readonly",
    );
    const store = transaction.objectStore(this.NOTIFICATIONS_STORE);

    return new Promise((resolve, reject) => {
      const stats = {
        totalNotifications: 0,
        unreadCount: 0,
        reasonCounts: {} as Record<string, number>,
        oldestNotification: null as Date | null,
        newestNotification: null as Date | null,
      };

      const countRequest = store.count();
      countRequest.onsuccess = () => {
        stats.totalNotifications = countRequest.result;
      };

      const cursorRequest = store.openCursor();
      cursorRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;

        if (cursor) {
          const notification = cursor.value;

          // Count unread
          if (!notification.isRead) {
            stats.unreadCount++;
          }

          // Count by reason
          stats.reasonCounts[notification.reason] =
            (stats.reasonCounts[notification.reason] || 0) + 1;

          // Track dates
          const date = new Date(notification.indexedAt);
          if (!stats.oldestNotification || date < stats.oldestNotification) {
            stats.oldestNotification = date;
          }
          if (!stats.newestNotification || date > stats.newestNotification) {
            stats.newestNotification = date;
          }

          cursor.continue();
        } else {
          resolve(stats);
        }
      };

      cursorRequest.onerror = () => reject(cursorRequest.error);
    });
  }

  // Migrate from localStorage
  async migrateFromLocalStorage(): Promise<boolean> {
    try {
      const oldData = localStorage.getItem("bsky_extended_fetch_data_v1");
      if (!oldData) {
        return false;
      }

      const parsed = JSON.parse(oldData);

      // Handle the actual data structure: { metadata: {...}, pages: [...], version: "v1" }
      if (parsed.pages && Array.isArray(parsed.pages)) {
        // Extract all notifications from all pages
        const allNotifications: Notification[] = [];
        for (const page of parsed.pages) {
          if (page.notifications && Array.isArray(page.notifications)) {
            allNotifications.push(...page.notifications);
          }
        }

        if (allNotifications.length > 0) {
          await this.saveNotifications(allNotifications);

          // Save metadata - pages are just indices
          await this.saveMetadata({
            id: "main",
            lastFetch: parsed.metadata?.lastFetch || Date.now(),
            pages: parsed.pages.map((_: unknown, index: number) => index),
            totalCount: allNotifications.length,
          });

          // Remove old data
          localStorage.removeItem("bsky_extended_fetch_data_v1");

          debug.log(
            `Migrated ${allNotifications.length} notifications from localStorage to IndexedDB`,
          );
          return true;
        }
      }

      // Also check for the old format just in case
      if (parsed.notifications && Array.isArray(parsed.notifications)) {
        await this.saveNotifications(parsed.notifications);

        // Save metadata
        await this.saveMetadata({
          id: "main",
          lastFetch: parsed.lastFetch || Date.now(),
          pages: parsed.pages || [],
          totalCount: parsed.notifications.length,
        });

        // Remove old data
        localStorage.removeItem("bsky_extended_fetch_data_v1");

        debug.log(
          `Migrated ${parsed.notifications.length} notifications to IndexedDB (old format)`,
        );
        return true;
      }
    } catch (error) {
      debug.error("Failed to migrate from localStorage:", error);
    }

    return false;
  }
}
