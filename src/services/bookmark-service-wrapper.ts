import { BskyAgent } from "@atproto/api";
import { bookmarkServiceV2 } from "./bookmark-service-v2";

/**
 * Initialize the bookmark service with the correct storage type based on user preferences
 */
export async function initializeBookmarkService(agent: BskyAgent) {
  try {
    // Get storage type from localStorage since custom preferences
    // outside app.bsky namespace aren't supported
    const storageType =
      (localStorage.getItem("bookmarkStorageType") as "local" | "custom") ||
      "local";

    console.log(
      `Attempting to initialize bookmark service with ${storageType} storage`,
    );

    // Initialize the bookmark service with the correct storage type
    await bookmarkServiceV2.init(agent, storageType);

    console.log(
      `Bookmark service successfully initialized with ${storageType} storage`,
    );
  } catch (error) {
    console.error(
      "Failed to initialize bookmark service with saved storage type:",
      error,
    );
    console.error("Falling back to local storage");

    // Reset to local storage if custom storage fails
    localStorage.setItem("bookmarkStorageType", "local");

    // Fall back to local storage
    await bookmarkServiceV2.init(agent, "local");
  }
}

/**
 * Re-export the service for backward compatibility
 */
export const bookmarkService = {
  setAgent(agent: BskyAgent | null) {
    bookmarkServiceV2.setAgent(agent);
  },

  async toggleBookmark(post: any) {
    return bookmarkServiceV2.toggleBookmark(post);
  },

  async isPostBookmarked(postUri: string) {
    return bookmarkServiceV2.isPostBookmarked(postUri);
  },

  async getBookmarkedPosts(limit?: number, offset?: number) {
    return bookmarkServiceV2.getBookmarkedPosts(limit, offset);
  },

  async getBookmarkCount() {
    return bookmarkServiceV2.getBookmarkCount();
  },

  async searchBookmarks(query: string) {
    return bookmarkServiceV2.searchBookmarks(query);
  },

  async exportBookmarks() {
    return bookmarkServiceV2.exportBookmarks();
  },

  async importBookmarks(bookmarks: any[]) {
    return bookmarkServiceV2.importBookmarks(bookmarks);
  },

  async clearAllBookmarks() {
    return bookmarkServiceV2.clearAllBookmarks();
  },

  async removeBookmark(postUri: string) {
    return bookmarkServiceV2.removeBookmark(postUri);
  },
};
