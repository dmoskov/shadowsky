import { debug } from "@bsky/shared";
import { MediaStorageDB, type CachedMedia } from "./media-storage-db";

export interface MediaCacheStats {
  totalItems: number;
  totalSize: number;
  maxSize: number;
  usedPercentage: number;
  mediaByType: Record<string, { count: number; size: number }>;
  oldestItem: Date | null;
  newestItem: Date | null;
  mostAccessed: CachedMedia | null;
}

export class MediaCacheService {
  private static instance: MediaCacheService;
  private db: MediaStorageDB;
  private initialized = false;

  // Trigger cleanup when cache exceeds this percentage of max
  private readonly CLEANUP_THRESHOLD = 0.9; // 90%

  // How much to clean up (remove oldest items until we're at this percentage)
  private readonly CLEANUP_TARGET = 0.7; // 70%

  private constructor() {
    this.db = MediaStorageDB.getInstance();
  }

  static getInstance(): MediaCacheService {
    if (!MediaCacheService.instance) {
      MediaCacheService.instance = new MediaCacheService();
    }
    return MediaCacheService.instance;
  }

  async init(): Promise<void> {
    if (this.initialized) return;

    await this.db.init();
    this.initialized = true;

    debug.log("[MediaCache] Initialized");
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error("MediaCacheService not initialized. Call init() first.");
    }
  }

  /**
   * Cache media from a URL
   * Automatically handles LRU eviction if cache is full
   */
  async cacheMedia(url: string): Promise<string | null> {
    this.ensureInitialized();

    try {
      // Check if already cached
      const existing = await this.db.getMedia(url);
      if (existing) {
        debug.log(`[MediaCache] Media already cached: ${url}`);
        // Return blob URL
        return URL.createObjectURL(existing.blob);
      }

      // Fetch the media
      debug.log(`[MediaCache] Fetching media: ${url}`);
      const response = await fetch(url);

      if (!response.ok) {
        debug.error(
          `[MediaCache] Failed to fetch media: ${response.status} ${response.statusText}`,
        );
        return null;
      }

      const blob = await response.blob();
      const size = blob.size;
      const mimeType = blob.type || "application/octet-stream";

      // Get dimensions for images
      let width: number | undefined;
      let height: number | undefined;

      if (mimeType.startsWith("image/")) {
        const dimensions = await this.getImageDimensions(blob);
        width = dimensions.width;
        height = dimensions.height;
      }

      // Check if we need to perform LRU eviction
      const stats = await this.getStats();
      const projectedSize = stats.totalSize + size;
      const meta = await this.db.getMetadata();

      if (projectedSize > meta.maxSize * this.CLEANUP_THRESHOLD) {
        debug.log(
          `[MediaCache] Cache threshold exceeded (${Math.round((projectedSize / meta.maxSize) * 100)}%), performing LRU cleanup`,
        );
        await this.performLRUCleanup(meta.maxSize * this.CLEANUP_TARGET);
      }

      // Save to cache
      const cachedMedia: CachedMedia = {
        url,
        blob,
        mimeType,
        size,
        width,
        height,
        cachedAt: Date.now(),
        lastAccessedAt: Date.now(),
        accessCount: 1,
      };

      await this.db.saveMedia(cachedMedia);
      await this.db.updateMetadata();

      debug.log(
        `[MediaCache] Cached media: ${url} (${this.formatBytes(size)})`,
      );

      // Return blob URL
      return URL.createObjectURL(blob);
    } catch (error) {
      debug.error(`[MediaCache] Error caching media:`, error);
      return null;
    }
  }

  /**
   * Get cached media or fetch and cache it
   */
  async getOrCacheMedia(url: string): Promise<string | null> {
    this.ensureInitialized();

    try {
      // Try to get from cache first
      const cached = await this.db.getMedia(url);
      if (cached) {
        debug.log(`[MediaCache] Retrieved from cache: ${url}`);
        return URL.createObjectURL(cached.blob);
      }

      // Not in cache, fetch and cache it
      return await this.cacheMedia(url);
    } catch (error) {
      debug.error(`[MediaCache] Error getting/caching media:`, error);
      return null;
    }
  }

  /**
   * Check if media is cached
   */
  async isCached(url: string): Promise<boolean> {
    this.ensureInitialized();
    return await this.db.hasMedia(url);
  }

  /**
   * Preload multiple media URLs in the background
   * Returns the number of successfully preloaded items
   */
  async preloadMedia(urls: string[]): Promise<number> {
    this.ensureInitialized();

    let successCount = 0;

    // Filter out already cached URLs
    const uncachedUrls: string[] = [];
    for (const url of urls) {
      const isCached = await this.db.hasMedia(url);
      if (!isCached) {
        uncachedUrls.push(url);
      }
    }

    if (uncachedUrls.length === 0) {
      debug.log("[MediaCache] All media already cached");
      return urls.length;
    }

    debug.log(
      `[MediaCache] Preloading ${uncachedUrls.length} media items (${urls.length - uncachedUrls.length} already cached)`,
    );

    // Preload in batches to avoid overwhelming the network
    const BATCH_SIZE = 5;
    for (let i = 0; i < uncachedUrls.length; i += BATCH_SIZE) {
      const batch = uncachedUrls.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map((url) => this.cacheMedia(url)),
      );

      successCount += results.filter(
        (r) => r.status === "fulfilled" && r.value !== null,
      ).length;
    }

    debug.log(
      `[MediaCache] Preloaded ${successCount}/${uncachedUrls.length} new items`,
    );

    return successCount + (urls.length - uncachedUrls.length);
  }

  /**
   * Perform LRU cleanup to reduce cache size to target
   */
  private async performLRUCleanup(targetSize: number): Promise<void> {
    const stats = await this.getStats();
    const currentSize = stats.totalSize;

    if (currentSize <= targetSize) {
      debug.log("[MediaCache] No cleanup needed");
      return;
    }

    const toRemoveSize = currentSize - targetSize;
    debug.log(
      `[MediaCache] Cleaning up ${this.formatBytes(toRemoveSize)} to reach target`,
    );

    // Get all items sorted by last accessed time (oldest first)
    const lruItems = await this.db.getLRUItems(1000); // Get a large batch
    let removedSize = 0;
    const urlsToDelete: string[] = [];

    for (const item of lruItems) {
      if (removedSize >= toRemoveSize) {
        break;
      }

      urlsToDelete.push(item.url);
      removedSize += item.size;
    }

    // Delete the items
    await this.db.deleteMultipleMedia(urlsToDelete);
    await this.db.updateMetadata();

    // Update metadata with last cleanup time
    const meta = await this.db.getMetadata();
    meta.lastCleanup = Date.now();
    await this.db.saveMetadata(meta);

    debug.log(
      `[MediaCache] Removed ${urlsToDelete.length} items (${this.formatBytes(removedSize)})`,
    );
  }

  /**
   * Manually clear the entire cache
   */
  async clearCache(): Promise<void> {
    this.ensureInitialized();

    await this.db.clearAll();
    debug.log("[MediaCache] Cache cleared");
  }

  /**
   * Clear cache by type (e.g., "image/jpeg", "video/mp4")
   */
  async clearCacheByType(mimeType: string): Promise<number> {
    this.ensureInitialized();

    const allUrls = await this.db.getAllMediaUrls();
    const urlsToDelete: string[] = [];

    // Find all media of the specified type
    for (const url of allUrls) {
      const media = await this.db.getMedia(url);
      if (media && media.mimeType === mimeType) {
        urlsToDelete.push(url);
      }
    }

    await this.db.deleteMultipleMedia(urlsToDelete);
    await this.db.updateMetadata();

    debug.log(
      `[MediaCache] Cleared ${urlsToDelete.length} items of type ${mimeType}`,
    );

    return urlsToDelete.length;
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<MediaCacheStats> {
    this.ensureInitialized();
    return await this.db.getStats();
  }

  /**
   * Update max cache size
   */
  async setMaxSize(sizeInBytes: number): Promise<void> {
    this.ensureInitialized();

    const meta = await this.db.getMetadata();
    meta.maxSize = sizeInBytes;
    await this.db.saveMetadata(meta);

    debug.log(`[MediaCache] Max size set to ${this.formatBytes(sizeInBytes)}`);

    // Perform cleanup if we're over the new limit
    const stats = await this.getStats();
    if (stats.totalSize > sizeInBytes) {
      await this.performLRUCleanup(sizeInBytes * this.CLEANUP_TARGET);
    }
  }

  /**
   * Get max cache size
   */
  async getMaxSize(): Promise<number> {
    this.ensureInitialized();
    const meta = await this.db.getMetadata();
    return meta.maxSize;
  }

  /**
   * Get image dimensions from blob
   */
  private getImageDimensions(
    blob: Blob,
  ): Promise<{ width: number; height: number }> {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(blob);

      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve({ width: img.width, height: img.height });
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve({ width: 0, height: 0 });
      };

      img.src = url;
    });
  }

  /**
   * Format bytes to human-readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";

    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }
}
