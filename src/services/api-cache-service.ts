/**
 * API Cache Service
 *
 * Provides programmatic control over API response caching for offline-first architecture.
 * Uses IndexedDB (via Dexie.js) for scalable caching with proper TTL management.
 *
 * Features:
 * - IndexedDB-backed cache with no practical size limits
 * - Write-time timestamps for reliable TTL expiration
 * - Automatic TTL expiration on read operations
 * - LRU eviction when storage exceeds configurable thresholds
 * - Offline status detection and event handling
 * - Cache statistics and monitoring
 */

import Dexie, { type Table } from "dexie";
import { createLogger } from "../utils/logger";
import { withIndexedDBRetry } from "../utils/storage-retry";

const logger = createLogger("APICacheService");

// Cache name constants (for organizing different cache types)
export const CACHE_NAMES = {
  API: "api",
  CHAT: "chat",
  CDN_IMAGES: "cdn-images",
  AVATARS: "avatars",
} as const;

export type CacheType = (typeof CACHE_NAMES)[keyof typeof CACHE_NAMES];

// Cache limits
export const CACHE_LIMITS = {
  API_MAX_ENTRIES: 200,
  CHAT_MAX_ENTRIES: 100,
  CDN_MAX_ENTRIES: 500,
  AVATAR_MAX_ENTRIES: 200,
  API_MAX_AGE_MS: 60 * 60 * 1000, // 1 hour
  CHAT_MAX_AGE_MS: 15 * 60 * 1000, // 15 minutes
  CDN_MAX_AGE_MS: 30 * 24 * 60 * 60 * 1000, // 30 days
  AVATAR_MAX_AGE_MS: 7 * 24 * 60 * 60 * 1000, // 7 days
  // Storage threshold for LRU eviction (50MB)
  STORAGE_THRESHOLD_BYTES: 50 * 1024 * 1024,
} as const;

// Map cache types to their limits
const CACHE_CONFIG: Record<
  CacheType,
  { maxEntries: number; maxAgeMs: number }
> = {
  [CACHE_NAMES.API]: {
    maxEntries: CACHE_LIMITS.API_MAX_ENTRIES,
    maxAgeMs: CACHE_LIMITS.API_MAX_AGE_MS,
  },
  [CACHE_NAMES.CHAT]: {
    maxEntries: CACHE_LIMITS.CHAT_MAX_ENTRIES,
    maxAgeMs: CACHE_LIMITS.CHAT_MAX_AGE_MS,
  },
  [CACHE_NAMES.CDN_IMAGES]: {
    maxEntries: CACHE_LIMITS.CDN_MAX_ENTRIES,
    maxAgeMs: CACHE_LIMITS.CDN_MAX_AGE_MS,
  },
  [CACHE_NAMES.AVATARS]: {
    maxEntries: CACHE_LIMITS.AVATAR_MAX_ENTRIES,
    maxAgeMs: CACHE_LIMITS.AVATAR_MAX_AGE_MS,
  },
};

/**
 * Cache entry stored in IndexedDB
 */
export interface CacheEntry {
  /** Unique identifier: cacheType + url hash */
  id: string;
  /** The cache type (api, chat, cdn-images, avatars) */
  cacheType: CacheType;
  /** The original URL */
  url: string;
  /** Timestamp when the entry was written */
  createdAt: number;
  /** Last access timestamp for LRU tracking */
  lastAccessedAt: number;
  /** HTTP status code */
  status: number;
  /** HTTP status text */
  statusText: string;
  /** Response headers as JSON string */
  headers: string;
  /** Response body as ArrayBuffer (stored as Blob in IndexedDB) */
  body: Blob;
  /** Estimated size in bytes */
  size: number;
}

export interface CacheStats {
  name: string;
  entryCount: number;
  estimatedSize: number;
}

export interface OfflineStatus {
  isOnline: boolean;
  lastOnlineAt: number | null;
  cachedFeedsAvailable: boolean;
  cachedDMsAvailable: boolean;
}

export interface CacheEvictionResult {
  cacheName: string;
  entriesRemoved: number;
  bytesFreed: number;
}

type OfflineStatusCallback = (status: OfflineStatus) => void;

/**
 * Dexie database for API caching
 */
class APICacheDB extends Dexie {
  cacheEntries!: Table<CacheEntry>;

  constructor() {
    super("APICacheDB");
    this.version(1).stores({
      // Indexes: id (primary), cacheType, url, createdAt, lastAccessedAt
      cacheEntries: "id, cacheType, url, createdAt, lastAccessedAt",
    });
  }
}

/**
 * Generate a unique cache entry ID
 */
function generateCacheId(cacheType: CacheType, url: string): string {
  return `${cacheType}:${url}`;
}

class APICacheService {
  private static instance: APICacheService;
  private db: APICacheDB | null = null;
  private offlineCallbacks: Set<OfflineStatusCallback> = new Set();
  private lastOnlineAt: number | null = null;
  private isInitialized = false;

  private constructor() {
    // Private constructor for singleton
  }

  static getInstance(): APICacheService {
    if (!APICacheService.instance) {
      APICacheService.instance = new APICacheService();
    }
    return APICacheService.instance;
  }

  /**
   * Initialize the cache service with event listeners and IndexedDB
   */
  async init(): Promise<void> {
    if (this.isInitialized) return;

    // Initialize IndexedDB
    this.db = new APICacheDB();
    await this.db.open();

    // Set up online/offline event listeners
    window.addEventListener("online", () =>
      this.handleOnlineStatusChange(true),
    );
    window.addEventListener("offline", () =>
      this.handleOnlineStatusChange(false),
    );

    // Track last online time
    if (navigator.onLine) {
      this.lastOnlineAt = Date.now();
    }

    this.isInitialized = true;
    logger.info("API Cache Service initialized with IndexedDB");
  }

  /**
   * Ensure database is initialized
   */
  private ensureDB(): APICacheDB {
    if (!this.db) {
      throw new Error("APICacheService not initialized. Call init() first.");
    }
    return this.db;
  }

  /**
   * Handle online/offline status changes
   */
  private async handleOnlineStatusChange(isOnline: boolean): Promise<void> {
    if (isOnline) {
      this.lastOnlineAt = Date.now();
      logger.info("Network connection restored");
    } else {
      logger.info("Network connection lost - using cached data");
    }

    // Notify all listeners
    const status = await this.getOfflineStatus();
    this.offlineCallbacks.forEach((callback) => callback(status));
  }

  /**
   * Subscribe to offline status changes
   */
  onOfflineStatusChange(callback: OfflineStatusCallback): () => void {
    this.offlineCallbacks.add(callback);
    return () => this.offlineCallbacks.delete(callback);
  }

  /**
   * Get current offline status and cache availability
   */
  async getOfflineStatus(): Promise<OfflineStatus> {
    const [feedsAvailable, dmsAvailable] = await Promise.all([
      this.hasCachedFeeds(),
      this.hasCachedDMs(),
    ]);

    return {
      isOnline: navigator.onLine,
      lastOnlineAt: this.lastOnlineAt,
      cachedFeedsAvailable: feedsAvailable,
      cachedDMsAvailable: dmsAvailable,
    };
  }

  /**
   * Check if we have cached feed data
   */
  async hasCachedFeeds(): Promise<boolean> {
    try {
      const db = this.ensureDB();
      const count = await db.cacheEntries
        .where("cacheType")
        .equals(CACHE_NAMES.API)
        .filter(
          (entry) =>
            entry.url.includes("app.bsky.feed") ||
            entry.url.includes("getTimeline") ||
            entry.url.includes("getAuthorFeed"),
        )
        .count();
      return count > 0;
    } catch {
      return false;
    }
  }

  /**
   * Check if we have cached DM data
   */
  async hasCachedDMs(): Promise<boolean> {
    try {
      const db = this.ensureDB();
      const count = await db.cacheEntries
        .where("cacheType")
        .equals(CACHE_NAMES.CHAT)
        .filter((entry) => entry.url.includes("chat.bsky.convo"))
        .count();
      return count > 0;
    } catch {
      return false;
    }
  }

  /**
   * Get statistics for all caches
   */
  async getCacheStats(): Promise<CacheStats[]> {
    const stats: CacheStats[] = [];
    const db = this.ensureDB();

    for (const cacheType of Object.values(CACHE_NAMES)) {
      try {
        const entries = await db.cacheEntries
          .where("cacheType")
          .equals(cacheType)
          .toArray();

        const totalSize = entries.reduce((sum, entry) => sum + entry.size, 0);

        stats.push({
          name: cacheType,
          entryCount: entries.length,
          estimatedSize: totalSize,
        });
      } catch (error) {
        logger.warn(`Failed to get stats for cache ${cacheType}:`, error);
      }
    }

    return stats;
  }

  /**
   * Get total cache size across all API caches
   */
  async getTotalCacheSize(): Promise<number> {
    const stats = await this.getCacheStats();
    return stats.reduce((total, stat) => total + stat.estimatedSize, 0);
  }

  /**
   * Check if entry is expired based on TTL
   */
  private isExpired(entry: CacheEntry): boolean {
    const config = CACHE_CONFIG[entry.cacheType];
    const age = Date.now() - entry.createdAt;
    return age > config.maxAgeMs;
  }

  /**
   * Evict expired entries from a specific cache based on TTL
   */
  async evictOldEntries(
    cacheType: CacheType,
    maxAgeMs: number,
  ): Promise<CacheEvictionResult> {
    const result: CacheEvictionResult = {
      cacheName: cacheType,
      entriesRemoved: 0,
      bytesFreed: 0,
    };

    try {
      await withIndexedDBRetry(async () => {
        const db = this.ensureDB();
        const now = Date.now();
        const cutoffTime = now - maxAgeMs;

        // Find expired entries
        const expiredEntries = await db.cacheEntries
          .where("cacheType")
          .equals(cacheType)
          .and((entry) => entry.createdAt < cutoffTime)
          .toArray();

        if (expiredEntries.length > 0) {
          // Calculate bytes freed
          result.bytesFreed = expiredEntries.reduce(
            (sum, entry) => sum + entry.size,
            0,
          );
          result.entriesRemoved = expiredEntries.length;

          // Delete expired entries
          await db.cacheEntries.bulkDelete(expiredEntries.map((e) => e.id));

          logger.info(
            `Evicted ${result.entriesRemoved} expired entries from ${cacheType}`,
          );
        }
      }, "evictOldEntries");
    } catch (error) {
      logger.error(`Failed to evict old entries from ${cacheType}:`, error);
    }

    return result;
  }

  /**
   * Evict entries when cache exceeds max entries using LRU
   */
  async evictBySize(
    cacheType: CacheType,
    maxEntries: number,
  ): Promise<CacheEvictionResult> {
    const result: CacheEvictionResult = {
      cacheName: cacheType,
      entriesRemoved: 0,
      bytesFreed: 0,
    };

    try {
      await withIndexedDBRetry(async () => {
        const db = this.ensureDB();

        // Get count of entries for this cache type
        const count = await db.cacheEntries
          .where("cacheType")
          .equals(cacheType)
          .count();

        if (count > maxEntries) {
          const entriesToRemove = count - maxEntries;

          // Get the oldest accessed entries (LRU)
          const oldestEntries = await db.cacheEntries
            .where("cacheType")
            .equals(cacheType)
            .sortBy("lastAccessedAt");

          const toDelete = oldestEntries.slice(0, entriesToRemove);

          result.bytesFreed = toDelete.reduce(
            (sum, entry) => sum + entry.size,
            0,
          );
          result.entriesRemoved = toDelete.length;

          await db.cacheEntries.bulkDelete(toDelete.map((e) => e.id));

          logger.info(
            `Evicted ${result.entriesRemoved} LRU entries from ${cacheType}`,
          );
        }
      }, "evictBySize");
    } catch (error) {
      logger.error(`Failed to evict entries by size from ${cacheType}:`, error);
    }

    return result;
  }

  /**
   * Evict entries when total storage exceeds threshold using LRU
   */
  async evictByStorageThreshold(): Promise<CacheEvictionResult[]> {
    const results: CacheEvictionResult[] = [];

    try {
      const totalSize = await this.getTotalCacheSize();

      if (totalSize > CACHE_LIMITS.STORAGE_THRESHOLD_BYTES) {
        const bytesToFree =
          totalSize - CACHE_LIMITS.STORAGE_THRESHOLD_BYTES * 0.8; // Free 20% extra
        logger.info(
          `Storage threshold exceeded. Total: ${(totalSize / 1024 / 1024).toFixed(2)}MB, freeing ${(bytesToFree / 1024 / 1024).toFixed(2)}MB`,
        );

        await withIndexedDBRetry(async () => {
          const db = this.ensureDB();
          let freedBytes = 0;

          // Get all entries sorted by last access time (LRU)
          const allEntries = await db.cacheEntries
            .orderBy("lastAccessedAt")
            .toArray();

          const idsToDelete: string[] = [];

          for (const entry of allEntries) {
            if (freedBytes >= bytesToFree) break;
            idsToDelete.push(entry.id);
            freedBytes += entry.size;
          }

          if (idsToDelete.length > 0) {
            await db.cacheEntries.bulkDelete(idsToDelete);

            results.push({
              cacheName: "all",
              entriesRemoved: idsToDelete.length,
              bytesFreed: freedBytes,
            });

            logger.info(
              `Evicted ${idsToDelete.length} entries via storage threshold LRU`,
            );
          }
        }, "evictByStorageThreshold");
      }
    } catch (error) {
      logger.error("Failed to evict by storage threshold:", error);
    }

    return results;
  }

  /**
   * Run eviction policies on all caches
   */
  async runEvictionPolicies(): Promise<CacheEvictionResult[]> {
    const results: CacheEvictionResult[] = [];

    // Evict expired entries from each cache type
    for (const cacheType of Object.values(CACHE_NAMES)) {
      const config = CACHE_CONFIG[cacheType];

      const ttlResult = await this.evictOldEntries(cacheType, config.maxAgeMs);
      if (ttlResult.entriesRemoved > 0) {
        results.push(ttlResult);
      }

      const sizeResult = await this.evictBySize(cacheType, config.maxEntries);
      if (sizeResult.entriesRemoved > 0) {
        results.push(sizeResult);
      }
    }

    // Run storage threshold check with LRU eviction
    const storageResults = await this.evictByStorageThreshold();
    results.push(...storageResults);

    return results;
  }

  /**
   * Clear a specific cache type
   */
  async clearCache(cacheType: CacheType): Promise<boolean> {
    try {
      await withIndexedDBRetry(async () => {
        const db = this.ensureDB();
        await db.cacheEntries.where("cacheType").equals(cacheType).delete();
        logger.info(`Cleared cache: ${cacheType}`);
      }, "clearCache");
      return true;
    } catch (error) {
      logger.error(`Failed to clear cache ${cacheType}:`, error);
      return false;
    }
  }

  /**
   * Clear all API-related caches
   */
  async clearAllAPICaches(): Promise<boolean> {
    try {
      await withIndexedDBRetry(async () => {
        const db = this.ensureDB();
        await db.cacheEntries.clear();
        logger.info("Cleared all API caches");
      }, "clearAllAPICaches");
      return true;
    } catch (error) {
      logger.error("Failed to clear all API caches:", error);
      return false;
    }
  }

  /**
   * Store a response in the cache with write-time timestamp
   */
  async cacheResponse(
    cacheType: CacheType,
    url: string,
    response: Response,
  ): Promise<void> {
    try {
      await withIndexedDBRetry(async () => {
        const db = this.ensureDB();
        const id = generateCacheId(cacheType, url);
        const now = Date.now();

        // Clone response and read body
        const clonedResponse = response.clone();
        const body = await clonedResponse.blob();

        // Serialize headers
        const headers: Record<string, string> = {};
        clonedResponse.headers.forEach((value, key) => {
          headers[key] = value;
        });

        const entry: CacheEntry = {
          id,
          cacheType,
          url,
          createdAt: now,
          lastAccessedAt: now,
          status: clonedResponse.status,
          statusText: clonedResponse.statusText,
          headers: JSON.stringify(headers),
          body,
          size: body.size,
        };

        await db.cacheEntries.put(entry);
      }, "cacheResponse");
    } catch (error) {
      logger.error(`Failed to cache response for ${url}:`, error);
    }
  }

  /**
   * Get a cached response if available and not expired.
   * Updates lastAccessedAt for LRU tracking.
   * Returns undefined if entry doesn't exist or is expired.
   */
  async getCachedResponse(
    url: string,
    cacheType?: CacheType,
  ): Promise<Response | undefined> {
    try {
      const db = this.ensureDB();

      // If cacheType is specified, look in that specific cache
      if (cacheType) {
        const id = generateCacheId(cacheType, url);
        const entry = await db.cacheEntries.get(id);

        if (entry) {
          // Check TTL expiration
          if (this.isExpired(entry)) {
            // Auto-delete expired entry
            await db.cacheEntries.delete(id);
            return undefined;
          }

          // Update lastAccessedAt for LRU tracking
          await db.cacheEntries.update(id, { lastAccessedAt: Date.now() });

          return this.entryToResponse(entry);
        }
        return undefined;
      }

      // Otherwise, search all cache types
      for (const ct of Object.values(CACHE_NAMES)) {
        const id = generateCacheId(ct, url);
        const entry = await db.cacheEntries.get(id);

        if (entry) {
          if (this.isExpired(entry)) {
            await db.cacheEntries.delete(id);
            continue;
          }

          await db.cacheEntries.update(id, { lastAccessedAt: Date.now() });
          return this.entryToResponse(entry);
        }
      }

      return undefined;
    } catch (error) {
      logger.error(`Failed to get cached response for ${url}:`, error);
      return undefined;
    }
  }

  /**
   * Convert a cache entry back to a Response object
   */
  private entryToResponse(entry: CacheEntry): Response {
    const headers = new Headers(JSON.parse(entry.headers));
    return new Response(entry.body, {
      status: entry.status,
      statusText: entry.statusText,
      headers,
    });
  }

  /**
   * Prefetch and cache important data for offline use
   */
  async prefetchForOffline(urls: string[]): Promise<void> {
    for (const url of urls) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          await this.cacheResponse(CACHE_NAMES.API, url, response);
          logger.info(`Prefetched: ${url}`);
        }
      } catch (error) {
        logger.warn(`Failed to prefetch ${url}:`, error);
      }
    }
  }

  /**
   * Check if a URL is cached (without checking expiration)
   */
  async isCached(url: string, cacheType?: CacheType): Promise<boolean> {
    try {
      const db = this.ensureDB();

      if (cacheType) {
        const id = generateCacheId(cacheType, url);
        const entry = await db.cacheEntries.get(id);
        return entry !== undefined && !this.isExpired(entry);
      }

      for (const ct of Object.values(CACHE_NAMES)) {
        const id = generateCacheId(ct, url);
        const entry = await db.cacheEntries.get(id);
        if (entry && !this.isExpired(entry)) {
          return true;
        }
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Delete a specific cached entry
   */
  async deleteCachedEntry(url: string, cacheType: CacheType): Promise<boolean> {
    try {
      await withIndexedDBRetry(async () => {
        const db = this.ensureDB();
        const id = generateCacheId(cacheType, url);
        await db.cacheEntries.delete(id);
      }, "deleteCachedEntry");
      return true;
    } catch (error) {
      logger.error(`Failed to delete cached entry for ${url}:`, error);
      return false;
    }
  }
}

export const apiCacheService = APICacheService.getInstance();
