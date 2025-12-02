import type { AppBskyFeedDefs } from "@atproto/api";
import { formatDistanceToNow } from "date-fns";
import {
  BarChart3,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Heart,
  MessageCircle,
  Repeat2,
  TrendingUp,
  Users,
} from "lucide-react";
import React, { useMemo, useState } from "react";
import { proxifyBskyImage } from "../utils/image-proxy";

type Post = AppBskyFeedDefs.PostView;

interface PostEngagement {
  post: Post;
  likes: number;
  reposts: number;
  replies: number;
  total: number;
  percentOfTotal: number;
  rank: number;
}

interface ThreadEngagementAnalyticsProps {
  posts: Post[];
  className?: string;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const ThreadEngagementAnalytics: React.FC<
  ThreadEngagementAnalyticsProps
> = ({
  posts,
  className = "",
  collapsed: controlledCollapsed,
  onToggleCollapse,
}) => {
  const [internalCollapsed, setInternalCollapsed] = useState(true);
  const collapsed = controlledCollapsed ?? internalCollapsed;
  const toggleCollapse =
    onToggleCollapse ?? (() => setInternalCollapsed((prev) => !prev));

  // Calculate engagement metrics
  const analytics = useMemo(() => {
    const postEngagements: PostEngagement[] = posts.map((post) => ({
      post,
      likes: post.likeCount || 0,
      reposts: post.repostCount || 0,
      replies: post.replyCount || 0,
      total:
        (post.likeCount || 0) +
        (post.repostCount || 0) +
        (post.replyCount || 0),
      percentOfTotal: 0,
      rank: 0,
    }));

    // Calculate totals
    const totalLikes = postEngagements.reduce((sum, p) => sum + p.likes, 0);
    const totalReposts = postEngagements.reduce((sum, p) => sum + p.reposts, 0);
    const totalReplies = postEngagements.reduce((sum, p) => sum + p.replies, 0);
    const totalEngagement = totalLikes + totalReposts + totalReplies;

    // Calculate percentages and rank
    postEngagements.forEach((p) => {
      p.percentOfTotal =
        totalEngagement > 0 ? (p.total / totalEngagement) * 100 : 0;
    });

    // Sort by total engagement to determine rank
    const sortedByEngagement = [...postEngagements].sort(
      (a, b) => b.total - a.total,
    );
    sortedByEngagement.forEach((p, idx) => {
      p.rank = idx + 1;
    });

    // Get unique authors
    const uniqueAuthors = new Map<
      string,
      {
        displayName?: string;
        handle: string;
        avatar?: string;
        postCount: number;
      }
    >();
    posts.forEach((post) => {
      const existing = uniqueAuthors.get(post.author.did);
      if (existing) {
        existing.postCount++;
      } else {
        uniqueAuthors.set(post.author.did, {
          displayName: post.author.displayName,
          handle: post.author.handle,
          avatar: post.author.avatar,
          postCount: 1,
        });
      }
    });

    // Find the best performing post
    const topPost = sortedByEngagement[0];

    // Calculate engagement rate trend (compare first half vs second half)
    const firstHalf = postEngagements.slice(
      0,
      Math.ceil(postEngagements.length / 2),
    );
    const secondHalf = postEngagements.slice(
      Math.ceil(postEngagements.length / 2),
    );
    const firstHalfAvg =
      firstHalf.length > 0
        ? firstHalf.reduce((sum, p) => sum + p.total, 0) / firstHalf.length
        : 0;
    const secondHalfAvg =
      secondHalf.length > 0
        ? secondHalf.reduce((sum, p) => sum + p.total, 0) / secondHalf.length
        : 0;
    const trend =
      firstHalfAvg > 0
        ? ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100
        : 0;

    return {
      postEngagements,
      totalLikes,
      totalReposts,
      totalReplies,
      totalEngagement,
      uniqueAuthors: Array.from(uniqueAuthors.values()),
      topPost,
      trend,
      avgEngagementPerPost:
        posts.length > 0 ? totalEngagement / posts.length : 0,
    };
  }, [posts]);

  // Render engagement bar
  const renderEngagementBar = (value: number, max: number, color: string) => {
    const width = max > 0 ? (value / max) * 100 : 0;
    return (
      <div
        className="h-2 rounded-full"
        style={{ backgroundColor: "var(--bsky-bg-tertiary)" }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${width}%`,
            backgroundColor: color,
          }}
        />
      </div>
    );
  };

  const maxEngagement = Math.max(
    ...analytics.postEngagements.map((p) => p.total),
    1,
  );

  return (
    <div
      className={`rounded-lg ${className}`}
      style={{
        backgroundColor: "var(--bsky-bg-secondary)",
        border: "1px solid var(--bsky-border-primary)",
      }}
    >
      {/* Header - always visible */}
      <button
        onClick={toggleCollapse}
        className="flex w-full items-center justify-between px-4 py-3 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
      >
        <div className="flex items-center gap-2">
          <BarChart3 size={18} style={{ color: "var(--bsky-primary)" }} />
          <span
            className="text-sm font-semibold"
            style={{ color: "var(--bsky-text-primary)" }}
          >
            Thread Analytics
          </span>
          <span
            className="rounded-full px-2 py-0.5 text-xs"
            style={{
              backgroundColor: "var(--bsky-bg-tertiary)",
              color: "var(--bsky-text-secondary)",
            }}
          >
            {analytics.totalEngagement.toLocaleString()} total engagements
          </span>
        </div>
        {collapsed ? (
          <ChevronDown
            size={18}
            style={{ color: "var(--bsky-text-secondary)" }}
          />
        ) : (
          <ChevronUp
            size={18}
            style={{ color: "var(--bsky-text-secondary)" }}
          />
        )}
      </button>

      {/* Expandable content */}
      {!collapsed && (
        <div
          className="border-t px-4 py-4"
          style={{ borderColor: "var(--bsky-border-primary)" }}
        >
          {/* Summary stats */}
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div
              className="rounded-lg p-3 text-center"
              style={{ backgroundColor: "var(--bsky-bg-tertiary)" }}
            >
              <div className="flex items-center justify-center gap-1.5">
                <Heart size={14} className="text-red-500" />
                <span
                  className="text-lg font-bold"
                  style={{ color: "var(--bsky-text-primary)" }}
                >
                  {analytics.totalLikes.toLocaleString()}
                </span>
              </div>
              <span
                className="text-xs"
                style={{ color: "var(--bsky-text-tertiary)" }}
              >
                Total Likes
              </span>
            </div>

            <div
              className="rounded-lg p-3 text-center"
              style={{ backgroundColor: "var(--bsky-bg-tertiary)" }}
            >
              <div className="flex items-center justify-center gap-1.5">
                <Repeat2 size={14} className="text-green-500" />
                <span
                  className="text-lg font-bold"
                  style={{ color: "var(--bsky-text-primary)" }}
                >
                  {analytics.totalReposts.toLocaleString()}
                </span>
              </div>
              <span
                className="text-xs"
                style={{ color: "var(--bsky-text-tertiary)" }}
              >
                Total Reposts
              </span>
            </div>

            <div
              className="rounded-lg p-3 text-center"
              style={{ backgroundColor: "var(--bsky-bg-tertiary)" }}
            >
              <div className="flex items-center justify-center gap-1.5">
                <MessageCircle size={14} className="text-blue-500" />
                <span
                  className="text-lg font-bold"
                  style={{ color: "var(--bsky-text-primary)" }}
                >
                  {analytics.totalReplies.toLocaleString()}
                </span>
              </div>
              <span
                className="text-xs"
                style={{ color: "var(--bsky-text-tertiary)" }}
              >
                Total Replies
              </span>
            </div>

            <div
              className="rounded-lg p-3 text-center"
              style={{ backgroundColor: "var(--bsky-bg-tertiary)" }}
            >
              <div className="flex items-center justify-center gap-1.5">
                <TrendingUp
                  size={14}
                  className={
                    analytics.trend >= 0 ? "text-green-500" : "text-red-500"
                  }
                />
                <span
                  className="text-lg font-bold"
                  style={{ color: "var(--bsky-text-primary)" }}
                >
                  {analytics.trend > 0 ? "+" : ""}
                  {analytics.trend.toFixed(0)}%
                </span>
              </div>
              <span
                className="text-xs"
                style={{ color: "var(--bsky-text-tertiary)" }}
              >
                Engagement Trend
              </span>
            </div>
          </div>

          {/* Per-post breakdown */}
          <div className="mb-4">
            <div className="mb-2">
              <h4
                className="flex items-center gap-2 text-sm font-medium"
                style={{ color: "var(--bsky-text-primary)" }}
              >
                <BarChart3 size={14} />
                Posts in Thread
              </h4>
              <p
                className="mt-0.5 text-xs"
                style={{ color: "var(--bsky-text-tertiary)" }}
              >
                Ranked by engagement (likes + reposts + replies)
              </p>
            </div>
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {analytics.postEngagements.map((pe) => {
                // Extract post ID from URI for linking
                const postId = pe.post.uri.split("/").pop();
                const postUrl = `https://bsky.app/profile/${pe.post.author.handle}/post/${postId}`;
                const profileUrl = `https://bsky.app/profile/${pe.post.author.handle}`;
                const postText =
                  (pe.post.record as { text?: string })?.text || "";

                return (
                  <div
                    key={pe.post.uri}
                    className="rounded-lg p-2"
                    style={{ backgroundColor: "var(--bsky-bg-tertiary)" }}
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${
                            pe.rank === 1
                              ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
                              : pe.rank === 2
                                ? "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                                : pe.rank === 3
                                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
                                  : ""
                          }`}
                          style={
                            pe.rank > 3
                              ? {
                                  backgroundColor: "var(--bsky-bg-secondary)",
                                  color: "var(--bsky-text-tertiary)",
                                }
                              : {}
                          }
                          title={`Rank ${pe.rank} by engagement`}
                        >
                          #{pe.rank}
                        </span>
                        <a
                          href={profileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 transition-opacity hover:opacity-70"
                          title={`View ${pe.post.author.displayName || pe.post.author.handle}'s profile`}
                        >
                          <img
                            src={
                              proxifyBskyImage(pe.post.author.avatar) ||
                              "/default-avatar.svg"
                            }
                            alt=""
                            className="h-5 w-5 rounded-full"
                          />
                          <span
                            className="truncate text-xs font-medium"
                            style={{ color: "var(--bsky-text-primary)" }}
                          >
                            {pe.post.author.displayName ||
                              pe.post.author.handle}
                          </span>
                        </a>
                        <span
                          className="text-xs"
                          style={{ color: "var(--bsky-text-tertiary)" }}
                        >
                          {formatDistanceToNow(new Date(pe.post.indexedAt), {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="flex items-center gap-1 text-red-500">
                          <Heart size={10} />
                          {pe.likes}
                        </span>
                        <span className="flex items-center gap-1 text-green-500">
                          <Repeat2 size={10} />
                          {pe.reposts}
                        </span>
                        <span className="flex items-center gap-1 text-blue-500">
                          <MessageCircle size={10} />
                          {pe.replies}
                        </span>
                        <a
                          href={postUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 transition-opacity hover:opacity-70"
                          style={{ color: "var(--bsky-text-tertiary)" }}
                          title="Open post in Bluesky"
                        >
                          <ExternalLink size={10} />
                        </a>
                      </div>
                    </div>

                    {/* Post content preview */}
                    {postText && (
                      <a
                        href={postUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mb-1 mt-2 line-clamp-2 block text-xs transition-opacity hover:opacity-70"
                        style={{ color: "var(--bsky-text-secondary)" }}
                        title="View this post"
                      >
                        {postText}
                      </a>
                    )}

                    <div className="mt-1">
                      {renderEngagementBar(
                        pe.total,
                        maxEngagement,
                        "var(--bsky-primary)",
                      )}
                    </div>
                    <div
                      className="mt-1 text-right text-xs"
                      style={{ color: "var(--bsky-text-tertiary)" }}
                    >
                      {pe.percentOfTotal.toFixed(1)}% of thread engagement
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Participants */}
          <div>
            <h4
              className="mb-2 flex items-center gap-2 text-sm font-medium"
              style={{ color: "var(--bsky-text-primary)" }}
            >
              <Users size={14} />
              Thread Participants ({analytics.uniqueAuthors.length})
            </h4>
            <div className="flex flex-wrap gap-2">
              {analytics.uniqueAuthors
                .sort((a, b) => b.postCount - a.postCount)
                .slice(0, 10)
                .map((author) => (
                  <div
                    key={author.handle}
                    className="flex items-center gap-1.5 rounded-full px-2 py-1"
                    style={{ backgroundColor: "var(--bsky-bg-tertiary)" }}
                  >
                    <img
                      src={
                        proxifyBskyImage(author.avatar) || "/default-avatar.svg"
                      }
                      alt=""
                      className="h-4 w-4 rounded-full"
                    />
                    <span
                      className="text-xs font-medium"
                      style={{ color: "var(--bsky-text-primary)" }}
                    >
                      {author.displayName || author.handle}
                    </span>
                    <span
                      className="rounded bg-gray-200 px-1 text-xs dark:bg-gray-700"
                      style={{ color: "var(--bsky-text-secondary)" }}
                    >
                      {author.postCount}
                    </span>
                  </div>
                ))}
              {analytics.uniqueAuthors.length > 10 && (
                <span
                  className="rounded-full px-2 py-1 text-xs"
                  style={{
                    backgroundColor: "var(--bsky-bg-tertiary)",
                    color: "var(--bsky-text-tertiary)",
                  }}
                >
                  +{analytics.uniqueAuthors.length - 10} more
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
