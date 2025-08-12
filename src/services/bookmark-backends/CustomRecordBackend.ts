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
    // Load existing bookmarks into cache
    await this.loadBookmarksFromRepo();
  }

  private async loadBookmarksFromRepo(): Promise<void> {
    this.bookmarkCache.clear();

    try {
      let cursor: string | undefined;

      do {
        const { data } = await this.agent.com.atproto.repo.listRecords({
          repo: this.agent.session!.did,
          collection: BOOKMARK_COLLECTION,
          cursor,
          limit: 100,
        });

        for (const record of data.records) {
          const bookmarkRecord = record.value as any;
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

        cursor = data.cursor;
      } while (cursor);
    } catch (error: any) {
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

    // Create the record
    const result = await this.agent.com.atproto.repo.createRecord({
      repo: this.agent.session!.did,
      collection: BOOKMARK_COLLECTION,
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

    this.bookmarkCache.set(bookmark.postUri, { uri: result.uri, bookmark });
    return bookmark;
  }

  async removeBookmark(postUri: string): Promise<void> {
    const cached = this.bookmarkCache.get(postUri);
    if (!cached) return;

    // Extract rkey from URI
    const [, , rkey] = cached.uri.split("/").slice(-3);

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
    return Array.from(this.bookmarkCache.values()).map(
      ({ bookmark }) => bookmark,
    );
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
      const result = await this.agent.com.atproto.repo.createRecord({
        repo: this.agent.session!.did,
        collection: BOOKMARK_COLLECTION,
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

      this.bookmarkCache.set(bookmark.postUri, { uri: result.uri, bookmark });
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
}
