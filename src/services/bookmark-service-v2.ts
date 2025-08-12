import { AppBskyFeedDefs, BskyAgent } from "@atproto/api";
import { CustomRecordBackend } from "./bookmark-backends/CustomRecordBackend";
import { LocalStorageBackend } from "./bookmark-backends/LocalStorageBackend";
import { Bookmark, BookmarkStorageBackend } from "./bookmark-backends/types";
import { bookmarkStorage } from "./bookmark-storage-db";
import { PostCacheService } from "./post-cache-service";

export type BookmarkPost = Bookmark & {
  post?: AppBskyFeedDefs.PostView;
};

class BookmarkServiceV2 {
  private backend: BookmarkStorageBackend;
  private storageType: "local" | "custom" = "local";
  private agent: BskyAgent | null = null;
  private postCacheService = PostCacheService.getInstance();

  constructor() {
    // Initialize with local storage by default
    this.backend = new LocalStorageBackend();
  }

  async init(agent?: BskyAgent, storageType?: "local" | "custom") {
    if (agent) {
      this.agent = agent;
    }

    // Initialize post cache
    await this.postCacheService.init();

    // Set storage type from preferences or default
    if (storageType) {
      await this.setStorageType(storageType);
    } else {
      await this.backend.init();
    }
  }

  setAgent(agent: BskyAgent | null) {
    this.agent = agent;
  }

  async setStorageType(type: "local" | "custom") {
    if (!this.agent && type !== "local") {
      throw new Error("Agent required for non-local storage");
    }

    this.storageType = type;

    // Create appropriate backend
    switch (type) {
      case "local":
        this.backend = new LocalStorageBackend();
        break;
      case "custom":
        this.backend = new CustomRecordBackend(this.agent!);
        break;
    }

    await this.backend.init();
  }

  async migrateStorage(
    fromType: "local" | "custom",
    toType: "local" | "custom",
  ) {
    if (!this.agent && toType !== "local") {
      throw new Error("Agent required for non-local storage");
    }

    // Export from current backend
    const bookmarks = await this.backend.exportBookmarks();

    // Switch to new backend
    await this.setStorageType(toType);

    // Import to new backend
    await this.backend.importBookmarks(bookmarks);
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
          console.error("Failed to fetch bookmarked post:", error);
        }
      }

      bookmarkPosts.push({
        ...bookmark,
        post,
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
    const matchingBookmarks = allBookmarks.filter((bookmark) => {
      const searchText =
        `${bookmark.text} ${bookmark.author.handle} ${bookmark.author.displayName}`.toLowerCase();
      return searchText.includes(query.toLowerCase());
    });

    const bookmarkPosts: BookmarkPost[] = [];
    for (const bookmark of matchingBookmarks) {
      const post = await this.postCacheService.getPost(bookmark.postUri);
      bookmarkPosts.push({
        ...bookmark,
        post,
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

  getSyncStatus() {
    if (this.backend.getSyncStatus) {
      return this.backend.getSyncStatus();
    }
    return null;
  }

  getStorageType() {
    return this.storageType;
  }

  // Backwards compatibility method
  getBookmarkCount() {
    return bookmarkStorage.getBookmarkCount();
  }
}

export const bookmarkServiceV2 = new BookmarkServiceV2();
