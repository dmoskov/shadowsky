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
} from "../services/trending-service";
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
          <Text style={styles.headerText}>Explore topics</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.textTertiary} />
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
        <Text style={styles.headerText}>Explore topics</Text>
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
              accessibilityLabel={`Topic: ${trend.topic}${trend.authorCount ? `, ${trend.authorCount} people` : ""}`}
            >
              <View style={styles.trendContent}>
                <Text style={styles.trendTopic} numberOfLines={1}>
                  {trend.displayName || trend.topic}
                </Text>

                <View style={styles.trendMeta}>
                  {trend.authorCount != null && trend.authorCount > 0 && (
                    <Text style={styles.trendMetaText}>
                      {formatCount(trend.authorCount)} people
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
        // Fallback: simple chip layout (Bluesky data)
        <View style={styles.chipScroll}>
          {topics.map((t, index) => (
            <TouchableOpacity
              key={`${t.topic}-${index}`}
              style={styles.topicChip}
              onPress={() => onTopicClick(t.topic)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Topic: ${t.topic}`}
            >
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
      paddingHorizontal: 16,
      marginBottom: 12,
    },
    headerText: {
      color: colors.textSecondary,
      fontSize: fontSize.footnote,
      fontWeight: "500",
      textTransform: "uppercase",
      letterSpacing: 0.5,
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
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderLight,
    },
    trendContent: {
      flex: 1,
    },
    trendTopic: {
      color: colors.text,
      fontSize: fontSize.callout,
      fontWeight: "500",
    },
    trendMeta: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 3,
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

    // ─── Fallback chip layout (Bluesky data) ─────
    chipScroll: {
      flexDirection: "row",
      flexWrap: "wrap",
      paddingHorizontal: 16,
      gap: 8,
    },
    topicChip: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: 20,
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    chipText: {
      color: colors.text,
      fontSize: fontSize.subheadline,
      fontWeight: "500",
      maxWidth: 140,
    },
  });
}
