import React, { forwardRef } from 'react';
import {
  FlatList,
  ActivityIndicator,
  View,
  Text,
  StyleSheet,
  RefreshControl,
  ListRenderItem,
} from 'react-native';
import {AppBskyFeedDefs} from '@atproto/api';
import {PostCard} from './PostCard';
import {LoadingState} from './LoadingState';
import {ErrorState} from './ErrorState';
import {EmptyState} from './EmptyState';
import {useNetwork} from '../contexts/NetworkContext';
import {colors} from '../constants/theme';
import {triggerHaptic} from '../utils/haptics';

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
}: FeedListProps, ref) {
  const { isOnline } = useNetwork();
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
      return <LoadingState />;
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

  const handleRefresh = () => {
    triggerHaptic("selection");
    onRefresh?.();
  };

  return (
    <FlatList
      ref={ref}
      data={posts}
      renderItem={renderItem}
      keyExtractor={(item, index) => item.post.uri + index}
      ListEmptyComponent={renderEmpty}
      ListFooterComponent={renderFooter}
      onEndReached={onLoadMore}
      onEndReachedThreshold={0.5}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={isOnline ? colors.primary : "#6b7280"}
            colors={[isOnline ? colors.primary : "#6b7280"]}
            enabled={isOnline}
          />
        ) : undefined
      }
      removeClippedSubviews={true}
      maxToRenderPerBatch={10}
      windowSize={10}
      initialNumToRender={10}
      style={styles.list}
    />
  );
});

const styles = StyleSheet.create({
  list: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  footer: {
    padding: 20,
    alignItems: 'center',
  },
});
