import { AppBskyFeedDefs, BskyAgent } from "@atproto/api";
import {
  bookmarkStorage,
  type Bookmark,
  type BookmarkPost,
} from "./bookmark-storage-db";
import { PostCacheService } from "./post-cache-service";

class BookmarkService {
  private agent: BskyAgent | null = null;
  private postCacheService = PostCacheService.getInstance();

  async init() {
    await this.postCacheService.init();
  }

  setAgent(agent: BskyAgent | null) {
    this.agent = agent;
  }

  async toggleBookmark(post: AppBskyFeedDefs.PostView): Promise<boolean> {
    const isCurrentlyBookmarked = await bookmarkStorage.isBookmarked(post.uri);

    if (isCurrentlyBookmarked) {
      await bookmarkStorage.removeBookmark(post.uri);
      return false;
    } else {
      const bookmark: Bookmark = {
        id: `bookmark-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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
      };

      await bookmarkStorage.addBookmark(bookmark);

      // Cache the full post data
      await this.postCacheService.cachePosts([post]);

      return true;
    }
  }

  async getBookmarkedPosts(
    limit?: number,
    offset?: number,
  ): Promise<BookmarkPost[]> {
    const bookmarks = await bookmarkStorage.getAllBookmarks(limit, offset);
    const bookmarkPosts: BookmarkPost[] = [];

    for (const bookmark of bookmarks) {
      let post = await this.postCacheService.getPost(bookmark.postUri);

      // If not in cache and we have an agent, try to fetch it
      if (!post && this.agent) {
        try {
          const response = await this.agent.getPostThread({
            uri: bookmark.postUri,
          });
          if (response.data.thread && "post" in response.data.thread) {
            post = response.data.thread.post;
            await this.postCacheService.cachePosts([post]);
          }
        } catch (error) {
          console.error("Failed to fetch bookmarked post:", error);
        }
      }

      bookmarkPosts.push({
        ...bookmark,
        post,
      });
    }

    return bookmarkPosts;
  }

  async isPostBookmarked(postUri: string): Promise<boolean> {
    return await bookmarkStorage.isBookmarked(postUri);
  }

  async getBookmarkCount(): Promise<number> {
    return await bookmarkStorage.getBookmarkCount();
  }

  async searchBookmarks(query: string): Promise<BookmarkPost[]> {
    const bookmarks = await bookmarkStorage.searchBookmarks(query);
    const bookmarkPosts: BookmarkPost[] = [];

    for (const bookmark of bookmarks) {
      const post = await this.postCacheService.getPost(bookmark.postUri);
      bookmarkPosts.push({
        ...bookmark,
        post,
      });
    }

    return bookmarkPosts;
  }

  async exportBookmarks(): Promise<Bookmark[]> {
    return await bookmarkStorage.exportBookmarks();
  }

  async importBookmarks(bookmarks: Bookmark[]): Promise<void> {
    await bookmarkStorage.importBookmarks(bookmarks);
  }

  async clearAllBookmarks(): Promise<void> {
    await bookmarkStorage.clearAllBookmarks();
  }

  async removeBookmark(postUri: string): Promise<void> {
    await bookmarkStorage.removeBookmark(postUri);
  }
}

export const bookmarkService = new BookmarkService();
