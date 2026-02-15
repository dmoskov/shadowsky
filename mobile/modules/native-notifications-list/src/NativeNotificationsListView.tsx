/**
 * Native Notifications List View Component
 *
 * React Native wrapper for the native SwiftUI NotificationListView
 */

import React, { useEffect, useCallback, forwardRef, useImperativeHandle, useMemo } from 'react';
import { requireNativeViewManager } from 'expo-modules-core';
import { ViewProps, Platform } from 'react-native';
import NotificationBridge from '../../notification-bridge';
import { useCompleteNotificationSerializer } from '../../../src/services/notification-bridge';
import { UseInfiniteQueryResult, InfiniteData } from '@tanstack/react-query';
import { AppBskyNotificationListNotifications } from '@atproto/api';
import { aggregateNotifications, filterNotificationsByType } from '../../../src/utils/notification-aggregator';
import { usePreferences } from '../../../src/contexts/PreferencesContext';
import { filterMutedNotifications } from '../../../src/utils/content-filter';

// Native view manager
const NativeNotificationsListNative = requireNativeViewManager('NativeNotificationsList');

// Event types
export interface NotificationListEvents {
  onRefresh?: () => void;
  onLoadMore?: () => void;
  onNotificationPress?: (event: { nativeEvent: { uri: string } }) => void;
  onProfilePress?: (event: { nativeEvent: { handle: string } }) => void;
  onPostPress?: (event: { nativeEvent: { uri: string } }) => void;
  onMentionPress?: (event: { nativeEvent: { handle: string; did: string } }) => void;
  onHashtagPress?: (event: { nativeEvent: { tag: string } }) => void;
}

// Props type
export interface NativeNotificationsListProps extends ViewProps, NotificationListEvents {
  isLoading?: boolean;
  isRefreshing?: boolean;
  isLoadingMore?: boolean;
  error?: string | null;
  emptyMessage?: string;
}

// Notification query type (matching useNotifications)
type NotificationPage = {
  notifications: AppBskyNotificationListNotifications.Notification[];
  cursor?: string;
};
export type NotificationQuery = UseInfiniteQueryResult<InfiniteData<NotificationPage>, Error>;

// Full props including the query
export interface NativeNotificationsListWithDataProps extends Omit<NativeNotificationsListProps, 'isLoading' | 'isRefreshing' | 'isLoadingMore' | 'error'> {
  query: NotificationQuery;
  activeFilter?: 'all' | 'likes' | 'replies' | 'follows' | 'mentions' | 'quotes';
  isOnline?: boolean;
}

/**
 * Low-level Native Notifications List component
 * Renders the native SwiftUI view with provided props
 */
export const NativeNotificationsListView = forwardRef<any, NativeNotificationsListProps>((props, _ref) => {
  const {
    isLoading = false,
    isRefreshing = false,
    isLoadingMore = false,
    error = null,
    emptyMessage = 'No notifications yet',
    onRefresh,
    onLoadMore,
    onNotificationPress,
    onProfilePress,
    onPostPress,
    onMentionPress,
    onHashtagPress,
    ...viewProps
  } = props;

  // iOS only - on Android, this would render a fallback
  if (Platform.OS !== 'ios') {
    return null;
  }

  return (
    <NativeNotificationsListNative
      {...viewProps}
      isLoading={isLoading}
      isRefreshing={isRefreshing}
      isLoadingMore={isLoadingMore}
      error={error}
      emptyMessage={emptyMessage}
      onRefresh={onRefresh}
      onLoadMore={onLoadMore}
      onNotificationPress={onNotificationPress}
      onProfilePress={onProfilePress}
      onPostPress={onPostPress}
      onMentionPress={onMentionPress}
      onHashtagPress={onHashtagPress}
    />
  );
});

NativeNotificationsListView.displayName = 'NativeNotificationsListView';

/**
 * High-level Native Notifications List component with automatic data bridge
 * Automatically serializes notification data and passes it to Swift via NotificationBridge
 */
export const NativeNotificationsList = forwardRef<any, NativeNotificationsListWithDataProps>((props, ref) => {
  const {
    query,
    activeFilter = 'all',
    isOnline = true,
    emptyMessage = 'No notifications yet',
    onRefresh,
    onLoadMore,
    ...eventHandlers
  } = props;

  const { preferences } = usePreferences();
  const { data, isLoading, isRefetching, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = query;

  // Flatten all pages of notifications and filter by muted words
  const allNotifications = useMemo(() => {
    return data?.pages?.flatMap(page => page.notifications) || [];
  }, [data?.pages]);

  const notifications = useMemo(() => {
    if (!preferences?.mutedWords || preferences.mutedWords.length === 0) {
      return allNotifications;
    }
    return filterMutedNotifications(allNotifications, preferences.mutedWords);
  }, [allNotifications, preferences?.mutedWords]);

  // Filter notifications based on active filter
  const filteredNotifications = useMemo(() => {
    return filterNotificationsByType(notifications, activeFilter);
  }, [notifications, activeFilter]);

  // Aggregate notifications
  const processedNotifications = useMemo(() => {
    return aggregateNotifications(filteredNotifications);
  }, [filteredNotifications]);

  // Get cursor from last page
  const cursor = useMemo(() => {
    return data?.pages?.[data.pages.length - 1]?.cursor;
  }, [data?.pages]);

  // Serialize notification data for Swift
  const { serializedJSON } = useCompleteNotificationSerializer(
    processedNotifications,
    cursor,
    { isOnline }
  );

  // Update notification data in Swift whenever it changes
  useEffect(() => {
    if (serializedJSON) {
      NotificationBridge.updateNotificationData(serializedJSON);
    }
  }, [serializedJSON]);

  // Clear notification data on unmount
  useEffect(() => {
    return () => {
      NotificationBridge.clearNotificationData();
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
    <NativeNotificationsListView
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

NativeNotificationsList.displayName = 'NativeNotificationsList';

export default NativeNotificationsList;
