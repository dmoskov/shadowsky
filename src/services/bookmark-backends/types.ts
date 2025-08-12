import { AppBskyFeedDefs } from "@atproto/api";

export interface Bookmark {
  id: string;
  postUri: string;
  postCid: string;
  savedAt: string;
  author: {
    did: string;
    handle: string;
    displayName?: string;
    avatar?: string;
  };
  text: string;
  tags?: string[];
  notes?: string;
}

export interface BookmarkStorageBackend {
  type: "local" | "custom";

  // Initialize the backend
  init(): Promise<void>;

  // CRUD operations
  addBookmark(
    post: AppBskyFeedDefs.PostView,
    notes?: string,
  ): Promise<Bookmark>;
  removeBookmark(postUri: string): Promise<void>;
  getBookmark(postUri: string): Promise<Bookmark | null>;
  getAllBookmarks(): Promise<Bookmark[]>;
  isBookmarked(postUri: string): Promise<boolean>;

  // Bulk operations
  clear(): Promise<void>;
  importBookmarks(bookmarks: Bookmark[]): Promise<void>;
  exportBookmarks(): Promise<Bookmark[]>;

  // Get count without loading all bookmarks
  getCount(): Promise<number>;

  // Sync status for remote backends
  getSyncStatus?(): Promise<{
    lastSynced: Date | null;
    isSyncing: boolean;
    error?: string;
  }>;
}
