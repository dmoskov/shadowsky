import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { AppBskyFeedDefs } from "@atproto/api";
import { useQuery } from "@tanstack/react-query";
import {
  generateThreadSummary,
  type ThreadSummaryPost,
  type ThreadSummaryFormat,
  type ThreadSummaryResult,
} from "../services/ai-service";
import {colors} from "../constants/theme";

type Post = AppBskyFeedDefs.PostView;

interface ThreadSummaryProps {
  posts: Post[];
  threadUri: string;
  parentUris?: Map<string, string>;
}

const STALE_TIME_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Mobile ThreadSummary - AI-generated summary for threads with 5+ posts
 * Adapts complexity based on thread size and engagement
 */
export function ThreadSummary({
  posts,
  threadUri,
  parentUris,
}: ThreadSummaryProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Only show summary for threads with 5+ posts
  const shouldFetchSummary = posts.length >= 5;

  // Calculate total engagement to determine summary format
  const totalEngagement = posts.reduce(
    (sum, p) =>
      sum + (p.likeCount || 0) + (p.replyCount || 0) + (p.repostCount || 0),
    0,
  );

  // Choose format based on thread size and engagement
  const getSummaryFormat = (): ThreadSummaryFormat => {
    if (posts.length >= 75) return "comprehensive";
    if (posts.length >= 30) return "detailed";
    if (posts.length >= 10) return "moderate";
    if (totalEngagement > 100 || posts.length > 20) return "moderate";
    return "brief";
  };

  const summaryFormat = getSummaryFormat();

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
  } = useQuery<ThreadSummaryResult>({
    queryKey: ["thread-summary-mobile", threadUri, summaryFormat],
    queryFn: async () => {
      return await generateThreadSummary(summaryPosts, summaryFormat);
    },
    enabled: shouldFetchSummary,
    staleTime: STALE_TIME_MS,
    gcTime: STALE_TIME_MS * 2,
    retry: false,
    refetchOnWindowFocus: false,
    meta: { suppressErrors: true },
  });

  if (!shouldFetchSummary) {
    return null;
  }

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContent}>
          <ActivityIndicator size="small" color={colors.textSecondary} />
          <Text style={styles.loadingText}>Generating summary...</Text>
        </View>
      </View>
    );
  }

  if (error || !summary) {
    return null; // Fail silently
  }

  const isComprehensive = summaryFormat === "comprehensive";
  const highlights = summary.metadata?.highlightedSubThreads;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => isComprehensive && setIsExpanded(!isExpanded)}
        disabled={!isComprehensive}
      >
        <Text style={styles.sparkle}>✨</Text>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerLabel}>AI Summary</Text>
          {summary.metadata?.postCount && (
            <Text style={styles.headerMeta}>
              {" "}
              • {summary.metadata.postCount} posts
              {summary.metadata.authors &&
                `, ${summary.metadata.authors.length} participants`}
            </Text>
          )}
        </View>
        {isComprehensive && (
          <Text style={styles.chevron}>{isExpanded ? "▼" : "▶"}</Text>
        )}
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.content}>
          <Text style={styles.summaryText}>{summary.summary}</Text>

          {/* Highlighted sub-threads for comprehensive summaries */}
          {isComprehensive && highlights && highlights.length > 0 && (
            <View style={styles.highlightsContainer}>
              <View style={styles.divider} />
              <Text style={styles.highlightsLabel}>Notable discussions</Text>
              <View style={styles.highlightsList}>
                {highlights.map((hl) => (
                  <View key={hl.uri} style={styles.highlightItem}>
                    <Text style={styles.highlightAuthor}>
                      @{hl.authorHandle}
                    </Text>
                    <Text style={styles.highlightEngagement}>
                      {" "}
                      ({hl.engagement} interactions)
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Total engagement for detailed+ summaries */}
          {(summaryFormat === "detailed" ||
            summaryFormat === "comprehensive") &&
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

const styles = StyleSheet.create({
  container: {
    backgroundColor: "colors.surface",
    borderRadius: 8,
    marginHorizontal: 12,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  loadingContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 8,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 8,
  },
  sparkle: {
    fontSize: 14,
  },
  headerTextContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  headerLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
  },
  headerMeta: {
    color: colors.textTertiary,
    fontSize: 11,
  },
  chevron: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  content: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  summaryText: {
    color: colors.borderLight,
    fontSize: 14,
    lineHeight: 20,
  },
  highlightsContainer: {
    marginTop: 12,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginBottom: 8,
  },
  highlightsLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 6,
    textTransform: "uppercase",
  },
  highlightsList: {
    gap: 4,
  },
  highlightItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: colors.background,
    borderRadius: 4,
    flexWrap: "wrap",
  },
  highlightAuthor: {
    color: colors.primary,
    fontSize: 12,
  },
  highlightEngagement: {
    color: colors.textTertiary,
    fontSize: 11,
  },
  engagementText: {
    color: colors.textTertiary,
    fontSize: 11,
    marginTop: 8,
  },
});
