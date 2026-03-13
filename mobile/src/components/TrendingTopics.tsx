import React, { useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import type {
  TrendingTopic,
  Trend,
  TrendStatus,
} from "../services/trending-service";
import { velocityEmoji } from "../services/trending-service";
import { fontSize } from "../utils/typography";

interface TrendingTopicsProps {
  topics?: TrendingTopic[];
  trends?: Trend[];
  onTopicClick: (topic: string) => void;
  isLoading?: boolean;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function TrendingTopics({
  topics = [],
  trends = [],
  onTopicClick,
  isLoading = false,
}: TrendingTopicsProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerIcon}>{"\uD83D\uDD25"}</Text>
          <Text style={styles.headerText}>Trending</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      </View>
    );
  }

  // Prefer detailed trends from Pan, fall back to simple Bluesky topics
  const hasTrends = trends.length > 0;

  if (!hasTrends && topics.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerIcon}>{"\uD83D\uDD25"}</Text>
        <Text style={styles.headerText}>Trending Now</Text>
      </View>

      {hasTrends ? (
        <View style={styles.trendsList}>
          {trends.slice(0, 10).map((trend, index) => (
            <TouchableOpacity
              key={`${trend.topic}-${index}`}
              style={styles.trendRow}
              onPress={() => onTopicClick(trend.topic)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Trending topic: ${trend.topic}${trend.authorCount ? `, ${trend.authorCount} people talking` : ""}`}
            >
              <View style={styles.trendRank}>
                <Text style={styles.trendRankText}>{index + 1}</Text>
              </View>

              <View style={styles.trendContent}>
                <View style={styles.trendTitleRow}>
                  <Text style={styles.trendEmoji}>
                    {velocityEmoji(trend.status as TrendStatus)}
                  </Text>
                  <Text style={styles.trendTopic} numberOfLines={1}>
                    {trend.displayName || trend.topic}
                  </Text>
                  {(trend.status === "surging" || trend.status === "hot") && (
                    <View
                      style={[
                        styles.velocityBadge,
                        trend.status === "surging"
                          ? styles.velocityBadgeSurging
                          : styles.velocityBadgeHot,
                      ]}
                    >
                      <Text style={styles.velocityBadgeText}>
                        {trend.status === "surging" ? "Surging" : "Hot"}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.trendMeta}>
                  {trend.authorCount != null && trend.authorCount > 0 && (
                    <Text style={styles.trendMetaText}>
                      {formatCount(trend.authorCount)} people talking
                    </Text>
                  )}
                  {trend.postCount != null &&
                    trend.postCount > 0 &&
                    trend.authorCount != null && (
                      <Text style={styles.trendMetaSeparator}>·</Text>
                    )}
                  {trend.postCount != null && trend.postCount > 0 && (
                    <Text style={styles.trendMetaText}>
                      {formatCount(trend.postCount)} posts
                    </Text>
                  )}
                </View>
              </View>

              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        // Fallback: simple horizontal chip scroll (Bluesky data)
        <View style={styles.chipScroll}>
          {topics.map((t, index) => (
            <TouchableOpacity
              key={`${t.topic}-${index}`}
              style={styles.topicChip}
              onPress={() => onTopicClick(t.topic)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Trending topic: ${t.topic}`}
            >
              <Text style={styles.chipHash}>#</Text>
              <Text style={styles.chipText} numberOfLines={1}>
                {t.topic}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    container: {
      marginVertical: 12,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      marginBottom: 12,
    },
    headerIcon: {
      fontSize: fontSize.callout,
      marginRight: 6,
    },
    headerText: {
      color: colors.textSecondary,
      fontSize: fontSize.subheadline,
      fontWeight: "600",
    },
    loadingContainer: {
      paddingVertical: 16,
      alignItems: "center",
    },

    // ─── Rich trends list (Pan data) ─────────────
    trendsList: {
      paddingHorizontal: 16,
    },
    trendRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderLight,
    },
    trendRank: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.surfaceElevated,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },
    trendRankText: {
      color: colors.textSecondary,
      fontSize: fontSize.caption1,
      fontWeight: "700",
    },
    trendContent: {
      flex: 1,
    },
    trendTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    trendEmoji: {
      fontSize: fontSize.subheadline,
    },
    trendTopic: {
      color: colors.text,
      fontSize: fontSize.callout,
      fontWeight: "600",
      flexShrink: 1,
    },
    velocityBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 10,
    },
    velocityBadgeSurging: {
      backgroundColor: "rgba(239, 68, 68, 0.15)",
    },
    velocityBadgeHot: {
      backgroundColor: "rgba(245, 158, 11, 0.15)",
    },
    velocityBadgeText: {
      fontSize: fontSize.caption2,
      fontWeight: "600",
      color: colors.text,
    },
    trendMeta: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 2,
      gap: 4,
    },
    trendMetaText: {
      color: colors.textTertiary,
      fontSize: fontSize.caption1,
    },
    trendMetaSeparator: {
      color: colors.textTertiary,
      fontSize: fontSize.caption1,
    },
    chevron: {
      color: colors.textTertiary,
      fontSize: fontSize.title3,
      marginLeft: 8,
    },

    // ─── Fallback chip scroll (Bluesky data) ─────
    chipScroll: {
      flexDirection: "row",
      flexWrap: "wrap",
      paddingHorizontal: 16,
      gap: 8,
    },
    topicChip: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surfaceElevated,
      borderRadius: 20,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: colors.borderLight,
      gap: 4,
    },
    chipHash: {
      fontSize: fontSize.subheadline,
      color: colors.textSecondary,
    },
    chipText: {
      color: colors.text,
      fontSize: fontSize.subheadline,
      fontWeight: "500",
      maxWidth: 120,
    },
  });
}
