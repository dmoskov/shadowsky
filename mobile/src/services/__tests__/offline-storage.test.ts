jest.mock('../../utils/logger', () => ({
  createLogger: () => ({
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

const STORAGE_KEYS = {
  FEED_ITEMS: '@offline/feed_items',
  FEED_METADATA: '@offline/feed_metadata',
  THREAD_ITEMS: '@offline/thread_items',
  THREAD_METADATA: '@offline/thread_metadata',
  NOTIFICATION_ITEMS: '@offline/notification_items',
};

function makeFeedItem(uri: string, indexedAt?: string, feedType?: string): any {
  return {
    uri,
    cid: 'bafytest',
    indexedAt: indexedAt || new Date().toISOString(),
    author: { did: 'did:plc:test', handle: 'test.bsky.social' },
    record: { text: 'Test post', createdAt: new Date().toISOString() },
    _feedType: feedType || 'timeline',
  };
}

function makeNotificationItem(uri: string, reason = 'like', indexedAt?: string): any {
  return {
    uri,
    cid: 'bafytest',
    reason,
    isRead: false,
    indexedAt: indexedAt || new Date().toISOString(),
    author: { did: 'did:plc:test', handle: 'test.bsky.social' },
  };
}

let offlineStorage: any;
let AsyncStorage: any;

beforeEach(async () => {
  jest.resetModules();
  AsyncStorage = require('@react-native-async-storage/async-storage');
  await AsyncStorage.clear();
  const mod = require('../offline-storage');
  offlineStorage = mod.offlineStorage;
});

// ==================== Feed Storage ====================

describe('Feed storage', () => {
  it('saveFeedItems saves and retrieves items', async () => {
    const items = [makeFeedItem('at://post/1'), makeFeedItem('at://post/2')];
    await offlineStorage.saveFeedItems(items);

    const result = await offlineStorage.getFeedItems(50);
    expect(result).toHaveLength(2);
    expect(result[0]._offlineCachedAt).toBeDefined();
    expect(result[0]._feedType).toBe('timeline');
  });

  it('deduplicates by URI, keeping the latest version', async () => {
    const item1 = makeFeedItem('at://post/1');
    item1.record.text = 'first version';
    await offlineStorage.saveFeedItems([item1]);

    const item2 = makeFeedItem('at://post/1');
    item2.record.text = 'second version';
    await offlineStorage.saveFeedItems([item2]);

    const result = await offlineStorage.getFeedItems(50);
    expect(result).toHaveLength(1);
    expect(result[0].record.text).toBe('second version');
  });

  it('sorts by indexedAt newest first', async () => {
    const older = makeFeedItem('at://post/old', '2024-01-01T00:00:00Z');
    const newer = makeFeedItem('at://post/new', '2025-01-01T00:00:00Z');
    await offlineStorage.saveFeedItems([older, newer]);

    const result = await offlineStorage.getFeedItems(50);
    expect(result[0].uri).toBe('at://post/new');
    expect(result[1].uri).toBe('at://post/old');
  });

  it('enforces 500-item limit', async () => {
    const items = [];
    for (let i = 0; i < 510; i++) {
      items.push(
        makeFeedItem(`at://post/${i}`, new Date(Date.now() - i * 1000).toISOString())
      );
    }
    await offlineStorage.saveFeedItems(items);

    const result = await offlineStorage.getFeedItems(600);
    expect(result).toHaveLength(500);
  });

  it('getFeedItems respects limit parameter', async () => {
    const items = [];
    for (let i = 0; i < 20; i++) {
      items.push(makeFeedItem(`at://post/${i}`));
    }
    await offlineStorage.saveFeedItems(items);

    const result = await offlineStorage.getFeedItems(5);
    expect(result).toHaveLength(5);
  });

  it('getFeedItems filters by feedType', async () => {
    const timelineItem = makeFeedItem('at://post/tl', undefined, 'timeline');
    const searchItem = makeFeedItem('at://post/search', undefined, 'search');
    await offlineStorage.saveFeedItems([timelineItem], 'timeline');
    await offlineStorage.saveFeedItems([searchItem], 'search');

    const timelineResults = await offlineStorage.getFeedItems(50, 'timeline');
    expect(timelineResults).toHaveLength(1);
    expect(timelineResults[0].uri).toBe('at://post/tl');

    const searchResults = await offlineStorage.getFeedItems(50, 'search');
    expect(searchResults).toHaveLength(1);
    expect(searchResults[0].uri).toBe('at://post/search');
  });

  it('hasFeedItems returns true when items exist', async () => {
    expect(await offlineStorage.hasFeedItems()).toBe(false);

    await offlineStorage.saveFeedItems([makeFeedItem('at://post/1')]);
    expect(await offlineStorage.hasFeedItems()).toBe(true);
  });
});

// ==================== Thread Storage ====================

describe('Thread storage', () => {
  it('saveThread and getThread round-trips correctly', async () => {
    const posts = [{ uri: 'at://post/1', text: 'root' }, { uri: 'at://post/2', text: 'reply' }];
    await offlineStorage.saveThread('at://thread/1', posts);

    const result = await offlineStorage.getThread('at://thread/1');
    expect(result).not.toBeNull();
    expect(result.threadUri).toBe('at://thread/1');
    expect(result.posts).toHaveLength(2);
    expect(result._offlineCachedAt).toBeDefined();
  });

  it('getThread updates _lastAccessedAt', async () => {
    await offlineStorage.saveThread('at://thread/1', [{ text: 'post' }]);

    const first = await offlineStorage.getThread('at://thread/1');
    const firstAccess = first._lastAccessedAt;

    await new Promise(r => setTimeout(r, 10));

    const second = await offlineStorage.getThread('at://thread/1');
    expect(second._lastAccessedAt).toBeGreaterThanOrEqual(firstAccess);
  });

  it('evicts oldest accessed thread when exceeding 100 limit (LRU)', async () => {
    for (let i = 0; i < 100; i++) {
      await offlineStorage.saveThread(`at://thread/${i}`, [{ text: `post ${i}` }]);
    }

    // Access thread/0 to make it recently used
    await offlineStorage.getThread('at://thread/0');

    // Save thread 101 - this should evict the least recently accessed thread
    await offlineStorage.saveThread('at://thread/100', [{ text: 'post 100' }]);

    // thread/0 was accessed recently, so it should still be present
    const thread0 = await offlineStorage.hasThread('at://thread/0');
    expect(thread0).toBe(true);

    // thread/100 (the new one) should be present
    const thread100 = await offlineStorage.hasThread('at://thread/100');
    expect(thread100).toBe(true);

    // Verify we still have exactly 100 threads
    const data = await AsyncStorage.getItem(STORAGE_KEYS.THREAD_ITEMS);
    const threads = JSON.parse(data!);
    expect(threads).toHaveLength(100);
  });

  it('hasThread returns true for existing thread', async () => {
    await offlineStorage.saveThread('at://thread/1', [{ text: 'post' }]);
    expect(await offlineStorage.hasThread('at://thread/1')).toBe(true);
  });

  it('hasThread returns false for non-existent thread', async () => {
    expect(await offlineStorage.hasThread('at://thread/nope')).toBe(false);
  });

  it('getThread returns null for non-existent thread', async () => {
    const result = await offlineStorage.getThread('at://thread/nope');
    expect(result).toBeNull();
  });
});

// ==================== Notification Storage ====================

describe('Notification storage', () => {
  it('saveNotificationItems saves and retrieves items', async () => {
    const items = [
      makeNotificationItem('at://notif/1', 'like'),
      makeNotificationItem('at://notif/2', 'follow'),
    ];
    await offlineStorage.saveNotificationItems(items);

    const result = await offlineStorage.getNotificationItems(50);
    expect(result).toHaveLength(2);
    expect(result[0]._offlineCachedAt).toBeDefined();
  });

  it('deduplicates notifications by URI', async () => {
    const item1 = makeNotificationItem('at://notif/1', 'like');
    await offlineStorage.saveNotificationItems([item1]);

    const item2 = makeNotificationItem('at://notif/1', 'repost');
    await offlineStorage.saveNotificationItems([item2]);

    const result = await offlineStorage.getNotificationItems(50);
    expect(result).toHaveLength(1);
    expect(result[0].reason).toBe('repost');
  });

  it('enforces 200-item limit', async () => {
    const items = [];
    for (let i = 0; i < 210; i++) {
      items.push(
        makeNotificationItem(
          `at://notif/${i}`,
          'like',
          new Date(Date.now() - i * 1000).toISOString()
        )
      );
    }
    await offlineStorage.saveNotificationItems(items);

    const result = await offlineStorage.getNotificationItems(300);
    expect(result).toHaveLength(200);
  });

  it('getNotificationItems respects limit parameter', async () => {
    const items = [];
    for (let i = 0; i < 30; i++) {
      items.push(makeNotificationItem(`at://notif/${i}`));
    }
    await offlineStorage.saveNotificationItems(items);

    const result = await offlineStorage.getNotificationItems(10);
    expect(result).toHaveLength(10);
  });
});

// ==================== Eviction ====================

describe('Eviction', () => {
  it('evictOldFeedItems removes items older than 7 days', async () => {
    const items = [makeFeedItem('at://post/old'), makeFeedItem('at://post/recent')];
    await offlineStorage.saveFeedItems(items);

    const data = JSON.parse((await AsyncStorage.getItem(STORAGE_KEYS.FEED_ITEMS))!);
    const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
    const oldItem = data.find((i: any) => i.uri === 'at://post/old');
    oldItem._offlineCachedAt = eightDaysAgo;
    await AsyncStorage.setItem(STORAGE_KEYS.FEED_ITEMS, JSON.stringify(data));

    const evicted = await offlineStorage.evictOldFeedItems();
    expect(evicted).toBe(1);

    const remaining = await offlineStorage.getFeedItems(50);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].uri).toBe('at://post/recent');
  });

  it('evictOldThreads removes threads older than 30 days', async () => {
    await offlineStorage.saveThread('at://thread/old', [{ text: 'old' }]);
    await offlineStorage.saveThread('at://thread/recent', [{ text: 'recent' }]);

    const data = JSON.parse((await AsyncStorage.getItem(STORAGE_KEYS.THREAD_ITEMS))!);
    const thirtyOneDaysAgo = Date.now() - 31 * 24 * 60 * 60 * 1000;
    const oldThread = data.find((t: any) => t.threadUri === 'at://thread/old');
    oldThread._offlineCachedAt = thirtyOneDaysAgo;
    await AsyncStorage.setItem(STORAGE_KEYS.THREAD_ITEMS, JSON.stringify(data));

    const evicted = await offlineStorage.evictOldThreads();
    expect(evicted).toBe(1);

    expect(await offlineStorage.hasThread('at://thread/old')).toBe(false);
    expect(await offlineStorage.hasThread('at://thread/recent')).toBe(true);
  });

  it('evictOldNotifications removes items older than 7 days', async () => {
    const items = [
      makeNotificationItem('at://notif/old'),
      makeNotificationItem('at://notif/recent'),
    ];
    await offlineStorage.saveNotificationItems(items);

    const data = JSON.parse((await AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATION_ITEMS))!);
    const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
    const oldItem = data.find((i: any) => i.uri === 'at://notif/old');
    oldItem._offlineCachedAt = eightDaysAgo;
    await AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATION_ITEMS, JSON.stringify(data));

    const evicted = await offlineStorage.evictOldNotifications();
    expect(evicted).toBe(1);

    const remaining = await offlineStorage.getNotificationItems(50);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].uri).toBe('at://notif/recent');
  });

  it('keeps items within the age limit', async () => {
    const items = [makeFeedItem('at://post/1'), makeFeedItem('at://post/2')];
    await offlineStorage.saveFeedItems(items);

    const evicted = await offlineStorage.evictOldFeedItems();
    expect(evicted).toBe(0);

    const remaining = await offlineStorage.getFeedItems(50);
    expect(remaining).toHaveLength(2);
  });
});

// ==================== Stats ====================

describe('Stats', () => {
  it('getStats returns correct counts', async () => {
    await offlineStorage.saveFeedItems([
      makeFeedItem('at://post/1'),
      makeFeedItem('at://post/2'),
      makeFeedItem('at://post/3'),
    ]);
    await offlineStorage.saveThread('at://thread/1', [{ text: 'post' }]);
    await offlineStorage.saveThread('at://thread/2', [{ text: 'post' }]);

    const stats = await offlineStorage.getStats();
    expect(stats.feedItemCount).toBe(3);
    expect(stats.threadItemCount).toBe(2);
    expect(stats.lastFeedSync).toBeGreaterThan(0);
    expect(stats.lastThreadSync).toBeGreaterThan(0);
    expect(stats.estimatedSize).toBeGreaterThan(0);
  });

  it('getStats returns zeros for empty storage', async () => {
    const stats = await offlineStorage.getStats();
    expect(stats.feedItemCount).toBe(0);
    expect(stats.threadItemCount).toBe(0);
    expect(stats.lastFeedSync).toBeNull();
    expect(stats.lastThreadSync).toBeNull();
    expect(stats.estimatedSize).toBe(0);
  });
});

// ==================== Clear ====================

describe('Clear', () => {
  it('clearAll wipes all storage keys', async () => {
    await offlineStorage.saveFeedItems([makeFeedItem('at://post/1')]);
    await offlineStorage.saveThread('at://thread/1', [{ text: 'post' }]);
    await offlineStorage.saveNotificationItems([makeNotificationItem('at://notif/1')]);

    await offlineStorage.clearAll();

    expect(await AsyncStorage.getItem(STORAGE_KEYS.FEED_ITEMS)).toBeNull();
    expect(await AsyncStorage.getItem(STORAGE_KEYS.FEED_METADATA)).toBeNull();
    expect(await AsyncStorage.getItem(STORAGE_KEYS.THREAD_ITEMS)).toBeNull();
    expect(await AsyncStorage.getItem(STORAGE_KEYS.THREAD_METADATA)).toBeNull();
    expect(await AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATION_ITEMS)).toBeNull();
  });

  it('after clearAll, getFeedItems returns empty', async () => {
    await offlineStorage.saveFeedItems([makeFeedItem('at://post/1')]);
    await offlineStorage.clearAll();

    const result = await offlineStorage.getFeedItems(50);
    expect(result).toHaveLength(0);
  });
});
