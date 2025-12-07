import type { AppBskyFeedDefs } from "@atproto/api";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Sparkles } from "lucide-react";
import type React from "react";
import {
  type ThreadSummaryFormat,
  type ThreadSummaryPost,
} from "../services/anthropic";
import {
  type CachedThreadSummary,
  threadSummaryCacheService,
} from "../services/thread-summary-cache";
import { ErrorBoundary } from "./ErrorBoundary";

/**
 * Simple markdown renderer for AI summaries
 * Handles: **bold**, *italic*, # headers, - bullet lists, 1. numbered lists, and newlines
 */
function renderMarkdown(text: string): React.ReactNode {
  // Split by double newlines to get paragraphs/blocks
  const blocks = text.split(/\n\n+/);

  return blocks.map((block, bIndex) => {
    // Check if it's a header
    const headerMatch = block.match(/^(#{1,3})\s+(.+)$/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      const content = headerMatch[2];
      const className =
        level === 1
          ? "text-base font-semibold mb-2 mt-3 first:mt-0"
          : level === 2
            ? "text-sm font-semibold mb-1.5 mt-2.5 first:mt-0"
            : "text-sm font-medium mb-1 mt-2 first:mt-0";
      return (
        <div key={bIndex} className={className}>
          {renderInlineMarkdown(content)}
        </div>
      );
    }

    // Check if block is a list (bullet or numbered)
    const lines = block.split(/\n/);
    const isBulletList = lines.every(
      (line) => /^[-*•]\s/.test(line.trim()) || line.trim() === "",
    );
    const isNumberedList = lines.every(
      (line) => /^\d+[.)]\s/.test(line.trim()) || line.trim() === "",
    );

    if (isBulletList && lines.some((l) => l.trim())) {
      return (
        <ul key={bIndex} className="mb-2 ml-4 list-disc space-y-1 last:mb-0">
          {lines
            .filter((line) => line.trim())
            .map((line, lIndex) => (
              <li key={lIndex} className="text-sm">
                {renderInlineMarkdown(line.trim().replace(/^[-*•]\s/, ""))}
              </li>
            ))}
        </ul>
      );
    }

    if (isNumberedList && lines.some((l) => l.trim())) {
      return (
        <ol key={bIndex} className="mb-2 ml-4 list-decimal space-y-1 last:mb-0">
          {lines
            .filter((line) => line.trim())
            .map((line, lIndex) => (
              <li key={lIndex} className="text-sm">
                {renderInlineMarkdown(line.trim().replace(/^\d+[.)]\s/, ""))}
              </li>
            ))}
        </ol>
      );
    }

    // Check for inline list items (lines starting with - within a paragraph)
    const hasInlineListItems = lines.some((line) =>
      /^[-*•]\s/.test(line.trim()),
    );
    if (hasInlineListItems) {
      // Mixed content - render list items properly
      const elements: React.ReactNode[] = [];
      let currentListItems: string[] = [];

      lines.forEach((line, lIndex) => {
        const trimmedLine = line.trim();
        if (/^[-*•]\s/.test(trimmedLine)) {
          currentListItems.push(trimmedLine.replace(/^[-*•]\s/, ""));
        } else if (trimmedLine) {
          // Flush any pending list items
          if (currentListItems.length > 0) {
            elements.push(
              <ul
                key={`list-${lIndex}`}
                className="mb-2 ml-4 list-disc space-y-1"
              >
                {currentListItems.map((item, iIndex) => (
                  <li key={iIndex} className="text-sm">
                    {renderInlineMarkdown(item)}
                  </li>
                ))}
              </ul>,
            );
            currentListItems = [];
          }
          elements.push(
            <p key={`p-${lIndex}`} className="mb-2">
              {renderInlineMarkdown(trimmedLine)}
            </p>,
          );
        }
      });

      // Flush remaining list items
      if (currentListItems.length > 0) {
        elements.push(
          <ul
            key="list-final"
            className="mb-2 ml-4 list-disc space-y-1 last:mb-0"
          >
            {currentListItems.map((item, iIndex) => (
              <li key={iIndex} className="text-sm">
                {renderInlineMarkdown(item)}
              </li>
            ))}
          </ul>,
        );
      }

      return <div key={bIndex}>{elements}</div>;
    }

    // Regular paragraph - handle line breaks within
    return (
      <p key={bIndex} className="mb-2 last:mb-0">
        {lines.map((line, lIndex) => (
          <span key={lIndex}>
            {lIndex > 0 && <br />}
            {renderInlineMarkdown(line)}
          </span>
        ))}
      </p>
    );
  });
}

/**
 * Render inline markdown: **bold** and *italic*
 */
function renderInlineMarkdown(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Look for **bold**
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    // Look for *italic* (but not **)
    const italicMatch = remaining.match(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/);

    // Find the earliest match
    let earliestMatch: RegExpMatchArray | null = null;
    let matchType: "bold" | "italic" | null = null;

    if (boldMatch && (!italicMatch || boldMatch.index! <= italicMatch.index!)) {
      earliestMatch = boldMatch;
      matchType = "bold";
    } else if (italicMatch) {
      earliestMatch = italicMatch;
      matchType = "italic";
    }

    if (earliestMatch && earliestMatch.index !== undefined) {
      // Add text before match
      if (earliestMatch.index > 0) {
        parts.push(remaining.slice(0, earliestMatch.index));
      }

      // Add formatted text
      if (matchType === "bold") {
        parts.push(<strong key={key++}>{earliestMatch[1]}</strong>);
      } else {
        parts.push(<em key={key++}>{earliestMatch[1]}</em>);
      }

      remaining = remaining.slice(
        earliestMatch.index + earliestMatch[0].length,
      );
    } else {
      // No more matches, add remaining text
      parts.push(remaining);
      break;
    }
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

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
              className="text-sm leading-relaxed"
              style={{ color: "var(--bsky-text-secondary)" }}
            >
              {renderMarkdown(summary.summary)}
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
