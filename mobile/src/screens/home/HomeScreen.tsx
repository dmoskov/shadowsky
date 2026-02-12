import React, { useState, useRef, useMemo } from "react";
import { View, StyleSheet, Alert, ActionSheetIOS, Platform, FlatList, ScrollView, TouchableOpacity, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../../constants/theme";
import { AppBskyFeedDefs } from "@atproto/api";
import { useScrollToTop } from "@react-navigation/native";
import { useTimeline, useCustomFeed, useSavedFeeds } from "../../hooks/api";
import { useLikePost, useUnlikePost, useRepost, useDeleteRepost } from "../../hooks/api/usePosts";
import { useAppNavigation } from "../../hooks/useNavigation";
import { FeedList } from "../../components/FeedList";
import { useRouter } from "expo-router";

/**
 * Extract post ID (rkey) from AT Protocol URI
 * URI format: at://did/collection/rkey
 */
function getPostIdFromUri(uri: string): string {
  const parts = uri.split("/");
  return parts[parts.length - 1];
}

export function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [selectedFeedUri, setSelectedFeedUri] = useState<string | null>(null);
  const { navigateToThread, navigateToProfile, navigateToCompose } = useAppNavigation();
  const likePost = useLikePost();
  const unlikePost = useUnlikePost();
  const repost = useRepost();
  const deleteRepost = useDeleteRepost();
  const scrollRef = useRef<FlatList>(null);

  // Fetch saved feeds
  const { data: savedFeeds } = useSavedFeeds();

  // Fetch timeline or custom feed based on selection
  const timelineQuery = useTimeline();
  const customFeedQuery = useCustomFeed(selectedFeedUri || '');

  // Use the appropriate query based on selection
  const { data, isLoading, isRefetching, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    selectedFeedUri ? customFeedQuery : timelineQuery;

  // Enable scroll-to-top on tab press
  useScrollToTop(scrollRef);

  // Flatten paginated data
  const posts = data?.pages.flatMap((page) => page.feed) ?? [];

  // Handle feed selection
  const handleFeedSelect = (feedUri: string | null) => {
    setSelectedFeedUri(feedUri);
  };

  const handleDiscoverFeeds = () => {
    router.push('/(app)/feeds/discover');
  };

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
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Feed Picker Chips */}
      {savedFeeds && savedFeeds.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.feedPickerContainer}
          contentContainerStyle={styles.feedPickerContent}>
          <TouchableOpacity
            style={[styles.feedChip, !selectedFeedUri && styles.feedChipActive]}
            onPress={() => handleFeedSelect(null)}
            activeOpacity={0.7}>
            <Text style={[styles.feedChipText, !selectedFeedUri && styles.feedChipTextActive]}>
              🏠 Following
            </Text>
          </TouchableOpacity>
          {savedFeeds.map((feed) => (
            <TouchableOpacity
              key={feed.uri}
              style={[styles.feedChip, selectedFeedUri === feed.uri && styles.feedChipActive]}
              onPress={() => handleFeedSelect(feed.uri)}
              activeOpacity={0.7}>
              <Text style={[styles.feedChipText, selectedFeedUri === feed.uri && styles.feedChipTextActive]}>
                {feed.displayName}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={styles.feedChipDiscover}
            onPress={handleDiscoverFeeds}
            activeOpacity={0.7}>
            <Text style={styles.feedChipDiscoverText}>+ Discover</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      <FeedList
        ref={scrollRef}
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
  feedPickerContainer: {
    backgroundColor: "#15202B",
    borderBottomWidth: 1,
    borderBottomColor: "#38444D",
    maxHeight: 56,
  },
  feedPickerContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  feedChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#192734",
    borderWidth: 1,
    borderColor: "#38444D",
    marginRight: 8,
  },
  feedChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  feedChipText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#8899A6",
  },
  feedChipTextActive: {
    color: "#FFFFFF",
  },
  feedChipDiscover: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#253341",
    borderWidth: 1,
    borderColor: colors.primary,
    marginRight: 8,
  },
  feedChipDiscoverText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.primary,
  },
});
