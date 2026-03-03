import { getProfile } from "./profiles";
import { getAuthorFeed } from "./feeds";
import { getNotifications } from "./notifications";
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
 * Format a date as YYYY-MM-DD-HH for hourly bucketing
 */
function formatHourKey(date: Date): string {
  return `${formatDateKey(date)}-${String(date.getHours()).padStart(2, '0')}`;
}

interface EngagementFromNotifications {
  engagementMap: Record<string, { likes: number; reposts: number; replies: number }>;
  totalLikes: number;
  totalReposts: number;
  totalReplies: number;
}

/**
 * Fetch engagement received from notifications API.
 * Pages through notifications until reaching startDate, bucketing
 * by hour (today) or day (week/month/quarter).
 */
async function fetchEngagementFromNotifications(
  startDate: Date,
  timeRange: TimeRange,
): Promise<EngagementFromNotifications> {
  const engagementMap: Record<string, { likes: number; reposts: number; replies: number }> = {};
  let totalLikes = 0;
  let totalReposts = 0;
  let totalReplies = 0;

  const useHourlyBuckets = timeRange === "today";
  const maxPages = timeRange === "today" ? 5 : timeRange === "week" ? 10 : timeRange === "month" ? 15 : 20;

  let cursor: string | undefined;
  let pageCount = 0;
  let reachedStart = false;

  while (pageCount < maxPages && !reachedStart) {
    const response = await getNotifications({ limit: 100, cursor });

    for (const notif of response.notifications) {
      const indexedAt = new Date(notif.indexedAt);

      if (indexedAt < startDate) {
        reachedStart = true;
        break;
      }

      const reason = notif.reason;
      if (reason !== "like" && reason !== "repost" && reason !== "reply") {
        continue;
      }

      const bucketKey = useHourlyBuckets ? formatHourKey(indexedAt) : formatDateKey(indexedAt);
      if (!engagementMap[bucketKey]) {
        engagementMap[bucketKey] = { likes: 0, reposts: 0, replies: 0 };
      }

      if (reason === "like") {
        engagementMap[bucketKey].likes++;
        totalLikes++;
      } else if (reason === "repost") {
        engagementMap[bucketKey].reposts++;
        totalReposts++;
      } else if (reason === "reply") {
        engagementMap[bucketKey].replies++;
        totalReplies++;
      }
    }

    cursor = response.cursor;
    if (!cursor) break;
    pageCount++;
  }

  return { engagementMap, totalLikes, totalReposts, totalReplies };
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
      startDate.setTime(now.getTime() - 24 * 60 * 60 * 1000);
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

  // Fetch engagement received from notifications
  const notifData = await fetchEngagementFromNotifications(startDate, timeRange);
  const { totalLikes: likesReceived, totalReposts: repostsReceived, totalReplies: repliesReceived } = notifData;
  const impressions = likesReceived + repostsReceived + repliesReceived;

  // Post-based aggregation for posting frequency and posting times
  const postDailyMap: Record<string, { posts: number; originalPosts: number; replyPosts: number }> = {};
  const hourCounts = new Array(24).fill(0);
  const hourEngagement = new Array(24).fill(0);
  const postsForAnalysis: PostEngagementData[] = [];

  for (const post of allPosts) {
    const likes = post.post.likeCount || 0;
    const reposts = post.post.repostCount || 0;
    const replies = post.post.replyCount || 0;
    const total = likes + reposts + replies;

    const postDate = new Date(post.post.indexedAt);
    const dateKey = timeRange === "today" ? formatHourKey(postDate) : formatDateKey(postDate);

    if (!postDailyMap[dateKey]) {
      postDailyMap[dateKey] = { posts: 0, originalPosts: 0, replyPosts: 0 };
    }
    postDailyMap[dateKey].posts += 1;
    const isReply = !!(post.post.record as { reply?: unknown })?.reply;
    if (isReply) {
      postDailyMap[dateKey].replyPosts += 1;
    } else {
      postDailyMap[dateKey].originalPosts += 1;
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

  // Build sorted engagement array merging notification engagement + post frequency
  const dailyEngagement: DailyEngagement[] = [];
  if (timeRange === "today") {
    for (let i = 23; i >= 0; i--) {
      const d = new Date();
      d.setHours(d.getHours() - i, 0, 0, 0);
      const key = formatHourKey(d);
      const eng = notifData.engagementMap[key] || { likes: 0, reposts: 0, replies: 0 };
      const postData = postDailyMap[key] || { posts: 0, originalPosts: 0, replyPosts: 0 };
      dailyEngagement.push({ date: key, ...eng, ...postData });
    }
  } else {
    const days = timeRange === "week" ? 7 : timeRange === "month" ? 30 : 90;
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = formatDateKey(d);
      const eng = notifData.engagementMap[key] || { likes: 0, reposts: 0, replies: 0 };
      const postData = postDailyMap[key] || { posts: 0, originalPosts: 0, replyPosts: 0 };
      dailyEngagement.push({ date: key, ...eng, ...postData });
    }
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
