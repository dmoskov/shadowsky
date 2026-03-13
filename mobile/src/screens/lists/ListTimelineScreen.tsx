import React, {useCallback, useMemo, useState} from 'react';
import {View, StyleSheet, Text, TouchableOpacity} from 'react-native';
import {FeedList} from '../../components/FeedList';
import {useListFeed, useList} from '../../hooks/api';
import {AppBskyFeedDefs} from '@atproto/api';
import {useAppNavigation} from '../../hooks/useNavigation';
import {useRouter} from 'expo-router';
import {useTheme} from '../../contexts/ThemeContext';
import {PostCardSkeleton} from '../../components/PostCardSkeleton';
import {useFeedPagePrefetch} from '../../hooks/useFeedPagePrefetch';
import {fontSize} from '../../utils/typography';

interface ListTimelineScreenProps {
  listId: string;
}

export function ListTimelineScreen({listId}: ListTimelineScreenProps) {
  const router = useRouter();
  const {navigateToListMembers} = useAppNavigation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

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
  const listFeedQuery = useListFeed(decodedListId);
  const {
    data,
    isLoading,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = listFeedQuery;
  useFeedPagePrefetch(listFeedQuery);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    refetch().finally(() => setIsRefreshing(false));
  }, [refetch]);

  // Flatten paginated feed data
  const posts = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((page) => page.feed);
  }, [data]);

  const handlePostPress = useCallback(
    (post: AppBskyFeedDefs.FeedViewPost) => {
      // Navigate to thread - parse AT URI: at://did/collection/rkey
      const parts = post.post.uri.split('/');
      const postId = parts[parts.length - 1];
      const did = parts[2] || '';
      const authorHandle = post.post.author.handle;
      router.push(
        `/(app)/(tabs)/(home)/thread/${postId}?handle=${authorHandle}&did=${encodeURIComponent(did)}`
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
    (handle: string, _did: string) => {
      handleProfilePress(handle);
    },
    [handleProfilePress]
  );

  const handleHashtagPress = useCallback((tag: string) => {
    router.push({ pathname: '/(app)/(tabs)/(search)', params: { q: '#' + tag } } as any);
  }, [router]);

  // Show loading state while fetching list details
  if (isLoadingList) {
    return (
      <View style={styles.centerContainer}>
        <PostCardSkeleton />
        <PostCardSkeleton />
        <PostCardSkeleton />
        <PostCardSkeleton />
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
        isRefreshing={isRefreshing}
        isLoadingMore={isFetchingNextPage}
        error={error instanceof Error ? error : null}
        onRefresh={handleRefresh}
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

function createStyles(colors: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    centerContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
    },
    loadingText: {
      color: colors.textSecondary,
      fontSize: fontSize.subheadline,
      marginTop: 12,
    },
    header: {
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.surfaceAlt,
      backgroundColor: colors.background,
    },
    listName: {
      color: colors.text,
      fontSize: fontSize.title3,
      fontWeight: '700',
      marginBottom: 6,
    },
    listDescription: {
      color: colors.textSecondary,
      fontSize: fontSize.subheadline,
      marginBottom: 8,
      lineHeight: 20,
    },
    manageMembersButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 4,
    },
    listMemberCount: {
      color: colors.textTertiary,
      fontSize: fontSize.footnote,
    },
    chevron: {
      color: colors.textTertiary,
      fontSize: fontSize.headline,
      marginLeft: 4,
    },
  });
}
