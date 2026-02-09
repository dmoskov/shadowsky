/**
 * Tests for BookmarkServiceV2
 *
 * Coverage targets:
 * 1. Service initialization
 * 2. Adding and removing bookmarks
 * 3. Toggle bookmark functionality
 * 4. Fetching bookmarked posts with pagination
 * 5. Searching bookmarks
 * 6. Import/export functionality
 * 7. Collection management
 * 8. Post caching integration
 */

import { AppBskyFeedDefs, BskyAgent } from "@atproto/api";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type { Bookmark } from "./bookmark-backends/types";
import { bookmarkServiceV2 } from "./bookmark-service-v2";

// Mock dependencies
vi.mock("../utils/logger", () => ({
  createLogger: () => ({
    log: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock the backend
vi.mock("./bookmark-backend", () => ({
  OfficialBookmarksBackend: vi.fn().mockImplementation(() => ({
    init: vi.fn().mockResolvedValue(undefined),
    setAgent: vi.fn(),
    addBookmark: vi.fn().mockResolvedValue(undefined),
    removeBookmark: vi.fn().mockResolvedValue(undefined),
    isBookmarked: vi.fn().mockResolvedValue(false),
    getAllBookmarks: vi.fn().mockResolvedValue([]),
    getCount: vi.fn().mockResolvedValue(0),
    exportBookmarks: vi.fn().mockResolvedValue([]),
    importBookmarks: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
    refreshCache: vi.fn().mockResolvedValue(undefined),
  })),
}));

// Mock PostCacheService singleton
vi.mock("./post-cache-service", () => {
  const mockInstance = {
    init: vi.fn().mockResolvedValue(undefined),
    cachePosts: vi.fn().mockResolvedValue(undefined),
    getPost: vi.fn().mockResolvedValue(null),
  };
  return {
    PostCacheService: {
      getInstance: vi.fn(() => mockInstance),
    },
  };
});

// Mock bookmark collection storage
vi.mock("./bookmark-collections", () => ({
  bookmarkCollectionStorage: {
    init: vi.fn().mockResolvedValue(undefined),
    removeBookmarkFromAllCollections: vi.fn().mockResolvedValue(undefined),
    createCollection: vi.fn().mockImplementation((collection) => ({
      ...collection,
      id: "col-123",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      bookmarkCount: 0,
    })),
    getAllCollections: vi.fn().mockResolvedValue([]),
    getCollection: vi.fn().mockResolvedValue(null),
    updateCollection: vi.fn().mockResolvedValue(null),
    deleteCollection: vi.fn().mockResolvedValue(undefined),
    addBookmarkToCollection: vi.fn().mockResolvedValue(undefined),
    removeBookmarkFromCollection: vi.fn().mockResolvedValue(undefined),
    getBookmarkCollections: vi.fn().mockResolvedValue([]),
    getCollectionBookmarks: vi.fn().mockResolvedValue([]),
    getUncategorizedBookmarks: vi.fn().mockResolvedValue([]),
    exportData: vi.fn().mockResolvedValue({ collections: [], mappings: [] }),
    importData: vi.fn().mockResolvedValue(undefined),
    clearAll: vi.fn().mockResolvedValue(undefined),
  },
}));

// Import mocked modules
import { bookmarkCollectionStorage } from "./bookmark-collections";
import { PostCacheService } from "./post-cache-service";

/**
 * Helper to create a mock PostView
 */
function createMockPost(
  uri: string,
  author: string = "test.bsky.social",
): AppBskyFeedDefs.PostView {
  return {
    uri,
    cid: `cid-${uri}`,
    author: {
      did: `did:plc:${author}`,
      handle: author,
      displayName: `Test User ${author}`,
    },
    record: {
      text: `Test post content for ${uri}`,
      createdAt: new Date().toISOString(),
    },
    indexedAt: new Date().toISOString(),
  } as AppBskyFeedDefs.PostView;
}

/**
 * Helper to create a mock Bookmark
 */
function createMockBookmark(uri: string): Bookmark {
  return {
    id: `bookmark-${uri}`,
    postUri: uri,
    postCid: `cid-${uri}`,
    text: `Test post content for ${uri}`,
    author: {
      did: `did:plc:test`,
      handle: "test.bsky.social",
      displayName: "Test User",
    },
    savedAt: new Date().toISOString(),
  };
}

describe("BookmarkServiceV2", () => {
  let mockAgent: BskyAgent;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create mock agent
    mockAgent = {
      getPostThread: vi.fn(),
    } as unknown as BskyAgent;

    // Reset service state
    bookmarkServiceV2.agent = null;
  });

  describe("Initialization", () => {
    it("should initialize without an agent", async () => {
      const postCacheInstance = PostCacheService.getInstance();

      await bookmarkServiceV2.init();

      expect(postCacheInstance.init).toHaveBeenCalled();
      expect(bookmarkCollectionStorage.init).toHaveBeenCalled();
    });

    it("should initialize with an agent", async () => {
      const postCacheInstance = PostCacheService.getInstance();

      await bookmarkServiceV2.init(mockAgent);

      expect(bookmarkServiceV2.agent).toBe(mockAgent);
      expect(postCacheInstance.init).toHaveBeenCalled();
      expect(bookmarkCollectionStorage.init).toHaveBeenCalled();
    });

    it("should set agent after initialization", async () => {
      bookmarkServiceV2.setAgent(mockAgent);

      expect(bookmarkServiceV2.agent).toBe(mockAgent);
    });
  });

  describe("Bookmark Operations", () => {
    beforeEach(async () => {
      await bookmarkServiceV2.init(mockAgent);
    });

    it("should add a bookmark", async () => {
      const post = createMockPost("at://test/post1");
      const postCacheInstance = PostCacheService.getInstance();

      await bookmarkServiceV2.addBookmark(post);

      expect(postCacheInstance.cachePosts).toHaveBeenCalledWith([post]);
    });

    it("should add a bookmark with notes", async () => {
      const post = createMockPost("at://test/post1");
      const notes = "Important post";
      const postCacheInstance = PostCacheService.getInstance();

      await bookmarkServiceV2.addBookmark(post, notes);

      expect(postCacheInstance.cachePosts).toHaveBeenCalledWith([post]);
    });

    it("should remove a bookmark", async () => {
      const uri = "at://test/post1";

      await bookmarkServiceV2.removeBookmark(uri);

      expect(
        bookmarkCollectionStorage.removeBookmarkFromAllCollections,
      ).toHaveBeenCalledWith(uri);
    });

    it("should toggle bookmark on (add)", async () => {
      const post = createMockPost("at://test/post1");
      const postCacheInstance = PostCacheService.getInstance();

      const result = await bookmarkServiceV2.toggleBookmark(post);

      expect(result).toBe(true);
      expect(postCacheInstance.cachePosts).toHaveBeenCalledWith([post]);
    });

    it("should toggle bookmark off (remove)", async () => {
      const post = createMockPost("at://test/post1");
      // Mock the backend to return true for isBookmarked
      // @ts-expect-error - accessing private property for testing
      const backend = bookmarkServiceV2.backend;
      backend.isBookmarked = vi.fn().mockResolvedValue(true);

      const result = await bookmarkServiceV2.toggleBookmark(post);

      expect(result).toBe(false);
    });

    it("should check if a post is bookmarked", async () => {
      const uri = "at://test/post1";
      // Reset the mock to return false
      // @ts-expect-error - accessing private property for testing
      const backend = bookmarkServiceV2.backend;
      backend.isBookmarked = vi.fn().mockResolvedValue(false);

      const result = await bookmarkServiceV2.isPostBookmarked(uri);

      expect(result).toBe(false);
    });

    it("should get bookmark count", async () => {
      const count = await bookmarkServiceV2.getBookmarkCount();

      // Default mock returns 0
      expect(count).toBe(0);
    });
  });

  describe("Fetching Bookmarks", () => {
    beforeEach(async () => {
      await bookmarkServiceV2.init(mockAgent);
    });

    it("should fetch all bookmarked posts", async () => {
      const bookmarks = [
        createMockBookmark("at://test/post1"),
        createMockBookmark("at://test/post2"),
      ];
      // @ts-expect-error - accessing private property for testing
      const backend = bookmarkServiceV2.backend;
      backend.getAllBookmarks = vi.fn().mockResolvedValue(bookmarks);

      const posts = [
        createMockPost("at://test/post1"),
        createMockPost("at://test/post2"),
      ];
      const postCacheInstance = PostCacheService.getInstance();
      (postCacheInstance.getPost as Mock)
        .mockResolvedValueOnce(posts[0])
        .mockResolvedValueOnce(posts[1]);

      const result = await bookmarkServiceV2.getBookmarkedPosts();

      expect(result).toHaveLength(2);
      expect(result[0].post).toBe(posts[0]);
      expect(result[1].post).toBe(posts[1]);
    });

    it("should fetch bookmarked posts with pagination", async () => {
      const bookmarks = [
        createMockBookmark("at://test/post1"),
        createMockBookmark("at://test/post2"),
        createMockBookmark("at://test/post3"),
        createMockBookmark("at://test/post4"),
      ];
      // @ts-expect-error - accessing private property for testing
      const backend = bookmarkServiceV2.backend;
      backend.getAllBookmarks = vi.fn().mockResolvedValue(bookmarks);

      const result = await bookmarkServiceV2.getBookmarkedPosts(2, 1);

      expect(result).toHaveLength(2);
      expect(result[0].postUri).toBe("at://test/post2");
      expect(result[1].postUri).toBe("at://test/post3");
    });

    it("should fetch post from API if not in cache", async () => {
      const bookmark = createMockBookmark("at://test/post1");
      // @ts-expect-error - accessing private property for testing
      const backend = bookmarkServiceV2.backend;
      backend.getAllBookmarks = vi.fn().mockResolvedValue([bookmark]);

      const postCacheInstance = PostCacheService.getInstance();
      (postCacheInstance.getPost as Mock).mockResolvedValue(null);

      const post = createMockPost("at://test/post1");
      (mockAgent.getPostThread as Mock).mockResolvedValue({
        data: {
          thread: { post },
        },
      });

      const result = await bookmarkServiceV2.getBookmarkedPosts();

      expect(result).toHaveLength(1);
      expect(result[0].post).toBe(post);
      expect(mockAgent.getPostThread).toHaveBeenCalledWith({
        uri: "at://test/post1",
      });
      expect(postCacheInstance.cachePosts).toHaveBeenCalledWith([post]);
    });

    it("should handle missing posts gracefully", async () => {
      const bookmark = createMockBookmark("at://test/post1");
      // @ts-expect-error - accessing private property for testing
      const backend = bookmarkServiceV2.backend;
      backend.getAllBookmarks = vi.fn().mockResolvedValue([bookmark]);

      const postCacheInstance = PostCacheService.getInstance();
      (postCacheInstance.getPost as Mock).mockResolvedValue(null);
      (mockAgent.getPostThread as Mock).mockRejectedValue(
        new Error("Post not found"),
      );

      const result = await bookmarkServiceV2.getBookmarkedPosts();

      expect(result).toHaveLength(1);
      expect(result[0].post).toBeUndefined();
    });
  });

  describe("Search Bookmarks", () => {
    beforeEach(async () => {
      await bookmarkServiceV2.init(mockAgent);
    });

    it("should search bookmarks by text content", async () => {
      const bookmarks = [
        {
          ...createMockBookmark("at://test/post1"),
          text: "This is about JavaScript",
        },
        {
          ...createMockBookmark("at://test/post2"),
          text: "This is about Python",
        },
      ];
      // @ts-expect-error - accessing private property for testing
      const backend = bookmarkServiceV2.backend;
      backend.getAllBookmarks = vi.fn().mockResolvedValue(bookmarks);

      const result = await bookmarkServiceV2.searchBookmarks("javascript");

      expect(result).toHaveLength(1);
      expect(result[0].text).toContain("JavaScript");
    });

    it("should search bookmarks by author handle", async () => {
      const bookmarks = [
        {
          ...createMockBookmark("at://test/post1"),
          author: {
            did: "did:plc:1",
            handle: "alice.bsky.social",
            displayName: "Alice",
          },
        },
        {
          ...createMockBookmark("at://test/post2"),
          author: {
            did: "did:plc:2",
            handle: "bob.bsky.social",
            displayName: "Bob",
          },
        },
      ];
      // @ts-expect-error - accessing private property for testing
      const backend = bookmarkServiceV2.backend;
      backend.getAllBookmarks = vi.fn().mockResolvedValue(bookmarks);

      const result = await bookmarkServiceV2.searchBookmarks("alice");

      expect(result).toHaveLength(1);
      expect(result[0].author.handle).toBe("alice.bsky.social");
    });

    it("should search bookmarks by notes", async () => {
      const bookmarks = [
        {
          ...createMockBookmark("at://test/post1"),
          notes: "Important for project",
        },
        { ...createMockBookmark("at://test/post2"), notes: "Read later" },
      ];
      // @ts-expect-error - accessing private property for testing
      const backend = bookmarkServiceV2.backend;
      backend.getAllBookmarks = vi.fn().mockResolvedValue(bookmarks);

      const result = await bookmarkServiceV2.searchBookmarks("project");

      expect(result).toHaveLength(1);
      expect(result[0].notes).toContain("project");
    });

    it("should perform case-insensitive search", async () => {
      const bookmarks = [
        {
          ...createMockBookmark("at://test/post1"),
          text: "TypeScript Tutorial",
        },
      ];
      // @ts-expect-error - accessing private property for testing
      const backend = bookmarkServiceV2.backend;
      backend.getAllBookmarks = vi.fn().mockResolvedValue(bookmarks);

      const result = await bookmarkServiceV2.searchBookmarks("TYPESCRIPT");

      expect(result).toHaveLength(1);
    });
  });

  describe("Import/Export", () => {
    beforeEach(async () => {
      await bookmarkServiceV2.init(mockAgent);
    });

    it("should export bookmarks", async () => {
      const bookmarks = [
        createMockBookmark("at://test/post1"),
        createMockBookmark("at://test/post2"),
      ];
      // @ts-expect-error - accessing private property for testing
      const backend = bookmarkServiceV2.backend;
      backend.exportBookmarks = vi.fn().mockResolvedValue(bookmarks);

      const result = await bookmarkServiceV2.exportBookmarks();

      expect(result).toBe(bookmarks);
    });

    it("should import bookmarks", async () => {
      const bookmarks = [
        createMockBookmark("at://test/post1"),
        createMockBookmark("at://test/post2"),
      ];

      await bookmarkServiceV2.importBookmarks(bookmarks);

      // Function completes without error
      expect(true).toBe(true);
    });

    it("should clear all bookmarks", async () => {
      await bookmarkServiceV2.clearAllBookmarks();

      // Function completes without error
      expect(true).toBe(true);
    });

    it("should refresh cache", async () => {
      await bookmarkServiceV2.refreshCache();

      // Function completes without error
      expect(true).toBe(true);
    });
  });

  describe("Collection Management", () => {
    beforeEach(async () => {
      await bookmarkServiceV2.init(mockAgent);
    });

    it("should create a collection", async () => {
      const collection = {
        name: "Tech Articles",
        description: "Technical articles to read",
        color: "#FF5733",
        icon: "📚",
      };

      const result = await bookmarkServiceV2.createCollection(collection);

      expect(result.name).toBe("Tech Articles");
      expect(result.id).toBe("col-123");
      expect(bookmarkCollectionStorage.createCollection).toHaveBeenCalledWith(
        collection,
      );
    });

    it("should get all collections", async () => {
      const collections = [
        {
          id: "col-1",
          name: "Collection 1",
          description: "",
          color: "#000",
          icon: "📁",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          bookmarkCount: 5,
        },
      ];
      (bookmarkCollectionStorage.getAllCollections as Mock).mockResolvedValue(
        collections,
      );

      const result = await bookmarkServiceV2.getAllCollections();

      expect(result).toBe(collections);
    });

    it("should add bookmark to collection", async () => {
      const postUri = "at://test/post1";
      const collectionId = "col-123";

      await bookmarkServiceV2.addBookmarkToCollection(postUri, collectionId);

      expect(
        bookmarkCollectionStorage.addBookmarkToCollection,
      ).toHaveBeenCalledWith(postUri, collectionId);
    });

    it("should remove bookmark from collection", async () => {
      const postUri = "at://test/post1";
      const collectionId = "col-123";

      await bookmarkServiceV2.removeBookmarkFromCollection(
        postUri,
        collectionId,
      );

      expect(
        bookmarkCollectionStorage.removeBookmarkFromCollection,
      ).toHaveBeenCalledWith(postUri, collectionId);
    });

    it("should get bookmarks in a collection", async () => {
      const collectionId = "col-123";
      const bookmarkUris = ["at://test/post1", "at://test/post2"];
      const allBookmarks = [
        createMockBookmark("at://test/post1"),
        createMockBookmark("at://test/post2"),
        createMockBookmark("at://test/post3"),
      ];

      (
        bookmarkCollectionStorage.getCollectionBookmarks as Mock
      ).mockResolvedValue(bookmarkUris);
      // @ts-expect-error - accessing private property for testing
      const backend = bookmarkServiceV2.backend;
      backend.getAllBookmarks = vi.fn().mockResolvedValue(allBookmarks);

      const result =
        await bookmarkServiceV2.getBookmarksInCollection(collectionId);

      expect(result).toHaveLength(2);
      expect(result[0].postUri).toBe("at://test/post1");
      expect(result[1].postUri).toBe("at://test/post2");
    });

    it("should get uncategorized bookmarks", async () => {
      const allBookmarks = [
        createMockBookmark("at://test/post1"),
        createMockBookmark("at://test/post2"),
        createMockBookmark("at://test/post3"),
      ];
      const uncategorizedUris = ["at://test/post2"];

      // @ts-expect-error - accessing private property for testing
      const backend = bookmarkServiceV2.backend;
      backend.getAllBookmarks = vi.fn().mockResolvedValue(allBookmarks);
      (
        bookmarkCollectionStorage.getUncategorizedBookmarks as Mock
      ).mockResolvedValue(uncategorizedUris);

      const result = await bookmarkServiceV2.getUncategorizedBookmarks();

      expect(result).toHaveLength(1);
      expect(result[0].postUri).toBe("at://test/post2");
    });

    it("should export collections", async () => {
      const exportData = {
        collections: [],
        mappings: [],
      };
      (bookmarkCollectionStorage.exportData as Mock).mockResolvedValue(
        exportData,
      );

      const result = await bookmarkServiceV2.exportCollections();

      expect(result).toBe(exportData);
    });

    it("should import collections", async () => {
      const importData = {
        collections: [],
        mappings: [],
      };

      await bookmarkServiceV2.importCollections(importData);

      expect(bookmarkCollectionStorage.importData).toHaveBeenCalledWith(
        importData,
      );
    });

    it("should clear all collections", async () => {
      await bookmarkServiceV2.clearAllCollections();

      expect(bookmarkCollectionStorage.clearAll).toHaveBeenCalled();
    });
  });
});
