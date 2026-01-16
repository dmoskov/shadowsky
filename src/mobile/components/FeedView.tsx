/**
 * FeedView Component for React Native
 *
 * Enhanced feed view with feed selection and filtering capabilities.
 * Optimized for 60fps scroll performance with virtualization.
 *
 * Features:
 * - Multiple feed type support (timeline, following, custom feeds)
 * - Pull-to-refresh
 * - Infinite scroll
 * - Feed switching with smooth transitions
 */

import type { AppBskyFeedDefs } from "@atproto/api";
import { memo, useMemo } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import type { MobilePostData } from "../types";
import { FeedList } from "./FeedList";

/**
 * Feed type options
 */
export type FeedType =
  | "timeline"
  | "following"
  | "discover"
  | "custom"
  | string;

/**
 * Feed descriptor for custom feeds
 */
export interface FeedDescriptor {
  uri: string;
  displayName: string;
  description?: string;
}

/**
 * Props for FeedView component
 */
export interface FeedViewProps {
  activeFeed: FeedType;
  availableFeeds?: FeedDescriptor[];
  posts: MobilePostData[];
  onFeedChange?: (feedType: FeedType) => void;
  onPostPress: (post: AppBskyFeedDefs.PostView) => void;
  onLike?: (post: AppBskyFeedDefs.PostView) => void;
  onRepost?: (post: AppBskyFeedDefs.PostView) => void;
  onReply?: (post: AppBskyFeedDefs.PostView) => void;
  onQuote?: (post: AppBskyFeedDefs.PostView) => void;
  onBookmark?: (post: AppBskyFeedDefs.PostView) => void;
  onAuthorPress?: (handle: string) => void;
  onQuotePress?: (uri: string) => void;
  onLoadMore?: () => void;
  onRefresh?: () => void;
  hasMore?: boolean;
  isLoading?: boolean;
  isRefreshing?: boolean;
  showFeedSelector?: boolean;
}

/**
 * Feed selector tab component
 */
const FeedTab = memo(function FeedTab({
  label,
  isActive,
  onPress,
}: {
  label: string;
  isActive: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.tab, isActive && styles.tabActive]}
      accessibilityRole="button"
      accessibilityState={{ selected: isActive }}
    >
      <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
});

/**
 * Feed selector bar
 */
const FeedSelector = memo(function FeedSelector({
  activeFeed,
  availableFeeds,
  onFeedChange,
}: {
  activeFeed: FeedType;
  availableFeeds?: FeedDescriptor[];
  onFeedChange?: (feedType: FeedType) => void;
}) {
  // Default feeds
  const defaultFeeds: Array<{ type: FeedType; label: string }> = [
    { type: "timeline", label: "Timeline" },
    { type: "following", label: "Following" },
    { type: "discover", label: "Discover" },
  ];

  return (
    <View style={styles.feedSelector}>
      {defaultFeeds.map((feed) => (
        <FeedTab
          key={feed.type}
          label={feed.label}
          isActive={activeFeed === feed.type}
          onPress={() => onFeedChange?.(feed.type)}
        />
      ))}
      {availableFeeds?.map((feed) => (
        <FeedTab
          key={feed.uri}
          label={feed.displayName}
          isActive={activeFeed === feed.uri}
          onPress={() => onFeedChange?.(feed.uri)}
        />
      ))}
    </View>
  );
});

/**
 * Main FeedView component
 */
function FeedViewComponent({
  activeFeed,
  availableFeeds,
  posts,
  onFeedChange,
  onPostPress,
  onLike,
  onRepost,
  onReply,
  onQuote,
  onBookmark,
  onAuthorPress,
  onQuotePress,
  onLoadMore,
  onRefresh,
  hasMore = false,
  isLoading = false,
  isRefreshing = false,
  showFeedSelector = true,
}: FeedViewProps) {
  // Feed selector header
  const ListHeader = useMemo(() => {
    if (!showFeedSelector) return undefined;

    return (
      <FeedSelector
        activeFeed={activeFeed}
        availableFeeds={availableFeeds}
        onFeedChange={onFeedChange}
      />
    );
  }, [showFeedSelector, activeFeed, availableFeeds, onFeedChange]);

  return (
    <View style={styles.container}>
      <FeedList
        items={posts}
        onPostPress={onPostPress}
        onLike={onLike}
        onRepost={onRepost}
        onReply={onReply}
        onQuote={onQuote}
        onBookmark={onBookmark}
        onAuthorPress={onAuthorPress}
        onQuotePress={onQuotePress}
        onLoadMore={onLoadMore}
        onRefresh={onRefresh}
        hasMore={hasMore}
        isLoading={isLoading}
        isRefreshing={isRefreshing}
        ListHeaderComponent={ListHeader}
      />
    </View>
  );
}

/**
 * Custom comparison for memo
 */
function arePropsEqual(
  prevProps: FeedViewProps,
  nextProps: FeedViewProps,
): boolean {
  // Compare active feed
  if (prevProps.activeFeed !== nextProps.activeFeed) return false;

  // Compare posts array identity
  if (prevProps.posts !== nextProps.posts) return false;

  // Compare available feeds identity
  if (prevProps.availableFeeds !== nextProps.availableFeeds) return false;

  // Compare loading states
  if (prevProps.isLoading !== nextProps.isLoading) return false;
  if (prevProps.isRefreshing !== nextProps.isRefreshing) return false;
  if (prevProps.hasMore !== nextProps.hasMore) return false;

  // Compare show feed selector
  if (prevProps.showFeedSelector !== nextProps.showFeedSelector) return false;

  return true;
}

/**
 * Memoized export
 */
export const FeedView = memo(FeedViewComponent, arePropsEqual);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  } as ViewStyle,
  feedSelector: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e1e1e1",
    backgroundColor: "#ffffff",
  } as ViewStyle,
  tab: {
    flex: 1,
    minHeight: 48,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
  } as ViewStyle,
  tabActive: {
    borderBottomWidth: 3,
    borderBottomColor: "#1d9bf0",
  } as ViewStyle,
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#687684",
  } as TextStyle,
  tabTextActive: {
    color: "#0f1419",
  } as TextStyle,
});
