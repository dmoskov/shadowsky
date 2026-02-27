/**
 * MobileThreadSummary - AI thread summary for React Native mobile post view
 *
 * Mirrors the desktop ProgressiveThreadSummary but uses React Native primitives.
 * Fetches and displays AI-generated thread summaries that scale with thread complexity.
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
import { memo, useCallback, useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import type { ThreadSummaryPost } from "../../services/anthropic";
import {
  threadSummaryCacheService,
  type CachedThreadSummary,
} from "../../services/thread-summary-cache";
import { createLogger } from "../../utils/logger";
import {
  scaledLineHeight,
  useDynamicType,
  type ScaledFontFn,
} from "../hooks/useDynamicType";
import { SummaryShimmer } from "./SkeletonShimmer";

const logger = createLogger("MobileThreadSummary");

type Post = AppBskyFeedDefs.PostView;

export type SummaryDepth =
  | "none"
  | "brief"
  | "moderate"
  | "detailed"
  | "comprehensive";

export interface MobileThreadSummaryProps {
  posts: Post[];
  threadUri: string;
  parentUris?: Map<string, string>;
  summaryDepth: SummaryDepth;
}

const STALE_TIME_MS = 10 * 60 * 1000; // 10 minutes

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
    minPosts: 3,
    description: "Quick summary",
  },
  moderate: {
    format: "moderate",
    minPosts: 3,
    description: "Thread overview",
  },
  detailed: {
    format: "detailed",
    minPosts: 3,
    description: "Detailed summary",
  },
  comprehensive: {
    format: "comprehensive",
    minPosts: 3,
    description: "Full conversation analysis",
  },
};

/**
 * Creates styles with Dynamic Type-scaled font sizes.
 * ViewStyle properties remain unchanged;
 * only fontSize and associated lineHeight values are scaled.
 */
function createStyles(scaledFont: ScaledFontFn) {
  return StyleSheet.create({
    container: {
      backgroundColor: "#f7f9fa",
      borderRadius: 8,
      marginTop: 12,
      overflow: "hidden",
    } as ViewStyle,
    loadingRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
    } as ViewStyle,
    loadingText: {
      fontSize: scaledFont(13),
      color: "#687684",
    } as TextStyle,
    errorIcon: {
      fontSize: scaledFont(14),
      color: "#687684",
    } as TextStyle,
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 8,
    } as ViewStyle,
    sparkleIcon: {
      fontSize: scaledFont(14),
    } as TextStyle,
    headerTextContainer: {
      flex: 1,
    } as ViewStyle,
    headerLabel: {
      fontSize: scaledFont(12),
      fontWeight: "500",
      color: "#687684",
    } as TextStyle,
    headerMeta: {
      fontSize: scaledFont(12),
      color: "#687684",
      opacity: 0.6,
    } as TextStyle,
    chevron: {
      fontSize: scaledFont(10),
      color: "#687684",
    } as TextStyle,
    content: {
      paddingHorizontal: 12,
      paddingBottom: 12,
    } as ViewStyle,
    highlightsSection: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: "#e1e1e1",
    } as ViewStyle,
    highlightsLabel: {
      fontSize: scaledFont(11),
      fontWeight: "500",
      color: "#687684",
      marginBottom: 8,
    } as TextStyle,
    highlightsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    } as ViewStyle,
    highlightChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: "#ffffff",
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
    } as ViewStyle,
    highlightHandle: {
      fontSize: scaledFont(12),
      color: "#1d9bf0",
    } as TextStyle,
    highlightEngagement: {
      fontSize: scaledFont(12),
      color: "#687684",
    } as TextStyle,
    engagementText: {
      marginTop: 8,
      fontSize: scaledFont(11),
      color: "#687684",
    } as TextStyle,
  });
}

/**
 * Creates summary-specific styles with Dynamic Type-scaled font sizes.
 * Used by renderSummaryText and renderMarkdownContent helpers.
 */
function createSummaryStyles(scaledFont: ScaledFontFn) {
  return StyleSheet.create({
    paragraph: {
      fontSize: scaledFont(14),
      lineHeight: scaledLineHeight(scaledFont, 14, 20),
      color: "#536471",
      marginBottom: 8,
    } as TextStyle,
    bold: {
      fontWeight: "700",
    } as TextStyle,
    italic: {
      fontStyle: "italic",
    } as TextStyle,
    headerText: {
      fontSize: scaledFont(14),
      fontWeight: "600",
      color: "#536471",
      marginBottom: 4,
      marginTop: 8,
    } as TextStyle,
    listItem: {
      flexDirection: "row",
      alignItems: "flex-start",
      marginBottom: 4,
      paddingLeft: 4,
    } as ViewStyle,
    bullet: {
      fontSize: scaledFont(14),
      color: "#536471",
      marginRight: 8,
      lineHeight: scaledLineHeight(scaledFont, 14, 20),
    } as TextStyle,
    listItemText: {
      flex: 1,
      fontSize: scaledFont(14),
      lineHeight: scaledLineHeight(scaledFont, 14, 20),
      color: "#536471",
    } as TextStyle,
  });
}

type SummaryStyles = ReturnType<typeof createSummaryStyles>;

/**
 * Render summary text with basic markdown support (**bold** and *italic*)
 */
function renderSummaryText(
  text: string,
  summaryStyles: SummaryStyles,
): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    const italicMatch = remaining.match(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/);

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
      if (earliestMatch.index > 0) {
        parts.push(
          <Text key={`t${key++}`}>
            {remaining.slice(0, earliestMatch.index)}
          </Text>,
        );
      }

      if (matchType === "bold") {
        parts.push(
          <Text key={`b${key++}`} style={summaryStyles.bold}>
            {earliestMatch[1]}
          </Text>,
        );
      } else {
        parts.push(
          <Text key={`i${key++}`} style={summaryStyles.italic}>
            {earliestMatch[1]}
          </Text>,
        );
      }

      remaining = remaining.slice(
        earliestMatch.index + earliestMatch[0].length,
      );
    } else {
      parts.push(<Text key={`t${key++}`}>{remaining}</Text>);
      break;
    }
  }

  return parts.length === 1 ? parts[0] : <Text>{parts}</Text>;
}

/**
 * Parse markdown text into paragraphs and list items for rendering
 */
function renderMarkdownContent(
  text: string,
  summaryStyles: SummaryStyles,
): React.ReactNode[] {
  const blocks = text.split(/\n\n+/);
  const elements: React.ReactNode[] = [];

  blocks.forEach((block, bIndex) => {
    // Check for headers
    const headerMatch = block.match(/^(#{1,3})\s+(.+)$/);
    if (headerMatch) {
      elements.push(
        <Text key={`h${bIndex}`} style={summaryStyles.headerText}>
          {renderSummaryText(headerMatch[2], summaryStyles)}
        </Text>,
      );
      return;
    }

    const lines = block.split(/\n/);
    const isBulletList = lines.every(
      (line) => /^[-*•]\s/.test(line.trim()) || line.trim() === "",
    );

    if (isBulletList && lines.some((l) => l.trim())) {
      lines
        .filter((line) => line.trim())
        .forEach((line, lIndex) => {
          elements.push(
            <View key={`li${bIndex}-${lIndex}`} style={summaryStyles.listItem}>
              <Text style={summaryStyles.bullet}>•</Text>
              <Text style={summaryStyles.listItemText}>
                {renderSummaryText(
                  line.trim().replace(/^[-*•]\s/, ""),
                  summaryStyles,
                )}
              </Text>
            </View>,
          );
        });
      return;
    }

    // Regular paragraph
    elements.push(
      <Text key={`p${bIndex}`} style={summaryStyles.paragraph}>
        {renderSummaryText(block, summaryStyles)}
      </Text>,
    );
  });

  return elements;
}

function MobileThreadSummaryContent({
  posts,
  threadUri,
  parentUris,
  summaryDepth,
}: MobileThreadSummaryProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const { scaledFont } = useDynamicType();
  const styles = useMemo(() => createStyles(scaledFont), [scaledFont]);
  const summaryStyles = useMemo(
    () => createSummaryStyles(scaledFont),
    [scaledFont],
  );

  const config = DEPTH_CONFIG[summaryDepth];
  const shouldFetch =
    summaryDepth !== "none" && posts.length >= config.minPosts;

  const getDepth = useCallback(
    (postUri: string): number => {
      if (!parentUris) return 0;
      let depth = 0;
      let currentUri = postUri;
      while (parentUris.has(currentUri)) {
        depth++;
        currentUri = parentUris.get(currentUri)!;
        if (depth > 100) break;
      }
      return depth;
    },
    [parentUris],
  );

  const summaryPosts: ThreadSummaryPost[] = useMemo(
    () =>
      posts.map((post) => ({
        text: (post.record as { text?: string })?.text || "",
        author: post.author.displayName || post.author.handle,
        authorHandle: post.author.handle,
        likes: post.likeCount || 0,
        replies: post.replyCount || 0,
        reposts: post.repostCount || 0,
        uri: post.uri,
        parentUri: parentUris?.get(post.uri),
        depth: getDepth(post.uri),
      })),
    [posts, parentUris, getDepth],
  );

  const {
    data: summary,
    isLoading,
    error,
  } = useQuery<CachedThreadSummary>({
    queryKey: ["progressive-thread-summary", threadUri, summaryDepth],
    queryFn: async () => {
      try {
        return await threadSummaryCacheService.getThreadSummary(
          threadUri,
          summaryPosts,
          config.format,
          { source: "viewed" },
        );
      } catch (err) {
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

  if (!shouldFetch) return null;

  if (isLoading) {
    return (
      <View style={styles.container}>
        <SummaryShimmer lines={2} color="#d1d5db" />
      </View>
    );
  }

  if (error) {
    logger.error("Failed to fetch thread summary:", error);
    return (
      <View style={styles.container}>
        <View style={styles.loadingRow}>
          <Text style={styles.errorIcon}>⚠</Text>
          <Text style={styles.loadingText}>Summary unavailable</Text>
        </View>
      </View>
    );
  }

  if (!summary) return null;

  const isComprehensive = summaryDepth === "comprehensive";
  const highlights = summary.metadata?.highlightedSubThreads;

  return (
    <View style={styles.container}>
      {/* Header */}
      <Pressable
        onPress={isComprehensive ? () => setIsExpanded(!isExpanded) : undefined}
        style={styles.header}
        accessibilityRole={isComprehensive ? "button" : "text"}
        accessibilityLabel={config.description}
      >
        <Text style={styles.sparkleIcon}>✨</Text>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerLabel}>
            {config.description}
            {summary.metadata?.postCount ? (
              <Text style={styles.headerMeta}>
                {" "}
                ({summary.metadata.postCount} posts
                {summary.metadata.authors
                  ? `, ${summary.metadata.authors.length} participants`
                  : ""}
                )
              </Text>
            ) : null}
          </Text>
        </View>
        {isComprehensive && (
          <Text style={styles.chevron}>{isExpanded ? "▲" : "▼"}</Text>
        )}
      </Pressable>

      {/* Summary content */}
      {isExpanded && (
        <View style={styles.content}>
          {renderMarkdownContent(summary.summary, summaryStyles)}

          {/* Highlighted sub-threads for comprehensive summaries */}
          {isComprehensive && highlights && highlights.length > 0 && (
            <View style={styles.highlightsSection}>
              <Text style={styles.highlightsLabel}>Notable discussions</Text>
              <View style={styles.highlightsRow}>
                {highlights.map((hl) => (
                  <View key={hl.uri} style={styles.highlightChip}>
                    <Text style={styles.highlightHandle}>
                      @{hl.authorHandle}
                    </Text>
                    <Text style={styles.highlightEngagement}>
                      ({hl.engagement} interactions)
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Total engagement for detailed+ */}
          {(summaryDepth === "detailed" || summaryDepth === "comprehensive") &&
            summary.metadata?.totalEngagement && (
              <Text style={styles.engagementText}>
                {summary.metadata.totalEngagement.toLocaleString()} total
                interactions
              </Text>
            )}
        </View>
      )}
    </View>
  );
}

export const MobileThreadSummary = memo(MobileThreadSummaryContent);
export default MobileThreadSummary;
