import { AppBskyFeedDefs, AtpAgent } from "@atproto/api";
import { createLogger } from "../../utils/logger";
import { Bookmark, BookmarkStorageBackend } from "./types";

const logger = createLogger("OfficialBookmarksBackend");

// Interface for future official bookmark API response
// interface OfficialBookmark {
//   uri: string;
//   cid: string;
//   createdAt: string;
// }

export class OfficialBookmarksBackend implements BookmarkStorageBackend {
  type = "official" as const;
  private agent: AtpAgent | null = null;
  private cache: Map<string, Bookmark> = new Map();
  // private isInitialized = false;

  async init(): Promise<void> {
    // Agent must be set separately via setAgent method
    if (!this.agent) {
      throw new Error("AT Protocol agent is required for official bookmarks");
    }
    await this.loadFromServer();
    // this.isInitialized = true;
  }

  setAgent(agent: AtpAgent): void {
    this.agent = agent;
  }

  private async loadFromServer(): Promise<void> {
    if (!this.agent) return;

    try {
      // TODO: Replace with actual official bookmarks API endpoint
      // For now, we'll prepare the structure but can't fetch anything
      logger.log("Official bookmarks API not yet available");
      this.cache.clear();
    } catch (error) {
      logger.error("Failed to load bookmarks from server:", error);
      throw error;
    }
  }

  async addBookmark(
    post: AppBskyFeedDefs.PostView,
    notes?: string,
  ): Promise<Bookmark> {
    if (!this.agent) throw new Error("Not initialized");

    const bookmark: Bookmark = {
      id: post.uri,
      postUri: post.uri,
      postCid: post.cid,
      savedAt: new Date().toISOString(),
      author: {
        did: post.author.did,
        handle: post.author.handle,
        displayName: post.author.displayName,
        avatar: post.author.avatar,
      },
      text: (post.record as any)?.text || "",
      notes,
    };

    try {
      // TODO: Replace with actual official bookmarks API call
      // Expected format: await this.agent.app.bsky.actor.bookmark.create({ uri: post.uri })

      // For now, store in cache to maintain interface compatibility
      this.cache.set(bookmark.postUri, bookmark);
      logger.log("Bookmark would be added via official API:", bookmark.postUri);

      return bookmark;
    } catch (error) {
      logger.error("Failed to add bookmark:", error);
      throw error;
    }
  }

  async removeBookmark(postUri: string): Promise<void> {
    if (!this.agent) throw new Error("Not initialized");

    try {
      // TODO: Replace with actual official bookmarks API call
      // Expected format: await this.agent.app.bsky.actor.bookmark.delete({ uri: postUri })

      this.cache.delete(postUri);
      logger.log("Bookmark would be removed via official API:", postUri);
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
      // TODO: Replace with actual official bookmarks API call
      // Expected format: await this.agent.app.bsky.actor.bookmark.list()

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

    // TODO: This might need an API call to check server state
    return this.cache.has(postUri);
  }

  async clear(): Promise<void> {
    if (!this.agent) throw new Error("Not initialized");

    try {
      // TODO: This would need to delete all bookmarks via API
      // Might need to fetch all first, then delete one by one

      const allBookmarks = Array.from(this.cache.values());
      for (const bookmark of allBookmarks) {
        await this.removeBookmark(bookmark.postUri);
      }
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
