import { AppBskyFeedDefs, BskyAgent } from "@atproto/api";
import { createLogger } from "../utils/logger";
import { Bookmark } from "./bookmark-backends/types";
import { bookmarkServiceV2 } from "./bookmark-service-v2";

const logger = createLogger("BookmarkServiceWrapper");

/**
 * Initialize the bookmark service with the authenticated agent.
 * BookmarkServiceV2 uses only the official AT Protocol bookmarks API.
 */
export async function initializeBookmarkService(agent: BskyAgent) {
  try {
    logger.log(
      "Initializing bookmark service with official AT Protocol storage",
    );

    // Initialize the bookmark service with the agent
    await bookmarkServiceV2.init(agent);

    logger.log("Bookmark service successfully initialized");

    // Initialize the bookmark store now that the service is ready
    try {
      const { initializeBookmarkStore } = await import("../hooks/useBookmarks");
      await initializeBookmarkStore();
    } catch (error) {
      logger.log("Failed to initialize bookmark store:", error);
    }
  } catch (error) {
    logger.error("Failed to initialize bookmark service:", error);
    throw error;
  }
}

/**
 * Re-initialize the bookmark service and refresh the cache
 */
export async function reinitializeBookmarkService() {
  const agent = bookmarkServiceV2.agent;

  if (!agent) {
    logger.log("No agent available, skipping reinitialization");
    return;
  }

  try {
    logger.log("Reinitializing bookmark service...");

    // Refresh the cache to ensure we have the latest data
    await bookmarkServiceV2.refreshCache();
    logger.log("Reinitialization complete");

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
  },

  async toggleBookmark(post: AppBskyFeedDefs.PostView) {
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

  async importBookmarks(bookmarks: Bookmark[]) {
    return bookmarkServiceV2.importBookmarks(bookmarks);
  },

  async clearAllBookmarks() {
    return bookmarkServiceV2.clearAllBookmarks();
  },

  async removeBookmark(postUri: string) {
    return bookmarkServiceV2.removeBookmark(postUri);
  },
};
