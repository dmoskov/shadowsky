import React, { memo, useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ListRenderItemInfo,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../contexts/ThemeContext";

interface FeedGenerator {
  uri: string;
  cid: string;
  did: string;
  creator: {
    did: string;
    handle: string;
    displayName?: string;
    avatar?: string;
  };
  displayName: string;
  description?: string;
  avatar?: string;
  likeCount?: number;
}

export interface FeedsScreenProps {
  suggestedFeeds: FeedGenerator[];
  isLoading: boolean;
  onSaveFeed: (feedUri: string) => Promise<boolean>;
  onContinue: (savedFeeds: string[]) => void;
  onBack: () => void;
  onSkip: () => void;
}

const FeedCard = memo(function FeedCard({
  feed,
  isSaved,
  isInProgress,
  onToggle,
}: {
  feed: FeedGenerator;
  isSaved: boolean;
  isInProgress: boolean;
  onToggle: (feed: FeedGenerator) => void;
}) {
  const { colors } = useTheme();

  return (
    <View style={[styles.feedCard, { backgroundColor: colors.surface }]}>
      <View style={styles.feedInfo}>
        {feed.avatar ? (
          <Image
            source={{ uri: feed.avatar }}
            style={styles.feedAvatar}
            accessibilityLabel={feed.displayName}
          />
        ) : (
          <View
            style={[
              styles.feedAvatar,
              styles.feedAvatarPlaceholder,
              { backgroundColor: colors.border },
            ]}
          >
            <Text style={[styles.feedAvatarText, { color: colors.textTertiary }]}>
              #
            </Text>
          </View>
        )}
        <View style={styles.feedTextContainer}>
          <Text
            style={[styles.feedName, { color: colors.text }]}
            numberOfLines={1}
          >
            {feed.displayName}
          </Text>
          <Text
            style={[styles.feedCreator, { color: colors.textTertiary }]}
            numberOfLines={1}
          >
            by @{feed.creator.handle}
          </Text>
        </View>
      </View>

      {feed.description ? (
        <Text
          style={[styles.feedDescription, { color: colors.textSecondary }]}
          numberOfLines={2}
        >
          {feed.description}
        </Text>
      ) : null}

      <View style={styles.feedFooter}>
        {feed.likeCount !== undefined && (
          <Text style={[styles.feedLikes, { color: colors.textTertiary }]}>
            {feed.likeCount.toLocaleString()} likes
          </Text>
        )}
        <Pressable
          onPress={() => onToggle(feed)}
          disabled={isInProgress}
          style={[
            styles.addButton,
            { backgroundColor: colors.primary },
            isSaved && {
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
            },
            isInProgress && styles.addButtonDisabled,
          ]}
          accessibilityRole="button"
          accessibilityLabel={
            isSaved ? `${feed.displayName} added` : `Add ${feed.displayName}`
          }
        >
          {isInProgress ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text
              style={[
                styles.addButtonText,
                isSaved && { color: colors.textSecondary },
              ]}
            >
              {isSaved ? "Added" : "Add"}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
});

export const FeedsScreen = memo(function FeedsScreen({
  suggestedFeeds,
  isLoading,
  onSaveFeed,
  onContinue,
  onBack,
  onSkip,
}: FeedsScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [savedFeeds, setSavedFeeds] = useState<Set<string>>(new Set());
  const [savingInProgress, setSavingInProgress] = useState<Set<string>>(
    new Set(),
  );

  const handleFeedToggle = useCallback(
    async (feed: FeedGenerator) => {
      if (savingInProgress.has(feed.uri)) return;

      setSavingInProgress((prev) => new Set([...prev, feed.uri]));
      try {
        if (savedFeeds.has(feed.uri)) {
          setSavedFeeds((prev) => {
            const next = new Set(prev);
            next.delete(feed.uri);
            return next;
          });
        } else {
          const success = await onSaveFeed(feed.uri);
          if (success) {
            setSavedFeeds((prev) => new Set([...prev, feed.uri]));
          }
        }
      } finally {
        setSavingInProgress((prev) => {
          const next = new Set(prev);
          next.delete(feed.uri);
          return next;
        });
      }
    },
    [savedFeeds, savingInProgress, onSaveFeed],
  );

  const handleContinue = useCallback(() => {
    onContinue(Array.from(savedFeeds));
  }, [onContinue, savedFeeds]);

  const renderFeed = useCallback(
    ({ item }: ListRenderItemInfo<FeedGenerator>) => (
      <FeedCard
        feed={item}
        isSaved={savedFeeds.has(item.uri)}
        isInProgress={savingInProgress.has(item.uri)}
        onToggle={handleFeedToggle}
      />
    ),
    [savedFeeds, savingInProgress, handleFeedToggle],
  );

  const keyExtractor = useCallback((item: FeedGenerator) => item.uri, []);

  const Separator = useMemo(
    () =>
      memo(function ListSeparator() {
        return <View style={styles.separator} />;
      }),
    [],
  );

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top,
        },
      ]}
    >
      <View style={styles.header}>
        <View
          style={[
            styles.headerIcon,
            { backgroundColor: colors.glowPrimary },
          ]}
        >
          <Text style={[styles.headerIconText, { color: colors.primary }]}>
            #
          </Text>
        </View>
        <Text style={[styles.title, { color: colors.text }]}>
          Discover custom feeds
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Add curated feeds to personalize your timeline
        </Text>
        <Text style={[styles.counter, { color: colors.textTertiary }]}>
          {savedFeeds.size > 0
            ? `${savedFeeds.size} feed${savedFeeds.size !== 1 ? "s" : ""} added`
            : "Browse and add feeds that interest you"}
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading feed suggestions...
          </Text>
        </View>
      ) : suggestedFeeds.length > 0 ? (
        <FlatList
          data={suggestedFeeds}
          renderItem={renderFeed}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={Separator}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            No feed suggestions available at the moment. You can discover more
            feeds later.
          </Text>
        </View>
      )}

      <View
        style={[
          styles.navigation,
          {
            borderTopColor: colors.border,
            paddingBottom: insets.bottom + 16,
          },
        ]}
      >
        <Pressable
          onPress={onBack}
          style={[styles.backButton, { borderColor: colors.border }]}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Text
            style={[styles.backButtonText, { color: colors.textSecondary }]}
          >
            Back
          </Text>
        </Pressable>

        <View style={styles.rightButtons}>
          <Pressable
            onPress={onSkip}
            style={[styles.skipButton, { borderColor: colors.border }]}
            accessibilityRole="button"
            accessibilityLabel="Skip"
          >
            <Text
              style={[styles.skipButtonText, { color: colors.textSecondary }]}
            >
              Skip
            </Text>
          </Pressable>

          <Pressable
            onPress={handleContinue}
            style={[
              styles.continueButton,
              { backgroundColor: colors.primary },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Continue"
          >
            <Text style={styles.continueButtonText}>Continue</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    alignItems: "center",
  },
  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  headerIconText: {
    fontSize: 28,
    fontWeight: "700",
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    textAlign: "center",
    marginBottom: 8,
  },
  counter: {
    fontSize: 13,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 14,
    marginTop: 12,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  feedCard: {
    borderRadius: 12,
    padding: 14,
  },
  feedInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  feedAvatar: {
    width: 44,
    height: 44,
    borderRadius: 10,
  },
  feedAvatarPlaceholder: {
    justifyContent: "center",
    alignItems: "center",
  },
  feedAvatarText: {
    fontSize: 22,
    fontWeight: "700",
  },
  feedTextContainer: {
    flex: 1,
  },
  feedName: {
    fontSize: 15,
    fontWeight: "600",
  },
  feedCreator: {
    fontSize: 13,
  },
  feedDescription: {
    fontSize: 13,
    marginBottom: 10,
    lineHeight: 18,
  },
  feedFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  feedLikes: {
    fontSize: 13,
  },
  addButton: {
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  addButtonDisabled: {
    opacity: 0.5,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ffffff",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 15,
    textAlign: "center",
  },
  separator: {
    height: 10,
  },
  navigation: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  backButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: "500",
  },
  rightButtons: {
    flexDirection: "row",
    gap: 10,
  },
  skipButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
  },
  skipButtonText: {
    fontSize: 15,
    fontWeight: "500",
  },
  continueButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  continueButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#ffffff",
  },
});
