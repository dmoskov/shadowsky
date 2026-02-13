import React from 'react';
import { View, StyleSheet } from 'react-native';
import { FeedList } from '../../components/FeedList';
import { useBookmarks } from '../../hooks/api';
import { AppBskyFeedDefs } from '@atproto/api';
import { useRouter } from 'expo-router';
import { triggerHaptic } from '../../../src/utils/haptics';

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
      pathname: '/post/[uri]' as never,
      params: { uri: encodeURIComponent(post.post.uri) },
    } as never);
  };

  const handleProfilePress = (handle: string) => {
    // Navigate to profile
    router.push({
      pathname: '/profile/[handle]' as never,
      params: { handle },
    } as never);
  };

  const handleBookmark = (post: AppBskyFeedDefs.FeedViewPost) => {
    triggerHaptic("light");
    toggleBookmark(post.post);
  };

  const handleMentionPress = (handle: string, did: string) => {
    handleProfilePress(handle);
  };

  const handleHashtagPress = (tag: string) => {
    router.push({ pathname: '/(tabs)/(search)', params: { q: '#' + tag } });
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
