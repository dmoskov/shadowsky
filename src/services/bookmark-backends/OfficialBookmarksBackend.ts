import { AppBskyFeedDefs, AtpAgent } from "@atproto/api";
import { createLogger } from "../../utils/logger";
import { Bookmark, BookmarkStorageBackend } from "./types";

const logger = createLogger("OfficialBookmarksBackend");

// Official bookmark record structure
interface BookmarkRecord {
  subject: {
    uri: string;
    cid: string;
  };
  createdAt: string;
}

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

      // List all bookmarks
      const response = await this.agent.com.atproto.repo.listRecords({
        repo: this.agent.session!.did,
        collection: "app.bsky.actor.savedPosts",
        limit: 100,
      });

      // Collect all URIs to fetch posts in batch
      const bookmarkRecordMap = new Map<
        string,
        (typeof response.data.records)[0]
      >();
      const uris: string[] = [];

      for (const record of response.data.records) {
        const bookmarkRecord = record.value as unknown as BookmarkRecord;
        bookmarkRecordMap.set(bookmarkRecord.subject.uri, record);
        uris.push(bookmarkRecord.subject.uri);
      }

      // Fetch posts in batches
      const batchSize = 25;
      for (let i = 0; i < uris.length; i += batchSize) {
        const batch = uris.slice(i, i + batchSize);

        try {
          const postsResponse = await this.agent.app.bsky.feed.getPosts({
            uris: batch,
          });

          for (const post of postsResponse.data.posts) {
            const record = bookmarkRecordMap.get(post.uri);
            if (!record) continue;

            const bookmarkRecord = record.value as unknown as BookmarkRecord;
            const bookmark: Bookmark = {
              id: post.uri,
              postUri: post.uri,
              postCid: post.cid,
              savedAt: bookmarkRecord.createdAt,
              author: {
                did: post.author.did,
                handle: post.author.handle,
                displayName: post.author.displayName,
                avatar: post.author.avatar,
              },
              text: (post.record as any)?.text || "",
            };

            this.cache.set(bookmark.postUri, bookmark);
            this.bookmarkRecords.set(bookmark.postUri, {
              uri: record.uri,
              cid: record.cid,
            });
          }
        } catch (error) {
          logger.error(`Failed to fetch posts batch:`, error);
          // Continue with next batch
        }
      }

      logger.log(`Loaded ${this.cache.size} bookmarks from server`);
    } catch (error) {
      logger.error("Failed to load bookmarks from server:", error);
      // Don't throw - we can still work with empty cache
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
      // Create the bookmark record
      const record: BookmarkRecord = {
        subject: {
          uri: post.uri,
          cid: post.cid,
        },
        createdAt: new Date().toISOString(),
      };

      const response = await this.agent.com.atproto.repo.createRecord({
        repo: this.agent.session!.did,
        collection: "app.bsky.actor.savedPosts",
        record: record as unknown as Record<string, unknown>,
      });

      // Store in cache
      this.cache.set(bookmark.postUri, bookmark);
      this.bookmarkRecords.set(bookmark.postUri, {
        uri: response.data.uri,
        cid: response.data.cid,
      });

      logger.log("Bookmark added:", bookmark.postUri);
      return bookmark;
    } catch (error) {
      logger.error("Failed to add bookmark:", error);
      throw error;
    }
  }

  async removeBookmark(postUri: string): Promise<void> {
    if (!this.agent) throw new Error("Not initialized");

    try {
      const bookmarkRecord = this.bookmarkRecords.get(postUri);
      if (!bookmarkRecord) {
        // Not in our cache, try to find it on server
        const response = await this.agent.com.atproto.repo.listRecords({
          repo: this.agent.session!.did,
          collection: "app.bsky.actor.savedPosts",
          limit: 100,
        });

        const record = response.data.records.find(
          (r) => (r.value as unknown as BookmarkRecord).subject.uri === postUri,
        );

        if (record) {
          await this.agent.com.atproto.repo.deleteRecord({
            repo: this.agent.session!.did,
            collection: "app.bsky.actor.savedPosts",
            rkey: record.uri.split("/").pop()!,
          });
        }
      } else {
        // Delete using cached record info
        await this.agent.com.atproto.repo.deleteRecord({
          repo: this.agent.session!.did,
          collection: "app.bsky.actor.savedPosts",
          rkey: bookmarkRecord.uri.split("/").pop()!,
        });
      }

      this.cache.delete(postUri);
      this.bookmarkRecords.delete(postUri);
      logger.log("Bookmark removed:", postUri);
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

    // Check cache first
    if (this.cache.has(postUri)) {
      return true;
    }

    // Double-check with server in case cache is stale
    try {
      const response = await this.agent.com.atproto.repo.listRecords({
        repo: this.agent.session!.did,
        collection: "app.bsky.actor.savedPosts",
        limit: 100,
      });

      return response.data.records.some(
        (r) => (r.value as unknown as BookmarkRecord).subject.uri === postUri,
      );
    } catch (error) {
      logger.error("Failed to check bookmark status:", error);
      return false;
    }
  }

  async clear(): Promise<void> {
    if (!this.agent) throw new Error("Not initialized");

    try {
      // Get all bookmark records
      const response = await this.agent.com.atproto.repo.listRecords({
        repo: this.agent.session!.did,
        collection: "app.bsky.actor.savedPosts",
        limit: 100,
      });

      // Delete each bookmark
      for (const record of response.data.records) {
        await this.agent.com.atproto.repo.deleteRecord({
          repo: this.agent.session!.did,
          collection: "app.bsky.actor.savedPosts",
          rkey: record.uri.split("/").pop()!,
        });
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
