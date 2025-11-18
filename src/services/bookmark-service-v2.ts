import { AppBskyFeedDefs, BskyAgent } from "@atproto/api";
import { createLogger } from "../utils/logger";
import { LocalStorageBackend } from "./bookmark-backends/LocalStorageBackend";
import { OfficialBookmarksBackend } from "./bookmark-backends/OfficialBookmarksBackend";
import { SingletonCustomRecordBackend } from "./bookmark-backends/SingletonCustomRecordBackend";
import { Bookmark, BookmarkStorageBackend } from "./bookmark-backends/types";
import { PostCacheService } from "./post-cache-service";

export type BookmarkPost = Bookmark & {
  post?: AppBskyFeedDefs.PostView;
};

const logger = createLogger("BookmarkServiceV2");

class BookmarkServiceV2 {
  private backend: BookmarkStorageBackend;
  private storageType: "local" | "custom" | "official" = "local";
  public agent: BskyAgent | null = null;
  private postCacheService = PostCacheService.getInstance();

  constructor() {
    // Initialize with local storage by default
    this.backend = new LocalStorageBackend();
  }

  async init(agent?: BskyAgent, storageType?: "local" | "custom" | "official") {
    if (agent) {
      this.agent = agent;
    }

    // Initialize post cache
    await this.postCacheService.init();

    // Set storage type from preferences or default
    if (storageType) {
      await this.setStorageType(storageType);
    } else {
      // If we already have a backend but agent changed, re-create it
      if (this.backend && agent) {
        if (this.storageType === "custom") {
          const customBackend = new SingletonCustomRecordBackend(agent);
          customBackend.setErrorCallback((error: Error, action: string) => {
            logger.error(
              `SingletonCustomRecordBackend error during ${action}:`,
              error,
            );
          });
          this.backend = customBackend;
        } else if (this.storageType === "official") {
          const officialBackend = new OfficialBookmarksBackend();
          officialBackend.setAgent(agent);
          this.backend = officialBackend;
        }
      }
      await this.backend.init();
    }
  }

  setAgent(agent: BskyAgent | null) {
    this.agent = agent;

    // If we're using custom or official storage and the agent changed, we need to update the backend
    if (
      this.backend &&
      agent &&
      (this.storageType === "custom" || this.storageType === "official")
    ) {
      // Re-initialize the backend with the new agent
      if (this.storageType === "custom") {
        const customBackend = new SingletonCustomRecordBackend(agent);
        customBackend.setErrorCallback((error: Error, action: string) => {
          logger.error(
            `SingletonCustomRecordBackend error during ${action}:`,
            error,
          );
        });
        this.backend = customBackend;
      } else if (this.storageType === "official") {
        const officialBackend = new OfficialBookmarksBackend();
        officialBackend.setAgent(agent);
        this.backend = officialBackend;
      }
      // Don't await here to avoid making setAgent async, but log any errors
      this.backend.init().catch((error) => {
        logger.error(
          "Failed to re-initialize backend after agent change:",
          error,
        );
      });
    }
  }

  async setStorageType(type: "local" | "custom" | "official") {
    if (!this.agent && type !== "local") {
      throw new Error("Agent required for non-local storage");
    }

    this.storageType = type;

    // Create appropriate backend
    switch (type) {
      case "local":
        this.backend = new LocalStorageBackend();
        break;
      case "custom": {
        const customBackend = new SingletonCustomRecordBackend(this.agent!);
        // Set up error callback to log any issues
        customBackend.setErrorCallback((error: Error, action: string) => {
          logger.error(
            `SingletonCustomRecordBackend error during ${action}:`,
            error,
          );
        });
        this.backend = customBackend;
        break;
      }
      case "official": {
        const officialBackend = new OfficialBookmarksBackend();
        if (this.agent) {
          officialBackend.setAgent(this.agent);
        }
        this.backend = officialBackend;
        break;
      }
    }

    await this.backend.init();
  }

  async migrateStorage(
    _fromType: "local" | "custom" | "official",
    toType: "local" | "custom" | "official",
  ): Promise<void> {
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
    tags?: string[],
  ): Promise<void> {
    if (this.backend.addBookmarkWithTags && tags && tags.length > 0) {
      await this.backend.addBookmarkWithTags(post, notes, tags);
    } else {
      await this.backend.addBookmark(post, notes);
    }
    await this.postCacheService.cachePosts([post]);
  }

  async removeBookmark(postUri: string): Promise<void> {
    await this.backend.removeBookmark(postUri);
  }

  async updateBookmarkTags(postUri: string, tags: string[]): Promise<void> {
    if (!this.backend.updateBookmarkTags) {
      throw new Error("This storage backend does not support tag updates");
    }
    await this.backend.updateBookmarkTags(postUri, tags);
  }

  async getAllTags(): Promise<string[]> {
    const bookmarks = await this.backend.getAllBookmarks();
    const tagsSet = new Set<string>();
    bookmarks.forEach((bookmark) => {
      bookmark.tags?.forEach((tag) => tagsSet.add(tag));
    });
    return Array.from(tagsSet).sort();
  }

  async getBookmarksByTag(tag: string): Promise<BookmarkPost[]> {
    const allBookmarks = await this.backend.getAllBookmarks();
    const taggedBookmarks = allBookmarks.filter((bookmark) =>
      bookmark.tags?.includes(tag),
    );

    const bookmarkPosts: BookmarkPost[] = [];
    for (const bookmark of taggedBookmarks) {
      const post = await this.postCacheService.getPost(bookmark.postUri);
      bookmarkPosts.push({
        ...bookmark,
        post: post || undefined,
      });
    }

    return bookmarkPosts;
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
      const tagsText = bookmark.tags?.join(" ").toLowerCase() || "";
      const notesText = bookmark.notes?.toLowerCase() || "";

      return (
        searchText.includes(lowercaseQuery) ||
        tagsText.includes(lowercaseQuery) ||
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

  getSyncStatus() {
    if (this.backend.getSyncStatus) {
      return this.backend.getSyncStatus();
    }
    return null;
  }

  getStorageType() {
    return this.storageType;
  }

  async refreshCache(): Promise<void> {
    if (this.backend.refreshCache) {
      await this.backend.refreshCache();
    }
  }

  setErrorCallback(_callback: (error: Error, action: string) => void) {
    // Set error callback if backend supports it
    if (this.backend instanceof SingletonCustomRecordBackend) {
      this.backend.setErrorCallback(_callback);
    }
  }

  async detectExistingBookmarks(): Promise<{
    local: number;
    custom: number;
    official: number;
  }> {
    const counts = {
      local: 0,
      custom: 0,
      official: 0,
    };

    try {
      // Check local storage
      const localBackend = new LocalStorageBackend();
      await localBackend.init();
      counts.local = await localBackend.getCount();
    } catch (error) {
      logger.error("Failed to check local bookmarks:", error);
    }

    if (this.agent) {
      try {
        // Check custom AT Protocol storage
        const customBackend = new SingletonCustomRecordBackend(this.agent);
        await customBackend.init();
        counts.custom = await customBackend.getCount();
      } catch (error) {
        logger.error("Failed to check custom bookmarks:", error);
      }

      try {
        // Check official bookmarks
        const officialBackend = new OfficialBookmarksBackend();
        officialBackend.setAgent(this.agent);
        await officialBackend.init();
        counts.official = await officialBackend.getCount();
      } catch (error) {
        logger.error("Failed to check official bookmarks:", error);
      }
    }

    return counts;
  }

  async migrateBookmarks(
    fromType: "local" | "custom",
    toType: "official",
  ): Promise<{ success: boolean; migratedCount: number; error?: string }> {
    if (!this.agent) {
      return {
        success: false,
        migratedCount: 0,
        error: "Agent required for migration",
      };
    }

    try {
      let sourceBackend: BookmarkStorageBackend;

      if (fromType === "local") {
        sourceBackend = new LocalStorageBackend();
      } else {
        sourceBackend = new SingletonCustomRecordBackend(this.agent);
      }

      await sourceBackend.init();
      const bookmarks = await sourceBackend.exportBookmarks();

      if (bookmarks.length === 0) {
        return {
          success: true,
          migratedCount: 0,
        };
      }

      // Import to official bookmarks
      const targetBackend = new OfficialBookmarksBackend();
      targetBackend.setAgent(this.agent);
      await targetBackend.init();
      await targetBackend.importBookmarks(bookmarks);

      // Clear source bookmarks after successful migration
      await sourceBackend.clear();

      return {
        success: true,
        migratedCount: bookmarks.length,
      };
    } catch (error) {
      logger.error(
        `Failed to migrate bookmarks from ${fromType} to ${toType}:`,
        error,
      );
      return {
        success: false,
        migratedCount: 0,
        error: error instanceof Error ? error.message : "Migration failed",
      };
    }
  }
}

export const bookmarkServiceV2 = new BookmarkServiceV2();
