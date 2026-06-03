import { format, subDays } from "date-fns";
import { describe, expect, it } from "vitest";
import {
  buildEngagementChartData,
  buildPostFrequencyData,
  computePostingTimeAnalysis,
  summarizePostEngagement,
  type PostEngagement,
} from "./user-analytics-utils";

describe("buildEngagementChartData", () => {
  it("returns [] when no data", () => {
    expect(buildEngagementChartData(undefined, "7d")).toEqual([]);
  });

  it("produces one point per day for daily ranges", () => {
    expect(buildEngagementChartData({}, "7d")).toHaveLength(7);
    expect(buildEngagementChartData({}, "30d")).toHaveLength(30);
    expect(buildEngagementChartData({}, "90d")).toHaveLength(90);
  });

  it("produces 24 hourly points for the 24h range", () => {
    expect(buildEngagementChartData({}, "24h")).toHaveLength(24);
  });

  it("zero-fills missing days", () => {
    const series = buildEngagementChartData({}, "7d");
    expect(series.every((p) => p.total === 0)).toBe(true);
  });

  it("sums likes+reposts+replies for a matching day (today is last)", () => {
    const todayKey = format(new Date(), "yyyy-MM-dd");
    const series = buildEngagementChartData(
      { [todayKey]: { likes: 5, reposts: 2, replies: 1 } },
      "7d",
    );
    const today = series[series.length - 1];
    expect(today.likes).toBe(5);
    expect(today.reposts).toBe(2);
    expect(today.replies).toBe(1);
    expect(today.total).toBe(8);
  });
});

describe("buildPostFrequencyData", () => {
  it("returns [] when no data", () => {
    expect(buildPostFrequencyData(undefined, "7d")).toEqual([]);
  });

  it("reflects posts/original/reply counts for a matching day", () => {
    const yesterdayKey = format(subDays(new Date(), 1), "yyyy-MM-dd");
    const series = buildPostFrequencyData(
      { [yesterdayKey]: { posts: 4, originalPosts: 3, replyPosts: 1 } },
      "7d",
    );
    const yesterday = series[series.length - 2];
    expect(yesterday.posts).toBe(4);
    expect(yesterday.originalPosts).toBe(3);
    expect(yesterday.replyPosts).toBe(1);
  });
});

describe("computePostingTimeAnalysis", () => {
  it("returns null with no posts", () => {
    expect(computePostingTimeAnalysis(undefined)).toBeNull();
  });

  it("buckets posts by hour and finds the peak hour", () => {
    const at = (hour: number) => {
      const d = new Date();
      d.setHours(hour, 0, 0, 0);
      return d.toISOString();
    };
    const result = computePostingTimeAnalysis([
      { createdAt: at(14), totalEngagement: 10 },
      { createdAt: at(14), totalEngagement: 20 },
      { createdAt: at(9), totalEngagement: 1 },
    ]);
    expect(result).not.toBeNull();
    expect(result!.hourCounts[14]).toBe(2);
    expect(result!.hourCounts[9]).toBe(1);
    expect(result!.avgEngagementByHour[14]).toBe(15); // (10+20)/2
    expect(result!.maxPostsHour).toBe(14);
    expect(result!.maxEngagementHour).toBe(14);
  });
});

describe("summarizePostEngagement", () => {
  function post(
    overrides: Partial<PostEngagement> & { totalEngagement: number },
  ): PostEngagement {
    return {
      uri: "at://post",
      text: "t",
      createdAt: "2026-01-01T00:00:00Z",
      likes: 0,
      reposts: 0,
      replies: 0,
      author: { handle: "a" },
      ...overrides,
    };
  }

  it("sums likes/reposts/replies and total engagement", () => {
    const summary = summarizePostEngagement([
      post({ likes: 5, reposts: 2, replies: 1, totalEngagement: 8 }),
      post({ likes: 3, reposts: 0, replies: 4, totalEngagement: 7 }),
    ]);
    expect(summary.totalLikes).toBe(8);
    expect(summary.totalReposts).toBe(2);
    expect(summary.totalReplies).toBe(5);
    expect(summary.totalEngagement).toBe(15);
  });

  it("returns the top 10 posts by engagement, descending", () => {
    const posts = Array.from({ length: 15 }, (_, i) =>
      post({ uri: `at://p${i}`, totalEngagement: i }),
    );
    const summary = summarizePostEngagement(posts);
    expect(summary.topPosts).toHaveLength(10);
    expect(summary.topPosts[0].totalEngagement).toBe(14);
    expect(summary.topPosts[9].totalEngagement).toBe(5);
  });

  it("handles an empty list", () => {
    const summary = summarizePostEngagement([]);
    expect(summary).toEqual({
      topPosts: [],
      totalLikes: 0,
      totalReposts: 0,
      totalReplies: 0,
      totalEngagement: 0,
    });
  });
});
