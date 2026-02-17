import React, { useState, useRef, useMemo } from "react";
import { View, StyleSheet, Alert, ActionSheetIOS, Platform, ScrollView, TouchableOpacity, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../contexts/ThemeContext";
import { useScrollToTop } from "@react-navigation/native";
import { useTimeline, useCustomFeed, useSavedFeeds } from "../../hooks/api";
import { useLikePost, useUnlikePost, useRepost, useDeleteRepost } from "../../hooks/api/usePosts";
import { useBookmarks } from "../../hooks/api/useBookmarks";
import { useAppNavigation } from "../../hooks/useNavigation";
import { NativeFeedList } from "../../../modules/native-feed-list";
import { useRouter } from "expo-router";
import { triggerHaptic } from "../../utils/haptics";
import { useToast } from "../../contexts/ToastContext";

/**
 * Extract post ID (rkey) from AT Protocol URI
 * URI format: at://did/collection/rkey
 */
function getPostIdFromUri(uri: string): string {
  const parts = uri.split("/");
  return parts[parts.length - 1];
}

/**
 * Extract DID from AT Protocol URI
 * URI format: at://did:plc:xxx/collection/rkey
 */
function getDidFromUri(uri: string): string {
  const parts = uri.split("/");
  return parts[2] || "";
}

export function HomeScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [selectedFeedUri, setSelectedFeedUri] = useState<string | null>(null);
  const { navigateToThread, navigateToProfile, navigateToCompose } = useAppNavigation();
  const likePost = useLikePost();
  const unlikePost = useUnlikePost();
  const repost = useRepost();
  const deleteRepost = useDeleteRepost();
  const { toggleBookmark, bookmarks } = useBookmarks();
  const { showToast } = useToast();
  const scrollRef = useRef<any>(null);

  // Compute bookmarked post URIs for the native feed list
  const bookmarkedPostUris = useMemo(() => {
    return new Set(bookmarks.map(b => b.postUri));
  }, [bookmarks]);

  // Fetch saved feeds
  const { data: savedFeeds } = useSavedFeeds();

  // Fetch timeline or custom feed based on selection
  const timelineQuery = useTimeline();
  const customFeedQuery = useCustomFeed(selectedFeedUri || '');

  // Use the appropriate query based on selection
  const { data } =
    selectedFeedUri ? customFeedQuery : timelineQuery;

  // Build a URI → post index map for O(1) lookups in action handlers
  const postsByUri = useMemo(() => {
    const posts = data?.pages.flatMap((page) => page.feed) ?? [];
    const map = new Map<string, typeof posts[number]>();
    for (const p of posts) {
      map.set(p.post.uri, p);
    }
    return map;
  }, [data?.pages]);

  // Enable scroll-to-top on tab press
  useScrollToTop(scrollRef);

  // Handle feed selection
  const handleFeedSelect = (feedUri: string | null) => {
    triggerHaptic("light");
    setSelectedFeedUri(feedUri);
  };

  const handleDiscoverFeeds = () => {
    triggerHaptic("light");
    router.push('/(app)/feeds/discover');
  };

  const handlePostPress = (event: { nativeEvent: { uri: string; handle: string } }) => {
    const { uri, handle } = event.nativeEvent;
    const postId = getPostIdFromUri(uri);
    const did = getDidFromUri(uri);
    navigateToThread(handle, postId, did || undefined);
  };

  const handleProfilePress = (event: { nativeEvent: { handle: string } }) => {
    const { handle } = event.nativeEvent;
    navigateToProfile(handle);
  };

  const handleLike = (event: { nativeEvent: { uri: string; cid: string; likeUri?: string } }) => {
    const { uri, cid, likeUri } = event.nativeEvent;

    if (likeUri) {
      // Unlike if already liked
      triggerHaptic("light");
      unlikePost.mutate({ likeUri, postUri: uri });
    } else {
      // Like the post
      triggerHaptic("light");
      likePost.mutate({ uri, cid });
    }
  };

  const handleRepost = (event: { nativeEvent: { uri: string; cid: string; repostUri?: string } }) => {
    const { uri, cid, repostUri } = event.nativeEvent;

    // If already reposted, just unrepost
    if (repostUri) {
      triggerHaptic("medium");
      deleteRepost.mutate({ repostUri, postUri: uri });
      return;
    }

    // Get post data for quote option
    const postData = postsByUri.get(uri);

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
            triggerHaptic("medium");
            repost.mutate({ uri, cid });
          } else if (buttonIndex === 2 && postData) {
            // Quote
            const record = postData.post.record as any;
            navigateToCompose({
              quoteTo: {
                uri: postData.post.uri,
                cid: postData.post.cid,
                author: {
                  handle: postData.post.author.handle,
                  displayName: postData.post.author.displayName,
                  avatar: postData.post.author.avatar,
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
            onPress: () => {
              triggerHaptic("medium");
              repost.mutate({ uri, cid });
            },
          },
          {
            text: 'Quote',
            onPress: () => {
              if (postData) {
                const record = postData.post.record as any;
                navigateToCompose({
                  quoteTo: {
                    uri: postData.post.uri,
                    cid: postData.post.cid,
                    author: {
                      handle: postData.post.author.handle,
                      displayName: postData.post.author.displayName,
                      avatar: postData.post.author.avatar,
                    },
                    text: record?.text?.substring(0, 150) || '',
                  },
                });
              }
            },
          },
        ],
        { cancelable: true }
      );
    }
  };

  const handleReply = (event: { nativeEvent: { uri: string; cid: string; handle: string } }) => {
    const { uri } = event.nativeEvent;

    // Get post data for reply
    const postData = postsByUri.get(uri);

    if (postData) {
      const record = postData.post.record as any;
      navigateToCompose({
        replyTo: {
          uri: postData.post.uri,
          cid: postData.post.cid,
          author: {
            handle: postData.post.author.handle,
            displayName: postData.post.author.displayName,
            avatar: postData.post.author.avatar,
          },
          text: record?.text?.substring(0, 100) || '',
        },
      });
    }
  };

  // Note: Refresh and load more are handled by NativeFeedList component

  const handleMentionPress = (event: { nativeEvent: { handle: string; did: string } }) => {
    const { handle } = event.nativeEvent;
    navigateToProfile(handle);
  };

  const handleHashtagPress = (event: { nativeEvent: { tag: string } }) => {
    const { tag } = event.nativeEvent;
    router.push({ pathname: '/(tabs)/(search)', params: { q: '#' + tag } } as any);
  };

  const handleBookmark = (event: { nativeEvent: { uri: string } }) => {
    const { uri } = event.nativeEvent;

    // Get post data
    const postData = postsByUri.get(uri);

    if (postData) {
      const isCurrentlyBookmarked = bookmarkedPostUris.has(uri);
      triggerHaptic("light");
      toggleBookmark(postData.post);
      if (isCurrentlyBookmarked) {
        showToast("Post removed from saved", { type: "info" });
      } else {
        showToast("Post saved", { type: "success" });
      }
    }
  };

  const handleShare = (_event: { nativeEvent: { uri: string } }) => {
    // Share functionality can be implemented later
    // TODO: Implement share functionality
  };

  // Note: Arrow key navigation disabled for native SwiftUI view
  // Can be re-implemented if needed with native bridge

  const styles = useMemo(() => createStyles(colors), [colors]);

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

      <NativeFeedList
        ref={scrollRef}
        query={selectedFeedUri ? customFeedQuery : timelineQuery}
        bookmarkedPostUris={bookmarkedPostUris}
        isOnline={true}
        onPostPress={handlePostPress}
        onProfilePress={handleProfilePress}
        onLike={handleLike}
        onRepost={handleRepost}
        onReply={handleReply}
        onBookmark={handleBookmark}
        onMentionPress={handleMentionPress}
        onHashtagPress={handleHashtagPress}
        onShare={handleShare}
        emptyMessage="No posts in your timeline yet"
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
  feedPickerContainer: {
    flexGrow: 0,
    flexShrink: 0,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface,
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
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surface,
    marginRight: 8,
  },
  feedChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  feedChipText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  feedChipTextActive: {
    color: colors.text,
  },
  feedChipDiscover: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.surface,
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
}
