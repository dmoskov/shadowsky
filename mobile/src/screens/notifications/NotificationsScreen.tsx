import React, {useCallback, useRef, useMemo, useState} from 'react';
import {
  FlatList,
  ActivityIndicator,
  View,
  Text,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useFocusEffect, useScrollToTop} from '@react-navigation/native';
import {useRouter} from 'expo-router';
import {
  useNotifications,
  useMarkNotificationsSeen,
} from '../../hooks/api/useNotifications';
import {NotificationItem} from '../../components/NotificationItem';
import {NotificationItemSkeleton} from '../../components/NotificationItemSkeleton';
import {AggregatedNotificationItem} from '../../components/AggregatedNotificationItem';
import {NotificationTabBar, NotificationFilter} from '../../components/NotificationTabBar';
import {ErrorState} from '../../components/ErrorState';
import { EmptyState } from '../../components/EmptyState';
import {useAppNavigation} from '../../hooks/useNavigation';
import {AppBskyNotificationListNotifications} from '@atproto/api';
import {usePreferences} from '../../contexts/PreferencesContext';
import {clearBadgeCount} from '../../utils/badge';
import {useTheme} from '../../contexts/ThemeContext';
import {filterMutedNotifications} from '../../utils/content-filter';
import {
  aggregateNotifications,
  filterNotificationsByType,
  countNotificationsByType,
  ProcessedNotification,
} from '../../utils/notification-aggregator';

function getPostIdFromUri(uri: string): string {
  const parts = uri.split('/');
  return parts[parts.length - 1];
}

function getHandleFromUri(uri: string): string {
  // AT URI format: at://did:plc:xxx/app.bsky.feed.post/rkey
  const parts = uri.split('/');
  return parts[2] || '';
}

export function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {preferences} = usePreferences();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useNotifications();

  const markNotificationsSeen = useMarkNotificationsSeen();
  const {navigateToProfile, navigateToThread} = useAppNavigation();
  const scrollRef = useRef<FlatList>(null);

  // Filter state
  const [activeFilter, setActiveFilter] = useState<NotificationFilter>('all');

  // Enable scroll-to-top on tab press
  useScrollToTop(scrollRef);

  // Mark notifications as seen when screen is focused
  useFocusEffect(
    useCallback(() => {
      // Mark notifications as seen when user navigates to this screen
      if (data?.pages?.[0]?.notifications?.length) {
        markNotificationsSeen.mutate(new Date().toISOString());
      }
      // Clear badge count when viewing notifications
      clearBadgeCount();
    }, [data?.pages, markNotificationsSeen]),
  );

  // Flatten all pages of notifications and filter by muted words
  const notifications = useMemo(() => {
    const allNotifications = data?.pages?.flatMap(page => page.notifications) || [];
    if (!preferences?.mutedWords || preferences.mutedWords.length === 0) {
      return allNotifications;
    }
    return filterMutedNotifications(allNotifications, preferences.mutedWords);
  }, [data?.pages, preferences?.mutedWords]);

  // Count notifications by type
  const notificationCounts = useMemo(() => {
    return countNotificationsByType(notifications);
  }, [notifications]);

  // Filter notifications based on active filter
  const filteredNotifications = useMemo(() => {
    return filterNotificationsByType(notifications, activeFilter);
  }, [notifications, activeFilter]);

  // Aggregate notifications
  const processedNotifications = useMemo(() => {
    return aggregateNotifications(filteredNotifications);
  }, [filteredNotifications]);

  const renderFooter = useCallback(() => {
    if (!isFetchingNextPage) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }, [isFetchingNextPage, styles.footer, colors.primary]);

  const renderEmpty = useCallback(() => {
    if (isLoading) {
      return (
        <View>
          <NotificationItemSkeleton />
          <NotificationItemSkeleton />
          <NotificationItemSkeleton />
          <NotificationItemSkeleton />
          <NotificationItemSkeleton />
          <NotificationItemSkeleton />
        </View>
      );
    }
    if (isError) {
      return (
        <ErrorState
          message={error?.message || 'Failed to load notifications'}
          onRetry={() => refetch()}
        />
      );
    }
    return <EmptyState message="No notifications yet" />;
  }, [isLoading, isError, error?.message, refetch]);

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  const handleRefresh = useCallback(() => {
    setIsManualRefreshing(true);
    refetch().finally(() => setIsManualRefreshing(false));
  }, [refetch]);

  const handleMentionPress = useCallback(
    (handle: string, _did: string) => {
      navigateToProfile(handle);
    },
    [navigateToProfile],
  );

  const handleHashtagPress = useCallback(
    (tag: string) => {
      router.push({pathname: '/(tabs)/(search)', params: {q: '#' + tag}} as any);
    },
    [router],
  );

  const handleNotificationPress = useCallback(
    (notification: AppBskyNotificationListNotifications.Notification) => {
      const reason = notification.reason;

      if (reason === 'follow') {
        navigateToProfile(notification.author.handle);
        return;
      }

      // For like/repost, navigate to the target post (reasonSubject)
      if ((reason === 'like' || reason === 'repost') && notification.reasonSubject) {
        const postId = getPostIdFromUri(notification.reasonSubject);
        const handle = getHandleFromUri(notification.reasonSubject);
        navigateToThread(handle, postId);
        return;
      }

      // For reply/mention/quote, navigate to the notification post itself
      if (reason === 'reply' || reason === 'mention' || reason === 'quote') {
        const postId = getPostIdFromUri(notification.uri);
        navigateToThread(notification.author.handle, postId);
        return;
      }

      // Fallback: navigate to author profile
      navigateToProfile(notification.author.handle);
    },
    [navigateToProfile, navigateToThread],
  );

  const handleFilterChange = useCallback((filter: NotificationFilter) => {
    setActiveFilter(filter);
    // Scroll to top when filter changes
    scrollRef.current?.scrollToOffset({offset: 0, animated: true});
  }, []);

  const renderItem = useCallback(
    ({item}: {item: ProcessedNotification}) => {
      if (item.type === 'aggregated') {
        return (
          <AggregatedNotificationItem
            notifications={item.notifications}
            reason={item.reason}
            onPress={() => {
              const notif = item.notifications[0];
              if (notif) {
                handleNotificationPress(notif);
              }
            }}
            onMentionPress={handleMentionPress}
            onHashtagPress={handleHashtagPress}
          />
        );
      }
      return (
        <NotificationItem
          notification={item.notification}
          onPress={() => handleNotificationPress(item.notification)}
          onMentionPress={handleMentionPress}
          onHashtagPress={handleHashtagPress}
        />
      );
    },
    [handleMentionPress, handleHashtagPress, handleNotificationPress],
  );

  const getItemKey = useCallback((item: ProcessedNotification) => {
    if (item.type === 'aggregated') {
      // Use targetPostUri or first notification URI to disambiguate groups with the same reason
      const targetKey = item.targetPostUri || item.notifications[0]?.uri || '';
      return `agg-${item.reason}-${targetKey}`;
    }
    return item.notification.uri;
  }, []);

  return (
    <View style={[styles.container, {paddingTop: insets.top}]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notifications</Text>
      </View>
      <NotificationTabBar
        activeFilter={activeFilter}
        onFilterChange={handleFilterChange}
        counts={notificationCounts as any}
      />
      <FlatList
        ref={scrollRef}
        data={processedNotifications}
        renderItem={renderItem}
        keyExtractor={getItemKey}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={isManualRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        windowSize={10}
        initialNumToRender={10}
        updateCellsBatchingPeriod={50}
        style={styles.list}
      />
    </View>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
    },
    list: {
      flex: 1,
    },
    footer: {
      padding: 20,
      alignItems: 'center',
    },
  });
}
