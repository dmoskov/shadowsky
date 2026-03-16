/**
 * Tests for PostStorageDB
 *
 * Covers:
 * 1. DB initialization
 * 2. Batch post retrieval (getPosts) - verifying IDB transaction stays alive
 * 3. Single post retrieval (getPost)
 * 4. Post saving and round-trip
 * 5. Edge cases (empty arrays, missing URIs)
 */

import { AppBskyFeedDefs } from "@atproto/api";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PostStorageDB } from "./post-storage-db";

type Post = AppBskyFeedDefs.PostView;

const DB_NAME = "BskyPostCache";

// Helper to close the database connection
function closeDB(instance: PostStorageDB): void {
  // @ts-expect-error - accessing private for testing
  const db = instance.db as IDBDatabase | null;
  if (db) {
    db.close();
    // @ts-expect-error - accessing private for testing
    instance.db = null;
  }
}

// Helper to delete IndexedDB and wait for it
async function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}

// Helper to create a fresh PostStorageDB instance for each test
function createFreshDB(): PostStorageDB {
  // @ts-expect-error - accessing private static for testing
  PostStorageDB.instance = undefined;
  return PostStorageDB.getInstance();
}

// Helper to create a mock post
function createMockPost(overrides: Partial<Post> = {}): Post {
  const uri =
    overrides.uri ??
    `at://did:plc:test/app.bsky.feed.post/${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return {
    uri,
    cid: `cid-${uri}`,
    indexedAt: new Date().toISOString(),
    author: {
      did: "did:plc:testauthor",
      handle: "testauthor.bsky.social",
      displayName: "Test Author",
      avatar: "https://example.com/avatar.jpg",
      labels: [],
    },
    record: {
      $type: "app.bsky.feed.post",
      text: "This is a test post",
      createdAt: new Date().toISOString(),
    },
    replyCount: 0,
    repostCount: 0,
    likeCount: 0,
    quoteCount: 0,
    labels: [],
    ...overrides,
  } as Post;
}

describe("PostStorageDB", () => {
  let db: PostStorageDB;

  beforeEach(async () => {
    db = createFreshDB();
    await db.init();
  });

  afterEach(async () => {
    closeDB(db);
    await deleteDatabase(DB_NAME);
    // @ts-expect-error - accessing private static for testing
    PostStorageDB.instance = undefined;
  });

  // ==================== DB Initialization ====================

  describe("DB Initialization", () => {
    it("should initialize the database successfully", async () => {
      // Already initialized in beforeEach; re-init should be a no-op
      await db.init();
      expect(true).toBe(true);
    });

    it("should return same instance from getInstance (singleton)", () => {
      const instance1 = PostStorageDB.getInstance();
      const instance2 = PostStorageDB.getInstance();
      expect(instance1).toBe(instance2);
    });

    it("should throw error when operations are attempted before init", async () => {
      const uninitDb = createFreshDB();
      expect(() => {
        // @ts-expect-error - testing private method
        uninitDb.ensureDb();
      }).toThrow("PostStorageDB not initialized");
    });
  });

  // ==================== Save & Single Get ====================

  describe("savePosts and getPost", () => {
    it("should save and retrieve a single post", async () => {
      const post = createMockPost({ uri: "at://did:plc:test/post/1" });
      await db.savePosts([post]);

      const retrieved = await db.getPost("at://did:plc:test/post/1");
      expect(retrieved).not.toBeNull();
      expect(retrieved!.uri).toBe(post.uri);
      expect(retrieved!.author.handle).toBe("testauthor.bsky.social");
    });

    it("should return null for non-existent post", async () => {
      const retrieved = await db.getPost("at://nonexistent");
      expect(retrieved).toBeNull();
    });

    it("should strip _cachedAt from returned posts", async () => {
      const post = createMockPost({ uri: "at://did:plc:test/post/cached" });
      await db.savePosts([post]);

      const retrieved = await db.getPost("at://did:plc:test/post/cached");
      expect(retrieved).not.toBeNull();
      expect((retrieved as any)._cachedAt).toBeUndefined();
    });

    it("should update existing post when uri matches", async () => {
      const post = createMockPost({
        uri: "at://did:plc:test/post/update",
        likeCount: 0,
      });
      await db.savePosts([post]);

      const updatedPost = createMockPost({
        uri: "at://did:plc:test/post/update",
        likeCount: 42,
      });
      await db.savePosts([updatedPost]);

      const retrieved = await db.getPost("at://did:plc:test/post/update");
      expect(retrieved!.likeCount).toBe(42);
    });
  });

  // ==================== Batch Retrieval (getPosts) ====================

  describe("getPosts - batch retrieval", () => {
    it("should retrieve multiple posts by URIs in a single transaction", async () => {
      const posts = Array.from({ length: 10 }, (_, i) =>
        createMockPost({ uri: `at://did:plc:test/post/${i}` }),
      );
      await db.savePosts(posts);

      const uris = posts.map((p) => p.uri);
      const retrieved = await db.getPosts(uris);

      expect(retrieved).toHaveLength(10);
      const retrievedUris = retrieved.map((p) => p.uri).sort();
      expect(retrievedUris).toEqual(uris.sort());
    });

    it("should not throw TransactionInactiveError with many URIs", async () => {
      // This is the key regression test. The old code awaited inside a loop,
      // which could cause the IDB transaction to auto-commit between iterations.
      const posts = Array.from({ length: 50 }, (_, i) =>
        createMockPost({ uri: `at://did:plc:test/post/batch-${i}` }),
      );
      await db.savePosts(posts);

      const uris = posts.map((p) => p.uri);

      // This should complete without TransactionInactiveError
      const retrieved = await db.getPosts(uris);
      expect(retrieved).toHaveLength(50);
    });

    it("should skip URIs that do not exist in the database", async () => {
      const posts = [
        createMockPost({ uri: "at://did:plc:test/post/exists-1" }),
        createMockPost({ uri: "at://did:plc:test/post/exists-2" }),
      ];
      await db.savePosts(posts);

      const uris = [
        "at://did:plc:test/post/exists-1",
        "at://did:plc:test/post/missing-1",
        "at://did:plc:test/post/exists-2",
        "at://did:plc:test/post/missing-2",
      ];
      const retrieved = await db.getPosts(uris);

      expect(retrieved).toHaveLength(2);
      const retrievedUris = retrieved.map((p) => p.uri).sort();
      expect(retrievedUris).toEqual([
        "at://did:plc:test/post/exists-1",
        "at://did:plc:test/post/exists-2",
      ]);
    });

    it("should return empty array for empty URI list", async () => {
      const retrieved = await db.getPosts([]);
      expect(retrieved).toEqual([]);
    });

    it("should return empty array when no URIs match", async () => {
      const retrieved = await db.getPosts([
        "at://nonexistent/1",
        "at://nonexistent/2",
      ]);
      expect(retrieved).toEqual([]);
    });

    it("should return single post when given a single URI", async () => {
      const post = createMockPost({ uri: "at://did:plc:test/post/single" });
      await db.savePosts([post]);

      const retrieved = await db.getPosts(["at://did:plc:test/post/single"]);
      expect(retrieved).toHaveLength(1);
      expect(retrieved[0].uri).toBe("at://did:plc:test/post/single");
    });

    it("should strip _cachedAt from all returned posts", async () => {
      const posts = Array.from({ length: 5 }, (_, i) =>
        createMockPost({ uri: `at://did:plc:test/post/strip-${i}` }),
      );
      await db.savePosts(posts);

      const uris = posts.map((p) => p.uri);
      const retrieved = await db.getPosts(uris);

      for (const post of retrieved) {
        expect((post as any)._cachedAt).toBeUndefined();
      }
    });

    it("should handle duplicate URIs in the input", async () => {
      const post = createMockPost({ uri: "at://did:plc:test/post/dup" });
      await db.savePosts([post]);

      const retrieved = await db.getPosts([
        "at://did:plc:test/post/dup",
        "at://did:plc:test/post/dup",
      ]);
      // Each get request returns a result, so duplicates produce duplicate results
      expect(retrieved).toHaveLength(2);
      expect(retrieved[0].uri).toBe("at://did:plc:test/post/dup");
      expect(retrieved[1].uri).toBe("at://did:plc:test/post/dup");
    });
  });

  // ==================== getAllPosts ====================

  describe("getAllPosts", () => {
    it("should return posts sorted by indexedAt descending", async () => {
      const posts = [
        createMockPost({
          uri: "at://test/1",
          indexedAt: "2024-01-01T00:00:00Z",
        }),
        createMockPost({
          uri: "at://test/2",
          indexedAt: "2024-01-03T00:00:00Z",
        }),
        createMockPost({
          uri: "at://test/3",
          indexedAt: "2024-01-02T00:00:00Z",
        }),
      ];
      await db.savePosts(posts);

      const retrieved = await db.getAllPosts();
      expect(retrieved[0].indexedAt).toBe("2024-01-03T00:00:00Z");
      expect(retrieved[1].indexedAt).toBe("2024-01-02T00:00:00Z");
      expect(retrieved[2].indexedAt).toBe("2024-01-01T00:00:00Z");
    });

    it("should respect limit and offset", async () => {
      const posts = Array.from({ length: 20 }, (_, i) =>
        createMockPost({
          uri: `at://test/${i}`,
          indexedAt: new Date(2024, 0, i + 1).toISOString(),
        }),
      );
      await db.savePosts(posts);

      const page = await db.getAllPosts(5, 5);
      expect(page).toHaveLength(5);
    });
  });

  // ==================== getCount ====================

  describe("getCount", () => {
    it("should return 0 for empty database", async () => {
      const count = await db.getCount();
      expect(count).toBe(0);
    });

    it("should return correct count after saving posts", async () => {
      const posts = Array.from({ length: 7 }, (_, i) =>
        createMockPost({ uri: `at://test/${i}` }),
      );
      await db.savePosts(posts);

      const count = await db.getCount();
      expect(count).toBe(7);
    });
  });

  // ==================== clearAll ====================

  describe("clearAll", () => {
    it("should remove all posts and metadata", async () => {
      await db.savePosts([createMockPost({ uri: "at://test/clear" })]);
      expect(await db.getCount()).toBe(1);

      await db.clearAll();
      expect(await db.getCount()).toBe(0);
    });
  });
});
