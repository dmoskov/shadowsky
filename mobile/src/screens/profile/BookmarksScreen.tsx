import React from 'react';
import { View, StyleSheet } from 'react-native';
import { FeedList } from '../../components/FeedList';
import { useBookmarks } from '../../hooks/api';
import { AppBskyFeedDefs } from '@atproto/api';
import { useRouter } from 'expo-router';

export function BookmarksScreen() {
  const router = useRouter();
  const { bookmarks, isLoading, error, refetch, isBookmarked, toggleBookmark } = useBookmarks();
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  // Convert BookmarkPost[] to FeedViewPost[]
  const feedPosts: AppBskyFeedDefs.FeedViewPost[] = bookmarks
    .filter((bookmark) => bookmark.post)
    .map((bookmark) => ({
      post: bookmark.post!,
      reason: undefined,
      reply: undefined,
      feedContext: undefined,
    }));

  const handlePostPress = (post: AppBskyFeedDefs.FeedViewPost) => {
    // Navigate to post detail
    router.push({
      pathname: '/post/[uri]',
      params: { uri: encodeURIComponent(post.post.uri) },
    });
  };

  const handleProfilePress = (handle: string) => {
    // Navigate to profile
    router.push({
      pathname: '/profile/[handle]',
      params: { handle },
    });
  };

  const handleBookmark = (post: AppBskyFeedDefs.FeedViewPost) => {
    toggleBookmark(post.post);
  };

  const handleMentionPress = (handle: string, did: string) => {
    handleProfilePress(handle);
  };

  const handleHashtagPress = (tag: string) => {
    // TODO: Navigate to search with hashtag query
    console.log('Hashtag pressed:', tag);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <FeedList
        posts={feedPosts}
        isLoading={isLoading}
        isRefreshing={isRefreshing}
        error={error}
        onRefresh={handleRefresh}
        onPostPress={handlePostPress}
        onProfilePress={handleProfilePress}
        onBookmark={handleBookmark}
        isBookmarked={isBookmarked}
        onMentionPress={handleMentionPress}
        onHashtagPress={handleHashtagPress}
        emptyMessage="No bookmarks yet. Bookmark posts to see them here."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
});
