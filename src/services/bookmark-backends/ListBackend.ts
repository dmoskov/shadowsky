import { AppBskyFeedDefs, BskyAgent } from "@atproto/api";
import { Bookmark, BookmarkStorageBackend } from "./types";

const BOOKMARK_LIST_NAME = "📌 Bookmarks";
const BOOKMARK_LIST_DESCRIPTION =
  "Posts I've bookmarked (managed by ShadowSky)";

export class ListBackend implements BookmarkStorageBackend {
  type = "list" as const;
  private agent: BskyAgent;
  private listUri: string | null = null;
  private bookmarkCache: Map<string, Bookmark> = new Map();

  constructor(agent: BskyAgent) {
    this.agent = agent;
  }

  async init(): Promise<void> {
    // Find or create the bookmarks list
    await this.findOrCreateList();
    // Load existing bookmarks into cache
    await this.loadBookmarksFromList();
  }

  private async findOrCreateList(): Promise<void> {
    // Get all lists
    const { data } = await this.agent.app.bsky.graph.getLists({
      actor: this.agent.session!.did,
    });

    // Find bookmark list
    const bookmarkList = data.lists.find(
      (list) => list.name === BOOKMARK_LIST_NAME,
    );

    if (bookmarkList) {
      this.listUri = bookmarkList.uri;
    } else {
      // Create new list
      const result = await this.agent.app.bsky.graph.list.create(
        { repo: this.agent.session!.did },
        {
          name: BOOKMARK_LIST_NAME,
          description: BOOKMARK_LIST_DESCRIPTION,
          purpose: "app.bsky.graph.defs#curatelist",
          createdAt: new Date().toISOString(),
        },
      );
      this.listUri = result.uri;
    }
  }

  private async loadBookmarksFromList(): Promise<void> {
    if (!this.listUri) return;

    let cursor: string | undefined;
    this.bookmarkCache.clear();

    do {
      const { data } = await this.agent.app.bsky.graph.getList({
        list: this.listUri,
        cursor,
        limit: 100,
      });

      for (const item of data.items) {
        if (item.subject.$type === "app.bsky.feed.defs#postView") {
          const post = item.subject as AppBskyFeedDefs.PostView;
          const bookmark: Bookmark = {
            id: post.uri,
            postUri: post.uri,
            postCid: post.cid,
            savedAt: new Date().toISOString(), // We don't have exact time from list
            author: {
              did: post.author.did,
              handle: post.author.handle,
              displayName: post.author.displayName,
              avatar: post.author.avatar,
            },
            text: (post.record as any)?.text || "",
          };
          this.bookmarkCache.set(post.uri, bookmark);
        }
      }

      cursor = data.cursor;
    } while (cursor);
  }

  async addBookmark(
    post: AppBskyFeedDefs.PostView,
    notes?: string,
  ): Promise<Bookmark> {
    if (!this.listUri) throw new Error("List not initialized");

    // Add to list
    await this.agent.app.bsky.graph.listitem.create(
      { repo: this.agent.session!.did },
      {
        list: this.listUri,
        subject: post.uri,
        createdAt: new Date().toISOString(),
      },
    );

    // Create bookmark object
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
      notes, // Note: notes won't persist in list backend
    };

    this.bookmarkCache.set(post.uri, bookmark);
    return bookmark;
  }

  async removeBookmark(postUri: string): Promise<void> {
    if (!this.listUri) throw new Error("List not initialized");

    // Find the list item record
    const { data } = await this.agent.app.bsky.graph.getList({
      list: this.listUri,
      cursor: undefined,
      limit: 100,
    });

    for (const item of data.items) {
      if (item.subject.$type === "app.bsky.feed.defs#postView") {
        const post = item.subject as AppBskyFeedDefs.PostView;
        if (post.uri === postUri && item.uri) {
          // Delete the list item
          const [, , rkey] = item.uri.split("/").slice(-3);
          await this.agent.app.bsky.graph.listitem.delete({
            repo: this.agent.session!.did,
            rkey,
          });
          this.bookmarkCache.delete(postUri);
          return;
        }
      }
    }
  }

  async getBookmark(postUri: string): Promise<Bookmark | null> {
    return this.bookmarkCache.get(postUri) || null;
  }

  async getAllBookmarks(): Promise<Bookmark[]> {
    return Array.from(this.bookmarkCache.values());
  }

  async isBookmarked(postUri: string): Promise<boolean> {
    return this.bookmarkCache.has(postUri);
  }

  async clear(): Promise<void> {
    if (!this.listUri) return;

    // Delete all items from the list
    const bookmarks = await this.getAllBookmarks();
    for (const bookmark of bookmarks) {
      await this.removeBookmark(bookmark.postUri);
    }
  }

  async importBookmarks(bookmarks: Bookmark[]): Promise<void> {
    // Clear existing bookmarks
    await this.clear();

    // Add each bookmark
    for (const bookmark of bookmarks) {
      try {
        // Fetch the post to get full data
        const { data } = await this.agent.getPostThread({
          uri: bookmark.postUri,
        });
        if (data.thread.post) {
          await this.addBookmark(data.thread.post as AppBskyFeedDefs.PostView);
        }
      } catch (error) {
        console.error(`Failed to import bookmark ${bookmark.postUri}:`, error);
      }
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
