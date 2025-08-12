import { AppBskyFeedDefs } from "@atproto/api";
import { bookmarkStorage, Bookmark } from "../bookmark-storage-db";
// import { Bookmark, BookmarkStorageBackend } from "./types"; // TODO: Fix missing types file

export class LocalStorageBackend { // implements BookmarkStorageBackend {
  type = "local" as const;

  async init(): Promise<void> {
    await bookmarkStorage.init();
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

    await bookmarkStorage.addBookmark(bookmark);
    return bookmark;
  }

  async removeBookmark(postUri: string): Promise<void> {
    await bookmarkStorage.removeBookmark(postUri);
  }

  async getBookmark(postUri: string): Promise<Bookmark | null> {
    const bookmarks = await bookmarkStorage.getAllBookmarks();
    return bookmarks.find((b) => b.postUri === postUri) || null;
  }

  async getAllBookmarks(): Promise<Bookmark[]> {
    return bookmarkStorage.getAllBookmarks();
  }

  async isBookmarked(postUri: string): Promise<boolean> {
    return bookmarkStorage.isBookmarked(postUri);
  }

  async clear(): Promise<void> {
    await bookmarkStorage.clearAllBookmarks();
  }

  async importBookmarks(bookmarks: Bookmark[]): Promise<void> {
    await bookmarkStorage.clearAllBookmarks();
    for (const bookmark of bookmarks) {
      await bookmarkStorage.addBookmark(bookmark);
    }
  }

  async exportBookmarks(): Promise<Bookmark[]> {
    return bookmarkStorage.getAllBookmarks();
  }

  async getCount(): Promise<number> {
    const bookmarks = await bookmarkStorage.getAllBookmarks();
    return bookmarks.length;
  }
}
