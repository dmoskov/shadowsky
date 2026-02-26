import { getProfile } from "./profiles";
import { getAuthorFeed } from "./feeds";
import { AppBskyFeedDefs } from "@atproto/api";

// Note: getProfile and getAuthorFeed are already rate-limited,
// so analytics functions inherit rate limiting automatically

export type TimeRange = "today" | "week" | "month" | "quarter";

export interface DailyEngagement {
  date: string; // YYYY-MM-DD
  likes: number;
  reposts: number;
  replies: number;
  posts: number;
  originalPosts: number;
  replyPosts: number;
}

export interface PostEngagementData {
  uri: string;
  text: string;
  createdAt: string;
  likes: number;
  reposts: number;
  replies: number;
  totalEngagement: number;
}

export interface PostingTimeData {
  hourCounts: number[];
  hourEngagement: number[];
  bestEngagementHour: number;
  mostActiveHour: number;
}

export interface AnalyticsMetrics {
  likesReceived: number;
  repostsReceived: number;
  repliesReceived: number;
  followersCount: number;
  followsCount: number;
  postsCount: number;
  impressions: number;
  engagementRate: number;
  topPosts: AppBskyFeedDefs.FeedViewPost[];
  dailyEngagement: DailyEngagement[];
  postingTimes: PostingTimeData;
  postsForAnalysis: PostEngagementData[];
}

export interface FollowerMetrics {
  current: number;
  gained: number;
}

/**
 * Format a date as YYYY-MM-DD
 */
function formatDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * Get user analytics for a specific time range
 */
export async function getUserAnalytics(
  actor: string,
  timeRange: TimeRange = "week"
): Promise<AnalyticsMetrics> {
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
    case "quarter":
      startDate.setDate(now.getDate() - 90);
      break;
  }

  // Fetch author's posts to calculate engagement metrics
  let cursor: string | undefined;
  const allPosts: AppBskyFeedDefs.FeedViewPost[] = [];
  let hasMore = true;
  // Match web analytics data volume: 100 posts per page, up to 10 pages (1,000 posts max)
  const maxPages = timeRange === "today" ? 5 : 10;
  let pageCount = 0;

  // Fetch posts until we reach the time range or max pages
  while (hasMore && pageCount < maxPages) {
    const response = await getAuthorFeed(actor, { cursor, limit: 100, filter: "posts_and_author_threads" });
    const posts = response.feed;

    // Filter posts within time range, excluding reposts and other users' posts
    for (const post of posts) {
      const postDate = new Date(post.post.indexedAt);
      const isRepost = post.reason?.$type === "app.bsky.feed.defs#reasonRepost";
      // Verify this post was authored by the requested actor (not someone else's content)
      const isOwnPost = post.post.author.did === actor || post.post.author.handle === actor;

      // Skip posts from other users in threads — their indexedAt can be
      // much older than the feed position and must not trigger early exit
      if (!isOwnPost || isRepost) {
        continue;
      }

      if (postDate >= startDate && postDate <= now) {
        allPosts.push(post);
      } else if (postDate < startDate) {
        // Only stop when we reach the user's OWN post older than the range
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

  // Daily engagement aggregation
  const dailyMap: Record<string, DailyEngagement> = {};

  // Posting time analysis
  const hourCounts = new Array(24).fill(0);
  const hourEngagement = new Array(24).fill(0);

  // Posts for AI analysis
  const postsForAnalysis: PostEngagementData[] = [];

  for (const post of allPosts) {
    const likes = post.post.likeCount || 0;
    const reposts = post.post.repostCount || 0;
    const replies = post.post.replyCount || 0;
    const total = likes + reposts + replies;

    likesReceived += likes;
    repostsReceived += reposts;
    repliesReceived += replies;
    impressions += total;

    // Aggregate daily engagement
    const postDate = new Date(post.post.indexedAt);
    const dateKey = formatDateKey(postDate);
    if (!dailyMap[dateKey]) {
      dailyMap[dateKey] = { date: dateKey, likes: 0, reposts: 0, replies: 0, posts: 0, originalPosts: 0, replyPosts: 0 };
    }
    dailyMap[dateKey].likes += likes;
    dailyMap[dateKey].reposts += reposts;
    dailyMap[dateKey].replies += replies;
    dailyMap[dateKey].posts += 1;
    const isReply = !!(post.post.record as { reply?: unknown })?.reply;
    if (isReply) {
      dailyMap[dateKey].replyPosts += 1;
    } else {
      dailyMap[dateKey].originalPosts += 1;
    }

    // Posting time analysis
    const hour = postDate.getHours();
    hourCounts[hour]++;
    hourEngagement[hour] += total;

    // Collect post data for AI analysis
    const record = post.post.record as { text?: string } | undefined;
    postsForAnalysis.push({
      uri: post.post.uri,
      text: record?.text || "",
      createdAt: post.post.indexedAt,
      likes,
      reposts,
      replies,
      totalEngagement: total,
    });
  }

  // Build sorted daily engagement array
  const days = timeRange === "today" ? 1 : timeRange === "week" ? 7 : timeRange === "month" ? 30 : 90;
  const dailyEngagement: DailyEngagement[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = formatDateKey(d);
    dailyEngagement.push(dailyMap[key] || { date: key, likes: 0, reposts: 0, replies: 0, posts: 0, originalPosts: 0, replyPosts: 0 });
  }

  // Calculate best posting times
  const avgEngagementByHour = hourEngagement.map((total, hour) =>
    hourCounts[hour] > 0 ? total / hourCounts[hour] : 0,
  );
  const bestEngagementHour = avgEngagementByHour.reduce(
    (maxIdx, val, idx, arr) => (val > arr[maxIdx] ? idx : maxIdx),
    0,
  );
  const mostActiveHour = hourCounts.reduce(
    (maxIdx, val, idx, arr) => (val > arr[maxIdx] ? idx : maxIdx),
    0,
  );

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

  const engagementRate = allPosts.length > 0
    ? impressions / allPosts.length
    : 0;

  return {
    likesReceived,
    repostsReceived,
    repliesReceived,
    followersCount: profile.followersCount || 0,
    followsCount: profile.followsCount || 0,
    postsCount: allPosts.length,
    impressions,
    engagementRate,
    topPosts,
    dailyEngagement,
    postingTimes: {
      hourCounts,
      hourEngagement: avgEngagementByHour,
      bestEngagementHour,
      mostActiveHour,
    },
    postsForAnalysis,
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
