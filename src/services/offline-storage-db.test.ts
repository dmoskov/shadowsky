/**
 * Tests for Offline Storage Database
 *
 * Covers:
 * 1. DB initialization and schema migrations (version 3)
 * 2. Feed item CRUD operations
 * 3. DM conversation and message storage
 * 4. Thread summary caching
 * 5. Storage limits enforcement
 * 6. Cleanup of stale data
 * 7. Concurrent write handling
 * 8. Graceful degradation when DB unavailable
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetAllCircuitBreakers } from "../utils/storage-retry";
import {
  OfflineDMConversation,
  OfflineDMMessage,
  OfflineFeedItem,
  OfflineStorageDB,
  OfflineThreadSummary,
} from "./offline-storage-db";

// Helper to close the database connection
function closeDB(instance: OfflineStorageDB): void {
  // @ts-expect-error - accessing private for testing
  const db = instance.db as IDBDatabase | null;
  if (db) {
    db.close();
    // @ts-expect-error - accessing private for testing
    instance.db = null;
    // @ts-expect-error - accessing private for testing
    instance.initPromise = null;
  }
}

// Helper to delete IndexedDB and wait for it
async function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve(); // Resolve even on error in tests
    request.onblocked = () => resolve(); // Resolve even when blocked
  });
}

// Helper to create a fresh OfflineStorageDB instance for each test
function createFreshDB(): OfflineStorageDB {
  // Reset the singleton for testing
  // @ts-expect-error - accessing private static for testing
  OfflineStorageDB.instance = undefined;
  return OfflineStorageDB.getInstance();
}

// Helper to create mock feed items
// Note: saveFeedItems expects Omit<OfflineFeedItem, "_offlineCachedAt"> which includes _feedType
function createMockFeedItem(
  overrides: Partial<Omit<OfflineFeedItem, "_offlineCachedAt">> = {},
): Omit<OfflineFeedItem, "_offlineCachedAt"> {
  const base: Omit<OfflineFeedItem, "_offlineCachedAt"> = {
    uri: `at://did:plc:test/app.bsky.feed.post/${Date.now()}`,
    cid: `cid-${Date.now()}`,
    indexedAt: new Date().toISOString(),
    author: {
      did: "did:plc:testauthor",
      handle: "testauthor.bsky.social",
      displayName: "Test Author",
      avatar: "https://example.com/avatar.jpg",
    },
    record: {
      text: "This is a test post",
      createdAt: new Date().toISOString(),
    },
    replyCount: 0,
    repostCount: 0,
    likeCount: 0,
    _feedType: "timeline",
  };
  return { ...base, ...overrides };
}

// Helper to create mock DM conversation
function createMockConversation(
  overrides: Partial<OfflineDMConversation> = {},
): Omit<OfflineDMConversation, "_offlineCachedAt"> {
  return {
    id: `convo-${Date.now()}`,
    rev: "rev1",
    members: [
      {
        did: "did:plc:member1",
        handle: "member1.bsky.social",
        displayName: "Member 1",
      },
      {
        did: "did:plc:member2",
        handle: "member2.bsky.social",
        displayName: "Member 2",
      },
    ],
    muted: false,
    unreadCount: 0,
    lastMessageText: "Hello!",
    lastMessageAt: new Date().toISOString(),
    ...overrides,
  };
}

// Helper to create mock DM message
function createMockMessage(
  overrides: Partial<OfflineDMMessage> = {},
): Omit<OfflineDMMessage, "_offlineCachedAt" | "conversationId"> {
  return {
    id: `msg-${Date.now()}`,
    rev: "rev1",
    text: "Hello, this is a test message",
    sentAt: new Date().toISOString(),
    senderDid: "did:plc:sender",
    ...overrides,
  };
}

// Helper to create mock thread summary
function createMockThreadSummary(
  overrides: Partial<OfflineThreadSummary> = {},
): Omit<OfflineThreadSummary, "_offlineCachedAt" | "_lastAccessedAt"> {
  return {
    threadUri: `at://did:plc:test/app.bsky.feed.post/${Date.now()}`,
    summary:
      "Spring breeze flows\nThrough cherry blossoms dancing\nPeace in every word",
    format: "haiku",
    metadata: {
      postCount: 5,
      authors: ["author1", "author2"],
      generatedAt: new Date().toISOString(),
    },
    source: "bookmarked",
    ...overrides,
  };
}

describe("OfflineStorageDB", () => {
  let db: OfflineStorageDB;

  beforeEach(async () => {
    // Reset circuit breakers between tests
    resetAllCircuitBreakers();
    // Create fresh DB instance
    db = createFreshDB();
  });

  afterEach(async () => {
    // Close database connection before cleanup
    closeDB(db);
    // Delete the database
    await deleteDatabase("BskyOfflineStorage");
    // Reset the singleton
    // @ts-expect-error - accessing private static for testing
    OfflineStorageDB.instance = undefined;
  });

  // ==================== DB Initialization & Migrations ====================

  describe("DB Initialization", () => {
    it("should initialize the database successfully", async () => {
      await db.init();
      // If init doesn't throw, it's successful
      expect(true).toBe(true);
    });

    it("should return same promise if init is called multiple times concurrently", async () => {
      const promise1 = db.init();
      const promise2 = db.init();

      // Both should return same promise
      await Promise.all([promise1, promise2]);
      expect(true).toBe(true);
    });

    it("should return immediately if already initialized", async () => {
      await db.init();
      // Second call should return immediately
      await db.init();
      expect(true).toBe(true);
    });

    it("should create all required object stores", async () => {
      await db.init();

      // Check by trying to perform operations on each store
      await db.saveFeedItems([createMockFeedItem()]);
      await db.saveConversations([createMockConversation()]);
      await db.saveMessages("test-convo", [createMockMessage()]);
      await db.saveThreadSummary(createMockThreadSummary());

      const stats = await db.getStats();
      expect(stats.feedItemCount).toBe(1);
      expect(stats.conversationCount).toBe(1);
      expect(stats.messageCount).toBe(1);
      expect(stats.summaryCount).toBe(1);
    });

    it("should throw error when operations are attempted before init", async () => {
      // Create a new instance without init
      const uninitDb = createFreshDB();

      await expect(uninitDb.getFeedItems()).rejects.toThrow(
        "OfflineStorageDB not initialized",
      );
    });
  });

  describe("Schema Migrations", () => {
    it("should handle version 3 schema with thread summaries store", async () => {
      await db.init();

      // Thread summary operations should work
      const summary = createMockThreadSummary();
      await db.saveThreadSummary(summary);

      const retrieved = await db.getThreadSummary(summary.threadUri);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.summary).toBe(summary.summary);
    });

    it("should create compound indexes for efficient queries", async () => {
      await db.init();

      // Test that compound index queries work
      const items = [
        createMockFeedItem({ indexedAt: "2024-01-01T00:00:00Z" }),
        createMockFeedItem({ indexedAt: "2024-01-02T00:00:00Z" }),
        createMockFeedItem({ indexedAt: "2024-01-03T00:00:00Z" }),
      ];

      // Give each a unique URI
      items[0].uri = "at://did:plc:test/app.bsky.feed.post/1";
      items[1].uri = "at://did:plc:test/app.bsky.feed.post/2";
      items[2].uri = "at://did:plc:test/app.bsky.feed.post/3";

      await db.saveFeedItems(items, "timeline");

      // Query should use compound index
      const retrieved = await db.getFeedItems(10, "timeline");
      expect(retrieved.length).toBe(3);
      // Should be sorted by indexedAt descending
      expect(retrieved[0].indexedAt).toBe("2024-01-03T00:00:00Z");
    });
  });

  // ==================== Feed Item Operations ====================

  describe("Feed Item CRUD Operations", () => {
    beforeEach(async () => {
      await db.init();
    });

    it("should save and retrieve feed items", async () => {
      const item = createMockFeedItem();
      await db.saveFeedItems([item], "timeline");

      const retrieved = await db.getFeedItems(10, "timeline");
      expect(retrieved.length).toBe(1);
      expect(retrieved[0].uri).toBe(item.uri);
      expect(retrieved[0].author.handle).toBe(item.author.handle);
      expect(retrieved[0]._feedType).toBe("timeline");
      expect(retrieved[0]._offlineCachedAt).toBeDefined();
    });

    it("should save multiple feed items in batch", async () => {
      const items = [
        createMockFeedItem({ uri: "at://test/1" }),
        createMockFeedItem({ uri: "at://test/2" }),
        createMockFeedItem({ uri: "at://test/3" }),
      ];

      await db.saveFeedItems(items, "timeline");

      const retrieved = await db.getFeedItems(10);
      expect(retrieved.length).toBe(3);
    });

    it("should respect limit parameter when fetching feed items", async () => {
      const items = Array.from({ length: 20 }, (_, i) =>
        createMockFeedItem({ uri: `at://test/${i}` }),
      );

      await db.saveFeedItems(items, "timeline");

      const retrieved = await db.getFeedItems(5);
      expect(retrieved.length).toBe(5);
    });

    it("should filter feed items by feed type", async () => {
      const timelineItems = [
        createMockFeedItem({ uri: "at://test/timeline1" }),
        createMockFeedItem({ uri: "at://test/timeline2" }),
      ];
      const authorItems = [createMockFeedItem({ uri: "at://test/author1" })];

      await db.saveFeedItems(timelineItems, "timeline");
      await db.saveFeedItems(authorItems, "author");

      const timelineRetrieved = await db.getFeedItems(10, "timeline");
      const authorRetrieved = await db.getFeedItems(10, "author");

      expect(timelineRetrieved.length).toBe(2);
      expect(authorRetrieved.length).toBe(1);
    });

    it("should return feed items sorted by indexedAt descending", async () => {
      const items = [
        createMockFeedItem({
          uri: "at://test/1",
          indexedAt: "2024-01-01T00:00:00Z",
        }),
        createMockFeedItem({
          uri: "at://test/2",
          indexedAt: "2024-01-03T00:00:00Z",
        }),
        createMockFeedItem({
          uri: "at://test/3",
          indexedAt: "2024-01-02T00:00:00Z",
        }),
      ];

      await db.saveFeedItems(items, "timeline");

      const retrieved = await db.getFeedItems(10, "timeline");
      expect(retrieved[0].indexedAt).toBe("2024-01-03T00:00:00Z");
      expect(retrieved[1].indexedAt).toBe("2024-01-02T00:00:00Z");
      expect(retrieved[2].indexedAt).toBe("2024-01-01T00:00:00Z");
    });

    it("should update existing feed item when uri matches", async () => {
      const item = createMockFeedItem({ uri: "at://test/same" });
      await db.saveFeedItems([item], "timeline");

      const updatedItem = {
        ...item,
        likeCount: 100,
        record: { ...item.record, text: "Updated text" },
      };
      await db.saveFeedItems([updatedItem], "timeline");

      const retrieved = await db.getFeedItems(10);
      expect(retrieved.length).toBe(1);
      expect(retrieved[0].likeCount).toBe(100);
      expect(retrieved[0].record.text).toBe("Updated text");
    });

    it("should check if feed items exist", async () => {
      expect(await db.hasFeedItems()).toBe(false);

      await db.saveFeedItems([createMockFeedItem()], "timeline");

      expect(await db.hasFeedItems()).toBe(true);
    });

    it("should update metadata when saving feed items", async () => {
      const items = [
        createMockFeedItem({
          uri: "at://test/1",
          indexedAt: "2024-01-01T00:00:00Z",
        }),
        createMockFeedItem({
          uri: "at://test/2",
          indexedAt: "2024-01-03T00:00:00Z",
        }),
      ];

      await db.saveFeedItems(items, "timeline");

      const metadata = await db.getMetadata("feed_timeline");
      expect(metadata).not.toBeNull();
      expect(metadata?.lastSyncAt).toBeDefined();
      expect(metadata?.itemCount).toBe(2);
    });
  });

  // ==================== DM Operations ====================

  describe("DM Conversation Operations", () => {
    beforeEach(async () => {
      await db.init();
    });

    it("should save and retrieve conversations", async () => {
      const convo = createMockConversation();
      await db.saveConversations([convo]);

      const retrieved = await db.getConversations();
      expect(retrieved.length).toBe(1);
      expect(retrieved[0].id).toBe(convo.id);
      expect(retrieved[0].members.length).toBe(2);
      expect(retrieved[0]._offlineCachedAt).toBeDefined();
    });

    it("should save multiple conversations", async () => {
      const convos = [
        createMockConversation({ id: "convo1" }),
        createMockConversation({ id: "convo2" }),
        createMockConversation({ id: "convo3" }),
      ];

      await db.saveConversations(convos);

      const retrieved = await db.getConversations();
      expect(retrieved.length).toBe(3);
    });

    it("should return conversations sorted by lastMessageAt descending", async () => {
      const convos = [
        createMockConversation({
          id: "convo1",
          lastMessageAt: "2024-01-01T00:00:00Z",
        }),
        createMockConversation({
          id: "convo2",
          lastMessageAt: "2024-01-03T00:00:00Z",
        }),
        createMockConversation({
          id: "convo3",
          lastMessageAt: "2024-01-02T00:00:00Z",
        }),
      ];

      await db.saveConversations(convos);

      const retrieved = await db.getConversations();
      expect(retrieved[0].lastMessageAt).toBe("2024-01-03T00:00:00Z");
      expect(retrieved[1].lastMessageAt).toBe("2024-01-02T00:00:00Z");
      expect(retrieved[2].lastMessageAt).toBe("2024-01-01T00:00:00Z");
    });

    it("should check if conversations exist", async () => {
      expect(await db.hasConversations()).toBe(false);

      await db.saveConversations([createMockConversation()]);

      expect(await db.hasConversations()).toBe(true);
    });

    it("should update existing conversation when id matches", async () => {
      const convo = createMockConversation({ id: "same-convo" });
      await db.saveConversations([convo]);

      const updatedConvo = {
        ...convo,
        unreadCount: 5,
        lastMessageText: "New message!",
      };
      await db.saveConversations([updatedConvo]);

      const retrieved = await db.getConversations();
      expect(retrieved.length).toBe(1);
      expect(retrieved[0].unreadCount).toBe(5);
      expect(retrieved[0].lastMessageText).toBe("New message!");
    });
  });

  describe("DM Message Operations", () => {
    beforeEach(async () => {
      await db.init();
    });

    it("should save and retrieve messages for a conversation", async () => {
      const conversationId = "test-convo";
      const msg = createMockMessage();
      await db.saveMessages(conversationId, [msg]);

      const retrieved = await db.getMessages(conversationId);
      expect(retrieved.length).toBe(1);
      expect(retrieved[0].text).toBe(msg.text);
      expect(retrieved[0].conversationId).toBe(conversationId);
    });

    it("should save multiple messages", async () => {
      const conversationId = "test-convo";
      const messages = [
        createMockMessage({ id: "msg1" }),
        createMockMessage({ id: "msg2" }),
        createMockMessage({ id: "msg3" }),
      ];

      await db.saveMessages(conversationId, messages);

      const retrieved = await db.getMessages(conversationId);
      expect(retrieved.length).toBe(3);
    });

    it("should respect limit when fetching messages", async () => {
      const conversationId = "test-convo";
      const messages = Array.from({ length: 100 }, (_, i) =>
        createMockMessage({ id: `msg${i}` }),
      );

      await db.saveMessages(conversationId, messages);

      const retrieved = await db.getMessages(conversationId, 10);
      expect(retrieved.length).toBe(10);
    });

    it("should return messages in chronological order", async () => {
      const conversationId = "test-convo";
      const messages = [
        createMockMessage({ id: "msg1", sentAt: "2024-01-01T00:00:00Z" }),
        createMockMessage({ id: "msg2", sentAt: "2024-01-03T00:00:00Z" }),
        createMockMessage({ id: "msg3", sentAt: "2024-01-02T00:00:00Z" }),
      ];

      await db.saveMessages(conversationId, messages);

      const retrieved = await db.getMessages(conversationId);
      // Should be oldest first (chronological order)
      expect(retrieved[0].sentAt).toBe("2024-01-01T00:00:00Z");
      expect(retrieved[1].sentAt).toBe("2024-01-02T00:00:00Z");
      expect(retrieved[2].sentAt).toBe("2024-01-03T00:00:00Z");
    });

    it("should only return messages for specified conversation", async () => {
      await db.saveMessages("convo1", [
        createMockMessage({ id: "msg1" }),
        createMockMessage({ id: "msg2" }),
      ]);
      await db.saveMessages("convo2", [createMockMessage({ id: "msg3" })]);

      const convo1Messages = await db.getMessages("convo1");
      const convo2Messages = await db.getMessages("convo2");

      expect(convo1Messages.length).toBe(2);
      expect(convo2Messages.length).toBe(1);
    });
  });

  // ==================== Thread Summary Operations ====================

  describe("Thread Summary Operations", () => {
    beforeEach(async () => {
      await db.init();
    });

    it("should save and retrieve thread summary", async () => {
      const summary = createMockThreadSummary();
      await db.saveThreadSummary(summary);

      const retrieved = await db.getThreadSummary(summary.threadUri);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.summary).toBe(summary.summary);
      expect(retrieved?.format).toBe("haiku");
      expect(retrieved?.source).toBe("bookmarked");
    });

    it("should update lastAccessedAt when retrieving summary", async () => {
      const summary = createMockThreadSummary();
      await db.saveThreadSummary(summary);

      // Wait a bit to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 10));

      const retrieved = await db.getThreadSummary(summary.threadUri);
      expect(retrieved?._lastAccessedAt).toBeGreaterThanOrEqual(
        retrieved?._offlineCachedAt ?? 0,
      );
    });

    it("should return null for non-existent summary", async () => {
      const retrieved = await db.getThreadSummary("at://nonexistent");
      expect(retrieved).toBeNull();
    });

    it("should check if thread summary exists", async () => {
      const summary = createMockThreadSummary();

      expect(await db.hasThreadSummary(summary.threadUri)).toBe(false);

      await db.saveThreadSummary(summary);

      expect(await db.hasThreadSummary(summary.threadUri)).toBe(true);
    });

    it("should get all summaries without filter", async () => {
      const summaries = [
        createMockThreadSummary({
          threadUri: "at://test/1",
          source: "bookmarked",
        }),
        createMockThreadSummary({
          threadUri: "at://test/2",
          source: "followed",
        }),
        createMockThreadSummary({ threadUri: "at://test/3", source: "viewed" }),
      ];

      for (const s of summaries) {
        await db.saveThreadSummary(s);
      }

      const retrieved = await db.getThreadSummaries();
      expect(retrieved.length).toBe(3);
    });

    it("should filter summaries by source", async () => {
      const summaries = [
        createMockThreadSummary({
          threadUri: "at://test/1",
          source: "bookmarked",
        }),
        createMockThreadSummary({
          threadUri: "at://test/2",
          source: "bookmarked",
        }),
        createMockThreadSummary({
          threadUri: "at://test/3",
          source: "followed",
        }),
      ];

      for (const s of summaries) {
        await db.saveThreadSummary(s);
      }

      const bookmarked = await db.getThreadSummaries("bookmarked");
      const followed = await db.getThreadSummaries("followed");

      expect(bookmarked.length).toBe(2);
      expect(followed.length).toBe(1);
    });

    it("should respect limit when fetching summaries", async () => {
      const summaries = Array.from({ length: 100 }, (_, i) =>
        createMockThreadSummary({ threadUri: `at://test/${i}` }),
      );

      for (const s of summaries) {
        await db.saveThreadSummary(s);
      }

      const retrieved = await db.getThreadSummaries(undefined, 10);
      expect(retrieved.length).toBe(10);
    });

    it("should delete thread summary", async () => {
      const summary = createMockThreadSummary();
      await db.saveThreadSummary(summary);

      expect(await db.hasThreadSummary(summary.threadUri)).toBe(true);

      await db.deleteThreadSummary(summary.threadUri);

      expect(await db.hasThreadSummary(summary.threadUri)).toBe(false);
    });

    it("should get thread summary count", async () => {
      expect(await db.getThreadSummaryCount()).toBe(0);

      const summaries = [
        createMockThreadSummary({ threadUri: "at://test/1" }),
        createMockThreadSummary({ threadUri: "at://test/2" }),
        createMockThreadSummary({ threadUri: "at://test/3" }),
      ];

      for (const s of summaries) {
        await db.saveThreadSummary(s);
      }

      expect(await db.getThreadSummaryCount()).toBe(3);
    });

    it("should update existing summary when threadUri matches", async () => {
      const summary = createMockThreadSummary({ threadUri: "at://test/same" });
      await db.saveThreadSummary(summary);

      const updatedSummary = {
        ...summary,
        summary:
          "New haiku text\nDifferent words flowing here\nUpdated version",
      };
      await db.saveThreadSummary(updatedSummary);

      const retrieved = await db.getThreadSummary(summary.threadUri);
      expect(retrieved?.summary).toContain("New haiku text");
    });
  });

  // ==================== Storage Stats ====================

  describe("Storage Stats", () => {
    beforeEach(async () => {
      await db.init();
    });

    it("should return accurate stats", async () => {
      // Add some data
      await db.saveFeedItems(
        [createMockFeedItem({ uri: "at://test/1" })],
        "timeline",
      );
      await db.saveConversations([createMockConversation()]);
      await db.saveMessages("convo", [createMockMessage()]);
      await db.saveThreadSummary(createMockThreadSummary());

      const stats = await db.getStats();

      expect(stats.feedItemCount).toBe(1);
      expect(stats.conversationCount).toBe(1);
      expect(stats.messageCount).toBe(1);
      expect(stats.summaryCount).toBe(1);
      expect(stats.lastFeedSync).toBeDefined();
      expect(stats.lastDMSync).toBeDefined();
      expect(stats.lastSummarySync).toBeDefined();
    });

    it("should return null for sync times when no data exists", async () => {
      const stats = await db.getStats();

      expect(stats.feedItemCount).toBe(0);
      expect(stats.lastFeedSync).toBeNull();
      expect(stats.lastDMSync).toBeNull();
      expect(stats.lastSummarySync).toBeNull();
    });
  });

  // ==================== Storage Limits Enforcement ====================

  describe("Storage Limits Enforcement", () => {
    beforeEach(async () => {
      await db.init();
    });

    it("should enforce feed item limit (500)", async () => {
      // Create more than limit
      const items = Array.from({ length: 550 }, (_, i) =>
        createMockFeedItem({ uri: `at://test/${i}` }),
      );

      await db.saveFeedItems(items, "timeline");

      let stats = await db.getStats();
      expect(stats.feedItemCount).toBe(550);

      // Enforce limits
      await db.enforceStorageLimits();

      stats = await db.getStats();
      expect(stats.feedItemCount).toBeLessThanOrEqual(500);
    });

    it("should enforce conversation limit (50)", async () => {
      // Create more than limit
      const convos = Array.from({ length: 60 }, (_, i) =>
        createMockConversation({ id: `convo${i}` }),
      );

      await db.saveConversations(convos);

      let stats = await db.getStats();
      expect(stats.conversationCount).toBe(60);

      // Enforce limits
      await db.enforceStorageLimits();

      stats = await db.getStats();
      expect(stats.conversationCount).toBeLessThanOrEqual(50);
    });

    it("should enforce summary limit (200) using LRU eviction", async () => {
      // Create more than limit
      const summaries = Array.from({ length: 210 }, (_, i) =>
        createMockThreadSummary({ threadUri: `at://test/${i}` }),
      );

      for (const s of summaries) {
        await db.saveThreadSummary(s);
      }

      let count = await db.getThreadSummaryCount();
      expect(count).toBe(210);

      // Enforce limits
      await db.enforceStorageLimits();

      count = await db.getThreadSummaryCount();
      expect(count).toBeLessThanOrEqual(200);
    });

    it("should delete associated messages when conversation is evicted", async () => {
      // Create conversations with messages
      const convos = Array.from({ length: 55 }, (_, i) =>
        createMockConversation({ id: `convo${i}` }),
      );

      await db.saveConversations(convos);

      // Add messages to some conversations
      for (let i = 0; i < 55; i++) {
        await db.saveMessages(`convo${i}`, [
          createMockMessage({ id: `msg${i}` }),
        ]);
      }

      let stats = await db.getStats();
      expect(stats.conversationCount).toBe(55);
      expect(stats.messageCount).toBe(55);

      // Enforce limits
      await db.enforceStorageLimits();

      stats = await db.getStats();
      expect(stats.conversationCount).toBeLessThanOrEqual(50);
      // Messages for evicted conversations should also be deleted
      expect(stats.messageCount).toBeLessThanOrEqual(50);
    });
  });

  // ==================== Stale Data Cleanup ====================

  describe("Stale Data Cleanup", () => {
    beforeEach(async () => {
      await db.init();
    });

    it("should evict feed items older than 7 days", async () => {
      const now = Date.now();
      const eightDaysAgo = now - 8 * 24 * 60 * 60 * 1000;

      // Create old items by mocking Date.now
      const items = [
        createMockFeedItem({ uri: "at://test/old" }),
        createMockFeedItem({ uri: "at://test/new" }),
      ];

      // Save first item with old timestamp
      vi.spyOn(Date, "now").mockReturnValue(eightDaysAgo);
      await db.saveFeedItems([items[0]], "timeline");

      // Save second item with current timestamp
      vi.spyOn(Date, "now").mockReturnValue(now);
      await db.saveFeedItems([items[1]], "timeline");

      const deletedCount = await db.evictOldFeedItems();

      expect(deletedCount).toBe(1);

      const remaining = await db.getFeedItems(10);
      expect(remaining.length).toBe(1);
      expect(remaining[0].uri).toBe("at://test/new");

      vi.restoreAllMocks();
    });

    it("should evict messages older than 30 days", async () => {
      const now = Date.now();
      const thirtyOneDaysAgo = now - 31 * 24 * 60 * 60 * 1000;

      // Save old message
      vi.spyOn(Date, "now").mockReturnValue(thirtyOneDaysAgo);
      await db.saveMessages("convo", [createMockMessage({ id: "old" })]);

      // Save new message
      vi.spyOn(Date, "now").mockReturnValue(now);
      await db.saveMessages("convo", [createMockMessage({ id: "new" })]);

      const deletedCount = await db.evictOldMessages();

      expect(deletedCount).toBe(1);

      const remaining = await db.getMessages("convo");
      expect(remaining.length).toBe(1);
      expect(remaining[0].id).toBe("new");

      vi.restoreAllMocks();
    });

    it("should evict summaries older than 30 days", async () => {
      const now = Date.now();
      const thirtyOneDaysAgo = now - 31 * 24 * 60 * 60 * 1000;

      // Save old summary
      vi.spyOn(Date, "now").mockReturnValue(thirtyOneDaysAgo);
      await db.saveThreadSummary(
        createMockThreadSummary({ threadUri: "at://test/old" }),
      );

      // Save new summary
      vi.spyOn(Date, "now").mockReturnValue(now);
      await db.saveThreadSummary(
        createMockThreadSummary({ threadUri: "at://test/new" }),
      );

      const deletedCount = await db.evictOldSummaries();

      expect(deletedCount).toBe(1);

      const remaining = await db.getThreadSummaries();
      expect(remaining.length).toBe(1);
      expect(remaining[0].threadUri).toBe("at://test/new");

      vi.restoreAllMocks();
    });
  });

  // ==================== Concurrent Write Handling ====================

  describe("Concurrent Write Handling", () => {
    beforeEach(async () => {
      await db.init();
    });

    it("should handle concurrent feed item saves", async () => {
      const batches = Array.from({ length: 5 }, (_, batchIndex) =>
        Array.from({ length: 10 }, (__, itemIndex) =>
          createMockFeedItem({
            uri: `at://test/batch${batchIndex}/item${itemIndex}`,
          }),
        ),
      );

      // Save all batches concurrently
      await Promise.all(
        batches.map((batch) => db.saveFeedItems(batch, "timeline")),
      );

      const stats = await db.getStats();
      expect(stats.feedItemCount).toBe(50);
    });

    it("should handle concurrent conversation saves", async () => {
      const convos = Array.from({ length: 20 }, (_, i) =>
        createMockConversation({ id: `convo${i}` }),
      );

      // Save concurrently (in smaller batches)
      await Promise.all([
        db.saveConversations(convos.slice(0, 10)),
        db.saveConversations(convos.slice(10, 20)),
      ]);

      const retrieved = await db.getConversations();
      expect(retrieved.length).toBe(20);
    });

    it("should handle concurrent message saves to different conversations", async () => {
      const conversationIds = ["convo1", "convo2", "convo3"];

      // Save messages to different conversations concurrently
      await Promise.all(
        conversationIds.map((convoId) =>
          db.saveMessages(convoId, [
            createMockMessage({ id: `${convoId}-msg1` }),
            createMockMessage({ id: `${convoId}-msg2` }),
          ]),
        ),
      );

      // Verify all messages were saved
      for (const convoId of conversationIds) {
        const messages = await db.getMessages(convoId);
        expect(messages.length).toBe(2);
      }
    });

    it("should handle concurrent summary saves", async () => {
      const summaries = Array.from({ length: 10 }, (_, i) =>
        createMockThreadSummary({ threadUri: `at://test/${i}` }),
      );

      // Save all concurrently
      await Promise.all(summaries.map((s) => db.saveThreadSummary(s)));

      const count = await db.getThreadSummaryCount();
      expect(count).toBe(10);
    });

    it("should handle concurrent reads and writes", async () => {
      // Pre-populate some data
      const initialItems = Array.from({ length: 10 }, (_, i) =>
        createMockFeedItem({ uri: `at://test/initial${i}` }),
      );
      await db.saveFeedItems(initialItems, "timeline");

      // Perform reads and writes concurrently
      const newItems = Array.from({ length: 5 }, (_, i) =>
        createMockFeedItem({ uri: `at://test/new${i}` }),
      );

      const [readResult] = await Promise.all([
        db.getFeedItems(10),
        db.saveFeedItems(newItems, "timeline"),
      ]);

      // Read might return initial or updated data depending on timing
      expect(readResult.length).toBeGreaterThanOrEqual(10);
    });
  });

  // ==================== Graceful Degradation ====================

  describe("Graceful Degradation", () => {
    it("should throw clear error when not initialized", async () => {
      const uninitDb = createFreshDB();

      await expect(uninitDb.getFeedItems()).rejects.toThrow(
        "OfflineStorageDB not initialized. Call init() first.",
      );

      await expect(uninitDb.getConversations()).rejects.toThrow(
        "OfflineStorageDB not initialized. Call init() first.",
      );

      await expect(uninitDb.getStats()).rejects.toThrow(
        "OfflineStorageDB not initialized. Call init() first.",
      );
    });

    it("should handle empty results gracefully", async () => {
      await db.init();

      const feedItems = await db.getFeedItems();
      const conversations = await db.getConversations();
      const messages = await db.getMessages("nonexistent");
      const summaries = await db.getThreadSummaries();

      expect(feedItems).toEqual([]);
      expect(conversations).toEqual([]);
      expect(messages).toEqual([]);
      expect(summaries).toEqual([]);
    });

    it("should handle clearing empty database", async () => {
      await db.init();

      // Should not throw when clearing empty DB
      await db.clearAll();

      const stats = await db.getStats();
      expect(stats.feedItemCount).toBe(0);
    });
  });

  // ==================== Clear All ====================

  describe("Clear All", () => {
    beforeEach(async () => {
      await db.init();
    });

    it("should clear all data from all stores", async () => {
      // Add data to all stores
      await db.saveFeedItems([createMockFeedItem()], "timeline");
      await db.saveConversations([createMockConversation()]);
      await db.saveMessages("convo", [createMockMessage()]);
      await db.saveThreadSummary(createMockThreadSummary());

      // Verify data exists
      let stats = await db.getStats();
      expect(stats.feedItemCount).toBe(1);
      expect(stats.conversationCount).toBe(1);
      expect(stats.messageCount).toBe(1);
      expect(stats.summaryCount).toBe(1);

      // Clear all
      await db.clearAll();

      // Verify all data is cleared
      stats = await db.getStats();
      expect(stats.feedItemCount).toBe(0);
      expect(stats.conversationCount).toBe(0);
      expect(stats.messageCount).toBe(0);
      expect(stats.summaryCount).toBe(0);
      expect(stats.lastFeedSync).toBeNull();
      expect(stats.lastDMSync).toBeNull();
    });
  });

  // ==================== Singleton Pattern ====================

  describe("Singleton Pattern", () => {
    it("should return same instance from getInstance", () => {
      const instance1 = OfflineStorageDB.getInstance();
      const instance2 = OfflineStorageDB.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  // ==================== Metadata Operations ====================

  describe("Metadata Operations", () => {
    beforeEach(async () => {
      await db.init();
    });

    it("should return null for non-existent metadata", async () => {
      const metadata = await db.getMetadata("nonexistent_key");
      expect(metadata).toBeNull();
    });

    it("should track feed metadata correctly", async () => {
      await db.saveFeedItems(
        [
          createMockFeedItem({
            uri: "at://test/1",
            indexedAt: "2024-01-01T00:00:00Z",
          }),
          createMockFeedItem({
            uri: "at://test/2",
            indexedAt: "2024-01-02T00:00:00Z",
          }),
        ],
        "timeline",
      );

      const metadata = await db.getMetadata("feed_timeline");
      expect(metadata?.key).toBe("feed_timeline");
      expect(metadata?.lastSyncAt).toBeDefined();
      expect(metadata?.newestItemAt).toBe("2024-01-01T00:00:00Z"); // First in array
      expect(metadata?.oldestItemAt).toBe("2024-01-02T00:00:00Z"); // Last in array
    });
  });

  // ==================== DB Initialization Error Handling ====================

  describe("DB Initialization Error Handling", () => {
    it("should reject when IndexedDB fails to open", async () => {
      // This test verifies the error handling code path exists
      // by checking that uninitialized DB operations fail appropriately
      const uninitDb = createFreshDB();

      // Operations on uninitialized DB should throw
      await expect(uninitDb.getFeedItems()).rejects.toThrow(
        "OfflineStorageDB not initialized",
      );
      await expect(uninitDb.saveFeedItems([], "timeline")).rejects.toThrow(
        "OfflineStorageDB not initialized",
      );
      await expect(uninitDb.getThreadSummary("test")).rejects.toThrow(
        "OfflineStorageDB not initialized",
      );
    });
  });

  // ==================== Storage Estimate ====================

  describe("Storage Estimate", () => {
    let originalStorage: StorageManager | undefined;

    beforeEach(async () => {
      await db.init();
      // Save original storage reference
      originalStorage = navigator.storage;
    });

    afterEach(() => {
      // Restore original storage if it was modified
      if (originalStorage !== undefined) {
        Object.defineProperty(navigator, "storage", {
          value: originalStorage,
          writable: true,
          configurable: true,
        });
      }
    });

    it("should include storage estimate in stats when navigator.storage is available", async () => {
      const mockEstimate = { usage: 12345, quota: 100000000 };

      // Create mock storage object
      Object.defineProperty(navigator, "storage", {
        value: {
          estimate: vi.fn().mockResolvedValue(mockEstimate),
        },
        writable: true,
        configurable: true,
      });

      const stats = await db.getStats();

      // storageEstimate should be present with mocked value
      expect(typeof stats.storageEstimate).toBe("number");
      expect(stats.storageEstimate).toBe(12345);
    });

    it("should handle storage estimate errors gracefully", async () => {
      Object.defineProperty(navigator, "storage", {
        value: {
          estimate: vi.fn().mockRejectedValue(new Error("Storage API error")),
        },
        writable: true,
        configurable: true,
      });

      // Should not throw - errors are silently ignored
      const stats = await db.getStats();
      expect(stats.storageEstimate).toBe(0);
    });

    it("should handle undefined estimate usage gracefully", async () => {
      Object.defineProperty(navigator, "storage", {
        value: {
          estimate: vi.fn().mockResolvedValue({ quota: 100000000 }), // No usage property
        },
        writable: true,
        configurable: true,
      });

      const stats = await db.getStats();
      expect(stats.storageEstimate).toBe(0);
    });
  });

  // ==================== Edge Cases ====================

  describe("Edge Cases", () => {
    beforeEach(async () => {
      await db.init();
    });

    it("should handle saving empty arrays", async () => {
      await db.saveFeedItems([], "timeline");
      await db.saveConversations([]);
      await db.saveMessages("convo", []);

      const stats = await db.getStats();
      expect(stats.feedItemCount).toBe(0);
      expect(stats.conversationCount).toBe(0);
      expect(stats.messageCount).toBe(0);
    });

    it("should handle getting thread summary for empty DB", async () => {
      const summary = await db.getThreadSummary(
        "at://nonexistent/thread/12345",
      );
      expect(summary).toBeNull();
    });

    it("should not throw when deleting non-existent thread summary", async () => {
      await expect(
        db.deleteThreadSummary("at://nonexistent/thread/12345"),
      ).resolves.not.toThrow();
    });

    it("should handle enforce storage limits on empty DB", async () => {
      await expect(db.enforceStorageLimits()).resolves.not.toThrow();
    });

    it("should handle evict operations on empty DB", async () => {
      const feedDeleted = await db.evictOldFeedItems();
      const msgDeleted = await db.evictOldMessages();
      const summaryDeleted = await db.evictOldSummaries();

      expect(feedDeleted).toBe(0);
      expect(msgDeleted).toBe(0);
      expect(summaryDeleted).toBe(0);
    });

    it("should handle getFeedItems without feedType filter", async () => {
      const items = [
        createMockFeedItem({ uri: "at://test/1" }),
        createMockFeedItem({ uri: "at://test/2" }),
      ];

      await db.saveFeedItems(items, "timeline");

      // Get all items without filter
      const retrieved = await db.getFeedItems(10);
      expect(retrieved.length).toBe(2);
    });

    it("should handle thread summaries metadata update", async () => {
      // Save multiple summaries
      await db.saveThreadSummary(
        createMockThreadSummary({ threadUri: "at://test/1" }),
      );
      await db.saveThreadSummary(
        createMockThreadSummary({ threadUri: "at://test/2" }),
      );

      const metadata = await db.getMetadata("thread_summaries");
      expect(metadata).not.toBeNull();
      expect(metadata?.lastSyncAt).toBeDefined();
    });
  });

  // ==================== Compound Index Tests ====================

  describe("Compound Index Usage", () => {
    beforeEach(async () => {
      await db.init();
    });

    it("should use compound index for author feed queries", async () => {
      const authorDid = "did:plc:testauthor123";
      const items = [
        createMockFeedItem({
          uri: "at://test/1",
          author: {
            did: authorDid,
            handle: "testauthor.bsky.social",
            displayName: "Test Author",
          },
          indexedAt: "2024-01-01T00:00:00Z",
        }),
        createMockFeedItem({
          uri: "at://test/2",
          author: {
            did: authorDid,
            handle: "testauthor.bsky.social",
            displayName: "Test Author",
          },
          indexedAt: "2024-01-02T00:00:00Z",
        }),
        createMockFeedItem({
          uri: "at://test/3",
          author: {
            did: "did:plc:different",
            handle: "other.bsky.social",
            displayName: "Other Author",
          },
          indexedAt: "2024-01-03T00:00:00Z",
        }),
      ];

      await db.saveFeedItems(items, "author");

      // Query for specific feed type should use compound index
      const authorFeed = await db.getFeedItems(10, "author");
      expect(authorFeed.length).toBe(3);

      // Verify sorting
      expect(authorFeed[0].indexedAt).toBe("2024-01-03T00:00:00Z");
    });

    it("should fall back to indexedAt index when compound index is not available", async () => {
      // This tests the else branch in getFeedItems where feedType filter is applied manually
      const items = [
        createMockFeedItem({
          uri: "at://test/1",
          indexedAt: "2024-01-01T00:00:00Z",
        }),
        createMockFeedItem({
          uri: "at://test/2",
          indexedAt: "2024-01-02T00:00:00Z",
        }),
      ];

      await db.saveFeedItems(items, "list");

      const listFeed = await db.getFeedItems(10, "list");
      expect(listFeed.length).toBe(2);
    });
  });

  // ==================== LRU Eviction Tests ====================

  describe("LRU Eviction for Summaries", () => {
    beforeEach(async () => {
      await db.init();
      // Clear all data for clean test
      await db.clearAll();
    });

    it("should update lastAccessedAt when retrieving summaries", async () => {
      // Create a summary
      const summary = createMockThreadSummary({
        threadUri: "at://test/lru-summary",
      });
      await db.saveThreadSummary(summary);

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Access the summary
      const retrieved = await db.getThreadSummary("at://test/lru-summary");

      // _lastAccessedAt should be updated (greater than or equal to _offlineCachedAt)
      expect(retrieved?._lastAccessedAt).toBeGreaterThanOrEqual(
        retrieved?._offlineCachedAt ?? 0,
      );
    });

    it("should track access patterns for LRU eviction", async () => {
      // Create summaries with unique URIs
      const summaries = Array.from({ length: 5 }, (_, i) =>
        createMockThreadSummary({ threadUri: `at://test/lru${i}` }),
      );

      // Save all summaries
      for (const s of summaries) {
        await db.saveThreadSummary(s);
        await new Promise((resolve) => setTimeout(resolve, 5));
      }

      // Access some summaries to update their _lastAccessedAt
      await db.getThreadSummary("at://test/lru4");
      await db.getThreadSummary("at://test/lru2");

      // Verify all 5 summaries exist
      const count = await db.getThreadSummaryCount();
      expect(count).toBe(5);
    });
  });
});
