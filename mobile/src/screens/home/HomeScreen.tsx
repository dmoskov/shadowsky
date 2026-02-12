import React from "react";
import { View, StyleSheet } from "react-native";
import { AppBskyFeedDefs } from "@atproto/api";
import { useTimeline } from "../../hooks/api/useFeed";
import { useLikePost, useUnlikePost, useRepost, useDeleteRepost } from "../../hooks/api/usePosts";
import { useAppNavigation } from "../../hooks/useNavigation";
import { FeedList } from "../../components/FeedList";

/**
 * Extract post ID (rkey) from AT Protocol URI
 * URI format: at://did/collection/rkey
 */
function getPostIdFromUri(uri: string): string {
  const parts = uri.split("/");
  return parts[parts.length - 1];
}

export function HomeScreen() {
  const { data, isLoading, isRefetching, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useTimeline();
  const { navigateToThread, navigateToProfile } = useAppNavigation();
  const likePost = useLikePost();
  const unlikePost = useUnlikePost();
  const repost = useRepost();
  const deleteRepost = useDeleteRepost();

  // Flatten paginated data
  const posts = data?.pages.flatMap((page) => page.feed) ?? [];

  const handlePostPress = (post: AppBskyFeedDefs.FeedViewPost) => {
    const postId = getPostIdFromUri(post.post.uri);
    const handle = post.post.author.handle;
    navigateToThread(handle, postId);
  };

  const handleProfilePress = (handle: string) => {
    navigateToProfile(handle);
  };

  const handleLike = (post: AppBskyFeedDefs.FeedViewPost) => {
    const { uri, cid, viewer } = post.post;

    if (viewer?.like) {
      // Unlike if already liked
      unlikePost.mutate(viewer.like);
    } else {
      // Like the post
      likePost.mutate({ uri, cid });
    }
  };

  const handleRepost = (post: AppBskyFeedDefs.FeedViewPost) => {
    const { uri, cid, viewer } = post.post;

    if (viewer?.repost) {
      // Delete repost if already reposted
      deleteRepost.mutate(viewer.repost);
    } else {
      // Repost the post
      repost.mutate({ uri, cid });
    }
  };

  const handleReply = (post: AppBskyFeedDefs.FeedViewPost) => {
    // Navigate to thread view where reply can be composed
    handlePostPress(post);
  };

  const handleRefresh = () => {
    refetch();
  };

  const handleLoadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  const handleMentionPress = (handle: string, did: string) => {
    navigateToProfile(handle);
  };

  const handleHashtagPress = (tag: string) => {
    // TODO: Navigate to search with hashtag query
    console.log('Hashtag pressed:', tag);
  };

  return (
    <View style={styles.container}>
      <FeedList
        posts={posts}
        isLoading={isLoading}
        isRefreshing={isRefetching}
        isLoadingMore={isFetchingNextPage}
        error={error}
        onRefresh={handleRefresh}
        onLoadMore={handleLoadMore}
        onPostPress={handlePostPress}
        onProfilePress={handleProfilePress}
        onLike={handleLike}
        onRepost={handleRepost}
        onReply={handleReply}
        onMentionPress={handleMentionPress}
        onHashtagPress={handleHashtagPress}
        emptyMessage="No posts in your timeline yet"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0f",
  },
});
