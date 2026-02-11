import React from 'react';
import { View, StyleSheet } from 'react-native';
import { FeedList } from '../../components/FeedList';
import { useBookmarks } from '../../hooks/api';
import { AppBskyFeedDefs } from '@atproto/api';
import { useRouter } from 'expo-router';

export function BookmarksScreen() {
  const router = useRouter();
  const { bookmarks, isLoading, error, refetch, isBookmarked, toggleBookmark } = useBookmarks();

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

  return (
    <View style={styles.container}>
      <FeedList
        posts={feedPosts}
        isLoading={isLoading}
        error={error}
        onRefresh={refetch}
        onPostPress={handlePostPress}
        onProfilePress={handleProfilePress}
        onBookmark={handleBookmark}
        isBookmarked={isBookmarked}
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
