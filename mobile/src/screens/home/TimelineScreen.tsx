import React, { useMemo } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Text,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { AppBskyFeedDefs, AppBskyEmbedImages } from "@atproto/api";
import { useTimeline } from "../../hooks/api/useFeed";
import { useAppNavigation } from "../../hooks/useNavigation";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { colors } from "../../constants/theme";
import { useOfflineFeedEnhancer } from "../../hooks/useOfflineFeed";
import StaleContentIndicator from "../../components/StaleContentIndicator";
import { useOfflineFeedStatus } from "../../hooks/useOfflineFeed";

const SCREEN_WIDTH = Dimensions.get("window").width;
const GRID_COLUMNS = 3;
const GRID_SPACING = 2;
const ITEM_SIZE = (SCREEN_WIDTH - GRID_SPACING * (GRID_COLUMNS + 1)) / GRID_COLUMNS;

/**
 * Extract post ID (rkey) from AT Protocol URI
 * URI format: at://did/collection/rkey
 */
function getPostIdFromUri(uri: string): string {
  const parts = uri.split("/");
  return parts[parts.length - 1];
}

/**
 * Check if a post has images
 */
function hasImages(post: AppBskyFeedDefs.FeedViewPost): boolean {
  return AppBskyEmbedImages.isView(post.post.embed);
}

/**
 * Get the first image from a post
 */
function getFirstImage(post: AppBskyFeedDefs.FeedViewPost): string | null {
  if (AppBskyEmbedImages.isView(post.post.embed) && post.post.embed.images.length > 0) {
    return post.post.embed.images[0].thumb;
  }
  return null;
}

interface MediaGridItemProps {
  post: AppBskyFeedDefs.FeedViewPost;
  onPress: () => void;
}

function MediaGridItem({ post, onPress }: MediaGridItemProps) {
  const imageUri = getFirstImage(post);
  const likeCount = post.post.likeCount || 0;
  const replyCount = post.post.replyCount || 0;

  return (
    <TouchableOpacity
      style={styles.gridItem}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {imageUri && (
        <Image
          source={{ uri: imageUri }}
          style={styles.gridImage}
          resizeMode="cover"
        />
      )}
      {/* Overlay with engagement stats */}
      <View style={styles.overlay}>
        <View style={styles.stats}>
          {likeCount > 0 && (
            <View style={styles.stat}>
              <Text style={styles.statText}>❤️ {likeCount}</Text>
            </View>
          )}
          {replyCount > 0 && (
            <View style={styles.stat}>
              <Text style={styles.statText}>💬 {replyCount}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export function TimelineScreen() {
  const timelineQuery = useTimeline();
  const enhancedQuery = useOfflineFeedEnhancer(timelineQuery, 'timeline', ['timeline']);
  const { data, isLoading, isRefetching, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = enhancedQuery;
  const { isServingCached, isStale, isOnline } = enhancedQuery;
  const offlineStatus = useOfflineFeedStatus();
  const { navigateToThread } = useAppNavigation();

  // Flatten paginated data and filter for posts with images
  const postsWithMedia = useMemo(() => {
    const allPosts = data?.pages.flatMap((page) => page.feed) ?? [];
    return allPosts.filter(hasImages);
  }, [data]);

  const handlePostPress = (post: AppBskyFeedDefs.FeedViewPost) => {
    const postId = getPostIdFromUri(post.post.uri);
    const handle = post.post.author.handle;
    navigateToThread(handle, postId);
  };

  const handleRefresh = () => {
    refetch();
  };

  const handleLoadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  const renderItem = ({ item }: { item: AppBskyFeedDefs.FeedViewPost }) => (
    <MediaGridItem
      post={item}
      onPress={() => handlePostPress(item)}
    />
  );

  const renderFooter = () => {
    if (!isFetchingNextPage) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  };

  if (error) {
    return (
      <View style={styles.container}>
        <ErrorState
          message="Failed to load timeline"
          onRetry={refetch}
        />
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (postsWithMedia.length === 0) {
    return (
      <View style={styles.container}>
        <EmptyState
          message="No media posts yet — posts with images will appear here"
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StaleContentIndicator
        isStale={isServingCached || isStale}
        lastCachedAt={offlineStatus.lastCachedAt}
        onRetry={isOnline ? refetch : undefined}
        isOnline={isOnline}
      />
      <FlatList
        data={postsWithMedia}
        renderItem={renderItem}
        keyExtractor={(item) => item.post.uri}
        numColumns={GRID_COLUMNS}
        contentContainerStyle={styles.gridContainer}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
        removeClippedSubviews={true}
        maxToRenderPerBatch={15}
        windowSize={7}
        initialNumToRender={15}
        updateCellsBatchingPeriod={50}
        getItemLayout={(_data, index) => ({
          length: ITEM_SIZE + GRID_SPACING,
          offset: (ITEM_SIZE + GRID_SPACING) * Math.floor(index / GRID_COLUMNS),
          index,
        })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  gridContainer: {
    padding: GRID_SPACING,
  },
  gridItem: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    margin: GRID_SPACING / 2,
    position: "relative",
    borderRadius: 4,
    overflow: "hidden",
  },
  gridImage: {
    width: "100%",
    height: "100%",
    backgroundColor: colors.surfaceElevated,
  },
  overlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    padding: 4,
  },
  stats: {
    flexDirection: "row",
    gap: 8,
  },
  stat: {
    flexDirection: "row",
    alignItems: "center",
  },
  statText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "600",
  },
  footer: {
    paddingVertical: 16,
    alignItems: "center",
  },
});
