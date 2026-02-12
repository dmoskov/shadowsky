import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Modal,
  Alert,
} from "react-native";
import { useProfile, useFollowUser, useUnfollowUser, useBlockUser, useUnblockUser, useMuteUser, useUnmuteUser } from "../../hooks/api/useProfile";
import { useAuthorFeed } from "../../hooks/api/useFeed";
import { Avatar } from "../../components/Avatar";
import { PostCard } from "../../components/PostCard";
import { AddToListModal } from "../../components/AddToListModal";
import { MoreVerticalIcon } from "../../components/icons";
import { AppBskyFeedDefs } from "@atproto/api";
import { useAuth } from "../../contexts/AuthContext";
import { colors } from "../../constants/theme";

interface ProfileScreenProps {
  handle: string;
  onNavigateToPost?: (uri: string) => void;
  onNavigateToProfile?: (handle: string) => void;
  onNavigateToFollowers?: (actor: string) => void;
  onNavigateToFollowing?: (actor: string) => void;
}

export function ProfileScreen({ handle, onNavigateToPost, onNavigateToProfile, onNavigateToFollowers, onNavigateToFollowing }: ProfileScreenProps) {
  const { data: profile, isLoading: isLoadingProfile, error: profileError, refetch: refetchProfile } = useProfile(handle);
  const {
    data: feedData,
    isLoading: isLoadingFeed,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch: refetchFeed,
    isRefetching,
  } = useAuthorFeed(handle);
  const { account } = useAuth();
  const followMutation = useFollowUser();
  const unfollowMutation = useUnfollowUser();
  const blockMutation = useBlockUser();
  const unblockMutation = useUnblockUser();
  const muteMutation = useMuteUser();
  const unmuteMutation = useUnmuteUser();
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [showAddToList, setShowAddToList] = React.useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const isOwnProfile = account?.handle === handle;

  const handleFollowToggle = () => {
    if (!profile) return;

    if (profile.viewer?.following) {
      unfollowMutation.mutate(profile.viewer.following);
    } else {
      followMutation.mutate(profile.did);
    }
  };

  const posts = feedData?.pages.flatMap((page) => page.feed) ?? [];

  const handleMentionPress = (handle: string, did: string) => {
    onNavigateToProfile?.(handle);
  };

  const handleHashtagPress = (tag: string) => {
    // TODO: Navigate to search with hashtag query
    console.log('Hashtag pressed:', tag);
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
            unblockMutation.mutate(profile.viewer.blocking!, {
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
    await Promise.all([refetchProfile(), refetchFeed()]);
    setIsRefreshing(false);
  };

  const handleReport = () => {
    setShowMenu(false);
    Alert.alert(
      'Report',
      'Reporting functionality will be available soon.',
      [{ text: 'OK' }]
    );
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
        {/* Menu button for non-own profiles */}
        {!isOwnProfile && (
          <TouchableOpacity
            style={styles.headerMenuButton}
            onPress={() => setShowMenu(true)}
            activeOpacity={0.7}>
            <MoreVerticalIcon size={24} color="#9ca3af" />
          </TouchableOpacity>
        )}

        {/* Avatar and Display Name */}
        <View style={styles.profileInfo}>
          <Avatar uri={profile.avatar} size={96} />
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

        {/* Follow/Unfollow Button and Actions */}
        {!isOwnProfile && (
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
              style={styles.addToListButton}
              onPress={() => setShowAddToList(true)}
            >
              <Text style={styles.addToListButtonText}>Add to List</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Posts Header */}
        <Text style={styles.postsHeader}>Posts</Text>
      </View>
    );
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
    if (isLoadingFeed) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No posts yet</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={posts}
        renderItem={renderPost}
        keyExtractor={(item, index) => item.post.uri || `post-${index}`}
        ListHeaderComponent={renderHeader}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0f",
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
    color: "#ef4444",
    fontSize: 16,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
    position: "relative",
  },
  headerMenuButton: {
    position: "absolute",
    top: 16,
    right: 16,
    padding: 8,
    zIndex: 10,
  },
  profileInfo: {
    alignItems: "center",
    marginBottom: 16,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: 8,
  },
  blockedBadge: {
    backgroundColor: "#ef4444",
  },
  mutedBadge: {
    backgroundColor: "#f59e0b",
  },
  blockedByBadge: {
    backgroundColor: "#6b7280",
  },
  statusBadgeText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "600",
  },
  displayName: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "bold",
    marginTop: 12,
  },
  handle: {
    color: "#9ca3af",
    fontSize: 16,
    marginTop: 4,
  },
  bio: {
    color: "#ffffff",
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 16,
    textAlign: "center",
  },
  stats: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 16,
  },
  stat: {
    alignItems: "center",
  },
  statValue: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "bold",
  },
  statLabel: {
    color: "#9ca3af",
    fontSize: 14,
    marginTop: 4,
  },
  actionsContainer: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
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
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  followingButtonText: {
    color: colors.primary,
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
    color: "#ffffff",
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
    color: "#9ca3af",
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
    backgroundColor: "#1f2937",
    borderRadius: 12,
    width: "100%",
    maxWidth: 320,
    overflow: "hidden",
  },
  menuItem: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#374151",
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  menuItemText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "500",
    textAlign: "center",
  },
  menuItemDanger: {
    color: "#ef4444",
  },
});
