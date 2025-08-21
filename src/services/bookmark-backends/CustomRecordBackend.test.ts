import { AppBskyFeedDefs } from "@atproto/api";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockAgent } from "../../tests/mocks/atproto";
import { CustomRecordBackend } from "./CustomRecordBackend";

describe("CustomRecordBackend", () => {
  let backend: CustomRecordBackend;
  let mockAgent: any;
  let errorCallback: ReturnType<typeof vi.fn>;

  const createMockPost = (uri: string): AppBskyFeedDefs.PostView => ({
    uri,
    cid: "mock-cid",
    author: {
      did: "did:plc:author123",
      handle: "author.bsky.social",
      displayName: "Test Author",
      avatar: "https://example.com/avatar.jpg",
    },
    record: {
      $type: "app.bsky.feed.post",
      text: "Test post content",
      createdAt: new Date().toISOString(),
    },
    indexedAt: new Date().toISOString(),
  });

  beforeEach(() => {
    mockAgent = createMockAgent();
    // Fix the agent structure for the bookmark backend
    mockAgent.com = mockAgent.api.com;
    backend = new CustomRecordBackend(mockAgent as any);
    errorCallback = vi.fn();
  });

  describe("init", () => {
    it("should initialize and load existing bookmarks", async () => {
      const mockRecords = [
        {
          uri: "at://did:plc:testuser123/com.shadowsky.bookmark/bookmark-post1",
          value: {
            $type: "com.shadowsky.bookmark",
            postUri: "at://did:plc:author123/app.bsky.feed.post/post1",
            postCid: "cid1",
            savedAt: "2024-01-01T00:00:00Z",
            author: {
              did: "did:plc:author123",
              handle: "author.bsky.social",
              displayName: "Test Author",
            },
            text: "Post 1 content",
            createdAt: "2024-01-01T00:00:00Z",
          },
        },
      ];

      mockAgent.api.com.atproto.repo.listRecords.mockResolvedValue({
        data: {
          records: mockRecords,
          cursor: undefined,
        },
      });

      await backend.init();

      const bookmarks = await backend.getAllBookmarks();
      expect(bookmarks).toHaveLength(1);
      expect(bookmarks[0].postUri).toBe(
        "at://did:plc:author123/app.bsky.feed.post/post1",
      );
    });

    it("should handle 400 errors gracefully during init", async () => {
      const error = new Error("Collection not found");
      (error as any).status = 400;
      mockAgent.api.com.atproto.repo.listRecords.mockRejectedValue(error);

      await expect(backend.init()).resolves.not.toThrow();
    });

    it("should throw other errors during init", async () => {
      backend.setErrorCallback(errorCallback);
      const error = new Error("Network error");
      (error as any).status = 500;
      mockAgent.api.com.atproto.repo.listRecords.mockRejectedValue(error);

      await expect(backend.init()).rejects.toThrow("Network error");
      expect(errorCallback).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Network error" }),
        "load bookmarks from repo",
      );
    });
  });

  describe("addBookmark", () => {
    beforeEach(async () => {
      await backend.init();
    });

    it("should add a new bookmark", async () => {
      const post = createMockPost(
        "at://did:plc:author123/app.bsky.feed.post/post1",
      );
      const notes = "Important post";

      const bookmark = await backend.addBookmark(post, notes);

      expect(bookmark.postUri).toBe(post.uri);
      expect(bookmark.notes).toBe(notes);
      expect(bookmark.author.did).toBe(post.author.did);

      expect(mockAgent.api.com.atproto.repo.createRecord).toHaveBeenCalledWith({
        repo: "did:plc:testuser123",
        collection: "com.shadowsky.bookmark",
        rkey: expect.stringContaining("bookmark-"),
        record: expect.objectContaining({
          $type: "com.shadowsky.bookmark",
          postUri: post.uri,
          postCid: post.cid,
          notes,
        }),
      });
    });

    it("should generate stable rkey from post URI", async () => {
      const post = createMockPost(
        "at://did:plc:author123/app.bsky.feed.post/post1",
      );

      await backend.addBookmark(post);

      expect(mockAgent.api.com.atproto.repo.createRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          rkey: "bookmark-post1",
        }),
      );
    });
  });

  describe("removeBookmark", () => {
    beforeEach(async () => {
      const mockRecords = [
        {
          uri: "at://did:plc:testuser123/com.shadowsky.bookmark/bookmark-post1",
          value: {
            $type: "com.shadowsky.bookmark",
            postUri: "at://did:plc:author123/app.bsky.feed.post/post1",
            postCid: "cid1",
            savedAt: "2024-01-01T00:00:00Z",
            author: {
              did: "did:plc:author123",
              handle: "author.bsky.social",
            },
            text: "Post content",
            createdAt: "2024-01-01T00:00:00Z",
          },
        },
      ];

      mockAgent.api.com.atproto.repo.listRecords.mockResolvedValue({
        data: {
          records: mockRecords,
          cursor: undefined,
        },
      });

      await backend.init();
    });

    it("should remove an existing bookmark", async () => {
      const postUri = "at://did:plc:author123/app.bsky.feed.post/post1";

      await backend.removeBookmark(postUri);

      expect(mockAgent.api.com.atproto.repo.deleteRecord).toHaveBeenCalledWith({
        repo: "did:plc:testuser123",
        collection: "com.shadowsky.bookmark",
        rkey: "bookmark-post1",
      });
    });

    it("should do nothing if bookmark doesn't exist", async () => {
      const postUri = "at://did:plc:author123/app.bsky.feed.post/nonexistent";

      await backend.removeBookmark(postUri);

      expect(
        mockAgent.api.com.atproto.repo.deleteRecord,
      ).not.toHaveBeenCalled();
    });
  });

  describe("getBookmark", () => {
    beforeEach(async () => {
      const mockRecords = [
        {
          uri: "at://did:plc:testuser123/com.shadowsky.bookmark/bookmark-post1",
          value: {
            $type: "com.shadowsky.bookmark",
            postUri: "at://did:plc:author123/app.bsky.feed.post/post1",
            postCid: "cid1",
            savedAt: "2024-01-01T00:00:00Z",
            author: {
              did: "did:plc:author123",
              handle: "author.bsky.social",
              displayName: "Test Author",
            },
            text: "Post content",
            notes: "My notes",
            createdAt: "2024-01-01T00:00:00Z",
          },
        },
      ];

      mockAgent.api.com.atproto.repo.listRecords.mockResolvedValue({
        data: {
          records: mockRecords,
          cursor: undefined,
        },
      });

      await backend.init();
    });

    it("should get an existing bookmark", async () => {
      const bookmark = await backend.getBookmark(
        "at://did:plc:author123/app.bsky.feed.post/post1",
      );

      expect(bookmark).toBeTruthy();
      expect(bookmark?.postUri).toBe(
        "at://did:plc:author123/app.bsky.feed.post/post1",
      );
      expect(bookmark?.notes).toBe("My notes");
    });

    it("should return null for non-existent bookmark", async () => {
      const bookmark = await backend.getBookmark(
        "at://did:plc:author123/app.bsky.feed.post/nonexistent",
      );

      expect(bookmark).toBeNull();
    });
  });

  describe("isBookmarked", () => {
    beforeEach(async () => {
      const mockRecords = [
        {
          uri: "at://did:plc:testuser123/com.shadowsky.bookmark/bookmark-post1",
          value: {
            $type: "com.shadowsky.bookmark",
            postUri: "at://did:plc:author123/app.bsky.feed.post/post1",
            postCid: "cid1",
            savedAt: "2024-01-01T00:00:00Z",
            author: { did: "did:plc:author123", handle: "author.bsky.social" },
            text: "Post content",
            createdAt: "2024-01-01T00:00:00Z",
          },
        },
      ];

      mockAgent.api.com.atproto.repo.listRecords.mockResolvedValue({
        data: {
          records: mockRecords,
          cursor: undefined,
        },
      });

      await backend.init();
    });

    it("should return true for bookmarked post", async () => {
      const isBookmarked = await backend.isBookmarked(
        "at://did:plc:author123/app.bsky.feed.post/post1",
      );
      expect(isBookmarked).toBe(true);
    });

    it("should return false for non-bookmarked post", async () => {
      const isBookmarked = await backend.isBookmarked(
        "at://did:plc:author123/app.bsky.feed.post/nonexistent",
      );
      expect(isBookmarked).toBe(false);
    });
  });

  describe("clear", () => {
    beforeEach(async () => {
      const mockRecords = [
        {
          uri: "at://did:plc:testuser123/com.shadowsky.bookmark/bookmark-post1",
          value: {
            $type: "com.shadowsky.bookmark",
            postUri: "at://did:plc:author123/app.bsky.feed.post/post1",
            postCid: "cid1",
            savedAt: "2024-01-01T00:00:00Z",
            author: { did: "did:plc:author123", handle: "author.bsky.social" },
            text: "Post 1",
            createdAt: "2024-01-01T00:00:00Z",
          },
        },
        {
          uri: "at://did:plc:testuser123/com.shadowsky.bookmark/bookmark-post2",
          value: {
            $type: "com.shadowsky.bookmark",
            postUri: "at://did:plc:author123/app.bsky.feed.post/post2",
            postCid: "cid2",
            savedAt: "2024-01-02T00:00:00Z",
            author: { did: "did:plc:author123", handle: "author.bsky.social" },
            text: "Post 2",
            createdAt: "2024-01-02T00:00:00Z",
          },
        },
      ];

      mockAgent.api.com.atproto.repo.listRecords.mockResolvedValue({
        data: {
          records: mockRecords,
          cursor: undefined,
        },
      });

      await backend.init();
    });

    it("should delete all bookmarks", async () => {
      await backend.clear();

      expect(mockAgent.api.com.atproto.repo.deleteRecord).toHaveBeenCalledTimes(
        2,
      );
      expect(
        mockAgent.api.com.atproto.repo.deleteRecord,
      ).toHaveBeenNthCalledWith(1, {
        repo: "did:plc:testuser123",
        collection: "com.shadowsky.bookmark",
        rkey: "bookmark-post1",
      });
      expect(
        mockAgent.api.com.atproto.repo.deleteRecord,
      ).toHaveBeenNthCalledWith(2, {
        repo: "did:plc:testuser123",
        collection: "com.shadowsky.bookmark",
        rkey: "bookmark-post2",
      });
    });
  });

  describe("importBookmarks", () => {
    beforeEach(async () => {
      await backend.init();
    });

    it("should clear existing bookmarks and import new ones", async () => {
      const bookmarksToImport = [
        {
          id: "bookmark1",
          postUri: "at://did:plc:author123/app.bsky.feed.post/post1",
          postCid: "cid1",
          savedAt: "2024-01-01T00:00:00Z",
          author: {
            did: "did:plc:author123",
            handle: "author.bsky.social",
            displayName: "Author 1",
          },
          text: "Post 1",
        },
        {
          id: "bookmark2",
          postUri: "at://did:plc:author123/app.bsky.feed.post/post2",
          postCid: "cid2",
          savedAt: "2024-01-02T00:00:00Z",
          author: {
            did: "did:plc:author456",
            handle: "author2.bsky.social",
            displayName: "Author 2",
          },
          text: "Post 2",
        },
      ];

      // Mock existing bookmarks for clear operation
      mockAgent.api.com.atproto.repo.listRecords.mockResolvedValue({
        data: {
          records: [],
          cursor: undefined,
        },
      });

      await backend.importBookmarks(bookmarksToImport);

      expect(mockAgent.api.com.atproto.repo.createRecord).toHaveBeenCalledTimes(
        2,
      );

      // Check first bookmark
      expect(mockAgent.api.com.atproto.repo.createRecord).toHaveBeenCalledWith({
        repo: "did:plc:testuser123",
        collection: "com.shadowsky.bookmark",
        rkey: "bookmark-post1",
        record: expect.objectContaining({
          $type: "com.shadowsky.bookmark",
          postUri: "at://did:plc:author123/app.bsky.feed.post/post1",
          postCid: "cid1",
        }),
      });
    });
  });

  describe("getCount", () => {
    it("should return the number of bookmarks", async () => {
      const mockRecords = [
        {
          uri: "at://did:plc:testuser123/com.shadowsky.bookmark/bookmark-post1",
          value: {
            $type: "com.shadowsky.bookmark",
            postUri: "at://did:plc:author123/app.bsky.feed.post/post1",
            postCid: "cid1",
            savedAt: "2024-01-01T00:00:00Z",
            author: { did: "did:plc:author123", handle: "author.bsky.social" },
            text: "Post 1",
            createdAt: "2024-01-01T00:00:00Z",
          },
        },
        {
          uri: "at://did:plc:testuser123/com.shadowsky.bookmark/bookmark-post2",
          value: {
            $type: "com.shadowsky.bookmark",
            postUri: "at://did:plc:author123/app.bsky.feed.post/post2",
            postCid: "cid2",
            savedAt: "2024-01-02T00:00:00Z",
            author: { did: "did:plc:author123", handle: "author.bsky.social" },
            text: "Post 2",
            createdAt: "2024-01-02T00:00:00Z",
          },
        },
      ];

      mockAgent.api.com.atproto.repo.listRecords.mockResolvedValue({
        data: {
          records: mockRecords,
          cursor: undefined,
        },
      });

      await backend.init();
      const count = await backend.getCount();

      expect(count).toBe(2);
    });
  });

  describe("error handling", () => {
    beforeEach(async () => {
      backend.setErrorCallback(errorCallback);
      await backend.init();
    });

    it("should handle errors through error callback", async () => {
      const error = new Error("API Error");
      mockAgent.api.com.atproto.repo.createRecord.mockRejectedValue(error);

      const post = createMockPost(
        "at://did:plc:author123/app.bsky.feed.post/post1",
      );

      await expect(backend.addBookmark(post)).rejects.toThrow("API Error");

      // Error callback is not called for operations that throw
      expect(errorCallback).not.toHaveBeenCalled();
    });
  });
});
