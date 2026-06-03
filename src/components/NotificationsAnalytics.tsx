import type {
  AppBskyActorDefs,
  AppBskyFeedDefs,
  AppBskyNotificationListNotifications,
} from "@atproto/api";
import { useQuery } from "@tanstack/react-query";
import { format, startOfDay, subDays, subHours } from "date-fns";
import {
  Activity,
  Bell,
  Calendar,
  Heart,
  Send,
  TrendingUp,
  Users,
} from "lucide-react";
import React from "react";
import { useAuth } from "../contexts/AuthContext";
import { useExtendedNotifications } from "../hooks/useExtendedNotifications";
import { usePageVisibility } from "../hooks/usePageVisibility";
import { proxifyBskyImage } from "../utils/image-proxy";
import { BackgroundNotificationLoader } from "./BackgroundNotificationLoader";
import { buildNotificationActivity } from "./notifications-analytics-utils";
import { useUserActivityStats } from "./useUserActivityStats";

type TimeRange = "1d" | "3d" | "7d" | "4w";

interface UserInteractionStats {
  handle: string;
  displayName?: string;
  avatar?: string;
  did: string;
  likes: number;
  replies: number;
  reposts: number;
  total: number;
}

interface ActivityBucket {
  label: string;
  time: Date;
  posts: number;
  replies: number;
  reposts: number;
  quotes: number;
}

interface ExtendedNotificationPage {
  notifications: AppBskyNotificationListNotifications.Notification[];
  cursor?: string;
}

export const NotificationsAnalytics: React.FC = React.memo(
  function NotificationsAnalytics() {
    const { agent, session } = useAuth();
    const isVisible = usePageVisibility();
    const [timeRange, setTimeRange] = React.useState<TimeRange>("7d");
    const [activityView, setActivityView] = React.useState<"received" | "sent">(
      "received",
    );
    const [topUsersView, setTopUsersView] = React.useState<"received" | "sent">(
      "received",
    );

    // Handle time range changes
    const handleTimeRangeChange = (newRange: TimeRange) => {
      setTimeRange(newRange);
    };

    // Check if we have extended data available (from memory or IndexedDB)
    const { extendedData, hasExtendedData } = useExtendedNotifications();

    // Query for user's own activity (see useUserActivityStats)
    const { data: userActivity } = useUserActivityStats(timeRange);

    // Query for users the current user engages with most
    const { data: topUsersSent } = useQuery({
      queryKey: ["top-users-sent", session?.handle, timeRange],
      queryFn: async () => {
        if (!agent || !session?.handle) throw new Error("Not authenticated");

        const cutoffDate =
          timeRange === "1d"
            ? subDays(new Date(), 1)
            : timeRange === "3d"
              ? subDays(new Date(), 3)
              : timeRange === "7d"
                ? subDays(new Date(), 7)
                : subDays(new Date(), 28);

        // Track interactions per user
        const userInteractions = new Map<string, UserInteractionStats>();

        // Helper to add/update user interaction
        const addInteraction = (
          author:
            | AppBskyActorDefs.ProfileView
            | AppBskyActorDefs.ProfileViewBasic,
          type: "likes" | "replies" | "reposts",
        ) => {
          const key = author.handle;
          if (!userInteractions.has(key)) {
            userInteractions.set(key, {
              handle: author.handle,
              displayName: author.displayName,
              avatar: author.avatar,
              did: author.did,
              likes: 0,
              replies: 0,
              reposts: 0,
              total: 0,
            });
          }

          const user = userInteractions.get(key)!;
          user[type]++;
          user.total++;
        };

        // Fetch user's own posts to see who they replied to
        const ownFeed = await agent.getAuthorFeed({
          actor: session?.handle,
          limit: 100,
        });

        // Process replies
        for (const item of ownFeed.data.feed) {
          const postDate = new Date(item.post.indexedAt);
          if (postDate >= cutoffDate && item.reply) {
            // This is a reply TO someone
            const parentAuthor =
              "author" in item.reply.parent ? item.reply.parent.author : null;
            if (
              parentAuthor &&
              "handle" in parentAuthor &&
              parentAuthor.handle !== session.handle
            ) {
              addInteraction(parentAuthor, "replies");
            }
          }
        }

        // Fetch user's likes
        try {
          // Note: This endpoint might not be available in all AT Protocol implementations
          // Using the actor feed as a proxy to see what posts are liked
          const feed = await agent.getTimeline({ limit: 100 });

          for (const item of feed.data.feed) {
            const postDate = new Date(item.post.indexedAt);
            if (postDate >= cutoffDate) {
              // Check if current user liked this post
              if (item.post.viewer?.like) {
                const author = item.post.author;
                if (author.handle !== session.handle) {
                  addInteraction(author, "likes");
                }
              }

              // Check if current user reposted
              if (item.post.viewer?.repost) {
                const author = item.post.author;
                if (author.handle !== session.handle) {
                  addInteraction(author, "reposts");
                }
              }
            }
          }
        } catch (error) {
          console.error("Error fetching timeline for likes/reposts:", error);
        }

        // Sort by total interactions and get top 5
        const topUsers = Array.from(userInteractions.values())
          .sort((a, b) => b.total - a.total)
          .slice(0, 5);

        return topUsers;
      },
      enabled: topUsersView === "sent",
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    });

    // Query for user's sent activity (posts, likes, reposts they made)
    const { data: sentActivity } = useQuery({
      queryKey: ["user-sent-activity", session?.handle, timeRange],
      queryFn: async () => {
        if (!agent || !session?.handle) throw new Error("Not authenticated");

        const cutoffDate =
          timeRange === "1d"
            ? subDays(new Date(), 1)
            : timeRange === "3d"
              ? subDays(new Date(), 3)
              : timeRange === "7d"
                ? subDays(new Date(), 7)
                : subDays(new Date(), 28);

        // Fetch user's recent posts (same logic as user activity)
        let allPosts: AppBskyFeedDefs.FeedViewPost[] = [];
        let cursor: string | undefined;
        let fetchedEnough = false;
        const maxPages = 5;

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

        const posts = { data: { feed: allPosts } };

        // Organize by time buckets
        const buckets: ActivityBucket[] = [];

        // Create time buckets based on time range
        const now = new Date();
        if (timeRange === "1d") {
          // Hourly buckets for last 24 hours
          for (let i = 23; i >= 0; i--) {
            const time = subHours(now, i);
            buckets.push({
              label: format(time, "ha"),
              time,
              posts: 0,
              replies: 0,
              reposts: 0,
              quotes: 0,
            });
          }
        } else {
          // Daily buckets
          const days = timeRange === "3d" ? 3 : timeRange === "7d" ? 7 : 28;
          for (let i = days - 1; i >= 0; i--) {
            const time = startOfDay(subDays(now, i));
            buckets.push({
              label: format(time, days > 7 ? "M/d" : "EEE"),
              time,
              posts: 0,
              replies: 0,
              reposts: 0,
              quotes: 0,
            });
          }
        }

        // Count activities in each bucket
        for (const item of posts.data.feed) {
          const postDate = new Date(item.post.indexedAt);
          if (postDate >= cutoffDate) {
            // Find the right bucket
            const bucketIndex = buckets.findIndex((b, i) => {
              const nextTime =
                i < buckets.length - 1 ? buckets[i + 1].time : now;
              return postDate >= b.time && postDate < nextTime;
            });

            if (bucketIndex !== -1) {
              // Check if it's a reply, repost, or quote
              if (item.reply) {
                buckets[bucketIndex].replies++;
              } else if (
                item.reason?.$type === "app.bsky.feed.defs#reasonRepost"
              ) {
                buckets[bucketIndex].reposts++;
              } else if (item.post.embed?.$type === "app.bsky.embed.record") {
                buckets[bucketIndex].quotes++;
              } else {
                buckets[bucketIndex].posts++;
              }
            }
          }
        }

        return { buckets };
      },
      enabled: activityView === "sent",
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    });

    // Query for current stats - only fetch if we don't have extended data
    const { data: currentStats, isLoading: isLoadingStats } = useQuery({
      queryKey: ["notifications-summary"],
      queryFn: async () => {
        if (!agent) throw new Error("Not authenticated");
        const response = await agent.app.bsky.notification.listNotifications({
          limit: 50,
        });
        return response.data;
      },
      refetchInterval: isVisible ? 60 * 1000 : false, // Refetch every 60 seconds, paused when tab hidden
      enabled: !hasExtendedData, // Don't fetch if we have extended data
      refetchOnWindowFocus: false,
    });

    // Query for analytics data - use extended data if available, otherwise fetch
    const { data: notifications } = useQuery({
      queryKey: ["notifications-analytics", timeRange, hasExtendedData],
      queryFn: async () => {
        if (!agent) throw new Error("Not authenticated");

        // If we have extended data (from IndexedDB), use it instead of fetching
        if (hasExtendedData && extendedData?.pages) {
          const allNotifications = extendedData.pages.flatMap(
            (page: ExtendedNotificationPage) => page.notifications,
          );
          console.log("📊 Using cached data for analytics:", {
            totalNotifications: allNotifications.length,
            oldestDate:
              allNotifications.length > 0
                ? new Date(
                    allNotifications[allNotifications.length - 1].indexedAt,
                  )
                : null,
            newestDate:
              allNotifications.length > 0
                ? new Date(allNotifications[0].indexedAt)
                : null,
            timeRange,
          });
          return { notifications: allNotifications };
        }

        // Otherwise, fetch fresh data based on the selected time range
        const allNotifications: AppBskyNotificationListNotifications.Notification[] =
          [];
        let cursor: string | undefined;

        // Determine how far back to fetch based on time range
        const cutoffDate =
          timeRange === "1d"
            ? subDays(new Date(), 1)
            : timeRange === "3d"
              ? subDays(new Date(), 3)
              : timeRange === "7d"
                ? subDays(new Date(), 7)
                : subDays(new Date(), 28);

        let hasMoreToFetch = true;

        while (hasMoreToFetch) {
          const response = await agent.app.bsky.notification.listNotifications({
            limit: 100,
            cursor,
          });

          allNotifications.push(...response.data.notifications);
          cursor = response.data.cursor;

          // Check if we've fetched notifications older than cutoff date or no more cursor
          const oldestNotification =
            response.data.notifications[response.data.notifications.length - 1];
          if (
            !cursor ||
            (oldestNotification &&
              new Date(oldestNotification.indexedAt) < cutoffDate)
          ) {
            hasMoreToFetch = false;
          }

          // Safety limit to prevent infinite loops
          if (allNotifications.length > 5000) {
            hasMoreToFetch = false;
          }
        }

        return { notifications: allNotifications };
      },
      enabled: !!agent,
      staleTime: hasExtendedData ? 5 * 60 * 1000 : 2 * 60 * 1000, // Longer stale time if using cached data
      gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
      refetchInterval: isVisible ? 60 * 1000 : false, // Refetch every 60 seconds, paused when tab hidden
      refetchOnMount: false, // Don't refetch on mount - use stale time instead
      refetchOnWindowFocus: false, // Don't refetch on window focus
    });

    const analytics = React.useMemo(() => {
      if (!notifications?.notifications) return null;
      return buildNotificationActivity(notifications.notifications, timeRange);
    }, [notifications, timeRange]);

    // Calculate current stats - use analytics data if we have extended data
    const stats = React.useMemo(() => {
      // If we have extended data, calculate stats from the analytics data
      if (hasExtendedData && notifications?.notifications) {
        // Get notifications from the last 24 hours for "recent" stats
        const oneDayAgo = subDays(new Date(), 1);
        const recentNotifications = notifications.notifications.filter(
          (n: AppBskyNotificationListNotifications.Notification) =>
            new Date(n.indexedAt) >= oneDayAgo,
        );

        const counts = {
          total: recentNotifications.length,
          unread: 0, // Extended data doesn't include read status
          likes: recentNotifications.filter(
            (n: AppBskyNotificationListNotifications.Notification) =>
              n.reason === "like",
          ).length,
          reposts: recentNotifications.filter(
            (n: AppBskyNotificationListNotifications.Notification) =>
              n.reason === "repost",
          ).length,
          follows: recentNotifications.filter(
            (n: AppBskyNotificationListNotifications.Notification) =>
              n.reason === "follow",
          ).length,
          mentions: recentNotifications.filter(
            (n: AppBskyNotificationListNotifications.Notification) =>
              n.reason === "mention",
          ).length,
          replies: recentNotifications.filter(
            (n: AppBskyNotificationListNotifications.Notification) =>
              n.reason === "reply",
          ).length,
        };

        return counts;
      }

      // Otherwise use the current stats query
      if (!currentStats) return null;

      const counts = {
        total: currentStats.notifications.length,
        unread: currentStats.notifications.filter(
          (n: AppBskyNotificationListNotifications.Notification) => !n.isRead,
        ).length,
        likes: currentStats.notifications.filter(
          (n: AppBskyNotificationListNotifications.Notification) =>
            n.reason === "like",
        ).length,
        reposts: currentStats.notifications.filter(
          (n: AppBskyNotificationListNotifications.Notification) =>
            n.reason === "repost",
        ).length,
        follows: currentStats.notifications.filter(
          (n: AppBskyNotificationListNotifications.Notification) =>
            n.reason === "follow",
        ).length,
        mentions: currentStats.notifications.filter(
          (n: AppBskyNotificationListNotifications.Notification) =>
            n.reason === "mention",
        ).length,
        replies: currentStats.notifications.filter(
          (n: AppBskyNotificationListNotifications.Notification) =>
            n.reason === "reply",
        ).length,
      };

      return counts;
    }, [currentStats, hasExtendedData, notifications]);

    if (!analytics || isLoadingStats) {
      return (
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            <div
              className="h-8 w-1/4 rounded"
              style={{ backgroundColor: "var(--asph-bg-tertiary)" }}
            ></div>
            <div
              className="h-64 rounded"
              style={{ backgroundColor: "var(--asph-bg-tertiary)" }}
            ></div>
          </div>
        </div>
      );
    }

    const maxValue = Math.max(1, ...analytics.buckets.map((b) => b.total));
    const maxSentValue = sentActivity
      ? Math.max(
          1,
          ...sentActivity.buckets.map(
            (b) => b.posts + b.replies + b.reposts + b.quotes,
          ),
        )
      : 1;
    const currentMaxValue =
      activityView === "received" ? maxValue : maxSentValue;

    return (
      <div className="space-y-6 p-6">
        {/* Background loader - no UI */}
        <BackgroundNotificationLoader />

        {/* Page Header with inline stats */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1
              className="mb-2 text-2xl font-bold"
              style={{ color: "var(--asph-text-primary)" }}
            >
              Analytics
            </h1>
            <div
              className="flex items-center gap-4 text-sm"
              style={{ color: "var(--asph-text-secondary)" }}
            >
              <span className="flex items-center gap-1">
                <Bell size={16} />
                {stats?.total || 0} in last 24h
              </span>
              <span className="flex items-center gap-1">
                <TrendingUp size={16} />
                {Math.round(analytics?.averagePerDay || 0)}/day avg
              </span>
              <span className="flex items-center gap-1">
                <Users size={16} />
                {analytics?.uniqueUsers || 0} unique users
              </span>
            </div>
          </div>

          {/* Data source indicator */}
          {hasExtendedData && (
            <div
              className="flex items-center gap-2 rounded-lg px-3 py-1 text-sm"
              style={{
                backgroundColor: "var(--asph-bg-tertiary)",
                color: "var(--asph-text-secondary)",
              }}
            >
              <Activity size={14} />
              <span>Using extended history</span>
            </div>
          )}
        </div>

        {/* Activity Chart */}
        <div
          className="asph-card p-6"
          style={{
            background: "var(--asph-bg-secondary)",
            position: "relative",
          }}
        >
          <div
            className="pointer-events-none absolute right-0 top-0 h-64 w-64 opacity-5"
            style={{
              background:
                "radial-gradient(circle, var(--asph-primary) 0%, transparent 70%)",
              transform: "translate(30%, -30%)",
              overflow: "hidden",
            }}
          />
          <div className="mb-4" style={{ position: "relative", zIndex: 10 }}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Activity className="text-green-500" size={20} />
                Activity Timeline
              </h2>
              {/* Activity Toggle */}
              <div className="flex items-center gap-2 text-sm">
                <button
                  onClick={() => setActivityView("received")}
                  className={`touch-target rounded-lg px-3 py-1 transition-all ${
                    activityView === "received" ? "font-semibold" : ""
                  }`}
                  style={{
                    backgroundColor:
                      activityView === "received"
                        ? "var(--asph-primary)"
                        : "var(--asph-bg-tertiary)",
                    color:
                      activityView === "received"
                        ? "white"
                        : "var(--asph-text-secondary)",
                  }}
                >
                  Received
                </button>
                <button
                  onClick={() => setActivityView("sent")}
                  className={`touch-target rounded-lg px-3 py-1 transition-all ${
                    activityView === "sent" ? "font-semibold" : ""
                  }`}
                  style={{
                    backgroundColor:
                      activityView === "sent"
                        ? "var(--asph-primary)"
                        : "var(--asph-bg-tertiary)",
                    color:
                      activityView === "sent"
                        ? "white"
                        : "var(--asph-text-secondary)",
                  }}
                >
                  Sent
                </button>
              </div>
            </div>

            {/* Time Range Buttons - on their own line */}
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleTimeRangeChange("1d");
                }}
                className="touch-target-sm cursor-pointer rounded-lg px-3 py-1 text-sm transition-all hover:opacity-80"
                style={{
                  backgroundColor:
                    timeRange === "1d"
                      ? "var(--asph-primary)"
                      : "var(--asph-bg-tertiary)",
                  color:
                    timeRange === "1d" ? "white" : "var(--asph-text-secondary)",
                  border: "none",
                }}
                type="button"
              >
                24h
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleTimeRangeChange("3d");
                }}
                className="touch-target-sm cursor-pointer rounded-lg px-3 py-1 text-sm transition-all hover:opacity-80"
                style={{
                  backgroundColor:
                    timeRange === "3d"
                      ? "var(--asph-primary)"
                      : "var(--asph-bg-tertiary)",
                  color:
                    timeRange === "3d" ? "white" : "var(--asph-text-secondary)",
                  border: "none",
                }}
                type="button"
              >
                3d
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleTimeRangeChange("7d");
                }}
                className="touch-target-sm cursor-pointer rounded-lg px-3 py-1 text-sm transition-all hover:opacity-80"
                style={{
                  backgroundColor:
                    timeRange === "7d"
                      ? "var(--asph-primary)"
                      : "var(--asph-bg-tertiary)",
                  color:
                    timeRange === "7d" ? "white" : "var(--asph-text-secondary)",
                  border: "none",
                }}
                type="button"
              >
                7d
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleTimeRangeChange("4w");
                }}
                className="touch-target-sm cursor-pointer rounded-lg px-3 py-1 text-sm transition-all hover:opacity-80"
                style={{
                  backgroundColor:
                    timeRange === "4w"
                      ? "var(--asph-primary)"
                      : "var(--asph-bg-tertiary)",
                  color:
                    timeRange === "4w" ? "white" : "var(--asph-text-secondary)",
                  border: "none",
                }}
                type="button"
              >
                4w
              </button>
            </div>
          </div>

          <div
            className="relative"
            style={{ height: "300px", marginTop: "20px" }}
          >
            {/* Y-axis labels */}
            <div
              className="absolute bottom-0 left-0 top-0 flex flex-col justify-between text-xs"
              style={{ width: "40px", color: "var(--asph-text-secondary)" }}
            >
              <span>{currentMaxValue}</span>
              <span>{Math.round(currentMaxValue * 0.75)}</span>
              <span>{Math.round(currentMaxValue * 0.5)}</span>
              <span>{Math.round(currentMaxValue * 0.25)}</span>
              <span>0</span>
            </div>

            {/* Chart area */}
            <div className="relative ml-12 h-full">
              {/* Grid lines */}
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

              {/* Bars */}
              <div
                className="relative flex h-full items-end justify-between"
                style={{
                  gap: timeRange === "4w" ? "2px" : "4px",
                  paddingBottom: "30px",
                }}
              >
                {activityView === "received"
                  ? // Received view - show notifications
                    analytics.buckets.map((bucket, index) => {
                      const barWidth =
                        timeRange === "4w"
                          ? `${100 / analytics.buckets.length}%`
                          : `${100 / analytics.buckets.length - 1}%`;
                      return (
                        <div
                          key={`${bucket.label}-${index}`}
                          className="group relative"
                          style={{
                            width: barWidth,
                            minWidth: timeRange === "4w" ? "8px" : "20px",
                            maxWidth: timeRange === "4w" ? "30px" : "60px",
                          }}
                        >
                          {/* Stacked bar */}
                          <div className="absolute bottom-0 left-0 right-0 flex flex-col-reverse overflow-hidden rounded-t-lg transition-all duration-300 hover:opacity-90">
                            {/* Likes - bottom of stack */}
                            {bucket.likes > 0 && (
                              <div
                                className="w-full transition-all duration-500"
                                style={{
                                  height: `${(bucket.likes / maxValue) * 270}px`,
                                  background:
                                    "linear-gradient(180deg, #f87171 0%, #ef4444 100%)",
                                }}
                                title={`${bucket.likes} likes`}
                              />
                            )}
                            {/* Reposts */}
                            {bucket.reposts > 0 && (
                              <div
                                className="w-full transition-all duration-500"
                                style={{
                                  height: `${(bucket.reposts / maxValue) * 270}px`,
                                  background:
                                    "linear-gradient(180deg, #93c5fd 0%, #60a5fa 100%)",
                                }}
                                title={`${bucket.reposts} reposts`}
                              />
                            )}
                            {/* Follows */}
                            {bucket.follows > 0 && (
                              <div
                                className="w-full transition-all duration-500"
                                style={{
                                  height: `${(bucket.follows / maxValue) * 270}px`,
                                  background:
                                    "linear-gradient(180deg, #c4b5fd 0%, #a78bfa 100%)",
                                }}
                                title={`${bucket.follows} follows`}
                              />
                            )}
                            {/* Replies */}
                            {bucket.replies > 0 && (
                              <div
                                className="w-full transition-all duration-500"
                                style={{
                                  height: `${(bucket.replies / maxValue) * 270}px`,
                                  background:
                                    "linear-gradient(180deg, #86efac 0%, #4ade80 100%)",
                                }}
                                title={`${bucket.replies} replies`}
                              />
                            )}
                            {/* Mentions - top of stack */}
                            {bucket.mentions > 0 && (
                              <div
                                className="w-full transition-all duration-500"
                                style={{
                                  height: `${(bucket.mentions / maxValue) * 270}px`,
                                  background:
                                    "linear-gradient(180deg, #fda4af 0%, #fb7185 100%)",
                                }}
                                title={`${bucket.mentions} mentions`}
                              />
                            )}
                          </div>

                          {/* Hover tooltip */}
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
                              <div className="mb-1 font-bold">
                                {bucket.total} total
                              </div>
                              {bucket.likes > 0 && (
                                <div style={{ color: "#dc2626" }}>
                                  {bucket.likes} likes
                                </div>
                              )}
                              {bucket.reposts > 0 && (
                                <div style={{ color: "#2563eb" }}>
                                  {bucket.reposts} reposts
                                </div>
                              )}
                              {bucket.follows > 0 && (
                                <div style={{ color: "#7c3aed" }}>
                                  {bucket.follows} follows
                                </div>
                              )}
                              {bucket.replies > 0 && (
                                <div style={{ color: "#16a34a" }}>
                                  {bucket.replies} replies
                                </div>
                              )}
                              {bucket.mentions > 0 && (
                                <div style={{ color: "#e11d48" }}>
                                  {bucket.mentions} mentions
                                </div>
                              )}
                            </div>
                          </div>

                          {/* X-axis label */}
                          {(timeRange !== "4w" ||
                            index % 4 === 0 ||
                            index === analytics.buckets.length - 1) && (
                            <div className="absolute left-0 right-0 top-full mt-1 text-center">
                              <span
                                className="text-xs"
                                style={{
                                  color: "var(--asph-text-secondary)",
                                  fontSize: timeRange === "4w" ? "9px" : "10px",
                                }}
                              >
                                {bucket.label}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })
                  : sentActivity
                    ? // Sent view - show user's posts, replies, reposts
                      sentActivity.buckets.map((bucket, index) => {
                        const barWidth =
                          timeRange === "4w"
                            ? `${100 / sentActivity.buckets.length}%`
                            : `${100 / sentActivity.buckets.length - 1}%`;
                        const total =
                          bucket.posts +
                          bucket.replies +
                          bucket.reposts +
                          bucket.quotes;

                        return (
                          <div
                            key={`${bucket.label}-${index}`}
                            className="group relative"
                            style={{
                              width: barWidth,
                              minWidth: timeRange === "4w" ? "8px" : "20px",
                              maxWidth: timeRange === "4w" ? "30px" : "60px",
                            }}
                          >
                            {/* Stacked bar */}
                            <div className="absolute bottom-0 left-0 right-0 flex flex-col-reverse overflow-hidden rounded-t-lg transition-all duration-300 hover:opacity-90">
                              {/* Posts - bottom of stack */}
                              {bucket.posts > 0 && (
                                <div
                                  className="w-full transition-all duration-500"
                                  style={{
                                    height: `${(bucket.posts / maxSentValue) * 270}px`,
                                    background:
                                      "linear-gradient(180deg, #60a5fa 0%, #3b82f6 100%)",
                                  }}
                                  title={`${bucket.posts} posts`}
                                />
                              )}
                              {/* Replies */}
                              {bucket.replies > 0 && (
                                <div
                                  className="w-full transition-all duration-500"
                                  style={{
                                    height: `${(bucket.replies / maxSentValue) * 270}px`,
                                    background:
                                      "linear-gradient(180deg, #86efac 0%, #4ade80 100%)",
                                  }}
                                  title={`${bucket.replies} replies`}
                                />
                              )}
                              {/* Reposts */}
                              {bucket.reposts > 0 && (
                                <div
                                  className="w-full transition-all duration-500"
                                  style={{
                                    height: `${(bucket.reposts / maxSentValue) * 270}px`,
                                    background:
                                      "linear-gradient(180deg, #c4b5fd 0%, #a78bfa 100%)",
                                  }}
                                  title={`${bucket.reposts} reposts`}
                                />
                              )}
                              {/* Quotes */}
                              {bucket.quotes > 0 && (
                                <div
                                  className="w-full transition-all duration-500"
                                  style={{
                                    height: `${(bucket.quotes / maxSentValue) * 270}px`,
                                    background:
                                      "linear-gradient(180deg, #fda4af 0%, #fb7185 100%)",
                                  }}
                                  title={`${bucket.quotes} quotes`}
                                />
                              )}
                            </div>

                            {/* Hover tooltip */}
                            <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 transform opacity-0 transition-opacity group-hover:opacity-100">
                              <div
                                className="whitespace-nowrap rounded-lg px-3 py-2 text-xs"
                                style={{
                                  backgroundColor: "var(--asph-bg-primary)",
                                  color: "var(--asph-text-primary)",
                                  boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                                  border:
                                    "1px solid var(--asph-border-primary)",
                                }}
                              >
                                <div className="mb-1 font-bold">
                                  {total} total
                                </div>
                                {bucket.posts > 0 && (
                                  <div style={{ color: "#2563eb" }}>
                                    {bucket.posts} posts
                                  </div>
                                )}
                                {bucket.replies > 0 && (
                                  <div style={{ color: "#16a34a" }}>
                                    {bucket.replies} replies
                                  </div>
                                )}
                                {bucket.reposts > 0 && (
                                  <div style={{ color: "#7c3aed" }}>
                                    {bucket.reposts} reposts
                                  </div>
                                )}
                                {bucket.quotes > 0 && (
                                  <div style={{ color: "#e11d48" }}>
                                    {bucket.quotes} quotes
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* X-axis label */}
                            {(timeRange !== "4w" ||
                              index % 4 === 0 ||
                              index === sentActivity.buckets.length - 1) && (
                              <div className="absolute left-0 right-0 top-full mt-1 text-center">
                                <span
                                  className="text-xs"
                                  style={{
                                    color: "var(--asph-text-tertiary)",
                                    fontSize:
                                      timeRange === "4w" ? "10px" : "12px",
                                  }}
                                >
                                  {bucket.label}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })
                    : null}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-3 pb-2 text-xs">
              {activityView === "received" ? (
                <>
                  <div className="flex items-center gap-1">
                    <div
                      className="h-3 w-3 rounded"
                      style={{ backgroundColor: "#ef4444" }}
                    ></div>
                    <span style={{ color: "var(--asph-text-secondary)" }}>
                      Likes
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div
                      className="h-3 w-3 rounded"
                      style={{ backgroundColor: "#60a5fa" }}
                    ></div>
                    <span style={{ color: "var(--asph-text-secondary)" }}>
                      Reposts
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div
                      className="h-3 w-3 rounded"
                      style={{ backgroundColor: "#a78bfa" }}
                    ></div>
                    <span style={{ color: "var(--asph-text-secondary)" }}>
                      Follows
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div
                      className="h-3 w-3 rounded"
                      style={{ backgroundColor: "#4ade80" }}
                    ></div>
                    <span style={{ color: "var(--asph-text-secondary)" }}>
                      Replies
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div
                      className="h-3 w-3 rounded"
                      style={{ backgroundColor: "#fb7185" }}
                    ></div>
                    <span style={{ color: "var(--asph-text-secondary)" }}>
                      Mentions
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-1">
                    <div
                      className="h-3 w-3 rounded"
                      style={{ backgroundColor: "#3b82f6" }}
                    ></div>
                    <span style={{ color: "var(--asph-text-secondary)" }}>
                      Posts
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div
                      className="h-3 w-3 rounded"
                      style={{ backgroundColor: "#4ade80" }}
                    ></div>
                    <span style={{ color: "var(--asph-text-secondary)" }}>
                      Replies
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div
                      className="h-3 w-3 rounded"
                      style={{ backgroundColor: "#a78bfa" }}
                    ></div>
                    <span style={{ color: "var(--asph-text-secondary)" }}>
                      Reposts
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div
                      className="h-3 w-3 rounded"
                      style={{ backgroundColor: "#fb7185" }}
                    ></div>
                    <span style={{ color: "var(--asph-text-secondary)" }}>
                      Quotes
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Top Users */}
        <div className="asph-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Heart style={{ color: "var(--asph-like)" }} size={20} />
              {topUsersView === "received"
                ? "Top Users Engaging With You"
                : "Users You Engage With Most"}
            </h2>
            <div className="flex items-center gap-2 text-sm">
              <button
                onClick={() => setTopUsersView("received")}
                className={`touch-target rounded-lg px-3 py-1 transition-all ${
                  topUsersView === "received" ? "font-semibold" : ""
                }`}
                style={{
                  backgroundColor:
                    topUsersView === "received"
                      ? "var(--asph-primary)"
                      : "var(--asph-bg-tertiary)",
                  color:
                    topUsersView === "received"
                      ? "white"
                      : "var(--asph-text-secondary)",
                }}
              >
                Received
              </button>
              <button
                onClick={() => setTopUsersView("sent")}
                className={`touch-target rounded-lg px-3 py-1 transition-all ${
                  topUsersView === "sent" ? "font-semibold" : ""
                }`}
                style={{
                  backgroundColor:
                    topUsersView === "sent"
                      ? "var(--asph-primary)"
                      : "var(--asph-bg-tertiary)",
                  color:
                    topUsersView === "sent"
                      ? "white"
                      : "var(--asph-text-secondary)",
                }}
              >
                Sent
              </button>
            </div>
          </div>
          <div className="space-y-3">
            {topUsersView === "received" ? (
              analytics.topUsers.map(({ handle, count, user }) => (
                <div key={handle} className="flex items-center gap-3">
                  {user?.avatar ? (
                    <img
                      src={proxifyBskyImage(user.avatar)}
                      alt={handle}
                      className="h-10 w-10 rounded-full border-2"
                      style={{ borderColor: "var(--asph-border-primary)" }}
                    />
                  ) : (
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-full"
                      style={{
                        backgroundColor: "var(--asph-bg-tertiary)",
                        color: "var(--asph-text-secondary)",
                      }}
                    >
                      {handle.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1">
                    <p
                      className="text-sm font-medium"
                      style={{ color: "var(--asph-text-primary)" }}
                    >
                      {user?.displayName || handle}
                    </p>
                    <p
                      className="text-xs"
                      style={{ color: "var(--asph-text-secondary)" }}
                    >
                      @{handle}
                    </p>
                  </div>
                  <span
                    className="text-sm"
                    style={{ color: "var(--asph-text-primary)" }}
                  >
                    {count} interactions
                  </span>
                </div>
              ))
            ) : topUsersSent ? (
              topUsersSent.map((user) => (
                <div key={user.handle} className="flex items-center gap-3">
                  {user.avatar ? (
                    <img
                      src={proxifyBskyImage(user.avatar)}
                      alt={user.handle}
                      className="h-10 w-10 rounded-full border-2"
                      style={{ borderColor: "var(--asph-border-primary)" }}
                    />
                  ) : (
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-full"
                      style={{
                        backgroundColor: "var(--asph-bg-tertiary)",
                        color: "var(--asph-text-secondary)",
                      }}
                    >
                      {user.handle?.charAt(0).toUpperCase() || "U"}
                    </div>
                  )}
                  <div className="flex-1">
                    <p
                      className="text-sm font-medium"
                      style={{ color: "var(--asph-text-primary)" }}
                    >
                      {user.displayName || user.handle}
                    </p>
                    <p
                      className="text-xs"
                      style={{ color: "var(--asph-text-secondary)" }}
                    >
                      @{user.handle}
                    </p>
                    <div className="mt-1 flex items-center gap-3">
                      {user.likes > 0 && (
                        <span
                          className="text-xs"
                          style={{ color: "var(--asph-text-secondary)" }}
                        >
                          <span style={{ color: "#ef4444" }}>♥</span>{" "}
                          {user.likes}
                        </span>
                      )}
                      {user.replies > 0 && (
                        <span
                          className="text-xs"
                          style={{ color: "var(--asph-text-secondary)" }}
                        >
                          <span style={{ color: "#4ade80" }}>↩</span>{" "}
                          {user.replies}
                        </span>
                      )}
                      {user.reposts > 0 && (
                        <span
                          className="text-xs"
                          style={{ color: "var(--asph-text-secondary)" }}
                        >
                          <span style={{ color: "#60a5fa" }}>⟲</span>{" "}
                          {user.reposts}
                        </span>
                      )}
                    </div>
                  </div>
                  <span
                    className="text-sm font-medium"
                    style={{ color: "var(--asph-text-primary)" }}
                  >
                    {user.total}
                  </span>
                </div>
              ))
            ) : (
              <div
                className="py-8 text-center"
                style={{ color: "var(--asph-text-secondary)" }}
              >
                <p className="text-sm">Loading...</p>
              </div>
            )}
          </div>
        </div>

        {/* Your Activity */}
        {userActivity && (
          <div className="asph-card p-4">
            <h2
              className="mb-4 flex items-center gap-2 text-lg font-semibold"
              style={{ color: "var(--asph-text-primary)" }}
            >
              <Send size={20} className="text-blue-500" />
              Your Activity
            </h2>

            <div
              className="mb-3 text-sm"
              style={{ color: "var(--asph-text-secondary)" }}
            >
              Showing cumulative engagement on original posts (not reposts) from
              the last{" "}
              {timeRange === "1d"
                ? "24 hours"
                : timeRange === "3d"
                  ? "3 days"
                  : timeRange === "7d"
                    ? "7 days"
                    : "4 weeks"}
            </div>

            <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
              <div
                className="rounded-lg p-3 text-center"
                style={{ backgroundColor: "var(--asph-bg-tertiary)" }}
              >
                <div
                  className="text-2xl font-bold"
                  style={{ color: "var(--asph-primary)" }}
                >
                  {userActivity.postsCount}
                </div>
                <div
                  className="text-sm"
                  style={{ color: "var(--asph-text-secondary)" }}
                >
                  Posts
                </div>
              </div>

              <div
                className="rounded-lg p-3 text-center"
                style={{ backgroundColor: "var(--asph-bg-tertiary)" }}
              >
                <div className="text-2xl font-bold text-red-600 dark:text-red-500">
                  {userActivity.likesReceived}
                </div>
                <div
                  className="text-sm"
                  style={{ color: "var(--asph-text-secondary)" }}
                >
                  Total Likes on Posts
                </div>
              </div>

              <div
                className="rounded-lg p-3 text-center"
                style={{ backgroundColor: "var(--asph-bg-tertiary)" }}
              >
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-500">
                  {userActivity.repostsReceived}
                </div>
                <div
                  className="text-sm"
                  style={{ color: "var(--asph-text-secondary)" }}
                >
                  Total Reposts
                </div>
              </div>

              <div
                className="rounded-lg p-3 text-center"
                style={{ backgroundColor: "var(--asph-bg-tertiary)" }}
              >
                <div className="text-2xl font-bold text-green-600 dark:text-green-500">
                  {userActivity.repliesReceived}
                </div>
                <div
                  className="text-sm"
                  style={{ color: "var(--asph-text-secondary)" }}
                >
                  Total Replies
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="text-center">
                <div
                  className="font-semibold"
                  style={{ color: "var(--asph-text-primary)" }}
                >
                  {userActivity.followersCount}
                </div>
                <div style={{ color: "var(--asph-text-secondary)" }}>
                  Followers
                </div>
              </div>
              <div className="text-center">
                <div
                  className="font-semibold"
                  style={{ color: "var(--asph-text-primary)" }}
                >
                  {userActivity.followingCount}
                </div>
                <div style={{ color: "var(--asph-text-secondary)" }}>
                  Following
                </div>
              </div>
              <div className="text-center">
                <div
                  className="font-semibold"
                  style={{ color: "var(--asph-text-primary)" }}
                >
                  {userActivity.postsTotal}
                </div>
                <div style={{ color: "var(--asph-text-secondary)" }}>
                  Total Posts
                </div>
              </div>
            </div>

            {userActivity.postsCount > 0 && (
              <div
                className="mt-4 text-sm"
                style={{ color: "var(--asph-text-secondary)" }}
              >
                <div className="flex items-center justify-between">
                  <span>Engagement Rate</span>
                  <span
                    className="font-semibold"
                    style={{ color: "var(--asph-text-primary)" }}
                  >
                    {(
                      (userActivity.likesReceived +
                        userActivity.repostsReceived +
                        userActivity.repliesReceived) /
                      userActivity.postsCount
                    ).toFixed(1)}{" "}
                    per post
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Engagement Summary */}
        <div className="asph-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Calendar size={20} className="text-blue-500" />
              <span
                className="text-sm font-medium"
                style={{ color: "var(--asph-text-primary)" }}
              >
                {timeRange === "1d"
                  ? "Last 24 hours"
                  : timeRange === "3d"
                    ? "Last 3 days"
                    : timeRange === "7d"
                      ? "Last 7 days"
                      : "Last 4 weeks"}
              </span>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <div>
                <span
                  className="font-semibold"
                  style={{ color: "var(--asph-text-primary)" }}
                >
                  {analytics.totalEngagement}
                </span>
                <span style={{ color: "var(--asph-text-secondary)" }}>
                  {" "}
                  total interactions
                </span>
              </div>
              <div>
                <span
                  className="font-semibold"
                  style={{ color: "var(--asph-text-primary)" }}
                >
                  {timeRange === "1d"
                    ? analytics.averagePerHour.toFixed(1)
                    : Math.round(analytics.averagePerDay)}
                </span>
                <span style={{ color: "var(--asph-text-secondary)" }}>
                  {" "}
                  {timeRange === "1d" ? "per hour" : "per day"}
                </span>
              </div>
            </div>
          </div>
          <div
            className="mt-2 text-xs"
            style={{ color: "var(--asph-text-secondary)" }}
          >
            {(() => {
              const now = new Date();
              const startDate =
                timeRange === "1d"
                  ? subHours(now, 24)
                  : timeRange === "3d"
                    ? subDays(now, 3)
                    : timeRange === "7d"
                      ? subDays(now, 7)
                      : subDays(now, 28);
              return `${format(startDate, "MMM d, h:mm a")} - ${format(now, "MMM d, h:mm a")} (${Intl.DateTimeFormat().resolvedOptions().timeZone})`;
            })()}
          </div>
        </div>
      </div>
    );
  },
);
