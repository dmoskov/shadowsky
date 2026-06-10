import React, {useMemo} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import {useTheme} from '../contexts/ThemeContext';
import {TrendingUpIcon} from './icons/TrendingUpIcon';
import {HeartIcon} from './icons/HeartIcon';
import {RepostIcon} from './icons/RepostIcon';
import {ReplyIcon} from './icons/ReplyIcon';
import {TopPostEngagement} from '../hooks/api/useTopPosts';
import {fontSize} from '../utils/typography';

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

interface TopPostsShowcaseProps {
  topPosts: TopPostEngagement[];
  totalPostsAnalyzed: number;
  onPostPress?: (uri: string) => void;
}

export function TopPostsShowcase({
  topPosts,
  totalPostsAnalyzed,
  onPostPress,
}: TopPostsShowcaseProps) {
  const {colors} = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (topPosts.length === 0) return null;

  const displayPosts = topPosts.slice(0, 5);

  return (
    <View style={styles.container} accessibilityLabel="Top Posts">
      <View style={styles.headerRow}>
        <TrendingUpIcon size={16} color={colors.primary} />
        <Text style={styles.title}>Top Posts</Text>
        <Text style={styles.subtitle}>by engagement</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}>
        {displayPosts.map((item, idx) => {
          const postText =
            item.text || '(media post)';
          return (
            <TouchableOpacity
              key={item.uri}
              style={styles.card}
              onPress={() => onPostPress?.(item.uri)}
              activeOpacity={0.7}
              accessibilityLabel={`Top post ${idx + 1}: ${postText.slice(0, 50)}`}>
              <View style={styles.cardHeader}>
                <View
                  style={[
                    styles.rankBadge,
                    idx === 0 && {backgroundColor: colors.primary},
                  ]}>
                  <Text
                    style={[
                      styles.rankText,
                      idx === 0 && styles.rankTextTop,
                    ]}>
                    {idx + 1}
                  </Text>
                </View>
                <Text style={styles.engagementTotal}>
                  {formatCount(item.totalEngagement)} total
                </Text>
              </View>

              <Text style={styles.postText} numberOfLines={3}>
                {postText}
              </Text>

              <View style={styles.metricsRow}>
                <View style={styles.metric}>
                  <HeartIcon size={12} color={colors.textTertiary} />
                  <Text style={styles.metricText}>{formatCount(item.likes)}</Text>
                </View>
                <View style={styles.metric}>
                  <RepostIcon size={12} color={colors.textTertiary} />
                  <Text style={styles.metricText}>{formatCount(item.reposts)}</Text>
                </View>
                <View style={styles.metric}>
                  <ReplyIcon size={12} color={colors.textTertiary} />
                  <Text style={styles.metricText}>{formatCount(item.replies)}</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {totalPostsAnalyzed > 0 && (
        <Text style={styles.footerText}>
          Based on {totalPostsAnalyzed} posts analyzed
        </Text>
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
      backgroundColor: colors.surfaceElevated,
      borderRadius: 12,
      padding: 12,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 10,
    },
    title: {
      color: colors.text,
      fontSize: fontSize.callout,
      fontWeight: '700',
    },
    subtitle: {
      color: colors.textTertiary,
      fontSize: fontSize.caption1,
    },
    scrollContent: {
      gap: 10,
      paddingBottom: 2,
    },
    card: {
      width: 180,
      backgroundColor: colors.background,
      borderRadius: 10,
      padding: 10,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 6,
    },
    rankBadge: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: colors.textTertiary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rankText: {
      color: colors.background,
      fontSize: fontSize.caption2,
      fontWeight: '700',
    },
    rankTextTop: {
      color: colors.textOnPrimary,
    },
    engagementTotal: {
      color: colors.textSecondary,
      fontSize: fontSize.caption1,
      fontWeight: '600',
    },
    postText: {
      color: colors.text,
      fontSize: fontSize.caption1,
      lineHeight: 16,
      marginBottom: 8,
    },
    metricsRow: {
      flexDirection: 'row',
      gap: 10,
    },
    metric: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    },
    metricText: {
      color: colors.textTertiary,
      fontSize: fontSize.caption2,
    },
    footerText: {
      color: colors.textTertiary,
      fontSize: fontSize.caption2,
      textAlign: 'center',
      marginTop: 8,
    },
  });
}
