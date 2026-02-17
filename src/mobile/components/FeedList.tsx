/**
 * FeedList Component for React Native
 *
 * High-performance feed list optimized for 60fps scrolling using FlatList.
 *
 * Performance optimizations:
 * - getItemLayout for O(1) scroll-to-index operations (no measurement needed)
 * - windowSize optimization for memory efficiency
 * - removeClippedSubviews for offscreen optimization
 * - maxToRenderPerBatch for smooth scrolling
 * - updateCellsBatchingPeriod for batched updates
 * - Stable keyExtractor to prevent unnecessary re-renders
 * - React.memo on row components with custom comparison
 * - Visibility tracking for lazy loading optimization
 */

import type { AppBskyFeedDefs } from "@atproto/api";
import { memo, useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  type ListRenderItemInfo,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ViewStyle,
  type ViewToken,
} from "react-native";
import { useDynamicType, type ScaledFontFn } from "../hooks/useDynamicType";
import {
  FEED_CONSTANTS,
  type FeedListProps,
  type MobilePostData,
} from "../types";
import { PostCard } from "./PostCard";

/**
 * Calculate estimated item height based on post content
 */
function estimateItemHeight(item: MobilePostData): number {
  const embed = item.post.embed as any;
  const record = item.post.record as any;
  const textLength = record?.text?.length || 0;

  // Base height for avatar, author info, and action bar
  let height = FEED_CONSTANTS.BASE_POST_HEIGHT;

  // Add height for text content (roughly 20px per line, ~50 chars per line)
  const estimatedLines = Math.ceil(textLength / 50);
  height += Math.min(estimatedLines * 20, 100); // Cap at 5 lines

  // Add height for embeds
  if (embed?.images?.length > 0 || embed?.media?.images?.length > 0) {
    height +=
      embed.images?.length === 1
        ? 200
        : FEED_CONSTANTS.POST_WITH_GALLERY_HEIGHT -
          FEED_CONSTANTS.BASE_POST_HEIGHT;
  } else if (embed?.record) {
    height += 100; // Quoted post
  } else if (embed?.external) {
    height += 180; // External link preview
  } else if (embed?.video) {
    height += 250; // Video embed
  }

  return height;
}

/**
 * Generate item layout info for getItemLayout
 * This enables efficient scrolling without measuring each item
 */
function createGetItemLayout(items: MobilePostData[]) {
  // Pre-calculate offsets for all items
  const offsets: number[] = [];
  let totalOffset = 0;

  for (const item of items) {
    offsets.push(totalOffset);
    totalOffset += estimateItemHeight(item);
  }

  return (
    _data: ArrayLike<MobilePostData> | null | undefined,
    index: number,
  ) => {
    if (index < 0 || index >= items.length) {
      return {
        length: FEED_CONSTANTS.BASE_POST_HEIGHT,
        offset: 0,
        index,
      };
    }

    return {
      length: estimateItemHeight(items[index]),
      offset: offsets[index] || 0,
      index,
    };
  };
}

/**
 * Create styles with Dynamic Type font scaling
 */
function createStyles(scaledFont: ScaledFontFn) {
  return StyleSheet.create({
    list: {
      flex: 1,
      backgroundColor: "#ffffff",
    } as ViewStyle,
    contentContainer: {
      flexGrow: 1,
    } as ViewStyle,
    separator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: "#e1e1e1",
    } as ViewStyle,
    emptyContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 32,
      minHeight: 300,
    } as ViewStyle,
    emptyText: {
      fontSize: scaledFont(18),
      fontWeight: "600",
      color: "#0f1419",
      marginBottom: 8,
    },
    emptySubtext: {
      fontSize: scaledFont(14),
      color: "#687684",
      textAlign: "center",
    },
    loadingFooter: {
      paddingVertical: 20,
      alignItems: "center",
    } as ViewStyle,
  });
}

type Styles = ReturnType<typeof createStyles>;

/**
 * Empty state component
 */
const DefaultEmptyComponent = memo(function DefaultEmptyComponent({
  styles,
}: {
  styles: Styles;
}) {
  return (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>No posts to display</Text>
      <Text style={styles.emptySubtext}>
        Pull down to refresh or check back later
      </Text>
    </View>
  );
});

/**
 * Loading footer component
 */
const LoadingFooter = memo(function LoadingFooter({
  isLoading,
  styles,
}: {
  isLoading: boolean;
  styles: Styles;
}) {
  if (!isLoading) return null;

  return (
    <View style={styles.loadingFooter}>
      <ActivityIndicator size="small" color="#1d9bf0" />
    </View>
  );
});

/**
 * Item separator component
 */
const ItemSeparator = memo(function ItemSeparator({
  styles,
}: {
  styles: Styles;
}) {
  return <View style={styles.separator} />;
});

/**
 * Main FeedList component
 */
function FeedListComponent({
  items,
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
  ListEmptyComponent,
  ListHeaderComponent,
  ListFooterComponent,
}: FeedListProps) {
  const { scaledFont } = useDynamicType();
  const styles = useMemo(() => createStyles(scaledFont), [scaledFont]);

  const flatListRef = useRef(null);
  const [visibleItems, setVisibleItems] = useState<Set<string>>(new Set());

  // Stable key extractor
  const keyExtractor = useCallback(
    (item: MobilePostData) => item.key || item.post.uri,
    [],
  );

  // Memoized getItemLayout function
  const getItemLayout = useMemo(() => createGetItemLayout(items), [items]);

  // Handle viewability changes for lazy loading optimization
  const onViewableItemsChanged = useCallback(
    ({
      viewableItems,
    }: {
      viewableItems: ViewToken<MobilePostData>[];
      changed: ViewToken<MobilePostData>[];
    }) => {
      const newVisible = new Set(
        viewableItems.map(
          (item) =>
            (item.item as MobilePostData)?.key ||
            (item.item as MobilePostData)?.post?.uri,
        ),
      );
      setVisibleItems(newVisible);
    },
    [],
  );

  // Viewability config - memoized to prevent re-creation
  const viewabilityConfig = useMemo(
    () => ({
      itemVisiblePercentThreshold: 50,
      minimumViewTime: 100,
    }),
    [],
  );

  // Handler refs for stable callbacks
  const handlePostPress = useCallback(
    (post: AppBskyFeedDefs.PostView) => {
      onPostPress(post);
    },
    [onPostPress],
  );

  const handleLike = useCallback(
    (post: AppBskyFeedDefs.PostView) => {
      onLike?.(post);
    },
    [onLike],
  );

  const handleRepost = useCallback(
    (post: AppBskyFeedDefs.PostView) => {
      onRepost?.(post);
    },
    [onRepost],
  );

  const handleReply = useCallback(
    (post: AppBskyFeedDefs.PostView) => {
      onReply?.(post);
    },
    [onReply],
  );

  const handleQuote = useCallback(
    (post: AppBskyFeedDefs.PostView) => {
      onQuote?.(post);
    },
    [onQuote],
  );

  const handleBookmark = useCallback(
    (post: AppBskyFeedDefs.PostView) => {
      onBookmark?.(post);
    },
    [onBookmark],
  );

  const handleAuthorPress = useCallback(
    (handle: string) => {
      onAuthorPress?.(handle);
    },
    [onAuthorPress],
  );

  const handleQuotePress = useCallback(
    (uri: string) => {
      onQuotePress?.(uri);
    },
    [onQuotePress],
  );

  // Render item function with visibility optimization
  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<MobilePostData>) => {
      const isVisible = visibleItems.has(item.key || item.post.uri);

      return (
        <PostCard
          post={item.post}
          reason={item.reason}
          onPress={() => handlePostPress(item.post)}
          onLike={onLike ? () => handleLike(item.post) : undefined}
          onRepost={onRepost ? () => handleRepost(item.post) : undefined}
          onReply={onReply ? () => handleReply(item.post) : undefined}
          onQuote={onQuote ? () => handleQuote(item.post) : undefined}
          onBookmark={onBookmark ? () => handleBookmark(item.post) : undefined}
          onAuthorPress={handleAuthorPress}
          onQuotePress={handleQuotePress}
          isVisible={isVisible}
          showBorder={false}
        />
      );
    },
    [
      visibleItems,
      handlePostPress,
      handleLike,
      handleRepost,
      handleReply,
      handleQuote,
      handleBookmark,
      handleAuthorPress,
      handleQuotePress,
      onLike,
      onRepost,
      onReply,
      onQuote,
      onBookmark,
    ],
  );

  // End reached handler with debounce built into FlatList
  const handleEndReached = useCallback(() => {
    if (hasMore && !isLoading && onLoadMore) {
      onLoadMore();
    }
  }, [hasMore, isLoading, onLoadMore]);

  // Scroll performance optimization
  const handleScroll = useCallback(
    (_event: NativeSyntheticEvent<NativeScrollEvent>) => {
      // Can be used for scroll position tracking
      // Intentionally minimal to avoid performance impact
    },
    [],
  );

  // Refresh control
  const refreshControl = useMemo(
    () =>
      onRefresh ? (
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={onRefresh}
          colors={["#1d9bf0"]}
          tintColor="#1d9bf0"
          progressViewOffset={10}
        />
      ) : undefined,
    [isRefreshing, onRefresh],
  );

  // Footer component with loading state
  const ListFooter = useMemo(
    () =>
      ListFooterComponent || (
        <LoadingFooter isLoading={isLoading && hasMore} styles={styles} />
      ),
    [ListFooterComponent, isLoading, hasMore, styles],
  );

  // Empty component
  const EmptyComponent = useMemo(
    () => ListEmptyComponent || <DefaultEmptyComponent styles={styles} />,
    [ListEmptyComponent, styles],
  );

  return (
    <FlatList
      ref={flatListRef}
      data={items}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      getItemLayout={getItemLayout}
      // Performance optimizations
      windowSize={FEED_CONSTANTS.WINDOW_SIZE}
      maxToRenderPerBatch={FEED_CONSTANTS.MAX_TO_RENDER_PER_BATCH}
      updateCellsBatchingPeriod={FEED_CONSTANTS.UPDATE_CELLS_BATCH_PERIOD}
      initialNumToRender={FEED_CONSTANTS.INITIAL_NUM_TO_RENDER}
      removeClippedSubviews={true}
      // Scroll handling
      onEndReached={handleEndReached}
      onEndReachedThreshold={FEED_CONSTANTS.ON_END_REACHED_THRESHOLD}
      onScroll={handleScroll}
      scrollEventThrottle={16} // 60fps
      // Viewability
      onViewableItemsChanged={onViewableItemsChanged}
      viewabilityConfig={viewabilityConfig}
      // Components
      ItemSeparatorComponent={() => <ItemSeparator styles={styles} />}
      ListEmptyComponent={!isLoading ? EmptyComponent : null}
      ListHeaderComponent={ListHeaderComponent}
      ListFooterComponent={ListFooter}
      // Refresh
      refreshControl={refreshControl}
      // Styling
      style={styles.list}
      contentContainerStyle={styles.contentContainer}
      // Accessibility
      accessibilityRole="list"
      accessibilityLabel="Feed"
      // Maintainer index for scroll restoration
      maintainVisibleContentPosition={{
        minIndexForVisible: 0,
        autoscrollToTopThreshold: 10,
      }}
    />
  );
}

/**
 * Custom comparison for memo
 */
function arePropsEqual(
  prevProps: FeedListProps,
  nextProps: FeedListProps,
): boolean {
  // Compare items array identity (shallow)
  if (prevProps.items !== nextProps.items) return false;

  // Compare loading states
  if (prevProps.isLoading !== nextProps.isLoading) return false;
  if (prevProps.isRefreshing !== nextProps.isRefreshing) return false;
  if (prevProps.hasMore !== nextProps.hasMore) return false;

  // Callbacks are expected to be stable (useCallback in parent)
  return true;
}

/**
 * Memoized FeedList export
 */
export const FeedList = memo(FeedListComponent, arePropsEqual);
