import type { AppBskyFeedDefs } from "@atproto/api";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Sparkles } from "lucide-react";
import {
  type ThreadSummaryFormat,
  type ThreadSummaryPost,
} from "../services/anthropic";
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
  /** Parent URIs for each post (to track thread depth) */
  parentUris?: Map<string, string>;
}

const STALE_TIME_MS = 10 * 60 * 1000; // 10 minutes

function ThreadHaikuSummaryContent({
  posts,
  threadUri,
  className = "",
  parentUris,
}: ThreadHaikuSummaryProps) {
  // Only trigger when there are 5+ posts
  const shouldFetchSummary = posts.length >= 5;

  // Calculate total engagement to determine summary format
  const totalEngagement = posts.reduce(
    (sum, p) =>
      sum + (p.likeCount || 0) + (p.replyCount || 0) + (p.repostCount || 0),
    0,
  );

  // Use extended format for highly engaged threads (>100 engagement or >20 posts)
  const summaryFormat: ThreadSummaryFormat =
    totalEngagement > 100 || posts.length > 20 ? "extended" : "tldr";

  // Calculate depth based on parent chain
  const getDepth = (postUri: string): number => {
    if (!parentUris) return 0;
    let depth = 0;
    let currentUri = postUri;
    while (parentUris.has(currentUri)) {
      depth++;
      currentUri = parentUris.get(currentUri)!;
      if (depth > 100) break; // Safety limit
    }
    return depth;
  };

  // Convert posts to ThreadSummaryPost format with full metadata
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
    queryKey: ["thread-summary", threadUri, summaryFormat],
    queryFn: async () => {
      return await threadSummaryCacheService.getThreadSummary(
        threadUri,
        summaryPosts,
        summaryFormat,
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

  // Helper to convert AT URI to bsky.app link
  const getPostLink = (uri: string, authorHandle: string) => {
    const postId = uri.split("/").pop();
    return `https://bsky.app/profile/${authorHandle}/post/${postId}`;
  };

  // Success state - show summary with conditional extended styling
  if (summary) {
    const isExtended = summary.format === "extended";
    const highlights = summary.metadata?.highlightedSubThreads;

    return (
      <div
        className={`px-3 py-2 ${className}`}
        style={{
          backgroundColor: "var(--bsky-bg-tertiary)",
          borderRadius: "6px",
        }}
      >
        <div className="flex items-start gap-2">
          <Sparkles
            size={14}
            className="mt-0.5 flex-shrink-0"
            style={{ color: "var(--bsky-text-tertiary)" }}
          />
          <div className="min-w-0 flex-1">
            <div
              className={`text-sm leading-relaxed ${isExtended ? "whitespace-pre-wrap" : ""}`}
              style={{ color: "var(--bsky-text-secondary)" }}
            >
              {summary.summary}
            </div>

            {/* Show highlighted sub-threads for extended summaries */}
            {isExtended && highlights && highlights.length > 0 && (
              <div
                className="mt-3 border-t pt-2"
                style={{ borderColor: "var(--bsky-border)" }}
              >
                <div
                  className="mb-2 text-xs font-medium"
                  style={{ color: "var(--bsky-text-tertiary)" }}
                >
                  Notable replies
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
          </div>
        </div>
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
