import type { AppBskyFeedDefs } from "@atproto/api";
import { debug } from "@bsky/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef } from "react";
import { useActionSyncOptional } from "../contexts/ActionSyncContext";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import {
  mutationQueueDB,
  type MutationType,
} from "../services/mutation-queue-db";

interface TimelinePage {
  feed: Array<{ post?: AppBskyFeedDefs.PostView; [key: string]: unknown }>;
  cursor?: string;
}

interface TimelineData {
  pages: TimelinePage[];
  pageParams: unknown[];
}

interface ThreadNode {
  post?: AppBskyFeedDefs.PostView;
  replies?: ThreadNode[];
  [key: string]: unknown;
}

interface CacheSnapshot {
  timeline: [readonly unknown[], TimelineData | undefined][];
  columnFeed: [readonly unknown[], TimelineData | undefined][];
  thread: [readonly unknown[], ThreadNode | undefined][];
  authorFeed: [readonly unknown[], TimelineData | undefined][];
}

interface PendingUndo {
  timeoutId: ReturnType<typeof setTimeout>;
  toastId: string;
}

export function useOptimisticPosts() {
  const { agent } = useAuth();
  const queryClient = useQueryClient();
  const actionSync = useActionSyncOptional();
  const { showUndoToast, showToast, dismissToast } = useToast();
  const pendingUndosRef = useRef(new Map<string, PendingUndo>());

  // Refs for stable callbacks
  const agentRef = useRef(agent);
  agentRef.current = agent;
  const actionSyncRef = useRef(actionSync);
  actionSyncRef.current = actionSync;
  const showUndoToastRef = useRef(showUndoToast);
  showUndoToastRef.current = showUndoToast;
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;
  const dismissToastRef = useRef(dismissToast);
  dismissToastRef.current = dismissToast;

  // Snapshot all feed caches before applying optimistic updates
  const snapshotCaches = (): CacheSnapshot => {
    return {
      timeline: queryClient
        .getQueriesData<TimelineData>({ queryKey: ["timeline"] })
        .map(([key, data]) => [key, data]),
      columnFeed: queryClient
        .getQueriesData<TimelineData>({ queryKey: ["columnFeed"] })
        .map(([key, data]) => [key, data]),
      thread: queryClient
        .getQueriesData<ThreadNode>({ queryKey: ["thread"] })
        .map(([key, data]) => [key, data]),
      authorFeed: queryClient
        .getQueriesData<TimelineData>({ queryKey: ["authorFeed"] })
        .map(([key, data]) => [key, data]),
    };
  };

  // Restore all feed caches from a snapshot
  const restoreCacheSnapshot = (snapshot: CacheSnapshot) => {
    for (const [key, data] of snapshot.timeline) {
      queryClient.setQueryData(key, data);
    }
    for (const [key, data] of snapshot.columnFeed) {
      queryClient.setQueryData(key, data);
    }
    for (const [key, data] of snapshot.thread) {
      queryClient.setQueryData(key, data);
    }
    for (const [key, data] of snapshot.authorFeed) {
      queryClient.setQueryData(key, data);
    }
  };

  // Helper to update post data optimistically in all feed caches
  // Also exposed via ref for stable undo callbacks
  const updatePostInCaches = (
    postUri: string,
    updater: (post: AppBskyFeedDefs.PostView) => AppBskyFeedDefs.PostView,
  ) => {
    // Update in all feed queries
    queryClient.setQueriesData(
      { queryKey: ["timeline"] },
      (oldData: TimelineData | undefined) => {
        if (!oldData?.pages) return oldData;

        return {
          ...oldData,
          pages: oldData.pages.map((page) => ({
            ...page,
            feed: page.feed.map((item) => {
              if (item.post?.uri === postUri) {
                return {
                  ...item,
                  post: updater(item.post),
                };
              }
              return item;
            }),
          })),
        };
      },
    );

    // Update in column feed queries
    queryClient.setQueriesData(
      { queryKey: ["columnFeed"] },
      (oldData: TimelineData | undefined) => {
        if (!oldData?.pages) return oldData;

        return {
          ...oldData,
          pages: oldData.pages.map((page) => ({
            ...page,
            feed: page.feed.map((item) => {
              if (item.post?.uri === postUri) {
                return {
                  ...item,
                  post: updater(item.post),
                };
              }
              return item;
            }),
          })),
        };
      },
    );

    // Update in thread queries
    queryClient.setQueriesData(
      { queryKey: ["thread"] },
      (oldData: ThreadNode | undefined) => {
        if (!oldData) return oldData;

        const updateThread = (
          thread: ThreadNode | undefined,
        ): ThreadNode | undefined => {
          if (!thread) return thread;

          if (thread.post?.uri === postUri) {
            return {
              ...thread,
              post: updater(thread.post),
            };
          }

          if (thread.replies?.length) {
            return {
              ...thread,
              replies: thread.replies
                .map(updateThread)
                .filter((r): r is ThreadNode => r !== undefined),
            };
          }

          return thread;
        };

        return updateThread(oldData);
      },
    );

    // Update in author feed queries (profile pages)
    queryClient.setQueriesData(
      { queryKey: ["authorFeed"] },
      (oldData: TimelineData | undefined) => {
        if (!oldData?.pages) return oldData;

        return {
          ...oldData,
          pages: oldData.pages.map((page) => ({
            ...page,
            feed: page.feed.map((item) => {
              if (item.post?.uri === postUri) {
                return {
                  ...item,
                  post: updater(item.post),
                };
              }
              return item;
            }),
          })),
        };
      },
    );
  };

  // Helper to check if error is a network error (should queue for retry)
  const isNetworkError = (error: unknown): boolean => {
    if (!navigator.onLine) return true;
    if (error instanceof TypeError && error.message.includes("fetch")) {
      return true;
    }
    if (error instanceof Error) {
      const networkIndicators = [
        "network",
        "fetch",
        "timeout",
        "ECONNREFUSED",
        "ENOTFOUND",
        "offline",
      ];
      return networkIndicators.some((indicator) =>
        error.message.toLowerCase().includes(indicator.toLowerCase()),
      );
    }
    return false;
  };

  // Helper to queue a mutation for retry
  const queueMutation = async (
    type: MutationType,
    payload: Record<string, unknown>,
  ): Promise<void> => {
    try {
      // Initialize queue DB if not already done
      await mutationQueueDB.init();
      await mutationQueueDB.enqueue(type, payload);
      debug.log(`Queued ${type} mutation for retry when online`);
    } catch (queueError) {
      debug.error("Failed to queue mutation:", queueError);
    }
  };

  const likeMutation = useMutation({
    mutationFn: async ({ uri, cid }: { uri: string; cid: string }) => {
      if (!agent) throw new Error("Not authenticated");
      return await agent.like(uri, cid);
    },
    onMutate: async ({ uri }) => {
      // Set pending state for sync badge
      actionSync?.setActionPending("like", uri);

      // Cancel any outgoing refetches to prevent overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ["timeline"] });
      await queryClient.cancelQueries({ queryKey: ["columnFeed"] });
      await queryClient.cancelQueries({ queryKey: ["authorFeed"] });

      // Snapshot caches before optimistic update
      const snapshot = snapshotCaches();

      // Optimistically update the post
      updatePostInCaches(uri, (post) => ({
        ...post,
        likeCount: (post.likeCount || 0) + 1,
        viewer: {
          ...post.viewer,
          like: "optimistic-like", // Temporary value
        },
      }));

      return { snapshot };
    },
    onSuccess: (data, { uri }) => {
      // Set synced state for sync badge
      actionSync?.setActionSynced("like", uri);

      // Update with real like URI from server
      updatePostInCaches(uri, (post) => ({
        ...post,
        viewer: {
          ...post.viewer,
          like: data.uri,
        },
      }));
    },
    onError: (error, { uri, cid }, context) => {
      // If it's a network error, queue for retry and keep optimistic update
      if (isNetworkError(error)) {
        queueMutation("like", { uri, cid });
        // Set failed state with retry function
        actionSync?.setActionFailed("like", uri, () => {
          likeMutation.mutate({ uri, cid });
        });
        return;
      }

      // Set failed state for non-network errors
      actionSync?.setActionFailed("like", uri, () => {
        likeMutation.mutate({ uri, cid });
      });

      // Restore cache snapshot on non-network error
      if (context?.snapshot) {
        restoreCacheSnapshot(context.snapshot);
      }
    },
  });

  const unlikeMutation = useMutation({
    mutationFn: async ({ likeUri }: { likeUri: string; postUri: string }) => {
      if (!agent) throw new Error("Not authenticated");
      return await agent.deleteLike(likeUri);
    },
    onMutate: async ({ postUri }) => {
      // Set pending state for sync badge
      actionSync?.setActionPending("like", postUri);

      await queryClient.cancelQueries({ queryKey: ["timeline"] });
      await queryClient.cancelQueries({ queryKey: ["columnFeed"] });
      await queryClient.cancelQueries({ queryKey: ["authorFeed"] });

      // Snapshot caches before optimistic update
      const snapshot = snapshotCaches();

      updatePostInCaches(postUri, (post) => ({
        ...post,
        likeCount: Math.max(0, (post.likeCount || 0) - 1),
        viewer: {
          ...post.viewer,
          like: undefined,
        },
      }));

      return { snapshot };
    },
    onSuccess: (_data, { postUri }) => {
      // Set synced state for sync badge
      actionSync?.setActionSynced("like", postUri);
    },
    onError: (error, { likeUri, postUri }, context) => {
      // If it's a network error, queue for retry
      if (isNetworkError(error)) {
        queueMutation("unlike", { likeUri });
        actionSync?.setActionFailed("like", postUri, () => {
          unlikeMutation.mutate({ likeUri, postUri });
        });
      } else {
        actionSync?.setActionFailed("like", postUri, () => {
          unlikeMutation.mutate({ likeUri, postUri });
        });

        // Restore cache snapshot on non-network error
        if (context?.snapshot) {
          restoreCacheSnapshot(context.snapshot);
        }
      }
    },
  });

  const repostMutation = useMutation({
    mutationFn: async ({ uri, cid }: { uri: string; cid: string }) => {
      if (!agent) throw new Error("Not authenticated");
      return await agent.repost(uri, cid);
    },
    onMutate: async ({ uri }) => {
      // Set pending state for sync badge
      actionSync?.setActionPending("repost", uri);

      await queryClient.cancelQueries({ queryKey: ["timeline"] });
      await queryClient.cancelQueries({ queryKey: ["columnFeed"] });
      await queryClient.cancelQueries({ queryKey: ["authorFeed"] });

      // Snapshot caches before optimistic update
      const snapshot = snapshotCaches();

      updatePostInCaches(uri, (post) => ({
        ...post,
        repostCount: (post.repostCount || 0) + 1,
        viewer: {
          ...post.viewer,
          repost: "optimistic-repost",
        },
      }));

      return { snapshot };
    },
    onSuccess: (data, { uri }) => {
      // Set synced state for sync badge
      actionSync?.setActionSynced("repost", uri);

      updatePostInCaches(uri, (post) => ({
        ...post,
        viewer: {
          ...post.viewer,
          repost: data.uri,
        },
      }));
    },
    onError: (error, { uri, cid }, context) => {
      // If it's a network error, queue for retry and keep optimistic update
      if (isNetworkError(error)) {
        queueMutation("repost", { uri, cid });
        actionSync?.setActionFailed("repost", uri, () => {
          repostMutation.mutate({ uri, cid });
        });
        return;
      }

      // Set failed state for non-network errors
      actionSync?.setActionFailed("repost", uri, () => {
        repostMutation.mutate({ uri, cid });
      });

      // Restore cache snapshot on non-network error
      if (context?.snapshot) {
        restoreCacheSnapshot(context.snapshot);
      }
    },
  });

  const unrepostMutation = useMutation({
    mutationFn: async ({
      repostUri,
    }: {
      repostUri: string;
      postUri: string;
    }) => {
      if (!agent) throw new Error("Not authenticated");
      return await agent.deleteRepost(repostUri);
    },
    onMutate: async ({ postUri }) => {
      // Set pending state for sync badge
      actionSync?.setActionPending("repost", postUri);

      await queryClient.cancelQueries({ queryKey: ["timeline"] });
      await queryClient.cancelQueries({ queryKey: ["columnFeed"] });
      await queryClient.cancelQueries({ queryKey: ["authorFeed"] });

      // Snapshot caches before optimistic update
      const snapshot = snapshotCaches();

      updatePostInCaches(postUri, (post) => ({
        ...post,
        repostCount: Math.max(0, (post.repostCount || 0) - 1),
        viewer: {
          ...post.viewer,
          repost: undefined,
        },
      }));

      return { snapshot };
    },
    onSuccess: (_data, { postUri }) => {
      // Set synced state for sync badge
      actionSync?.setActionSynced("repost", postUri);
    },
    onError: (error, { repostUri, postUri }, context) => {
      // If it's a network error, queue for retry
      if (isNetworkError(error)) {
        queueMutation("unrepost", { repostUri });
        actionSync?.setActionFailed("repost", postUri, () => {
          unrepostMutation.mutate({ repostUri, postUri });
        });
      } else {
        actionSync?.setActionFailed("repost", postUri, () => {
          unrepostMutation.mutate({ repostUri, postUri });
        });

        // Restore cache snapshot on non-network error
        if (context?.snapshot) {
          restoreCacheSnapshot(context.snapshot);
        }
      }
    },
  });

  // Ref for stable access to updatePostInCaches in undo callbacks
  const updatePostInCachesRef = useRef(updatePostInCaches);
  updatePostInCachesRef.current = updatePostInCaches;

  /**
   * Undoable unlike: applies optimistic update immediately, shows undo toast,
   * defers the actual API call by 5 seconds. If user clicks Undo, the like
   * is restored without ever hitting the server.
   */
  const undoableUnlike = useCallback(
    (postUri: string, likeUri: string) => {
      // Cancel any existing pending undo for this post
      const key = `unlike:${postUri}`;
      const existing = pendingUndosRef.current.get(key);
      if (existing) {
        clearTimeout(existing.timeoutId);
        dismissToastRef.current(existing.toastId);
      }

      // Apply optimistic update (remove like from UI)
      updatePostInCachesRef.current(postUri, (post) => ({
        ...post,
        likeCount: Math.max(0, (post.likeCount || 0) - 1),
        viewer: { ...post.viewer, like: undefined },
      }));

      let resolved = false;

      const restoreLike = () => {
        updatePostInCachesRef.current(postUri, (post) => ({
          ...post,
          likeCount: (post.likeCount || 0) + 1,
          viewer: { ...post.viewer, like: likeUri },
        }));
      };

      const commit = async () => {
        if (resolved) return;
        resolved = true;
        pendingUndosRef.current.delete(key);
        try {
          if (!agentRef.current) throw new Error("Not authenticated");
          await agentRef.current.deleteLike(likeUri);
          actionSyncRef.current?.setActionSynced("like", postUri);
        } catch (error) {
          debug.error("Failed to unlike post:", error);
          restoreLike();
          showToastRef.current("Failed to unlike post", { type: "error" });
        }
      };

      const undo = () => {
        if (resolved) return;
        resolved = true;
        const entry = pendingUndosRef.current.get(key);
        if (entry) clearTimeout(entry.timeoutId);
        pendingUndosRef.current.delete(key);
        restoreLike();
      };

      const toastId = showUndoToastRef.current("Unliked", undo, commit, 5000);
      const timeoutId = setTimeout(commit, 5000);
      pendingUndosRef.current.set(key, { timeoutId, toastId });
    },
    [], // Stable — all dependencies accessed via refs
  );

  /**
   * Undoable unrepost: same pattern as undoableUnlike but for reposts.
   */
  const undoableUnrepost = useCallback(
    (postUri: string, repostUri: string) => {
      const key = `unrepost:${postUri}`;
      const existing = pendingUndosRef.current.get(key);
      if (existing) {
        clearTimeout(existing.timeoutId);
        dismissToastRef.current(existing.toastId);
      }

      // Apply optimistic update (remove repost from UI)
      updatePostInCachesRef.current(postUri, (post) => ({
        ...post,
        repostCount: Math.max(0, (post.repostCount || 0) - 1),
        viewer: { ...post.viewer, repost: undefined },
      }));

      let resolved = false;

      const restoreRepost = () => {
        updatePostInCachesRef.current(postUri, (post) => ({
          ...post,
          repostCount: (post.repostCount || 0) + 1,
          viewer: { ...post.viewer, repost: repostUri },
        }));
      };

      const commit = async () => {
        if (resolved) return;
        resolved = true;
        pendingUndosRef.current.delete(key);
        try {
          if (!agentRef.current) throw new Error("Not authenticated");
          await agentRef.current.deleteRepost(repostUri);
          actionSyncRef.current?.setActionSynced("repost", postUri);
        } catch (error) {
          debug.error("Failed to unrepost:", error);
          restoreRepost();
          showToastRef.current("Failed to unrepost", { type: "error" });
        }
      };

      const undo = () => {
        if (resolved) return;
        resolved = true;
        const entry = pendingUndosRef.current.get(key);
        if (entry) clearTimeout(entry.timeoutId);
        pendingUndosRef.current.delete(key);
        restoreRepost();
      };

      const toastId = showUndoToastRef.current(
        "Unreposted",
        undo,
        commit,
        5000,
      );
      const timeoutId = setTimeout(commit, 5000);
      pendingUndosRef.current.set(key, { timeoutId, toastId });
    },
    [], // Stable — all dependencies accessed via refs
  );

  return {
    likeMutation,
    unlikeMutation,
    repostMutation,
    unrepostMutation,
    undoableUnlike,
    undoableUnrepost,
  };
}
