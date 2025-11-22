import { debug } from "@bsky/shared";

export interface CachedMedia {
  url: string; // Primary key - the original media URL
  blob: Blob; // The actual media data
  mimeType: string; // Media MIME type (image/jpeg, video/mp4, etc.)
  size: number; // Size in bytes
  width?: number; // Image/video width
  height?: number; // Image/video height
  cachedAt: number; // Timestamp when cached
  lastAccessedAt: number; // Timestamp of last access (for LRU)
  accessCount: number; // Number of times accessed
}

interface MediaCacheMeta {
  id: string;
  totalSize: number; // Total size in bytes
  totalItems: number; // Total number of cached items
  maxSize: number; // Maximum cache size in bytes (default 100MB)
  lastCleanup: number; // Last time LRU cleanup was performed
}

export class MediaStorageDB {
  private static instance: MediaStorageDB;
  private db: IDBDatabase | null = null;
  private readonly DB_NAME = "bsky_media_cache_db";
  private readonly DB_VERSION = 1;

  // Store names
  private readonly MEDIA_STORE = "media";
  private readonly META_STORE = "metadata";

  // Index names
  private readonly LAST_ACCESSED_INDEX = "by_last_accessed";
  private readonly MIME_TYPE_INDEX = "by_mime_type";
  private readonly SIZE_INDEX = "by_size";

  // Default max cache size: 100MB
  private readonly DEFAULT_MAX_SIZE = 100 * 1024 * 1024;

  private constructor() {}

  static getInstance(): MediaStorageDB {
    if (!MediaStorageDB.instance) {
      MediaStorageDB.instance = new MediaStorageDB();
    }
    return MediaStorageDB.instance;
  }

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => {
        debug.error("Failed to open media cache IndexedDB:", request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create media store
        if (!db.objectStoreNames.contains(this.MEDIA_STORE)) {
          const mediaStore = db.createObjectStore(this.MEDIA_STORE, {
            keyPath: "url",
          });

          // Create indexes for efficient querying
          mediaStore.createIndex(this.LAST_ACCESSED_INDEX, "lastAccessedAt", {
            unique: false,
          });
          mediaStore.createIndex(this.MIME_TYPE_INDEX, "mimeType", {
            unique: false,
          });
          mediaStore.createIndex(this.SIZE_INDEX, "size", {
            unique: false,
          });
        }

        // Create metadata store
        if (!db.objectStoreNames.contains(this.META_STORE)) {
          db.createObjectStore(this.META_STORE, { keyPath: "id" });
        }
      };
    });
  }

  private ensureDB(): void {
    if (!this.db) {
      throw new Error("Database not initialized. Call init() first.");
    }
  }

  // Save media to cache
  async saveMedia(media: CachedMedia): Promise<void> {
    this.ensureDB();

    const transaction = this.db!.transaction([this.MEDIA_STORE], "readwrite");
    const store = transaction.objectStore(this.MEDIA_STORE);

    return new Promise((resolve, reject) => {
      const request = store.put(media);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Get media from cache
  async getMedia(url: string): Promise<CachedMedia | null> {
    this.ensureDB();

    const transaction = this.db!.transaction([this.MEDIA_STORE], "readwrite");
    const store = transaction.objectStore(this.MEDIA_STORE);

    return new Promise((resolve, reject) => {
      const getRequest = store.get(url);

      getRequest.onsuccess = () => {
        const media = getRequest.result as CachedMedia | undefined;

        if (media) {
          // Update last accessed time and access count
          media.lastAccessedAt = Date.now();
          media.accessCount++;

          const updateRequest = store.put(media);
          updateRequest.onsuccess = () => resolve(media);
          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          resolve(null);
        }
      };

      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  // Check if media is cached
  async hasMedia(url: string): Promise<boolean> {
    this.ensureDB();

    const transaction = this.db!.transaction([this.MEDIA_STORE], "readonly");
    const store = transaction.objectStore(this.MEDIA_STORE);

    return new Promise((resolve, reject) => {
      const request = store.count(IDBKeyRange.only(url));
      request.onsuccess = () => resolve(request.result > 0);
      request.onerror = () => reject(request.error);
    });
  }

  // Get metadata
  async getMetadata(): Promise<MediaCacheMeta> {
    this.ensureDB();

    const transaction = this.db!.transaction([this.META_STORE], "readonly");
    const store = transaction.objectStore(this.META_STORE);

    return new Promise((resolve, reject) => {
      const request = store.get("main");
      request.onsuccess = () => {
        const meta = request.result as MediaCacheMeta | undefined;
        resolve(
          meta || {
            id: "main",
            totalSize: 0,
            totalItems: 0,
            maxSize: this.DEFAULT_MAX_SIZE,
            lastCleanup: Date.now(),
          },
        );
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Save metadata
  async saveMetadata(meta: MediaCacheMeta): Promise<void> {
    this.ensureDB();

    const transaction = this.db!.transaction([this.META_STORE], "readwrite");
    const store = transaction.objectStore(this.META_STORE);

    return new Promise((resolve, reject) => {
      const request = store.put(meta);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Update metadata with current totals
  async updateMetadata(): Promise<void> {
    const stats = await this.getStats();
    const meta = await this.getMetadata();

    meta.totalSize = stats.totalSize;
    meta.totalItems = stats.totalItems;

    await this.saveMetadata(meta);
  }

  // Get least recently used items
  async getLRUItems(limit: number): Promise<CachedMedia[]> {
    this.ensureDB();

    const transaction = this.db!.transaction([this.MEDIA_STORE], "readonly");
    const store = transaction.objectStore(this.MEDIA_STORE);
    const index = store.index(this.LAST_ACCESSED_INDEX);

    return new Promise((resolve, reject) => {
      const items: CachedMedia[] = [];
      const request = index.openCursor(null, "next"); // Ascending order (oldest first)

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;

        if (cursor && items.length < limit) {
          items.push(cursor.value);
          cursor.continue();
        } else {
          resolve(items);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  // Delete media by URL
  async deleteMedia(url: string): Promise<void> {
    this.ensureDB();

    const transaction = this.db!.transaction([this.MEDIA_STORE], "readwrite");
    const store = transaction.objectStore(this.MEDIA_STORE);

    return new Promise((resolve, reject) => {
      const request = store.delete(url);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Delete multiple media items
  async deleteMultipleMedia(urls: string[]): Promise<void> {
    this.ensureDB();

    const transaction = this.db!.transaction([this.MEDIA_STORE], "readwrite");
    const store = transaction.objectStore(this.MEDIA_STORE);

    return new Promise((resolve, reject) => {
      let completed = 0;

      urls.forEach((url) => {
        const request = store.delete(url);

        request.onsuccess = () => {
          completed++;
          if (completed === urls.length) {
            resolve();
          }
        };

        request.onerror = () => reject(request.error);
      });

      if (urls.length === 0) {
        resolve();
      }
    });
  }

  // Clear all cached media
  async clearAll(): Promise<void> {
    this.ensureDB();

    const transaction = this.db!.transaction(
      [this.MEDIA_STORE, this.META_STORE],
      "readwrite",
    );

    return new Promise((resolve, reject) => {
      let completed = 0;
      const stores = [this.MEDIA_STORE, this.META_STORE];

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
  }

  // Get storage statistics
  async getStats(): Promise<{
    totalItems: number;
    totalSize: number;
    maxSize: number;
    usedPercentage: number;
    mediaByType: Record<string, { count: number; size: number }>;
    oldestItem: Date | null;
    newestItem: Date | null;
    mostAccessed: CachedMedia | null;
  }> {
    this.ensureDB();

    const transaction = this.db!.transaction([this.MEDIA_STORE], "readonly");
    const store = transaction.objectStore(this.MEDIA_STORE);
    const meta = await this.getMetadata();

    return new Promise((resolve, reject) => {
      const stats = {
        totalItems: 0,
        totalSize: 0,
        maxSize: meta.maxSize,
        usedPercentage: 0,
        mediaByType: {} as Record<string, { count: number; size: number }>,
        oldestItem: null as Date | null,
        newestItem: null as Date | null,
        mostAccessed: null as CachedMedia | null,
      };

      const countRequest = store.count();
      countRequest.onsuccess = () => {
        stats.totalItems = countRequest.result;
      };

      const cursorRequest = store.openCursor();
      cursorRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;

        if (cursor) {
          const media = cursor.value as CachedMedia;

          // Accumulate size
          stats.totalSize += media.size;

          // Count by MIME type
          if (!stats.mediaByType[media.mimeType]) {
            stats.mediaByType[media.mimeType] = { count: 0, size: 0 };
          }
          stats.mediaByType[media.mimeType].count++;
          stats.mediaByType[media.mimeType].size += media.size;

          // Track dates
          const cachedDate = new Date(media.cachedAt);
          if (!stats.oldestItem || cachedDate < stats.oldestItem) {
            stats.oldestItem = cachedDate;
          }
          if (!stats.newestItem || cachedDate > stats.newestItem) {
            stats.newestItem = cachedDate;
          }

          // Track most accessed
          if (
            !stats.mostAccessed ||
            media.accessCount > stats.mostAccessed.accessCount
          ) {
            stats.mostAccessed = media;
          }

          cursor.continue();
        } else {
          stats.usedPercentage = (stats.totalSize / stats.maxSize) * 100;
          resolve(stats);
        }
      };

      cursorRequest.onerror = () => reject(cursorRequest.error);
    });
  }

  // Get all media URLs (for preloading checks)
  async getAllMediaUrls(): Promise<string[]> {
    this.ensureDB();

    const transaction = this.db!.transaction([this.MEDIA_STORE], "readonly");
    const store = transaction.objectStore(this.MEDIA_STORE);

    return new Promise((resolve, reject) => {
      const request = store.getAllKeys();

      request.onsuccess = () => {
        resolve(request.result as string[]);
      };

      request.onerror = () => reject(request.error);
    });
  }
}
