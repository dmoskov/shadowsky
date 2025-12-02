import type { AppBskyFeedDefs } from "@atproto/api";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Sparkles } from "lucide-react";
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
  } = useQuery<CachedThreadSummary>({
    queryKey: ["thread-summary", threadUri],
    queryFn: async () => {
      return await threadSummaryCacheService.getThreadSummary(
        threadUri,
        summaryPosts,
        "tldr",
        { source: "viewed" },
      );
    },
    enabled: shouldFetchSummary,
    staleTime: STALE_TIME_MS,
    gcTime: STALE_TIME_MS * 2,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  // Don't render anything if we don't have enough posts
  if (!shouldFetchSummary) {
    return null;
  }

  // Loading state - minimal
  if (isLoading) {
    return (
      <div
        className={`flex items-center gap-2 px-3 py-2 ${className}`}
        style={{
          backgroundColor: "var(--bsky-bg-tertiary)",
          borderRadius: "6px",
        }}
      >
        <Loader2
          size={14}
          className="animate-spin"
          style={{ color: "var(--bsky-text-tertiary)" }}
        />
        <span
          className="text-sm"
          style={{ color: "var(--bsky-text-tertiary)" }}
        >
          Summarizing thread...
        </span>
      </div>
    );
  }

  // Error state - minimal, don't show error UI to user
  if (error) {
    return null;
  }

  // Success state - show summary (minimal UI)
  if (summary) {
    return (
      <div
        className={`flex items-start gap-2 px-3 py-2 ${className}`}
        style={{
          backgroundColor: "var(--bsky-bg-tertiary)",
          borderRadius: "6px",
        }}
      >
        <Sparkles
          size={14}
          className="mt-0.5 flex-shrink-0"
          style={{ color: "var(--bsky-text-tertiary)" }}
        />
        <span
          className="text-sm leading-relaxed"
          style={{ color: "var(--bsky-text-secondary)" }}
        >
          {summary.summary}
        </span>
      </div>
    );
  }

  return null;
}

// Wrap with ErrorBoundary for safety - fail silently
export function ThreadHaikuSummary(props: ThreadHaikuSummaryProps) {
  return (
    <ErrorBoundary componentName="ThreadHaikuSummary" fallback={null}>
      <ThreadHaikuSummaryContent {...props} />
    </ErrorBoundary>
  );
}

export default ThreadHaikuSummary;
