import { AppBskyFeedDefs, BskyAgent } from "@atproto/api";
import { Bookmark, BookmarkStorageBackend } from "./types";

const BOOKMARK_COLLECTION = "com.shadowsky.bookmark";

export class CustomRecordBackend implements BookmarkStorageBackend {
  type = "custom" as const;
  private agent: BskyAgent;
  private bookmarkCache: Map<string, { uri: string; bookmark: Bookmark }> =
    new Map();

  constructor(agent: BskyAgent) {
    this.agent = agent;
  }

  async init(): Promise<void> {
    console.log("[CustomRecordBackend] Initializing...");
    console.log("[CustomRecordBackend] Agent session:", this.agent.session);
    console.log("[CustomRecordBackend] Agent DID:", this.agent.session?.did);
    console.log("[CustomRecordBackend] Agent handle:", this.agent.session?.handle);
    // Load existing bookmarks into cache
    await this.loadBookmarksFromRepo();
  }

  private async loadBookmarksFromRepo(): Promise<void> {
    this.bookmarkCache.clear();
    console.log("[CustomRecordBackend] Loading bookmarks from repo...");
    console.log("[CustomRecordBackend] Collection:", BOOKMARK_COLLECTION);
    console.log("[CustomRecordBackend] Repo DID:", this.agent.session?.did);

    try {
      let cursor: string | undefined;

      let totalLoaded = 0;

      do {
        console.log("[CustomRecordBackend] Fetching records...", { cursor });
        const { data } = await this.agent.com.atproto.repo.listRecords({
          repo: this.agent.session!.did,
          collection: BOOKMARK_COLLECTION,
          cursor,
          limit: 100,
        });
        console.log(
          "[CustomRecordBackend] Fetched records:",
          data.records.length,
        );

        for (const record of data.records) {
          const bookmarkRecord = record.value as any;
          console.log("[CustomRecordBackend] Processing record:", {
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

      console.log("[CustomRecordBackend] Total bookmarks loaded:", totalLoaded);
    } catch (error: any) {
      console.error(
        "[CustomRecordBackend] Failed to load bookmarks from repo:",
        error,
      );
      console.error("[CustomRecordBackend] Error details:", {
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
    console.log("[CustomRecordBackend] Creating bookmark record:", {
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
    console.log("[CustomRecordBackend] Removing bookmark:", { postUri, rkey });

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
    console.log(
      "[CustomRecordBackend] getAllBookmarks returning:",
      bookmarks.length,
      "bookmarks",
    );
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
