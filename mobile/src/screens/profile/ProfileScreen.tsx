import React, { useState, useMemo } from "react";
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
} from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useProfile, useFollowUser, useUnfollowUser, useBlockUser, useUnblockUser, useMuteUser, useUnmuteUser } from "../../hooks/api/useProfile";
import { useAuthorFeed, useActorLikes, usePostThread } from "../../hooks/api/useFeed";
import { useActorStarterPacks } from "../../hooks/api/useStarterPacks";
import { Avatar } from "../../components/Avatar";
import { PostCard } from "../../components/PostCard";
import { ProfileTabBar, ProfileTab } from "../../components/ProfileTabBar";
import { AddToListModal } from "../../components/AddToListModal";
import { ReportModal } from "../../components/ReportModal";
import { ProfileSkeleton } from "../../components/ProfileSkeleton";
import { MoreVerticalIcon, SendIcon } from "../../components/icons";
import { AppBskyFeedDefs } from "@atproto/api";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { AuthorFeedFilter } from "../../services/atproto/feeds";
import { dmService } from "../../services/dm-service";
import { useSpotlightProfile } from "../../hooks/useSpotlightIndex";


import { createLogger } from '../../utils/logger';

const logger = createLogger('ProfileScreen');
interface ProfileScreenProps {
  handle: string;
  onNavigateToPost?: (uri: string) => void;
  onNavigateToProfile?: (handle: string) => void;
  onNavigateToFollowers?: (actor: string) => void;
  onNavigateToFollowing?: (actor: string) => void;
  onNavigateToMessages?: (conversationId: string) => void;
}

export function ProfileScreen({ handle, onNavigateToPost, onNavigateToProfile, onNavigateToFollowers, onNavigateToFollowing, onNavigateToMessages }: ProfileScreenProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const { data: profile, isLoading: isLoadingProfile, error: profileError, refetch: refetchProfile } = useProfile(handle);
  const [activeTab, setActiveTab] = useState<ProfileTab>("posts");
  const [isStartingConversation, setIsStartingConversation] = useState(false);
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Index profile in Spotlight when viewed
  useSpotlightProfile(profile ? {
    handle: profile.handle,
    displayName: profile.displayName,
    description: profile.description,
    avatar: profile.avatar,
    did: profile.did,
  } : null);

  // Get the appropriate filter based on the active tab
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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showAddToList, setShowAddToList] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  // Fetch starter packs for this actor
  const { data: starterPacksData } = useActorStarterPacks(handle);

  // Fetch pinned post if the profile has one
  const pinnedPostUri = profile?.pinnedPost?.uri;
  const { data: pinnedPostThread } = usePostThread(pinnedPostUri ?? "");
  const pinnedPost = pinnedPostThread && "post" in pinnedPostThread ? pinnedPostThread.post as AppBskyFeedDefs.PostView : null;

  const isOwnProfile = account?.handle === handle;

  const handleFollowToggle = () => {
    if (!profile) return;

    if (profile.viewer?.following) {
      unfollowMutation.mutate(profile.viewer.following);
    } else {
      followMutation.mutate(profile.did);
    }
  };

  // Get posts based on the active tab
  const posts = activeTab === "likes"
    ? likesData?.pages.flatMap((page) => page.feed) ?? []
    : feedData?.pages.flatMap((page) => page.feed) ?? [];

  const isLoading = activeTab === "likes" ? isLoadingLikes : isLoadingFeed;
  const fetchNextPage = activeTab === "likes" ? fetchNextLikesPage : fetchNextFeedPage;
  const hasNextPage = activeTab === "likes" ? hasNextLikesPage : hasNextFeedPage;
  const isFetchingNextPage = activeTab === "likes" ? isFetchingNextLikesPage : isFetchingNextFeedPage;

  const handleMentionPress = (handle: string, _did: string) => {
    onNavigateToProfile?.(handle);
  };

  const handleHashtagPress = (tag: string) => {
    router.push({ pathname: '/(tabs)/(search)', params: { q: '#' + tag } } as any);
  };

  const handleBlock = () => {
    if (!profile) return;
    setShowMenu(false);
    Alert.alert(
      'Block User',
      `Are you sure you want to block @${profile.handle}? You won't see their posts and they won't be able to follow you or see your posts.`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Block',
          style: 'destructive',
          onPress: () => {
            blockMutation.mutate(profile.did, {
              onSuccess: () => {
                refetchProfile();
              },
            });
          },
        },
      ]
    );
  };

  const handleUnblock = () => {
    if (!profile?.viewer?.blocking) return;
    setShowMenu(false);
    Alert.alert(
      'Unblock User',
      `Are you sure you want to unblock @${profile.handle}?`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Unblock',
          style: 'default',
          onPress: () => {
            unblockMutation.mutate(profile.viewer!.blocking!, {
              onSuccess: () => {
                refetchProfile();
              },
            });
          },
        },
      ]
    );
  };

  const handleMute = () => {
    if (!profile) return;
    setShowMenu(false);
    Alert.alert(
      'Mute User',
      `Are you sure you want to mute @${profile.handle}? You won't see their posts in your timeline.`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Mute',
          style: 'default',
          onPress: () => {
            muteMutation.mutate(profile.did, {
              onSuccess: () => {
                refetchProfile();
              },
            });
          },
        },
      ]
    );
  };

  const handleUnmute = () => {
    if (!profile) return;
    setShowMenu(false);
    Alert.alert(
      'Unmute User',
      `Are you sure you want to unmute @${profile.handle}?`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Unmute',
          style: 'default',
          onPress: () => {
            unmuteMutation.mutate(profile.did, {
              onSuccess: () => {
                refetchProfile();
              },
            });
          },
        },
      ]
    );
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    if (activeTab === "likes") {
      await Promise.all([refetchProfile(), refetchLikes()]);
    } else {
      await Promise.all([refetchProfile(), refetchFeed()]);
    }
    setIsRefreshing(false);
  };

  const handleTabChange = (tab: ProfileTab) => {
    setActiveTab(tab);
  };

  const handleReport = () => {
    setShowMenu(false);
    setShowReportModal(true);
  };

  const handleBlockAfterReport = async (did: string) => {
    if (!profile) return;
    try {
      await blockMutation.mutateAsync(did);
      Alert.alert('Success', `@${profile.handle} has been blocked.`);
    } catch (error) {
      Alert.alert('Error', 'Failed to block user. Please try again.');
    }
  };

  const handleMuteAfterReport = async (did: string) => {
    if (!profile) return;
    try {
      await muteMutation.mutateAsync(did);
      Alert.alert('Success', `@${profile.handle} has been muted.`);
    } catch (error) {
      Alert.alert('Error', 'Failed to mute user. Please try again.');
    }
  };

  const handleStartConversation = async () => {
    if (!profile) return;

    setIsStartingConversation(true);

    try {
      // Get or create conversation with this user
      const conversation = await dmService.getConvoForMembers([profile.did]);

      // Navigate to messages with the conversation
      if (onNavigateToMessages) {
        onNavigateToMessages(conversation.id);
      } else {
        // Fallback to messages screen
        router.push('/(app)/(tabs)/(profile)/messages');
      }
    } catch (error) {
      logger.error('Failed to start conversation:', error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to start conversation";
      Alert.alert("Error", errorMessage);
    } finally {
      setIsStartingConversation(false);
    }
  };

  const renderPost = ({ item }: { item: AppBskyFeedDefs.FeedViewPost }) => (
    <PostCard
      post={item}
      onPress={() => onNavigateToPost?.(item.post.uri)}
      onPressProfile={(handle) => onNavigateToProfile?.(handle)}
      onMentionPress={handleMentionPress}
      onHashtagPress={handleHashtagPress}
    />
  );

  const renderHeader = () => {
    if (isLoadingProfile) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      );
    }

    if (profileError || !profile) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Failed to load profile</Text>
        </View>
      );
    }

    const isBlocked = !!profile.viewer?.blocking;
    const isMuted = !!profile.viewer?.muted;
    const isBlockedBy = !!profile.viewer?.blockedBy;

    return (
      <View style={styles.header}>
        {/* Banner Image */}
        <View style={styles.bannerContainer}>
          {profile.banner ? (
            <Image
              source={{ uri: profile.banner }}
              style={styles.bannerImage}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={200}
            />
          ) : (
            <View style={styles.bannerPlaceholder} />
          )}
          {/* Menu button for non-own profiles */}
          {!isOwnProfile && (
            <TouchableOpacity
              style={styles.headerMenuButton}
              onPress={() => setShowMenu(true)}
              activeOpacity={0.7}>
              <MoreVerticalIcon size={24} color="#ffffff" />
            </TouchableOpacity>
          )}
        </View>

        {/* Avatar overlapping banner */}
        <View style={styles.profileInfo}>
          <View style={styles.avatarWrapper}>
            <Avatar uri={profile.avatar} size={80} />
          </View>
          <Text style={styles.displayName}>
            {profile.displayName || profile.handle}
          </Text>
          <Text style={styles.handle}>@{profile.handle}</Text>

          {/* Block/Mute Status Indicators */}
          {isBlocked && (
            <View style={[styles.statusBadge, styles.blockedBadge]}>
              <Text style={styles.statusBadgeText}>Blocked</Text>
            </View>
          )}
          {isMuted && !isBlocked && (
            <View style={[styles.statusBadge, styles.mutedBadge]}>
              <Text style={styles.statusBadgeText}>Muted</Text>
            </View>
          )}
          {isBlockedBy && !isBlocked && (
            <View style={[styles.statusBadge, styles.blockedByBadge]}>
              <Text style={styles.statusBadgeText}>Blocks you</Text>
            </View>
          )}
        </View>

        {/* Bio */}
        {profile.description && (
          <Text style={styles.bio}>{profile.description}</Text>
        )}

        {/* Stats */}
        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{profile.postsCount ?? 0}</Text>
            <Text style={styles.statLabel}>Posts</Text>
          </View>
          <TouchableOpacity
            style={styles.stat}
            onPress={() => onNavigateToFollowers?.(profile.handle)}
            activeOpacity={0.7}>
            <Text style={styles.statValue}>{profile.followersCount ?? 0}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.stat}
            onPress={() => onNavigateToFollowing?.(profile.handle)}
            activeOpacity={0.7}>
            <Text style={styles.statValue}>{profile.followsCount ?? 0}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </TouchableOpacity>
        </View>

        {/* Starter Packs */}
        {starterPacksData?.starterPacks && starterPacksData.starterPacks.length > 0 && (
          <View style={styles.starterPacksContainer}>
            <Text style={styles.starterPacksTitle}>Starter Packs</Text>
            {starterPacksData.starterPacks.map((pack) => {
              const record = pack.record as any;
              const name = record?.name || 'Starter Pack';
              return (
                <TouchableOpacity
                  key={pack.uri}
                  style={styles.starterPackItem}
                  onPress={() => {
                    const encodedUri = encodeURIComponent(pack.uri);
                    router.push(`/(app)/(tabs)/(home)/starter-pack/${encodedUri}`);
                  }}
                  activeOpacity={0.7}>
                  <View style={styles.starterPackInfo}>
                    <Text style={styles.starterPackName}>{name}</Text>
                    {pack.listItemCount !== undefined && (
                      <Text style={styles.starterPackMeta}>
                        {pack.listItemCount} members
                      </Text>
                    )}
                    {pack.joinedAllTimeCount !== undefined && (
                      <Text style={styles.starterPackMeta}>
                        {pack.joinedAllTimeCount} joined
                      </Text>
                    )}
                  </View>
                  <Text style={styles.starterPackArrow}>›</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Follow/Unfollow Button and Actions */}
        {!isOwnProfile && (
          <>
            <View style={styles.actionsContainer}>
              <TouchableOpacity
                style={[
                  styles.followButton,
                  profile.viewer?.following && styles.followingButton,
                ]}
                onPress={handleFollowToggle}
                disabled={followMutation.isPending || unfollowMutation.isPending}
              >
                <Text
                  style={[
                    styles.followButtonText,
                    profile.viewer?.following && styles.followingButtonText,
                  ]}
                >
                  {followMutation.isPending || unfollowMutation.isPending
                    ? "..."
                    : profile.viewer?.following
                    ? "Following"
                    : "Follow"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.messageButton}
                onPress={handleStartConversation}
                disabled={isStartingConversation}
              >
                {isStartingConversation ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <SendIcon size={20} color={colors.primary} />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.addToListButton}
                onPress={() => setShowAddToList(true)}
              >
                <Text style={styles.addToListButtonText}>Add to List</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

      </View>
    );
  };

  const renderTabBar = () => {
    return <ProfileTabBar activeTab={activeTab} onTabChange={handleTabChange} />;
  };

  const renderFooter = () => {
    if (!isFetchingNextPage) return null;

    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  };

  const renderEmpty = () => {
    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      );
    }

    const emptyMessage = activeTab === "likes" ? "No likes yet" : "No posts yet";
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>{emptyMessage}</Text>
      </View>
    );
  };

  // Show skeleton when initially loading profile
  if (isLoadingProfile) {
    return <ProfileSkeleton />;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={posts}
        renderItem={renderPost}
        keyExtractor={(item, index) => item.post.uri || `post-${index}`}
        ListHeaderComponent={
          <>
            {renderHeader()}
            {renderTabBar()}
            {pinnedPost && activeTab === "posts" && (
              <View style={styles.pinnedPostContainer}>
                <View style={styles.pinnedPostLabel}>
                  <Text style={styles.pinnedPostLabelText}>Pinned</Text>
                </View>
                <PostCard
                  post={{ post: pinnedPost, reply: undefined } as AppBskyFeedDefs.FeedViewPost}
                  onPress={() => onNavigateToPost?.(pinnedPost.uri)}
                  onPressProfile={(profileHandle) => onNavigateToProfile?.(profileHandle)}
                  onMentionPress={handleMentionPress}
                  onHashtagPress={handleHashtagPress}
                />
              </View>
            )}
          </>
        }
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
          }
        }}
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
      {profile && (
        <AddToListModal
          visible={showAddToList}
          onClose={() => setShowAddToList(false)}
          userDid={profile.did}
          userHandle={profile.handle}
        />
      )}

      {/* Menu Modal */}
      {profile && !isOwnProfile && (
        <Modal
          visible={showMenu}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowMenu(false)}>
          <TouchableOpacity
            style={styles.menuOverlay}
            activeOpacity={1}
            onPress={() => setShowMenu(false)}>
            <View style={styles.menuContainer}>
              {profile.viewer?.muted ? (
                <TouchableOpacity style={styles.menuItem} onPress={handleUnmute}>
                  <Text style={styles.menuItemText}>Unmute @{profile.handle}</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.menuItem} onPress={handleMute}>
                  <Text style={styles.menuItemText}>Mute @{profile.handle}</Text>
                </TouchableOpacity>
              )}
              {profile.viewer?.blocking ? (
                <TouchableOpacity style={styles.menuItem} onPress={handleUnblock}>
                  <Text style={styles.menuItemText}>Unblock @{profile.handle}</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.menuItem} onPress={handleBlock}>
                  <Text style={[styles.menuItemText, styles.menuItemDanger]}>
                    Block @{profile.handle}
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.menuItem} onPress={handleReport}>
                <Text style={[styles.menuItemText, styles.menuItemDanger]}>Report</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.menuItem, styles.menuItemLast]}
                onPress={() => setShowMenu(false)}>
                <Text style={styles.menuItemText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Report Modal */}
      {profile && (
        <ReportModal
          visible={showReportModal}
          onClose={() => setShowReportModal(false)}
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 48,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 48,
  },
  errorText: {
    color: colors.danger,
    fontSize: 16,
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceElevated,
    position: "relative",
  },
  bannerContainer: {
    width: "100%",
    height: 150,
    position: "relative",
  },
  bannerImage: {
    width: "100%",
    height: "100%",
  },
  bannerPlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: colors.surfaceElevated,
  },
  headerMenuButton: {
    position: "absolute",
    top: 12,
    right: 12,
    padding: 8,
    zIndex: 10,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    borderRadius: 20,
  },
  profileInfo: {
    alignItems: "center",
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  avatarWrapper: {
    marginTop: -40,
    marginBottom: 8,
    borderRadius: 44,
    borderWidth: 3,
    borderColor: colors.background,
    overflow: "hidden",
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: 8,
  },
  blockedBadge: {
    backgroundColor: colors.danger,
  },
  mutedBadge: {
    backgroundColor: colors.warning,
  },
  blockedByBadge: {
    backgroundColor: colors.textTertiary,
  },
  statusBadgeText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "600",
  },
  displayName: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "bold",
    marginTop: 12,
  },
  handle: {
    color: colors.textSecondary,
    fontSize: 16,
    marginTop: 4,
  },
  bio: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 16,
    textAlign: "center",
    paddingHorizontal: 16,
  },
  stats: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  stat: {
    alignItems: "center",
  },
  statValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "bold",
  },
  statLabel: {
    color: colors.textSecondary,
    fontSize: 14,
    marginTop: 4,
  },
  actionsContainer: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  followButton: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    alignItems: "center",
  },
  followingButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.primary,
  },
  followButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
  followingButtonText: {
    color: colors.primary,
  },
  messageButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 56,
  },
  addToListButton: {
    flex: 1,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    alignItems: "center",
  },
  addToListButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: "600",
  },
  postsHeader: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 8,
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems: "center",
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
  starterPacksContainer: {
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  starterPacksTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
  },
  starterPackItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surfaceElevated,
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  starterPackInfo: {
    flex: 1,
  },
  starterPackName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  starterPackMeta: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  starterPackArrow: {
    color: colors.primary,
    fontSize: 24,
    fontWeight: "300",
    marginLeft: 8,
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
  });
}
