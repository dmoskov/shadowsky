/**
 * Native Notifications List View Component
 *
 * React Native wrapper for the native SwiftUI NotificationListView.
 * Follows the same pattern as NativeFeedListView.tsx.
 */

import React, { useEffect, useCallback, useMemo, forwardRef, useImperativeHandle, useState } from 'react';
import { requireNativeViewManager } from 'expo-modules-core';
import { ViewProps, Platform, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  useNotifications,
  useMarkNotificationsSeen,
} from '../../../src/hooks/api/useNotifications';
import { useCompleteNotificationSerializer } from '../../../src/services/notification-bridge';
import { usePreferences } from '../../../src/contexts/PreferencesContext';
import { useAppNavigation } from '../../../src/hooks/useNavigation';
import { useOfflineNotificationsEnhancer } from '../../../src/hooks/useOfflineFeed';
import { useNotificationPosts } from '../../../src/hooks/api/useNotificationPosts';
import { aggregateNotifications } from '../../../src/utils/notification-aggregator';
import { filterMutedNotifications } from '../../../src/utils/content-filter';
import { clearBadgeCount } from '../../../src/utils/badge';
import { useRouter } from 'expo-router';
import { openLink } from '../../../src/utils/browser';

// Lazy-load native modules (only available on iOS)
let NotificationBridge: any = null;
let NativeNotificationsListNative: any = null;

if (Platform.OS === 'ios') {
  NotificationBridge = require('../../notification-bridge').default;
  NativeNotificationsListNative = requireNativeViewManager('NativeNotificationsList');
}

// MARK: - Event Types

export interface NotificationListEvents {
  onRefresh?: () => void;
  onLoadMore?: () => void;
  onNotificationPress?: (event: {
    nativeEvent: { reason: string; uri: string; handle: string; reasonSubject?: string };
  }) => void;
  onProfilePress?: (event: { nativeEvent: { handle: string } }) => void;
  onMentionPress?: (event: { nativeEvent: { handle: string; did: string } }) => void;
  onHashtagPress?: (event: { nativeEvent: { tag: string } }) => void;
  onLinkPress?: (event: { nativeEvent: { uri: string } }) => void;
  onAppear?: () => void;
  onAnalyticsPress?: () => void;
}

// MARK: - Props Types

export interface NativeNotificationsListProps extends ViewProps, NotificationListEvents {
  isLoading?: boolean;
  isRefreshing?: boolean;
  isLoadingMore?: boolean;
  error?: string | null;
  isOnline?: boolean;
}

// MARK: - Low-level Native View

export const NativeNotificationsListView = forwardRef<any, NativeNotificationsListProps>(
  (props, _ref) => {
    const {
      isLoading = false,
      isRefreshing = false,
      isLoadingMore = false,
      error = null,
      isOnline = true,
      onRefresh,
      onLoadMore,
      onNotificationPress,
      onProfilePress,
      onMentionPress,
      onHashtagPress,
      onLinkPress,
      onAppear,
      onAnalyticsPress,
      ...viewProps
    } = props;

    if (Platform.OS !== 'ios' || !NativeNotificationsListNative) {
      return <View {...viewProps} />;
    }

    return (
      <NativeNotificationsListNative
        {...viewProps}
        isLoading={isLoading}
        isRefreshing={isRefreshing}
        isLoadingMore={isLoadingMore}
        error={error}
        isOnline={isOnline}
        onRefresh={onRefresh}
        onLoadMore={onLoadMore}
        onNotificationPress={onNotificationPress}
        onProfilePress={onProfilePress}
        onMentionPress={onMentionPress}
        onHashtagPress={onHashtagPress}
        onLinkPress={onLinkPress}
        onAppear={onAppear}
        onAnalyticsPress={onAnalyticsPress}
      />
    );
  },
);

NativeNotificationsListView.displayName = 'NativeNotificationsListView';

// MARK: - Utility Functions

function getPostIdFromUri(uri: string): string {
  const parts = uri.split('/');
  return parts[parts.length - 1];
}

function getHandleFromUri(uri: string): string {
  const parts = uri.split('/');
  return parts[2] || '';
}

// MARK: - High-level Component with Data Bridge

export const NativeNotificationsList = forwardRef<any, ViewProps>((props, ref) => {
  const router = useRouter();
  const { preferences } = usePreferences();
  const notificationsQuery = useNotifications();
  const enhancedNotificationsQuery = useOfflineNotificationsEnhancer(notificationsQuery, [
    'notifications',
  ]);
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = enhancedNotificationsQuery;
  const { isOnline: isNotifOnline } = enhancedNotificationsQuery;

  const markNotificationsSeen = useMarkNotificationsSeen();
  const { navigateToProfile, navigateToThread } = useAppNavigation();
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  // Flatten all pages of notifications and filter by muted words
  const notifications = useMemo(() => {
    const allNotifications = data?.pages?.flatMap((page) => page.notifications) || [];
    if (!preferences?.mutedWords || preferences.mutedWords.length === 0) {
      return allNotifications;
    }
    return filterMutedNotifications(allNotifications, preferences.mutedWords);
  }, [data?.pages, preferences?.mutedWords]);

  // Aggregate notifications
  const processedNotifications = useMemo(() => {
    return aggregateNotifications(notifications);
  }, [notifications]);

  // Fetch post data for rich notification previews (images, videos, links)
  const { postMap } = useNotificationPosts(notifications);

  // Get cursor for pagination
  const cursor = useMemo(() => {
    const pages = data?.pages;
    return pages?.[pages.length - 1]?.cursor;
  }, [data?.pages]);

  // Serialize for Swift (including post preview data)
  const { serializedJSON } = useCompleteNotificationSerializer(processedNotifications, cursor, {
    isOnline: isNotifOnline,
    postMap,
  });

  // Bridge error state
  const [bridgeError, setBridgeError] = useState<string | null>(null);

  // Push serialized data to Swift via NotificationBridge
  useEffect(() => {
    if (serializedJSON && NotificationBridge) {
      try {
        NotificationBridge.updateNotificationData(serializedJSON);
        setBridgeError(null); // Clear on successful send
      } catch (e: any) {
        console.warn('[NativeNotificationsList] Failed to send notification data:', e?.message);
        setBridgeError(e?.message || 'Failed to load notification data');
      }
    }
  }, [serializedJSON]);

  // Clear data on unmount
  useEffect(() => {
    return () => {
      if (NotificationBridge) {
        NotificationBridge.clearNotificationData();
      }
    };
  }, []);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    setIsManualRefreshing(true);
    refetch().finally(() => setIsManualRefreshing(false));
  }, [refetch]);

  // Handle load more
  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Mark notifications as seen when the tab is focused (handles tab switches)
  useFocusEffect(
    useCallback(() => {
      if (data?.pages?.[0]?.notifications?.length) {
        markNotificationsSeen.mutate(new Date().toISOString());
      }
      clearBadgeCount();
    }, [data?.pages]),
  );

  // Handle mark as seen on SwiftUI view appear (initial render)
  const handleAppear = useCallback(() => {
    if (data?.pages?.[0]?.notifications?.length) {
      markNotificationsSeen.mutate(new Date().toISOString());
    }
    clearBadgeCount();
  }, [data?.pages, markNotificationsSeen]);

  // Handle notification press - navigation logic from NotificationsScreen.tsx
  const handleNotificationPress = useCallback(
    (event: {
      nativeEvent: { reason: string; uri: string; handle: string; reasonSubject?: string };
    }) => {
      const { reason, uri, handle, reasonSubject } = event.nativeEvent;

      if (reason === 'follow' || reason === 'starterpack-joined') {
        navigateToProfile(handle);
        return;
      }

      if (
        (reason === 'like' ||
          reason === 'repost' ||
          reason === 'like-via-repost' ||
          reason === 'repost-via-repost') &&
        reasonSubject
      ) {
        const postId = getPostIdFromUri(reasonSubject);
        const did = getHandleFromUri(reasonSubject);
        navigateToThread(handle, postId, did || undefined);
        return;
      }

      if (reason === 'reply' || reason === 'mention' || reason === 'quote') {
        const postId = getPostIdFromUri(uri);
        const did = getHandleFromUri(uri);
        navigateToThread(handle, postId, did || undefined);
        return;
      }

      // Fallback
      navigateToProfile(handle);
    },
    [navigateToProfile, navigateToThread],
  );

  // Handle profile press
  const handleProfilePress = useCallback(
    (event: { nativeEvent: { handle: string } }) => {
      navigateToProfile(event.nativeEvent.handle);
    },
    [navigateToProfile],
  );

  // Handle mention press
  const handleMentionPress = useCallback(
    (event: { nativeEvent: { handle: string; did: string } }) => {
      navigateToProfile(event.nativeEvent.handle);
    },
    [navigateToProfile],
  );

  // Handle hashtag press
  const handleHashtagPress = useCallback(
    (event: { nativeEvent: { tag: string } }) => {
      router.push({
        pathname: '/(tabs)/(search)',
        params: { q: '#' + event.nativeEvent.tag },
      } as any);
    },
    [router],
  );

  // Handle link press
  const handleLinkPress = useCallback(
    (event: { nativeEvent: { uri: string } }) => {
      openLink(event.nativeEvent.uri).catch(() => {});
    },
    [],
  );

  // Handle analytics press - navigate to the JS analytics screen
  const handleAnalyticsPress = useCallback(() => {
    router.push('/(app)/analytics' as any);
  }, [router]);

  // Expose scroll-to-top
  useImperativeHandle(ref, () => ({
    scrollToTop: () => {
      // SwiftUI handles scroll-to-top natively
    },
  }));

  return (
    <NativeNotificationsListView
      {...props}
      isLoading={isLoading}
      isRefreshing={isManualRefreshing}
      isLoadingMore={isFetchingNextPage}
      error={isError ? error?.message || 'Failed to load notifications' : bridgeError}
      isOnline={isNotifOnline}
      onRefresh={handleRefresh}
      onLoadMore={handleLoadMore}
      onNotificationPress={handleNotificationPress}
      onProfilePress={handleProfilePress}
      onMentionPress={handleMentionPress}
      onHashtagPress={handleHashtagPress}
      onLinkPress={handleLinkPress}
      onAppear={handleAppear}
      onAnalyticsPress={handleAnalyticsPress}
      style={{ flex: 1 }}
    />
  );
});

NativeNotificationsList.displayName = 'NativeNotificationsList';

export default NativeNotificationsList;
