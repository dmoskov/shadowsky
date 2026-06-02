/**
 * Pure chart/stat computations for UserAnalytics. Extracted from the component
 * so they're unit-testable and the page stays focused on rendering.
 */

import { format, subDays } from "date-fns";

export type DateRange = "24h" | "7d" | "30d" | "90d";

export interface EngagementDay {
  likes: number;
  reposts: number;
  replies: number;
  posts: number;
  originalPosts: number;
  replyPosts: number;
}

export interface EngagementPoint {
  date: string;
  total: number;
  likes: number;
  reposts: number;
  replies: number;
}

export interface PostFrequencyPoint {
  date: string;
  posts: number;
  originalPosts: number;
  replyPosts: number;
}

export interface TimingPost {
  createdAt: string;
  totalEngagement: number;
}

export interface PostingTimeAnalysis {
  hourCounts: number[];
  avgEngagementByHour: number[];
  maxEngagementHour: number;
  maxPostsHour: number;
  maxCount: number;
  maxAvgEngagement: number;
}

type DailyEngagement = Record<string, Partial<EngagementDay>> | undefined;

function daysForRange(dateRange: DateRange): number {
  return dateRange === "7d" ? 7 : dateRange === "30d" ? 30 : 90;
}

/** Build the engagement (likes/reposts/replies) chart series for the range. */
export function buildEngagementChartData(
  dailyEngagement: DailyEngagement,
  dateRange: DateRange,
): EngagementPoint[] {
  if (!dailyEngagement) return [];

  const data: EngagementPoint[] = [];

  if (dateRange === "24h") {
    for (let i = 23; i >= 0; i--) {
      const date = new Date();
      date.setHours(date.getHours() - i);
      const dateKey = format(date, "yyyy-MM-dd-HH");
      const h = dailyEngagement[dateKey] || {};
      const likes = h.likes || 0;
      const reposts = h.reposts || 0;
      const replies = h.replies || 0;
      data.push({
        date: format(date, "ha"),
        total: likes + reposts + replies,
        likes,
        reposts,
        replies,
      });
    }
  } else {
    const days = daysForRange(dateRange);
    for (let i = days - 1; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const dateKey = format(date, "yyyy-MM-dd");
      const d = dailyEngagement[dateKey] || {};
      const likes = d.likes || 0;
      const reposts = d.reposts || 0;
      const replies = d.replies || 0;
      data.push({
        date: format(date, dateRange === "7d" ? "EEE" : "M/d"),
        total: likes + reposts + replies,
        likes,
        reposts,
        replies,
      });
    }
  }

  return data;
}

/** Build the posting-frequency (posts/original/reply) chart series. */
export function buildPostFrequencyData(
  dailyEngagement: DailyEngagement,
  dateRange: DateRange,
): PostFrequencyPoint[] {
  if (!dailyEngagement) return [];

  const data: PostFrequencyPoint[] = [];

  if (dateRange === "24h") {
    for (let i = 23; i >= 0; i--) {
      const date = new Date();
      date.setHours(date.getHours() - i);
      const dateKey = format(date, "yyyy-MM-dd-HH");
      const h = dailyEngagement[dateKey] || {};
      data.push({
        date: format(date, "ha"),
        posts: h.posts || 0,
        originalPosts: h.originalPosts || 0,
        replyPosts: h.replyPosts || 0,
      });
    }
  } else {
    const days = daysForRange(dateRange);
    for (let i = days - 1; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const dateKey = format(date, "yyyy-MM-dd");
      const d = dailyEngagement[dateKey] || {};
      data.push({
        date: format(date, dateRange === "7d" ? "EEE" : "M/d"),
        posts: d.posts || 0,
        originalPosts: d.originalPosts || 0,
        replyPosts: d.replyPosts || 0,
      });
    }
  }

  return data;
}

/** Aggregate posts by hour-of-day for the posting-time heatmap. */
export function computePostingTimeAnalysis(
  posts: TimingPost[] | undefined,
): PostingTimeAnalysis | null {
  if (!posts) return null;

  const hourCounts = new Array(24).fill(0);
  const hourEngagement = new Array(24).fill(0);

  posts.forEach((post) => {
    const hour = new Date(post.createdAt).getHours();
    hourCounts[hour]++;
    hourEngagement[hour] += post.totalEngagement;
  });

  const avgEngagementByHour = hourEngagement.map((total, hour) =>
    hourCounts[hour] > 0 ? total / hourCounts[hour] : 0,
  );

  const maxEngagementHour = avgEngagementByHour.reduce(
    (maxIdx, val, idx, arr) => (val > arr[maxIdx] ? idx : maxIdx),
    0,
  );

  const maxPostsHour = hourCounts.reduce(
    (maxIdx, val, idx, arr) => (val > arr[maxIdx] ? idx : maxIdx),
    0,
  );

  return {
    hourCounts,
    avgEngagementByHour,
    maxEngagementHour,
    maxPostsHour,
    maxCount: Math.max(...hourCounts, 1),
    maxAvgEngagement: Math.max(...avgEngagementByHour, 1),
  };
}
