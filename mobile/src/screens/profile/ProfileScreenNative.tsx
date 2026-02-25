import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Modal,
  Alert,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
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
import { PostCard } from "../../components/PostCard";
import { AddToListModal } from "../../components/AddToListModal";
import { ReportModal } from "../../components/ReportModal";
import { ProfileSkeleton } from "../../components/ProfileSkeleton";
import { AppBskyFeedDefs } from "@atproto/api";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { AuthorFeedFilter } from "../../services/atproto/feeds";
import { dmService } from "../../services/dm-service";
import { useSpotlightProfile } from "../../hooks/useSpotlightIndex";
import { NativeProfileViewWithData } from "../../../modules/native-profile-view/src/NativeProfileView";
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

const logger = createLogger("ProfileScreenNative");

interface ProfileScreenProps {
  handle: string;
  onNavigateToPost?: (uri: string) => void;
  onNavigateToProfile?: (handle: string) => void;
  onNavigateToFollowers?: (actor: string) => void;
  onNavigateToFollowing?: (actor: string) => void;
  onNavigateToMessages?: (conversationId: string) => void;
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
}: ProfileScreenProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const {
    data: profile,
    isLoading: isLoadingProfile,
    error: profileError,
    refetch: refetchProfile,
  } = useProfile(handle);
  const [activeTab, setActiveTab] = useState<ProfileTab>("posts");
  const [isStartingConversation, setIsStartingConversation] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
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

  const {
    data: feedData,
    isLoading: isLoadingFeed,
    fetchNextPage: fetchNextFeedPage,
    hasNextPage: hasNextFeedPage,
    isFetchingNextPage: isFetchingNextFeedPage,
    refetch: refetchFeed,
  } = useAuthorFeed(handle, getFilter());

  const {
    data: likesData,
    isLoading: isLoadingLikes,
    fetchNextPage: fetchNextLikesPage,
    hasNextPage: hasNextLikesPage,
    isFetchingNextPage: isFetchingNextLikesPage,
    refetch: refetchLikes,
  } = useActorLikes(handle);

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
    pinnedPostThread && "post" in pinnedPostThread
      ? (pinnedPostThread.post as AppBskyFeedDefs.PostView)
      : null;

  const isOwnProfile = account?.handle === handle;

  // --- Data mapping for native header ---

  const profileData: ProfileData | null = profile
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
        knownFollowers: (profile as any).knownFollowers
          ? {
              count: (profile as any).knownFollowers.count,
              followers:
                (profile as any).knownFollowers.followers?.map((f: any) => ({
                  did: f.did,
                  handle: f.handle,
                  displayName: f.displayName,
                  avatar: f.avatar,
                })) ?? [],
            }
          : undefined,
      }
    : null;

  const starterPacksForNative: StarterPackData[] =
    starterPacksData?.starterPacks?.map((pack) => {
      const record = pack.record as any;
      return {
        uri: pack.uri,
        cid: pack.cid,
        name: record?.name || "Starter Pack",
        listItemCount: pack.listItemCount,
        joinedAllTimeCount: pack.joinedAllTimeCount,
      };
    }) ?? [];

  const pinnedPostForNative: PinnedPostData | null = pinnedPost
    ? {
        uri: pinnedPost.uri,
        authorHandle: (pinnedPost.author as any)?.handle || "",
        authorDisplayName: (pinnedPost.author as any)?.displayName,
        authorAvatar: (pinnedPost.author as any)?.avatar,
        text: (pinnedPost.record as any)?.text,
        indexedAt: pinnedPost.indexedAt,
        likeCount: pinnedPost.likeCount,
        repostCount: pinnedPost.repostCount,
        replyCount: pinnedPost.replyCount,
      }
    : null;

  // --- Event handlers ---

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
    setIsRefreshing(true);
    if (activeTab === "likes") {
      await Promise.all([refetchProfile(), refetchLikes()]);
    } else {
      await Promise.all([refetchProfile(), refetchFeed()]);
    }
    setIsRefreshing(false);
  }, [activeTab, refetchProfile, refetchFeed, refetchLikes]);

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

  // --- Post list logic ---

  const posts =
    activeTab === "likes"
      ? likesData?.pages.flatMap((page) => page.feed) ?? []
      : feedData?.pages.flatMap((page) => page.feed) ?? [];

  const isLoading = activeTab === "likes" ? isLoadingLikes : isLoadingFeed;
  const fetchNextPage =
    activeTab === "likes" ? fetchNextLikesPage : fetchNextFeedPage;
  const hasNextPage =
    activeTab === "likes" ? hasNextLikesPage : hasNextFeedPage;
  const isFetchingNextPage =
    activeTab === "likes" ? isFetchingNextLikesPage : isFetchingNextFeedPage;

  const handleMentionPress = useCallback(
    (mentionHandle: string, _did: string) => {
      onNavigateToProfile?.(mentionHandle);
    },
    [onNavigateToProfile],
  );

  const handleHashtagPress = useCallback(
    (tag: string) => {
      router.push({
        pathname: "/(tabs)/(search)",
        params: { q: "#" + tag },
      } as any);
    },
    [router],
  );

  const renderPost = useCallback(
    ({ item }: { item: AppBskyFeedDefs.FeedViewPost }) => (
      <InlineErrorBoundary silent context="ProfilePostCard">
        <PostCard
          post={item}
          onPress={() => onNavigateToPost?.(item.post.uri)}
          onPressProfile={(profileHandle) =>
            onNavigateToProfile?.(profileHandle)
          }
          onMentionPress={handleMentionPress}
          onHashtagPress={handleHashtagPress}
        />
      </InlineErrorBoundary>
    ),
    [onNavigateToPost, onNavigateToProfile, handleMentionPress, handleHashtagPress],
  );

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderFooter = useCallback(() => {
    if (!isFetchingNextPage) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }, [isFetchingNextPage, styles, colors]);

  const renderEmpty = useCallback(() => {
    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      );
    }
    const emptyMessage =
      activeTab === "likes" ? "No likes yet" : "No posts yet";
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>{emptyMessage}</Text>
      </View>
    );
  }, [isLoading, activeTab, styles, colors]);

  const renderHeader = useCallback(() => {
    return (
      <>
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
        {pinnedPost && activeTab === "posts" && (
          <InlineErrorBoundary silent context="PinnedPost">
            <View style={styles.pinnedPostContainer}>
              <View style={styles.pinnedPostLabel}>
                <Text style={styles.pinnedPostLabelText}>Pinned</Text>
              </View>
              <PostCard
                post={
                  {
                    post: pinnedPost,
                    reply: undefined,
                  } as AppBskyFeedDefs.FeedViewPost
                }
                onPress={() => onNavigateToPost?.(pinnedPost.uri)}
                onPressProfile={(profileHandle) =>
                  onNavigateToProfile?.(profileHandle)
                }
                onMentionPress={handleMentionPress}
                onHashtagPress={handleHashtagPress}
              />
            </View>
          </InlineErrorBoundary>
        )}
        {activeTab === "posts" && posts.length > 0 && (
          <InlineErrorBoundary silent context="ProfileAIInsights">
            <ProfileAIInsights handle={handle} posts={posts} />
          </InlineErrorBoundary>
        )}
      </>
    );
  }, [
    profileData,
    starterPacksForNative,
    pinnedPostForNative,
    isOwnProfile,
    isLoadingProfile,
    profileError,
    followMutation.isPending,
    unfollowMutation.isPending,
    isStartingConversation,
    activeTab,
    pinnedPost,
    posts,
    handle,
    styles,
    handleTabChange,
    handleFollowToggle,
    handleFollowersPress,
    handleFollowingPress,
    handleMessagePress,
    handleMenuPress,
    handleAddToList,
    handlePinnedPostPress,
    handleStarterPackPress,
    handleKnownFollowerPress,
    handleRefresh,
    refetchProfile,
    onNavigateToPost,
    onNavigateToProfile,
    handleMentionPress,
    handleHashtagPress,
  ]);

  if (isLoadingProfile) {
    return <ProfileSkeleton />;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={posts}
        keyboardDismissMode="on-drag"
        renderItem={renderPost}
        keyExtractor={(item, index) => item.post.uri || `post-${index}`}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        contentContainerStyle={posts.length === 0 ? styles.emptyList : undefined}
      />

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
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingVertical: 48,
    },
    emptyContainer: {
      paddingVertical: 48,
      alignItems: "center",
    },
    emptyText: {
      color: colors.textSecondary,
      fontSize: 16,
    },
    emptyList: {
      flexGrow: 1,
    },
    footerLoader: {
      paddingVertical: 16,
      alignItems: "center",
    },
    pinnedPostContainer: {
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    pinnedPostLabel: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingTop: 8,
      gap: 6,
    },
    pinnedPostLabelText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: "600",
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
      fontSize: 16,
      fontWeight: "500",
      textAlign: "center",
    },
    menuItemDanger: {
      color: colors.danger,
    },
  });
}
