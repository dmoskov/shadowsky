/**
 * Native Feed List View Component
 *
 * React Native wrapper for the native SwiftUI FeedListView
 */

import React, { useEffect, useCallback, forwardRef, useImperativeHandle, useState } from 'react';
import { requireNativeViewManager } from 'expo-modules-core';
import { ViewProps, Platform, View } from 'react-native';
import { useCompleteFeedSerializer } from '../../../src/services/feed-bridge';
import { UseInfiniteQueryResult, InfiniteData } from '@tanstack/react-query';
import { AppBskyFeedDefs } from '@atproto/api';

const FLEX_STYLE = { flex: 1 } as const;

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
  onImagePress?: (event: { nativeEvent: { images: Array<{ thumb: string; fullsize: string; alt: string }>; index: number } }) => void;
  onLinkPress?: (event: { nativeEvent: { uri: string } }) => void;
  onQuotePress?: (event: { nativeEvent: { uri: string; handle: string } }) => void;
  onScroll?: (event: { nativeEvent: { y: number } }) => void;
}

// Props type
export interface NativeFeedListProps extends ViewProps, FeedListEvents {
  isLoading?: boolean;
  isRefreshing?: boolean;
  isLoadingMore?: boolean;
  error?: string | null;
  emptyMessage?: string;
  scrollToTopTrigger?: number;
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
export const NativeFeedListView = forwardRef<any, NativeFeedListProps>((props, _ref) => {
  const {
    isLoading = false,
    isRefreshing = false,
    isLoadingMore = false,
    error = null,
    emptyMessage = 'No posts yet',
    scrollToTopTrigger = 0,
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
    onImagePress,
    onLinkPress,
    onQuotePress,
    onScroll,
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
      scrollToTopTrigger={scrollToTopTrigger}
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
      onImagePress={onImagePress}
      onLinkPress={onLinkPress}
      onQuotePress={onQuotePress}
      onScroll={onScroll}
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

  const { isLoading, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = query;
  const [bridgeError, setBridgeError] = useState<string | null>(null);
  const [isUserRefreshing, setIsUserRefreshing] = useState(false);
  const [scrollToTopTrigger, setScrollToTopTrigger] = useState(0);

  // Clear stale feed data from the native bridge when switching to a new uncached feed.
  // Without this, the old feed's posts remain visible with no loading indicator.
  useEffect(() => {
    if (isLoading && FeedBridge) {
      FeedBridge.clearFeedData();
    }
  }, [isLoading]);

  // Serialize feed data for Swift
  const { serializedJSON } = useCompleteFeedSerializer(query, {
    isOnline,
    bookmarkedPostUris,
    onIncrementalUpdate: useCallback((update: unknown) => {
      if (isOnline && FeedBridge) {
        try {
          const json = JSON.stringify(update);
          FeedBridge.updateFeedIncremental(json);
        } catch (e: any) {
          console.warn('[NativeFeedList] Failed to send incremental update:', e?.message);
          setBridgeError(e?.message || 'Failed to update feed');
        }
      }
    }, [isOnline]),
  });

  // Update feed data in Swift whenever it changes
  useEffect(() => {
    if (serializedJSON && FeedBridge) {
      try {
        FeedBridge.updateFeedData(serializedJSON);
        setBridgeError(null); // Clear on successful send
      } catch (e: any) {
        console.warn('[NativeFeedList] Failed to send feed data:', e?.message);
        setBridgeError(e?.message || 'Failed to load feed data');
      }
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

  // Handle refresh — only user-initiated pull-to-refresh sets isUserRefreshing
  const handleRefresh = useCallback(() => {
    setIsUserRefreshing(true);
    refetch().finally(() => setIsUserRefreshing(false));
    onRefresh?.();
  }, [refetch, onRefresh]);

  // Handle load more
  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
    onLoadMore?.();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, onLoadMore]);

  // Expose imperative handle for scroll-to-top and programmatic refresh
  useImperativeHandle(ref, () => ({
    scrollToTop: () => {
      setScrollToTopTrigger(prev => prev + 1);
    },
    refresh: () => {
      setIsUserRefreshing(true);
      refetch().finally(() => setIsUserRefreshing(false));
    },
  }));

  return (
    <NativeFeedListView
      {...eventHandlers}
      isLoading={isLoading}
      isRefreshing={isUserRefreshing}
      isLoadingMore={isFetchingNextPage}
      error={error?.message || bridgeError || null}
      emptyMessage={emptyMessage}
      scrollToTopTrigger={scrollToTopTrigger}
      onRefresh={handleRefresh}
      onLoadMore={handleLoadMore}
      style={FLEX_STYLE}
    />
  );
});

NativeFeedList.displayName = 'NativeFeedList';

export default NativeFeedList;
