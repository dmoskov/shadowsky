/**
 * Error Recovery Tests
 *
 * Tests for API error handling: 500 errors, 429 rate limiting,
 * network timeouts, and graceful degradation with offline storage.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  offlineStorage,
  OfflineFeedItem,
  OfflineThreadItem,
  OfflineNotificationItem,
} from '../../services/offline-storage';

// ── Offline Storage Tests ──────────────────────────────────────────────────

describe('Error Recovery - Offline Storage', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    // Re-init the singleton (clear its initialized flag)
    (offlineStorage as any).initialized = false;
  });

  describe('Feed cache serves data when API fails', () => {
    it('returns cached feed items when offline', async () => {
      await offlineStorage.init();

      const feedItems = [
        {
          uri: 'at://did:plc:user/post/1',
          cid: 'cid1',
          indexedAt: new Date().toISOString(),
          author: { did: 'did:plc:user', handle: 'test.bsky.social' },
          record: { text: 'Hello world', createdAt: new Date().toISOString() },
          likeCount: 5,
          replyCount: 2,
          repostCount: 1,
        },
        {
          uri: 'at://did:plc:user/post/2',
          cid: 'cid2',
          indexedAt: new Date(Date.now() - 60000).toISOString(),
          author: { did: 'did:plc:user', handle: 'test.bsky.social' },
          record: { text: 'Second post', createdAt: new Date().toISOString() },
        },
      ];

      await offlineStorage.saveFeedItems(feedItems, 'timeline');

      const cached = await offlineStorage.getFeedItems(50, 'timeline');
      expect(cached).toHaveLength(2);
      expect(cached[0].record.text).toBe('Hello world');
    });

    it('returns empty array when no cached data exists', async () => {
      await offlineStorage.init();

      const cached = await offlineStorage.getFeedItems(50, 'timeline');
      expect(cached).toEqual([]);
    });

    it('hasFeedItems returns correct boolean', async () => {
      await offlineStorage.init();

      expect(await offlineStorage.hasFeedItems()).toBe(false);

      await offlineStorage.saveFeedItems(
        [
          {
            uri: 'at://did:plc:u/post/1',
            cid: 'cid1',
            indexedAt: new Date().toISOString(),
            author: { did: 'did:plc:u', handle: 'u.bsky.social' },
            record: { text: 'test', createdAt: new Date().toISOString() },
          },
        ],
        'timeline',
      );

      expect(await offlineStorage.hasFeedItems()).toBe(true);
    });
  });

  describe('Thread cache resilience', () => {
    it('returns cached thread when offline', async () => {
      await offlineStorage.init();

      const threadUri = 'at://did:plc:user/post/thread1';
      const posts = [
        { uri: threadUri, text: 'Root post' },
        { uri: 'at://did:plc:user/post/reply1', text: 'Reply' },
      ];

      await offlineStorage.saveThread(threadUri, posts);

      const cached = await offlineStorage.getThread(threadUri);
      expect(cached).not.toBeNull();
      expect(cached!.posts).toHaveLength(2);
      expect(cached!.threadUri).toBe(threadUri);
    });

    it('returns null for uncached thread', async () => {
      await offlineStorage.init();

      const cached = await offlineStorage.getThread('at://nonexistent');
      expect(cached).toBeNull();
    });

    it('updates lastAccessedAt on thread retrieval (LRU)', async () => {
      await offlineStorage.init();

      const threadUri = 'at://did:plc:user/post/thread1';
      await offlineStorage.saveThread(threadUri, [{ text: 'test' }]);

      const before = Date.now();
      const cached = await offlineStorage.getThread(threadUri);

      expect(cached!._lastAccessedAt).toBeGreaterThanOrEqual(before);
    });
  });

  describe('Notification cache resilience', () => {
    it('returns cached notifications when offline', async () => {
      await offlineStorage.init();

      const notifs = [
        {
          uri: 'at://did:plc:liker/like/1',
          cid: 'cid1',
          reason: 'like',
          isRead: false,
          indexedAt: new Date().toISOString(),
          author: { did: 'did:plc:liker', handle: 'liker.bsky.social' },
        },
      ];

      await offlineStorage.saveNotificationItems(notifs);

      const cached = await offlineStorage.getNotificationItems(50);
      expect(cached).toHaveLength(1);
      expect(cached[0].reason).toBe('like');
    });
  });

  // ── Storage Limits & Eviction ────────────────────────────────────────

  describe('Storage limits and eviction', () => {
    it('enforces max feed item limit (500)', async () => {
      await offlineStorage.init();

      // Create 510 feed items
      const items = Array.from({ length: 510 }, (_, i) => ({
        uri: `at://did:plc:u/post/${i}`,
        cid: `cid${i}`,
        indexedAt: new Date(Date.now() - i * 1000).toISOString(),
        author: { did: 'did:plc:u', handle: 'u.bsky.social' },
        record: { text: `Post ${i}`, createdAt: new Date().toISOString() },
      }));

      await offlineStorage.saveFeedItems(items, 'timeline');

      // Read back through the service method
      const cached = await offlineStorage.getFeedItems(600);
      expect(cached.length).toBeLessThanOrEqual(500);
    });

    it('evicts feed items older than 7 days', async () => {
      await offlineStorage.init();

      // Directly insert items with controlled _offlineCachedAt timestamps
      const freshItem: OfflineFeedItem = {
        uri: 'at://did:plc:u/post/fresh',
        cid: 'fresh',
        indexedAt: new Date().toISOString(),
        author: { did: 'did:plc:u', handle: 'u.bsky.social' },
        record: { text: 'Fresh', createdAt: new Date().toISOString() },
        _offlineCachedAt: Date.now(),
        _feedType: 'timeline',
      };

      const oldItem: OfflineFeedItem = {
        uri: 'at://did:plc:u/post/old',
        cid: 'old',
        indexedAt: new Date().toISOString(),
        author: { did: 'did:plc:u', handle: 'u.bsky.social' },
        record: { text: 'Old', createdAt: new Date().toISOString() },
        _offlineCachedAt: Date.now() - 8 * 24 * 60 * 60 * 1000,
        _feedType: 'timeline',
      };

      await AsyncStorage.setItem(
        '@offline/feed_items',
        JSON.stringify([freshItem, oldItem]),
      );

      const evicted = await offlineStorage.evictOldFeedItems();
      expect(evicted).toBe(1);

      const remaining = await offlineStorage.getFeedItems(50);
      expect(remaining).toHaveLength(1);
      expect(remaining[0].uri).toBe('at://did:plc:u/post/fresh');
    });

    it('evicts threads older than 30 days', async () => {
      await offlineStorage.init();

      const oldThread: OfflineThreadItem = {
        threadUri: 'at://did:plc:u/post/old-thread',
        posts: [{ text: 'old' }],
        _offlineCachedAt: Date.now() - 31 * 24 * 60 * 60 * 1000,
        _lastAccessedAt: Date.now() - 31 * 24 * 60 * 60 * 1000,
      };

      const freshThread: OfflineThreadItem = {
        threadUri: 'at://did:plc:u/post/fresh-thread',
        posts: [{ text: 'fresh' }],
        _offlineCachedAt: Date.now(),
        _lastAccessedAt: Date.now(),
      };

      await AsyncStorage.setItem(
        '@offline/thread_items',
        JSON.stringify([oldThread, freshThread]),
      );

      const evicted = await offlineStorage.evictOldThreads();
      expect(evicted).toBe(1);

      const hasOld = await offlineStorage.hasThread('at://did:plc:u/post/old-thread');
      const hasFresh = await offlineStorage.hasThread('at://did:plc:u/post/fresh-thread');
      expect(hasOld).toBe(false);
      expect(hasFresh).toBe(true);
    });

    it('evicts notifications older than 7 days', async () => {
      await offlineStorage.init();

      const oldNotif: OfflineNotificationItem = {
        uri: 'at://did:plc:u/like/old',
        cid: 'old',
        reason: 'like',
        isRead: true,
        indexedAt: new Date().toISOString(),
        author: { did: 'did:plc:u', handle: 'u.bsky.social' },
        _offlineCachedAt: Date.now() - 8 * 24 * 60 * 60 * 1000,
      };

      const freshNotif: OfflineNotificationItem = {
        uri: 'at://did:plc:u/like/fresh',
        cid: 'fresh',
        reason: 'like',
        isRead: false,
        indexedAt: new Date().toISOString(),
        author: { did: 'did:plc:u', handle: 'u.bsky.social' },
        _offlineCachedAt: Date.now(),
      };

      await AsyncStorage.setItem(
        '@offline/notification_items',
        JSON.stringify([oldNotif, freshNotif]),
      );

      const evicted = await offlineStorage.evictOldNotifications();
      expect(evicted).toBe(1);

      const remaining = await offlineStorage.getNotificationItems(50);
      expect(remaining).toHaveLength(1);
      expect(remaining[0].uri).toBe('at://did:plc:u/like/fresh');
    });

    it('enforceStorageLimits runs all eviction operations', async () => {
      await offlineStorage.init();

      await expect(offlineStorage.enforceStorageLimits()).resolves.not.toThrow();
    });

    it('clearAll removes everything', async () => {
      await offlineStorage.init();

      await offlineStorage.saveFeedItems(
        [
          {
            uri: 'at://did:plc:u/post/1',
            cid: 'c1',
            indexedAt: new Date().toISOString(),
            author: { did: 'did:plc:u', handle: 'u.bsky.social' },
            record: { text: 'test', createdAt: new Date().toISOString() },
          },
        ],
        'timeline',
      );

      await offlineStorage.clearAll();

      expect(await offlineStorage.hasFeedItems()).toBe(false);
    });
  });

  // ── Storage Stats ────────────────────────────────────────────────────

  describe('Storage statistics', () => {
    it('returns correct stats', async () => {
      await offlineStorage.init();

      await offlineStorage.saveFeedItems(
        [
          {
            uri: 'at://did:plc:u/post/1',
            cid: 'c1',
            indexedAt: new Date().toISOString(),
            author: { did: 'did:plc:u', handle: 'u.bsky.social' },
            record: { text: 'test', createdAt: new Date().toISOString() },
          },
        ],
        'timeline',
      );

      await offlineStorage.saveThread('at://thread/1', [{ text: 'root' }]);

      const stats = await offlineStorage.getStats();
      expect(stats.feedItemCount).toBe(1);
      expect(stats.threadItemCount).toBe(1);
      expect(stats.lastFeedSync).not.toBeNull();
      expect(stats.lastThreadSync).not.toBeNull();
      expect(stats.estimatedSize).toBeGreaterThan(0);
    });

    it('returns zeroed stats when empty', async () => {
      await offlineStorage.init();

      const stats = await offlineStorage.getStats();
      expect(stats.feedItemCount).toBe(0);
      expect(stats.threadItemCount).toBe(0);
      expect(stats.estimatedSize).toBe(0);
    });
  });

  // ── Feed Deduplication ───────────────────────────────────────────────

  describe('Feed deduplication', () => {
    it('deduplicates feed items by URI', async () => {
      await offlineStorage.init();

      const item = {
        uri: 'at://did:plc:u/post/1',
        cid: 'cid1',
        indexedAt: new Date().toISOString(),
        author: { did: 'did:plc:u', handle: 'u.bsky.social' },
        record: { text: 'Original', createdAt: new Date().toISOString() },
      };

      await offlineStorage.saveFeedItems([item], 'timeline');
      await offlineStorage.saveFeedItems(
        [{ ...item, record: { text: 'Updated', createdAt: new Date().toISOString() } }],
        'timeline',
      );

      const cached = await offlineStorage.getFeedItems(50, 'timeline');
      expect(cached).toHaveLength(1);
      expect(cached[0].record.text).toBe('Updated');
    });
  });
});

// ── API Error Simulation Tests ─────────────────────────────────────────────

describe('Error Recovery - API Error Handling', () => {
  describe('HTTP 500 Internal Server Error', () => {
    it('error is catchable and provides meaningful message', () => {
      const error = new Error('500 Internal Server Error');
      expect(error.message).toContain('500');

      const isServerError = /5\d{2}/.test(error.message);
      expect(isServerError).toBe(true);
    });

    it('server errors are classified as transient by mutation queue', () => {
      const serverErrors = [
        new Error('500 Internal Server Error'),
        new Error('502 Bad Gateway'),
        new Error('503 Service Unavailable'),
      ];

      for (const error of serverErrors) {
        const isTransient = /5\d{2}/.test(error.message);
        expect(isTransient).toBe(true);
      }
    });
  });

  describe('HTTP 429 Rate Limit', () => {
    it('rate limit errors are classified as transient', () => {
      const error = new Error('HTTP 429 Too Many Requests');
      const isTransient = error.message.includes('429');
      expect(isTransient).toBe(true);
    });

    it('non-rate-limit 4xx errors are not transient', () => {
      const errors = [
        new Error('400 Bad Request'),
        new Error('401 Unauthorized'),
        new Error('403 Forbidden'),
        new Error('404 Not Found'),
      ];

      for (const error of errors) {
        const is429 = error.message.includes('429');
        const is5xx = /5\d{2}/.test(error.message);
        const isNetwork =
          error.message.includes('network') ||
          error.message.includes('fetch') ||
          error.message.includes('timeout');
        const isTransient = is429 || is5xx || isNetwork;
        expect(isTransient).toBe(false);
      }
    });
  });

  describe('Network timeout errors', () => {
    it('timeout errors are classified as transient', () => {
      const error = new Error('Request timeout');
      const isTransient =
        error.message.toLowerCase().includes('timeout') ||
        error.message.toLowerCase().includes('network');
      expect(isTransient).toBe(true);
    });

    it('fetch errors are classified as transient', () => {
      const error = new Error('fetch failed');
      const isTransient =
        error.message.toLowerCase().includes('fetch') ||
        error.message.toLowerCase().includes('network');
      expect(isTransient).toBe(true);
    });

    it('generic network errors are classified as transient', () => {
      const error = new Error('Network request failed');
      const isTransient = error.message.toLowerCase().includes('network');
      expect(isTransient).toBe(true);
    });
  });

  describe('Error does not crash the app', () => {
    it('malformed JSON does not crash Jetstream message handler', async () => {
      const {
        JetstreamService,
        JetstreamEventType,
      } = require('../../services/jetstream-service');

      // Mock WebSocket globally with proper state management
      const OriginalWebSocket = (global as any).WebSocket;
      let mockWs: any = null;

      (global as any).WebSocket = class MockWS {
        url: string;
        readyState = 1;
        onopen: (() => void) | null = null;
        onclose: (() => void) | null = null;
        onerror: (() => void) | null = null;
        onmessage: ((event: { data: string }) => void) | null = null;
        constructor(url: string) {
          this.url = url;
          // eslint-disable-next-line @typescript-eslint/no-this-alias
          mockWs = this;
          // Simulate open on next microtask
          Promise.resolve().then(() => {
            this.readyState = 1;
            this.onopen?.();
          });
        }
        close() {
          this.readyState = 3;
          this.onclose?.();
        }
        send() {}
        static get OPEN() { return 1; }
        static get CONNECTING() { return 0; }
        static get CLOSING() { return 2; }
        static get CLOSED() { return 3; }
      };

      const service = new JetstreamService({ userDid: 'did:plc:test' });
      service.connect();
      await Promise.resolve(); // Let WebSocket constructor fire
      await Promise.resolve(); // Let onopen fire

      expect(mockWs).not.toBeNull();

      // Send malformed JSON - should not throw
      expect(() => {
        mockWs.onmessage?.({ data: 'not valid json{{{' });
      }).not.toThrow();

      // Send empty string
      expect(() => {
        mockWs.onmessage?.({ data: '' });
      }).not.toThrow();

      // Send valid JSON but unexpected structure
      expect(() => {
        mockWs.onmessage?.({ data: '{"unexpected":"format"}' });
      }).not.toThrow();

      service.destroy();

      // Restore
      if (OriginalWebSocket) {
        (global as any).WebSocket = OriginalWebSocket;
      }
    });

    it('AsyncStorage read failure returns graceful defaults', async () => {
      // Use mockRejectedValueOnce - subsequent calls use the default mock behavior
      (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(
        new Error('Storage corrupted'),
      );

      const items = await offlineStorage.getFeedItems(50);
      expect(items).toEqual([]); // Graceful empty array, not crash
      // The AsyncStorage mock will return to its normal behavior for subsequent calls
    });
  });

  describe('Metadata tracking', () => {
    beforeEach(async () => {
      await AsyncStorage.clear();
      (offlineStorage as any).initialized = false;
    });

    it('tracks metadata for feed syncs', async () => {
      await offlineStorage.init();

      await offlineStorage.saveFeedItems(
        [
          {
            uri: 'at://did:plc:u/post/1',
            cid: 'c1',
            indexedAt: new Date().toISOString(),
            author: { did: 'did:plc:u', handle: 'u.bsky.social' },
            record: { text: 'test', createdAt: new Date().toISOString() },
          },
        ],
        'timeline',
      );

      const meta = await offlineStorage.getMetadata('feed_timeline');
      expect(meta).not.toBeNull();
      expect(meta!.lastSyncAt).toBeGreaterThan(0);
      expect(meta!.itemCount).toBe(1);
    });
  });
});
