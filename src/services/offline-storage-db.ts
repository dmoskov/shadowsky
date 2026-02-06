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
 * - Thread summaries (AI-generated haiku summaries for offline access)
 */

import { debug } from "@bsky/shared";
import { withIndexedDBRetry } from "../utils/storage-retry";

const DB_NAME = "BskyOfflineStorage";
const DB_VERSION = 3; // Bumped for thread summaries store

// Store names
const STORES = {
  FEED_ITEMS: "feedItems",
  DM_CONVERSATIONS: "dmConversations",
  DM_MESSAGES: "dmMessages",
  METADATA: "offlineMetadata",
  THREAD_SUMMARIES: "threadSummaries",
} as const;

// Storage limits
const LIMITS = {
  MAX_FEED_ITEMS: 500,
  MAX_DM_CONVERSATIONS: 50,
  MAX_MESSAGES_PER_CONVO: 100,
  MAX_THREAD_SUMMARIES: 200,
  FEED_MAX_AGE_DAYS: 7,
  DM_MAX_AGE_DAYS: 30,
  SUMMARY_MAX_AGE_DAYS: 30,
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

export type ThreadSummaryFormat =
  | "haiku"
  | "tldr"
  | "keypoints"
  | "extended"
  | "brief"
  | "moderate"
  | "detailed"
  | "comprehensive";
export type ThreadSummarySource = "bookmarked" | "followed" | "viewed";

export interface OfflineThreadSummary {
  threadUri: string;
  summary: string;
  format: ThreadSummaryFormat;
  metadata: {
    postCount: number;
    authors: string[];
    generatedAt: string;
  };
  source: ThreadSummarySource;
  _offlineCachedAt: number;
  _lastAccessedAt: number;
}

export interface OfflineStorageStats {
  feedItemCount: number;
  conversationCount: number;
  messageCount: number;
  summaryCount: number;
  lastFeedSync: number | null;
  lastDMSync: number | null;
  lastSummarySync: number | null;
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
        const oldVersion = event.oldVersion;

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

        // Version 2: Add compound indexes for O(log n) timeline query performance
        if (oldVersion < 2) {
          const transaction = (event.target as IDBOpenDBRequest).transaction;
          if (transaction) {
            const feedStore = transaction.objectStore(STORES.FEED_ITEMS);

            // Compound index: (feedType, indexedAt) - for timeline queries sorted by time
            // Enables efficient "get all timeline posts sorted by date" queries
            // Performance: O(log n + k) instead of O(n) where k is result count
            if (!feedStore.indexNames.contains("feedType_indexedAt")) {
              feedStore.createIndex(
                "feedType_indexedAt",
                ["_feedType", "indexedAt"],
                { unique: false },
              );
            }

            // Compound index: (authorDid, indexedAt) - for author feed queries sorted by time
            // Enables efficient "get all posts by author X sorted by date" queries
            if (!feedStore.indexNames.contains("authorDid_indexedAt")) {
              feedStore.createIndex(
                "authorDid_indexedAt",
                ["author.did", "indexedAt"],
                { unique: false },
              );
            }
          }
        }

        // Version 3: Add thread summaries store for offline access
        if (!db.objectStoreNames.contains(STORES.THREAD_SUMMARIES)) {
          const summaryStore = db.createObjectStore(STORES.THREAD_SUMMARIES, {
            keyPath: "threadUri",
          });
          // Index by source for filtering bookmarked vs followed summaries
          summaryStore.createIndex("source", "source", { unique: false });
          // Index by cached time for eviction
          summaryStore.createIndex("_offlineCachedAt", "_offlineCachedAt", {
            unique: false,
          });
          // Index by last accessed time for LRU eviction
          summaryStore.createIndex("_lastAccessedAt", "_lastAccessedAt", {
            unique: false,
          });
          // Compound index for efficient source + time queries
          summaryStore.createIndex(
            "source_cachedAt",
            ["source", "_offlineCachedAt"],
            { unique: false },
          );
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

  private isQuotaExceededError(error: unknown): boolean {
    return error instanceof DOMException && error.name === "QuotaExceededError";
  }

  // ==================== Feed Item Operations ====================

  async saveFeedItems(
    items: Omit<OfflineFeedItem, "_offlineCachedAt">[],
    feedType: "timeline" | "author" | "list" = "timeline",
  ): Promise<void> {
    const doSave = () =>
      withIndexedDBRetry(async () => {
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

        return new Promise<void>((resolve, reject) => {
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => reject(transaction.error);
        });
      }, "saveFeedItems");

    try {
      return await doSave();
    } catch (error) {
      if (this.isQuotaExceededError(error)) {
        debug.log(
          "QuotaExceededError in saveFeedItems, running aggressive cleanup and retrying",
        );
        await this.enforceFeedLimit(Math.floor(LIMITS.MAX_FEED_ITEMS / 2));
        return await doSave();
      }
      throw error;
    }
  }

  async getFeedItems(
    limit = 50,
    feedType?: "timeline" | "author" | "list",
  ): Promise<OfflineFeedItem[]> {
    const db = this.ensureDb();
    const transaction = db.transaction([STORES.FEED_ITEMS], "readonly");
    const store = transaction.objectStore(STORES.FEED_ITEMS);

    const items: OfflineFeedItem[] = [];

    return new Promise((resolve, reject) => {
      // Use compound index if feedType is specified for O(log n + k) performance
      // Otherwise fall back to indexedAt index
      const hasCompoundIndex = store.indexNames.contains("feedType_indexedAt");

      if (feedType && hasCompoundIndex) {
        // Use compound index: range query on feedType with natural sorting by indexedAt
        const index = store.index("feedType_indexedAt");
        // Create a key range that matches all entries for this feed type
        const range = IDBKeyRange.bound([feedType, ""], [feedType, "\uffff"]);

        const request = index.openCursor(range, "prev");

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;

          if (cursor && items.length < limit) {
            items.push(cursor.value as OfflineFeedItem);
            cursor.continue();
          } else {
            resolve(items);
          }
        };

        request.onerror = () => reject(request.error);
      } else {
        // Fallback: use indexedAt index and filter manually
        const index = store.index("indexedAt");
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
      }
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
    const doSave = () =>
      withIndexedDBRetry(async () => {
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

        return new Promise<void>((resolve, reject) => {
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => reject(transaction.error);
        });
      }, "saveConversations");

    try {
      return await doSave();
    } catch (error) {
      if (this.isQuotaExceededError(error)) {
        debug.log(
          "QuotaExceededError in saveConversations, running aggressive cleanup and retrying",
        );
        await this.enforceConversationLimit(
          Math.floor(LIMITS.MAX_DM_CONVERSATIONS / 2),
        );
        return await doSave();
      }
      throw error;
    }
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
    const doSave = () =>
      withIndexedDBRetry(async () => {
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

        return new Promise<void>((resolve, reject) => {
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => reject(transaction.error);
        });
      }, "saveMessages");

    try {
      return await doSave();
    } catch (error) {
      if (this.isQuotaExceededError(error)) {
        debug.log(
          "QuotaExceededError in saveMessages, running aggressive cleanup and retrying",
        );
        await this.evictOldMessages();
        return await doSave();
      }
      throw error;
    }
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

  // ==================== Thread Summary Operations ====================

  async saveThreadSummary(
    summary: Omit<OfflineThreadSummary, "_offlineCachedAt" | "_lastAccessedAt">,
  ): Promise<void> {
    const doSave = () =>
      withIndexedDBRetry(async () => {
        const db = this.ensureDb();
        const transaction = db.transaction(
          [STORES.THREAD_SUMMARIES, STORES.METADATA],
          "readwrite",
        );
        const store = transaction.objectStore(STORES.THREAD_SUMMARIES);
        const metaStore = transaction.objectStore(STORES.METADATA);

        const now = Date.now();

        const offlineSummary: OfflineThreadSummary = {
          ...summary,
          _offlineCachedAt: now,
          _lastAccessedAt: now,
        };
        store.put(offlineSummary);

        // Update metadata
        const existingMeta = await this.getMetadataInTransaction(
          metaStore,
          "thread_summaries",
        );
        const newMeta: OfflineMetadata = {
          key: "thread_summaries",
          lastSyncAt: now,
          itemCount: (existingMeta?.itemCount || 0) + 1,
        };
        metaStore.put(newMeta);

        return new Promise<void>((resolve, reject) => {
          transaction.oncomplete = () => {
            debug.log(`Cached thread summary for: ${summary.threadUri}`);
            resolve();
          };
          transaction.onerror = () => reject(transaction.error);
        });
      }, "saveThreadSummary");

    try {
      return await doSave();
    } catch (error) {
      if (this.isQuotaExceededError(error)) {
        debug.log(
          "QuotaExceededError in saveThreadSummary, running aggressive cleanup and retrying",
        );
        await this.enforceSummaryLimit(
          Math.floor(LIMITS.MAX_THREAD_SUMMARIES / 2),
        );
        return await doSave();
      }
      throw error;
    }
  }

  async getThreadSummary(
    threadUri: string,
  ): Promise<OfflineThreadSummary | null> {
    const db = this.ensureDb();
    const transaction = db.transaction([STORES.THREAD_SUMMARIES], "readwrite");
    const store = transaction.objectStore(STORES.THREAD_SUMMARIES);

    return new Promise((resolve, reject) => {
      const request = store.get(threadUri);

      request.onsuccess = () => {
        const summary = request.result as OfflineThreadSummary | undefined;
        if (summary) {
          // Update last accessed time
          summary._lastAccessedAt = Date.now();
          store.put(summary);
          resolve(summary);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  async hasThreadSummary(threadUri: string): Promise<boolean> {
    const db = this.ensureDb();
    const transaction = db.transaction([STORES.THREAD_SUMMARIES], "readonly");
    const store = transaction.objectStore(STORES.THREAD_SUMMARIES);

    return new Promise((resolve, reject) => {
      const request = store.count(IDBKeyRange.only(threadUri));
      request.onsuccess = () => resolve(request.result > 0);
      request.onerror = () => reject(request.error);
    });
  }

  async getThreadSummaries(
    source?: ThreadSummarySource,
    limit = 50,
  ): Promise<OfflineThreadSummary[]> {
    const db = this.ensureDb();
    const transaction = db.transaction([STORES.THREAD_SUMMARIES], "readwrite");
    const store = transaction.objectStore(STORES.THREAD_SUMMARIES);

    const summaries: OfflineThreadSummary[] = [];
    const now = Date.now();

    return new Promise((resolve, reject) => {
      if (source) {
        // Use compound index for filtering by source
        const index = store.index("source_cachedAt");
        const range = IDBKeyRange.bound([source, 0], [source, now]);
        const request = index.openCursor(range, "prev");

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;

          if (cursor && summaries.length < limit) {
            const summary = cursor.value as OfflineThreadSummary;
            // Update last accessed time for LRU accuracy
            summary._lastAccessedAt = now;
            store.put(summary);
            summaries.push(summary);
            cursor.continue();
          } else {
            resolve(summaries);
          }
        };

        request.onerror = () => reject(request.error);
      } else {
        // Get all summaries sorted by cached time
        const index = store.index("_offlineCachedAt");
        const request = index.openCursor(null, "prev");

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;

          if (cursor && summaries.length < limit) {
            const summary = cursor.value as OfflineThreadSummary;
            // Update last accessed time for LRU accuracy
            summary._lastAccessedAt = now;
            store.put(summary);
            summaries.push(summary);
            cursor.continue();
          } else {
            resolve(summaries);
          }
        };

        request.onerror = () => reject(request.error);
      }
    });
  }

  async deleteThreadSummary(threadUri: string): Promise<void> {
    return withIndexedDBRetry(async () => {
      const db = this.ensureDb();
      const transaction = db.transaction(
        [STORES.THREAD_SUMMARIES],
        "readwrite",
      );
      const store = transaction.objectStore(STORES.THREAD_SUMMARIES);

      return new Promise<void>((resolve, reject) => {
        const request = store.delete(threadUri);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }, "deleteThreadSummary");
  }

  async getThreadSummaryCount(): Promise<number> {
    const db = this.ensureDb();
    const transaction = db.transaction([STORES.THREAD_SUMMARIES], "readonly");
    const store = transaction.objectStore(STORES.THREAD_SUMMARIES);

    return new Promise((resolve, reject) => {
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
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
        STORES.THREAD_SUMMARIES,
        STORES.METADATA,
      ],
      "readonly",
    );

    const feedStore = transaction.objectStore(STORES.FEED_ITEMS);
    const convoStore = transaction.objectStore(STORES.DM_CONVERSATIONS);
    const msgStore = transaction.objectStore(STORES.DM_MESSAGES);
    const summaryStore = transaction.objectStore(STORES.THREAD_SUMMARIES);
    const metaStore = transaction.objectStore(STORES.METADATA);

    const [
      feedCount,
      convoCount,
      msgCount,
      summaryCount,
      feedMeta,
      dmMeta,
      summaryMeta,
    ] = await Promise.all([
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
      new Promise<number>((resolve, reject) => {
        const req = summaryStore.count();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
      this.getMetadataInTransaction(metaStore, "feed_timeline"),
      this.getMetadataInTransaction(metaStore, "dm_conversations"),
      this.getMetadataInTransaction(metaStore, "thread_summaries"),
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
      summaryCount,
      lastFeedSync: feedMeta?.lastSyncAt || null,
      lastDMSync: dmMeta?.lastSyncAt || null,
      lastSummarySync: summaryMeta?.lastSyncAt || null,
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

  async evictOldSummaries(): Promise<number> {
    const db = this.ensureDb();
    const transaction = db.transaction([STORES.THREAD_SUMMARIES], "readwrite");
    const store = transaction.objectStore(STORES.THREAD_SUMMARIES);
    const index = store.index("_offlineCachedAt");

    const cutoffTime =
      Date.now() - LIMITS.SUMMARY_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
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
          debug.log(`Evicted ${deletedCount} old thread summaries`);
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
    // Enforce summary limit
    await this.enforceSummaryLimit();
    // Clean up old items
    await this.evictOldFeedItems();
    await this.evictOldMessages();
    await this.evictOldSummaries();
  }

  private async enforceFeedLimit(
    maxItems: number = LIMITS.MAX_FEED_ITEMS,
  ): Promise<void> {
    const db = this.ensureDb();
    const transaction = db.transaction([STORES.FEED_ITEMS], "readwrite");
    const store = transaction.objectStore(STORES.FEED_ITEMS);

    const count = await new Promise<number>((resolve, reject) => {
      const req = store.count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    if (count > maxItems) {
      const index = store.index("_offlineCachedAt");
      const deleteCount = count - maxItems;
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

  private async enforceConversationLimit(
    maxConversations: number = LIMITS.MAX_DM_CONVERSATIONS,
  ): Promise<void> {
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

    if (count > maxConversations) {
      const index = convoStore.index("_offlineCachedAt");
      const deleteCount = count - maxConversations;
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

  private async enforceSummaryLimit(
    maxSummaries: number = LIMITS.MAX_THREAD_SUMMARIES,
  ): Promise<void> {
    const db = this.ensureDb();
    const transaction = db.transaction([STORES.THREAD_SUMMARIES], "readwrite");
    const store = transaction.objectStore(STORES.THREAD_SUMMARIES);

    const count = await new Promise<number>((resolve, reject) => {
      const req = store.count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    if (count > maxSummaries) {
      // Use LRU eviction based on last accessed time
      const index = store.index("_lastAccessedAt");
      const deleteCount = count - maxSummaries;
      let deleted = 0;

      await new Promise<void>((resolve, reject) => {
        const request = index.openCursor(null, "next"); // Oldest accessed first

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

      debug.log(`Enforced summary limit: removed ${deleted} summaries (LRU)`);
    }
  }

  async clearAll(): Promise<void> {
    return withIndexedDBRetry(async () => {
      const db = this.ensureDb();
      const transaction = db.transaction(
        [
          STORES.FEED_ITEMS,
          STORES.DM_CONVERSATIONS,
          STORES.DM_MESSAGES,
          STORES.THREAD_SUMMARIES,
          STORES.METADATA,
        ],
        "readwrite",
      );

      transaction.objectStore(STORES.FEED_ITEMS).clear();
      transaction.objectStore(STORES.DM_CONVERSATIONS).clear();
      transaction.objectStore(STORES.DM_MESSAGES).clear();
      transaction.objectStore(STORES.THREAD_SUMMARIES).clear();
      transaction.objectStore(STORES.METADATA).clear();

      return new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => {
          debug.log("Cleared all offline storage");
          resolve();
        };
        transaction.onerror = () => reject(transaction.error);
      });
    }, "clearAll");
  }
}

export const offlineStorageDB = OfflineStorageDB.getInstance();
