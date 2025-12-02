/**
 * Thread Summary Cache Service
 *
 * Provides caching and background generation of thread summaries for offline access.
 * Integrates with OfflineStorageDB and the Anthropic thread summary API.
 *
 * Features:
 * - Persistent caching of generated summaries in IndexedDB
 * - Background generation for bookmarked threads
 * - LRU eviction for quota management
 * - Integration with React Query for instant access on repeat visits
 */

import { debug } from "@bsky/shared";
import {
  generateThreadSummary,
  type ThreadSummaryFormat,
  type ThreadSummaryPost,
  type ThreadSummaryResult,
} from "./anthropic";
import {
  offlineStorageDB,
  type OfflineThreadSummary,
  type ThreadSummarySource,
} from "./offline-storage-db";

export interface CachedThreadSummary extends ThreadSummaryResult {
  cached: boolean;
  cachedAt?: number;
  source?: ThreadSummarySource;
}

export interface ThreadSummaryCacheOptions {
  forceRefresh?: boolean;
  source?: ThreadSummarySource;
}

class ThreadSummaryCacheService {
  private static instance: ThreadSummaryCacheService;
  private initialized = false;
  private backgroundQueue: Map<string, Promise<void>> = new Map();

  private constructor() {}

  static getInstance(): ThreadSummaryCacheService {
    if (!ThreadSummaryCacheService.instance) {
      ThreadSummaryCacheService.instance = new ThreadSummaryCacheService();
    }
    return ThreadSummaryCacheService.instance;
  }

  async init(): Promise<void> {
    if (this.initialized) return;

    try {
      await offlineStorageDB.init();
      this.initialized = true;
      debug.log("ThreadSummaryCacheService initialized");
    } catch (error) {
      debug.error("Failed to initialize ThreadSummaryCacheService:", error);
      throw error;
    }
  }

  /**
   * Get a thread summary, checking cache first then generating if needed.
   * This is the main entry point for fetching summaries with caching support.
   */
  async getThreadSummary(
    threadUri: string,
    posts: ThreadSummaryPost[],
    format: ThreadSummaryFormat = "haiku",
    options: ThreadSummaryCacheOptions = {},
  ): Promise<CachedThreadSummary> {
    await this.init();

    // Check cache first (unless force refresh)
    if (!options.forceRefresh) {
      const cached = await this.getCachedSummary(threadUri);
      if (cached && cached.format === format) {
        debug.log(`Thread summary cache hit for: ${threadUri}`);
        return {
          summary: cached.summary,
          format: cached.format,
          metadata: {
            ...cached.metadata,
            cached: true,
          },
          cached: true,
          cachedAt: cached._offlineCachedAt,
          source: cached.source,
        };
      }
    }

    // Generate new summary
    debug.log(`Generating thread summary for: ${threadUri}`);
    const result = await generateThreadSummary(posts, format, {
      forceRefresh: options.forceRefresh,
    });

    // Cache the result
    await this.cacheSummary(threadUri, result, options.source || "viewed");

    return {
      ...result,
      metadata: {
        ...result.metadata,
        cached: false,
      },
      cached: false,
    };
  }

  /**
   * Get a cached summary without generating a new one.
   * Useful for offline access checks.
   */
  async getCachedSummary(
    threadUri: string,
  ): Promise<OfflineThreadSummary | null> {
    await this.init();
    return offlineStorageDB.getThreadSummary(threadUri);
  }

  /**
   * Check if a summary is cached for a thread.
   */
  async hasCachedSummary(threadUri: string): Promise<boolean> {
    await this.init();
    return offlineStorageDB.hasThreadSummary(threadUri);
  }

  /**
   * Cache a summary result.
   */
  async cacheSummary(
    threadUri: string,
    result: ThreadSummaryResult,
    source: ThreadSummarySource = "viewed",
  ): Promise<void> {
    await this.init();

    await offlineStorageDB.saveThreadSummary({
      threadUri,
      summary: result.summary,
      format: result.format,
      metadata: {
        postCount: result.metadata.postCount,
        authors: result.metadata.authors,
        generatedAt: result.metadata.generatedAt,
      },
      source,
    });
  }

  /**
   * Get all cached summaries, optionally filtered by source.
   */
  async getCachedSummaries(
    source?: ThreadSummarySource,
    limit = 50,
  ): Promise<OfflineThreadSummary[]> {
    await this.init();
    return offlineStorageDB.getThreadSummaries(source, limit);
  }

  /**
   * Delete a cached summary.
   */
  async deleteCachedSummary(threadUri: string): Promise<void> {
    await this.init();
    await offlineStorageDB.deleteThreadSummary(threadUri);
  }

  /**
   * Get count of cached summaries.
   */
  async getCacheCount(): Promise<number> {
    await this.init();
    return offlineStorageDB.getThreadSummaryCount();
  }

  /**
   * Pre-generate summaries for multiple threads in the background.
   * Used for bookmarked or followed threads.
   */
  async preGenerateSummaries(
    threads: Array<{
      threadUri: string;
      posts: ThreadSummaryPost[];
      source: ThreadSummarySource;
    }>,
    format: ThreadSummaryFormat = "haiku",
  ): Promise<void> {
    await this.init();

    for (const thread of threads) {
      // Skip if already cached
      const isCached = await this.hasCachedSummary(thread.threadUri);
      if (isCached) {
        debug.log(`Skipping pre-generation for cached: ${thread.threadUri}`);
        continue;
      }

      // Skip if already in queue
      if (this.backgroundQueue.has(thread.threadUri)) {
        debug.log(`Skipping pre-generation (in queue): ${thread.threadUri}`);
        continue;
      }

      // Queue background generation
      const generationPromise = this.generateInBackground(
        thread.threadUri,
        thread.posts,
        format,
        thread.source,
      );
      this.backgroundQueue.set(thread.threadUri, generationPromise);

      // Clean up queue entry when done
      generationPromise.finally(() => {
        this.backgroundQueue.delete(thread.threadUri);
      });
    }
  }

  /**
   * Generate a summary in the background (non-blocking).
   */
  private async generateInBackground(
    threadUri: string,
    posts: ThreadSummaryPost[],
    format: ThreadSummaryFormat,
    source: ThreadSummarySource,
  ): Promise<void> {
    try {
      // Only generate if thread has enough posts
      if (posts.length < 5) {
        debug.log(
          `Skipping background generation (too few posts): ${threadUri}`,
        );
        return;
      }

      debug.log(`Background generating summary for: ${threadUri}`);
      const result = await generateThreadSummary(posts, format);
      await this.cacheSummary(threadUri, result, source);
      debug.log(`Background generation complete: ${threadUri}`);
    } catch (error) {
      debug.error(`Background generation failed for ${threadUri}:`, error);
      // Don't throw - background generation failures shouldn't crash the app
    }
  }

  /**
   * Get the number of summaries currently being generated in background.
   */
  getBackgroundQueueSize(): number {
    return this.backgroundQueue.size;
  }

  /**
   * Wait for all background generations to complete.
   * Useful for testing or ensuring all summaries are cached before offline mode.
   */
  async waitForBackgroundGenerations(): Promise<void> {
    await Promise.all(this.backgroundQueue.values());
  }

  /**
   * Enforce storage limits, evicting old or unused summaries.
   */
  async enforceStorageLimits(): Promise<void> {
    await this.init();
    await offlineStorageDB.enforceStorageLimits();
  }
}

export const threadSummaryCacheService =
  ThreadSummaryCacheService.getInstance();
