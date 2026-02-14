import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { useAppNavigation } from "../../hooks/useNavigation";
import { useUserAnalytics } from "../../hooks/api/useAnalytics";
import { TimeRange } from "../../services/atproto/analytics";
import { PostCard } from "../../components/PostCard";
import { AppBskyFeedDefs } from "@atproto/api";
import { colors } from "../../constants/theme";

export function AnalyticsScreen() {
  const router = useRouter();
  const { account } = useAuth();
  const { navigateToProfile } = useAppNavigation();
  const [timeRange, setTimeRange] = useState<TimeRange>("week");

  const { data: analytics, isLoading, error, refetch, isRefetching } = useUserAnalytics(
    account?.handle || "",
    timeRange
  );

  const handleMentionPress = (handle: string, did: string) => {
    navigateToProfile(handle);
  };

  const handleHashtagPress = (tag: string) => {
    router.push({ pathname: '/(tabs)/(search)', params: { q: '#' + tag } });
  };

  const timeRanges: { value: TimeRange; label: string }[] = [
    { value: "today", label: "Today" },
    { value: "week", label: "This Week" },
    { value: "month", label: "This Month" },
    { value: "quarter", label: "Last Quarter" },
  ];

  const renderMetricCard = (
    title: string,
    value: number,
    icon: string,
    color: string
  ) => (
    <View style={[styles.metricCard, { borderLeftColor: color }]}>
      <Text style={styles.metricIcon}>{icon}</Text>
      <View style={styles.metricContent}>
        <Text style={styles.metricValue}>{value.toLocaleString()}</Text>
        <Text style={styles.metricTitle}>{title}</Text>
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
            timeRange === range.value && styles.timeRangeButtonActive,
          ]}
          onPress={() => setTimeRange(range.value)}
        >
          <Text
            style={[
              styles.timeRangeText,
              timeRange === range.value && styles.timeRangeTextActive,
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
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Not authenticated</Text>
        </View>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading analytics...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Failed to load analytics</Text>
          <Text style={styles.errorSubtext}>
            {error instanceof Error ? error.message : "Unknown error"}
          </Text>
        </View>
      </View>
    );
  }

  if (!analytics) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>No analytics data available</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={() => refetch()}
          tintColor={colors.primary}
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Analytics Dashboard</Text>
        <Text style={styles.subtitle}>Track your engagement metrics</Text>
      </View>

      {/* Time Range Selector */}
      {renderTimeRangeSelector()}

      {/* Metrics Grid */}
      <View style={styles.metricsGrid}>
        {renderMetricCard(
          "Likes Received",
          analytics.likesReceived,
          "❤️",
          colors.danger
        )}
        {renderMetricCard(
          "Reposts",
          analytics.repostsReceived,
          "🔄",
          colors.success
        )}
        {renderMetricCard(
          "Replies",
          analytics.repliesReceived,
          "💬",
          colors.primary
        )}
        {renderMetricCard(
          "Total Followers",
          analytics.followersCount,
          "👥",
          colors.mention
        )}
        {renderMetricCard(
          "Posts Published",
          analytics.postsCount,
          "📝",
          colors.warning
        )}
        {renderMetricCard(
          "Total Engagement",
          analytics.impressions,
          "📊",
          "colors.accent"
        )}
      </View>

      {/* Top Performing Posts */}
      {analytics.topPosts.length > 0 && (
        <View style={styles.topPostsSection}>
          <Text style={styles.sectionTitle}>Top Performing Posts</Text>
          <Text style={styles.sectionSubtitle}>
            Your most engaging posts in this period
          </Text>

          {analytics.topPosts.map((post, index) => (
            <View key={post.post.uri || index} style={styles.topPostCard}>
              <View style={styles.topPostRank}>
                <Text style={styles.topPostRankText}>#{index + 1}</Text>
              </View>
              <View style={styles.topPostContent}>
                <PostCard
                  post={post}
                  onMentionPress={handleMentionPress}
                  onHashtagPress={handleHashtagPress}
                />
                <View style={styles.topPostStats}>
                  <View style={styles.topPostStat}>
                    <Text style={styles.topPostStatLabel}>Likes</Text>
                    <Text style={styles.topPostStatValue}>
                      {post.post.likeCount || 0}
                    </Text>
                  </View>
                  <View style={styles.topPostStat}>
                    <Text style={styles.topPostStatLabel}>Reposts</Text>
                    <Text style={styles.topPostStatValue}>
                      {post.post.repostCount || 0}
                    </Text>
                  </View>
                  <View style={styles.topPostStat}>
                    <Text style={styles.topPostStatLabel}>Replies</Text>
                    <Text style={styles.topPostStatValue}>
                      {post.post.replyCount || 0}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Empty State for No Posts */}
      {analytics.topPosts.length === 0 && (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No posts in this time period</Text>
          <Text style={styles.emptySubtext}>
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
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 48,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 16,
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  errorText: {
    color: colors.danger,
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
  },
  errorSubtext: {
    color: colors.textSecondary,
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 16,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "bold",
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 16,
    marginTop: 4,
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
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: colors.surfaceElevated,
    alignItems: "center",
  },
  timeRangeButtonActive: {
    backgroundColor: colors.primary,
  },
  timeRangeText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: "600",
  },
  timeRangeTextActive: {
    color: colors.text,
  },
  metricsGrid: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  metricCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
  },
  metricIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  metricContent: {
    flex: 1,
  },
  metricValue: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "bold",
  },
  metricTitle: {
    color: colors.textSecondary,
    fontSize: 14,
    marginTop: 2,
  },
  topPostsSection: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 4,
  },
  sectionSubtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    marginBottom: 16,
  },
  topPostCard: {
    flexDirection: "row",
    marginBottom: 16,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    overflow: "hidden",
  },
  topPostRank: {
    width: 48,
    backgroundColor: colors.borderLight,
    justifyContent: "center",
    alignItems: "center",
  },
  topPostRankText: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: "bold",
  },
  topPostContent: {
    flex: 1,
  },
  topPostStats: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  topPostStat: {
    alignItems: "center",
  },
  topPostStatLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    marginBottom: 4,
  },
  topPostStatValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
  emptyContainer: {
    paddingVertical: 48,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
  },
  emptySubtext: {
    color: colors.textTertiary,
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },
  footer: {
    height: 32,
  },
});
