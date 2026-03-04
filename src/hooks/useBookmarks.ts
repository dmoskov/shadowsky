import type { AppBskyFeedDefs } from "@atproto/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useSyncExternalStore } from "react";
import type { SyncStatus } from "../components/SyncStatusBadge";
import { useToast } from "../contexts/ToastContext";
import { bookmarkServiceV2 } from "../services/bookmark-service-v2";

// Sync state tracking for bookmarks
class BookmarkSyncStore {
  private syncStates = new Map<
    string,
    { status: SyncStatus; retryFn?: () => void }
  >();
  private listeners = new Set<() => void>();

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getSnapshot() {
    return this.syncStates;
  }

  getSyncStatus(postUri: string): SyncStatus {
    return this.syncStates.get(postUri)?.status ?? "idle";
  }

  getRetryFn(postUri: string): (() => void) | undefined {
    return this.syncStates.get(postUri)?.retryFn;
  }

  setPending(postUri: string) {
    this.syncStates.set(postUri, { status: "pending" });
    this.notify();
  }

  setSynced(postUri: string) {
    this.syncStates.set(postUri, { status: "synced" });
    this.notify();

    // Auto-clear synced status after animation
    setTimeout(() => {
      if (this.syncStates.get(postUri)?.status === "synced") {
        this.syncStates.delete(postUri);
        this.notify();
      }
    }, 1500);
  }

  setFailed(postUri: string, retryFn?: () => void) {
    this.syncStates.set(postUri, { status: "failed", retryFn });
    this.notify();
  }

  setIdle(postUri: string) {
    this.syncStates.delete(postUri);
    this.notify();
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }
}

const bookmarkSyncStore = new BookmarkSyncStore();

// Global bookmark state store
class BookmarkStore {
  private bookmarks = new Map<string, boolean>();
  private listeners = new Set<() => void>();
  private initialized = false;

  async init() {
    if (this.initialized) return;

    try {
      // bookmarkServiceV2 is initialized in AuthContext
      const bookmarks = await bookmarkServiceV2.getBookmarkedPosts();
      bookmarks.forEach((b) => this.bookmarks.set(b.postUri, true));
      this.initialized = true;
      this.notify();
    } catch (_error) {
      // If PostCacheService is not initialized yet, we'll try again later
      console.debug("BookmarkStore init deferred - service not ready yet");
      this.initialized = false;
    }
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getSnapshot() {
    return this.bookmarks;
  }

  isBookmarked(postUri: string) {
    // Lazy initialization attempt if not initialized
    if (!this.initialized) {
      this.init().catch(() => {
        // Ignore errors - we'll return false for now
      });
    }
    return this.bookmarks.get(postUri) || false;
  }

  setBookmarked(postUri: string, isBookmarked: boolean) {
    // Ensure we're initialized before modifying
    if (!this.initialized) {
      this.init().catch(() => {
        // Continue with the operation even if init fails
      });
    }
    if (isBookmarked) {
      this.bookmarks.set(postUri, true);
    } else {
      this.bookmarks.delete(postUri);
    }
    this.notify();
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }
}

const bookmarkStore = new BookmarkStore();

// Export initialization function for use after service is ready
export async function initializeBookmarkStore() {
  return bookmarkStore.init();
}

export function useBookmarks() {
  const queryClient = useQueryClient();
  const { showUndoToast, showToast, dismissToast } = useToast();
  const pendingUndoRef = useRef<{
    timeoutId: ReturnType<typeof setTimeout>;
    toastId: string;
  } | null>(null);

  // Refs for stable callbacks
  const showUndoToastRef = useRef(showUndoToast);
  showUndoToastRef.current = showUndoToast;
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;
  const dismissToastRef = useRef(dismissToast);
  dismissToastRef.current = dismissToast;
  const queryClientRef = useRef(queryClient);
  queryClientRef.current = queryClient;

  // Subscribe to bookmark store changes
  const bookmarkMap = useSyncExternalStore(
    (callback) => bookmarkStore.subscribe(callback),
    () => bookmarkStore.getSnapshot(),
  );

  // Subscribe to sync state changes
  useSyncExternalStore(
    (callback) => bookmarkSyncStore.subscribe(callback),
    () => bookmarkSyncStore.getSnapshot(),
  );

  // Check if a post is bookmarked
  const isBookmarked = useCallback(
    (postUri: string) => {
      return bookmarkMap.has(postUri);
    },
    [bookmarkMap],
  );

  // Get sync status for a post
  const getSyncStatus = useCallback((postUri: string): SyncStatus => {
    return bookmarkSyncStore.getSyncStatus(postUri);
  }, []);

  // Get retry function for a post
  const getRetryFn = useCallback(
    (postUri: string): (() => void) | undefined => {
      return bookmarkSyncStore.getRetryFn(postUri);
    },
    [],
  );

  // Toggle bookmark mutation
  const toggleBookmarkMutation = useMutation({
    mutationFn: async (post: AppBskyFeedDefs.PostView) => {
      return await bookmarkServiceV2.toggleBookmark(post);
    },
    onMutate: async (post: AppBskyFeedDefs.PostView) => {
      // Set pending state for sync badge
      bookmarkSyncStore.setPending(post.uri);

      // Optimistic update
      const wasBookmarked = bookmarkStore.isBookmarked(post.uri);
      bookmarkStore.setBookmarked(post.uri, !wasBookmarked);

      return { wasBookmarked, postUri: post.uri };
    },
    onError: (_err, post, context) => {
      // Set failed state with retry function
      bookmarkSyncStore.setFailed(post.uri, () => {
        toggleBookmarkMutation.mutate(post);
      });

      // Revert on error
      if (context) {
        bookmarkStore.setBookmarked(context.postUri, context.wasBookmarked);
      }
    },
    onSuccess: (isNowBookmarked, post) => {
      // Set synced state
      bookmarkSyncStore.setSynced(post.uri);

      // Update with actual result
      bookmarkStore.setBookmarked(post.uri, isNowBookmarked);

      // Invalidate all bookmark queries (including those with search params)
      queryClient.invalidateQueries({
        queryKey: ["bookmarks"],
      });
      queryClient.invalidateQueries({
        queryKey: ["bookmarkCount"],
        exact: true,
      });
    },
  });

  const toggleBookmark = useCallback(
    (post: AppBskyFeedDefs.PostView) => {
      const wasBookmarked = bookmarkStore.isBookmarked(post.uri);

      if (wasBookmarked) {
        // Unbookmarking — use undo pattern
        // Cancel any existing pending undo
        if (pendingUndoRef.current) {
          clearTimeout(pendingUndoRef.current.timeoutId);
          dismissToastRef.current(pendingUndoRef.current.toastId);
          pendingUndoRef.current = null;
        }

        // Optimistic update (remove bookmark from UI)
        bookmarkStore.setBookmarked(post.uri, false);

        let resolved = false;

        const commit = async () => {
          if (resolved) return;
          resolved = true;
          pendingUndoRef.current = null;
          try {
            bookmarkSyncStore.setPending(post.uri);
            const isNowBookmarked =
              await bookmarkServiceV2.toggleBookmark(post);
            bookmarkSyncStore.setSynced(post.uri);
            bookmarkStore.setBookmarked(post.uri, isNowBookmarked);
            queryClientRef.current.invalidateQueries({
              queryKey: ["bookmarks"],
            });
            queryClientRef.current.invalidateQueries({
              queryKey: ["bookmarkCount"],
              exact: true,
            });
          } catch (_error) {
            bookmarkSyncStore.setFailed(post.uri, () =>
              toggleBookmarkMutation.mutate(post),
            );
            bookmarkStore.setBookmarked(post.uri, true);
            showToastRef.current("Failed to remove bookmark", {
              type: "error",
            });
          }
        };

        const undo = () => {
          if (resolved) return;
          resolved = true;
          if (pendingUndoRef.current) {
            clearTimeout(pendingUndoRef.current.timeoutId);
          }
          pendingUndoRef.current = null;
          bookmarkStore.setBookmarked(post.uri, true);
        };

        const toastId = showUndoToastRef.current(
          "Bookmark removed",
          undo,
          commit,
          5000,
        );
        const timeoutId = setTimeout(commit, 5000);
        pendingUndoRef.current = { timeoutId, toastId };
      } else {
        // Adding bookmark — fire immediately (not destructive)
        toggleBookmarkMutation.mutate(post);
      }
    },
    [toggleBookmarkMutation],
  );

  return {
    isBookmarked,
    toggleBookmark,
    isToggling: toggleBookmarkMutation.isPending,
    getSyncStatus,
    getRetryFn,
  };
}
