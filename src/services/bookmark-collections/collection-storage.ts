/**
 * Bookmark Collection Storage
 *
 * IndexedDB-based storage for bookmark collections and their mappings.
 * Collections are synced to AT Protocol via com.shadowsky.bookmarkCollections
 * singleton record so they persist across devices and survive device wipes.
 */

import { createLogger } from "../../utils/logger";
import { withIndexedDBRetry } from "../../utils/storage-retry";
import { bookmarkCollectionSyncService } from "./collection-sync";
import { BookmarkCollection, BookmarkCollectionMapping } from "./types";

const logger = createLogger("CollectionStorage");

const DB_NAME = "BskyBookmarkCollections";
const DB_VERSION = 1;

const STORES = {
  COLLECTIONS: "collections",
  MAPPINGS: "collectionMappings",
} as const;

export class BookmarkCollectionStorage {
  private static instance: BookmarkCollectionStorage;
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  private constructor() {}

  static getInstance(): BookmarkCollectionStorage {
    if (!BookmarkCollectionStorage.instance) {
      BookmarkCollectionStorage.instance = new BookmarkCollectionStorage();
    }
    return BookmarkCollectionStorage.instance;
  }

  async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        logger.error("Failed to open CollectionStorage:", request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        logger.log("CollectionStorage initialized");
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Collections store
        if (!db.objectStoreNames.contains(STORES.COLLECTIONS)) {
          const collectionsStore = db.createObjectStore(STORES.COLLECTIONS, {
            keyPath: "id",
          });
          collectionsStore.createIndex("name", "name", { unique: false });
          collectionsStore.createIndex("createdAt", "createdAt", {
            unique: false,
          });
          collectionsStore.createIndex("updatedAt", "updatedAt", {
            unique: false,
          });
        }

        // Mappings store (bookmark URI -> collection ID)
        if (!db.objectStoreNames.contains(STORES.MAPPINGS)) {
          const mappingsStore = db.createObjectStore(STORES.MAPPINGS, {
            keyPath: ["bookmarkUri", "collectionId"],
          });
          mappingsStore.createIndex("bookmarkUri", "bookmarkUri", {
            unique: false,
          });
          mappingsStore.createIndex("collectionId", "collectionId", {
            unique: false,
          });
          mappingsStore.createIndex("addedAt", "addedAt", { unique: false });
        }
      };
    });

    return this.initPromise;
  }

  private ensureDb(): IDBDatabase {
    if (!this.db) {
      throw new Error("CollectionStorage not initialized. Call init() first.");
    }
    return this.db;
  }

  // ==================== AT Proto Sync ====================

  /**
   * Fire-and-forget push of current local state to the AT Proto server.
   * Called after every mutating operation to keep the server in sync.
   */
  private syncToServer(): void {
    this.exportData()
      .then(({ collections, mappings }) => {
        return bookmarkCollectionSyncService.pushToServer(
          collections,
          mappings,
        );
      })
      .catch((error) => {
        logger.error("Background sync to server failed:", error);
      });
  }

  /**
   * Merge server collections with local on startup.
   * Fetches from AT Proto, merges with local data (union strategy),
   * writes merged result to both local and server.
   */
  async syncFromServer(): Promise<void> {
    const serverData = await bookmarkCollectionSyncService.fetchFromServer();
    if (!serverData) return;

    const localData = await this.exportData();

    // If both are empty, nothing to do
    if (
      localData.collections.length === 0 &&
      localData.mappings.length === 0 &&
      serverData.collections.length === 0 &&
      serverData.mappings.length === 0
    ) {
      return;
    }

    const merged = bookmarkCollectionSyncService.mergeData(
      localData,
      serverData,
    );

    // Write merged data to local storage
    await this.importData(merged);

    // Push merged result back to server
    bookmarkCollectionSyncService
      .pushToServer(merged.collections, merged.mappings)
      .catch((error) => {
        logger.error("Failed to push merged data to server:", error);
      });

    logger.log(
      `Synced collections from server: ${merged.collections.length} collections, ${merged.mappings.length} mappings`,
    );
  }

  // ==================== Collection CRUD ====================

  async createCollection(
    collection: Omit<
      BookmarkCollection,
      "id" | "createdAt" | "updatedAt" | "bookmarkCount"
    >,
  ): Promise<BookmarkCollection> {
    const result = await withIndexedDBRetry(async () => {
      const db = this.ensureDb();
      const transaction = db.transaction([STORES.COLLECTIONS], "readwrite");
      const store = transaction.objectStore(STORES.COLLECTIONS);

      const now = new Date().toISOString();
      const newCollection: BookmarkCollection = {
        ...collection,
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
        bookmarkCount: 0,
      };

      return new Promise<BookmarkCollection>((resolve, reject) => {
        const request = store.add(newCollection);
        request.onsuccess = () => {
          logger.log(`Created collection: ${newCollection.name}`);
          resolve(newCollection);
        };
        request.onerror = () => reject(request.error);
      });
    }, "createCollection");

    this.syncToServer();
    return result;
  }

  async getCollection(id: string): Promise<BookmarkCollection | null> {
    const db = this.ensureDb();
    const transaction = db.transaction([STORES.COLLECTIONS], "readonly");
    const store = transaction.objectStore(STORES.COLLECTIONS);

    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllCollections(): Promise<BookmarkCollection[]> {
    const db = this.ensureDb();
    const transaction = db.transaction([STORES.COLLECTIONS], "readonly");
    const store = transaction.objectStore(STORES.COLLECTIONS);
    const index = store.index("createdAt");

    return new Promise((resolve, reject) => {
      const request = index.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async updateCollection(
    id: string,
    updates: Partial<
      Omit<BookmarkCollection, "id" | "createdAt" | "bookmarkCount">
    >,
  ): Promise<BookmarkCollection | null> {
    const result = await withIndexedDBRetry(async () => {
      const existing = await this.getCollection(id);
      if (!existing) return null;

      const db = this.ensureDb();
      const transaction = db.transaction([STORES.COLLECTIONS], "readwrite");
      const store = transaction.objectStore(STORES.COLLECTIONS);

      const updated: BookmarkCollection = {
        ...existing,
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      return new Promise<BookmarkCollection>((resolve, reject) => {
        const request = store.put(updated);
        request.onsuccess = () => {
          logger.log(`Updated collection: ${updated.name}`);
          resolve(updated);
        };
        request.onerror = () => reject(request.error);
      });
    }, "updateCollection");

    if (result) {
      this.syncToServer();
    }
    return result;
  }

  async deleteCollection(id: string): Promise<void> {
    await withIndexedDBRetry(async () => {
      const db = this.ensureDb();
      const transaction = db.transaction(
        [STORES.COLLECTIONS, STORES.MAPPINGS],
        "readwrite",
      );
      const collectionsStore = transaction.objectStore(STORES.COLLECTIONS);
      const mappingsStore = transaction.objectStore(STORES.MAPPINGS);

      // Delete all mappings for this collection
      const mappingsIndex = mappingsStore.index("collectionId");
      const mappingsCursor = mappingsIndex.openCursor(IDBKeyRange.only(id));

      await new Promise<void>((resolve, reject) => {
        mappingsCursor.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          if (cursor) {
            cursor.delete();
            cursor.continue();
          } else {
            resolve();
          }
        };
        mappingsCursor.onerror = () => reject(mappingsCursor.error);
      });

      // Delete the collection
      return new Promise<void>((resolve, reject) => {
        const request = collectionsStore.delete(id);
        request.onsuccess = () => {
          logger.log(`Deleted collection: ${id}`);
          resolve();
        };
        request.onerror = () => reject(request.error);
      });
    }, "deleteCollection");

    this.syncToServer();
  }

  // ==================== Bookmark-Collection Mappings ====================

  async addBookmarkToCollection(
    bookmarkUri: string,
    collectionId: string,
  ): Promise<void> {
    await withIndexedDBRetry(async () => {
      const db = this.ensureDb();
      const transaction = db.transaction(
        [STORES.MAPPINGS, STORES.COLLECTIONS],
        "readwrite",
      );
      const mappingsStore = transaction.objectStore(STORES.MAPPINGS);
      const collectionsStore = transaction.objectStore(STORES.COLLECTIONS);

      const mapping: BookmarkCollectionMapping = {
        bookmarkUri,
        collectionId,
        addedAt: new Date().toISOString(),
      };

      // Add the mapping
      await new Promise<void>((resolve, reject) => {
        const request = mappingsStore.put(mapping);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      // Update collection bookmark count
      const collection = await new Promise<BookmarkCollection | null>(
        (resolve, reject) => {
          const request = collectionsStore.get(collectionId);
          request.onsuccess = () => resolve(request.result || null);
          request.onerror = () => reject(request.error);
        },
      );

      if (collection) {
        collection.bookmarkCount =
          await this.getCollectionBookmarkCount(collectionId);
        collection.updatedAt = new Date().toISOString();
        await new Promise<void>((resolve, reject) => {
          const request = collectionsStore.put(collection);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      }

      logger.log(`Added bookmark to collection: ${collectionId}`);
    }, "addBookmarkToCollection");

    this.syncToServer();
  }

  async removeBookmarkFromCollection(
    bookmarkUri: string,
    collectionId: string,
  ): Promise<void> {
    await withIndexedDBRetry(async () => {
      const db = this.ensureDb();
      const transaction = db.transaction(
        [STORES.MAPPINGS, STORES.COLLECTIONS],
        "readwrite",
      );
      const mappingsStore = transaction.objectStore(STORES.MAPPINGS);
      const collectionsStore = transaction.objectStore(STORES.COLLECTIONS);

      // Remove the mapping
      await new Promise<void>((resolve, reject) => {
        const request = mappingsStore.delete([bookmarkUri, collectionId]);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      // Update collection bookmark count
      const collection = await new Promise<BookmarkCollection | null>(
        (resolve, reject) => {
          const request = collectionsStore.get(collectionId);
          request.onsuccess = () => resolve(request.result || null);
          request.onerror = () => reject(request.error);
        },
      );

      if (collection) {
        collection.bookmarkCount =
          await this.getCollectionBookmarkCount(collectionId);
        collection.updatedAt = new Date().toISOString();
        await new Promise<void>((resolve, reject) => {
          const request = collectionsStore.put(collection);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      }

      logger.log(`Removed bookmark from collection: ${collectionId}`);
    }, "removeBookmarkFromCollection");

    this.syncToServer();
  }

  async removeBookmarkFromAllCollections(bookmarkUri: string): Promise<void> {
    await withIndexedDBRetry(async () => {
      const db = this.ensureDb();
      const transaction = db.transaction([STORES.MAPPINGS], "readwrite");
      const store = transaction.objectStore(STORES.MAPPINGS);
      const index = store.index("bookmarkUri");

      return new Promise<void>((resolve, reject) => {
        const request = index.openCursor(IDBKeyRange.only(bookmarkUri));

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          if (cursor) {
            cursor.delete();
            cursor.continue();
          } else {
            logger.log(`Removed bookmark from all collections: ${bookmarkUri}`);
            resolve();
          }
        };

        request.onerror = () => reject(request.error);
      });
    }, "removeBookmarkFromAllCollections");

    this.syncToServer();
  }

  async getBookmarkCollections(bookmarkUri: string): Promise<string[]> {
    const db = this.ensureDb();
    const transaction = db.transaction([STORES.MAPPINGS], "readonly");
    const store = transaction.objectStore(STORES.MAPPINGS);
    const index = store.index("bookmarkUri");

    return new Promise((resolve, reject) => {
      const request = index.getAll(IDBKeyRange.only(bookmarkUri));
      request.onsuccess = () => {
        const mappings = request.result as BookmarkCollectionMapping[];
        resolve(mappings.map((m) => m.collectionId));
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getCollectionBookmarks(collectionId: string): Promise<string[]> {
    const db = this.ensureDb();
    const transaction = db.transaction([STORES.MAPPINGS], "readonly");
    const store = transaction.objectStore(STORES.MAPPINGS);
    const index = store.index("collectionId");

    return new Promise((resolve, reject) => {
      const request = index.getAll(IDBKeyRange.only(collectionId));
      request.onsuccess = () => {
        const mappings = request.result as BookmarkCollectionMapping[];
        resolve(mappings.map((m) => m.bookmarkUri));
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getCollectionBookmarkCount(collectionId: string): Promise<number> {
    const db = this.ensureDb();
    const transaction = db.transaction([STORES.MAPPINGS], "readonly");
    const store = transaction.objectStore(STORES.MAPPINGS);
    const index = store.index("collectionId");

    return new Promise((resolve, reject) => {
      const request = index.count(IDBKeyRange.only(collectionId));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getUncategorizedBookmarks(
    allBookmarkUris: string[],
  ): Promise<string[]> {
    const db = this.ensureDb();
    const transaction = db.transaction([STORES.MAPPINGS], "readonly");
    const store = transaction.objectStore(STORES.MAPPINGS);
    const index = store.index("bookmarkUri");

    const categorizedUris = new Set<string>();

    // Get all bookmark URIs that are in at least one collection
    for (const uri of allBookmarkUris) {
      const count = await new Promise<number>((resolve, reject) => {
        const request = index.count(IDBKeyRange.only(uri));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      if (count > 0) {
        categorizedUris.add(uri);
      }
    }

    // Return bookmarks not in any collection
    return allBookmarkUris.filter((uri) => !categorizedUris.has(uri));
  }

  // ==================== Utility Methods ====================

  async clearAll(): Promise<void> {
    await withIndexedDBRetry(async () => {
      const db = this.ensureDb();
      const transaction = db.transaction(
        [STORES.COLLECTIONS, STORES.MAPPINGS],
        "readwrite",
      );

      transaction.objectStore(STORES.COLLECTIONS).clear();
      transaction.objectStore(STORES.MAPPINGS).clear();

      return new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => {
          logger.log("Cleared all collection storage");
          resolve();
        };
        transaction.onerror = () => reject(transaction.error);
      });
    }, "clearAll");

    this.syncToServer();
  }

  async exportData(): Promise<{
    collections: BookmarkCollection[];
    mappings: BookmarkCollectionMapping[];
  }> {
    const collections = await this.getAllCollections();

    const db = this.ensureDb();
    const transaction = db.transaction([STORES.MAPPINGS], "readonly");
    const store = transaction.objectStore(STORES.MAPPINGS);

    const mappings = await new Promise<BookmarkCollectionMapping[]>(
      (resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      },
    );

    return { collections, mappings };
  }

  async importData(data: {
    collections: BookmarkCollection[];
    mappings: BookmarkCollectionMapping[];
  }): Promise<void> {
    return withIndexedDBRetry(async () => {
      const db = this.ensureDb();
      const transaction = db.transaction(
        [STORES.COLLECTIONS, STORES.MAPPINGS],
        "readwrite",
      );
      const collectionsStore = transaction.objectStore(STORES.COLLECTIONS);
      const mappingsStore = transaction.objectStore(STORES.MAPPINGS);

      // Clear existing data before import to ensure clean state
      collectionsStore.clear();
      mappingsStore.clear();

      for (const collection of data.collections) {
        collectionsStore.put(collection);
      }

      for (const mapping of data.mappings) {
        mappingsStore.put(mapping);
      }

      return new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => {
          logger.log("Imported collection data");
          resolve();
        };
        transaction.onerror = () => reject(transaction.error);
      });
    }, "importData");
  }
}

export const bookmarkCollectionStorage =
  BookmarkCollectionStorage.getInstance();
