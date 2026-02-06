import type { AppBskyFeedDefs } from "@atproto/api";
import { debug } from "@bsky/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useActionSyncOptional } from "../contexts/ActionSyncContext";
import { useAuth } from "../contexts/AuthContext";
import {
  mutationQueueDB,
  type MutationType,
} from "../services/mutation-queue-db";

export function useOptimisticPosts() {
  const { agent } = useAuth();
  const queryClient = useQueryClient();
  const actionSync = useActionSyncOptional();

  // Helper to update post data optimistically in all feed caches
  const updatePostInCaches = (
    postUri: string,
    updater: (post: AppBskyFeedDefs.PostView) => AppBskyFeedDefs.PostView,
  ) => {
    // Update in all feed queries
    queryClient.setQueriesData({ queryKey: ["timeline"] }, (oldData: any) => {
      if (!oldData?.pages) return oldData;

      return {
        ...oldData,
        pages: oldData.pages.map((page: any) => ({
          ...page,
          feed: page.feed.map((item: any) => {
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
    });

    // Update in column feed queries
    queryClient.setQueriesData({ queryKey: ["columnFeed"] }, (oldData: any) => {
      if (!oldData?.pages) return oldData;

      return {
        ...oldData,
        pages: oldData.pages.map((page: any) => ({
          ...page,
          posts: page.posts.map((item: any) => {
            const post = item.post || item;
            if (post.uri === postUri) {
              if (item.post) {
                return {
                  ...item,
                  post: updater(post),
                };
              }
              return updater(post);
            }
            return item;
          }),
        })),
      };
    });

    // Update in thread queries
    queryClient.setQueriesData({ queryKey: ["thread"] }, (oldData: any) => {
      if (!oldData) return oldData;

      const updateThread = (thread: any): any => {
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
            replies: thread.replies.map(updateThread),
          };
        }

        return thread;
      };

      return updateThread(oldData);
    });

    // Update in author feed queries (profile pages)
    queryClient.setQueriesData({ queryKey: ["authorFeed"] }, (oldData: any) => {
      if (!oldData?.pages) return oldData;

      return {
        ...oldData,
        pages: oldData.pages.map((page: any) => ({
          ...page,
          feed: page.feed.map((item: any) => {
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
    });
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

      // Optimistically update the post
      updatePostInCaches(uri, (post) => ({
        ...post,
        likeCount: (post.likeCount || 0) + 1,
        viewer: {
          ...post.viewer,
          like: "optimistic-like", // Temporary value
        },
      }));
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
    onError: (error, { uri, cid }) => {
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

      // Revert optimistic update on non-network error
      updatePostInCaches(uri, (post) => ({
        ...post,
        likeCount: Math.max(0, (post.likeCount || 0) - 1),
        viewer: {
          ...post.viewer,
          like: undefined,
        },
      }));
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

      updatePostInCaches(postUri, (post) => ({
        ...post,
        likeCount: Math.max(0, (post.likeCount || 0) - 1),
        viewer: {
          ...post.viewer,
          like: undefined,
        },
      }));
    },
    onSuccess: (_data, { postUri }) => {
      // Set synced state for sync badge
      actionSync?.setActionSynced("like", postUri);
    },
    onError: (error, { likeUri, postUri }) => {
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

        // Revert optimistic update on non-network error
        updatePostInCaches(postUri, (post) => ({
          ...post,
          likeCount: (post.likeCount || 0) + 1,
          viewer: {
            ...post.viewer,
            like: likeUri,
          },
        }));
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

      updatePostInCaches(uri, (post) => ({
        ...post,
        repostCount: (post.repostCount || 0) + 1,
        viewer: {
          ...post.viewer,
          repost: "optimistic-repost",
        },
      }));
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
    onError: (error, { uri, cid }) => {
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

      // Revert optimistic update on non-network error
      updatePostInCaches(uri, (post) => ({
        ...post,
        repostCount: Math.max(0, (post.repostCount || 0) - 1),
        viewer: {
          ...post.viewer,
          repost: undefined,
        },
      }));
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

      updatePostInCaches(postUri, (post) => ({
        ...post,
        repostCount: Math.max(0, (post.repostCount || 0) - 1),
        viewer: {
          ...post.viewer,
          repost: undefined,
        },
      }));
    },
    onSuccess: (_data, { postUri }) => {
      // Set synced state for sync badge
      actionSync?.setActionSynced("repost", postUri);
    },
    onError: (error, { repostUri, postUri }) => {
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

        // Revert optimistic update on non-network error
        updatePostInCaches(postUri, (post) => ({
          ...post,
          repostCount: (post.repostCount || 0) + 1,
          viewer: {
            ...post.viewer,
            repost: repostUri,
          },
        }));
      }
    },
  });

  return {
    likeMutation,
    unlikeMutation,
    repostMutation,
    unrepostMutation,
  };
}
