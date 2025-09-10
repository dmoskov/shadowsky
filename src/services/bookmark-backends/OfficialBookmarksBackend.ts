import { AppBskyFeedDefs, AppBskyFeedPost, AtpAgent } from "@atproto/api";
import { createLogger } from "../../utils/logger";
import { Bookmark, BookmarkStorageBackend } from "./types";

const logger = createLogger("OfficialBookmarksBackend");

export class OfficialBookmarksBackend implements BookmarkStorageBackend {
  type = "official" as const;
  private agent: AtpAgent | null = null;
  private cache: Map<string, Bookmark> = new Map();
  private bookmarkRecords: Map<string, { uri: string; cid: string }> =
    new Map(); // Maps post URI to bookmark record URI/CID

  async init(): Promise<void> {
    // Agent must be set separately via setAgent method
    if (!this.agent) {
      throw new Error("AT Protocol agent is required for official bookmarks");
    }
    await this.loadFromServer();
  }

  setAgent(agent: AtpAgent): void {
    this.agent = agent;
  }

  private async loadFromServer(): Promise<void> {
    if (!this.agent) return;

    try {
      this.cache.clear();
      this.bookmarkRecords.clear();


      // Use the official bookmark API
      let cursor: string | undefined;
      const allBookmarks: any[] = [];
      
      do {
        const response = await this.agent.app.bsky.bookmark.getBookmarks({
          limit: 100,
          cursor,
        });
        
        
        // Only continue if we actually got bookmarks
        if (response.data.bookmarks.length > 0) {
          allBookmarks.push(...response.data.bookmarks);
          cursor = response.data.cursor;
        } else {
          // Stop if no bookmarks were returned
          cursor = undefined;
        }
      } while (cursor);


      // Process each bookmark
      for (const bookmarkView of allBookmarks) {
        // The bookmark has subject (with uri and cid) and item (the post)
        const uri = bookmarkView.subject.uri;
        const createdAt = bookmarkView.createdAt || new Date().toISOString();
        
        // Store bookmark metadata
        this.bookmarkRecords.set(uri, {
          uri,
          cid: bookmarkView.subject.cid,
        });
        
        // If the item is a PostView, convert it to our bookmark format
        if (bookmarkView.item && bookmarkView.item.$type === 'app.bsky.feed.defs#postView') {
          const post = bookmarkView.item as AppBskyFeedDefs.PostView;
          const bookmark = this.convertPostToBookmark(post, createdAt);
          this.cache.set(bookmark.postUri, bookmark);
        }
      }

    } catch (error) {
      logger.error("Failed to load bookmarks from server:", error);
      logger.error("Error details:", {
        message: (error as any)?.message,
        status: (error as any)?.status,
        statusText: (error as any)?.statusText,
        data: (error as any)?.data,
      });
      // Don't throw - we can still work with empty cache
    }
  }

  private convertPostToBookmark(
    post: AppBskyFeedDefs.PostView,
    savedAt?: string,
  ): Bookmark {
    const record = post.record as AppBskyFeedPost.Record;
    return {
      id: post.uri,
      postUri: post.uri,
      postCid: post.cid,
      savedAt: savedAt || new Date().toISOString(),
      author: {
        did: post.author.did,
        handle: post.author.handle,
        displayName: post.author.displayName,
        avatar: post.author.avatar,
      },
      text: record?.text || "",
    };
  }

  async addBookmark(
    post: AppBskyFeedDefs.PostView,
    _notes?: string,
  ): Promise<Bookmark> {
    if (!this.agent) throw new Error("Not initialized");

    try {
      // Create bookmark using official API
      await this.agent.app.bsky.bookmark.createBookmark({
        uri: post.uri,
        cid: post.cid,
      });
      

      const savedAt = new Date().toISOString();
      const bookmark = this.convertPostToBookmark(post, savedAt);

      // Update local cache
      this.cache.set(bookmark.postUri, bookmark);
      this.bookmarkRecords.set(post.uri, {
        uri: post.uri,
        cid: post.cid,
      });

      return bookmark;
    } catch (error) {
      logger.error("Failed to add bookmark:", error);
      logger.error("Error details:", {
        message: (error as any)?.message,
        status: (error as any)?.status,
        statusText: (error as any)?.statusText,
        data: (error as any)?.data,
      });
      throw error;
    }
  }

  async removeBookmark(postUri: string): Promise<void> {
    if (!this.agent) throw new Error("Not initialized");

    try {
      // Delete bookmark using official API
      await this.agent.app.bsky.bookmark.deleteBookmark({
        uri: postUri,
      });

      // Update local cache
      this.cache.delete(postUri);
      this.bookmarkRecords.delete(postUri);

    } catch (error) {
      logger.error("Failed to remove bookmark:", error);
      throw error;
    }
  }

  async getBookmark(postUri: string): Promise<Bookmark | null> {
    if (!this.agent) throw new Error("Not initialized");
    return this.cache.get(postUri) || null;
  }

  async getAllBookmarks(): Promise<Bookmark[]> {
    if (!this.agent) throw new Error("Not initialized");

    try {
      // Refresh from server to ensure we're up to date
      await this.loadFromServer();

      return Array.from(this.cache.values()).sort(
        (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime(),
      );
    } catch (error) {
      logger.error("Failed to get all bookmarks:", error);
      throw error;
    }
  }

  async isBookmarked(postUri: string): Promise<boolean> {
    if (!this.agent) throw new Error("Not initialized");

    // Check local cache first for performance
    return this.cache.has(postUri);
  }

  async clear(): Promise<void> {
    if (!this.agent) throw new Error("Not initialized");

    try {
      // First ensure we have all bookmarks loaded
      await this.loadFromServer();

      // Delete all bookmarks one by one
      const allBookmarkUris = Array.from(this.bookmarkRecords.keys());
      for (const uri of allBookmarkUris) {
        await this.removeBookmark(uri);
      }

      this.cache.clear();
      this.bookmarkRecords.clear();
    } catch (error) {
      logger.error("Failed to clear bookmarks:", error);
      throw error;
    }
  }

  async importBookmarks(bookmarks: Bookmark[]): Promise<void> {
    if (!this.agent) throw new Error("Not initialized");

    for (const bookmark of bookmarks) {
      try {
        // Create a minimal post view to satisfy the API
        const post: AppBskyFeedDefs.PostView = {
          uri: bookmark.postUri,
          cid: bookmark.postCid,
          author: bookmark.author,
          record: { text: bookmark.text },
          indexedAt: bookmark.savedAt,
        } as AppBskyFeedDefs.PostView;

        await this.addBookmark(post, bookmark.notes);
      } catch (error) {
        logger.error("Failed to import bookmark:", error);
        // Continue with other bookmarks even if one fails
      }
    }
  }

  async exportBookmarks(): Promise<Bookmark[]> {
    return this.getAllBookmarks();
  }

  async getCount(): Promise<number> {
    if (!this.agent) throw new Error("Not initialized");
    return this.cache.size;
  }

  async getSyncStatus(): Promise<{
    lastSynced: Date | null;
    isSyncing: boolean;
    error?: string;
  }> {
    return {
      lastSynced: new Date(),
      isSyncing: false,
    };
  }

  async refreshCache(): Promise<void> {
    await this.loadFromServer();
  }
}
