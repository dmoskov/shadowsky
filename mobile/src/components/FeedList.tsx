import React, { forwardRef, useMemo, useRef, useCallback } from 'react';
import {
  FlatList,
  ActivityIndicator,
  View,
  Text,
  StyleSheet,
  RefreshControl,
  ListRenderItem,
  ViewToken,
} from 'react-native';
import {AppBskyFeedDefs} from '@atproto/api';
import {PostCard} from './PostCard';
import {PostCardSkeleton} from './PostCardSkeleton';
import {LoadingState} from './LoadingState';
import {ErrorState} from './ErrorState';
import {EmptyState} from './EmptyState';
import {useNetwork} from '../contexts/NetworkContext';
import {usePreferences} from '../contexts/PreferencesContext';
import {colors} from '../constants/theme';
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
  const { isOnline } = useNetwork();
  const { preferences } = usePreferences();

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

  const onViewableItemsChangedRef = useRef(
    ({viewableItems}: {viewableItems: ViewToken[]}) => {
      if (viewableItems.length > 0) {
        const firstIndex = viewableItems[0].index ?? 0;
        prefetchRef.current(firstIndex);
      }
    },
  );

  const viewabilityConfigRef = useRef({
    itemVisiblePercentThreshold: 30,
    minimumViewTime: 100,
  });

  const handleRefresh = () => {
    triggerHaptic('selection');
    onRefresh?.();
  };

  const renderItem: ListRenderItem<AppBskyFeedDefs.FeedViewPost> = ({item}) => (
    <PostCard
      post={item}
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
  );

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

const styles = StyleSheet.create({
  list: {
    flex: 1,
    backgroundColor: colors.background,
  },
  footer: {
    padding: 20,
    alignItems: 'center',
  },
});
