import { AppBskyFeedDefs, BskyAgent } from "@atproto/api";
import { createLogger } from "../../utils/logger";
import { Bookmark, BookmarkStorageBackend } from "./types";

const BOOKMARK_COLLECTION = "com.shadowsky.bookmark";

const logger = createLogger("CustomRecordBackend");

export class CustomRecordBackend implements BookmarkStorageBackend {
  type = "custom" as const;
  private agent: BskyAgent;
  private bookmarkCache: Map<string, { uri: string; bookmark: Bookmark }> =
    new Map();

  constructor(agent: BskyAgent) {
    this.agent = agent;
  }

  async init(): Promise<void> {
    logger.log("Initializing...");
    logger.log("Agent session:", this.agent.session);
    logger.log("Agent DID:", this.agent.session?.did);
    logger.log("Agent handle:", this.agent.session?.handle);
    // Load existing bookmarks into cache
    await this.loadBookmarksFromRepo();
  }

  private async loadBookmarksFromRepo(): Promise<void> {
    this.bookmarkCache.clear();
    logger.log("Loading bookmarks from repo...");
    logger.log("Collection:", BOOKMARK_COLLECTION);
    logger.log("Repo DID:", this.agent.session?.did);

    try {
      let cursor: string | undefined;

      let totalLoaded = 0;

      do {
        logger.log("Fetching records...", { cursor });
        const { data } = await this.agent.com.atproto.repo.listRecords({
          repo: this.agent.session!.did,
          collection: BOOKMARK_COLLECTION,
          cursor,
          limit: 100,
        });
        logger.log("Fetched records:", data.records.length);

        for (const record of data.records) {
          const bookmarkRecord = record.value as any;
          logger.log("Processing record:", {
            uri: record.uri,
            postUri: bookmarkRecord.postUri,
            savedAt: bookmarkRecord.savedAt,
          });
          const bookmark: Bookmark = {
            id: bookmarkRecord.postUri,
            postUri: bookmarkRecord.postUri,
            postCid: bookmarkRecord.postCid,
            savedAt: bookmarkRecord.savedAt,
            author: bookmarkRecord.author,
            text: bookmarkRecord.text,
            tags: bookmarkRecord.tags,
            notes: bookmarkRecord.notes,
          };
          this.bookmarkCache.set(bookmark.postUri, {
            uri: record.uri,
            bookmark,
          });
        }

        totalLoaded += data.records.length;
        cursor = data.cursor;
      } while (cursor);

      logger.log("Total bookmarks loaded:", totalLoaded);
    } catch (error: any) {
      logger.error("Failed to load bookmarks from repo:", error);
      logger.error("Error details:", {
        status: error?.status,
        message: error?.message,
        error: error?.error,
      });
      // Collection might not exist yet, that's okay
      if (error?.status !== 400) {
        throw error;
      }
    }
  }

  async addBookmark(
    post: AppBskyFeedDefs.PostView,
    notes?: string,
  ): Promise<Bookmark> {
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

    // Generate a stable rkey from the post URI
    const rkey = this.generateRkey(bookmark.postUri);

    // Create the record
    logger.log("Creating bookmark record:", {
      postUri: bookmark.postUri,
      collection: BOOKMARK_COLLECTION,
      repo: this.agent.session?.did,
      rkey,
    });
    const result = await this.agent.com.atproto.repo.createRecord({
      repo: this.agent.session!.did,
      collection: BOOKMARK_COLLECTION,
      rkey,
      record: {
        $type: BOOKMARK_COLLECTION,
        postUri: bookmark.postUri,
        postCid: bookmark.postCid,
        savedAt: bookmark.savedAt,
        author: bookmark.author,
        text: bookmark.text,
        tags: bookmark.tags,
        notes: bookmark.notes,
        createdAt: new Date().toISOString(),
      },
    });

    this.bookmarkCache.set(bookmark.postUri, {
      uri: (result as any).uri,
      bookmark,
    });
    return bookmark;
  }

  async removeBookmark(postUri: string): Promise<void> {
    const cached = this.bookmarkCache.get(postUri);
    if (!cached) return;

    // Use the same rkey generation method
    const rkey = this.generateRkey(postUri);
    logger.log("Removing bookmark:", { postUri, rkey });

    await this.agent.com.atproto.repo.deleteRecord({
      repo: this.agent.session!.did,
      collection: BOOKMARK_COLLECTION,
      rkey,
    });

    this.bookmarkCache.delete(postUri);
  }

  async getBookmark(postUri: string): Promise<Bookmark | null> {
    const cached = this.bookmarkCache.get(postUri);
    return cached?.bookmark || null;
  }

  async getAllBookmarks(): Promise<Bookmark[]> {
    const bookmarks = Array.from(this.bookmarkCache.values()).map(
      ({ bookmark }) => bookmark,
    );
    logger.log("getAllBookmarks returning:", bookmarks.length, "bookmarks");
    return bookmarks;
  }

  async isBookmarked(postUri: string): Promise<boolean> {
    return this.bookmarkCache.has(postUri);
  }

  async clear(): Promise<void> {
    const bookmarks = Array.from(this.bookmarkCache.values());

    for (const { uri } of bookmarks) {
      const [, , rkey] = uri.split("/").slice(-3);
      await this.agent.com.atproto.repo.deleteRecord({
        repo: this.agent.session!.did,
        collection: BOOKMARK_COLLECTION,
        rkey,
      });
    }

    this.bookmarkCache.clear();
  }

  async importBookmarks(bookmarks: Bookmark[]): Promise<void> {
    // Clear existing bookmarks
    await this.clear();

    // Add each bookmark
    for (const bookmark of bookmarks) {
      // Use stable rkey for imports too
      const rkey = this.generateRkey(bookmark.postUri);

      const result = await this.agent.com.atproto.repo.createRecord({
        repo: this.agent.session!.did,
        collection: BOOKMARK_COLLECTION,
        rkey,
        record: {
          $type: BOOKMARK_COLLECTION,
          postUri: bookmark.postUri,
          postCid: bookmark.postCid,
          savedAt: bookmark.savedAt,
          author: bookmark.author,
          text: bookmark.text,
          tags: bookmark.tags,
          notes: bookmark.notes,
          createdAt: new Date().toISOString(),
        },
      });

      this.bookmarkCache.set(bookmark.postUri, {
        uri: (result as any).uri,
        bookmark,
      });
    }
  }

  async exportBookmarks(): Promise<Bookmark[]> {
    return this.getAllBookmarks();
  }

  async getCount(): Promise<number> {
    return this.bookmarkCache.size;
  }

  async getSyncStatus() {
    return {
      lastSynced: new Date(),
      isSyncing: false,
    };
  }

  private generateRkey(postUri: string): string {
    // Create a stable rkey from the post URI
    // Extract the last part of the URI which is unique per post
    const parts = postUri.split("/");
    const postId = parts[parts.length - 1];

    // Use a prefix to avoid collisions with other record types
    return `bookmark-${postId}`;
  }
}
