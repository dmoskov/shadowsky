/**
 * Native Feed List View Component
 *
 * React Native wrapper for the native SwiftUI FeedListView
 */

import React, { useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { requireNativeViewManager, NativeModulesProxy } from 'expo-modules-core';
import { ViewProps, Platform, View } from 'react-native';
import { useCompleteFeedSerializer } from '../../../src/services/feed-bridge';
import { UseInfiniteQueryResult, InfiniteData } from '@tanstack/react-query';
import { AppBskyFeedDefs } from '@atproto/api';

// Lazy-load native modules (only available on iOS)
let FeedBridge: any = null;
let NativeFeedListNative: any = null;

if (Platform.OS === 'ios') {
  FeedBridge = require('../../feed-bridge').default;
  NativeFeedListNative = requireNativeViewManager('NativeFeedList');
}

// Event types
export interface FeedListEvents {
  onRefresh?: () => void;
  onLoadMore?: () => void;
  onPostPress?: (event: { nativeEvent: { uri: string; handle: string } }) => void;
  onProfilePress?: (event: { nativeEvent: { handle: string } }) => void;
  onLike?: (event: { nativeEvent: { uri: string; cid: string; likeUri?: string } }) => void;
  onRepost?: (event: { nativeEvent: { uri: string; cid: string; repostUri?: string } }) => void;
  onReply?: (event: { nativeEvent: { uri: string; cid: string; handle: string } }) => void;
  onBookmark?: (event: { nativeEvent: { uri: string } }) => void;
  onMentionPress?: (event: { nativeEvent: { handle: string; did: string } }) => void;
  onHashtagPress?: (event: { nativeEvent: { tag: string } }) => void;
  onShare?: (event: { nativeEvent: { uri: string } }) => void;
}

// Props type
export interface NativeFeedListProps extends ViewProps, FeedListEvents {
  isLoading?: boolean;
  isRefreshing?: boolean;
  isLoadingMore?: boolean;
  error?: string | null;
  emptyMessage?: string;
}

// Feed query type (matching useTimeline/useCustomFeed)
type FeedPage = { feed: AppBskyFeedDefs.FeedViewPost[]; cursor?: string };
export type FeedQuery = UseInfiniteQueryResult<InfiniteData<FeedPage>, Error>;

// Full props including the query
export interface NativeFeedListWithDataProps extends Omit<NativeFeedListProps, 'isLoading' | 'isRefreshing' | 'isLoadingMore' | 'error'> {
  query: FeedQuery;
  bookmarkedPostUris?: Set<string>;
  isOnline?: boolean;
}

/**
 * Low-level Native Feed List component
 * Renders the native SwiftUI view with provided props
 */
export const NativeFeedListView = forwardRef<any, NativeFeedListProps>((props, ref) => {
  const {
    isLoading = false,
    isRefreshing = false,
    isLoadingMore = false,
    error = null,
    emptyMessage = 'No posts yet',
    onRefresh,
    onLoadMore,
    onPostPress,
    onProfilePress,
    onLike,
    onRepost,
    onReply,
    onBookmark,
    onMentionPress,
    onHashtagPress,
    onShare,
    ...viewProps
  } = props;

  // iOS only - native view not available on other platforms
  if (Platform.OS !== 'ios' || !NativeFeedListNative) {
    return <View {...viewProps} />;
  }

  return (
    <NativeFeedListNative
      {...viewProps}
      isLoading={isLoading}
      isRefreshing={isRefreshing}
      isLoadingMore={isLoadingMore}
      error={error}
      emptyMessage={emptyMessage}
      onRefresh={onRefresh}
      onLoadMore={onLoadMore}
      onPostPress={onPostPress}
      onProfilePress={onProfilePress}
      onLike={onLike}
      onRepost={onRepost}
      onReply={onReply}
      onBookmark={onBookmark}
      onMentionPress={onMentionPress}
      onHashtagPress={onHashtagPress}
      onShare={onShare}
    />
  );
});

NativeFeedListView.displayName = 'NativeFeedListView';

/**
 * High-level Native Feed List component with automatic data bridge
 * Automatically serializes feed data and passes it to Swift via FeedBridge
 */
export const NativeFeedList = forwardRef<any, NativeFeedListWithDataProps>((props, ref) => {
  const {
    query,
    bookmarkedPostUris,
    isOnline = true,
    emptyMessage = 'No posts yet',
    onRefresh,
    onLoadMore,
    ...eventHandlers
  } = props;

  const { data, isLoading, isRefetching, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = query;

  // Serialize feed data for Swift
  const { serializedJSON } = useCompleteFeedSerializer(query, {
    isOnline,
    bookmarkedPostUris,
    onIncrementalUpdate: useCallback((update: unknown) => {
      if (isOnline && FeedBridge) {
        const json = JSON.stringify(update);
        FeedBridge.updateFeedIncremental(json);
      }
    }, [isOnline]),
  });

  // Update feed data in Swift whenever it changes
  useEffect(() => {
    if (serializedJSON && FeedBridge) {
      FeedBridge.updateFeedData(serializedJSON);
    }
  }, [serializedJSON]);

  // Clear feed data on unmount
  useEffect(() => {
    return () => {
      if (FeedBridge) {
        FeedBridge.clearFeedData();
      }
    };
  }, []);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    refetch();
    onRefresh?.();
  }, [refetch, onRefresh]);

  // Handle load more
  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
    onLoadMore?.();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, onLoadMore]);

  // Expose imperative handle for scroll-to-top
  useImperativeHandle(ref, () => ({
    scrollToTop: () => {
      // SwiftUI ScrollView will handle this automatically with scroll-to-top gesture
      // Or we can add a native method if needed
    },
  }));

  return (
    <NativeFeedListView
      {...eventHandlers}
      isLoading={isLoading}
      isRefreshing={isRefetching}
      isLoadingMore={isFetchingNextPage}
      error={error?.message || null}
      emptyMessage={emptyMessage}
      onRefresh={handleRefresh}
      onLoadMore={handleLoadMore}
      style={{ flex: 1 }}
    />
  );
});

NativeFeedList.displayName = 'NativeFeedList';

export default NativeFeedList;
