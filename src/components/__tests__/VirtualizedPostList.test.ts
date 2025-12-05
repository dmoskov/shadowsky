import { beforeEach, describe, expect, it } from "vitest";
import { _testExports } from "../VirtualizedPostList";

const { LRUCache, scrollPositions, scrollAnchors, MAX_SCROLL_CACHE_SIZE } =
  _testExports;

describe("LRUCache", () => {
  let cache: InstanceType<typeof LRUCache<string, number>>;

  beforeEach(() => {
    cache = new LRUCache<string, number>(3);
  });

  it("should store and retrieve values", () => {
    cache.set("a", 1);
    cache.set("b", 2);
    expect(cache.get("a")).toBe(1);
    expect(cache.get("b")).toBe(2);
  });

  it("should return undefined for missing keys", () => {
    expect(cache.get("nonexistent")).toBeUndefined();
  });

  it("should report correct size", () => {
    expect(cache.size).toBe(0);
    cache.set("a", 1);
    expect(cache.size).toBe(1);
    cache.set("b", 2);
    expect(cache.size).toBe(2);
  });

  it("should evict oldest entry when at capacity", () => {
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3);
    // At capacity (3), adding a 4th should evict 'a'
    cache.set("d", 4);

    expect(cache.size).toBe(3);
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBe(2);
    expect(cache.get("c")).toBe(3);
    expect(cache.get("d")).toBe(4);
  });

  it("should update LRU order on get", () => {
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3);

    // Access 'a' to make it most recently used
    cache.get("a");

    // Add new entry - should evict 'b' (now oldest)
    cache.set("d", 4);

    expect(cache.get("a")).toBe(1); // 'a' was accessed, should still exist
    expect(cache.get("b")).toBeUndefined(); // 'b' was evicted
    expect(cache.get("c")).toBe(3);
    expect(cache.get("d")).toBe(4);
  });

  it("should update LRU order on set of existing key", () => {
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3);

    // Update 'a' to make it most recently used
    cache.set("a", 10);

    // Add new entry - should evict 'b' (now oldest)
    cache.set("d", 4);

    expect(cache.get("a")).toBe(10);
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("c")).toBe(3);
    expect(cache.get("d")).toBe(4);
  });

  it("should correctly report has()", () => {
    cache.set("a", 1);
    expect(cache.has("a")).toBe(true);
    expect(cache.has("b")).toBe(false);
  });

  it("should support delete()", () => {
    cache.set("a", 1);
    expect(cache.has("a")).toBe(true);
    cache.delete("a");
    expect(cache.has("a")).toBe(false);
    expect(cache.size).toBe(0);
  });

  it("should support clear()", () => {
    cache.set("a", 1);
    cache.set("b", 2);
    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBeUndefined();
  });
});

describe("Scroll position caches", () => {
  beforeEach(() => {
    scrollPositions.clear();
    scrollAnchors.clear();
  });

  it("should have the configured max size", () => {
    expect(MAX_SCROLL_CACHE_SIZE).toBe(50);
  });

  it("should limit scrollPositions to MAX_SCROLL_CACHE_SIZE entries", () => {
    // Fill up the cache beyond its capacity
    for (let i = 0; i < MAX_SCROLL_CACHE_SIZE + 10; i++) {
      scrollPositions.set(`key-${i}`, i * 100);
    }

    // Should be limited to MAX_SCROLL_CACHE_SIZE
    expect(scrollPositions.size).toBe(MAX_SCROLL_CACHE_SIZE);

    // Oldest entries should have been evicted
    expect(scrollPositions.get("key-0")).toBeUndefined();
    expect(scrollPositions.get("key-9")).toBeUndefined();

    // Newest entries should exist
    expect(scrollPositions.get(`key-${MAX_SCROLL_CACHE_SIZE + 9}`)).toBe(
      (MAX_SCROLL_CACHE_SIZE + 9) * 100,
    );
  });

  it("should limit scrollAnchors to MAX_SCROLL_CACHE_SIZE entries", () => {
    const createAnchor = (index: number) => ({
      itemKey: `item-${index}`,
      itemIndex: index,
      offsetWithinItem: 0,
      scrollTop: index * 100,
    });

    // Fill up the cache beyond its capacity
    for (let i = 0; i < MAX_SCROLL_CACHE_SIZE + 10; i++) {
      scrollAnchors.set(`key-${i}`, createAnchor(i));
    }

    // Should be limited to MAX_SCROLL_CACHE_SIZE
    expect(scrollAnchors.size).toBe(MAX_SCROLL_CACHE_SIZE);

    // Oldest entries should have been evicted
    expect(scrollAnchors.get("key-0")).toBeUndefined();
    expect(scrollAnchors.get("key-9")).toBeUndefined();

    // Newest entries should exist
    const newestKey = `key-${MAX_SCROLL_CACHE_SIZE + 9}`;
    const newestAnchor = scrollAnchors.get(newestKey);
    expect(newestAnchor).toBeDefined();
    expect(newestAnchor?.itemKey).toBe(`item-${MAX_SCROLL_CACHE_SIZE + 9}`);
  });

  it("should prevent memory leaks by evicting old entries in long sessions", () => {
    // Simulate a long session with many different feeds/views
    // Add entries over time (simulating user navigating to many different feeds)
    for (let session = 0; session < 5; session++) {
      for (let i = 0; i < 20; i++) {
        const key = `session-${session}-feed-${i}`;
        scrollPositions.set(key, Math.random() * 1000);
        scrollAnchors.set(key, {
          itemKey: `item-${i}`,
          itemIndex: i,
          offsetWithinItem: 0,
          scrollTop: Math.random() * 1000,
        });
      }
    }

    // Total added: 100 entries, but cache should be limited to 50
    expect(scrollPositions.size).toBe(MAX_SCROLL_CACHE_SIZE);
    expect(scrollAnchors.size).toBe(MAX_SCROLL_CACHE_SIZE);

    // This demonstrates that memory is bounded
    expect(scrollPositions.size).toBeLessThanOrEqual(MAX_SCROLL_CACHE_SIZE);
    expect(scrollAnchors.size).toBeLessThanOrEqual(MAX_SCROLL_CACHE_SIZE);
  });
});
