import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { colors } from "../constants/theme";

export interface TrendingTopic {
  topic: string;
  link?: string;
}

export interface Trend {
  topic: string;
  displayName?: string;
  status?: "hot" | "rising" | "stable";
  postCount?: number;
  category?: string;
}

interface TrendingTopicsProps {
  topics?: TrendingTopic[];
  trends?: Trend[];
  onTopicClick: (topic: string) => void;
  isLoading?: boolean;
}

export function TrendingTopics({
  topics = [],
  trends = [],
  onTopicClick,
  isLoading = false,
}: TrendingTopicsProps) {
  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerIcon}>🔥</Text>
          <Text style={styles.headerText}>Trending</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      </View>
    );
  }

  // Prefer detailed trends if available, fall back to simple topics
  const displayItems =
    trends.length > 0
      ? trends.map((t) => ({
          topic: t.displayName || t.topic,
          isHot: t.status === "hot",
          postCount: t.postCount,
          category: t.category,
        }))
      : topics.map((t) => ({
          topic: t.topic,
          isHot: false,
          postCount: undefined,
          category: undefined,
        }));

  if (displayItems.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerIcon}>🔥</Text>
        <Text style={styles.headerText}>Trending Now</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        style={styles.scrollView}
      >
        {displayItems.map((item, index) => (
          <TouchableOpacity
            key={`${item.topic}-${index}`}
            style={[
              styles.topicChip,
              item.isHot && styles.topicChipHot,
            ]}
            onPress={() => onTopicClick(item.topic)}
            activeOpacity={0.7}
          >
            <Text style={styles.topicIcon}>
              {item.isHot ? "🔥" : "#"}
            </Text>
            <Text style={styles.topicText} numberOfLines={1}>
              {item.topic}
            </Text>
            {item.postCount && item.postCount > 1000 && (
              <Text style={styles.postCount}>
                {item.postCount >= 1000
                  ? `${(item.postCount / 1000).toFixed(1)}k`
                  : item.postCount}
              </Text>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
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
    fontSize: 16,
    marginRight: 6,
  },
  headerText: {
    color: "#9ca3af",
    fontSize: 14,
    fontWeight: "600",
  },
  loadingContainer: {
    paddingVertical: 16,
    alignItems: "center",
  },
  scrollView: {
    paddingHorizontal: 16,
  },
  scrollContent: {
    gap: 8,
  },
  topicChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1f2937",
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#374151",
    gap: 6,
  },
  topicChipHot: {
    borderColor: colors.primary,
    backgroundColor: "rgba(201, 168, 76, 0.1)",
  },
  topicIcon: {
    fontSize: 14,
  },
  topicText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "500",
    maxWidth: 120,
  },
  postCount: {
    color: "#6b7280",
    fontSize: 12,
    marginLeft: 4,
  },
});
