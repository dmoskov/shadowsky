import { getAtProtoClient } from "./client";
import { getProfile } from "./profiles";
import { getAuthorFeed } from "./feeds";
import { AppBskyFeedDefs, AppBskyFeedPost } from "@atproto/api";

export type TimeRange = "today" | "week" | "month";

export interface AnalyticsMetrics {
  likesReceived: number;
  repostsReceived: number;
  repliesReceived: number;
  followersCount: number;
  postsCount: number;
  impressions: number;
  topPosts: AppBskyFeedDefs.FeedViewPost[];
}

export interface FollowerMetrics {
  current: number;
  gained: number;
}

/**
 * Get user analytics for a specific time range
 */
export async function getUserAnalytics(
  actor: string,
  timeRange: TimeRange = "week"
): Promise<AnalyticsMetrics> {
  const client = getAtProtoClient();
  const agent = client.getAgent();

  // Get user profile for follower count
  const profile = await getProfile(actor);

  // Calculate time range start date
  const now = new Date();
  const startDate = new Date();
  switch (timeRange) {
    case "today":
      startDate.setHours(0, 0, 0, 0);
      break;
    case "week":
      startDate.setDate(now.getDate() - 7);
      break;
    case "month":
      startDate.setMonth(now.getMonth() - 1);
      break;
  }

  // Fetch author's posts to calculate engagement metrics
  let cursor: string | undefined;
  let allPosts: AppBskyFeedDefs.FeedViewPost[] = [];
  let hasMore = true;
  const maxPages = 10; // Limit to prevent excessive API calls
  let pageCount = 0;

  // Fetch posts until we reach the time range or max pages
  while (hasMore && pageCount < maxPages) {
    const response = await getAuthorFeed(actor, { cursor, limit: 50 });
    const posts = response.feed;

    // Filter posts within time range
    for (const post of posts) {
      const postDate = new Date(post.post.indexedAt);
      if (postDate >= startDate) {
        allPosts.push(post);
      } else {
        hasMore = false;
        break;
      }
    }

    cursor = response.cursor;
    if (!cursor) {
      hasMore = false;
    }
    pageCount++;
  }

  // Calculate metrics from posts
  let likesReceived = 0;
  let repostsReceived = 0;
  let repliesReceived = 0;
  let impressions = 0;

  for (const post of allPosts) {
    likesReceived += post.post.likeCount || 0;
    repostsReceived += post.post.repostCount || 0;
    repliesReceived += post.post.replyCount || 0;
    // Estimate impressions as sum of all engagement
    impressions +=
      (post.post.likeCount || 0) +
      (post.post.repostCount || 0) +
      (post.post.replyCount || 0);
  }

  // Sort posts by engagement (likes + reposts + replies) to get top posts
  const topPosts = [...allPosts]
    .sort((a, b) => {
      const engagementA =
        (a.post.likeCount || 0) +
        (a.post.repostCount || 0) +
        (a.post.replyCount || 0);
      const engagementB =
        (b.post.likeCount || 0) +
        (b.post.repostCount || 0) +
        (b.post.replyCount || 0);
      return engagementB - engagementA;
    })
    .slice(0, 5); // Top 5 posts

  return {
    likesReceived,
    repostsReceived,
    repliesReceived,
    followersCount: profile.followersCount || 0,
    postsCount: allPosts.length,
    impressions,
    topPosts,
  };
}

/**
 * Get follower growth metrics
 * Note: AT Protocol doesn't provide historical follower data,
 * so this returns current count only
 */
export async function getFollowerMetrics(
  actor: string
): Promise<FollowerMetrics> {
  const profile = await getProfile(actor);

  return {
    current: profile.followersCount || 0,
    gained: 0, // Historical data not available via API
  };
}
