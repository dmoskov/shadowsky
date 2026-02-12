import React, {useCallback, useRef} from 'react';
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
import {AppBskyNotificationListNotifications} from '@atproto/api';
import {
  useNotifications,
  useMarkNotificationsSeen,
} from '../../hooks/api/useNotifications';
import {NotificationItem} from '../../components/NotificationItem';
import {LoadingState} from '../../components/LoadingState';
import {ErrorState} from '../../components/ErrorState';
import {EmptyState} from '../../components/EmptyState';
import {useAppNavigation} from '../../hooks/useNavigation';
import {clearBadgeCount} from '../../services/notification-poller';
import {colors} from '../../constants/theme';

export function NotificationsScreen() {
  const insets = useSafeAreaInsets();
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

  // Flatten all pages of notifications
  const notifications = data?.pages?.flatMap(page => page.notifications) || [];

  // Group notifications by type for display
  const groupedNotifications = React.useMemo(() => {
    const groups: {
      [key: string]: AppBskyNotificationListNotifications.Notification[];
    } = {
      follows: [],
      likes: [],
      reposts: [],
      mentions: [],
      replies: [],
      quotes: [],
      other: [],
    };

    notifications.forEach(notification => {
      switch (notification.reason) {
        case 'follow':
          groups.follows.push(notification);
          break;
        case 'like':
          groups.likes.push(notification);
          break;
        case 'repost':
          groups.reposts.push(notification);
          break;
        case 'mention':
          groups.mentions.push(notification);
          break;
        case 'reply':
          groups.replies.push(notification);
          break;
        case 'quote':
          groups.quotes.push(notification);
          break;
        default:
          groups.other.push(notification);
      }
    });

    return groups;
  }, [notifications]);

  // Create sections for rendering (ordered by priority)
  const sections = React.useMemo(() => {
    const result: Array<{
      title: string;
      data: AppBskyNotificationListNotifications.Notification[];
    }> = [];

    // Order by importance: replies, mentions, follows, likes, reposts, quotes, other
    if (groupedNotifications.replies.length > 0) {
      result.push({title: 'Replies', data: groupedNotifications.replies});
    }
    if (groupedNotifications.mentions.length > 0) {
      result.push({title: 'Mentions', data: groupedNotifications.mentions});
    }
    if (groupedNotifications.follows.length > 0) {
      result.push({title: 'New Followers', data: groupedNotifications.follows});
    }
    if (groupedNotifications.likes.length > 0) {
      result.push({title: 'Likes', data: groupedNotifications.likes});
    }
    if (groupedNotifications.reposts.length > 0) {
      result.push({title: 'Reposts', data: groupedNotifications.reposts});
    }
    if (groupedNotifications.quotes.length > 0) {
      result.push({title: 'Quotes', data: groupedNotifications.quotes});
    }
    if (groupedNotifications.other.length > 0) {
      result.push({title: 'Other', data: groupedNotifications.other});
    }

    return result;
  }, [groupedNotifications]);

  const renderSectionHeader = useCallback(
    (title: string) => (
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
    ),
    [],
  );

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
      return <LoadingState />;
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

  const handleHashtagPress = useCallback((tag: string) => {
    // TODO: Navigate to search with hashtag query
  }, []);

  // Flatten sections into a single list with headers
  const flattenedData = React.useMemo(() => {
    const result: Array<{
      type: 'header' | 'notification';
      title?: string;
      notification?: AppBskyNotificationListNotifications.Notification;
    }> = [];

    sections.forEach(section => {
      result.push({type: 'header', title: section.title});
      section.data.forEach(notification => {
        result.push({type: 'notification', notification});
      });
    });

    return result;
  }, [sections]);

  const renderFlattenedItem = useCallback(
    ({item}: {item: (typeof flattenedData)[0]}) => {
      if (item.type === 'header') {
        return renderSectionHeader(item.title!);
      }
      return (
        <NotificationItem
          notification={item.notification!}
          onMentionPress={handleMentionPress}
          onHashtagPress={handleHashtagPress}
        />
      );
    },
    [renderSectionHeader, handleMentionPress, handleHashtagPress],
  );

  return (
    <View style={[styles.container, {paddingTop: insets.top}]}>
      <FlatList
        ref={scrollRef}
        data={flattenedData}
        renderItem={renderFlattenedItem}
        keyExtractor={(item, index) => {
          if (item.type === 'header') {
            return `header-${item.title}`;
          }
          return item.notification!.uri + index;
        }}
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
    backgroundColor: '#0a0a0f',
  },
  list: {
    flex: 1,
  },
  sectionHeader: {
    backgroundColor: '#1a1a24',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  sectionTitle: {
    color: '#9ca3af',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  footer: {
    padding: 20,
    alignItems: 'center',
  },
});
