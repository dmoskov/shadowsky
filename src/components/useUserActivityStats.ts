import type { AppBskyFeedDefs } from "@atproto/api";
import { useQuery } from "@tanstack/react-query";
import { subDays } from "date-fns";
import { useAuth } from "../contexts/AuthContext";

export type TimeRange = "1d" | "3d" | "7d" | "4w";

function cutoffFor(timeRange: TimeRange): Date {
  const days =
    timeRange === "1d"
      ? 1
      : timeRange === "3d"
        ? 3
        : timeRange === "7d"
          ? 7
          : 28;
  return subDays(new Date(), days);
}

/**
 * Fetches the current user's recent authored posts (up to 5 pages within the
 * time range) and aggregates engagement received (likes/reposts/replies) plus
 * profile counts. Extracted from NotificationsAnalytics to keep the component
 * focused on rendering.
 */
export function useUserActivityStats(timeRange: TimeRange) {
  const { agent, session } = useAuth();

  return useQuery({
    queryKey: ["user-activity", session?.handle, timeRange],
    queryFn: async () => {
      if (!agent || !session?.handle) throw new Error("Not authenticated");

      const cutoffDate = cutoffFor(timeRange);

      // Fetch multiple pages if needed to cover the time range
      let allPosts: AppBskyFeedDefs.FeedViewPost[] = [];
      let cursor: string | undefined;
      let fetchedEnough = false;
      const maxPages = 5; // Limit to prevent excessive API calls

      for (let page = 0; page < maxPages && !fetchedEnough; page++) {
        const response = await agent.getAuthorFeed({
          actor: session.handle,
          limit: 100,
          cursor,
        });

        allPosts = allPosts.concat(response.data.feed);
        cursor = response.data.cursor;

        if (response.data.feed.length > 0) {
          const oldestInBatch =
            response.data.feed[response.data.feed.length - 1];
          const oldestDate = new Date(oldestInBatch.post.indexedAt);
          if (oldestDate < cutoffDate || !cursor) {
            fetchedEnough = true;
          }
        } else {
          fetchedEnough = true;
        }
      }

      // Count likes, reposts, and replies from posts authored in the range.
      // NOTE: counts TOTAL engagement on posts made in the range, not NEW
      // engagement received during the range.
      let totalLikes = 0;
      let totalReposts = 0;
      let totalReplies = 0;
      let postsInTimeRange = 0;

      for (const item of allPosts) {
        const postDate = new Date(item.post.indexedAt);

        const isRepost =
          item.reason?.$type === "app.bsky.feed.defs#reasonRepost";
        if (isRepost) continue;

        if (postDate >= cutoffDate) {
          postsInTimeRange++;
          totalLikes += item.post.likeCount || 0;
          totalReposts += item.post.repostCount || 0;
          totalReplies += item.post.replyCount || 0;
        }
      }

      const profile = await agent.getProfile({ actor: session.handle });

      return {
        postsCount: postsInTimeRange,
        likesReceived: totalLikes,
        repostsReceived: totalReposts,
        repliesReceived: totalReplies,
        followersCount: profile.data.followersCount || 0,
        followingCount: profile.data.followsCount || 0,
        postsTotal: profile.data.postsCount || 0,
      };
    },
    staleTime: 0, // Always refetch when query key changes
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
