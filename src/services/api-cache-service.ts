/**
 * API Cache Service
 *
 * Provides programmatic control over API response caching for offline-first architecture.
 * Works in conjunction with the service worker's Workbox caching strategies.
 *
 * Features:
 * - Cache management for different API types (feeds, DMs, profiles)
 * - Cache eviction policies with configurable limits
 * - Offline status detection and event handling
 * - Cache statistics and monitoring
 */

import { createLogger } from "../utils/logger";

const logger = createLogger("APICacheService");

// Cache name constants (must match vite.config.ts workbox config)
export const CACHE_NAMES = {
  API: "bsky-api-cache",
  CHAT: "bsky-chat-cache",
  CDN_IMAGES: "bsky-cdn-images",
  AVATARS: "bsky-avatar-cache",
} as const;

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
} as const;

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

class APICacheService {
  private static instance: APICacheService;
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
   * Initialize the cache service with event listeners
   */
  async init(): Promise<void> {
    if (this.isInitialized) return;

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
    logger.info("API Cache Service initialized");
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
      const cache = await caches.open(CACHE_NAMES.API);
      const keys = await cache.keys();
      return keys.some(
        (req) =>
          req.url.includes("app.bsky.feed") ||
          req.url.includes("getTimeline") ||
          req.url.includes("getAuthorFeed"),
      );
    } catch {
      return false;
    }
  }

  /**
   * Check if we have cached DM data
   */
  async hasCachedDMs(): Promise<boolean> {
    try {
      const cache = await caches.open(CACHE_NAMES.CHAT);
      const keys = await cache.keys();
      return keys.some((req) => req.url.includes("chat.bsky.convo"));
    } catch {
      return false;
    }
  }

  /**
   * Get statistics for all caches
   */
  async getCacheStats(): Promise<CacheStats[]> {
    const stats: CacheStats[] = [];

    for (const cacheName of Object.values(CACHE_NAMES)) {
      try {
        const cache = await caches.open(cacheName);
        const keys = await cache.keys();
        let estimatedSize = 0;

        // Estimate size by sampling a few entries
        const sampleSize = Math.min(5, keys.length);
        for (let i = 0; i < sampleSize; i++) {
          const response = await cache.match(keys[i]);
          if (response) {
            const clone = response.clone();
            const blob = await clone.blob();
            estimatedSize += blob.size;
          }
        }

        // Extrapolate total size
        if (sampleSize > 0) {
          estimatedSize = (estimatedSize / sampleSize) * keys.length;
        }

        stats.push({
          name: cacheName,
          entryCount: keys.length,
          estimatedSize,
        });
      } catch (error) {
        logger.warn(`Failed to get stats for cache ${cacheName}:`, error);
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
   * Evict old entries from a specific cache based on age
   */
  async evictOldEntries(
    cacheName: string,
    maxAgeMs: number,
  ): Promise<CacheEvictionResult> {
    const result: CacheEvictionResult = {
      cacheName,
      entriesRemoved: 0,
      bytesFreed: 0,
    };

    try {
      const cache = await caches.open(cacheName);
      const keys = await cache.keys();
      const now = Date.now();

      for (const request of keys) {
        const response = await cache.match(request);
        if (response) {
          // Check the date header to determine age
          const dateHeader = response.headers.get("date");
          if (dateHeader) {
            const responseAge = now - new Date(dateHeader).getTime();
            if (responseAge > maxAgeMs) {
              const blob = await response.clone().blob();
              result.bytesFreed += blob.size;
              await cache.delete(request);
              result.entriesRemoved++;
            }
          }
        }
      }

      if (result.entriesRemoved > 0) {
        logger.info(
          `Evicted ${result.entriesRemoved} old entries from ${cacheName}`,
        );
      }
    } catch (error) {
      logger.error(`Failed to evict old entries from ${cacheName}:`, error);
    }

    return result;
  }

  /**
   * Evict entries when cache exceeds max size
   */
  async evictBySize(
    cacheName: string,
    maxEntries: number,
  ): Promise<CacheEvictionResult> {
    const result: CacheEvictionResult = {
      cacheName,
      entriesRemoved: 0,
      bytesFreed: 0,
    };

    try {
      const cache = await caches.open(cacheName);
      const keys = await cache.keys();

      if (keys.length > maxEntries) {
        // Remove oldest entries (FIFO)
        const entriesToRemove = keys.length - maxEntries;

        for (let i = 0; i < entriesToRemove; i++) {
          const response = await cache.match(keys[i]);
          if (response) {
            const blob = await response.clone().blob();
            result.bytesFreed += blob.size;
          }
          await cache.delete(keys[i]);
          result.entriesRemoved++;
        }

        logger.info(
          `Evicted ${result.entriesRemoved} entries from ${cacheName} (size limit)`,
        );
      }
    } catch (error) {
      logger.error(`Failed to evict entries by size from ${cacheName}:`, error);
    }

    return result;
  }

  /**
   * Run eviction policies on all caches
   */
  async runEvictionPolicies(): Promise<CacheEvictionResult[]> {
    const results: CacheEvictionResult[] = [];

    // Evict old entries from API cache
    results.push(
      await this.evictOldEntries(CACHE_NAMES.API, CACHE_LIMITS.API_MAX_AGE_MS),
    );
    results.push(
      await this.evictBySize(CACHE_NAMES.API, CACHE_LIMITS.API_MAX_ENTRIES),
    );

    // Evict old entries from Chat cache
    results.push(
      await this.evictOldEntries(
        CACHE_NAMES.CHAT,
        CACHE_LIMITS.CHAT_MAX_AGE_MS,
      ),
    );
    results.push(
      await this.evictBySize(CACHE_NAMES.CHAT, CACHE_LIMITS.CHAT_MAX_ENTRIES),
    );

    // Evict old entries from CDN cache
    results.push(
      await this.evictOldEntries(
        CACHE_NAMES.CDN_IMAGES,
        CACHE_LIMITS.CDN_MAX_AGE_MS,
      ),
    );
    results.push(
      await this.evictBySize(
        CACHE_NAMES.CDN_IMAGES,
        CACHE_LIMITS.CDN_MAX_ENTRIES,
      ),
    );

    // Evict old entries from Avatar cache
    results.push(
      await this.evictOldEntries(
        CACHE_NAMES.AVATARS,
        CACHE_LIMITS.AVATAR_MAX_AGE_MS,
      ),
    );
    results.push(
      await this.evictBySize(
        CACHE_NAMES.AVATARS,
        CACHE_LIMITS.AVATAR_MAX_ENTRIES,
      ),
    );

    return results.filter((r) => r.entriesRemoved > 0);
  }

  /**
   * Clear a specific cache
   */
  async clearCache(cacheName: string): Promise<boolean> {
    try {
      await caches.delete(cacheName);
      logger.info(`Cleared cache: ${cacheName}`);
      return true;
    } catch (error) {
      logger.error(`Failed to clear cache ${cacheName}:`, error);
      return false;
    }
  }

  /**
   * Clear all API-related caches
   */
  async clearAllAPICaches(): Promise<boolean> {
    try {
      await Promise.all(
        Object.values(CACHE_NAMES).map((name) => caches.delete(name)),
      );
      logger.info("Cleared all API caches");
      return true;
    } catch (error) {
      logger.error("Failed to clear all API caches:", error);
      return false;
    }
  }

  /**
   * Prefetch and cache important data for offline use
   */
  async prefetchForOffline(urls: string[]): Promise<void> {
    const cache = await caches.open(CACHE_NAMES.API);

    for (const url of urls) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          await cache.put(url, response.clone());
          logger.info(`Prefetched: ${url}`);
        }
      } catch (error) {
        logger.warn(`Failed to prefetch ${url}:`, error);
      }
    }
  }

  /**
   * Get a cached response if available
   */
  async getCachedResponse(url: string): Promise<Response | undefined> {
    for (const cacheName of Object.values(CACHE_NAMES)) {
      try {
        const cache = await caches.open(cacheName);
        const response = await cache.match(url);
        if (response) {
          return response;
        }
      } catch {
        // Continue to next cache
      }
    }
    return undefined;
  }

  /**
   * Manually cache a response
   */
  async cacheResponse(
    cacheName: string,
    url: string,
    response: Response,
  ): Promise<void> {
    try {
      const cache = await caches.open(cacheName);
      await cache.put(url, response.clone());
    } catch (error) {
      logger.error(`Failed to cache response for ${url}:`, error);
    }
  }
}

export const apiCacheService = APICacheService.getInstance();
