import { useQuery } from "@tanstack/react-query";
import { endOfDay, format, startOfDay, subDays } from "date-fns";
import {
  BarChart3,
  Clock,
  Heart,
  Lightbulb,
  MessageCircle,
  Repeat2,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import React, { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { useAuth } from "../contexts/AuthContext";
import {
  analyzePosts,
  type OptimalTimeRecommendation,
  type PostAnalysisPost,
} from "../services/anthropic";
import { proxifyBskyImage } from "../utils/image-proxy";

type DateRange = "24h" | "7d" | "30d" | "90d";

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
}

export const UserAnalytics: React.FC = () => {
  const { agent, session } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [analysisRequested, setAnalysisRequested] = useState(false);

  // Get date range from URL, default to "30d"
  const rangeParam = searchParams.get("range");
  const dateRange: DateRange =
    rangeParam === "24h" ||
    rangeParam === "7d" ||
    rangeParam === "30d" ||
    rangeParam === "90d"
      ? rangeParam
      : "30d";

  const setDateRange = (range: DateRange) => {
    setSearchParams(range === "30d" ? {} : { range }, { replace: true });
  };

  // Always use logged-in user's handle
  const activeHandle = session?.handle;

  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    const end = endOfDay(now);
    let start: Date;

    switch (dateRange) {
      case "24h":
        start = startOfDay(subDays(now, 1));
        break;
      case "7d":
        start = startOfDay(subDays(now, 7));
        break;
      case "30d":
        start = startOfDay(subDays(now, 30));
        break;
      case "90d":
        start = startOfDay(subDays(now, 90));
        break;
    }

    return { startDate: start, endDate: end };
  }, [dateRange]);

  const { data: profileData, isLoading: isLoadingProfile } = useQuery({
    queryKey: ["user-profile", activeHandle],
    queryFn: async () => {
      if (!agent || !activeHandle) throw new Error("No user to fetch");
      const profile = await agent.getProfile({ actor: activeHandle });
      return profile.data;
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!agent && !!activeHandle,
  });

  const { data: postsData, isLoading: isLoadingPosts } = useQuery({
    queryKey: ["user-posts", activeHandle, dateRange],
    queryFn: async () => {
      if (!agent || !activeHandle) throw new Error("No user to fetch");

      const allPosts: any[] = [];
      let cursor: string | undefined;
      let shouldContinue = true;
      const maxPages = dateRange === "24h" ? 5 : 10;

      for (let page = 0; page < maxPages && shouldContinue; page++) {
        const response = await agent.getAuthorFeed({
          actor: activeHandle,
          limit: 100,
          cursor,
        });

        const filteredPosts = response.data.feed.filter((item) => {
          const postDate = new Date(item.post.indexedAt);
          const isRepost =
            item.reason?.$type === "app.bsky.feed.defs#reasonRepost";
          const isInRange = postDate >= startDate && postDate <= endDate;
          return !isRepost && isInRange;
        });

        allPosts.push(...filteredPosts);
        cursor = response.data.cursor;

        const oldestInBatch = response.data.feed[response.data.feed.length - 1];
        if (oldestInBatch) {
          const oldestDate = new Date(oldestInBatch.post.indexedAt);
          if (oldestDate < startDate || !cursor) {
            shouldContinue = false;
          }
        } else {
          shouldContinue = false;
        }
      }

      const postsWithEngagement: PostEngagement[] = allPosts.map((item) => ({
        uri: item.post.uri,
        text: item.post.record?.text || "",
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
      }));

      const topPosts = [...postsWithEngagement]
        .sort((a, b) => b.totalEngagement - a.totalEngagement)
        .slice(0, 10);

      const totalLikes = postsWithEngagement.reduce(
        (sum, post) => sum + post.likes,
        0,
      );
      const totalReposts = postsWithEngagement.reduce(
        (sum, post) => sum + post.reposts,
        0,
      );
      const totalReplies = postsWithEngagement.reduce(
        (sum, post) => sum + post.replies,
        0,
      );

      // Aggregate by hour for 24h view, by day for others
      const dailyEngagement = allPosts.reduce(
        (acc, item) => {
          const postDate = new Date(item.post.indexedAt);
          const key =
            dateRange === "24h"
              ? format(postDate, "yyyy-MM-dd-HH") // Hour-level for 24h
              : format(postDate, "yyyy-MM-dd"); // Day-level for others
          if (!acc[key]) {
            acc[key] = {
              likes: 0,
              reposts: 0,
              replies: 0,
              posts: 0,
              originalPosts: 0,
              replyPosts: 0,
            };
          }
          acc[key].likes += item.post.likeCount || 0;
          acc[key].reposts += item.post.repostCount || 0;
          acc[key].replies += item.post.replyCount || 0;
          acc[key].posts += 1;
          // Check if post is a reply (has reply field in record)
          const isReply = !!(item.post.record as { reply?: unknown })?.reply;
          if (isReply) {
            acc[key].replyPosts += 1;
          } else {
            acc[key].originalPosts += 1;
          }
          return acc;
        },
        {} as Record<
          string,
          {
            likes: number;
            reposts: number;
            replies: number;
            posts: number;
            originalPosts: number;
            replyPosts: number;
          }
        >,
      );

      return {
        posts: postsWithEngagement,
        topPosts,
        totalPosts: postsWithEngagement.length,
        totalLikes,
        totalReposts,
        totalReplies,
        totalEngagement: totalLikes + totalReposts + totalReplies,
        dailyEngagement,
      };
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!agent && !!activeHandle,
  });

  const { data: analysisData, isLoading: isLoadingAnalysis } = useQuery({
    queryKey: ["post-analysis", activeHandle, dateRange],
    queryFn: async () => {
      if (!postsData?.posts || postsData.posts.length === 0) {
        throw new Error("No posts available for analysis");
      }

      const postsForAnalysis: PostAnalysisPost[] = postsData.posts.map(
        (post) => ({
          text: post.text,
          createdAt: post.createdAt,
          likes: post.likes,
          reposts: post.reposts,
          replies: post.replies,
        }),
      );

      return await analyzePosts(postsForAnalysis);
    },
    staleTime: 30 * 60 * 1000, // Cache for 30 minutes
    enabled:
      analysisRequested && !!postsData?.posts && postsData.posts.length > 0,
  });

  const engagementChartData = useMemo(() => {
    if (!postsData?.dailyEngagement) return [];

    const data = [];

    if (dateRange === "24h") {
      // Show hourly data for 24-hour view
      for (let i = 23; i >= 0; i--) {
        const date = new Date();
        date.setHours(date.getHours() - i);
        const dateKey = format(date, "yyyy-MM-dd-HH");
        const hourData = postsData.dailyEngagement[dateKey] || {
          likes: 0,
          reposts: 0,
          replies: 0,
          posts: 0,
        };
        data.push({
          date: format(date, "ha"), // e.g., "2pm"
          total: hourData.likes + hourData.reposts + hourData.replies,
          likes: hourData.likes,
          reposts: hourData.reposts,
          replies: hourData.replies,
        });
      }
    } else {
      // Show daily data for other views
      const days = dateRange === "7d" ? 7 : dateRange === "30d" ? 30 : 90;

      for (let i = days - 1; i >= 0; i--) {
        const date = subDays(new Date(), i);
        const dateKey = format(date, "yyyy-MM-dd");
        const dayData = postsData.dailyEngagement[dateKey] || {
          likes: 0,
          reposts: 0,
          replies: 0,
          posts: 0,
        };
        data.push({
          date: format(date, dateRange === "7d" ? "EEE" : "M/d"),
          total: dayData.likes + dayData.reposts + dayData.replies,
          likes: dayData.likes,
          reposts: dayData.reposts,
          replies: dayData.replies,
        });
      }
    }

    return data;
  }, [postsData, dateRange]);

  const maxEngagement = useMemo(() => {
    return Math.max(1, ...engagementChartData.map((d) => d.total));
  }, [engagementChartData]);

  const postingTimeAnalysis = useMemo(() => {
    if (!postsData?.posts) return null;

    const hourCounts = new Array(24).fill(0);
    const hourEngagement = new Array(24).fill(0);

    postsData.posts.forEach((post) => {
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
  }, [postsData]);

  const postFrequencyData = useMemo(() => {
    if (!postsData?.dailyEngagement) return [];

    const data = [];

    if (dateRange === "24h") {
      // Show hourly data for 24-hour view
      for (let i = 23; i >= 0; i--) {
        const date = new Date();
        date.setHours(date.getHours() - i);
        const dateKey = format(date, "yyyy-MM-dd-HH");
        const hourData = postsData.dailyEngagement[dateKey] || {
          posts: 0,
          originalPosts: 0,
          replyPosts: 0,
        };
        data.push({
          date: format(date, "ha"), // e.g., "2pm"
          posts: hourData.posts,
          originalPosts: hourData.originalPosts,
          replyPosts: hourData.replyPosts,
        });
      }
    } else {
      // Show daily data for other views
      const days = dateRange === "7d" ? 7 : dateRange === "30d" ? 30 : 90;

      for (let i = days - 1; i >= 0; i--) {
        const date = subDays(new Date(), i);
        const dateKey = format(date, "yyyy-MM-dd");
        const dayData = postsData.dailyEngagement[dateKey] || {
          posts: 0,
          originalPosts: 0,
          replyPosts: 0,
        };
        data.push({
          date: format(date, dateRange === "7d" ? "EEE" : "M/d"),
          posts: dayData.posts,
          originalPosts: dayData.originalPosts,
          replyPosts: dayData.replyPosts,
        });
      }
    }

    return data;
  }, [postsData, dateRange]);

  const maxPostsPerDay = useMemo(() => {
    return Math.max(1, ...postFrequencyData.map((d) => d.posts));
  }, [postFrequencyData]);

  const isLoading = isLoadingProfile || isLoadingPosts;

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div
            className="h-8 w-1/4 rounded"
            style={{ backgroundColor: "var(--asph-bg-tertiary)" }}
          />
          <div
            className="h-64 rounded"
            style={{ backgroundColor: "var(--asph-bg-tertiary)" }}
          />
          <div
            className="h-64 rounded"
            style={{ backgroundColor: "var(--asph-bg-tertiary)" }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex-1">
          <h1
            className="mb-2 text-2xl font-bold"
            style={{ color: "var(--asph-text-primary)" }}
          >
            Performance Analytics
          </h1>
          <p
            className="text-sm"
            style={{ color: "var(--asph-text-secondary)" }}
          >
            Track your post engagement over time
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setDateRange("24h")}
            className="rounded-lg px-3 py-1.5 text-sm transition-all hover:opacity-80"
            style={{
              backgroundColor:
                dateRange === "24h"
                  ? "var(--asph-primary)"
                  : "var(--asph-bg-tertiary)",
              color:
                dateRange === "24h" ? "white" : "var(--asph-text-secondary)",
            }}
          >
            24 hours
          </button>
          <button
            onClick={() => setDateRange("7d")}
            className="rounded-lg px-3 py-1.5 text-sm transition-all hover:opacity-80"
            style={{
              backgroundColor:
                dateRange === "7d"
                  ? "var(--asph-primary)"
                  : "var(--asph-bg-tertiary)",
              color:
                dateRange === "7d" ? "white" : "var(--asph-text-secondary)",
            }}
          >
            7 days
          </button>
          <button
            onClick={() => setDateRange("30d")}
            className="rounded-lg px-3 py-1.5 text-sm transition-all hover:opacity-80"
            style={{
              backgroundColor:
                dateRange === "30d"
                  ? "var(--asph-primary)"
                  : "var(--asph-bg-tertiary)",
              color:
                dateRange === "30d" ? "white" : "var(--asph-text-secondary)",
            }}
          >
            30 days
          </button>
          <button
            onClick={() => setDateRange("90d")}
            className="rounded-lg px-3 py-1.5 text-sm transition-all hover:opacity-80"
            style={{
              backgroundColor:
                dateRange === "90d"
                  ? "var(--asph-primary)"
                  : "var(--asph-bg-tertiary)",
              color:
                dateRange === "90d" ? "white" : "var(--asph-text-secondary)",
            }}
          >
            90 days
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-5">
        <div
          className="asph-card p-4"
          style={{ background: "var(--asph-bg-secondary)" }}
        >
          <div className="flex items-center gap-2 text-sm">
            <Users size={16} style={{ color: "var(--asph-text-secondary)" }} />
            <span style={{ color: "var(--asph-text-secondary)" }}>
              Followers
            </span>
          </div>
          <div
            className="mt-2 text-2xl font-bold"
            style={{ color: "var(--asph-text-primary)" }}
          >
            {profileData?.followersCount?.toLocaleString() || 0}
          </div>
        </div>

        <div
          className="asph-card p-4"
          style={{ background: "var(--asph-bg-secondary)" }}
        >
          <div className="flex items-center gap-2 text-sm">
            <Heart size={16} className="text-red-500" />
            <span style={{ color: "var(--asph-text-secondary)" }}>Likes</span>
          </div>
          <div className="mt-2 text-2xl font-bold text-red-600 dark:text-red-500">
            {postsData?.totalLikes?.toLocaleString() || 0}
          </div>
        </div>

        <div
          className="asph-card p-4"
          style={{ background: "var(--asph-bg-secondary)" }}
        >
          <div className="flex items-center gap-2 text-sm">
            <Repeat2 size={16} className="text-blue-600 dark:text-blue-500" />
            <span style={{ color: "var(--asph-text-secondary)" }}>Reposts</span>
          </div>
          <div className="mt-2 text-2xl font-bold text-blue-600 dark:text-blue-500">
            {postsData?.totalReposts?.toLocaleString() || 0}
          </div>
        </div>

        <div
          className="asph-card p-4"
          style={{ background: "var(--asph-bg-secondary)" }}
        >
          <div className="flex items-center gap-2 text-sm">
            <MessageCircle
              size={16}
              className="text-green-600 dark:text-green-500"
            />
            <span style={{ color: "var(--asph-text-secondary)" }}>Replies</span>
          </div>
          <div className="mt-2 text-2xl font-bold text-green-600 dark:text-green-500">
            {postsData?.totalReplies?.toLocaleString() || 0}
          </div>
        </div>

        <div
          className="asph-card p-4"
          style={{ background: "var(--asph-bg-secondary)" }}
        >
          <div className="flex items-center gap-2 text-sm">
            <TrendingUp
              size={16}
              className="text-purple-600 dark:text-purple-500"
            />
            <span style={{ color: "var(--asph-text-secondary)" }}>
              Engagement Rate
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold text-purple-600 dark:text-purple-500">
            {postsData?.totalPosts && postsData.totalPosts > 0
              ? (postsData.totalEngagement / postsData.totalPosts).toFixed(1)
              : "0.0"}
          </div>
          <div
            className="mt-1 text-xs"
            style={{ color: "var(--asph-text-secondary)" }}
          >
            avg per post
          </div>
        </div>
      </div>

      <div
        className="asph-card p-6"
        style={{ background: "var(--asph-bg-secondary)" }}
      >
        <h2
          className="mb-4 flex items-center gap-2 text-lg font-semibold"
          style={{ color: "var(--asph-text-primary)" }}
        >
          <BarChart3 size={20} className="text-purple-500" />
          Engagement Over Time
        </h2>
        <div className="relative" style={{ height: "300px" }}>
          <div
            className="absolute bottom-0 left-0 top-0 flex flex-col justify-between text-xs"
            style={{ width: "40px", color: "var(--asph-text-secondary)" }}
          >
            <span>{maxEngagement}</span>
            <span>{Math.round(maxEngagement * 0.75)}</span>
            <span>{Math.round(maxEngagement * 0.5)}</span>
            <span>{Math.round(maxEngagement * 0.25)}</span>
            <span>0</span>
          </div>

          <div className="relative ml-12 h-full">
            <div className="absolute inset-0">
              {[0, 0.25, 0.5, 0.75, 1].map((fraction) => (
                <div
                  key={fraction}
                  className="absolute w-full"
                  style={{
                    bottom: `${fraction * 100}%`,
                    borderBottom: "1px solid",
                    borderColor: "var(--asph-border-secondary)",
                    opacity: fraction === 0 ? 1 : 0.2,
                  }}
                />
              ))}
            </div>

            <div
              className="relative flex h-full items-end justify-between"
              style={{ gap: "2px", paddingBottom: "30px" }}
            >
              {engagementChartData.map((data, index) => {
                const barWidth = `${100 / engagementChartData.length - 1}%`;
                return (
                  <div
                    key={data.date}
                    className="group relative"
                    style={{
                      width: barWidth,
                      minWidth:
                        engagementChartData.length > 30 ? "8px" : "20px",
                      maxWidth:
                        engagementChartData.length > 30 ? "30px" : "60px",
                    }}
                  >
                    <div className="absolute bottom-0 left-0 right-0 flex flex-col-reverse overflow-hidden rounded-t-lg transition-all duration-300 hover:opacity-90">
                      {data.likes > 0 && (
                        <div
                          className="w-full transition-all duration-500"
                          style={{
                            height: `${(data.likes / maxEngagement) * 270}px`,
                            background:
                              "linear-gradient(180deg, #f87171 0%, #ef4444 100%)",
                          }}
                          title={`${data.likes} likes`}
                        />
                      )}
                      {data.reposts > 0 && (
                        <div
                          className="w-full transition-all duration-500"
                          style={{
                            height: `${(data.reposts / maxEngagement) * 270}px`,
                            background:
                              "linear-gradient(180deg, #93c5fd 0%, #60a5fa 100%)",
                          }}
                          title={`${data.reposts} reposts`}
                        />
                      )}
                      {data.replies > 0 && (
                        <div
                          className="w-full transition-all duration-500"
                          style={{
                            height: `${(data.replies / maxEngagement) * 270}px`,
                            background:
                              "linear-gradient(180deg, #86efac 0%, #4ade80 100%)",
                          }}
                          title={`${data.replies} replies`}
                        />
                      )}
                    </div>

                    <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 transform opacity-0 transition-opacity group-hover:opacity-100">
                      <div
                        className="whitespace-nowrap rounded-lg px-3 py-2 text-xs"
                        style={{
                          backgroundColor: "var(--asph-bg-primary)",
                          color: "var(--asph-text-primary)",
                          boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                          border: "1px solid var(--asph-border-primary)",
                        }}
                      >
                        <div className="mb-1 font-bold">{data.total} total</div>
                        {data.likes > 0 && (
                          <div style={{ color: "#dc2626" }}>
                            {data.likes} likes
                          </div>
                        )}
                        {data.reposts > 0 && (
                          <div style={{ color: "#2563eb" }}>
                            {data.reposts} reposts
                          </div>
                        )}
                        {data.replies > 0 && (
                          <div style={{ color: "#16a34a" }}>
                            {data.replies} replies
                          </div>
                        )}
                      </div>
                    </div>

                    {(engagementChartData.length <= 30 ||
                      index % 4 === 0 ||
                      index === engagementChartData.length - 1) && (
                      <div className="absolute left-0 right-0 top-full mt-1 text-center">
                        <span
                          className="text-xs"
                          style={{
                            color: "var(--asph-text-secondary)",
                            fontSize:
                              engagementChartData.length > 30 ? "9px" : "10px",
                          }}
                        >
                          {data.date}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-3 pb-2 text-xs">
            <div className="flex items-center gap-1">
              <div
                className="h-3 w-3 rounded"
                style={{ backgroundColor: "#ef4444" }}
              />
              <span style={{ color: "var(--asph-text-secondary)" }}>Likes</span>
            </div>
            <div className="flex items-center gap-1">
              <div
                className="h-3 w-3 rounded"
                style={{ backgroundColor: "#60a5fa" }}
              />
              <span style={{ color: "var(--asph-text-secondary)" }}>
                Reposts
              </span>
            </div>
            <div className="flex items-center gap-1">
              <div
                className="h-3 w-3 rounded"
                style={{ backgroundColor: "#4ade80" }}
              />
              <span style={{ color: "var(--asph-text-secondary)" }}>
                Replies
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {postFrequencyData.length > 0 && (
          <div
            className="asph-card min-w-0 overflow-hidden p-6"
            style={{ background: "var(--asph-bg-secondary)" }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2
                className="flex items-center gap-2 text-lg font-semibold"
                style={{ color: "var(--asph-text-primary)" }}
              >
                <Clock size={20} className="text-orange-500" />
                Posting Frequency
              </h2>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1">
                  <div
                    className="h-3 w-3 rounded-sm"
                    style={{ backgroundColor: "#f97316" }}
                  />
                  <span style={{ color: "var(--asph-text-secondary)" }}>
                    Posts
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <div
                    className="h-3 w-3 rounded-sm"
                    style={{ backgroundColor: "#4ade80" }}
                  />
                  <span style={{ color: "var(--asph-text-secondary)" }}>
                    Replies
                  </span>
                </div>
              </div>
            </div>
            <div className="relative" style={{ height: "250px" }}>
              <div
                className="absolute bottom-0 left-0 top-0 flex flex-col justify-between text-xs"
                style={{ width: "30px", color: "var(--asph-text-secondary)" }}
              >
                <span>{maxPostsPerDay}</span>
                <span>{Math.round(maxPostsPerDay * 0.75)}</span>
                <span>{Math.round(maxPostsPerDay * 0.5)}</span>
                <span>{Math.round(maxPostsPerDay * 0.25)}</span>
                <span>0</span>
              </div>

              <div className="relative ml-10 h-full">
                <div className="absolute inset-0">
                  {[0, 0.25, 0.5, 0.75, 1].map((fraction) => (
                    <div
                      key={fraction}
                      className="absolute w-full"
                      style={{
                        bottom: `${fraction * 100}%`,
                        borderBottom: "1px solid",
                        borderColor: "var(--asph-border-secondary)",
                        opacity: fraction === 0 ? 1 : 0.2,
                      }}
                    />
                  ))}
                </div>

                <div
                  className="relative flex h-full items-end justify-between"
                  style={{ gap: "2px", paddingBottom: "30px" }}
                >
                  {postFrequencyData.map((data, index) => (
                    <div
                      key={data.date}
                      className="group relative flex flex-col justify-end"
                      style={{
                        width: `${100 / postFrequencyData.length - 0.5}%`,
                        minWidth: "6px",
                        height: "220px",
                      }}
                    >
                      {/* Stacked bar: Posts (orange) at bottom, Replies (green) on top */}
                      {data.replyPosts > 0 && (
                        <div
                          className="w-full rounded-t-lg transition-all duration-300 hover:opacity-80"
                          style={{
                            height: `${(data.replyPosts / maxPostsPerDay) * 220}px`,
                            background: "#4ade80",
                          }}
                          title={`${data.replyPosts} replies`}
                        />
                      )}
                      {data.originalPosts > 0 && (
                        <div
                          className="w-full transition-all duration-300 hover:opacity-80"
                          style={{
                            height: `${(data.originalPosts / maxPostsPerDay) * 220}px`,
                            background:
                              "linear-gradient(180deg, #fb923c 0%, #f97316 100%)",
                            borderTopLeftRadius:
                              data.replyPosts === 0 ? "0.5rem" : "0",
                            borderTopRightRadius:
                              data.replyPosts === 0 ? "0.5rem" : "0",
                          }}
                          title={`${data.originalPosts} posts`}
                        />
                      )}

                      {(() => {
                        // Calculate label interval to show ~8-10 labels max
                        const len = postFrequencyData.length;
                        const labelInterval =
                          len <= 10
                            ? 1
                            : len <= 21
                              ? 2
                              : len <= 35
                                ? 4
                                : len <= 60
                                  ? 7
                                  : 14;
                        const showLabel =
                          index === 0 ||
                          index === len - 1 ||
                          index % labelInterval === 0;
                        return (
                          showLabel && (
                            <div className="absolute left-0 right-0 top-full mt-1 text-center">
                              <span
                                className="whitespace-nowrap text-xs"
                                style={{
                                  color: "var(--asph-text-secondary)",
                                  fontSize: len > 60 ? "9px" : "10px",
                                }}
                              >
                                {data.date}
                              </span>
                            </div>
                          )
                        );
                      })()}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {postingTimeAnalysis && (
          <div
            className="asph-card min-w-0 p-6"
            style={{ background: "var(--asph-bg-secondary)" }}
          >
            <h2
              className="mb-4 flex items-center gap-2 text-lg font-semibold"
              style={{ color: "var(--asph-text-primary)" }}
            >
              <Clock size={20} className="text-purple-500" />
              Best Posting Times
            </h2>
            <div className="mb-4 space-y-2 text-sm">
              <div
                className="rounded-lg p-3"
                style={{ backgroundColor: "var(--asph-bg-tertiary)" }}
              >
                <div style={{ color: "var(--asph-text-secondary)" }}>
                  Highest Engagement
                </div>
                <div
                  className="mt-1 text-lg font-semibold"
                  style={{ color: "var(--asph-primary)" }}
                >
                  {postingTimeAnalysis.maxEngagementHour}:00 -{" "}
                  {postingTimeAnalysis.maxEngagementHour + 1}:00
                </div>
                <div
                  className="mt-1 text-xs"
                  style={{ color: "var(--asph-text-secondary)" }}
                >
                  Avg{" "}
                  {postingTimeAnalysis.avgEngagementByHour[
                    postingTimeAnalysis.maxEngagementHour
                  ].toFixed(1)}{" "}
                  interactions per post
                </div>
              </div>
              <div
                className="rounded-lg p-3"
                style={{ backgroundColor: "var(--asph-bg-tertiary)" }}
              >
                <div style={{ color: "var(--asph-text-secondary)" }}>
                  Most Active Hour
                </div>
                <div
                  className="mt-1 text-lg font-semibold"
                  style={{ color: "var(--asph-primary)" }}
                >
                  {postingTimeAnalysis.maxPostsHour}:00 -{" "}
                  {postingTimeAnalysis.maxPostsHour + 1}:00
                </div>
                <div
                  className="mt-1 text-xs"
                  style={{ color: "var(--asph-text-secondary)" }}
                >
                  {
                    postingTimeAnalysis.hourCounts[
                      postingTimeAnalysis.maxPostsHour
                    ]
                  }{" "}
                  posts
                </div>
              </div>
            </div>
            <div className="relative" style={{ height: "120px" }}>
              <div className="flex h-full items-end justify-between gap-px">
                {postingTimeAnalysis.hourCounts.map((count, hour) => (
                  <div
                    key={hour}
                    className="group relative flex-1"
                    title={`${hour}:00 - ${count} posts, avg ${postingTimeAnalysis.avgEngagementByHour[hour].toFixed(1)} engagement`}
                  >
                    <div
                      className="w-full rounded-t transition-all duration-300"
                      style={{
                        height: `${(postingTimeAnalysis.avgEngagementByHour[hour] / postingTimeAnalysis.maxAvgEngagement) * 100}px`,
                        background:
                          hour === postingTimeAnalysis.maxEngagementHour
                            ? "linear-gradient(180deg, #a78bfa 0%, #8b5cf6 100%)"
                            : "linear-gradient(180deg, #c4b5fd 0%, #a78bfa 100%)",
                        opacity:
                          hour === postingTimeAnalysis.maxEngagementHour
                            ? 1
                            : 0.5,
                      }}
                    />
                    {hour % 3 === 0 && (
                      <div
                        className="absolute left-0 right-0 top-full mt-1 text-center text-xs"
                        style={{ color: "var(--asph-text-secondary)" }}
                      >
                        {hour}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div
        className="asph-card p-6"
        style={{ background: "var(--asph-bg-secondary)" }}
      >
        <h2
          className="mb-4 flex items-center gap-2 text-lg font-semibold"
          style={{ color: "var(--asph-text-primary)" }}
        >
          <TrendingUp
            size={20}
            className="text-green-600 dark:text-green-500"
          />
          Top Performing Posts
        </h2>
        {postsData?.topPosts && postsData.topPosts.length > 0 ? (
          <div className="space-y-4">
            {postsData.topPosts.map((post, index) => (
              <div
                key={post.uri}
                className="flex gap-4 rounded-lg p-4 transition-all hover:bg-opacity-50"
                style={{ backgroundColor: "var(--asph-bg-tertiary)" }}
              >
                <div
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold"
                  style={{
                    backgroundColor: "var(--asph-primary)",
                    color: "white",
                  }}
                >
                  {index + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex items-center gap-2">
                    {post.author.avatar && (
                      <img
                        src={proxifyBskyImage(post.author.avatar)}
                        alt={post.author.handle}
                        className="h-6 w-6 rounded-full"
                      />
                    )}
                    <span
                      className="text-sm font-medium"
                      style={{ color: "var(--asph-text-primary)" }}
                    >
                      {post.author.displayName || post.author.handle}
                    </span>
                    <span
                      className="text-xs"
                      style={{ color: "var(--asph-text-secondary)" }}
                    >
                      {format(new Date(post.createdAt), "MMM d, yyyy")}
                    </span>
                  </div>
                  <p
                    className="mb-3 text-sm"
                    style={{ color: "var(--asph-text-primary)" }}
                  >
                    {post.text.length > 200
                      ? `${post.text.substring(0, 200)}...`
                      : post.text}
                  </p>
                  <div className="flex flex-wrap gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <Heart size={14} className="text-red-500" />
                      <span style={{ color: "var(--asph-text-secondary)" }}>
                        {post.likes.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Repeat2 size={14} className="text-blue-500" />
                      <span style={{ color: "var(--asph-text-secondary)" }}>
                        {post.reposts.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <MessageCircle
                        size={14}
                        className="text-green-600 dark:text-green-500"
                      />
                      <span style={{ color: "var(--asph-text-secondary)" }}>
                        {post.replies.toLocaleString()}
                      </span>
                    </div>
                    <div
                      className="ml-auto font-semibold"
                      style={{ color: "var(--asph-primary)" }}
                    >
                      {post.totalEngagement.toLocaleString()} total
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div
            className="py-12 text-center"
            style={{ color: "var(--asph-text-secondary)" }}
          >
            <p>No posts found in this time range</p>
          </div>
        )}
      </div>

      {postsData && postsData.totalPosts > 0 && (
        <div
          className="asph-card p-4"
          style={{ background: "var(--asph-bg-secondary)" }}
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div
              className="text-sm"
              style={{ color: "var(--asph-text-secondary)" }}
            >
              Showing {postsData.totalPosts.toLocaleString()} posts from{" "}
              {format(startDate, "MMM d, yyyy")} to{" "}
              {format(endDate, "MMM d, yyyy")}
            </div>
            <div className="flex items-center gap-6 text-sm">
              <div>
                <span
                  className="font-semibold"
                  style={{ color: "var(--asph-text-primary)" }}
                >
                  {postsData.totalEngagement.toLocaleString()}
                </span>
                <span style={{ color: "var(--asph-text-secondary)" }}>
                  {" "}
                  total engagement
                </span>
              </div>
              <div>
                <span
                  className="font-semibold"
                  style={{ color: "var(--asph-text-primary)" }}
                >
                  {postsData.totalPosts > 0
                    ? (
                        postsData.totalEngagement / postsData.totalPosts
                      ).toFixed(1)
                    : 0}
                </span>
                <span style={{ color: "var(--asph-text-secondary)" }}>
                  {" "}
                  avg per post
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {postsData && postsData.totalPosts > 0 && (
        <div
          className="asph-card p-6"
          style={{ background: "var(--asph-bg-secondary)" }}
        >
          <div className="mb-4 flex items-center justify-between">
            <h2
              className="flex items-center gap-2 text-lg font-semibold"
              style={{ color: "var(--asph-text-primary)" }}
            >
              <Sparkles size={20} className="text-purple-500" />
              AI Content Analysis
            </h2>
            {!analysisRequested && (
              <button
                onClick={() => setAnalysisRequested(true)}
                className="rounded-lg px-4 py-2 text-sm font-medium transition-all hover:opacity-90"
                style={{
                  backgroundColor: "var(--asph-primary)",
                  color: "white",
                }}
              >
                Analyze My Posts
              </button>
            )}
          </div>

          {!analysisRequested && (
            <div
              className="rounded-lg p-6 text-center"
              style={{ backgroundColor: "var(--asph-bg-tertiary)" }}
            >
              <Sparkles
                size={48}
                className="mx-auto mb-3 text-purple-500 opacity-50 dark:text-purple-400"
              />
              <p
                className="mb-2 text-lg font-medium"
                style={{ color: "var(--asph-text-primary)" }}
              >
                Get AI-Powered Insights
              </p>
              <p
                className="mb-4 text-sm"
                style={{ color: "var(--asph-text-secondary)" }}
              >
                Discover content themes, writing style patterns, and engagement
                insights from your posts
              </p>
            </div>
          )}

          {isLoadingAnalysis && (
            <div
              className="rounded-lg p-8 text-center"
              style={{ backgroundColor: "var(--asph-bg-tertiary)" }}
            >
              <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-purple-200 border-t-purple-500" />
              <p
                className="text-sm font-medium"
                style={{ color: "var(--asph-text-primary)" }}
              >
                Analyzing your posts...
              </p>
              <p
                className="mt-2 text-xs"
                style={{ color: "var(--asph-text-secondary)" }}
              >
                This may take a moment
              </p>
            </div>
          )}

          {analysisData && !isLoadingAnalysis && (
            <div className="space-y-6">
              <div
                className="rounded-lg p-6"
                style={{ backgroundColor: "var(--asph-bg-tertiary)" }}
              >
                <h3
                  className="mb-3 text-base font-semibold"
                  style={{ color: "var(--asph-text-primary)" }}
                >
                  Summary
                </h3>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: "var(--asph-text-secondary)" }}
                >
                  {analysisData.summary}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div
                  className="rounded-lg p-6"
                  style={{ backgroundColor: "var(--asph-bg-tertiary)" }}
                >
                  <h3
                    className="mb-4 flex items-center gap-2 text-base font-semibold"
                    style={{ color: "var(--asph-text-primary)" }}
                  >
                    <BarChart3 size={18} className="text-blue-500" />
                    Content Themes
                  </h3>
                  <div className="space-y-4">
                    {analysisData.contentThemes.map((theme) => (
                      <div key={theme.theme} className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <h4
                            className="font-medium"
                            style={{ color: "var(--asph-text-primary)" }}
                          >
                            {theme.theme}
                          </h4>
                          <span
                            className="rounded-full px-2 py-0.5 text-xs font-medium"
                            style={{
                              backgroundColor:
                                theme.frequency === "primary"
                                  ? "#3b82f6"
                                  : theme.frequency === "regular"
                                    ? "#8b5cf6"
                                    : "#6b7280",
                              color: "white",
                            }}
                          >
                            {theme.frequency}
                          </span>
                        </div>
                        <p
                          className="text-sm"
                          style={{ color: "var(--asph-text-secondary)" }}
                        >
                          {theme.description}
                        </p>
                        {theme.examples.length > 0 && (
                          <div className="space-y-1 pl-4">
                            {theme.examples.map((example) => (
                              <p
                                key={example}
                                className="text-xs italic"
                                style={{ color: "var(--asph-text-secondary)" }}
                              >
                                "{example}"
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div
                  className="rounded-lg p-6"
                  style={{ backgroundColor: "var(--asph-bg-tertiary)" }}
                >
                  <h3
                    className="mb-4 flex items-center gap-2 text-base font-semibold"
                    style={{ color: "var(--asph-text-primary)" }}
                  >
                    <MessageCircle
                      size={18}
                      className="text-green-600 dark:text-green-500"
                    />
                    Writing Style
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <p
                        className="mb-1 text-xs font-medium"
                        style={{ color: "var(--asph-text-secondary)" }}
                      >
                        Tone
                      </p>
                      <p
                        className="text-sm font-medium"
                        style={{ color: "var(--asph-text-primary)" }}
                      >
                        {analysisData.writingStyle.tone}
                      </p>
                    </div>
                    <div>
                      <p
                        className="mb-2 text-xs font-medium"
                        style={{ color: "var(--asph-text-secondary)" }}
                      >
                        Characteristics
                      </p>
                      <ul className="space-y-1">
                        {analysisData.writingStyle.characteristics.map(
                          (char) => (
                            <li
                              key={char}
                              className="flex items-start gap-2 text-sm"
                              style={{ color: "var(--asph-text-secondary)" }}
                            >
                              <span className="text-green-600 dark:text-green-500">
                                •
                              </span>
                              {char}
                            </li>
                          ),
                        )}
                      </ul>
                    </div>
                    <div>
                      <p
                        className="mb-1 text-xs font-medium"
                        style={{ color: "var(--asph-text-secondary)" }}
                      >
                        Voice
                      </p>
                      <p
                        className="text-sm"
                        style={{ color: "var(--asph-text-secondary)" }}
                      >
                        {analysisData.writingStyle.voiceDescription}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div
                className="rounded-lg p-6"
                style={{ backgroundColor: "var(--asph-bg-tertiary)" }}
              >
                <h3
                  className="mb-4 flex items-center gap-2 text-base font-semibold"
                  style={{ color: "var(--asph-text-primary)" }}
                >
                  <Lightbulb size={18} className="text-yellow-500" />
                  Engagement Insights
                </h3>
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                  <div>
                    <p
                      className="mb-3 text-xs font-medium"
                      style={{ color: "var(--asph-text-secondary)" }}
                    >
                      Top Performers
                    </p>
                    <ul className="space-y-2">
                      {analysisData.engagementPatterns.topPerformers.map(
                        (item) => (
                          <li
                            key={item}
                            className="text-sm"
                            style={{ color: "var(--asph-text-secondary)" }}
                          >
                            <span className="text-yellow-500">★</span> {item}
                          </li>
                        ),
                      )}
                    </ul>
                  </div>
                  <div>
                    <p
                      className="mb-3 text-xs font-medium"
                      style={{ color: "var(--asph-text-secondary)" }}
                    >
                      Your Strengths
                    </p>
                    <ul className="space-y-2">
                      {analysisData.engagementPatterns.contentStrengths.map(
                        (item) => (
                          <li
                            key={item}
                            className="text-sm"
                            style={{ color: "var(--asph-text-secondary)" }}
                          >
                            <span className="text-green-600 dark:text-green-500">
                              ✓
                            </span>{" "}
                            {item}
                          </li>
                        ),
                      )}
                    </ul>
                  </div>
                  <div>
                    <p
                      className="mb-3 text-xs font-medium"
                      style={{ color: "var(--asph-text-secondary)" }}
                    >
                      Observations
                    </p>
                    <ul className="space-y-2">
                      {(
                        analysisData.engagementPatterns.observations ||
                        analysisData.engagementPatterns.suggestions ||
                        []
                      ).map((item) => (
                        <li
                          key={item}
                          className="text-sm"
                          style={{ color: "var(--asph-text-secondary)" }}
                        >
                          <span className="text-purple-500">•</span> {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {analysisData.optimalPostingTimes &&
                analysisData.optimalPostingTimes.recommendations.length > 0 && (
                  <div
                    className="rounded-lg p-6"
                    style={{ backgroundColor: "var(--asph-bg-tertiary)" }}
                  >
                    <h3
                      className="mb-4 flex items-center gap-2 text-base font-semibold"
                      style={{ color: "var(--asph-text-primary)" }}
                    >
                      <Clock size={18} className="text-blue-500" />
                      Optimal Posting Times
                    </h3>
                    <p
                      className="mb-4 text-sm"
                      style={{ color: "var(--asph-text-secondary)" }}
                    >
                      Based on your last{" "}
                      {dateRange === "90d"
                        ? "90 days"
                        : dateRange === "30d"
                          ? "30 days"
                          : dateRange === "7d"
                            ? "7 days"
                            : "24 hours"}{" "}
                      of engagement data
                    </p>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      {analysisData.optimalPostingTimes.recommendations.map(
                        (rec: OptimalTimeRecommendation, i: number) => {
                          const dayNames = [
                            "Sunday",
                            "Monday",
                            "Tuesday",
                            "Wednesday",
                            "Thursday",
                            "Friday",
                            "Saturday",
                          ];
                          const formatHour = (hour: number) => {
                            if (hour === 0) return "12:00 AM";
                            if (hour === 12) return "12:00 PM";
                            return hour < 12
                              ? `${hour}:00 AM`
                              : `${hour - 12}:00 PM`;
                          };
                          const confidenceColor =
                            rec.confidence === "high"
                              ? "#22c55e"
                              : rec.confidence === "medium"
                                ? "#eab308"
                                : "#94a3b8";

                          return (
                            <div
                              key={`posting-time-${rec.dayOfWeek}-${rec.hour}`}
                              className="flex flex-col rounded-lg p-4"
                              style={{
                                backgroundColor: "var(--asph-bg-secondary)",
                                border:
                                  i === 0
                                    ? "2px solid var(--asph-primary)"
                                    : "1px solid var(--asph-border-primary)",
                              }}
                            >
                              <div className="mb-2 flex items-center justify-between">
                                <span
                                  className="text-xs font-medium"
                                  style={{
                                    color: "var(--asph-text-secondary)",
                                  }}
                                >
                                  {i === 0 ? "Best Time" : `#${i + 1}`}
                                </span>
                                <span
                                  className="rounded-full px-2 py-0.5 text-xs"
                                  style={{
                                    backgroundColor: confidenceColor,
                                    color: "white",
                                  }}
                                >
                                  {rec.confidence}
                                </span>
                              </div>
                              <div
                                className="text-lg font-bold"
                                style={{ color: "var(--asph-text-primary)" }}
                              >
                                {formatHour(rec.hour)}
                              </div>
                              <div
                                className="text-sm"
                                style={{ color: "var(--asph-text-secondary)" }}
                              >
                                {rec.dayOfWeek === -1
                                  ? "Any day"
                                  : dayNames[rec.dayOfWeek]}
                              </div>
                              <div
                                className="mt-2 text-xs"
                                style={{ color: "var(--asph-primary)" }}
                              >
                                ~{rec.avgEngagement} avg engagement
                              </div>
                            </div>
                          );
                        },
                      )}
                    </div>
                  </div>
                )}

              <button
                onClick={() => setAnalysisRequested(false)}
                className="w-full rounded-lg px-4 py-2 text-sm transition-all hover:opacity-80"
                style={{
                  backgroundColor: "var(--asph-bg-tertiary)",
                  color: "var(--asph-text-secondary)",
                }}
              >
                Hide Analysis
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
