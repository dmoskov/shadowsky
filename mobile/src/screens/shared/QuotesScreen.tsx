import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import {AppBskyFeedDefs} from '@atproto/api';
import {usePostQuotes} from '../../hooks/api/usePosts';
import {PostCard} from '../../components/PostCard';
import {colors} from '../../constants/theme';

interface QuotesScreenProps {
  postUri: string;
  onPressProfile?: (handle: string) => void;
  onPressPost?: (uri: string, handle: string) => void;
  onLike?: (uri: string, cid: string, isLiked: boolean, likeUri?: string) => void;
  onRepost?: (uri: string, cid: string, isReposted: boolean, repostUri?: string) => void;
  onReply?: (post: AppBskyFeedDefs.PostView) => void;
  onBookmark?: (uri: string, cid: string) => void;
  isBookmarked?: (uri: string) => boolean;
  onMentionPress?: (handle: string, did: string) => void;
  onHashtagPress?: (tag: string) => void;
  onImagePress?: (images: Array<{thumb: string; fullsize: string; alt?: string}>, index: number) => void;
  onLinkPress?: (url: string) => void;
  onQuotePress?: (uri: string, handle: string) => void;
  currentUserDid?: string;
}

export function QuotesScreen({
  postUri,
  onPressProfile,
  onPressPost,
  onLike,
  onRepost,
  onReply,
  onBookmark,
  isBookmarked,
  onMentionPress,
  onHashtagPress,
  onImagePress,
  onLinkPress,
  onQuotePress,
  currentUserDid,
}: QuotesScreenProps) {
  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    isRefetching,
  } = usePostQuotes(postUri);

  const quotes = data?.pages.flatMap((page) => page.posts) ?? [];

  const renderQuote = ({item}: {item: AppBskyFeedDefs.PostView}) => {
    // Convert PostView to FeedViewPost format for PostCard
    const feedViewPost: AppBskyFeedDefs.FeedViewPost = {
      post: item,
    };

    return (
      <PostCard
        post={feedViewPost}
        onPress={() => onPressPost?.(item.uri, item.author.handle)}
        onPressProfile={onPressProfile}
        onLike={() => onLike?.(item.uri, item.cid, !!item.viewer?.like, item.viewer?.like)}
        onRepost={() => onRepost?.(item.uri, item.cid, !!item.viewer?.repost, item.viewer?.repost)}
        onReply={() => onReply?.(item)}
        onBookmark={() => onBookmark?.(item.uri, item.cid)}
        isBookmarked={isBookmarked?.(item.uri)}
        onMentionPress={onMentionPress}
        onHashtagPress={onHashtagPress}
        onImagePress={onImagePress}
        onLinkPress={onLinkPress}
        onQuotePress={onQuotePress}
        currentUserDid={currentUserDid}
      />
    );
  };

  const renderFooter = () => {
    if (!isFetchingNextPage) return null;

    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  };

  const renderEmpty = () => {
    if (isLoading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Failed to load quotes</Text>
        </View>
      );
    }

    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>No quotes yet</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={quotes}
        renderItem={renderQuote}
        keyExtractor={(item, index) => item.uri || `quote-${index}`}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching && !isLoading}
            onRefresh={refetch}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        contentContainerStyle={quotes.length === 0 ? styles.emptyList : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  errorText: {
    color: colors.danger,
    fontSize: 16,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 16,
  },
  emptyList: {
    flexGrow: 1,
  },
});
