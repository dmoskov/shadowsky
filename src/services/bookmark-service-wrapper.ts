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
    await bookmarkServiceV2.init(
      agent,
      storageType as "local" | "custom" | "official",
    );

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
 * Re-initialize the bookmark service to check for storage preference changes
 */
export async function reinitializeBookmarkService() {
  const agent = bookmarkServiceV2.agent;

  if (!agent) {
    logger.log("No agent available, skipping reinitialization");
    return;
  }

  try {
    // Get current preferences - this will check localStorage first for forceLocalStorage flag
    const preferences = await appPreferencesService.getPreferences();
    const storageType = preferences?.bookmarkStorageType || "local";
    const currentStorageType = bookmarkServiceV2.getStorageType();

    logger.log(`Reinitializing bookmark service...`);
    logger.log(
      `Current storage: ${currentStorageType}, Preferred storage: ${storageType}`,
    );
    logger.log(`Preferences:`, preferences);

    // Only reinitialize if storage type has changed
    if (currentStorageType !== storageType) {
      logger.log(
        `Storage type changed from ${currentStorageType} to ${storageType}, reinitializing...`,
      );
      await bookmarkServiceV2.init(
        agent,
        storageType as "local" | "custom" | "official",
      );

      // Refresh the cache to ensure we have the latest data
      await bookmarkServiceV2.refreshCache();
      logger.log(`Reinitialization complete`);
    } else {
      // Even if storage type hasn't changed, refresh the cache
      logger.log(`Storage type unchanged, refreshing cache...`);
      await bookmarkServiceV2.refreshCache();
    }

    // Log bookmark count after refresh
    const count = await bookmarkServiceV2.getBookmarkCount();
    logger.log(`Bookmark count after refresh: ${count}`);
  } catch (error) {
    logger.error("Failed to reinitialize bookmark service:", error);
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
