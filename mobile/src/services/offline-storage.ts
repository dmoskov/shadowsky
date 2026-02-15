/**
 * Offline Storage Service for Mobile
 *
 * AsyncStorage-based persistent storage for offline access to feeds and threads.
 * Provides similar functionality to the web's IndexedDB offline-storage-db but
 * adapted for React Native's AsyncStorage.
 *
 * Features:
 * - Feed item caching with automatic eviction
 * - Thread caching for offline viewing
 * - Storage metadata tracking
 * - Automatic cleanup of old items
 */

import AsyncStorage from '@react-native-async-storage/async-storage';


import { createLogger } from '../utils/logger';

const logger = createLogger('OfflineStorage');
// Storage keys
const STORAGE_KEYS = {
  FEED_ITEMS: '@offline/feed_items',
  FEED_METADATA: '@offline/feed_metadata',
  THREAD_ITEMS: '@offline/thread_items',
  THREAD_METADATA: '@offline/thread_metadata',
} as const;

// Storage limits
const LIMITS = {
  MAX_FEED_ITEMS: 500,
  MAX_THREAD_ITEMS: 100,
  FEED_MAX_AGE_DAYS: 7,
  THREAD_MAX_AGE_DAYS: 30,
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
  _feedType: 'timeline' | 'author' | 'list';
}

export interface OfflineThreadItem {
  threadUri: string;
  posts: unknown[]; // Thread posts
  _offlineCachedAt: number;
  _lastAccessedAt: number;
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
  threadItemCount: number;
  lastFeedSync: number | null;
  lastThreadSync: number | null;
  estimatedSize: number;
}

class OfflineStorageService {
  private static instance: OfflineStorageService;
  private initialized = false;

  private constructor() {}

  static getInstance(): OfflineStorageService {
    if (!OfflineStorageService.instance) {
      OfflineStorageService.instance = new OfflineStorageService();
    }
    return OfflineStorageService.instance;
  }

  async init(): Promise<void> {
    if (this.initialized) return;

    try {
      // Initialize metadata if not exists
      const feedMeta = await this.getMetadata('feed_timeline');
      if (!feedMeta) {
        await this.saveMetadata({
          key: 'feed_timeline',
          lastSyncAt: 0,
          itemCount: 0,
        });
      }

      const threadMeta = await this.getMetadata('threads');
      if (!threadMeta) {
        await this.saveMetadata({
          key: 'threads',
          lastSyncAt: 0,
          itemCount: 0,
        });
      }

      this.initialized = true;
      logger.log('Initialized');
    } catch (error) {
      logger.error('Initialization failed:', error);
      throw error;
    }
  }

  // ==================== Feed Item Operations ====================

  async saveFeedItems(
    items: Omit<OfflineFeedItem, '_offlineCachedAt'>[],
    feedType: 'timeline' | 'author' | 'list' = 'timeline'
  ): Promise<void> {
    try {
      const existingData = await AsyncStorage.getItem(STORAGE_KEYS.FEED_ITEMS);
      const existingItems: OfflineFeedItem[] = existingData ? JSON.parse(existingData) : [];

      const now = Date.now();
      const newItems: OfflineFeedItem[] = items.map(item => ({
        ...item,
        _offlineCachedAt: now,
        _feedType: feedType,
      }));

      // Merge with existing items, avoiding duplicates by URI
      const itemMap = new Map<string, OfflineFeedItem>();

      // Add existing items
      existingItems.forEach(item => {
        itemMap.set(item.uri, item);
      });

      // Add/update with new items
      newItems.forEach(item => {
        itemMap.set(item.uri, item);
      });

      // Convert back to array and sort by indexedAt (newest first)
      const allItems = Array.from(itemMap.values()).sort(
        (a, b) => new Date(b.indexedAt).getTime() - new Date(a.indexedAt).getTime()
      );

      // Enforce limit
      const limitedItems = allItems.slice(0, LIMITS.MAX_FEED_ITEMS);

      // Save to storage
      await AsyncStorage.setItem(STORAGE_KEYS.FEED_ITEMS, JSON.stringify(limitedItems));

      // Update metadata
      const metaKey = `feed_${feedType}`;
      await this.saveMetadata({
        key: metaKey,
        lastSyncAt: now,
        itemCount: limitedItems.length,
        newestItemAt: limitedItems[0]?.indexedAt,
        oldestItemAt: limitedItems[limitedItems.length - 1]?.indexedAt,
      });

      logger.log(`Saved ${newItems.length} feed items (${feedType}), total: ${limitedItems.length}`);
    } catch (error) {
      logger.error('Failed to save feed items:', error);
      throw error;
    }
  }

  async getFeedItems(
    limit = 50,
    feedType?: 'timeline' | 'author' | 'list'
  ): Promise<OfflineFeedItem[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.FEED_ITEMS);
      if (!data) return [];

      const items: OfflineFeedItem[] = JSON.parse(data);

      // Filter by feed type if specified
      const filteredItems = feedType
        ? items.filter(item => item._feedType === feedType)
        : items;

      // Return limited items
      return filteredItems.slice(0, limit);
    } catch (error) {
      logger.error('Failed to get feed items:', error);
      return [];
    }
  }

  async hasFeedItems(): Promise<boolean> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.FEED_ITEMS);
      if (!data) return false;
      const items = JSON.parse(data);
      return Array.isArray(items) && items.length > 0;
    } catch {
      return false;
    }
  }

  // ==================== Thread Operations ====================

  async saveThread(threadUri: string, posts: unknown[]): Promise<void> {
    try {
      const existingData = await AsyncStorage.getItem(STORAGE_KEYS.THREAD_ITEMS);
      const existingThreads: OfflineThreadItem[] = existingData ? JSON.parse(existingData) : [];

      const now = Date.now();
      const newThread: OfflineThreadItem = {
        threadUri,
        posts,
        _offlineCachedAt: now,
        _lastAccessedAt: now,
      };

      // Update or add thread
      const threadMap = new Map<string, OfflineThreadItem>();
      existingThreads.forEach(thread => {
        threadMap.set(thread.threadUri, thread);
      });
      threadMap.set(threadUri, newThread);

      // Convert to array and sort by last accessed (most recent first)
      const allThreads = Array.from(threadMap.values()).sort(
        (a, b) => b._lastAccessedAt - a._lastAccessedAt
      );

      // Enforce limit (LRU eviction)
      const limitedThreads = allThreads.slice(0, LIMITS.MAX_THREAD_ITEMS);

      // Save to storage
      await AsyncStorage.setItem(STORAGE_KEYS.THREAD_ITEMS, JSON.stringify(limitedThreads));

      // Update metadata
      await this.saveMetadata({
        key: 'threads',
        lastSyncAt: now,
        itemCount: limitedThreads.length,
      });

      logger.log(`Saved thread ${threadUri}, total: ${limitedThreads.length}`);
    } catch (error) {
      logger.error('Failed to save thread:', error);
      throw error;
    }
  }

  async getThread(threadUri: string): Promise<OfflineThreadItem | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.THREAD_ITEMS);
      if (!data) return null;

      const threads: OfflineThreadItem[] = JSON.parse(data);
      const thread = threads.find(t => t.threadUri === threadUri);

      if (thread) {
        // Update last accessed time
        thread._lastAccessedAt = Date.now();
        await AsyncStorage.setItem(STORAGE_KEYS.THREAD_ITEMS, JSON.stringify(threads));
        return thread;
      }

      return null;
    } catch (error) {
      logger.error('Failed to get thread:', error);
      return null;
    }
  }

  async hasThread(threadUri: string): Promise<boolean> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.THREAD_ITEMS);
      if (!data) return false;
      const threads: OfflineThreadItem[] = JSON.parse(data);
      return threads.some(t => t.threadUri === threadUri);
    } catch {
      return false;
    }
  }

  // ==================== Metadata Operations ====================

  private async saveMetadata(metadata: OfflineMetadata): Promise<void> {
    try {
      const existingData = await AsyncStorage.getItem(STORAGE_KEYS.FEED_METADATA);
      const allMetadata: Record<string, OfflineMetadata> = existingData ? JSON.parse(existingData) : {};

      allMetadata[metadata.key] = metadata;

      await AsyncStorage.setItem(STORAGE_KEYS.FEED_METADATA, JSON.stringify(allMetadata));
    } catch (error) {
      logger.error('Failed to save metadata:', error);
    }
  }

  async getMetadata(key: string): Promise<OfflineMetadata | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.FEED_METADATA);
      if (!data) return null;

      const allMetadata: Record<string, OfflineMetadata> = JSON.parse(data);
      return allMetadata[key] || null;
    } catch (error) {
      logger.error('Failed to get metadata:', error);
      return null;
    }
  }

  async getStats(): Promise<OfflineStorageStats> {
    try {
      const [feedData, threadData, feedMeta, threadMeta] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.FEED_ITEMS),
        AsyncStorage.getItem(STORAGE_KEYS.THREAD_ITEMS),
        this.getMetadata('feed_timeline'),
        this.getMetadata('threads'),
      ]);

      const feedItems = feedData ? JSON.parse(feedData) : [];
      const threadItems = threadData ? JSON.parse(threadData) : [];

      // Estimate size (rough calculation)
      const estimatedSize = (feedData?.length || 0) + (threadData?.length || 0);

      return {
        feedItemCount: feedItems.length,
        threadItemCount: threadItems.length,
        lastFeedSync: feedMeta?.lastSyncAt || null,
        lastThreadSync: threadMeta?.lastSyncAt || null,
        estimatedSize,
      };
    } catch (error) {
      logger.error('Failed to get stats:', error);
      return {
        feedItemCount: 0,
        threadItemCount: 0,
        lastFeedSync: null,
        lastThreadSync: null,
        estimatedSize: 0,
      };
    }
  }

  // ==================== Cleanup Operations ====================

  async evictOldFeedItems(): Promise<number> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.FEED_ITEMS);
      if (!data) return 0;

      const items: OfflineFeedItem[] = JSON.parse(data);
      const cutoffTime = Date.now() - LIMITS.FEED_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

      const filteredItems = items.filter(item => item._offlineCachedAt > cutoffTime);
      const deletedCount = items.length - filteredItems.length;

      if (deletedCount > 0) {
        await AsyncStorage.setItem(STORAGE_KEYS.FEED_ITEMS, JSON.stringify(filteredItems));
        logger.log(`Evicted ${deletedCount} old feed items`);
      }

      return deletedCount;
    } catch (error) {
      logger.error('Failed to evict old feed items:', error);
      return 0;
    }
  }

  async evictOldThreads(): Promise<number> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.THREAD_ITEMS);
      if (!data) return 0;

      const threads: OfflineThreadItem[] = JSON.parse(data);
      const cutoffTime = Date.now() - LIMITS.THREAD_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

      const filteredThreads = threads.filter(thread => thread._offlineCachedAt > cutoffTime);
      const deletedCount = threads.length - filteredThreads.length;

      if (deletedCount > 0) {
        await AsyncStorage.setItem(STORAGE_KEYS.THREAD_ITEMS, JSON.stringify(filteredThreads));
        logger.log(`Evicted ${deletedCount} old threads`);
      }

      return deletedCount;
    } catch (error) {
      logger.error('Failed to evict old threads:', error);
      return 0;
    }
  }

  async enforceStorageLimits(): Promise<void> {
    await Promise.all([
      this.evictOldFeedItems(),
      this.evictOldThreads(),
    ]);
  }

  async clearAll(): Promise<void> {
    try {
      await Promise.all([
        AsyncStorage.removeItem(STORAGE_KEYS.FEED_ITEMS),
        AsyncStorage.removeItem(STORAGE_KEYS.FEED_METADATA),
        AsyncStorage.removeItem(STORAGE_KEYS.THREAD_ITEMS),
        AsyncStorage.removeItem(STORAGE_KEYS.THREAD_METADATA),
      ]);
      this.initialized = false;
      logger.log('Cleared all offline storage');
    } catch (error) {
      logger.error('Failed to clear storage:', error);
      throw error;
    }
  }
}

export const offlineStorage = OfflineStorageService.getInstance();
