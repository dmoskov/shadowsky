import React, { forwardRef, useMemo, useRef, useState, useCallback } from 'react';
import {
  FlatList,
  ActivityIndicator,
  View,
  StyleSheet,
  RefreshControl,
  ListRenderItem,
  ViewToken,
} from 'react-native';
import {AppBskyFeedDefs, AppBskyEmbedVideo, AppBskyEmbedRecordWithMedia} from '@atproto/api';
import {PostCardSkeleton} from './PostCardSkeleton';
import {SwipeablePostCard} from './SwipeablePostCard';
import {ErrorState} from './ErrorState';
import { EmptyState } from './EmptyState';
import {useNetwork} from '../contexts/NetworkContext';
import {usePreferences} from '../contexts/PreferencesContext';
import { useTheme } from "../contexts/ThemeContext";
import {useVideoAutoplay} from '../contexts/VideoAutoplayContext';
import {triggerHaptic} from '../utils/haptics';
import {filterMutedPosts} from '../utils/content-filter';
import {useImagePrefetch} from '../hooks/useImagePrefetch';

interface FeedListProps {
  posts: AppBskyFeedDefs.FeedViewPost[];
  isLoading: boolean;
  isRefreshing?: boolean;
  isLoadingMore?: boolean;
  error?: Error | null;
  onRefresh?: () => void;
  onLoadMore?: () => void;
  onPostPress?: (post: AppBskyFeedDefs.FeedViewPost) => void;
  onProfilePress?: (handle: string) => void;
  onLike?: (post: AppBskyFeedDefs.FeedViewPost) => void;
  onRepost?: (post: AppBskyFeedDefs.FeedViewPost) => void;
  onReply?: (post: AppBskyFeedDefs.FeedViewPost) => void;
  onBookmark?: (post: AppBskyFeedDefs.FeedViewPost) => void;
  isBookmarked?: (postUri: string) => boolean;
  emptyMessage?: string;
  onMentionPress?: (handle: string, did: string) => void;
  onHashtagPress?: (tag: string) => void;
  feedType?: "home" | "other";
}

/** Check if a feed post contains a video embed */
function hasVideoEmbed(post: AppBskyFeedDefs.FeedViewPost): boolean {
  const embed = post.post.embed;
  if (!embed) return false;
  if (AppBskyEmbedVideo.isView(embed)) return true;
  if (AppBskyEmbedRecordWithMedia.isView(embed)) {
    const media = embed.media;
    if (media && AppBskyEmbedVideo.isView(media)) return true;
  }
  return false;
}

export const FeedList = forwardRef<FlatList, FeedListProps>(function FeedList({
  posts,
  isLoading,
  isRefreshing = false,
  isLoadingMore = false,
  error,
  onRefresh,
  onLoadMore,
  onPostPress,
  onProfilePress,
  onLike,
  onRepost,
  onReply,
  onBookmark,
  isBookmarked,
  emptyMessage = 'No posts yet',
  onMentionPress,
  onHashtagPress,
  feedType = 'other',
}: FeedListProps, ref) {
  const { colors } = useTheme();
  const { isOnline } = useNetwork();
  const { preferences } = usePreferences();
  const { setActiveVideoUri, isAutoplayEnabled } = useVideoAutoplay();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Track which post URIs are currently visible
  const [visiblePostUris, setVisiblePostUris] = useState<Set<string>>(new Set());

  // Filter posts based on muted words
  const filteredPosts = useMemo(() => {
    if (!preferences?.mutedWords || preferences.mutedWords.length === 0) {
      return posts;
    }
    return filterMutedPosts(posts, preferences.mutedWords, feedType);
  }, [posts, preferences?.mutedWords, feedType]);

  const {prefetchVisibleWindow} = useImagePrefetch(filteredPosts);
  const prefetchRef = useRef(prefetchVisibleWindow);
  prefetchRef.current = prefetchVisibleWindow;

  // Ref to hold the latest setActiveVideoUri so we can call it from the static callback
  const setActiveVideoUriRef = useRef(setActiveVideoUri);
  setActiveVideoUriRef.current = setActiveVideoUri;

  const isAutoplayEnabledRef = useRef(isAutoplayEnabled);
  isAutoplayEnabledRef.current = isAutoplayEnabled;

  const filteredPostsRef = useRef(filteredPosts);
  filteredPostsRef.current = filteredPosts;

  const onViewableItemsChangedRef = useRef(
    ({viewableItems}: {viewableItems: ViewToken[]}) => {
      // Image prefetching
      if (viewableItems.length > 0) {
        const firstIndex = viewableItems[0].index ?? 0;
        prefetchRef.current(firstIndex);
      }

      // Video autoplay tracking
      const visibleUris = new Set<string>();
      let bestVideoUri: string | null = null;

      for (const token of viewableItems) {
        if (token.item && token.isViewable) {
          const post = token.item as AppBskyFeedDefs.FeedViewPost;
          visibleUris.add(post.post.uri);

          // Find the first visible post with a video (topmost = most visible)
          if (!bestVideoUri && hasVideoEmbed(post)) {
            bestVideoUri = post.post.uri;
          }
        }
      }

      setVisiblePostUris(visibleUris);

      if (isAutoplayEnabledRef.current) {
        setActiveVideoUriRef.current(bestVideoUri);
      } else {
        setActiveVideoUriRef.current(null);
      }
    },
  );

  const viewabilityConfigRef = useRef({
    itemVisiblePercentThreshold: 50,
    minimumViewTime: 300,
  });

  const handleRefresh = () => {
    triggerHaptic('selection');
    onRefresh?.();
  };

  const renderItem: ListRenderItem<AppBskyFeedDefs.FeedViewPost> = useCallback(({item}) => (
    <SwipeablePostCard
      post={item}
      isVisible={visiblePostUris.has(item.post.uri)}
      onPress={() => onPostPress?.(item)}
      onPressProfile={onProfilePress}
      onLike={() => onLike?.(item)}
      onRepost={() => onRepost?.(item)}
      onReply={() => onReply?.(item)}
      onBookmark={() => onBookmark?.(item)}
      isBookmarked={isBookmarked?.(item.post.uri)}
      onMentionPress={onMentionPress}
      onHashtagPress={onHashtagPress}
    />
  ), [visiblePostUris, onPostPress, onProfilePress, onLike, onRepost, onReply, onBookmark, isBookmarked, onMentionPress, onHashtagPress]);

  const renderFooter = () => {
    if (!isLoadingMore) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  };

  const renderEmpty = () => {
    if (isLoading) {
      return (
        <View>
          <PostCardSkeleton />
          <PostCardSkeleton />
          <PostCardSkeleton />
          <PostCardSkeleton />
          <PostCardSkeleton />
        </View>
      );
    }
    if (error) {
      return (
        <ErrorState
          message={error.message || 'Failed to load feed'}
          onRetry={onRefresh}
        />
      );
    }
    return <EmptyState message={emptyMessage} />;
  };

  return (
    <FlatList
      ref={ref}
      data={filteredPosts}
      renderItem={renderItem}
      keyExtractor={(item) => item.post.uri}
      ListEmptyComponent={renderEmpty}
      ListFooterComponent={renderFooter}
      onEndReached={onLoadMore}
      onEndReachedThreshold={0.5}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={isOnline ? colors.primary : colors.textTertiary}
            colors={[isOnline ? colors.primary : colors.textTertiary]}
            enabled={isOnline}
          />
        ) : undefined
      }
      onViewableItemsChanged={onViewableItemsChangedRef.current}
      viewabilityConfig={viewabilityConfigRef.current}
      removeClippedSubviews={true}
      maxToRenderPerBatch={10}
      windowSize={7}
      initialNumToRender={10}
      updateCellsBatchingPeriod={50}
      style={styles.list}
      accessible={false}
      accessibilityLabel="Feed of posts"
      accessibilityHint="Scroll to view more posts"
    />
  );
});

function createStyles(colors: any) {
  return StyleSheet.create({
    list: {
      flex: 1,
      backgroundColor: colors.background,
    },
    footer: {
      padding: 20,
      alignItems: 'center',
    },
  });
}
