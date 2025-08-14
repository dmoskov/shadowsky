import { BskyAgent } from "@atproto/api";
import { createLogger } from "../utils/logger";
import { appPreferencesService } from "./app-preferences-service";
import { bookmarkServiceV2 } from "./bookmark-service-v2";

const logger = createLogger("BookmarkServiceWrapper");

/**
 * Initialize the bookmark service with the correct storage type based on user preferences
 */
export async function initializeBookmarkService(agent: BskyAgent) {
  try {
    // Set agent for preferences service
    appPreferencesService.setAgent(agent);

    // Get storage type from PDS record
    const preferences = await appPreferencesService.getPreferences();
    const storageType = preferences?.bookmarkStorageType || "local";

    logger.log(
      `Attempting to initialize bookmark service with ${storageType} storage`,
    );

    // Initialize the bookmark service with the correct storage type
    await bookmarkServiceV2.init(agent, storageType);

    logger.log(
      `Bookmark service successfully initialized with ${storageType} storage`,
    );

    // Initialize the bookmark store now that the service is ready
    // This is imported from useBookmarks hook where the store is defined
    try {
      const { initializeBookmarkStore } = await import("../hooks/useBookmarks");
      await initializeBookmarkStore();
    } catch (error) {
      logger.log("Failed to initialize bookmark store:", error);
    }
  } catch (error) {
    logger.error(
      "Failed to initialize bookmark service with saved storage type:",
      error,
    );
    logger.error("Falling back to local storage");

    // Update preferences to local storage if custom storage fails
    await appPreferencesService.updatePreferences({
      bookmarkStorageType: "local",
    });

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

    // If agent is null (logout), reset to local storage
    if (!agent) {
      bookmarkServiceV2.setStorageType("local").catch((error) => {
        logger.error("Failed to reset to local storage on logout:", error);
      });
    }
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
