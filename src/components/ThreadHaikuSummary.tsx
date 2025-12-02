import type { AppBskyFeedDefs } from "@atproto/api";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Database,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { type ThreadSummaryPost } from "../services/anthropic";
import {
  type CachedThreadSummary,
  threadSummaryCacheService,
} from "../services/thread-summary-cache";
import { ErrorBoundary } from "./ErrorBoundary";

type Post = AppBskyFeedDefs.PostView;

interface ThreadHaikuSummaryProps {
  posts: Post[];
  threadUri: string;
  className?: string;
}

const STALE_TIME_MS = 10 * 60 * 1000; // 10 minutes

function ThreadHaikuSummaryContent({
  posts,
  threadUri,
  className = "",
}: ThreadHaikuSummaryProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [forceRefresh, setForceRefresh] = useState(false);

  // Only trigger when there are 5+ posts
  const shouldFetchSummary = posts.length >= 5;

  // Convert posts to ThreadSummaryPost format
  const summaryPosts: ThreadSummaryPost[] = posts.map((post) => ({
    text: (post.record as { text?: string })?.text || "",
    author: post.author.displayName || post.author.handle,
    likes: post.likeCount || 0,
    replies: post.replyCount || 0,
  }));

  const {
    data: summary,
    isLoading,
    error,
    refetch,
    dataUpdatedAt,
    isFetching,
  } = useQuery<CachedThreadSummary>({
    queryKey: ["thread-summary", threadUri],
    queryFn: async () => {
      const result = await threadSummaryCacheService.getThreadSummary(
        threadUri,
        summaryPosts,
        "haiku",
        { forceRefresh, source: "viewed" },
      );
      // Reset forceRefresh after query completes
      setForceRefresh(false);
      return result;
    },
    enabled: shouldFetchSummary,
    staleTime: STALE_TIME_MS,
    gcTime: STALE_TIME_MS * 2, // Keep in cache for twice as long
    retry: 1,
    refetchOnWindowFocus: false,
  });

  // Handle manual refresh
  const handleRefresh = () => {
    setForceRefresh(true);
    refetch();
  };

  // Don't render anything if we don't have enough posts
  if (!shouldFetchSummary) {
    return null;
  }

  // Compute staleness text
  const getStalenessText = () => {
    if (!dataUpdatedAt) return null;
    return formatDistanceToNow(new Date(dataUpdatedAt), { addSuffix: true });
  };

  // Loading state - show skeleton
  if (isLoading) {
    return (
      <div
        className={`rounded-lg ${className}`}
        style={{
          backgroundColor: "var(--bsky-bg-secondary)",
          border: "1px solid var(--bsky-border-primary)",
        }}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          <Loader2
            size={18}
            className="animate-spin"
            style={{ color: "var(--bsky-primary)" }}
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Sparkles size={16} style={{ color: "var(--bsky-primary)" }} />
              <span
                className="text-sm font-semibold"
                style={{ color: "var(--bsky-text-primary)" }}
              >
                AI Summary
              </span>
              <span
                className="rounded-full px-2 py-0.5 text-xs"
                style={{
                  backgroundColor: "rgba(139, 92, 246, 0.1)",
                  color: "rgb(139, 92, 246)",
                }}
              >
                Generating...
              </span>
            </div>
            <div className="mt-2 space-y-2">
              <div
                className="h-4 w-3/4 animate-pulse rounded"
                style={{ backgroundColor: "var(--bsky-bg-tertiary)" }}
              />
              <div
                className="h-4 w-2/3 animate-pulse rounded"
                style={{ backgroundColor: "var(--bsky-bg-tertiary)" }}
              />
              <div
                className="h-4 w-1/2 animate-pulse rounded"
                style={{ backgroundColor: "var(--bsky-bg-tertiary)" }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div
        className={`rounded-lg ${className}`}
        style={{
          backgroundColor: "var(--bsky-bg-secondary)",
          border: "1px solid var(--bsky-border-primary)",
        }}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          <AlertTriangle size={18} className="text-amber-500" />
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={16} style={{ color: "var(--bsky-primary)" }} />
                <span
                  className="text-sm font-semibold"
                  style={{ color: "var(--bsky-text-primary)" }}
                >
                  AI Summary
                </span>
                <span
                  className="rounded-full px-2 py-0.5 text-xs"
                  style={{
                    backgroundColor: "rgba(245, 158, 11, 0.1)",
                    color: "rgb(245, 158, 11)",
                  }}
                >
                  Unavailable
                </span>
              </div>
              <button
                onClick={handleRefresh}
                disabled={isFetching}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
                style={{ color: "var(--bsky-text-secondary)" }}
                title="Retry generating summary"
              >
                <RefreshCw
                  size={14}
                  className={isFetching ? "animate-spin" : ""}
                />
                <span>Retry</span>
              </button>
            </div>
            <p
              className="mt-1 text-xs"
              style={{ color: "var(--bsky-text-tertiary)" }}
            >
              {error instanceof Error
                ? error.message
                : "Could not generate summary"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Success state - show summary
  if (summary) {
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
          onClick={() => setCollapsed(!collapsed)}
          className="flex w-full items-center justify-between px-4 py-3 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <div className="flex items-center gap-2">
            <Sparkles size={18} style={{ color: "var(--bsky-primary)" }} />
            <span
              className="text-sm font-semibold"
              style={{ color: "var(--bsky-text-primary)" }}
            >
              AI Summary
            </span>
            <span
              className="rounded-full px-2 py-0.5 text-xs"
              style={{
                backgroundColor: "rgba(139, 92, 246, 0.1)",
                color: "rgb(139, 92, 246)",
              }}
            >
              Haiku
            </span>
          </div>
          <div className="flex items-center gap-2">
            {getStalenessText() && (
              <span
                className="text-xs"
                style={{ color: "var(--bsky-text-tertiary)" }}
              >
                Updated {getStalenessText()}
              </span>
            )}
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
          </div>
        </button>

        {/* Expandable content */}
        {!collapsed && (
          <div
            className="border-t px-4 py-4"
            style={{ borderColor: "var(--bsky-border-primary)" }}
          >
            {/* Haiku display */}
            <div
              className="mb-3 whitespace-pre-line font-serif text-base italic leading-relaxed"
              style={{ color: "var(--bsky-text-primary)" }}
            >
              {summary.summary}
            </div>

            {/* Metadata and refresh button */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span
                  className="text-xs"
                  style={{ color: "var(--bsky-text-tertiary)" }}
                >
                  {summary.metadata.postCount} posts •{" "}
                  {summary.metadata.authors.length} authors
                </span>
                {summary.cached && (
                  <span
                    className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs"
                    style={{
                      backgroundColor: "rgba(34, 197, 94, 0.1)",
                      color: "rgb(34, 197, 94)",
                    }}
                    title="Available offline"
                  >
                    <Database size={10} />
                    Offline
                  </span>
                )}
              </div>
              <button
                onClick={handleRefresh}
                disabled={isFetching}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
                style={{ color: "var(--bsky-text-secondary)" }}
                title="Refresh summary"
              >
                <RefreshCw
                  size={14}
                  className={isFetching ? "animate-spin" : ""}
                />
                <span>{isFetching ? "Refreshing..." : "Refresh"}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}

// Wrap with ErrorBoundary for safety
export function ThreadHaikuSummary(props: ThreadHaikuSummaryProps) {
  return (
    <ErrorBoundary
      componentName="ThreadHaikuSummary"
      fallback={
        <div
          className={`rounded-lg ${props.className || ""}`}
          style={{
            backgroundColor: "var(--bsky-bg-secondary)",
            border: "1px solid var(--bsky-border-primary)",
          }}
        >
          <div className="flex items-center gap-2 px-4 py-3">
            <AlertTriangle size={16} className="text-amber-500" />
            <span
              className="text-sm"
              style={{ color: "var(--bsky-text-secondary)" }}
            >
              AI Summary temporarily unavailable
            </span>
          </div>
        </div>
      }
    >
      <ThreadHaikuSummaryContent {...props} />
    </ErrorBoundary>
  );
}

export default ThreadHaikuSummary;
