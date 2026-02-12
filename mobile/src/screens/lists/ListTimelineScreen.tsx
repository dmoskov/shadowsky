import React, {useCallback, useMemo} from 'react';
import {View, StyleSheet, Text, ActivityIndicator, TouchableOpacity} from 'react-native';
import {FeedList} from '../../components/FeedList';
import {useListFeed, useList} from '../../hooks/api';
import {AppBskyFeedDefs} from '@atproto/api';
import {useAppNavigation} from '../../hooks/useNavigation';
import {useRouter} from 'expo-router';

interface ListTimelineScreenProps {
  listId: string;
}

export function ListTimelineScreen({listId}: ListTimelineScreenProps) {
  const router = useRouter();
  const {navigateToList, navigateToListMembers} = useAppNavigation();

  // Decode the listId since it was encoded when passed
  const decodedListId = useMemo(() => {
    try {
      return decodeURIComponent(listId);
    } catch {
      return listId;
    }
  }, [listId]);

  // Fetch list details
  const {data: listData, isLoading: isLoadingList} = useList(decodedListId);

  // Fetch list feed with infinite scroll
  const {
    data,
    isLoading,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isRefetching,
  } = useListFeed(decodedListId);

  // Flatten paginated feed data
  const posts = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((page) => page.feed);
  }, [data]);

  const handlePostPress = useCallback(
    (post: AppBskyFeedDefs.FeedViewPost) => {
      // Navigate to thread
      const authorHandle = post.post.author.handle;
      const postId = post.post.uri.split('/').pop() || '';
      router.push(
        `/(app)/(tabs)/(home)/thread/${postId}?handle=${authorHandle}`
      );
    },
    [router]
  );

  const handleProfilePress = useCallback(
    (handle: string) => {
      router.push(`/(app)/(tabs)/(home)/profile/${handle}`);
    },
    [router]
  );

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleMentionPress = useCallback(
    (handle: string, did: string) => {
      handleProfilePress(handle);
    },
    [handleProfilePress]
  );

  const handleHashtagPress = useCallback((tag: string) => {
    // TODO: Navigate to search with hashtag query
    console.log('Hashtag pressed:', tag);
  }, []);

  // Show loading state while fetching list details
  if (isLoadingList) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator color="#3b82f6" size="large" />
        <Text style={styles.loadingText}>Loading list...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {listData && (
        <View style={styles.header}>
          <Text style={styles.listName}>{listData.name}</Text>
          {listData.description && (
            <Text style={styles.listDescription}>{listData.description}</Text>
          )}
          <TouchableOpacity
            style={styles.manageMembersButton}
            onPress={() => navigateToListMembers(decodedListId)}>
            <Text style={styles.listMemberCount}>
              {listData.listItemCount || 0} members
            </Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>
      )}
      <FeedList
        posts={posts}
        isLoading={isLoading}
        isRefreshing={isRefetching}
        isLoadingMore={isFetchingNextPage}
        error={error instanceof Error ? error : null}
        onRefresh={refetch}
        onLoadMore={handleLoadMore}
        onPostPress={handlePostPress}
        onProfilePress={handleProfilePress}
        onMentionPress={handleMentionPress}
        onHashtagPress={handleHashtagPress}
        emptyMessage="No posts in this list yet"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0f',
  },
  loadingText: {
    color: '#9ca3af',
    fontSize: 14,
    marginTop: 12,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1f1f2e',
    backgroundColor: '#0f0f14',
  },
  listName: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 6,
  },
  listDescription: {
    color: '#9ca3af',
    fontSize: 14,
    marginBottom: 8,
    lineHeight: 20,
  },
  manageMembersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  listMemberCount: {
    color: '#6b7280',
    fontSize: 13,
  },
  chevron: {
    color: '#6b7280',
    fontSize: 18,
    marginLeft: 4,
  },
});
