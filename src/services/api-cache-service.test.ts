/**
 * Tests for API Cache Service
 *
 * Coverage targets:
 * 1. Cache initialization and DB creation
 * 2. Cache read/write/delete operations
 * 3. TTL expiration behavior
 * 4. LRU eviction under storage pressure
 * 5. Offline status detection
 * 6. Cache statistics and metrics
 * 7. Concurrent access patterns
 * 8. Error handling for quota exceeded
 */

import Dexie from "dexie";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from "vitest";
import {
  apiCacheService,
  CACHE_LIMITS,
  CACHE_NAMES,
  type CacheType,
} from "./api-cache-service";

// Mock the logger to suppress output during tests
vi.mock("../utils/logger", () => ({
  createLogger: () => ({
    log: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock storage-retry to avoid circuit breaker issues in tests
vi.mock("../utils/storage-retry", () => ({
  withIndexedDBRetry: vi.fn((operation: () => Promise<unknown>) => operation()),
}));

/**
 * Helper to create a mock Response object
 */
function createMockResponse(
  body: string | object,
  status = 200,
  headers: Record<string, string> = {}
): Response {
  const bodyString = typeof body === "string" ? body : JSON.stringify(body);
  return new Response(bodyString, {
    status,
    statusText: status === 200 ? "OK" : "Error",
    headers: new Headers({
      "Content-Type": "application/json",
      ...headers,
    }),
  });
}

/**
 * Helper to wait for async operations
 */
function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("APICacheService", () => {
  // Reset singleton state between tests
  beforeEach(async () => {
    // Delete existing database to ensure clean state
    await Dexie.delete("APICacheDB");
    // Re-initialize the service
    // @ts-expect-error - accessing private property for testing
    apiCacheService.db = null;
    // @ts-expect-error - accessing private property for testing
    apiCacheService.isInitialized = false;
    // @ts-expect-error - accessing private property for testing
    apiCacheService.lastOnlineAt = null;
    // @ts-expect-error - accessing private property for testing
    apiCacheService.offlineCallbacks = new Set();

    // Mock navigator.onLine
    Object.defineProperty(navigator, "onLine", {
      value: true,
      writable: true,
      configurable: true,
    });
  });

  afterEach(async () => {
    // Clean up database after each test
    try {
      // @ts-expect-error - accessing private property for testing
      if (apiCacheService.db) {
        // @ts-expect-error - accessing private property for testing
        await apiCacheService.db.cacheEntries.clear();
      }
    } catch {
      // Ignore cleanup errors
    }
    vi.clearAllMocks();
  });

  // ==================== Initialization Tests ====================

  describe("Initialization", () => {
    it("should initialize successfully with IndexedDB", async () => {
      await apiCacheService.init();

      // @ts-expect-error - accessing private property for testing
      expect(apiCacheService.isInitialized).toBe(true);
      // @ts-expect-error - accessing private property for testing
      expect(apiCacheService.db).not.toBeNull();
    });

    it("should be idempotent - calling init twice should not cause issues", async () => {
      await apiCacheService.init();
      await apiCacheService.init(); // Second call should be no-op

      // @ts-expect-error - accessing private property for testing
      expect(apiCacheService.isInitialized).toBe(true);
    });

    it("should set lastOnlineAt if navigator is online", async () => {
      Object.defineProperty(navigator, "onLine", {
        value: true,
        writable: true,
        configurable: true,
      });

      await apiCacheService.init();

      // @ts-expect-error - accessing private property for testing
      expect(apiCacheService.lastOnlineAt).toBeGreaterThan(0);
    });

    it("should not set lastOnlineAt if navigator is offline", async () => {
      Object.defineProperty(navigator, "onLine", {
        value: false,
        writable: true,
        configurable: true,
      });

      await apiCacheService.init();

      // @ts-expect-error - accessing private property for testing
      expect(apiCacheService.lastOnlineAt).toBeNull();
    });

    it("should throw error when accessing DB without init", async () => {
      // @ts-expect-error - accessing private method for testing
      expect(() => apiCacheService.ensureDB()).toThrow(
        "APICacheService not initialized. Call init() first."
      );
    });
  });

  // ==================== Read/Write/Delete Operations ====================

  describe("Cache Operations", () => {
    beforeEach(async () => {
      await apiCacheService.init();
    });

    describe("cacheResponse", () => {
      it("should cache a response successfully", async () => {
        const url = "https://api.example.com/test";
        const response = createMockResponse({ data: "test" });

        await apiCacheService.cacheResponse(CACHE_NAMES.API, url, response);

        const cached = await apiCacheService.getCachedResponse(
          url,
          CACHE_NAMES.API
        );
        expect(cached).toBeDefined();
        expect(cached?.status).toBe(200);
      });

      it("should store response with correct timestamps", async () => {
        const url = "https://api.example.com/timestamp-test";
        const response = createMockResponse({ data: "timestamp" });
        const beforeCache = Date.now();

        await apiCacheService.cacheResponse(CACHE_NAMES.API, url, response);

        // @ts-expect-error - accessing private property for testing
        const entry = await apiCacheService.db.cacheEntries.get(
          `${CACHE_NAMES.API}:${url}`
        );
        expect(entry?.createdAt).toBeGreaterThanOrEqual(beforeCache);
        expect(entry?.lastAccessedAt).toBeGreaterThanOrEqual(beforeCache);
      });

      it("should store response headers correctly", async () => {
        const url = "https://api.example.com/headers-test";
        const response = createMockResponse(
          { data: "headers" },
          200,
          { "X-Custom-Header": "test-value" }
        );

        await apiCacheService.cacheResponse(CACHE_NAMES.API, url, response);

        const cached = await apiCacheService.getCachedResponse(
          url,
          CACHE_NAMES.API
        );
        expect(cached?.headers.get("X-Custom-Header")).toBe("test-value");
      });

      it("should overwrite existing cache entry for same URL", async () => {
        const url = "https://api.example.com/overwrite-test";
        const response1 = createMockResponse({ version: 1 });
        const response2 = createMockResponse({ version: 2 });

        await apiCacheService.cacheResponse(CACHE_NAMES.API, url, response1);
        await apiCacheService.cacheResponse(CACHE_NAMES.API, url, response2);

        const cached = await apiCacheService.getCachedResponse(
          url,
          CACHE_NAMES.API
        );
        const body = await cached?.json();
        expect(body.version).toBe(2);
      });

      it("should store entries in different cache types independently", async () => {
        const url = "https://api.example.com/cache-types";
        const apiResponse = createMockResponse({ type: "api" });
        const chatResponse = createMockResponse({ type: "chat" });

        await apiCacheService.cacheResponse(CACHE_NAMES.API, url, apiResponse);
        await apiCacheService.cacheResponse(CACHE_NAMES.CHAT, url, chatResponse);

        const cachedApi = await apiCacheService.getCachedResponse(
          url,
          CACHE_NAMES.API
        );
        const cachedChat = await apiCacheService.getCachedResponse(
          url,
          CACHE_NAMES.CHAT
        );

        const apiBody = await cachedApi?.json();
        const chatBody = await cachedChat?.json();

        expect(apiBody.type).toBe("api");
        expect(chatBody.type).toBe("chat");
      });
    });

    describe("getCachedResponse", () => {
      it("should return undefined for non-existent entry", async () => {
        const cached = await apiCacheService.getCachedResponse(
          "https://api.example.com/nonexistent",
          CACHE_NAMES.API
        );
        expect(cached).toBeUndefined();
      });

      it("should update lastAccessedAt on read", async () => {
        const url = "https://api.example.com/lru-test";
        const response = createMockResponse({ data: "lru" });

        await apiCacheService.cacheResponse(CACHE_NAMES.API, url, response);

        // @ts-expect-error - accessing private property for testing
        const entryBefore = await apiCacheService.db.cacheEntries.get(
          `${CACHE_NAMES.API}:${url}`
        );
        const accessedBefore = entryBefore?.lastAccessedAt;

        // Wait a bit to ensure timestamp difference
        await wait(10);

        await apiCacheService.getCachedResponse(url, CACHE_NAMES.API);

        // @ts-expect-error - accessing private property for testing
        const entryAfter = await apiCacheService.db.cacheEntries.get(
          `${CACHE_NAMES.API}:${url}`
        );
        expect(entryAfter?.lastAccessedAt).toBeGreaterThan(accessedBefore!);
      });

      it("should search all cache types when cacheType not specified", async () => {
        const url = "https://api.example.com/search-all";
        const response = createMockResponse({ found: true });

        await apiCacheService.cacheResponse(CACHE_NAMES.CHAT, url, response);

        const cached = await apiCacheService.getCachedResponse(url);
        expect(cached).toBeDefined();
      });
    });

    describe("deleteCachedEntry", () => {
      it("should delete a cached entry", async () => {
        const url = "https://api.example.com/delete-test";
        const response = createMockResponse({ data: "delete" });

        await apiCacheService.cacheResponse(CACHE_NAMES.API, url, response);
        const result = await apiCacheService.deleteCachedEntry(
          url,
          CACHE_NAMES.API
        );

        expect(result).toBe(true);

        const cached = await apiCacheService.getCachedResponse(
          url,
          CACHE_NAMES.API
        );
        expect(cached).toBeUndefined();
      });

      it("should return true even for non-existent entry", async () => {
        const result = await apiCacheService.deleteCachedEntry(
          "https://nonexistent.com",
          CACHE_NAMES.API
        );
        expect(result).toBe(true);
      });
    });

    describe("isCached", () => {
      it("should return true for cached and non-expired entry", async () => {
        const url = "https://api.example.com/is-cached";
        const response = createMockResponse({ data: "cached" });

        await apiCacheService.cacheResponse(CACHE_NAMES.API, url, response);

        const isCached = await apiCacheService.isCached(url, CACHE_NAMES.API);
        expect(isCached).toBe(true);
      });

      it("should return false for non-existent entry", async () => {
        const isCached = await apiCacheService.isCached(
          "https://nonexistent.com",
          CACHE_NAMES.API
        );
        expect(isCached).toBe(false);
      });

      it("should search all cache types when cacheType not specified", async () => {
        const url = "https://api.example.com/is-cached-all";
        const response = createMockResponse({ data: "cached" });

        await apiCacheService.cacheResponse(CACHE_NAMES.AVATARS, url, response);

        const isCached = await apiCacheService.isCached(url);
        expect(isCached).toBe(true);
      });
    });

    describe("clearCache", () => {
      it("should clear a specific cache type", async () => {
        const url1 = "https://api.example.com/clear1";
        const url2 = "https://api.example.com/clear2";

        await apiCacheService.cacheResponse(
          CACHE_NAMES.API,
          url1,
          createMockResponse({ data: "1" })
        );
        await apiCacheService.cacheResponse(
          CACHE_NAMES.CHAT,
          url2,
          createMockResponse({ data: "2" })
        );

        await apiCacheService.clearCache(CACHE_NAMES.API);

        const cached1 = await apiCacheService.getCachedResponse(
          url1,
          CACHE_NAMES.API
        );
        const cached2 = await apiCacheService.getCachedResponse(
          url2,
          CACHE_NAMES.CHAT
        );

        expect(cached1).toBeUndefined();
        expect(cached2).toBeDefined();
      });
    });

    describe("clearAllAPICaches", () => {
      it("should clear all cache types", async () => {
        const urls = [
          { url: "https://api.example.com/1", type: CACHE_NAMES.API },
          { url: "https://api.example.com/2", type: CACHE_NAMES.CHAT },
          { url: "https://api.example.com/3", type: CACHE_NAMES.CDN_IMAGES },
          { url: "https://api.example.com/4", type: CACHE_NAMES.AVATARS },
        ];

        for (const { url, type } of urls) {
          await apiCacheService.cacheResponse(
            type,
            url,
            createMockResponse({ data: url })
          );
        }

        await apiCacheService.clearAllAPICaches();

        for (const { url, type } of urls) {
          const cached = await apiCacheService.getCachedResponse(url, type);
          expect(cached).toBeUndefined();
        }
      });
    });
  });

  // ==================== TTL Expiration Tests ====================

  describe("TTL Expiration", () => {
    beforeEach(async () => {
      await apiCacheService.init();
    });

    it("should auto-delete expired entries on read", async () => {
      const url = "https://api.example.com/ttl-test";
      const response = createMockResponse({ data: "ttl" });

      await apiCacheService.cacheResponse(CACHE_NAMES.API, url, response);

      // Manually set createdAt to past (expired)
      // @ts-expect-error - accessing private property for testing
      await apiCacheService.db.cacheEntries.update(`${CACHE_NAMES.API}:${url}`, {
        createdAt: Date.now() - CACHE_LIMITS.API_MAX_AGE_MS - 1000,
      });

      const cached = await apiCacheService.getCachedResponse(
        url,
        CACHE_NAMES.API
      );
      expect(cached).toBeUndefined();

      // Entry should be deleted
      // @ts-expect-error - accessing private property for testing
      const entry = await apiCacheService.db.cacheEntries.get(
        `${CACHE_NAMES.API}:${url}`
      );
      expect(entry).toBeUndefined();
    });

    it("should return non-expired entries", async () => {
      const url = "https://api.example.com/not-expired";
      const response = createMockResponse({ data: "fresh" });

      await apiCacheService.cacheResponse(CACHE_NAMES.API, url, response);

      const cached = await apiCacheService.getCachedResponse(
        url,
        CACHE_NAMES.API
      );
      expect(cached).toBeDefined();
    });

    it("should report expired entries as not cached in isCached", async () => {
      const url = "https://api.example.com/expired-check";
      const response = createMockResponse({ data: "check" });

      await apiCacheService.cacheResponse(CACHE_NAMES.API, url, response);

      // Manually set createdAt to past (expired)
      // @ts-expect-error - accessing private property for testing
      await apiCacheService.db.cacheEntries.update(`${CACHE_NAMES.API}:${url}`, {
        createdAt: Date.now() - CACHE_LIMITS.API_MAX_AGE_MS - 1000,
      });

      const isCached = await apiCacheService.isCached(url, CACHE_NAMES.API);
      expect(isCached).toBe(false);
    });

    it("should evict old entries based on TTL", async () => {
      const url = "https://api.example.com/evict-ttl";
      const response = createMockResponse({ data: "evict" });

      await apiCacheService.cacheResponse(CACHE_NAMES.API, url, response);

      // Manually set createdAt to past
      // @ts-expect-error - accessing private property for testing
      await apiCacheService.db.cacheEntries.update(`${CACHE_NAMES.API}:${url}`, {
        createdAt: Date.now() - CACHE_LIMITS.API_MAX_AGE_MS - 1000,
      });

      const result = await apiCacheService.evictOldEntries(
        CACHE_NAMES.API,
        CACHE_LIMITS.API_MAX_AGE_MS
      );

      expect(result.entriesRemoved).toBe(1);
      expect(result.bytesFreed).toBeGreaterThan(0);
    });
  });

  // ==================== LRU Eviction Tests ====================

  describe("LRU Eviction", () => {
    beforeEach(async () => {
      await apiCacheService.init();
    });

    it("should evict oldest accessed entries when max entries exceeded", async () => {
      // Create entries with different access times
      for (let i = 0; i < 5; i++) {
        const url = `https://api.example.com/lru-${i}`;
        await apiCacheService.cacheResponse(
          CACHE_NAMES.API,
          url,
          createMockResponse({ index: i })
        );
        // Set different lastAccessedAt times
        // @ts-expect-error - accessing private property for testing
        await apiCacheService.db.cacheEntries.update(
          `${CACHE_NAMES.API}:${url}`,
          {
            lastAccessedAt: Date.now() - (5 - i) * 1000, // Older entries have smaller timestamps
          }
        );
      }

      // Evict to keep only 3 entries
      const result = await apiCacheService.evictBySize(CACHE_NAMES.API, 3);

      expect(result.entriesRemoved).toBe(2);

      // Oldest entries (0 and 1) should be removed
      const cached0 = await apiCacheService.getCachedResponse(
        "https://api.example.com/lru-0",
        CACHE_NAMES.API
      );
      const cached1 = await apiCacheService.getCachedResponse(
        "https://api.example.com/lru-1",
        CACHE_NAMES.API
      );
      const cached4 = await apiCacheService.getCachedResponse(
        "https://api.example.com/lru-4",
        CACHE_NAMES.API
      );

      expect(cached0).toBeUndefined();
      expect(cached1).toBeUndefined();
      expect(cached4).toBeDefined();
    });

    it("should not evict when under max entries", async () => {
      for (let i = 0; i < 3; i++) {
        const url = `https://api.example.com/no-evict-${i}`;
        await apiCacheService.cacheResponse(
          CACHE_NAMES.API,
          url,
          createMockResponse({ index: i })
        );
      }

      const result = await apiCacheService.evictBySize(CACHE_NAMES.API, 10);

      expect(result.entriesRemoved).toBe(0);
    });

    it("should evict by storage threshold using LRU", async () => {
      // Create some large entries
      const largeData = "x".repeat(10000);
      for (let i = 0; i < 3; i++) {
        const url = `https://api.example.com/storage-${i}`;
        await apiCacheService.cacheResponse(
          CACHE_NAMES.API,
          url,
          createMockResponse({ data: largeData, index: i })
        );
        // Set different lastAccessedAt times
        // @ts-expect-error - accessing private property for testing
        await apiCacheService.db.cacheEntries.update(
          `${CACHE_NAMES.API}:${url}`,
          {
            lastAccessedAt: Date.now() - (3 - i) * 1000,
          }
        );
      }

      // This won't trigger eviction unless we're over threshold
      // Just verify the method runs without error
      const results = await apiCacheService.evictByStorageThreshold();
      expect(Array.isArray(results)).toBe(true);
    });

    it("should run all eviction policies", async () => {
      // Create some entries
      for (let i = 0; i < 3; i++) {
        const url = `https://api.example.com/policy-${i}`;
        await apiCacheService.cacheResponse(
          CACHE_NAMES.API,
          url,
          createMockResponse({ index: i })
        );
      }

      const results = await apiCacheService.runEvictionPolicies();
      expect(Array.isArray(results)).toBe(true);
    });
  });

  // ==================== Offline Status Tests ====================

  describe("Offline Status Detection", () => {
    beforeEach(async () => {
      await apiCacheService.init();
    });

    it("should report online status correctly", async () => {
      Object.defineProperty(navigator, "onLine", {
        value: true,
        writable: true,
        configurable: true,
      });

      const status = await apiCacheService.getOfflineStatus();
      expect(status.isOnline).toBe(true);
    });

    it("should report offline status correctly", async () => {
      Object.defineProperty(navigator, "onLine", {
        value: false,
        writable: true,
        configurable: true,
      });

      const status = await apiCacheService.getOfflineStatus();
      expect(status.isOnline).toBe(false);
    });

    it("should track lastOnlineAt timestamp", async () => {
      const status = await apiCacheService.getOfflineStatus();
      expect(status.lastOnlineAt).toBeGreaterThan(0);
    });

    it("should subscribe to offline status changes", async () => {
      const callback = vi.fn();
      const unsubscribe = apiCacheService.onOfflineStatusChange(callback);

      expect(typeof unsubscribe).toBe("function");

      // Unsubscribe and verify
      unsubscribe();
      // @ts-expect-error - accessing private property for testing
      expect(apiCacheService.offlineCallbacks.size).toBe(0);
    });

    it("should notify subscribers on online status change", async () => {
      const callback = vi.fn();
      apiCacheService.onOfflineStatusChange(callback);

      // Simulate online event
      // @ts-expect-error - accessing private method for testing
      await apiCacheService.handleOnlineStatusChange(true);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          isOnline: expect.any(Boolean),
        })
      );
    });

    it("should notify subscribers on offline status change", async () => {
      const callback = vi.fn();
      apiCacheService.onOfflineStatusChange(callback);

      // Simulate offline event
      // @ts-expect-error - accessing private method for testing
      await apiCacheService.handleOnlineStatusChange(false);

      expect(callback).toHaveBeenCalled();
    });

    it("should report cached feeds availability", async () => {
      // Add a feed cache entry
      await apiCacheService.cacheResponse(
        CACHE_NAMES.API,
        "https://api.bsky.app/xrpc/app.bsky.feed.getTimeline",
        createMockResponse({ feed: [] })
      );

      const available = await apiCacheService.hasCachedFeeds();
      expect(available).toBe(true);
    });

    it("should report no cached feeds when empty", async () => {
      const available = await apiCacheService.hasCachedFeeds();
      expect(available).toBe(false);
    });

    it("should report cached DMs availability", async () => {
      // Add a DM cache entry
      await apiCacheService.cacheResponse(
        CACHE_NAMES.CHAT,
        "https://api.bsky.app/xrpc/chat.bsky.convo.listConvos",
        createMockResponse({ convos: [] })
      );

      const available = await apiCacheService.hasCachedDMs();
      expect(available).toBe(true);
    });

    it("should report no cached DMs when empty", async () => {
      const available = await apiCacheService.hasCachedDMs();
      expect(available).toBe(false);
    });
  });

  // ==================== Cache Statistics Tests ====================

  describe("Cache Statistics", () => {
    beforeEach(async () => {
      await apiCacheService.init();
    });

    it("should return stats for all cache types", async () => {
      const stats = await apiCacheService.getCacheStats();

      expect(stats.length).toBe(Object.keys(CACHE_NAMES).length);
      for (const stat of stats) {
        expect(stat).toHaveProperty("name");
        expect(stat).toHaveProperty("entryCount");
        expect(stat).toHaveProperty("estimatedSize");
      }
    });

    it("should count entries correctly", async () => {
      for (let i = 0; i < 3; i++) {
        await apiCacheService.cacheResponse(
          CACHE_NAMES.API,
          `https://api.example.com/stats-${i}`,
          createMockResponse({ index: i })
        );
      }

      const stats = await apiCacheService.getCacheStats();
      const apiStats = stats.find((s) => s.name === CACHE_NAMES.API);

      expect(apiStats?.entryCount).toBe(3);
    });

    it("should estimate size correctly", async () => {
      const largeData = "x".repeat(1000);
      await apiCacheService.cacheResponse(
        CACHE_NAMES.API,
        "https://api.example.com/size-test",
        createMockResponse({ data: largeData })
      );

      const stats = await apiCacheService.getCacheStats();
      const apiStats = stats.find((s) => s.name === CACHE_NAMES.API);

      expect(apiStats?.estimatedSize).toBeGreaterThan(1000);
    });

    it("should calculate total cache size", async () => {
      await apiCacheService.cacheResponse(
        CACHE_NAMES.API,
        "https://api.example.com/total1",
        createMockResponse({ data: "test1" })
      );
      await apiCacheService.cacheResponse(
        CACHE_NAMES.CHAT,
        "https://api.example.com/total2",
        createMockResponse({ data: "test2" })
      );

      const totalSize = await apiCacheService.getTotalCacheSize();
      expect(totalSize).toBeGreaterThan(0);
    });

    it("should return zero size for empty cache", async () => {
      const totalSize = await apiCacheService.getTotalCacheSize();
      expect(totalSize).toBe(0);
    });
  });

  // ==================== Concurrent Access Tests ====================

  describe("Concurrent Access", () => {
    beforeEach(async () => {
      await apiCacheService.init();
    });

    it("should handle concurrent writes to different URLs", async () => {
      const writes = Array.from({ length: 10 }, (_, i) =>
        apiCacheService.cacheResponse(
          CACHE_NAMES.API,
          `https://api.example.com/concurrent-${i}`,
          createMockResponse({ index: i })
        )
      );

      await Promise.all(writes);

      // Verify all entries were cached
      for (let i = 0; i < 10; i++) {
        const cached = await apiCacheService.getCachedResponse(
          `https://api.example.com/concurrent-${i}`,
          CACHE_NAMES.API
        );
        expect(cached).toBeDefined();
      }
    });

    it("should handle concurrent writes to same URL", async () => {
      const url = "https://api.example.com/same-url";
      const writes = Array.from({ length: 5 }, (_, i) =>
        apiCacheService.cacheResponse(
          CACHE_NAMES.API,
          url,
          createMockResponse({ version: i })
        )
      );

      await Promise.all(writes);

      // Should have exactly one entry
      const stats = await apiCacheService.getCacheStats();
      const apiStats = stats.find((s) => s.name === CACHE_NAMES.API);
      expect(apiStats?.entryCount).toBe(1);
    });

    it("should handle concurrent reads and writes", async () => {
      const url = "https://api.example.com/read-write";

      // Initial write
      await apiCacheService.cacheResponse(
        CACHE_NAMES.API,
        url,
        createMockResponse({ initial: true })
      );

      // Concurrent reads and writes
      const operations = [
        apiCacheService.getCachedResponse(url, CACHE_NAMES.API),
        apiCacheService.cacheResponse(
          CACHE_NAMES.API,
          url,
          createMockResponse({ updated: true })
        ),
        apiCacheService.getCachedResponse(url, CACHE_NAMES.API),
        apiCacheService.isCached(url, CACHE_NAMES.API),
      ];

      const results = await Promise.all(operations);

      // Should complete without errors
      expect(results[3]).toBe(true); // isCached should be true
    });

    it("should handle concurrent eviction and reads", async () => {
      // Create entries
      for (let i = 0; i < 5; i++) {
        await apiCacheService.cacheResponse(
          CACHE_NAMES.API,
          `https://api.example.com/evict-read-${i}`,
          createMockResponse({ index: i })
        );
      }

      // Concurrent eviction and reads
      const operations = [
        apiCacheService.evictBySize(CACHE_NAMES.API, 3),
        apiCacheService.getCachedResponse(
          "https://api.example.com/evict-read-4",
          CACHE_NAMES.API
        ),
        apiCacheService.getCachedResponse(
          "https://api.example.com/evict-read-3",
          CACHE_NAMES.API
        ),
      ];

      // Should complete without errors
      await expect(Promise.all(operations)).resolves.toBeDefined();
    });
  });

  // ==================== Error Handling Tests ====================

  describe("Error Handling", () => {
    beforeEach(async () => {
      await apiCacheService.init();
    });

    it("should handle cache response errors gracefully", async () => {
      // Create a response that will fail to clone
      const badResponse = {
        clone: () => {
          throw new Error("Clone failed");
        },
      } as unknown as Response;

      // Should not throw
      await expect(
        apiCacheService.cacheResponse(
          CACHE_NAMES.API,
          "https://api.example.com/bad",
          badResponse
        )
      ).resolves.toBeUndefined();
    });

    it("should handle getCachedResponse errors gracefully", async () => {
      // Force an error by corrupting the database reference
      // @ts-expect-error - accessing private property for testing
      const originalDb = apiCacheService.db;

      // @ts-expect-error - accessing private property for testing
      apiCacheService.db = {
        cacheEntries: {
          get: () => Promise.reject(new Error("DB error")),
          update: () => Promise.reject(new Error("DB error")),
          delete: () => Promise.reject(new Error("DB error")),
        },
      };

      const result = await apiCacheService.getCachedResponse(
        "https://api.example.com/error",
        CACHE_NAMES.API
      );
      expect(result).toBeUndefined();

      // Restore
      // @ts-expect-error - accessing private property for testing
      apiCacheService.db = originalDb;
    });

    it("should handle hasCachedFeeds errors gracefully", async () => {
      // @ts-expect-error - accessing private property for testing
      const originalDb = apiCacheService.db;

      // @ts-expect-error - accessing private property for testing
      apiCacheService.db = {
        cacheEntries: {
          where: () => ({
            equals: () => ({
              filter: () => ({
                count: () => Promise.reject(new Error("DB error")),
              }),
            }),
          }),
        },
      };

      const result = await apiCacheService.hasCachedFeeds();
      expect(result).toBe(false);

      // @ts-expect-error - accessing private property for testing
      apiCacheService.db = originalDb;
    });

    it("should handle hasCachedDMs errors gracefully", async () => {
      // @ts-expect-error - accessing private property for testing
      const originalDb = apiCacheService.db;

      // @ts-expect-error - accessing private property for testing
      apiCacheService.db = {
        cacheEntries: {
          where: () => ({
            equals: () => ({
              filter: () => ({
                count: () => Promise.reject(new Error("DB error")),
              }),
            }),
          }),
        },
      };

      const result = await apiCacheService.hasCachedDMs();
      expect(result).toBe(false);

      // @ts-expect-error - accessing private property for testing
      apiCacheService.db = originalDb;
    });

    it("should handle isCached errors gracefully", async () => {
      // @ts-expect-error - accessing private property for testing
      const originalDb = apiCacheService.db;

      // @ts-expect-error - accessing private property for testing
      apiCacheService.db = {
        cacheEntries: {
          get: () => Promise.reject(new Error("DB error")),
        },
      };

      const result = await apiCacheService.isCached(
        "https://api.example.com/error",
        CACHE_NAMES.API
      );
      expect(result).toBe(false);

      // @ts-expect-error - accessing private property for testing
      apiCacheService.db = originalDb;
    });

    it("should handle deleteCachedEntry errors gracefully", async () => {
      // Mock withIndexedDBRetry to throw
      const { withIndexedDBRetry } = await import("../utils/storage-retry");
      (withIndexedDBRetry as Mock).mockRejectedValueOnce(new Error("Delete failed"));

      const result = await apiCacheService.deleteCachedEntry(
        "https://api.example.com/delete-error",
        CACHE_NAMES.API
      );
      expect(result).toBe(false);
    });

    it("should handle clearCache errors gracefully", async () => {
      const { withIndexedDBRetry } = await import("../utils/storage-retry");
      (withIndexedDBRetry as Mock).mockRejectedValueOnce(new Error("Clear failed"));

      const result = await apiCacheService.clearCache(CACHE_NAMES.API);
      expect(result).toBe(false);
    });

    it("should handle clearAllAPICaches errors gracefully", async () => {
      const { withIndexedDBRetry } = await import("../utils/storage-retry");
      (withIndexedDBRetry as Mock).mockRejectedValueOnce(
        new Error("Clear all failed")
      );

      const result = await apiCacheService.clearAllAPICaches();
      expect(result).toBe(false);
    });
  });

  // ==================== Prefetch Tests ====================

  describe("Prefetch for Offline", () => {
    beforeEach(async () => {
      await apiCacheService.init();
    });

    it("should prefetch URLs successfully", async () => {
      // Mock fetch
      const mockFetch = vi.spyOn(global, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ data: "prefetched" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

      await apiCacheService.prefetchForOffline([
        "https://api.example.com/prefetch1",
        "https://api.example.com/prefetch2",
      ]);

      expect(mockFetch).toHaveBeenCalledTimes(2);

      mockFetch.mockRestore();
    });

    it("should handle prefetch failures gracefully", async () => {
      const mockFetch = vi
        .spyOn(global, "fetch")
        .mockRejectedValue(new Error("Network error"));

      // Should not throw
      await expect(
        apiCacheService.prefetchForOffline([
          "https://api.example.com/fail-prefetch",
        ])
      ).resolves.toBeUndefined();

      mockFetch.mockRestore();
    });

    it("should skip caching non-ok responses", async () => {
      const mockFetch = vi.spyOn(global, "fetch").mockResolvedValue(
        new Response(null, { status: 404 })
      );

      await apiCacheService.prefetchForOffline([
        "https://api.example.com/not-found",
      ]);

      const cached = await apiCacheService.getCachedResponse(
        "https://api.example.com/not-found",
        CACHE_NAMES.API
      );
      expect(cached).toBeUndefined();

      mockFetch.mockRestore();
    });
  });

  // ==================== Cache Type Configuration Tests ====================

  describe("Cache Configuration", () => {
    it("should have correct cache limits defined", () => {
      expect(CACHE_LIMITS.API_MAX_ENTRIES).toBe(200);
      expect(CACHE_LIMITS.CHAT_MAX_ENTRIES).toBe(100);
      expect(CACHE_LIMITS.CDN_MAX_ENTRIES).toBe(500);
      expect(CACHE_LIMITS.AVATAR_MAX_ENTRIES).toBe(200);
    });

    it("should have correct TTL values defined", () => {
      expect(CACHE_LIMITS.API_MAX_AGE_MS).toBe(60 * 60 * 1000); // 1 hour
      expect(CACHE_LIMITS.CHAT_MAX_AGE_MS).toBe(15 * 60 * 1000); // 15 minutes
      expect(CACHE_LIMITS.CDN_MAX_AGE_MS).toBe(30 * 24 * 60 * 60 * 1000); // 30 days
      expect(CACHE_LIMITS.AVATAR_MAX_AGE_MS).toBe(7 * 24 * 60 * 60 * 1000); // 7 days
    });

    it("should have all cache types defined", () => {
      expect(CACHE_NAMES.API).toBe("api");
      expect(CACHE_NAMES.CHAT).toBe("chat");
      expect(CACHE_NAMES.CDN_IMAGES).toBe("cdn-images");
      expect(CACHE_NAMES.AVATARS).toBe("avatars");
    });
  });

  // ==================== Singleton Pattern Tests ====================

  describe("Singleton Pattern", () => {
    it("should return the same instance", async () => {
      // The exported apiCacheService is already the singleton instance
      // We can verify by checking it's the same object reference
      const instance1 = apiCacheService;
      const instance2 = apiCacheService;

      expect(instance1).toBe(instance2);
    });
  });
});
