/**
 * MobileFeedsScreen Component for React Native
 *
 * Feed discovery screen for mobile onboarding.
 * Users can browse and save curated feeds to their timeline.
 */

import { memo, useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageStyle,
  type ListRenderItemInfo,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import {
  scaledLineHeight,
  useDynamicType,
  type ScaledFontFn,
} from "../../hooks/useDynamicType";

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

export interface MobileFeedsScreenProps {
  suggestedFeeds: FeedGenerator[];
  isLoading: boolean;
  onSaveFeed: (feedUri: string) => Promise<boolean>;
  onContinue: (savedFeeds: string[]) => void;
  onBack: () => void;
  onSkip: () => void;
}

const DEFAULT_FEED_ICON_URI =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='12' fill='%23333344'/%3E%3Ctext x='50' y='60' text-anchor='middle' font-size='40' fill='%23555566'%3E%23%3C/text%3E%3C/svg%3E";

function createStyles(scaledFont: ScaledFontFn) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: "#000000",
    } as ViewStyle,
    header: {
      paddingHorizontal: 20,
      paddingTop: 60,
      paddingBottom: 16,
      alignItems: "center",
    } as ViewStyle,
    headerIcon: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: "rgba(99, 102, 241, 0.15)",
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 16,
    } as ViewStyle,
    headerIconText: {
      fontSize: scaledFont(28),
      color: "#6366f1",
      fontWeight: "700",
    } as TextStyle,
    title: {
      fontSize: scaledFont(26),
      fontWeight: "700",
      color: "#ffffff",
      textAlign: "center",
      marginBottom: 8,
    } as TextStyle,
    subtitle: {
      fontSize: scaledFont(15),
      color: "#8a8a9a",
      textAlign: "center",
      marginBottom: 8,
    } as TextStyle,
    counter: {
      fontSize: scaledFont(13),
      color: "#555566",
    } as TextStyle,
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    } as ViewStyle,
    loadingText: {
      fontSize: scaledFont(14),
      color: "#8a8a9a",
      marginTop: 12,
    } as TextStyle,
    listContent: {
      paddingHorizontal: 16,
      paddingBottom: 16,
    } as ViewStyle,
    feedCard: {
      backgroundColor: "#111122",
      borderRadius: 12,
      padding: 14,
    } as ViewStyle,
    feedInfo: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginBottom: 8,
    } as ViewStyle,
    feedAvatar: {
      width: 44,
      height: 44,
      borderRadius: 10,
    } as ImageStyle,
    feedTextContainer: {
      flex: 1,
    } as ViewStyle,
    feedName: {
      fontSize: scaledFont(15),
      fontWeight: "600",
      color: "#ffffff",
    } as TextStyle,
    feedCreator: {
      fontSize: scaledFont(13),
      color: "#555566",
    } as TextStyle,
    feedDescription: {
      fontSize: scaledFont(13),
      color: "#8a8a9a",
      marginBottom: 10,
      lineHeight: scaledLineHeight(scaledFont, 13, 18),
    } as TextStyle,
    feedFooter: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    } as ViewStyle,
    feedLikes: {
      fontSize: scaledFont(13),
      color: "#555566",
    } as TextStyle,
    addButton: {
      backgroundColor: "#6366f1",
      borderRadius: 8,
      paddingVertical: 8,
      paddingHorizontal: 20,
    } as ViewStyle,
    addButtonSaved: {
      backgroundColor: "#1a1a2e",
    } as ViewStyle,
    addButtonDisabled: {
      opacity: 0.5,
    } as ViewStyle,
    addButtonText: {
      fontSize: scaledFont(14),
      fontWeight: "600",
      color: "#ffffff",
    } as TextStyle,
    addButtonTextSaved: {
      color: "#8a8a9a",
    } as TextStyle,
    emptyContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 32,
    } as ViewStyle,
    emptyText: {
      fontSize: scaledFont(15),
      color: "#8a8a9a",
      textAlign: "center",
    } as TextStyle,
    separator: {
      height: 10,
    } as ViewStyle,
    navigation: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 16,
      borderTopWidth: 1,
      borderTopColor: "#1a1a2e",
    } as ViewStyle,
    backButton: {
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: "#333344",
    } as ViewStyle,
    backButtonText: {
      fontSize: scaledFont(15),
      fontWeight: "500",
      color: "#8a8a9a",
    } as TextStyle,
    rightButtons: {
      flexDirection: "row",
      gap: 10,
    } as ViewStyle,
    skipButton: {
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: "#333344",
    } as ViewStyle,
    skipButtonText: {
      fontSize: scaledFont(15),
      fontWeight: "500",
      color: "#8a8a9a",
    } as TextStyle,
    continueButton: {
      backgroundColor: "#6366f1",
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 10,
    } as ViewStyle,
    continueButtonText: {
      fontSize: scaledFont(15),
      fontWeight: "600",
      color: "#ffffff",
    } as TextStyle,
  });
}

type Styles = ReturnType<typeof createStyles>;

const FeedCard = memo(function FeedCard({
  feed,
  isSaved,
  isInProgress,
  onToggle,
  styles,
}: {
  feed: FeedGenerator;
  isSaved: boolean;
  isInProgress: boolean;
  onToggle: (feed: FeedGenerator) => void;
  styles: Styles;
}) {
  return (
    <View style={styles.feedCard}>
      <View style={styles.feedInfo}>
        <Image
          source={{ uri: feed.avatar || DEFAULT_FEED_ICON_URI }}
          style={styles.feedAvatar}
          accessibilityLabel={feed.displayName}
        />
        <View style={styles.feedTextContainer}>
          <Text style={styles.feedName} numberOfLines={1}>
            {feed.displayName}
          </Text>
          <Text style={styles.feedCreator} numberOfLines={1}>
            by @{feed.creator.handle}
          </Text>
        </View>
      </View>

      {feed.description ? (
        <Text style={styles.feedDescription} numberOfLines={2}>
          {feed.description}
        </Text>
      ) : null}

      <View style={styles.feedFooter}>
        {feed.likeCount !== undefined && (
          <Text style={styles.feedLikes}>
            {feed.likeCount.toLocaleString()} likes
          </Text>
        )}
        <Pressable
          onPress={() => onToggle(feed)}
          disabled={isInProgress}
          style={[
            styles.addButton,
            isSaved && styles.addButtonSaved,
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
                isSaved && styles.addButtonTextSaved,
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

export const MobileFeedsScreen = memo(function MobileFeedsScreen({
  suggestedFeeds,
  isLoading,
  onSaveFeed,
  onContinue,
  onBack,
  onSkip,
}: MobileFeedsScreenProps) {
  const { scaledFont } = useDynamicType();
  const styles = useMemo(() => createStyles(scaledFont), [scaledFont]);

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
        styles={styles}
      />
    ),
    [savedFeeds, savingInProgress, handleFeedToggle, styles],
  );

  const keyExtractor = useCallback((item: FeedGenerator) => item.uri, []);

  const listSeparator = useMemo(
    () =>
      memo(function ListSeparator() {
        return <View style={styles.separator} />;
      }),
    [styles],
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Text style={styles.headerIconText}>{"#"}</Text>
        </View>
        <Text style={styles.title}>Discover custom feeds</Text>
        <Text style={styles.subtitle}>
          Add curated feeds to personalize your timeline
        </Text>
        <Text style={styles.counter}>
          {savedFeeds.size > 0
            ? `${savedFeeds.size} feed${savedFeeds.size !== 1 ? "s" : ""} added`
            : "Browse and add feeds that interest you"}
        </Text>
      </View>

      {/* Feed list */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={styles.loadingText}>Loading feed suggestions...</Text>
        </View>
      ) : suggestedFeeds.length > 0 ? (
        <FlatList
          data={suggestedFeeds}
          renderItem={renderFeed}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={listSeparator}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            No feed suggestions available at the moment. You can discover more
            feeds later.
          </Text>
        </View>
      )}

      {/* Navigation */}
      <View style={styles.navigation}>
        <Pressable
          onPress={onBack}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>

        <View style={styles.rightButtons}>
          <Pressable
            onPress={onSkip}
            style={styles.skipButton}
            accessibilityRole="button"
            accessibilityLabel="Skip"
          >
            <Text style={styles.skipButtonText}>Skip</Text>
          </Pressable>

          <Pressable
            onPress={handleContinue}
            style={styles.continueButton}
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
