import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  useProfile,
  useFollowUser,
  useUnfollowUser,
  useBlockUser,
  useUnblockUser,
  useMuteUser,
  useUnmuteUser,
} from "../../hooks/api/useProfile";
import { useAuthorFeed, useActorLikes, usePostThread } from "../../hooks/api/useFeed";
import { useActorStarterPacks } from "../../hooks/api/useStarterPacks";
import { useLikePost, useUnlikePost, useRepost, useDeleteRepost } from "../../hooks/api/usePosts";
import { useBookmarks } from "../../hooks/api/useBookmarks";
import { AddToListModal } from "../../components/AddToListModal";
import { EditPostModal } from "../../components/EditPostModal";
import { useNativePostEditor } from "../../hooks/useNativePostEditor";
import { ReportModal } from "../../components/ReportModal";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useScrollChrome } from "../../contexts/ScrollChromeContext";
import { useToast } from "../../contexts/ToastContext";
import { useLightbox } from "../../contexts/LightboxContext";
import type { LightboxImage } from "../../contexts/LightboxContext";
import { AuthorFeedFilter, getPostThread as getPostThreadFn } from "../../services/atproto/feeds";
import { dmService } from "../../services/dm-service";
import { useSpotlightProfile } from "../../hooks/useSpotlightIndex";
import { useAppNavigation } from "../../hooks/useNavigation";
import { useNetworkStatus } from "../../hooks/useNetworkStatus";
import { NativeProfileViewWithData } from "../../../modules/native-profile-view/src/NativeProfileView";
import { NativeFeedList } from "../../../modules/native-feed-list";
import {
  ProfileData,
  StarterPackData,
  PinnedPostData,
  ProfileTab,
} from "../../../modules/native-profile-view/src/NativeProfileViewTypes";
import { ProfileScreen } from "./ProfileScreen";
import { InlineErrorBoundary } from "../../components/ui/InlineErrorBoundary";
import { ProfileAIInsights } from "../../components/ProfileAIInsights";
import { createLogger } from "../../utils/logger";
import { triggerHaptic } from "../../utils/haptics";
import { openLink } from "../../utils/browser";
import { sharePost } from "../../utils/share";
import {fontSize} from '../../utils/typography';
import {AppBskyFeedPost, AppBskyFeedDefs} from '@atproto/api';

const logger = createLogger("ProfileScreenNative");

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

interface ProfileScreenProps {
  handle: string;
  onNavigateToPost?: (uri: string) => void;
  onNavigateToProfile?: (handle: string) => void;
  onNavigateToFollowers?: (actor: string) => void;
  onNavigateToFollowing?: (actor: string) => void;
  onNavigateToMessages?: (conversationId: string) => void;
  onNavigateToHashtag?: (tag: string) => void;
}

export function ProfileScreenNative(props: ProfileScreenProps) {
  if (Platform.OS !== "ios") {
    return <ProfileScreen {...props} />;
  }

  return <ProfileScreenNativeIOS {...props} />;
}

function ProfileScreenNativeIOS({
  handle,
  onNavigateToPost,
  onNavigateToProfile,
  onNavigateToFollowers,
  onNavigateToFollowing,
  onNavigateToMessages,
  onNavigateToHashtag,
}: ProfileScreenProps) {
  const { colors } = useTheme();
  const { handleScroll: handleChromeScroll } = useScrollChrome();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { navigateToThread, navigateToProfile, navigateToCompose } = useAppNavigation();
  const { showToast } = useToast();
  const { openLightbox } = useLightbox();
  const { isConnected } = useNetworkStatus();
  const {
    data: profile,
    isLoading: isLoadingProfile,
    error: profileError,
    refetch: refetchProfile,
  } = useProfile(handle);
  const [activeTab, setActiveTab] = useState<ProfileTab>("posts");
  const [isStartingConversation, setIsStartingConversation] = useState(false);
  const [showAddToList, setShowAddToList] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const handleCloseReportModal = useCallback(() => setShowReportModal(false), []);
  const styles = useMemo(() => createStyles(colors), [colors]);

  useSpotlightProfile(
    profile
      ? {
          handle: profile.handle,
          displayName: profile.displayName,
          description: profile.description,
          avatar: profile.avatar,
          did: profile.did,
        }
      : null,
  );

  const getFilter = (): AuthorFeedFilter | undefined => {
    switch (activeTab) {
      case "posts":
        return "posts_no_replies";
      case "replies":
        return "posts_with_replies";
      case "media":
        return "posts_with_media";
      default:
        return undefined;
    }
  };

  // Feed queries — NativeFeedList handles serialization, pagination, and refresh
  const feedQuery = useAuthorFeed(handle, getFilter());
  const likesQuery = useActorLikes(handle);
  const activeQuery = activeTab === "likes" ? likesQuery : feedQuery;

  // Build a URI -> post lookup for action handlers that need full post data
  const flatPosts = useMemo(
    () => activeQuery.data?.pages.flatMap((page) => page.feed) ?? [],
    [activeQuery.data?.pages],
  );

  const postsByUri = useMemo(() => {
    const map = new Map<string, (typeof flatPosts)[number]>();
    for (const p of flatPosts) {
      map.set(p.post.uri, p);
    }
    return map;
  }, [flatPosts]);

  // Native context menu "Edit Post" → RN edit sheet. The native event carries
  // only a URI, so resolve it against the feed we already hold.
  const findPostForEdit = useCallback(
    (uri: string) => postsByUri.get(uri)?.post,
    [postsByUri],
  );
  const postEditor = useNativePostEditor(findPostForEdit);

  // Post interaction hooks
  const likePost = useLikePost();
  const unlikePost = useUnlikePost();
  const repostMutation = useRepost();
  const deleteRepostMutation = useDeleteRepost();
  const { toggleBookmark, bookmarks } = useBookmarks();

  const bookmarkedPostUris = useMemo(() => {
    return new Set(bookmarks.map(b => b.postUri));
  }, [bookmarks]);

  const { account } = useAuth();
  const followMutation = useFollowUser();
  const unfollowMutation = useUnfollowUser();
  const blockMutation = useBlockUser();
  const unblockMutation = useUnblockUser();
  const muteMutation = useMuteUser();
  const unmuteMutation = useUnmuteUser();

  const { data: starterPacksData } = useActorStarterPacks(handle);

  const pinnedPostUri = profile?.pinnedPost?.uri;
  const { data: pinnedPostThread } = usePostThread(pinnedPostUri ?? "");
  const pinnedPost =
    pinnedPostThread && AppBskyFeedDefs.isThreadViewPost(pinnedPostThread)
      ? pinnedPostThread.post
      : null;

  const isOwnProfile = account?.handle === handle;

  // --- Data mapping for native header (memoized to prevent header re-renders) ---

  const profileData: ProfileData | null = useMemo(
    () =>
      profile
        ? {
            did: profile.did,
            handle: profile.handle,
            displayName: profile.displayName,
            description: profile.description,
            avatar: profile.avatar,
            banner: profile.banner,
            followersCount: profile.followersCount,
            followsCount: profile.followsCount,
            postsCount: profile.postsCount,
            indexedAt: profile.indexedAt,
            isVerified: profile.verification?.verifiedStatus === 'valid' || undefined,
            viewer: profile.viewer
              ? {
                  muted: profile.viewer.muted,
                  blockedBy: profile.viewer.blockedBy,
                  blocking: profile.viewer.blocking,
                  following: profile.viewer.following,
                  followedBy: profile.viewer.followedBy,
                }
              : undefined,
            labels: profile.labels?.map((l) => ({ val: l.val, src: l.src })),
            pinnedPost: profile.pinnedPost
              ? { uri: profile.pinnedPost.uri }
              : undefined,
            associated: profile.associated
              ? {
                  lists: profile.associated.lists,
                  feedgens: profile.associated.feedgens,
                  starterPacks: profile.associated.starterPacks,
                  labeler: profile.associated.labeler,
                  chat: profile.associated.chat
                    ? { allowIncoming: profile.associated.chat.allowIncoming }
                    : undefined,
                }
              : undefined,
            knownFollowers: profile.viewer?.knownFollowers
              ? {
                  count: profile.viewer.knownFollowers.count,
                  followers:
                    profile.viewer.knownFollowers.followers?.map(
                      (f) => ({
                        did: f.did,
                        handle: f.handle,
                        displayName: f.displayName,
                        avatar: f.avatar,
                      }),
                    ) ?? [],
                }
              : undefined,
          }
        : null,
    [profile],
  );

  const starterPacksForNative: StarterPackData[] = useMemo(
    () =>
      starterPacksData?.starterPacks?.map((pack) => {
        const record = pack.record as { name?: string };
        return {
          uri: pack.uri,
          cid: pack.cid,
          name: record?.name || "Starter Pack",
          listItemCount: pack.listItemCount,
          joinedAllTimeCount: pack.joinedAllTimeCount,
        };
      }) ?? [],
    [starterPacksData],
  );

  const pinnedPostForNative: PinnedPostData | null = useMemo(
    () =>
      pinnedPost
        ? {
            uri: pinnedPost.uri,
            authorHandle: pinnedPost.author?.handle || "",
            authorDisplayName: pinnedPost.author?.displayName,
            authorAvatar: pinnedPost.author?.avatar,
            text: (pinnedPost.record as AppBskyFeedPost.Record)?.text,
            indexedAt: pinnedPost.indexedAt,
            likeCount: pinnedPost.likeCount,
            repostCount: pinnedPost.repostCount,
            replyCount: pinnedPost.replyCount,
          }
        : null,
    [pinnedPost],
  );

  // --- Profile header event handlers ---

  const handleFollowToggle = useCallback(() => {
    if (!profile) return;
    if (profile.viewer?.following) {
      unfollowMutation.mutate(profile.viewer.following);
    } else {
      followMutation.mutate(profile.did);
    }
  }, [profile, followMutation, unfollowMutation]);

  const handleTabChange = useCallback(
    (event: { nativeEvent: { tab: string } }) => {
      setActiveTab(event.nativeEvent.tab as ProfileTab);
    },
    [],
  );

  const handleFollowersPress = useCallback(() => {
    onNavigateToFollowers?.(handle);
  }, [handle, onNavigateToFollowers]);

  const handleFollowingPress = useCallback(() => {
    onNavigateToFollowing?.(handle);
  }, [handle, onNavigateToFollowing]);

  const handleMessagePress = useCallback(async () => {
    if (!profile) return;
    setIsStartingConversation(true);
    try {
      const conversation = await dmService.getConvoForMembers([profile.did]);
      if (onNavigateToMessages) {
        onNavigateToMessages(conversation.id);
      } else {
        router.push("/(app)/messages");
      }
    } catch (error) {
      logger.error("Failed to start conversation:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to start conversation";
      Alert.alert("Error", errorMessage);
    } finally {
      setIsStartingConversation(false);
    }
  }, [profile, onNavigateToMessages, router]);

  const handleMenuPress = useCallback(() => {
    setShowMenu(true);
  }, []);

  const handleAddToList = useCallback(() => {
    setShowAddToList(true);
  }, []);

  const handlePinnedPostPress = useCallback(
    (event: { nativeEvent: { uri: string } }) => {
      onNavigateToPost?.(event.nativeEvent.uri);
    },
    [onNavigateToPost],
  );

  const handleStarterPackPress = useCallback(
    (event: { nativeEvent: { uri: string } }) => {
      const encodedUri = encodeURIComponent(event.nativeEvent.uri);
      router.push(`/(app)/(tabs)/(home)/starter-pack/${encodedUri}`);
    },
    [router],
  );

  const handleKnownFollowerPress = useCallback(
    (event: { nativeEvent: { handle: string } }) => {
      onNavigateToProfile?.(event.nativeEvent.handle);
    },
    [onNavigateToProfile],
  );

  const handleRefresh = useCallback(async () => {
    if (activeTab === "likes") {
      await Promise.all([refetchProfile(), likesQuery.refetch()]);
    } else {
      await Promise.all([refetchProfile(), feedQuery.refetch()]);
    }
  }, [activeTab, refetchProfile, feedQuery, likesQuery]);

  const handleBlock = useCallback(() => {
    if (!profile) return;
    setShowMenu(false);
    Alert.alert(
      "Block User",
      `Are you sure you want to block @${profile.handle}? You won't see their posts and they won't be able to follow you or see your posts.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Block",
          style: "destructive",
          onPress: () => {
            blockMutation.mutate(profile.did, {
              onSuccess: () => {
                refetchProfile();
              },
            });
          },
        },
      ],
    );
  }, [profile, blockMutation, refetchProfile]);

  const handleUnblock = useCallback(() => {
    if (!profile?.viewer?.blocking) return;
    setShowMenu(false);
    Alert.alert(
      "Unblock User",
      `Are you sure you want to unblock @${profile.handle}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unblock",
          style: "default",
          onPress: () => {
            unblockMutation.mutate(profile.viewer!.blocking!, {
              onSuccess: () => {
                refetchProfile();
              },
            });
          },
        },
      ],
    );
  }, [profile, unblockMutation, refetchProfile]);

  const handleMute = useCallback(() => {
    if (!profile) return;
    setShowMenu(false);
    Alert.alert(
      "Mute User",
      `Are you sure you want to mute @${profile.handle}? You won't see their posts in your timeline.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Mute",
          style: "default",
          onPress: () => {
            muteMutation.mutate(profile.did, {
              onSuccess: () => {
                refetchProfile();
              },
            });
          },
        },
      ],
    );
  }, [profile, muteMutation, refetchProfile]);

  const handleUnmute = useCallback(() => {
    if (!profile) return;
    setShowMenu(false);
    Alert.alert(
      "Unmute User",
      `Are you sure you want to unmute @${profile.handle}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unmute",
          style: "default",
          onPress: () => {
            unmuteMutation.mutate(profile.did, {
              onSuccess: () => {
                refetchProfile();
              },
            });
          },
        },
      ],
    );
  }, [profile, unmuteMutation, refetchProfile]);

  const handleReport = useCallback(() => {
    setShowMenu(false);
    setShowReportModal(true);
  }, []);

  const handleBlockAfterReport = useCallback(
    async (did: string) => {
      if (!profile) return;
      try {
        await blockMutation.mutateAsync(did);
        Alert.alert("Success", `@${profile.handle} has been blocked.`);
      } catch (_error) {
        Alert.alert("Error", "Failed to block user. Please try again.");
      }
    },
    [profile, blockMutation],
  );

  const handleMuteAfterReport = useCallback(
    async (did: string) => {
      if (!profile) return;
      try {
        await muteMutation.mutateAsync(did);
        Alert.alert("Success", `@${profile.handle} has been muted.`);
      } catch (_error) {
        Alert.alert("Error", "Failed to mute user. Please try again.");
      }
    },
    [profile, muteMutation],
  );

  // --- NativeFeedList event handlers ---

  const handlePostPress = useCallback((event: { nativeEvent: { uri: string; handle: string } }) => {
    const { uri, handle: postHandle } = event.nativeEvent;
    const postId = getPostIdFromUri(uri);
    const did = getDidFromUri(uri);
    if (did) {
      const threadUri = `at://${did}/app.bsky.feed.post/${postId}`;
      queryClient.prefetchQuery({
        queryKey: ['thread', threadUri],
        queryFn: () => getPostThreadFn(threadUri),
        staleTime: 2 * 60 * 1000,
      });
    }
    if (onNavigateToPost) {
      onNavigateToPost(uri);
    } else {
      navigateToThread(postHandle, postId, did || undefined);
    }
  }, [queryClient, onNavigateToPost, navigateToThread]);

  const handleProfilePress = useCallback((event: { nativeEvent: { handle: string } }) => {
    const { handle: profileHandle } = event.nativeEvent;
    if (onNavigateToProfile) {
      onNavigateToProfile(profileHandle);
    } else {
      navigateToProfile(profileHandle);
    }
  }, [onNavigateToProfile, navigateToProfile]);

  const handleLike = useCallback((event: { nativeEvent: { uri: string; cid: string; likeUri?: string } }) => {
    const { uri, cid, likeUri } = event.nativeEvent;
    triggerHaptic("light");
    if (likeUri) {
      unlikePost.mutate({ likeUri, postUri: uri });
    } else {
      likePost.mutate({ uri, cid });
    }
  }, [unlikePost, likePost]);

  const handleRepost = useCallback((event: { nativeEvent: { uri: string; cid: string; repostUri?: string } }) => {
    const { uri, cid, repostUri } = event.nativeEvent;
    triggerHaptic("medium");
    if (repostUri) {
      deleteRepostMutation.mutate({ repostUri, postUri: uri });
    } else {
      repostMutation.mutate({ uri, cid });
    }
  }, [deleteRepostMutation, repostMutation]);

  const handleReply = useCallback((event: { nativeEvent: { uri: string; cid: string; handle: string } }) => {
    const { uri } = event.nativeEvent;
    const postData = postsByUri.get(uri);
    if (postData) {
      const record = postData.post.record as AppBskyFeedPost.Record;
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

  const handleBookmark = useCallback((event: { nativeEvent: { uri: string } }) => {
    const { uri } = event.nativeEvent;
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

  const handleMentionPress = useCallback((event: { nativeEvent: { handle: string; did: string } }) => {
    const { handle: mentionHandle } = event.nativeEvent;
    if (onNavigateToProfile) {
      onNavigateToProfile(mentionHandle);
    } else {
      navigateToProfile(mentionHandle);
    }
  }, [onNavigateToProfile, navigateToProfile]);

  const handleHashtagPress = useCallback((event: { nativeEvent: { tag: string } }) => {
    const { tag } = event.nativeEvent;
    if (onNavigateToHashtag) {
      onNavigateToHashtag(tag);
    } else {
      router.push({ pathname: '/(app)/(tabs)/(search)', params: { q: '#' + tag } } as any);
    }
  }, [onNavigateToHashtag, router]);

  const handleShare = useCallback((event: { nativeEvent: { uri: string } }) => {
    const { uri } = event.nativeEvent;
    const postData = postsByUri.get(uri);
    if (postData) {
      sharePost(postData);
    }
  }, [postsByUri]);

  const handleImagePress = useCallback((event: { nativeEvent: { images: Array<{ thumb: string; fullsize: string; alt: string }>; index: number } }) => {
    const { images, index } = event.nativeEvent;
    const lightboxImages: LightboxImage[] = images.map(img => ({
      thumb: img.thumb,
      fullsize: img.fullsize,
      alt: img.alt,
    }));
    openLightbox(lightboxImages, index);
  }, [openLightbox]);

  const handleLinkPress = useCallback((event: { nativeEvent: { uri: string } }) => {
    const { uri } = event.nativeEvent;
    openLink(uri, colors);
  }, [colors]);

  const handleQuotePress = useCallback((event: { nativeEvent: { uri: string; handle: string } }) => {
    const { uri } = event.nativeEvent;
    if (onNavigateToPost) {
      onNavigateToPost(uri);
    } else {
      const postId = getPostIdFromUri(uri);
      const did = getDidFromUri(uri);
      navigateToThread(event.nativeEvent.handle, postId, did || undefined);
    }
  }, [onNavigateToPost, navigateToThread]);

  const handleQuotePost = useCallback((event: { nativeEvent: { uri: string; cid: string; authorHandle: string; authorDisplayName?: string; authorAvatar?: string; text: string } }) => {
    const { uri, cid, authorHandle, authorDisplayName, authorAvatar, text } = event.nativeEvent;
    navigateToCompose({
      quoteTo: {
        uri,
        cid,
        author: {
          handle: authorHandle,
          displayName: authorDisplayName,
          avatar: authorAvatar,
        },
        text: text?.substring(0, 150) || '',
      },
    });
  }, [navigateToCompose]);

  // Empty message varies by active tab
  const emptyMessage = useMemo(() => {
    switch (activeTab) {
      case "likes": return "No likes yet";
      case "media": return "No media posts yet";
      case "replies": return "No replies yet";
      default: return "No posts yet";
    }
  }, [activeTab]);

  return (
    <View style={styles.container}>
      {/* Native SwiftUI profile header with tabs */}
      <InlineErrorBoundary context="ProfileHeader" onRetry={refetchProfile}>
        <NativeProfileViewWithData
          profile={profileData}
          starterPacks={starterPacksForNative}
          pinnedPost={pinnedPostForNative}
          isOwnProfile={isOwnProfile}
          isLoading={isLoadingProfile}
          error={profileError ?? null}
          isFollowPending={followMutation.isPending || unfollowMutation.isPending}
          isMessagePending={isStartingConversation}
          onTabChange={handleTabChange}
          onFollowToggle={handleFollowToggle}
          onFollowersPress={handleFollowersPress}
          onFollowingPress={handleFollowingPress}
          onMessagePress={handleMessagePress}
          onMenuPress={handleMenuPress}
          onAddToList={handleAddToList}
          onPinnedPostPress={handlePinnedPostPress}
          onStarterPackPress={handleStarterPackPress}
          onKnownFollowerPress={handleKnownFollowerPress}
          onRefresh={handleRefresh}
          style={styles.nativeHeader}
        />
      </InlineErrorBoundary>

      {/* AI Insights — only on posts tab */}
      {activeTab === "posts" && (
        <InlineErrorBoundary silent context="ProfileAIInsights">
          <ProfileAIInsights handle={handle} />
        </InlineErrorBoundary>
      )}

      {/* Native SwiftUI feed list — replaces RN FlatList + PostCard */}
      <NativeFeedList
        onScroll={(e: { nativeEvent: { y: number } }) => handleChromeScroll(e.nativeEvent.y)}
        query={activeQuery}
        bookmarkedPostUris={bookmarkedPostUris}
        isOnline={isConnected}
        emptyMessage={emptyMessage}
        onPostPress={handlePostPress}
        onProfilePress={handleProfilePress}
        onLike={handleLike}
        onRepost={handleRepost}
        onReply={handleReply}
        onBookmark={handleBookmark}
        onMentionPress={handleMentionPress}
        onHashtagPress={handleHashtagPress}
        onShare={handleShare}
        onImagePress={handleImagePress}
        onLinkPress={handleLinkPress}
        onQuotePress={handleQuotePress}
        onQuotePost={handleQuotePost}
        onEditPost={postEditor.handleNativeEditPost}
        currentUserDid={postEditor.currentUserDid}
      />

      {/* Edit sheet, opened from the native context menu */}
      {postEditor.editingPost && (
        <EditPostModal
          visible
          post={postEditor.editingPost}
          currentUserDid={postEditor.currentUserDid}
          onClose={postEditor.closeEditor}
        />
      )}

      {profile && showAddToList && (
        <AddToListModal
          visible={showAddToList}
          onClose={() => setShowAddToList(false)}
          userDid={profile.did}
          userHandle={profile.handle}
        />
      )}

      {profile && !isOwnProfile && showMenu && (
        <Modal
          visible={showMenu}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowMenu(false)}
        >
          <TouchableOpacity
            style={styles.menuOverlay}
            activeOpacity={1}
            onPress={() => setShowMenu(false)}
          >
            <View style={styles.menuContainer}>
              {profile.viewer?.muted ? (
                <TouchableOpacity style={styles.menuItem} onPress={handleUnmute}>
                  <Text style={styles.menuItemText}>
                    Unmute @{profile.handle}
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.menuItem} onPress={handleMute}>
                  <Text style={styles.menuItemText}>
                    Mute @{profile.handle}
                  </Text>
                </TouchableOpacity>
              )}
              {profile.viewer?.blocking ? (
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={handleUnblock}
                >
                  <Text style={styles.menuItemText}>
                    Unblock @{profile.handle}
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.menuItem} onPress={handleBlock}>
                  <Text style={[styles.menuItemText, styles.menuItemDanger]}>
                    Block @{profile.handle}
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.menuItem} onPress={handleReport}>
                <Text style={[styles.menuItemText, styles.menuItemDanger]}>
                  Report
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.menuItem, styles.menuItemLast]}
                onPress={() => setShowMenu(false)}
              >
                <Text style={styles.menuItemText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {profile && showReportModal && (
        <ReportModal
          visible={showReportModal}
          onClose={handleCloseReportModal}
          reportType="account"
          subjectUri={`at://${profile.did}/app.bsky.actor.profile/self`}
          subjectDid={profile.did}
          subjectHandle={profile.handle}
          subjectDisplayName={profile.displayName}
          onBlock={handleBlockAfterReport}
          onMute={handleMuteAfterReport}
        />
      )}
    </View>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    nativeHeader: {
      minHeight: 400,
    },
    menuOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      justifyContent: "center",
      alignItems: "center",
      padding: 16,
    },
    menuContainer: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: 12,
      width: "100%",
      maxWidth: 320,
      overflow: "hidden",
    },
    menuItem: {
      paddingVertical: 16,
      paddingHorizontal: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    menuItemLast: {
      borderBottomWidth: 0,
    },
    menuItemText: {
      color: colors.text,
      fontSize: fontSize.callout,
      fontWeight: "500",
      textAlign: "center",
    },
    menuItemDanger: {
      color: colors.danger,
    },
  });
}
