import { AppBskyFeedDefs } from "@atproto/api";
import { getProfileService } from "@bsky/shared";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../contexts/AuthContext";

interface PostEngagement {
  uri: string;
  text: string;
  createdAt: string;
  likes: number;
  reposts: number;
  replies: number;
  totalEngagement: number;
  author: {
    handle: string;
    displayName?: string;
    avatar?: string;
  };
  post: AppBskyFeedDefs.PostView;
}

export interface UseTopPostsOptions {
  handle: string;
  limit?: number;
  maxPages?: number;
  enabled?: boolean;
}

export function useTopPosts({
  handle,
  limit = 10,
  maxPages = 20,
  enabled = true,
}: UseTopPostsOptions) {
  const { agent } = useAuth();

  return useQuery({
    queryKey: ["top-posts", handle, limit, maxPages],
    queryFn: async () => {
      if (!agent || !handle) throw new Error("No user to fetch");

      const profileService = getProfileService(agent);
      const allPosts: AppBskyFeedDefs.FeedViewPost[] = [];
      let cursor: string | undefined;

      // Fetch multiple pages to get a good sample of posts
      for (let page = 0; page < maxPages; page++) {
        const response = await profileService.getAuthorFeed(
          handle,
          100,
          cursor,
          "posts_no_replies",
        );

        if (!response) break;

        // Filter out reposts and only include original posts
        const filteredPosts = response.feed.filter((item) => {
          const isRepost =
            item.reason?.$type === "app.bsky.feed.defs#reasonRepost";
          return !isRepost;
        });

        allPosts.push(...filteredPosts);
        cursor = response.cursor;

        // Stop if no more pages
        if (!cursor) break;
      }

      // Map to engagement structure
      const postsWithEngagement: PostEngagement[] = allPosts.map((item) => ({
        uri: item.post.uri,
        text: (item.post.record as any)?.text || "",
        createdAt: item.post.indexedAt,
        likes: item.post.likeCount || 0,
        reposts: item.post.repostCount || 0,
        replies: item.post.replyCount || 0,
        totalEngagement:
          (item.post.likeCount || 0) +
          (item.post.repostCount || 0) +
          (item.post.replyCount || 0),
        author: {
          handle: item.post.author.handle,
          displayName: item.post.author.displayName,
          avatar: item.post.author.avatar,
        },
        post: item.post,
      }));

      // Sort by total engagement and get top posts
      const topPosts = [...postsWithEngagement]
        .sort((a, b) => b.totalEngagement - a.totalEngagement)
        .slice(0, limit);

      return {
        topPosts,
        totalPostsAnalyzed: postsWithEngagement.length,
      };
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    enabled: !!agent && !!handle && enabled,
  });
}
