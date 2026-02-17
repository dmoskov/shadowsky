import React, { useMemo, useState } from "react";
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
import { useTheme } from "../../contexts/ThemeContext";
import { useAppNavigation } from "../../hooks/useNavigation";
import { useUserAnalytics } from "../../hooks/api/useAnalytics";
import { usePostAnalysis } from "../../hooks/api/useAnalytics";
import { TimeRange } from "../../services/atproto/analytics";
import { PostCard } from "../../components/PostCard";
import type { PostAnalysisPost } from "../../services/ai-service";

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
  } = useUserAnalytics(account?.handle || "", timeRange);

  // Prepare posts for AI analysis
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
    { value: "today", label: "Today" },
    { value: "week", label: "7 Days" },
    { value: "month", label: "30 Days" },
    { value: "quarter", label: "90 Days" },
  ];

  // Compute max engagement for chart scaling
  const maxDailyEngagement = useMemo(() => {
    if (!analytics?.dailyEngagement) return 1;
    return Math.max(
      1,
      ...analytics.dailyEngagement.map(
        (d) => d.likes + d.reposts + d.replies,
      ),
    );
  }, [analytics?.dailyEngagement]);

  // Format hour for display
  const formatHour = (hour: number): string => {
    if (hour === 0) return "12AM";
    if (hour === 12) return "12PM";
    return hour < 12 ? `${hour}AM` : `${hour - 12}PM`;
  };

  // Compute max hourly engagement for posting times chart
  const maxHourlyEngagement = useMemo(() => {
    if (!analytics?.postingTimes) return 1;
    return Math.max(1, ...analytics.postingTimes.hourEngagement);
  }, [analytics?.postingTimes]);

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
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading analytics...
          </Text>
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

      {/* Metrics Grid */}
      <View style={styles.metricsGrid}>
        <View style={styles.metricsRow}>
          {renderMetricCard(
            "Followers",
            analytics.followersCount,
            undefined,
            colors.accentPurple,
          )}
          {renderMetricCard(
            "Likes",
            analytics.likesReceived,
            undefined,
            colors.danger,
          )}
        </View>
        <View style={styles.metricsRow}>
          {renderMetricCard(
            "Reposts",
            analytics.repostsReceived,
            undefined,
            colors.accentBlue,
          )}
          {renderMetricCard(
            "Replies",
            analytics.repliesReceived,
            undefined,
            colors.success,
          )}
        </View>
        <View style={styles.metricsRow}>
          {renderMetricCard(
            "Engagement Rate",
            analytics.engagementRate.toFixed(1),
            "avg per post",
            colors.primary,
          )}
          {renderMetricCard(
            "Posts",
            analytics.postsCount,
            undefined,
            colors.warning,
          )}
        </View>
      </View>

      {/* Engagement Over Time Chart */}
      {analytics.dailyEngagement.length > 1 && (
        <View style={[styles.section, { backgroundColor: colors.surfaceElevated }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Engagement Over Time
          </Text>
          <View style={styles.chartLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#ef4444" }]} />
              <Text style={[styles.legendText, { color: colors.textSecondary }]}>Likes</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#3b82f6" }]} />
              <Text style={[styles.legendText, { color: colors.textSecondary }]}>Reposts</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#4ade80" }]} />
              <Text style={[styles.legendText, { color: colors.textSecondary }]}>Replies</Text>
            </View>
          </View>
          <View style={styles.chartContainer}>
            {analytics.dailyEngagement.map((day, index) => {
              const total = day.likes + day.reposts + day.replies;
              const likesHeight =
                maxDailyEngagement > 0
                  ? (day.likes / maxDailyEngagement) * 120
                  : 0;
              const repostsHeight =
                maxDailyEngagement > 0
                  ? (day.reposts / maxDailyEngagement) * 120
                  : 0;
              const repliesHeight =
                maxDailyEngagement > 0
                  ? (day.replies / maxDailyEngagement) * 120
                  : 0;

              // Show labels at intervals to prevent crowding
              const len = analytics.dailyEngagement.length;
              const labelInterval = len <= 7 ? 1 : len <= 14 ? 2 : len <= 30 ? 5 : 10;
              const showLabel =
                index === 0 ||
                index === len - 1 ||
                index % labelInterval === 0;

              // Format date label
              const dateParts = day.date.split("-");
              const dateLabel = `${parseInt(dateParts[1])}/${parseInt(dateParts[2])}`;

              return (
                <View key={day.date} style={styles.barContainer}>
                  <View style={styles.barWrapper}>
                    {day.replies > 0 && (
                      <View
                        style={[
                          styles.barSegment,
                          {
                            height: repliesHeight,
                            backgroundColor: "#4ade80",
                            borderTopLeftRadius: day.reposts === 0 && day.likes === 0 ? 3 : 0,
                            borderTopRightRadius: day.reposts === 0 && day.likes === 0 ? 3 : 0,
                          },
                        ]}
                      />
                    )}
                    {day.reposts > 0 && (
                      <View
                        style={[
                          styles.barSegment,
                          {
                            height: repostsHeight,
                            backgroundColor: "#3b82f6",
                            borderTopLeftRadius: day.likes === 0 ? 3 : 0,
                            borderTopRightRadius: day.likes === 0 ? 3 : 0,
                          },
                        ]}
                      />
                    )}
                    {day.likes > 0 && (
                      <View
                        style={[
                          styles.barSegment,
                          {
                            height: likesHeight,
                            backgroundColor: "#ef4444",
                            borderTopLeftRadius: 3,
                            borderTopRightRadius: 3,
                          },
                        ]}
                      />
                    )}
                    {total === 0 && (
                      <View
                        style={[
                          styles.barSegment,
                          {
                            height: 2,
                            backgroundColor: colors.border,
                            borderRadius: 1,
                          },
                        ]}
                      />
                    )}
                  </View>
                  {showLabel && (
                    <Text
                      style={[
                        styles.barLabel,
                        { color: colors.textTertiary },
                      ]}
                    >
                      {dateLabel}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Best Posting Times */}
      {analytics.postsCount > 0 && (
        <View style={[styles.section, { backgroundColor: colors.surfaceElevated }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Best Posting Times
          </Text>
          <View style={styles.postingTimesCards}>
            <View style={[styles.postingTimeCard, { backgroundColor: colors.surface, borderColor: colors.primary, borderWidth: 1 }]}>
              <Text style={[styles.postingTimeLabel, { color: colors.textSecondary }]}>
                Highest Engagement
              </Text>
              <Text style={[styles.postingTimeValue, { color: colors.primary }]}>
                {formatHour(analytics.postingTimes.bestEngagementHour)}
              </Text>
              <Text style={[styles.postingTimeDetail, { color: colors.textTertiary }]}>
                Avg {analytics.postingTimes.hourEngagement[analytics.postingTimes.bestEngagementHour]?.toFixed(1) || "0"} interactions
              </Text>
            </View>
            <View style={[styles.postingTimeCard, { backgroundColor: colors.surface }]}>
              <Text style={[styles.postingTimeLabel, { color: colors.textSecondary }]}>
                Most Active Hour
              </Text>
              <Text style={[styles.postingTimeValue, { color: colors.accentPurple }]}>
                {formatHour(analytics.postingTimes.mostActiveHour)}
              </Text>
              <Text style={[styles.postingTimeDetail, { color: colors.textTertiary }]}>
                {analytics.postingTimes.hourCounts[analytics.postingTimes.mostActiveHour]} posts
              </Text>
            </View>
          </View>

          {/* Hourly engagement chart */}
          <View style={styles.hourlyChartContainer}>
            {analytics.postingTimes.hourEngagement.map((avg, hour) => {
              const barHeight =
                maxHourlyEngagement > 0
                  ? (avg / maxHourlyEngagement) * 60
                  : 0;
              const isBest = hour === analytics.postingTimes.bestEngagementHour;
              return (
                <View key={hour} style={styles.hourlyBarContainer}>
                  <View style={styles.hourlyBarWrapper}>
                    <View
                      style={[
                        styles.hourlyBar,
                        {
                          height: Math.max(barHeight, 2),
                          backgroundColor: isBest
                            ? colors.primary
                            : colors.accentPurple,
                          opacity: isBest ? 1 : 0.4,
                        },
                      ]}
                    />
                  </View>
                  {hour % 6 === 0 && (
                    <Text style={[styles.hourlyLabel, { color: colors.textTertiary }]}>
                      {hour}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        </View>
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

      {/* AI Content Analysis Section */}
      {analytics.postsCount > 0 && (
        <View style={[styles.section, { backgroundColor: colors.surfaceElevated }]}>
          <View style={styles.aiSectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 0 }]}>
              AI Content Analysis
            </Text>
            {!analysisRequested && (
              <TouchableOpacity
                style={[styles.analyzeButton, { backgroundColor: colors.primary }]}
                onPress={() => setAnalysisRequested(true)}
              >
                <Text style={styles.analyzeButtonText}>Analyze</Text>
              </TouchableOpacity>
            )}
          </View>

          {!analysisRequested && (
            <View style={[styles.aiPlaceholder, { backgroundColor: colors.surface }]}>
              <Text style={[styles.aiPlaceholderTitle, { color: colors.text }]}>
                Get AI-Powered Insights
              </Text>
              <Text style={[styles.aiPlaceholderText, { color: colors.textSecondary }]}>
                Discover content themes, writing style patterns, and engagement insights from your posts
              </Text>
            </View>
          )}

          {isLoadingAnalysis && (
            <View style={[styles.aiLoading, { backgroundColor: colors.surface }]}>
              <ActivityIndicator size="small" color={colors.accentPurple} />
              <Text style={[styles.aiLoadingText, { color: colors.text }]}>
                Analyzing your posts...
              </Text>
              <Text style={[styles.aiLoadingSubtext, { color: colors.textSecondary }]}>
                This may take a moment
              </Text>
            </View>
          )}

          {analysisData && !isLoadingAnalysis && (
            <View style={styles.aiResults}>
              {/* Summary */}
              <View style={[styles.aiCard, { backgroundColor: colors.surface }]}>
                <Text style={[styles.aiCardTitle, { color: colors.text }]}>
                  Summary
                </Text>
                <Text style={[styles.aiCardText, { color: colors.textSecondary }]}>
                  {analysisData.summary}
                </Text>
              </View>

              {/* Content Themes */}
              <View style={[styles.aiCard, { backgroundColor: colors.surface }]}>
                <Text style={[styles.aiCardTitle, { color: colors.text }]}>
                  Content Themes
                </Text>
                {analysisData.contentThemes.map((theme) => (
                  <View key={theme.theme} style={styles.themeItem}>
                    <View style={styles.themeHeader}>
                      <Text style={[styles.themeName, { color: colors.text }]}>
                        {theme.theme}
                      </Text>
                      <View
                        style={[
                          styles.frequencyBadge,
                          {
                            backgroundColor:
                              theme.frequency === "primary"
                                ? "#3b82f6"
                                : theme.frequency === "regular"
                                  ? "#8b5cf6"
                                  : "#6b7280",
                          },
                        ]}
                      >
                        <Text style={styles.frequencyText}>
                          {theme.frequency}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.themeDescription, { color: colors.textSecondary }]}>
                      {theme.description}
                    </Text>
                    {theme.examples.length > 0 && (
                      <View style={styles.themeExamples}>
                        {theme.examples.map((example) => (
                          <Text
                            key={example}
                            style={[styles.themeExample, { color: colors.textTertiary }]}
                            numberOfLines={2}
                          >
                            &ldquo;{example}&rdquo;
                          </Text>
                        ))}
                      </View>
                    )}
                  </View>
                ))}
              </View>

              {/* Writing Style */}
              <View style={[styles.aiCard, { backgroundColor: colors.surface }]}>
                <Text style={[styles.aiCardTitle, { color: colors.text }]}>
                  Writing Style
                </Text>
                <View style={styles.styleSection}>
                  <Text style={[styles.styleLabel, { color: colors.textTertiary }]}>
                    Tone
                  </Text>
                  <Text style={[styles.styleValue, { color: colors.text }]}>
                    {analysisData.writingStyle.tone}
                  </Text>
                </View>
                <View style={styles.styleSection}>
                  <Text style={[styles.styleLabel, { color: colors.textTertiary }]}>
                    Characteristics
                  </Text>
                  {analysisData.writingStyle.characteristics.map((char) => (
                    <View key={char} style={styles.characteristicRow}>
                      <Text style={{ color: colors.success }}>
                        {"\u2022"}
                      </Text>
                      <Text style={[styles.characteristicText, { color: colors.textSecondary }]}>
                        {char}
                      </Text>
                    </View>
                  ))}
                </View>
                <View style={styles.styleSection}>
                  <Text style={[styles.styleLabel, { color: colors.textTertiary }]}>
                    Voice
                  </Text>
                  <Text style={[styles.styleValue, { color: colors.textSecondary }]}>
                    {analysisData.writingStyle.voiceDescription}
                  </Text>
                </View>
              </View>

              {/* Engagement Insights */}
              <View style={[styles.aiCard, { backgroundColor: colors.surface }]}>
                <Text style={[styles.aiCardTitle, { color: colors.text }]}>
                  Engagement Insights
                </Text>

                {analysisData.engagementPatterns.topPerformers.length > 0 && (
                  <View style={styles.insightSection}>
                    <Text style={[styles.insightLabel, { color: colors.textTertiary }]}>
                      Top Performers
                    </Text>
                    {analysisData.engagementPatterns.topPerformers.map((item) => (
                      <View key={item} style={styles.insightRow}>
                        <Text style={{ color: colors.warning }}>
                          {"\u2605"}
                        </Text>
                        <Text style={[styles.insightText, { color: colors.textSecondary }]}>
                          {item}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                {analysisData.engagementPatterns.contentStrengths.length > 0 && (
                  <View style={styles.insightSection}>
                    <Text style={[styles.insightLabel, { color: colors.textTertiary }]}>
                      Your Strengths
                    </Text>
                    {analysisData.engagementPatterns.contentStrengths.map((item) => (
                      <View key={item} style={styles.insightRow}>
                        <Text style={{ color: colors.success }}>
                          {"\u2713"}
                        </Text>
                        <Text style={[styles.insightText, { color: colors.textSecondary }]}>
                          {item}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                {(analysisData.engagementPatterns.observations ||
                  analysisData.engagementPatterns.suggestions ||
                  []).length > 0 && (
                  <View style={styles.insightSection}>
                    <Text style={[styles.insightLabel, { color: colors.textTertiary }]}>
                      Observations
                    </Text>
                    {(
                      analysisData.engagementPatterns.observations ||
                      analysisData.engagementPatterns.suggestions ||
                      []
                    ).map((item) => (
                      <View key={item} style={styles.insightRow}>
                        <Text style={{ color: colors.accentPurple }}>
                          {"\u2022"}
                        </Text>
                        <Text style={[styles.insightText, { color: colors.textSecondary }]}>
                          {item}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              {/* Optimal Posting Times from AI */}
              {analysisData.optimalPostingTimes &&
                analysisData.optimalPostingTimes.recommendations.length > 0 && (
                  <View style={[styles.aiCard, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.aiCardTitle, { color: colors.text }]}>
                      AI-Recommended Posting Times
                    </Text>
                    <View style={styles.optimalTimesGrid}>
                      {analysisData.optimalPostingTimes.recommendations.map(
                        (rec, i) => {
                          const dayNames = [
                            "Sunday",
                            "Monday",
                            "Tuesday",
                            "Wednesday",
                            "Thursday",
                            "Friday",
                            "Saturday",
                          ];
                          const recHourStr =
                            rec.hour === 0
                              ? "12:00 AM"
                              : rec.hour === 12
                                ? "12:00 PM"
                                : rec.hour < 12
                                  ? `${rec.hour}:00 AM`
                                  : `${rec.hour - 12}:00 PM`;
                          const confidenceColor =
                            rec.confidence === "high"
                              ? "#22c55e"
                              : rec.confidence === "medium"
                                ? "#eab308"
                                : "#94a3b8";

                          return (
                            <View
                              key={`${rec.dayOfWeek}-${rec.hour}`}
                              style={[
                                styles.optimalTimeCard,
                                {
                                  backgroundColor: colors.surfaceElevated,
                                  borderColor:
                                    i === 0 ? colors.primary : colors.border,
                                  borderWidth: i === 0 ? 2 : 1,
                                },
                              ]}
                            >
                              <View style={styles.optimalTimeHeader}>
                                <Text style={[styles.optimalTimeRank, { color: colors.textSecondary }]}>
                                  {i === 0 ? "Best Time" : `#${i + 1}`}
                                </Text>
                                <View
                                  style={[
                                    styles.confidenceBadge,
                                    { backgroundColor: confidenceColor },
                                  ]}
                                >
                                  <Text style={styles.confidenceText}>
                                    {rec.confidence}
                                  </Text>
                                </View>
                              </View>
                              <Text style={[styles.optimalTimeHour, { color: colors.text }]}>
                                {recHourStr}
                              </Text>
                              <Text style={[styles.optimalTimeDay, { color: colors.textSecondary }]}>
                                {rec.dayOfWeek === -1
                                  ? "Any day"
                                  : dayNames[rec.dayOfWeek]}
                              </Text>
                              <Text style={[styles.optimalTimeEngagement, { color: colors.primary }]}>
                                ~{rec.avgEngagement} avg engagement
                              </Text>
                            </View>
                          );
                        },
                      )}
                    </View>
                  </View>
                )}

              {/* Hide Analysis button */}
              <TouchableOpacity
                style={[styles.hideAnalysisButton, { backgroundColor: colors.surface }]}
                onPress={() => setAnalysisRequested(false)}
              >
                <Text style={[styles.hideAnalysisText, { color: colors.textSecondary }]}>
                  Hide Analysis
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 48,
  },
  loadingText: {
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
  chartLegend: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 12,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 12,
  },
  chartContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 140,
    gap: 2,
  },
  barContainer: {
    flex: 1,
    alignItems: "center",
  },
  barWrapper: {
    width: "100%",
    height: 120,
    justifyContent: "flex-end",
    alignItems: "center",
  },
  barSegment: {
    width: "80%",
  },
  barLabel: {
    fontSize: 9,
    marginTop: 4,
  },
  postingTimesCards: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  postingTimeCard: {
    flex: 1,
    borderRadius: 10,
    padding: 14,
  },
  postingTimeLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  postingTimeValue: {
    fontSize: 22,
    fontWeight: "bold",
  },
  postingTimeDetail: {
    fontSize: 11,
    marginTop: 4,
  },
  hourlyChartContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 80,
    gap: 1,
  },
  hourlyBarContainer: {
    flex: 1,
    alignItems: "center",
  },
  hourlyBarWrapper: {
    width: "100%",
    height: 60,
    justifyContent: "flex-end",
    alignItems: "center",
  },
  hourlyBar: {
    width: "70%",
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  hourlyLabel: {
    fontSize: 9,
    marginTop: 3,
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
  // AI Analysis styles
  aiSectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  analyzeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  analyzeButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  aiPlaceholder: {
    borderRadius: 10,
    padding: 24,
    alignItems: "center",
  },
  aiPlaceholderTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  aiPlaceholderText: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
  },
  aiLoading: {
    borderRadius: 10,
    padding: 32,
    alignItems: "center",
  },
  aiLoadingText: {
    fontSize: 14,
    fontWeight: "500",
    marginTop: 12,
  },
  aiLoadingSubtext: {
    fontSize: 12,
    marginTop: 4,
  },
  aiResults: {
    gap: 12,
  },
  aiCard: {
    borderRadius: 10,
    padding: 16,
  },
  aiCardTitle: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 12,
  },
  aiCardText: {
    fontSize: 13,
    lineHeight: 20,
  },
  themeItem: {
    marginBottom: 16,
  },
  themeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  themeName: {
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
  },
  frequencyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  frequencyText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "500",
  },
  themeDescription: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4,
  },
  themeExamples: {
    paddingLeft: 12,
    marginTop: 4,
    gap: 4,
  },
  themeExample: {
    fontSize: 12,
    fontStyle: "italic",
    lineHeight: 16,
  },
  styleSection: {
    marginBottom: 12,
  },
  styleLabel: {
    fontSize: 11,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  styleValue: {
    fontSize: 13,
    lineHeight: 18,
  },
  characteristicRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginTop: 4,
  },
  characteristicText: {
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  insightSection: {
    marginBottom: 16,
  },
  insightLabel: {
    fontSize: 11,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  insightRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 6,
  },
  insightText: {
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  optimalTimesGrid: {
    gap: 10,
  },
  optimalTimeCard: {
    borderRadius: 10,
    padding: 14,
  },
  optimalTimeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  optimalTimeRank: {
    fontSize: 12,
    fontWeight: "500",
  },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  confidenceText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "500",
  },
  optimalTimeHour: {
    fontSize: 20,
    fontWeight: "bold",
  },
  optimalTimeDay: {
    fontSize: 13,
    marginTop: 2,
  },
  optimalTimeEngagement: {
    fontSize: 12,
    marginTop: 6,
  },
  hideAnalysisButton: {
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },
  hideAnalysisText: {
    fontSize: 14,
  },
});
