import React, { useState } from "react";
import { View, StyleSheet, Alert, ActionSheetIOS, Platform } from "react-native";
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
  const { navigateToThread, navigateToProfile, navigateToCompose } = useAppNavigation();
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
      unlikePost.mutate({ likeUri: viewer.like, postUri: uri });
    } else {
      // Like the post
      likePost.mutate({ uri, cid });
    }
  };

  const handleRepost = (post: AppBskyFeedDefs.FeedViewPost) => {
    const postView = post.post;
    const { uri, cid, viewer } = postView;
    const record = postView.record as any;

    // If already reposted, just unrepost
    if (viewer?.repost) {
      deleteRepost.mutate({ repostUri: viewer.repost, postUri: uri });
      return;
    }

    // Show menu: Repost or Quote
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Repost', 'Quote'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            // Repost
            repost.mutate({ uri, cid });
          } else if (buttonIndex === 2) {
            // Quote
            navigateToCompose({
              quoteTo: {
                uri: postView.uri,
                cid: postView.cid,
                author: {
                  handle: postView.author.handle,
                  displayName: postView.author.displayName,
                  avatar: postView.author.avatar,
                },
                text: record?.text?.substring(0, 150) || '',
              },
            });
          }
        }
      );
    } else {
      // Android - use Alert
      Alert.alert(
        'Repost',
        'Choose an option',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Repost',
            onPress: () => repost.mutate({ uri, cid }),
          },
          {
            text: 'Quote',
            onPress: () => {
              navigateToCompose({
                quoteTo: {
                  uri: postView.uri,
                  cid: postView.cid,
                  author: {
                    handle: postView.author.handle,
                    displayName: postView.author.displayName,
                    avatar: postView.author.avatar,
                  },
                  text: record?.text?.substring(0, 150) || '',
                },
              });
            },
          },
        ],
        { cancelable: true }
      );
    }
  };

  const handleReply = (post: AppBskyFeedDefs.FeedViewPost) => {
    const postView = post.post;
    const record = postView.record as any;

    navigateToCompose({
      replyTo: {
        uri: postView.uri,
        cid: postView.cid,
        author: {
          handle: postView.author.handle,
          displayName: postView.author.displayName,
          avatar: postView.author.avatar,
        },
        text: record?.text?.substring(0, 100) || '',
      },
    });
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
