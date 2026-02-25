import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { AppBskyFeedDefs } from "@atproto/api";
import {
  analyzePosts,
  type PostAnalysisPost,
  type PostAnalysisResult,
} from "../services/ai-service";
import { getAuthorFeed } from "../services/atproto/feeds";
import { useTheme } from "../contexts/ThemeContext";

interface ProfileAIInsightsProps {
  handle: string;
  posts: AppBskyFeedDefs.FeedViewPost[];
}

export function ProfileAIInsights({ handle, posts }: ProfileAIInsightsProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [expanded, setExpanded] = useState(false);

  // Transform posts already in memory for quick haiku analysis
  const postsInMemory: PostAnalysisPost[] = useMemo(
    () =>
      posts
        .filter((item) => {
          const isRepost =
            item.reason?.$type === "app.bsky.feed.defs#reasonRepost";
          return !isRepost;
        })
        .map((item) => ({
          text: (item.post.record as { text?: string })?.text || "",
          createdAt: item.post.indexedAt,
          likes: item.post.likeCount || 0,
          reposts: item.post.repostCount || 0,
          replies: item.post.replyCount || 0,
        })),
    [posts],
  );

  // Quick haiku analysis using posts already in memory
  const {
    data: haikuAnalysis,
    isLoading: isLoadingHaiku,
    error: haikuError,
  } = useQuery<PostAnalysisResult>({
    queryKey: ["profile-analysis-haiku", handle],
    queryFn: async () => {
      if (postsInMemory.length === 0) throw new Error("No posts in memory");
      return await analyzePosts(postsInMemory, "haiku");
    },
    staleTime: 30 * 60 * 1000,
    enabled: postsInMemory.length > 0,
  });

  // Fetch more posts for deeper Sonnet analysis
  const { data: postsForSonnet, isLoading: isLoadingPostsForSonnet } =
    useQuery({
      queryKey: ["profile-posts-for-sonnet", handle],
      queryFn: async () => {
        if (!handle) throw new Error("No handle to analyze");

        const allPosts: AppBskyFeedDefs.FeedViewPost[] = [];
        let fetchCursor: string | undefined;
        const maxPages = 4; // Fetch up to 200 posts

        for (let page = 0; page < maxPages; page++) {
          const response = await getAuthorFeed(handle, {
            limit: 50,
            cursor: fetchCursor,
          });

          const filteredPosts = response.feed.filter((item) => {
            const isRepost =
              item.reason?.$type === "app.bsky.feed.defs#reasonRepost";
            return !isRepost;
          });

          allPosts.push(...filteredPosts);
          fetchCursor = response.cursor;
          if (!fetchCursor) break;
        }

        if (allPosts.length === 0) {
          throw new Error("No posts available for analysis");
        }

        return allPosts.map((item) => ({
          text: (item.post.record as { text?: string })?.text || "",
          createdAt: item.post.indexedAt,
          likes: item.post.likeCount || 0,
          reposts: item.post.repostCount || 0,
          replies: item.post.replyCount || 0,
        }));
      },
      staleTime: 30 * 60 * 1000,
      enabled: !!handle,
    });

  // Full sonnet analysis with more posts
  const {
    data: sonnetAnalysis,
    isLoading: isLoadingSonnet,
    error: sonnetError,
  } = useQuery<PostAnalysisResult>({
    queryKey: ["profile-analysis-sonnet", handle],
    queryFn: async () => {
      if (!postsForSonnet) throw new Error("Posts not loaded");
      return await analyzePosts(postsForSonnet, "sonnet");
    },
    staleTime: 30 * 60 * 1000,
    enabled: !!postsForSonnet,
  });

  // Use haiku if available, then upgrade to sonnet when ready
  const analysisData = sonnetAnalysis || haikuAnalysis;
  const isLoadingAnalysis =
    (isLoadingHaiku && !haikuAnalysis) ||
    (isLoadingPostsForSonnet && isLoadingSonnet && !haikuAnalysis);
  const analysisError = sonnetError || haikuError;

  // Don't render anything if no posts to analyze
  if (postsInMemory.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.sparkle}>{"✦"}</Text>
          <Text style={styles.title}>AI Insights</Text>
          {haikuAnalysis && !sonnetAnalysis && (
            <View style={styles.analyzingBadge}>
              <View style={styles.analyzingDot} />
              <Text style={styles.analyzingText}>analyzing...</Text>
            </View>
          )}
          {sonnetAnalysis && (
            <View style={styles.fullAnalysisBadge}>
              <Text style={styles.fullAnalysisText}>Full analysis</Text>
            </View>
          )}
        </View>
        {analysisData && (
          <TouchableOpacity
            onPress={() => setExpanded(!expanded)}
            style={styles.expandButton}
          >
            <Text style={styles.expandButtonText}>
              {expanded ? "Less" : "More"}
            </Text>
            <Text style={styles.expandChevron}>{expanded ? "▲" : "▼"}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Loading state */}
      {isLoadingAnalysis && !analysisData && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.accentPurple} />
          <View style={styles.loadingTextContainer}>
            <Text style={styles.loadingTitle}>Analyzing profile...</Text>
            <Text style={styles.loadingSubtitle}>
              Reviewing posts for themes, style, and engagement
            </Text>
          </View>
        </View>
      )}

      {/* Error state */}
      {analysisError && !analysisData && (
        <Text style={styles.errorText}>
          {analysisError instanceof Error &&
          analysisError.message.includes("Rate limit")
            ? "Rate limited. Try again later."
            : "Analysis unavailable."}
        </Text>
      )}

      {/* Analysis data */}
      {analysisData && (
        <View>
          {/* Summary - always visible */}
          <Text style={styles.summaryText}>{analysisData.summary}</Text>

          {/* Expanded details */}
          {expanded && sonnetAnalysis && (
            <View style={styles.expandedContainer}>
              {/* Content Themes */}
              {sonnetAnalysis.contentThemes &&
                sonnetAnalysis.contentThemes.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>CONTENT THEMES</Text>
                    <View style={styles.tagsContainer}>
                      {sonnetAnalysis.contentThemes.map((theme) => (
                        <View key={theme.theme} style={styles.tag}>
                          <Text style={styles.tagText}>{theme.theme}</Text>
                          <Text style={styles.tagFrequency}>
                            {theme.frequency}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

              {/* Writing Style */}
              {sonnetAnalysis.writingStyle && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>WRITING STYLE</Text>
                  <Text style={styles.sectionBody}>
                    {sonnetAnalysis.writingStyle.voiceDescription}
                  </Text>
                  {sonnetAnalysis.writingStyle.characteristics &&
                    sonnetAnalysis.writingStyle.characteristics.length > 0 && (
                      <View style={styles.characteristicsContainer}>
                        {sonnetAnalysis.writingStyle.characteristics.map(
                          (char, idx) => (
                            <View
                              key={`style-${idx}`}
                              style={styles.characteristicPill}
                            >
                              <Text style={styles.characteristicText}>
                                {char}
                              </Text>
                            </View>
                          ),
                        )}
                      </View>
                    )}
                </View>
              )}

              {/* Engagement Patterns */}
              {sonnetAnalysis.engagementPatterns && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>ENGAGEMENT PATTERNS</Text>
                  {sonnetAnalysis.engagementPatterns.contentStrengths &&
                    sonnetAnalysis.engagementPatterns.contentStrengths.length >
                      0 && (
                      <View style={styles.listContainer}>
                        {sonnetAnalysis.engagementPatterns.contentStrengths.map(
                          (strength, idx) => (
                            <Text
                              key={`strength-${idx}`}
                              style={styles.listItem}
                            >
                              {"\u2022"} {strength}
                            </Text>
                          ),
                        )}
                      </View>
                    )}
                  {sonnetAnalysis.engagementPatterns.observations &&
                    sonnetAnalysis.engagementPatterns.observations.length >
                      0 && (
                      <View style={styles.observationsContainer}>
                        {sonnetAnalysis.engagementPatterns.observations.map(
                          (obs, idx) => (
                            <Text
                              key={`obs-${idx}`}
                              style={styles.observationItem}
                            >
                              {"\u2022"} {obs}
                            </Text>
                          ),
                        )}
                      </View>
                    )}
                </View>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    container: {
      marginHorizontal: 16,
      marginTop: 12,
      marginBottom: 4,
      borderRadius: 12,
      padding: 14,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    headerLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      flexShrink: 1,
    },
    sparkle: {
      fontSize: 14,
      color: colors.accentPurple,
    },
    title: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
    },
    analyzingBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    analyzingDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.accentPurple,
    },
    analyzingText: {
      fontSize: 11,
      color: colors.textTertiary,
    },
    fullAnalysisBadge: {
      backgroundColor: "rgba(139, 92, 246, 0.1)",
      borderRadius: 10,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    fullAnalysisText: {
      fontSize: 11,
      color: colors.accentPurple,
    },
    expandButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    expandButtonText: {
      fontSize: 12,
      color: colors.textTertiary,
    },
    expandChevron: {
      fontSize: 8,
      color: colors.textTertiary,
    },
    loadingContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 8,
    },
    loadingTextContainer: {
      flex: 1,
    },
    loadingTitle: {
      fontSize: 13,
      color: colors.text,
    },
    loadingSubtitle: {
      fontSize: 11,
      color: colors.textTertiary,
      marginTop: 2,
    },
    errorText: {
      fontSize: 13,
      color: colors.textSecondary,
      paddingVertical: 4,
    },
    summaryText: {
      fontSize: 13,
      lineHeight: 20,
      color: colors.textSecondary,
    },
    expandedContainer: {
      marginTop: 14,
      gap: 14,
    },
    section: {
      gap: 6,
    },
    sectionTitle: {
      fontSize: 10,
      fontWeight: "700",
      letterSpacing: 1,
      color: colors.textTertiary,
    },
    sectionBody: {
      fontSize: 13,
      lineHeight: 18,
      color: colors.textSecondary,
    },
    tagsContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    tag: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surfaceAlt,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
      gap: 6,
    },
    tagText: {
      fontSize: 12,
      fontWeight: "500",
      color: colors.text,
    },
    tagFrequency: {
      fontSize: 11,
      color: colors.textTertiary,
    },
    characteristicsContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      marginTop: 4,
    },
    characteristicPill: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: 12,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    characteristicText: {
      fontSize: 11,
      color: colors.textSecondary,
    },
    listContainer: {
      gap: 3,
    },
    listItem: {
      fontSize: 12,
      lineHeight: 17,
      color: colors.textSecondary,
    },
    observationsContainer: {
      marginTop: 4,
      gap: 3,
    },
    observationItem: {
      fontSize: 12,
      lineHeight: 17,
      color: colors.textTertiary,
    },
  });
}
