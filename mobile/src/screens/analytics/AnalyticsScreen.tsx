import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { format } from "date-fns";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useAppNavigation } from "../../hooks/useNavigation";
import { useUserAnalytics } from "../../hooks/api/useAnalytics";
import { usePostAnalysis } from "../../hooks/api/useAnalytics";
import { TimeRange } from "../../services/atproto/analytics";
import { PostCard } from "../../components/PostCard";
import { SkeletonShimmer } from "../../components/SkeletonShimmer";
import type { PostAnalysisPost } from "../../services/ai-service";
import { EngagementChart } from "./components/EngagementChart";
import { PostingFrequencyChart } from "./components/PostingFrequencyChart";
import { HourlyChart } from "./components/HourlyChart";
import { AIAnalysisPanel } from "./components/AIAnalysisPanel";

export function AnalyticsScreen() {
  const router = useRouter();
  const { account } = useAuth();
  const { colors } = useTheme();
  const { navigateToProfile } = useAppNavigation();
  const [timeRange, setTimeRange] = useState<TimeRange>("week");
  const [analysisRequested, setAnalysisRequested] = useState(false);

  const {
    data: analytics,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useUserAnalytics(account?.did || "", timeRange);

  const postsForAI = useMemo<PostAnalysisPost[] | undefined>(() => {
    if (!analytics?.postsForAnalysis) return undefined;
    return analytics.postsForAnalysis.map((p) => ({
      text: p.text,
      createdAt: p.createdAt,
      likes: p.likes,
      reposts: p.reposts,
      replies: p.replies,
    }));
  }, [analytics?.postsForAnalysis]);

  const {
    data: analysisData,
    isLoading: isLoadingAnalysis,
  } = usePostAnalysis(postsForAI, analysisRequested);

  const handleMentionPress = (handle: string, _did: string) => {
    navigateToProfile(handle);
  };

  const handleHashtagPress = (tag: string) => {
    router.push({
      pathname: "/(tabs)/(search)",
      params: { q: "#" + tag },
    } as any);
  };

  const timeRanges: { value: TimeRange; label: string }[] = [
    { value: "today", label: "24h" },
    { value: "week", label: "7 Days" },
    { value: "month", label: "30 Days" },
    { value: "quarter", label: "90 Days" },
  ];

  // Compute date range for summary bar
  const dateRangeDisplay = useMemo(() => {
    if (!analytics?.dailyEngagement || analytics.dailyEngagement.length === 0) return null;
    const first = analytics.dailyEngagement[0];
    const last = analytics.dailyEngagement[analytics.dailyEngagement.length - 1];
    const parseDate = (d: string) => {
      const parts = d.split("-");
      return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    };
    return {
      start: format(parseDate(first.date), "MMM d, yyyy"),
      end: format(parseDate(last.date), "MMM d, yyyy"),
    };
  }, [analytics?.dailyEngagement]);

  const renderMetricCard = (
    title: string,
    value: string | number,
    subtitle: string | undefined,
    accentColor: string,
  ) => (
    <View style={[styles.metricCard, { backgroundColor: colors.surfaceElevated, borderLeftColor: accentColor }]}>
      <View style={styles.metricContent}>
        <Text style={[styles.metricValue, { color: accentColor }]}>
          {typeof value === "number" ? value.toLocaleString() : value}
        </Text>
        <Text style={[styles.metricTitle, { color: colors.textSecondary }]}>
          {title}
        </Text>
        {subtitle && (
          <Text style={[styles.metricSubtitle, { color: colors.textTertiary }]}>
            {subtitle}
          </Text>
        )}
      </View>
    </View>
  );

  const renderTimeRangeSelector = () => (
    <View style={styles.timeRangeContainer}>
      {timeRanges.map((range) => (
        <TouchableOpacity
          key={range.value}
          style={[
            styles.timeRangeButton,
            { backgroundColor: colors.surfaceElevated },
            timeRange === range.value && { backgroundColor: colors.primary },
          ]}
          onPress={() => {
            setTimeRange(range.value);
            setAnalysisRequested(false);
          }}
        >
          <Text
            style={[
              styles.timeRangeText,
              { color: colors.textSecondary },
              timeRange === range.value && { color: colors.text },
            ]}
          >
            {range.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  if (!account) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.danger }]}>Not authenticated</Text>
        </View>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={{ padding: 16, gap: 16 }}>
          <SkeletonShimmer width="60%" height={24} borderRadius={6} />
          <SkeletonShimmer width="100%" height={120} borderRadius={12} />
          <SkeletonShimmer width="100%" height={120} borderRadius={12} />
          <SkeletonShimmer width="40%" height={20} borderRadius={6} />
          <SkeletonShimmer width="100%" height={200} borderRadius={12} />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.danger }]}>
            Failed to load analytics
          </Text>
          <Text style={[styles.errorSubtext, { color: colors.textSecondary }]}>
            {error instanceof Error ? error.message : "Unknown error"}
          </Text>
        </View>
      </View>
    );
  }

  if (!analytics) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>
            No analytics data available
          </Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      keyboardDismissMode="on-drag"
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={() => refetch()}
          tintColor={colors.primary}
        />
      }
    >
      {/* Time Range Selector */}
      {renderTimeRangeSelector()}

      {/* Metrics Grid — 6 cards matching web */}
      <View style={styles.metricsGrid}>
        <View style={styles.metricsRow}>
          {renderMetricCard(
            "Followers",
            analytics.followersCount,
            undefined,
            colors.accentPurple,
          )}
          {renderMetricCard(
            "Following",
            analytics.followsCount,
            undefined,
            "#f59e0b",
          )}
        </View>
        <View style={styles.metricsRow}>
          {renderMetricCard(
            "Likes",
            analytics.likesReceived,
            undefined,
            colors.danger,
          )}
          {renderMetricCard(
            "Reposts",
            analytics.repostsReceived,
            undefined,
            colors.accentBlue,
          )}
        </View>
        <View style={styles.metricsRow}>
          {renderMetricCard(
            "Replies",
            analytics.repliesReceived,
            undefined,
            colors.success,
          )}
          {renderMetricCard(
            "Engagement Rate",
            analytics.engagementRate.toFixed(1),
            "avg per post",
            colors.primary,
          )}
        </View>
      </View>

      {/* Engagement Over Time Chart */}
      <EngagementChart
        dailyEngagement={analytics.dailyEngagement}
        colors={colors}
      />

      {/* Posting Frequency Chart */}
      <PostingFrequencyChart
        dailyEngagement={analytics.dailyEngagement}
        colors={colors}
      />

      {/* Best Posting Times */}
      {analytics.postsCount > 0 && (
        <HourlyChart
          postingTimes={analytics.postingTimes}
          colors={colors}
        />
      )}

      {/* Top Performing Posts */}
      {analytics.topPosts.length > 0 && (
        <View style={[styles.section, { backgroundColor: colors.surfaceElevated }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Top Performing Posts
          </Text>

          {analytics.topPosts.map((post, index) => (
            <View
              key={post.post.uri || index}
              style={[styles.topPostCard, { backgroundColor: colors.surface }]}
            >
              <View style={styles.topPostRank}>
                <View style={[styles.rankBadge, { backgroundColor: colors.primary }]}>
                  <Text style={styles.rankText}>{index + 1}</Text>
                </View>
              </View>
              <View style={styles.topPostContent}>
                <PostCard
                  post={post}
                  onMentionPress={handleMentionPress}
                  onHashtagPress={handleHashtagPress}
                />
                <View style={[styles.topPostStats, { borderTopColor: colors.border }]}>
                  <View style={styles.topPostStat}>
                    <Text style={[styles.topPostStatValue, { color: "#ef4444" }]}>
                      {post.post.likeCount || 0}
                    </Text>
                    <Text style={[styles.topPostStatLabel, { color: colors.textSecondary }]}>
                      Likes
                    </Text>
                  </View>
                  <View style={styles.topPostStat}>
                    <Text style={[styles.topPostStatValue, { color: "#3b82f6" }]}>
                      {post.post.repostCount || 0}
                    </Text>
                    <Text style={[styles.topPostStatLabel, { color: colors.textSecondary }]}>
                      Reposts
                    </Text>
                  </View>
                  <View style={styles.topPostStat}>
                    <Text style={[styles.topPostStatValue, { color: "#4ade80" }]}>
                      {post.post.replyCount || 0}
                    </Text>
                    <Text style={[styles.topPostStatLabel, { color: colors.textSecondary }]}>
                      Replies
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Summary Bar */}
      {analytics.postsCount > 0 && dateRangeDisplay && (
        <View style={[styles.summaryBar, { backgroundColor: colors.surfaceElevated }]}>
          <Text style={[styles.summaryText, { color: colors.textSecondary }]}>
            Showing {analytics.postsCount.toLocaleString()} posts from {dateRangeDisplay.start} to {dateRangeDisplay.end}
          </Text>
          <View style={styles.summaryStats}>
            <View style={styles.summaryStat}>
              <Text style={[styles.summaryStatValue, { color: colors.text }]}>
                {analytics.impressions.toLocaleString()}
              </Text>
              <Text style={[styles.summaryStatLabel, { color: colors.textSecondary }]}> total engagement</Text>
            </View>
            <View style={styles.summaryStat}>
              <Text style={[styles.summaryStatValue, { color: colors.text }]}>
                {analytics.engagementRate.toFixed(1)}
              </Text>
              <Text style={[styles.summaryStatLabel, { color: colors.textSecondary }]}> avg per post</Text>
            </View>
          </View>
        </View>
      )}

      {/* AI Content Analysis Section */}
      <AIAnalysisPanel
        postsCount={analytics.postsCount}
        analysisRequested={analysisRequested}
        setAnalysisRequested={setAnalysisRequested}
        isLoadingAnalysis={isLoadingAnalysis}
        analysisData={analysisData}
        colors={colors}
      />

      {/* Empty State for No Posts */}
      {analytics.topPosts.length === 0 && (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            No posts in this time period
          </Text>
          <Text style={[styles.emptySubtext, { color: colors.textTertiary }]}>
            Try selecting a different time range
          </Text>
        </View>
      )}

      {/* Footer Spacing */}
      <View style={styles.footer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  errorText: {
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
  },
  errorSubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },
  timeRangeContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  timeRangeButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  timeRangeText: {
    fontSize: 13,
    fontWeight: "600",
  },
  metricsGrid: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 10,
  },
  metricsRow: {
    flexDirection: "row",
    gap: 10,
  },
  metricCard: {
    flex: 1,
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 4,
  },
  metricContent: {
    flex: 1,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: "bold",
  },
  metricTitle: {
    fontSize: 13,
    marginTop: 2,
  },
  metricSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  section: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
  },
  topPostCard: {
    flexDirection: "row",
    marginBottom: 12,
    borderRadius: 12,
    overflow: "hidden",
  },
  topPostRank: {
    width: 40,
    justifyContent: "flex-start",
    alignItems: "center",
    paddingTop: 12,
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  rankText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "bold",
  },
  topPostContent: {
    flex: 1,
  },
  topPostStats: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderTopWidth: 1,
  },
  topPostStat: {
    alignItems: "center",
  },
  topPostStatLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  topPostStatValue: {
    fontSize: 16,
    fontWeight: "600",
  },
  // Summary bar
  summaryBar: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 14,
  },
  summaryText: {
    fontSize: 13,
    marginBottom: 8,
  },
  summaryStats: {
    flexDirection: "row",
    gap: 24,
  },
  summaryStat: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  summaryStatValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  summaryStatLabel: {
    fontSize: 13,
  },
  emptyContainer: {
    paddingVertical: 48,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },
  footer: {
    height: 32,
  },
});
