import type { AppBskyFeedDefs } from "@atproto/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../contexts/AuthContext";

export function useOptimisticPosts() {
  const { agent } = useAuth();
  const queryClient = useQueryClient();

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
  };

  const likeMutation = useMutation({
    mutationFn: async ({ uri, cid }: { uri: string; cid: string }) => {
      if (!agent) throw new Error("Not authenticated");
      return await agent.like(uri, cid);
    },
    onMutate: async ({ uri }) => {
      // Cancel any outgoing refetches to prevent overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ["timeline"] });
      await queryClient.cancelQueries({ queryKey: ["columnFeed"] });

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
      // Update with real like URI from server
      updatePostInCaches(uri, (post) => ({
        ...post,
        viewer: {
          ...post.viewer,
          like: data.uri,
        },
      }));
    },
    onError: (_, { uri }) => {
      // Revert optimistic update on error
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
      await queryClient.cancelQueries({ queryKey: ["timeline"] });
      await queryClient.cancelQueries({ queryKey: ["columnFeed"] });

      updatePostInCaches(postUri, (post) => ({
        ...post,
        likeCount: Math.max(0, (post.likeCount || 0) - 1),
        viewer: {
          ...post.viewer,
          like: undefined,
        },
      }));
    },
  });

  const repostMutation = useMutation({
    mutationFn: async ({ uri, cid }: { uri: string; cid: string }) => {
      if (!agent) throw new Error("Not authenticated");
      return await agent.repost(uri, cid);
    },
    onMutate: async ({ uri }) => {
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
      updatePostInCaches(uri, (post) => ({
        ...post,
        viewer: {
          ...post.viewer,
          repost: data.uri,
        },
      }));
    },
    onError: (_, { uri }) => {
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
      await queryClient.cancelQueries({ queryKey: ["timeline"] });
      await queryClient.cancelQueries({ queryKey: ["columnFeed"] });

      updatePostInCaches(postUri, (post) => ({
        ...post,
        repostCount: Math.max(0, (post.repostCount || 0) - 1),
        viewer: {
          ...post.viewer,
          repost: undefined,
        },
      }));
    },
  });

  return {
    likeMutation,
    unlikeMutation,
    repostMutation,
    unrepostMutation,
  };
}
