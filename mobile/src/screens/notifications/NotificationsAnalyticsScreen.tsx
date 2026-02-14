import React, {useMemo} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import {AppBskyNotificationListNotifications, AppBskyFeedPost} from '@atproto/api';
import {useNotifications} from '../../hooks/api/useNotifications';
import {LoadingState} from '../../components/LoadingState';
import {ErrorState} from '../../components/ErrorState';
import {EmptyState} from '../../components/EmptyState';
import {colors} from '../../constants/theme';
import {
  format,
  startOfDay,
  subDays,
  eachDayOfInterval,
  isWithinInterval,
} from 'date-fns';

type TimeRange = 'week' | 'month';

interface DayData {
  date: Date;
  count: number;
}

interface NotificationTypeStats {
  type: string;
  count: number;
  percentage: number;
  icon: string;
  color: string;
}

interface TopPost {
  uri: string;
  text: string;
  engagementCount: number;
  types: string[];
}

export function NotificationsAnalyticsScreen() {
  const [timeRange, setTimeRange] = React.useState<TimeRange>('week');
  const {data, isLoading, isError, error, refetch} = useNotifications();

  // Flatten all notifications
  const notifications = useMemo(
    () => data?.pages?.flatMap(page => page.notifications) || [],
    [data],
  );

  // Calculate date range
  const dateRange = useMemo(() => {
    const endDate = new Date();
    const startDate =
      timeRange === 'week' ? subDays(endDate, 7) : subDays(endDate, 30);
    return {startDate, endDate};
  }, [timeRange]);

  // Filter notifications by date range
  const filteredNotifications = useMemo(() => {
    return notifications.filter(notification => {
      const notificationDate = new Date(notification.indexedAt);
      return isWithinInterval(notificationDate, {
        start: dateRange.startDate,
        end: dateRange.endDate,
      });
    });
  }, [notifications, dateRange]);

  // Calculate daily trends
  const dailyTrends = useMemo<DayData[]>(() => {
    const days = eachDayOfInterval({
      start: dateRange.startDate,
      end: dateRange.endDate,
    });

    return days.map(day => {
      const dayStart = startOfDay(day);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      const count = filteredNotifications.filter(notification => {
        const notificationDate = new Date(notification.indexedAt);
        return isWithinInterval(notificationDate, {
          start: dayStart,
          end: dayEnd,
        });
      }).length;

      return {date: day, count};
    });
  }, [dateRange.startDate, dateRange.endDate, filteredNotifications]);

  // Calculate notification type breakdown
  const typeBreakdown = useMemo<NotificationTypeStats[]>(() => {
    const typeCounts: Record<string, number> = {};
    const total = filteredNotifications.length;

    filteredNotifications.forEach(notification => {
      const type = notification.reason;
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });

    const typeConfig: Record<
      string,
      {icon: string; color: string; label: string}
    > = {
      like: {icon: '❤️', color: colors.danger, label: 'Likes'},
      repost: {icon: '🔄', color: colors.success, label: 'Reposts'},
      follow: {icon: '👤', color: colors.primary, label: 'Follows'},
      mention: {icon: '@', color: colors.mention, label: 'Mentions'},
      reply: {icon: '💬', color: colors.reply, label: 'Replies'},
      quote: {icon: '💭', color: colors.quote, label: 'Quotes'},
    };

    return Object.entries(typeCounts)
      .map(([type, count]) => {
        const config = typeConfig[type] || {
          icon: '🔔',
          color: colors.textSecondary,
          label: type,
        };
        return {
          type: config.label,
          count,
          percentage: total > 0 ? (count / total) * 100 : 0,
          icon: config.icon,
          color: config.color,
        };
      })
      .sort((a, b) => b.count - a.count);
  }, [filteredNotifications]);

  // Calculate top engaged posts
  const topEngagedPosts = useMemo<TopPost[]>(() => {
    const postEngagement: Record<string, TopPost> = {};

    filteredNotifications.forEach(notification => {
      // Only count notifications that relate to posts (not follows)
      if (notification.reason === 'follow') return;

      const uri = notification.reasonSubject || notification.uri;
      if (!uri) return;

      if (!postEngagement[uri]) {
        const postText = AppBskyFeedPost.isRecord(notification.record)
          ? notification.record.text || 'Post content unavailable'
          : 'Post content unavailable';

        postEngagement[uri] = {
          uri,
          text: postText,
          engagementCount: 0,
          types: [],
        };
      }

      postEngagement[uri].engagementCount += 1;
      if (!postEngagement[uri].types.includes(notification.reason)) {
        postEngagement[uri].types.push(notification.reason);
      }
    });

    return Object.values(postEngagement)
      .sort((a, b) => b.engagementCount - a.engagementCount)
      .slice(0, 5);
  }, [filteredNotifications]);

  // Calculate engagement metrics
  const engagementMetrics = useMemo(() => {
    const totalNotifications = filteredNotifications.length;
    const uniqueDays = dailyTrends.filter(day => day.count > 0).length;
    const avgPerDay =
      uniqueDays > 0 ? totalNotifications / dailyTrends.length : 0;

    // Calculate engagement rate (notifications with post interaction vs follows)
    const postInteractions = filteredNotifications.filter(
      n => n.reason !== 'follow',
    ).length;
    const engagementRate =
      totalNotifications > 0 ? (postInteractions / totalNotifications) * 100 : 0;

    // Most active day
    const mostActiveDay = dailyTrends.reduce(
      (max, day) => (day.count > max.count ? day : max),
      dailyTrends[0] || {date: new Date(), count: 0},
    );

    return {
      total: totalNotifications,
      avgPerDay: Math.round(avgPerDay * 10) / 10,
      engagementRate: Math.round(engagementRate),
      mostActiveDay: {
        date: mostActiveDay.date,
        count: mostActiveDay.count,
      },
    };
  }, [filteredNotifications, dailyTrends]);

  if (isLoading) {
    return <LoadingState message="Loading analytics..." />;
  }

  if (isError) {
    return (
      <ErrorState
        message={error?.message || 'Failed to load analytics'}
        onRetry={() => refetch()}
      />
    );
  }

  if (notifications.length === 0) {
    return <EmptyState message="No notification data available yet" />;
  }

  const maxDailyCount = Math.max(...dailyTrends.map(d => d.count), 1);

  return (
    <ScrollView style={styles.container}>
      {/* Time Range Selector */}
      <View style={styles.section}>
        <View style={styles.timeRangeSelector}>
          <TouchableOpacity
            style={[
              styles.timeRangeButton,
              timeRange === 'week' && styles.timeRangeButtonActive,
            ]}
            onPress={() => setTimeRange('week')}>
            <Text
              style={[
                styles.timeRangeButtonText,
                timeRange === 'week' && styles.timeRangeButtonTextActive,
              ]}>
              Last 7 Days
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.timeRangeButton,
              timeRange === 'month' && styles.timeRangeButtonActive,
            ]}
            onPress={() => setTimeRange('month')}>
            <Text
              style={[
                styles.timeRangeButtonText,
                timeRange === 'month' && styles.timeRangeButtonTextActive,
              ]}>
              Last 30 Days
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Engagement Metrics Overview */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Overview</Text>
        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{engagementMetrics.total}</Text>
            <Text style={styles.metricLabel}>Total Notifications</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>
              {engagementMetrics.avgPerDay}
            </Text>
            <Text style={styles.metricLabel}>Avg per Day</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>
              {engagementMetrics.engagementRate}%
            </Text>
            <Text style={styles.metricLabel}>Engagement Rate</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>
              {engagementMetrics.mostActiveDay.count}
            </Text>
            <Text style={styles.metricLabel}>
              Peak Day ({format(engagementMetrics.mostActiveDay.date, 'MMM d')})
            </Text>
          </View>
        </View>
      </View>

      {/* Daily Trends Chart */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Activity Trend</Text>
        <View style={styles.chartContainer}>
          {dailyTrends.map((day, index) => {
            const barHeight =
              maxDailyCount > 0 ? (day.count / maxDailyCount) * 100 : 0;
            return (
              <View key={index} style={styles.barContainer}>
                <View style={styles.barWrapper}>
                  <View
                    style={[
                      styles.bar,
                      {height: `${barHeight}%`},
                      day.count === 0 && styles.barEmpty,
                    ]}
                  />
                </View>
                <Text style={styles.barLabel}>
                  {format(day.date, 'EEE')[0]}
                </Text>
                {day.count > 0 && (
                  <Text style={styles.barCount}>{day.count}</Text>
                )}
              </View>
            );
          })}
        </View>
      </View>

      {/* Notification Type Breakdown */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Breakdown by Type</Text>
        {typeBreakdown.map((stat, index) => (
          <View key={index} style={styles.typeRow}>
            <View style={styles.typeInfo}>
              <Text style={styles.typeIcon}>{stat.icon}</Text>
              <Text style={styles.typeLabel}>{stat.type}</Text>
            </View>
            <View style={styles.typeStats}>
              <View style={styles.progressBarContainer}>
                <View
                  style={[
                    styles.progressBar,
                    {width: `${stat.percentage}%`, backgroundColor: stat.color},
                  ]}
                />
              </View>
              <Text style={styles.typeCount}>{stat.count}</Text>
              <Text style={styles.typePercentage}>
                {Math.round(stat.percentage)}%
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* Top Engaged Posts */}
      {topEngagedPosts.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top Engaged Posts</Text>
          {topEngagedPosts.map((post, index) => (
            <View key={post.uri} style={styles.postCard}>
              <View style={styles.postHeader}>
                <Text style={styles.postRank}>#{index + 1}</Text>
                <View style={styles.postEngagement}>
                  <Text style={styles.postEngagementCount}>
                    {post.engagementCount}
                  </Text>
                  <Text style={styles.postEngagementLabel}>interactions</Text>
                </View>
              </View>
              <Text style={styles.postText} numberOfLines={3}>
                {post.text}
              </Text>
              <View style={styles.postTypes}>
                {post.types.map(type => {
                  const icons: Record<string, string> = {
                    like: '❤️',
                    repost: '🔄',
                    mention: '@',
                    reply: '💬',
                    quote: '💭',
                  };
                  return (
                    <Text key={type} style={styles.postTypeIcon}>
                      {icons[type] || '🔔'}
                    </Text>
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Bottom spacing */}
      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceElevated,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  timeRangeSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  timeRangeButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
  },
  timeRangeButtonActive: {
    backgroundColor: colors.primary,
  },
  timeRangeButtonText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  timeRangeButtonTextActive: {
    color: colors.text,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  metricValue: {
    color: colors.text,
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  metricLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    textAlign: 'center',
  },
  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 160,
    gap: 4,
  },
  barContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  barWrapper: {
    width: '100%',
    height: 120,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  bar: {
    width: '80%',
    backgroundColor: colors.primary,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    minHeight: 2,
  },
  barEmpty: {
    backgroundColor: colors.surfaceElevated,
  },
  barLabel: {
    color: colors.textTertiary,
    fontSize: 11,
    marginTop: 4,
  },
  barCount: {
    color: colors.textSecondary,
    fontSize: 10,
    marginTop: 2,
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  typeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  typeIcon: {
    fontSize: 20,
  },
  typeLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '500',
  },
  typeStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 2,
  },
  progressBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  typeCount: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    minWidth: 30,
    textAlign: 'right',
  },
  typePercentage: {
    color: colors.textSecondary,
    fontSize: 13,
    minWidth: 40,
    textAlign: 'right',
  },
  postCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  postRank: {
    color: colors.primary,
    fontSize: 20,
    fontWeight: 'bold',
  },
  postEngagement: {
    alignItems: 'flex-end',
  },
  postEngagementCount: {
    color: colors.text,
    fontSize: 24,
    fontWeight: 'bold',
  },
  postEngagementLabel: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  postText: {
    color: colors.borderLight,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  postTypes: {
    flexDirection: 'row',
    gap: 8,
  },
  postTypeIcon: {
    fontSize: 16,
  },
  bottomSpacer: {
    height: 20,
  },
});
