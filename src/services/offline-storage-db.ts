/**
 * Offline Storage Database
 *
 * IndexedDB-based storage for offline access to feeds and DMs.
 * Complements the service worker's network-first caching with persistent
 * application-level storage for critical user data.
 *
 * Stores:
 * - Timeline feed items (user's home feed)
 * - Recent DM conversations and messages
 * - Feed metadata for offline indicators
 */

import { debug } from "@bsky/shared";

const DB_NAME = "BskyOfflineStorage";
const DB_VERSION = 1;

// Store names
const STORES = {
  FEED_ITEMS: "feedItems",
  DM_CONVERSATIONS: "dmConversations",
  DM_MESSAGES: "dmMessages",
  METADATA: "offlineMetadata",
} as const;

// Storage limits
const LIMITS = {
  MAX_FEED_ITEMS: 500,
  MAX_DM_CONVERSATIONS: 50,
  MAX_MESSAGES_PER_CONVO: 100,
  FEED_MAX_AGE_DAYS: 7,
  DM_MAX_AGE_DAYS: 30,
} as const;

export interface OfflineFeedItem {
  uri: string;
  cid: string;
  indexedAt: string;
  author: {
    did: string;
    handle: string;
    displayName?: string;
    avatar?: string;
  };
  record: {
    text: string;
    createdAt: string;
    embed?: unknown;
    facets?: unknown[];
  };
  replyCount?: number;
  repostCount?: number;
  likeCount?: number;
  _offlineCachedAt: number;
  _feedType: "timeline" | "author" | "list";
}

export interface OfflineDMConversation {
  id: string;
  rev: string;
  members: {
    did: string;
    handle?: string;
    displayName?: string;
    avatar?: string;
  }[];
  muted: boolean;
  unreadCount: number;
  lastMessageText?: string;
  lastMessageAt?: string;
  _offlineCachedAt: number;
}

export interface OfflineDMMessage {
  id: string;
  conversationId: string;
  rev: string;
  text: string;
  sentAt: string;
  senderDid: string;
  _offlineCachedAt: number;
}

export interface OfflineMetadata {
  key: string;
  lastSyncAt: number;
  itemCount: number;
  oldestItemAt?: string;
  newestItemAt?: string;
}

export interface OfflineStorageStats {
  feedItemCount: number;
  conversationCount: number;
  messageCount: number;
  lastFeedSync: number | null;
  lastDMSync: number | null;
  storageEstimate: number;
}

export class OfflineStorageDB {
  private static instance: OfflineStorageDB;
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  private constructor() {}

  static getInstance(): OfflineStorageDB {
    if (!OfflineStorageDB.instance) {
      OfflineStorageDB.instance = new OfflineStorageDB();
    }
    return OfflineStorageDB.instance;
  }

  async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        debug.error("Failed to open OfflineStorageDB:", request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        debug.log("OfflineStorageDB initialized");
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Feed items store
        if (!db.objectStoreNames.contains(STORES.FEED_ITEMS)) {
          const feedStore = db.createObjectStore(STORES.FEED_ITEMS, {
            keyPath: "uri",
          });
          feedStore.createIndex("indexedAt", "indexedAt", { unique: false });
          feedStore.createIndex("_offlineCachedAt", "_offlineCachedAt", {
            unique: false,
          });
          feedStore.createIndex("_feedType", "_feedType", { unique: false });
          feedStore.createIndex("authorDid", "author.did", { unique: false });
        }

        // DM conversations store
        if (!db.objectStoreNames.contains(STORES.DM_CONVERSATIONS)) {
          const convoStore = db.createObjectStore(STORES.DM_CONVERSATIONS, {
            keyPath: "id",
          });
          convoStore.createIndex("lastMessageAt", "lastMessageAt", {
            unique: false,
          });
          convoStore.createIndex("_offlineCachedAt", "_offlineCachedAt", {
            unique: false,
          });
        }

        // DM messages store
        if (!db.objectStoreNames.contains(STORES.DM_MESSAGES)) {
          const msgStore = db.createObjectStore(STORES.DM_MESSAGES, {
            keyPath: "id",
          });
          msgStore.createIndex("conversationId", "conversationId", {
            unique: false,
          });
          msgStore.createIndex("sentAt", "sentAt", { unique: false });
          msgStore.createIndex("_offlineCachedAt", "_offlineCachedAt", {
            unique: false,
          });
          // Compound index for efficient conversation message queries
          msgStore.createIndex("convo_sentAt", ["conversationId", "sentAt"], {
            unique: false,
          });
        }

        // Metadata store
        if (!db.objectStoreNames.contains(STORES.METADATA)) {
          db.createObjectStore(STORES.METADATA, { keyPath: "key" });
        }
      };
    });

    return this.initPromise;
  }

  private ensureDb(): IDBDatabase {
    if (!this.db) {
      throw new Error("OfflineStorageDB not initialized. Call init() first.");
    }
    return this.db;
  }

  // ==================== Feed Item Operations ====================

  async saveFeedItems(
    items: Omit<OfflineFeedItem, "_offlineCachedAt">[],
    feedType: "timeline" | "author" | "list" = "timeline",
  ): Promise<void> {
    const db = this.ensureDb();
    const transaction = db.transaction(
      [STORES.FEED_ITEMS, STORES.METADATA],
      "readwrite",
    );
    const store = transaction.objectStore(STORES.FEED_ITEMS);
    const metaStore = transaction.objectStore(STORES.METADATA);

    const now = Date.now();

    for (const item of items) {
      const offlineItem: OfflineFeedItem = {
        ...item,
        _offlineCachedAt: now,
        _feedType: feedType,
      };
      store.put(offlineItem);
    }

    // Update metadata
    const metaKey = `feed_${feedType}`;
    const existingMeta = await this.getMetadataInTransaction(
      metaStore,
      metaKey,
    );
    const newMeta: OfflineMetadata = {
      key: metaKey,
      lastSyncAt: now,
      itemCount: (existingMeta?.itemCount || 0) + items.length,
      newestItemAt: items[0]?.indexedAt,
      oldestItemAt: items[items.length - 1]?.indexedAt,
    };
    metaStore.put(newMeta);

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async getFeedItems(
    limit = 50,
    feedType?: "timeline" | "author" | "list",
  ): Promise<OfflineFeedItem[]> {
    const db = this.ensureDb();
    const transaction = db.transaction([STORES.FEED_ITEMS], "readonly");
    const store = transaction.objectStore(STORES.FEED_ITEMS);
    const index = store.index("indexedAt");

    const items: OfflineFeedItem[] = [];

    return new Promise((resolve, reject) => {
      const request = index.openCursor(null, "prev");

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;

        if (cursor && items.length < limit) {
          const item = cursor.value as OfflineFeedItem;
          if (!feedType || item._feedType === feedType) {
            items.push(item);
          }
          cursor.continue();
        } else {
          resolve(items);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  async hasFeedItems(): Promise<boolean> {
    const db = this.ensureDb();
    const transaction = db.transaction([STORES.FEED_ITEMS], "readonly");
    const store = transaction.objectStore(STORES.FEED_ITEMS);

    return new Promise((resolve, reject) => {
      const request = store.count();
      request.onsuccess = () => resolve(request.result > 0);
      request.onerror = () => reject(request.error);
    });
  }

  // ==================== DM Operations ====================

  async saveConversations(
    conversations: Omit<OfflineDMConversation, "_offlineCachedAt">[],
  ): Promise<void> {
    const db = this.ensureDb();
    const transaction = db.transaction(
      [STORES.DM_CONVERSATIONS, STORES.METADATA],
      "readwrite",
    );
    const store = transaction.objectStore(STORES.DM_CONVERSATIONS);
    const metaStore = transaction.objectStore(STORES.METADATA);

    const now = Date.now();

    for (const convo of conversations) {
      const offlineConvo: OfflineDMConversation = {
        ...convo,
        _offlineCachedAt: now,
      };
      store.put(offlineConvo);
    }

    // Update metadata
    metaStore.put({
      key: "dm_conversations",
      lastSyncAt: now,
      itemCount: conversations.length,
    });

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async getConversations(): Promise<OfflineDMConversation[]> {
    const db = this.ensureDb();
    const transaction = db.transaction([STORES.DM_CONVERSATIONS], "readonly");
    const store = transaction.objectStore(STORES.DM_CONVERSATIONS);
    const index = store.index("lastMessageAt");

    const conversations: OfflineDMConversation[] = [];

    return new Promise((resolve, reject) => {
      const request = index.openCursor(null, "prev");

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;

        if (cursor) {
          conversations.push(cursor.value);
          cursor.continue();
        } else {
          resolve(conversations);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  async hasConversations(): Promise<boolean> {
    const db = this.ensureDb();
    const transaction = db.transaction([STORES.DM_CONVERSATIONS], "readonly");
    const store = transaction.objectStore(STORES.DM_CONVERSATIONS);

    return new Promise((resolve, reject) => {
      const request = store.count();
      request.onsuccess = () => resolve(request.result > 0);
      request.onerror = () => reject(request.error);
    });
  }

  async saveMessages(
    conversationId: string,
    messages: Omit<OfflineDMMessage, "_offlineCachedAt" | "conversationId">[],
  ): Promise<void> {
    const db = this.ensureDb();
    const transaction = db.transaction([STORES.DM_MESSAGES], "readwrite");
    const store = transaction.objectStore(STORES.DM_MESSAGES);

    const now = Date.now();

    for (const msg of messages) {
      const offlineMsg: OfflineDMMessage = {
        ...msg,
        conversationId,
        _offlineCachedAt: now,
      };
      store.put(offlineMsg);
    }

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async getMessages(
    conversationId: string,
    limit = 50,
  ): Promise<OfflineDMMessage[]> {
    const db = this.ensureDb();
    const transaction = db.transaction([STORES.DM_MESSAGES], "readonly");
    const store = transaction.objectStore(STORES.DM_MESSAGES);
    const index = store.index("convo_sentAt");

    const messages: OfflineDMMessage[] = [];

    return new Promise((resolve, reject) => {
      const range = IDBKeyRange.bound(
        [conversationId, ""],
        [conversationId, "\uffff"],
      );
      const request = index.openCursor(range, "prev");

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;

        if (cursor && messages.length < limit) {
          messages.push(cursor.value);
          cursor.continue();
        } else {
          // Return in chronological order (oldest first)
          resolve(messages.reverse());
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  // ==================== Metadata & Stats ====================

  private getMetadataInTransaction(
    store: IDBObjectStore,
    key: string,
  ): Promise<OfflineMetadata | null> {
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getMetadata(key: string): Promise<OfflineMetadata | null> {
    const db = this.ensureDb();
    const transaction = db.transaction([STORES.METADATA], "readonly");
    const store = transaction.objectStore(STORES.METADATA);

    return this.getMetadataInTransaction(store, key);
  }

  async getStats(): Promise<OfflineStorageStats> {
    const db = this.ensureDb();
    const transaction = db.transaction(
      [
        STORES.FEED_ITEMS,
        STORES.DM_CONVERSATIONS,
        STORES.DM_MESSAGES,
        STORES.METADATA,
      ],
      "readonly",
    );

    const feedStore = transaction.objectStore(STORES.FEED_ITEMS);
    const convoStore = transaction.objectStore(STORES.DM_CONVERSATIONS);
    const msgStore = transaction.objectStore(STORES.DM_MESSAGES);
    const metaStore = transaction.objectStore(STORES.METADATA);

    const [feedCount, convoCount, msgCount, feedMeta, dmMeta] =
      await Promise.all([
        new Promise<number>((resolve, reject) => {
          const req = feedStore.count();
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        }),
        new Promise<number>((resolve, reject) => {
          const req = convoStore.count();
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        }),
        new Promise<number>((resolve, reject) => {
          const req = msgStore.count();
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        }),
        this.getMetadataInTransaction(metaStore, "feed_timeline"),
        this.getMetadataInTransaction(metaStore, "dm_conversations"),
      ]);

    // Estimate storage size
    let storageEstimate = 0;
    if ("storage" in navigator && "estimate" in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate();
        storageEstimate = estimate.usage || 0;
      } catch {
        // Ignore errors
      }
    }

    return {
      feedItemCount: feedCount,
      conversationCount: convoCount,
      messageCount: msgCount,
      lastFeedSync: feedMeta?.lastSyncAt || null,
      lastDMSync: dmMeta?.lastSyncAt || null,
      storageEstimate,
    };
  }

  // ==================== Cleanup & Eviction ====================

  async evictOldFeedItems(): Promise<number> {
    const db = this.ensureDb();
    const transaction = db.transaction([STORES.FEED_ITEMS], "readwrite");
    const store = transaction.objectStore(STORES.FEED_ITEMS);
    const index = store.index("_offlineCachedAt");

    const cutoffTime =
      Date.now() - LIMITS.FEED_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
    let deletedCount = 0;

    return new Promise((resolve, reject) => {
      const range = IDBKeyRange.upperBound(cutoffTime);
      const request = index.openCursor(range);

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;

        if (cursor) {
          cursor.delete();
          deletedCount++;
          cursor.continue();
        } else {
          debug.log(`Evicted ${deletedCount} old feed items`);
          resolve(deletedCount);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  async evictOldMessages(): Promise<number> {
    const db = this.ensureDb();
    const transaction = db.transaction([STORES.DM_MESSAGES], "readwrite");
    const store = transaction.objectStore(STORES.DM_MESSAGES);
    const index = store.index("_offlineCachedAt");

    const cutoffTime =
      Date.now() - LIMITS.DM_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
    let deletedCount = 0;

    return new Promise((resolve, reject) => {
      const range = IDBKeyRange.upperBound(cutoffTime);
      const request = index.openCursor(range);

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;

        if (cursor) {
          cursor.delete();
          deletedCount++;
          cursor.continue();
        } else {
          debug.log(`Evicted ${deletedCount} old DM messages`);
          resolve(deletedCount);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  async enforceStorageLimits(): Promise<void> {
    // Enforce feed item limit
    await this.enforceFeedLimit();
    // Enforce conversation limit
    await this.enforceConversationLimit();
    // Clean up old items
    await this.evictOldFeedItems();
    await this.evictOldMessages();
  }

  private async enforceFeedLimit(): Promise<void> {
    const db = this.ensureDb();
    const transaction = db.transaction([STORES.FEED_ITEMS], "readwrite");
    const store = transaction.objectStore(STORES.FEED_ITEMS);

    const count = await new Promise<number>((resolve, reject) => {
      const req = store.count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    if (count > LIMITS.MAX_FEED_ITEMS) {
      const index = store.index("_offlineCachedAt");
      const deleteCount = count - LIMITS.MAX_FEED_ITEMS;
      let deleted = 0;

      await new Promise<void>((resolve, reject) => {
        const request = index.openCursor(null, "next");

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;

          if (cursor && deleted < deleteCount) {
            cursor.delete();
            deleted++;
            cursor.continue();
          } else {
            resolve();
          }
        };

        request.onerror = () => reject(request.error);
      });

      debug.log(`Enforced feed limit: removed ${deleted} items`);
    }
  }

  private async enforceConversationLimit(): Promise<void> {
    const db = this.ensureDb();
    const transaction = db.transaction(
      [STORES.DM_CONVERSATIONS, STORES.DM_MESSAGES],
      "readwrite",
    );
    const convoStore = transaction.objectStore(STORES.DM_CONVERSATIONS);
    const msgStore = transaction.objectStore(STORES.DM_MESSAGES);

    const count = await new Promise<number>((resolve, reject) => {
      const req = convoStore.count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    if (count > LIMITS.MAX_DM_CONVERSATIONS) {
      const index = convoStore.index("_offlineCachedAt");
      const deleteCount = count - LIMITS.MAX_DM_CONVERSATIONS;
      const conversationsToDelete: string[] = [];
      let deleted = 0;

      // Get conversations to delete
      await new Promise<void>((resolve, reject) => {
        const request = index.openCursor(null, "next");

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;

          if (cursor && deleted < deleteCount) {
            conversationsToDelete.push(cursor.value.id);
            cursor.delete();
            deleted++;
            cursor.continue();
          } else {
            resolve();
          }
        };

        request.onerror = () => reject(request.error);
      });

      // Delete associated messages
      const msgIndex = msgStore.index("conversationId");
      for (const convoId of conversationsToDelete) {
        await new Promise<void>((resolve, reject) => {
          const request = msgIndex.openCursor(IDBKeyRange.only(convoId));

          request.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest).result;

            if (cursor) {
              cursor.delete();
              cursor.continue();
            } else {
              resolve();
            }
          };

          request.onerror = () => reject(request.error);
        });
      }

      debug.log(
        `Enforced conversation limit: removed ${deleted} conversations`,
      );
    }
  }

  async clearAll(): Promise<void> {
    const db = this.ensureDb();
    const transaction = db.transaction(
      [
        STORES.FEED_ITEMS,
        STORES.DM_CONVERSATIONS,
        STORES.DM_MESSAGES,
        STORES.METADATA,
      ],
      "readwrite",
    );

    transaction.objectStore(STORES.FEED_ITEMS).clear();
    transaction.objectStore(STORES.DM_CONVERSATIONS).clear();
    transaction.objectStore(STORES.DM_MESSAGES).clear();
    transaction.objectStore(STORES.METADATA).clear();

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => {
        debug.log("Cleared all offline storage");
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    });
  }
}

export const offlineStorageDB = OfflineStorageDB.getInstance();
