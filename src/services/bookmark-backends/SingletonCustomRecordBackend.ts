import { AppBskyFeedDefs, BskyAgent } from "@atproto/api";
import { createLogger } from "../../utils/logger";
import { AT_PROTO_RETRY_OPTIONS, retryWithBackoff } from "../../utils/retry";
import { ShadowSkyBookmarks } from "../app-preferences-service";
import {
  AT_PROTO_COLLECTIONS,
  AT_PROTO_RKEYS,
} from "../storage/storage-constants";
import { Bookmark, BookmarkStorageBackend } from "./types";

const logger = createLogger("SingletonCustomRecordBackend");

export class SingletonCustomRecordBackend implements BookmarkStorageBackend {
  type = "custom" as const;
  private agent: BskyAgent;
  private bookmarkCache: Map<string, Bookmark> = new Map();
  private errorCallback?: (error: Error, action: string) => void;
  private recordUri?: string;

  constructor(agent: BskyAgent) {
    this.agent = agent;
  }

  setErrorCallback(callback: (error: Error, action: string) => void) {
    this.errorCallback = callback;
  }

  private handleError(error: any, action: string): void {
    if (this.errorCallback) {
      this.errorCallback(error, action);
    } else {
      logger.error(`Failed to ${action}:`, error);
    }
  }

  async init(): Promise<void> {
    logger.log("Initializing singleton bookmark backend...");
    await this.loadBookmarksFromRepo();
  }

  async refreshCache(): Promise<void> {
    logger.log("Refreshing bookmark cache from AT Protocol...");
    await this.loadBookmarksFromRepo();
  }

  private async loadBookmarksFromRepo(): Promise<void> {
    this.bookmarkCache.clear();

    try {
      const did = this.agent.session?.did;
      if (!did) {
        throw new Error("No DID available");
      }

      // Try to get the singleton bookmarks record with retry
      const response = await retryWithBackoff(
        () =>
          this.agent.api.com.atproto.repo.getRecord({
            repo: did,
            collection: AT_PROTO_COLLECTIONS.BOOKMARKS,
            rkey: AT_PROTO_RKEYS.BOOKMARKS,
          }),
        AT_PROTO_RETRY_OPTIONS,
      );

      if (response.data.value) {
        const bookmarksData = response.data
          .value as unknown as ShadowSkyBookmarks;
        this.recordUri = response.data.uri;

        // Load all bookmarks into cache, converting from storage format to Bookmark interface
        bookmarksData.bookmarks.forEach((storedBookmark, index) => {
          const bookmark: Bookmark = {
            id: `${storedBookmark.uri}-${index}`, // Generate ID if not stored
            postUri: storedBookmark.uri,
            postCid: storedBookmark.cid,
            savedAt: storedBookmark.bookmarkedAt,
            author: storedBookmark.author,
            text: storedBookmark.text,
          };
          this.bookmarkCache.set(bookmark.postUri, bookmark);
        });

        logger.log(
          `Loaded ${bookmarksData.bookmarks.length} bookmarks from AT Protocol`,
        );
      }
    } catch (error: any) {
      if (error?.status === 400) {
        // Record doesn't exist yet, which is normal for new users
        logger.log(
          "No bookmarks record found (400 error), will create on first save",
        );
      } else {
        this.handleError(error, "load bookmarks");
      }
    }
  }

  async getAllBookmarks(): Promise<Bookmark[]> {
    return Array.from(this.bookmarkCache.values()).sort(
      (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime(),
    );
  }

  async getBookmark(postUri: string): Promise<Bookmark | null> {
    const bookmark = this.bookmarkCache.get(postUri);
    return bookmark || null;
  }

  async addBookmark(
    post: AppBskyFeedDefs.PostView,
    notes?: string,
  ): Promise<Bookmark> {
    const bookmark: Bookmark = {
      id: `${post.uri}-${Date.now()}`, // Generate unique ID
      postUri: post.uri,
      postCid: post.cid,
      author: {
        did: post.author.did,
        handle: post.author.handle,
        displayName: post.author.displayName,
        avatar: post.author.avatar,
      },
      text: (post.record as any).text || "",
      savedAt: new Date().toISOString(),
      notes: notes,
    };

    // Add to cache
    this.bookmarkCache.set(post.uri, bookmark);

    // Save to AT Protocol
    await this.saveBookmarks();

    return bookmark;
  }

  async removeBookmark(postUri: string): Promise<void> {
    // Remove from cache
    this.bookmarkCache.delete(postUri);

    // Save to AT Protocol
    await this.saveBookmarks();
  }

  async isBookmarked(postUri: string): Promise<boolean> {
    return this.bookmarkCache.has(postUri);
  }

  async getCount(): Promise<number> {
    return this.bookmarkCache.size;
  }

  async clear(): Promise<void> {
    this.bookmarkCache.clear();
    await this.saveBookmarks();
  }

  async exportBookmarks(): Promise<Bookmark[]> {
    return await this.getAllBookmarks();
  }

  async importBookmarks(bookmarks: Bookmark[]): Promise<void> {
    // Clear existing and import new
    this.bookmarkCache.clear();
    bookmarks.forEach((bookmark) => {
      this.bookmarkCache.set(bookmark.postUri, bookmark);
    });

    await this.saveBookmarks();
  }

  private async saveBookmarks(): Promise<void> {
    try {
      const did = this.agent.session?.did;
      if (!did) {
        throw new Error("No DID available");
      }

      const bookmarksData: ShadowSkyBookmarks = {
        $type: AT_PROTO_COLLECTIONS.BOOKMARKS,
        bookmarks: Array.from(this.bookmarkCache.values()).map((bookmark) => ({
          uri: bookmark.postUri,
          cid: bookmark.postCid,
          author: bookmark.author,
          text: bookmark.text,
          createdAt: bookmark.savedAt, // Use savedAt as createdAt for now
          bookmarkedAt: bookmark.savedAt,
        })),
        version: 1,
      };

      if (this.recordUri) {
        // Update existing record with retry
        await retryWithBackoff(
          () =>
            this.agent.api.com.atproto.repo.putRecord({
              repo: did,
              collection: AT_PROTO_COLLECTIONS.BOOKMARKS,
              rkey: AT_PROTO_RKEYS.BOOKMARKS,
              record: bookmarksData as any,
            }),
          AT_PROTO_RETRY_OPTIONS,
        );
      } else {
        // Create new record with retry
        const response = await retryWithBackoff(
          () =>
            this.agent.api.com.atproto.repo.createRecord({
              repo: did,
              collection: AT_PROTO_COLLECTIONS.BOOKMARKS,
              rkey: AT_PROTO_RKEYS.BOOKMARKS,
              record: bookmarksData as any,
            }),
          AT_PROTO_RETRY_OPTIONS,
        );
        this.recordUri = response.data.uri;
      }

      logger.log(`Saved ${this.bookmarkCache.size} bookmarks to AT Protocol`);
    } catch (error) {
      this.handleError(error, "save bookmarks");
      throw error;
    }
  }
}
