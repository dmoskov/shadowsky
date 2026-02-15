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
import {EmptyState} from '../../components/EmptyState';
import {useAppNavigation} from '../../hooks/useNavigation';
import {usePreferences} from '../../contexts/PreferencesContext';
import {clearBadgeCount} from '../../services/notification-poller';
import {colors} from '../../constants/theme';
import {filterMutedNotifications} from '../../utils/content-filter';
import {
  aggregateNotifications,
  filterNotificationsByType,
  countNotificationsByType,
  ProcessedNotification,
} from '../../utils/notification-aggregator';

export function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {preferences} = usePreferences();
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isRefetching,
  } = useNotifications();

  const markNotificationsSeen = useMarkNotificationsSeen();
  const {navigateToProfile} = useAppNavigation();
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
  const allNotifications = data?.pages?.flatMap(page => page.notifications) || [];
  const notifications = useMemo(() => {
    if (!preferences?.mutedWords || preferences.mutedWords.length === 0) {
      return allNotifications;
    }
    return filterMutedNotifications(allNotifications, preferences.mutedWords);
  }, [allNotifications, preferences?.mutedWords]);

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

  const renderFooter = () => {
    if (!isFetchingNextPage) return null;
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
  };

  const handleLoadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  const handleRefresh = () => {
    refetch();
  };

  const handleMentionPress = useCallback(
    (handle: string, did: string) => {
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
            onMentionPress={handleMentionPress}
            onHashtagPress={handleHashtagPress}
          />
        );
      }
      return (
        <NotificationItem
          notification={item.notification}
          onMentionPress={handleMentionPress}
          onHashtagPress={handleHashtagPress}
        />
      );
    },
    [handleMentionPress, handleHashtagPress],
  );

  const getItemKey = useCallback((item: ProcessedNotification, index: number) => {
    if (item.type === 'aggregated') {
      return `aggregated-${item.reason}-${item.latestTimestamp}-${index}`;
    }
    return item.notification.uri + index;
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
            refreshing={isRefetching}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        windowSize={10}
        initialNumToRender={10}
        style={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
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
