/**
 * ProgressiveThreadSummary - AI summary that scales with thread complexity
 *
 * Summary depth tiers:
 * - none: No summary (minimal threads)
 * - brief: 1 sentence TL;DR (simple threads, 3-9 replies)
 * - moderate: 2-3 sentences (moderate threads, 10-29 replies)
 * - detailed: Paragraph with key points (complex threads, 30-74 replies)
 * - comprehensive: Multi-paragraph with sub-thread highlights (viral threads, 75+ replies)
 */

import type { AppBskyFeedDefs } from "@atproto/api";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import type { ThreadSummaryPost } from "../services/anthropic";
import {
  type CachedThreadSummary,
  threadSummaryCacheService,
} from "../services/thread-summary-cache";
import { createLogger } from "../utils/logger";
import { ErrorBoundary } from "./ErrorBoundary";

const logger = createLogger("ProgressiveThreadSummary");

type Post = AppBskyFeedDefs.PostView;

export type SummaryDepth =
  | "none"
  | "brief"
  | "moderate"
  | "detailed"
  | "comprehensive";

interface ProgressiveThreadSummaryProps {
  posts: Post[];
  threadUri: string;
  parentUris?: Map<string, string>;
  summaryDepth: SummaryDepth;
  className?: string;
}

const STALE_TIME_MS = 10 * 60 * 1000; // 10 minutes

// Map summary depth to API format and token limits
// minPosts is kept low since tier selection already gates complexity
const DEPTH_CONFIG: Record<
  SummaryDepth,
  {
    format: "brief" | "moderate" | "detailed" | "comprehensive";
    minPosts: number;
    description: string;
  }
> = {
  none: { format: "brief", minPosts: Infinity, description: "" },
  brief: {
    format: "brief",
    minPosts: 3, // Show for 3+ posts
    description: "Quick summary",
  },
  moderate: {
    format: "moderate",
    minPosts: 3, // Tier already requires 10+, but allow if forced
    description: "Thread overview",
  },
  detailed: {
    format: "detailed",
    minPosts: 3, // Tier already requires 30+
    description: "Detailed summary",
  },
  comprehensive: {
    format: "comprehensive",
    minPosts: 3, // Tier already requires 75+
    description: "Full conversation analysis",
  },
};

function ProgressiveThreadSummaryContent({
  posts,
  threadUri,
  parentUris,
  summaryDepth,
  className = "",
}: ProgressiveThreadSummaryProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const config = DEPTH_CONFIG[summaryDepth];

  // Don't fetch if depth is none or not enough posts
  const shouldFetch =
    summaryDepth !== "none" && posts.length >= config.minPosts;

  // Calculate depth based on parent chain
  const getDepth = (postUri: string): number => {
    if (!parentUris) return 0;
    let depth = 0;
    let currentUri = postUri;
    while (parentUris.has(currentUri)) {
      depth++;
      currentUri = parentUris.get(currentUri)!;
      if (depth > 100) break;
    }
    return depth;
  };

  // Convert posts to summary format
  const summaryPosts: ThreadSummaryPost[] = posts.map((post) => ({
    text: (post.record as { text?: string })?.text || "",
    author: post.author.displayName || post.author.handle,
    authorHandle: post.author.handle,
    likes: post.likeCount || 0,
    replies: post.replyCount || 0,
    reposts: post.repostCount || 0,
    uri: post.uri,
    parentUri: parentUris?.get(post.uri),
    depth: getDepth(post.uri),
  }));

  const {
    data: summary,
    isLoading,
    error,
  } = useQuery<CachedThreadSummary>({
    queryKey: ["progressive-thread-summary", threadUri, summaryDepth],
    queryFn: async () => {
      try {
        // Try the new format first
        return await threadSummaryCacheService.getThreadSummary(
          threadUri,
          summaryPosts,
          config.format,
          { source: "viewed" },
        );
      } catch (err) {
        // Fallback to "tldr" if new format not supported by backend
        logger.log(
          `Format "${config.format}" failed, falling back to "tldr":`,
          err,
        );
        return await threadSummaryCacheService.getThreadSummary(
          threadUri,
          summaryPosts,
          "tldr",
          { source: "viewed" },
        );
      }
    },
    enabled: shouldFetch,
    staleTime: STALE_TIME_MS,
    gcTime: STALE_TIME_MS * 2,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  if (!shouldFetch) {
    return null;
  }

  if (isLoading) {
    return (
      <div
        className={`flex items-center gap-2 px-3 py-2 ${className}`}
        style={{
          backgroundColor: "var(--bsky-bg-tertiary)",
          borderRadius: "8px",
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
          Generating {config.description.toLowerCase()}...
        </span>
      </div>
    );
  }

  // Log errors for debugging - they're often silent API failures
  if (error) {
    logger.error("Failed to fetch thread summary:", error);
    return (
      <div
        className={`flex items-center gap-2 px-3 py-2 ${className}`}
        style={{
          backgroundColor: "var(--bsky-bg-tertiary)",
          borderRadius: "8px",
        }}
      >
        <AlertCircle size={14} style={{ color: "var(--bsky-text-tertiary)" }} />
        <span
          className="text-sm"
          style={{ color: "var(--bsky-text-tertiary)" }}
        >
          Summary unavailable
        </span>
      </div>
    );
  }

  if (!summary) {
    return null;
  }

  const isComprehensive = summaryDepth === "comprehensive";
  const highlights = summary.metadata?.highlightedSubThreads;

  // Helper to convert AT URI to bsky.app link
  const getPostLink = (uri: string, authorHandle: string) => {
    const postId = uri.split("/").pop();
    return `https://bsky.app/profile/${authorHandle}/post/${postId}`;
  };

  return (
    <div
      className={`${className}`}
      style={{
        backgroundColor: "var(--bsky-bg-tertiary)",
        borderRadius: "8px",
      }}
    >
      {/* Header - collapsible for detailed/comprehensive */}
      <button
        className="flex w-full items-center gap-2 px-3 py-2"
        onClick={() => setIsExpanded(!isExpanded)}
        style={{ cursor: isComprehensive ? "pointer" : "default" }}
        disabled={!isComprehensive}
      >
        <Sparkles
          size={14}
          className="flex-shrink-0"
          style={{ color: "var(--bsky-text-tertiary)" }}
        />
        <span
          className="flex-1 text-left text-xs font-medium"
          style={{ color: "var(--bsky-text-tertiary)" }}
        >
          {config.description}
          {summary.metadata?.postCount && (
            <span className="ml-2 opacity-60">
              ({summary.metadata.postCount} posts
              {summary.metadata.authors &&
                `, ${summary.metadata.authors.length} participants`}
              )
            </span>
          )}
        </span>
        {isComprehensive && (
          <span style={{ color: "var(--bsky-text-tertiary)" }}>
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </span>
        )}
      </button>

      {/* Summary content */}
      {isExpanded && (
        <div className="px-3 pb-3">
          <div
            className={`text-sm leading-relaxed ${isComprehensive ? "whitespace-pre-wrap" : ""}`}
            style={{ color: "var(--bsky-text-secondary)" }}
          >
            {summary.summary}
          </div>

          {/* Highlighted sub-threads for comprehensive summaries */}
          {isComprehensive && highlights && highlights.length > 0 && (
            <div
              className="mt-3 border-t pt-3"
              style={{ borderColor: "var(--bsky-border)" }}
            >
              <div
                className="mb-2 text-xs font-medium"
                style={{ color: "var(--bsky-text-tertiary)" }}
              >
                Notable discussions
              </div>
              <div className="flex flex-wrap gap-2">
                {highlights.map((hl) => (
                  <a
                    key={hl.uri}
                    href={getPostLink(hl.uri, hl.authorHandle)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors hover:opacity-80"
                    style={{
                      backgroundColor: "var(--bsky-bg-secondary)",
                      color: "var(--bsky-text-secondary)",
                    }}
                  >
                    <span style={{ color: "var(--bsky-link)" }}>
                      @{hl.authorHandle}
                    </span>
                    <span style={{ color: "var(--bsky-text-tertiary)" }}>
                      ({hl.engagement} interactions)
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Thread sentiment/engagement insight for detailed+ */}
          {(summaryDepth === "detailed" || summaryDepth === "comprehensive") &&
            summary.metadata?.totalEngagement && (
              <div
                className="mt-2 text-xs"
                style={{ color: "var(--bsky-text-tertiary)" }}
              >
                {summary.metadata.totalEngagement.toLocaleString()} total
                interactions
              </div>
            )}
        </div>
      )}
    </div>
  );
}

export function ProgressiveThreadSummary(props: ProgressiveThreadSummaryProps) {
  return (
    <ErrorBoundary componentName="ProgressiveThreadSummary" fallback={null}>
      <ProgressiveThreadSummaryContent {...props} />
    </ErrorBoundary>
  );
}

export default ProgressiveThreadSummary;
