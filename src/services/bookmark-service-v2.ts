import { AppBskyFeedDefs, BskyAgent } from "@atproto/api";
import { createLogger } from "../utils/logger";
import { OfficialBookmarksBackend } from "./bookmark-backend";
import { Bookmark } from "./bookmark-backends/types";
import {
  BookmarkCollection,
  bookmarkCollectionStorage,
} from "./bookmark-collections";
import { PostCacheService } from "./post-cache-service";

export type BookmarkPost = Bookmark & {
  post?: AppBskyFeedDefs.PostView;
  collectionIds?: string[];
};

const logger = createLogger("BookmarkService");

/**
 * Simplified bookmark service that only uses the official AT Protocol bookmarks API.
 * All bookmarks are synced to Bluesky's servers and available across devices.
 */
class BookmarkServiceV2 {
  private backend: OfficialBookmarksBackend;
  public agent: BskyAgent | null = null;
  private postCacheService = PostCacheService.getInstance();

  constructor() {
    this.backend = new OfficialBookmarksBackend();
  }

  async init(agent?: BskyAgent) {
    if (agent) {
      this.agent = agent;
      this.backend.setAgent(agent);
    }

    // Initialize post cache
    await this.postCacheService.init();

    // Initialize collection storage
    await bookmarkCollectionStorage.init();

    // Initialize backend
    if (this.agent) {
      await this.backend.init();
    }
  }

  setAgent(agent: BskyAgent | null) {
    this.agent = agent;

    if (agent) {
      this.backend.setAgent(agent);
      // Re-initialize backend with new agent
      this.backend.init().catch((error) => {
        logger.error(
          "Failed to re-initialize backend after agent change:",
          error,
        );
      });
    }
  }

  async toggleBookmark(post: AppBskyFeedDefs.PostView): Promise<boolean> {
    const isCurrentlyBookmarked = await this.backend.isBookmarked(post.uri);

    if (isCurrentlyBookmarked) {
      await this.backend.removeBookmark(post.uri);
      return false;
    } else {
      await this.backend.addBookmark(post);

      // Cache the full post data
      await this.postCacheService.cachePosts([post]);

      return true;
    }
  }

  async addBookmark(
    post: AppBskyFeedDefs.PostView,
    notes?: string,
  ): Promise<void> {
    await this.backend.addBookmark(post, notes);
    await this.postCacheService.cachePosts([post]);
  }

  async removeBookmark(postUri: string): Promise<void> {
    await this.backend.removeBookmark(postUri);
    // Also remove from all collections
    await bookmarkCollectionStorage.removeBookmarkFromAllCollections(postUri);
  }

  async getBookmarkedPosts(
    limit?: number,
    offset?: number,
  ): Promise<BookmarkPost[]> {
    const bookmarks = await this.backend.getAllBookmarks();
    const bookmarkPosts: BookmarkPost[] = [];

    // Apply pagination
    const startIndex = offset || 0;
    const endIndex = limit ? startIndex + limit : bookmarks.length;
    const paginatedBookmarks = bookmarks.slice(startIndex, endIndex);

    for (const bookmark of paginatedBookmarks) {
      let post = await this.postCacheService.getPost(bookmark.postUri);

      // If not in cache and we have an agent, try to fetch it
      if (!post && this.agent) {
        try {
          const response = await this.agent.getPostThread({
            uri: bookmark.postUri,
          });
          if (response.data.thread && "post" in response.data.thread) {
            post = response.data.thread.post;
            await this.postCacheService.cachePosts([post]);
          }
        } catch (error) {
          logger.error("Failed to fetch bookmarked post:", error);
        }
      }

      bookmarkPosts.push({
        ...bookmark,
        post: post || undefined,
      });
    }

    return bookmarkPosts;
  }

  async isPostBookmarked(postUri: string): Promise<boolean> {
    return await this.backend.isBookmarked(postUri);
  }

  async getBookmarkCount(): Promise<number> {
    return await this.backend.getCount();
  }

  async searchBookmarks(query: string): Promise<BookmarkPost[]> {
    const allBookmarks = await this.backend.getAllBookmarks();
    const lowercaseQuery = query.toLowerCase();

    const matchingBookmarks = allBookmarks.filter((bookmark) => {
      const searchText =
        `${bookmark.text} ${bookmark.author.handle} ${bookmark.author.displayName}`.toLowerCase();
      const notesText = bookmark.notes?.toLowerCase() || "";

      return (
        searchText.includes(lowercaseQuery) ||
        notesText.includes(lowercaseQuery)
      );
    });

    const bookmarkPosts: BookmarkPost[] = [];
    for (const bookmark of matchingBookmarks) {
      const post = await this.postCacheService.getPost(bookmark.postUri);
      bookmarkPosts.push({
        ...bookmark,
        post: post || undefined,
      });
    }

    return bookmarkPosts;
  }

  async exportBookmarks(): Promise<Bookmark[]> {
    return await this.backend.exportBookmarks();
  }

  async importBookmarks(bookmarks: Bookmark[]): Promise<void> {
    await this.backend.importBookmarks(bookmarks);
  }

  async clearAllBookmarks(): Promise<void> {
    await this.backend.clear();
  }

  async refreshCache(): Promise<void> {
    if (this.backend.refreshCache) {
      await this.backend.refreshCache();
    }
  }

  // ==================== Collection Methods ====================

  async createCollection(
    collection: Omit<
      BookmarkCollection,
      "id" | "createdAt" | "updatedAt" | "bookmarkCount"
    >,
  ): Promise<BookmarkCollection> {
    return bookmarkCollectionStorage.createCollection(collection);
  }

  async getCollection(id: string): Promise<BookmarkCollection | null> {
    return bookmarkCollectionStorage.getCollection(id);
  }

  async getAllCollections(): Promise<BookmarkCollection[]> {
    return bookmarkCollectionStorage.getAllCollections();
  }

  async updateCollection(
    id: string,
    updates: Partial<
      Omit<BookmarkCollection, "id" | "createdAt" | "bookmarkCount">
    >,
  ): Promise<BookmarkCollection | null> {
    return bookmarkCollectionStorage.updateCollection(id, updates);
  }

  async deleteCollection(id: string): Promise<void> {
    return bookmarkCollectionStorage.deleteCollection(id);
  }

  async addBookmarkToCollection(
    postUri: string,
    collectionId: string,
  ): Promise<void> {
    return bookmarkCollectionStorage.addBookmarkToCollection(
      postUri,
      collectionId,
    );
  }

  async removeBookmarkFromCollection(
    postUri: string,
    collectionId: string,
  ): Promise<void> {
    return bookmarkCollectionStorage.removeBookmarkFromCollection(
      postUri,
      collectionId,
    );
  }

  async getBookmarkCollections(postUri: string): Promise<string[]> {
    return bookmarkCollectionStorage.getBookmarkCollections(postUri);
  }

  async getCollectionBookmarks(collectionId: string): Promise<string[]> {
    return bookmarkCollectionStorage.getCollectionBookmarks(collectionId);
  }

  async getBookmarksInCollection(
    collectionId: string,
  ): Promise<BookmarkPost[]> {
    const bookmarkUris =
      await bookmarkCollectionStorage.getCollectionBookmarks(collectionId);
    const allBookmarks = await this.getBookmarkedPosts();

    // Filter to only bookmarks in this collection
    const uriSet = new Set(bookmarkUris);
    return allBookmarks.filter((b) => uriSet.has(b.postUri));
  }

  async getUncategorizedBookmarks(): Promise<BookmarkPost[]> {
    const allBookmarks = await this.getBookmarkedPosts();
    const allUris = allBookmarks.map((b) => b.postUri);
    const uncategorizedUris =
      await bookmarkCollectionStorage.getUncategorizedBookmarks(allUris);

    const uriSet = new Set(uncategorizedUris);
    return allBookmarks.filter((b) => uriSet.has(b.postUri));
  }

  async exportCollections(): Promise<{
    collections: BookmarkCollection[];
    mappings: { bookmarkUri: string; collectionId: string; addedAt: string }[];
  }> {
    return bookmarkCollectionStorage.exportData();
  }

  async importCollections(data: {
    collections: BookmarkCollection[];
    mappings: { bookmarkUri: string; collectionId: string; addedAt: string }[];
  }): Promise<void> {
    return bookmarkCollectionStorage.importData(data);
  }

  async clearAllCollections(): Promise<void> {
    return bookmarkCollectionStorage.clearAll();
  }
}

export const bookmarkServiceV2 = new BookmarkServiceV2();
