import React, { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { View, StyleSheet, Alert, ActionSheetIOS, Platform, ScrollView, TouchableOpacity, Text, Animated } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { useScrollToTop, DrawerActions, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChatBubbleIcon, MenuIcon } from "../../components/icons";
import { useUnreadMessageCount } from "../../hooks/api/useMessages";
import { useQueryClient } from "@tanstack/react-query";
import { useTimeline, useCustomFeed, useSavedFeeds } from "../../hooks/api";
import { getPostThread } from "../../services/atproto/feeds";
import { useLikePost, useUnlikePost, useRepost, useDeleteRepost } from "../../hooks/api/usePosts";
import { useBookmarks } from "../../hooks/api/useBookmarks";
import { useAppNavigation } from "../../hooks/useNavigation";
import { NativeFeedList } from "../../../modules/native-feed-list";
import { useRouter } from "expo-router";
import { triggerHaptic } from "../../utils/haptics";
import { useToast } from "../../contexts/ToastContext";
import { useDataPrefetch } from "../../hooks/useDataPrefetch";
import { openLink } from "../../utils/browser";
import { sharePost } from "../../utils/share";
import { useLightbox } from "../../contexts/LightboxContext";
import type { LightboxImage } from "../../contexts/LightboxContext";
import { createLogger } from "../../utils/logger";
import {fontSize} from '../../utils/typography';

const logger = createLogger('HomeScreen');

const NAV_BAR_HEIGHT = 44;
const FEED_PICKER_HEIGHT = 52;
const SCROLL_THRESHOLD = 10;

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
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const unreadCount = useUnreadMessageCount();
  const [selectedFeedUri, setSelectedFeedUri] = useState<string | null>(null);
  const { navigateToThread, navigateToProfile, navigateToCompose } = useAppNavigation();
  const likePost = useLikePost();
  const unlikePost = useUnlikePost();
  const repost = useRepost();
  const deleteRepost = useDeleteRepost();
  const { toggleBookmark, bookmarks } = useBookmarks();
  const { showToast } = useToast();
  const { openLightbox } = useLightbox();
  const queryClient = useQueryClient();
  const scrollRef = useRef<any>(null);

  // Collapsible header animation
  const totalHeaderHeight = insets.top + NAV_BAR_HEIGHT + FEED_PICKER_HEIGHT;
  const headerTranslateY = useRef(new Animated.Value(0)).current;
  const lastScrollY = useRef(0);
  const isHeaderHidden = useRef(false);

  const showHeader = useCallback(() => {
    if (isHeaderHidden.current) {
      isHeaderHidden.current = false;
      Animated.timing(headerTranslateY, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start();
    }
  }, [headerTranslateY]);

  const hideHeader = useCallback(() => {
    if (!isHeaderHidden.current) {
      isHeaderHidden.current = true;
      Animated.timing(headerTranslateY, {
        toValue: -totalHeaderHeight,
        duration: 220,
        useNativeDriver: true,
      }).start();
    }
  }, [headerTranslateY, totalHeaderHeight]);

  const handleScroll = useCallback((event: { nativeEvent: { y: number } }) => {
    const y = event.nativeEvent.y;
    const diff = y - lastScrollY.current;
    lastScrollY.current = y;

    // Always show header when near top
    if (y <= SCROLL_THRESHOLD) {
      showHeader();
      return;
    }

    if (diff > SCROLL_THRESHOLD) {
      hideHeader();
    } else if (diff < -SCROLL_THRESHOLD) {
      showHeader();
    }
  }, [showHeader, hideHeader]);

  // Compute bookmarked post URIs for the native feed list
  const bookmarkedPostUris = useMemo(() => {
    return new Set(bookmarks.map(b => b.postUri));
  }, [bookmarks]);

  // Fetch saved feeds
  const { data: savedFeeds } = useSavedFeeds();

  // Default to the first pinned feed (e.g. "For You") once loaded
  const hasInitializedFeed = useRef(false);
  useEffect(() => {
    if (!hasInitializedFeed.current && savedFeeds && savedFeeds.length > 0) {
      hasInitializedFeed.current = true;
      setSelectedFeedUri(savedFeeds[0].uri);
    }
  }, [savedFeeds]);

  // Fetch timeline or custom feed based on selection
  const timelineQuery = useTimeline();
  const customFeedQuery = useCustomFeed(selectedFeedUri || '');

  // Use the appropriate query based on selection
  const { data } =
    selectedFeedUri ? customFeedQuery : timelineQuery;

  // Flatten paginated feed data into a single array
  const flatPosts = useMemo(
    () => data?.pages.flatMap((page) => page.feed) ?? [],
    [data?.pages],
  );

  // Build a URI → post index map for O(1) lookups in action handlers
  const postsByUri = useMemo(() => {
    const map = new Map<string, typeof flatPosts[number]>();
    for (const p of flatPosts) {
      map.set(p.post.uri, p);
    }
    return map;
  }, [flatPosts]);

  // Prefetch thread and profile data for the first visible posts
  useDataPrefetch(flatPosts);

  // Enable scroll-to-top on tab press
  useScrollToTop(scrollRef);

  // Track last tap for scroll-to-top / double-tap-to-refresh
  const lastFeedTapRef = useRef<{ feedUri: string | null; time: number } | null>(null);

  // Handle feed chip tap:
  // - Tap already-selected feed → scroll to top
  // - Double-tap already-selected feed → scroll to top + refresh
  // - Tap different feed → switch feeds
  const handleFeedSelect = useCallback((feedUri: string | null) => {
    const isAlreadySelected = feedUri === selectedFeedUri;

    if (isAlreadySelected) {
      const now = Date.now();
      const lastTap = lastFeedTapRef.current;
      const isDoubleTap = lastTap && lastTap.feedUri === feedUri && (now - lastTap.time) < 400;

      if (isDoubleTap) {
        // Double tap: scroll to top + refresh
        triggerHaptic("medium");
        scrollRef.current?.scrollToTop();
        scrollRef.current?.refresh();
        showHeader();
        lastFeedTapRef.current = null;
      } else {
        // Single tap on active feed: scroll to top
        triggerHaptic("light");
        scrollRef.current?.scrollToTop();
        showHeader();
        lastFeedTapRef.current = { feedUri, time: now };
      }
    } else {
      // Switching to a different feed
      triggerHaptic("light");
      setSelectedFeedUri(feedUri);
      lastFeedTapRef.current = { feedUri, time: Date.now() };
    }
  }, [selectedFeedUri]);

  const handleDiscoverFeeds = useCallback(() => {
    triggerHaptic("light");
    router.push('/(app)/feeds/discover');
  }, [router]);

  const handlePostPress = useCallback((event: { nativeEvent: { uri: string; handle: string } }) => {
    const { uri, handle } = event.nativeEvent;
    const postId = getPostIdFromUri(uri);
    const did = getDidFromUri(uri);
    // Prefetch thread data during navigation animation
    const threadUri = did ? `at://${did}/app.bsky.feed.post/${postId}` : undefined;
    if (threadUri) {
      const prefetchStart = performance.now();
      queryClient.prefetchQuery({
        queryKey: ['thread', threadUri],
        queryFn: () => getPostThread(threadUri).then(result => {
          logger.log(`[perf] prefetch complete: ${(performance.now() - prefetchStart).toFixed(0)}ms`);
          return result;
        }),
        staleTime: 2 * 60 * 1000,
      });
    }
    logger.log(`[perf] navigateToThread: postId=${postId}, did=${did ? 'yes' : 'no'}`);
    navigateToThread(handle, postId, did || undefined);
  }, [queryClient, navigateToThread]);

  const handleProfilePress = useCallback((event: { nativeEvent: { handle: string } }) => {
    const { handle } = event.nativeEvent;
    navigateToProfile(handle);
  }, [navigateToProfile]);

  const handleLinkPress = useCallback((event: { nativeEvent: { uri: string } }) => {
    const { uri } = event.nativeEvent;
    openLink(uri, colors);
  }, [colors]);

  const handleImagePress = useCallback((event: { nativeEvent: { images: Array<{ thumb: string; fullsize: string; alt: string }>; index: number } }) => {
    const { images, index } = event.nativeEvent;
    const lightboxImages: LightboxImage[] = images.map(img => ({
      thumb: img.thumb,
      fullsize: img.fullsize,
      alt: img.alt,
    }));
    openLightbox(lightboxImages, index);
  }, [openLightbox]);

  const handleQuotePress = useCallback((event: { nativeEvent: { uri: string; handle: string } }) => {
    const { uri, handle } = event.nativeEvent;
    const postId = getPostIdFromUri(uri);
    const did = getDidFromUri(uri);
    navigateToThread(handle, postId, did || undefined);
  }, [navigateToThread]);

  const handleLike = useCallback((event: { nativeEvent: { uri: string; cid: string; likeUri?: string } }) => {
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
  }, [unlikePost, likePost]);

  const handleRepost = useCallback((event: { nativeEvent: { uri: string; cid: string; repostUri?: string } }) => {
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
  }, [deleteRepost, postsByUri, repost, navigateToCompose]);

  const handleReply = useCallback((event: { nativeEvent: { uri: string; cid: string; handle: string } }) => {
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
  }, [postsByUri, navigateToCompose]);

  // Note: Refresh and load more are handled by NativeFeedList component

  const handleMentionPress = useCallback((event: { nativeEvent: { handle: string; did: string } }) => {
    const { handle } = event.nativeEvent;
    navigateToProfile(handle);
  }, [navigateToProfile]);

  const handleHashtagPress = useCallback((event: { nativeEvent: { tag: string } }) => {
    const { tag } = event.nativeEvent;
    router.push({ pathname: '/(tabs)/(search)', params: { q: '#' + tag } } as any);
  }, [router]);

  const handleBookmark = useCallback((event: { nativeEvent: { uri: string } }) => {
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
  }, [postsByUri, bookmarkedPostUris, toggleBookmark, showToast]);

  const handleShare = useCallback((event: { nativeEvent: { uri: string } }) => {
    const { uri } = event.nativeEvent;
    const postData = postsByUri.get(uri);
    if (postData) {
      sharePost(postData);
    }
  }, [postsByUri]);

  // Note: Arrow key navigation disabled for native SwiftUI view
  // Can be re-implemented if needed with native bridge

  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View testID="home-screen" style={styles.container}>
      <Animated.View
        style={[
          styles.collapsibleWrapper,
          { bottom: -totalHeaderHeight, transform: [{ translateY: headerTranslateY }] },
        ]}
      >
        {/* Custom collapsible header */}
        <View style={[styles.header, { height: totalHeaderHeight, paddingTop: insets.top }]}>
          {/* Nav bar */}
          <View style={styles.navBar}>
            <TouchableOpacity
              onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
              style={styles.navBarButton}
              accessibilityLabel="Open menu"
              accessibilityRole="button"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MenuIcon size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.navBarTitle, { color: colors.text }]}>Home</Text>
            <TouchableOpacity
              onPress={() => router.push("/(app)/messages")}
              style={styles.navBarButton}
              accessibilityLabel={unreadCount > 0 ? `Messages, ${unreadCount} unread` : "Messages"}
              accessibilityRole="button"
            >
              <ChatBubbleIcon size={24} color={colors.text} />
              {unreadCount > 0 && (
                <View style={[styles.badge, { backgroundColor: colors.danger }]}>
                  <Text style={styles.badgeText}>
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Feed Picker Chips */}
          {savedFeeds && savedFeeds.length > 0 && (
            <ScrollView
              testID="feed-picker"
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.feedPickerContainer}
              contentContainerStyle={styles.feedPickerContent}
            >
              <TouchableOpacity
                testID="feed-chip-following"
                style={[styles.feedChip, !selectedFeedUri && styles.feedChipActive]}
                onPress={() => handleFeedSelect(null)}
                activeOpacity={0.7}
              >
                <Text style={[styles.feedChipText, !selectedFeedUri && styles.feedChipTextActive]}>
                  Following
                </Text>
              </TouchableOpacity>
              {savedFeeds.map((feed) => (
                <TouchableOpacity
                  key={feed.uri}
                  style={[styles.feedChip, selectedFeedUri === feed.uri && styles.feedChipActive]}
                  onPress={() => handleFeedSelect(feed.uri)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.feedChipText, selectedFeedUri === feed.uri && styles.feedChipTextActive]}>
                    {feed.displayName}
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.feedChipDiscover}
                onPress={handleDiscoverFeeds}
                activeOpacity={0.7}
              >
                <Text style={styles.feedChipDiscoverText}>+ Discover</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>

        {/* Feed list */}
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
          onLinkPress={handleLinkPress}
          onImagePress={handleImagePress}
          onQuotePress={handleQuotePress}
          onScroll={handleScroll}
          emptyMessage="No posts in your timeline yet"
        />
      </Animated.View>
    </View>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      overflow: 'hidden',
    },
    collapsibleWrapper: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
    },
    header: {
      backgroundColor: colors.background,
      zIndex: 1,
    },
    navBar: {
      height: NAV_BAR_HEIGHT,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 4,
    },
    navBarButton: {
      padding: 8,
      position: 'relative',
    },
    navBarTitle: {
      fontSize: fontSize.callout,
      fontWeight: '600',
    },
    badge: {
      position: 'absolute',
      right: 2,
      top: 2,
      borderRadius: 9,
      minWidth: 18,
      height: 18,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    badgeText: {
      color: '#ffffff',
      fontSize: fontSize.caption2,
      fontWeight: '700',
    },
    feedPickerContainer: {
      flexGrow: 0,
      flexShrink: 0,
      maxHeight: FEED_PICKER_HEIGHT,
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
      fontSize: fontSize.subheadline,
      fontWeight: '600',
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
      fontSize: fontSize.subheadline,
      fontWeight: '600',
      color: colors.primary,
    },
  });
}
