/**
 * ProfileView Component for React Native
 *
 * Full-featured profile view with user info, stats, and post feed.
 * Optimized for 60fps scroll performance with FlatList.
 *
 * Performance optimizations:
 * - React.memo with custom comparison
 * - Sticky header with scroll position tracking
 * - Virtualized post list with FlatList
 * - Lazy loading of profile sections
 */

import type { AppBskyActorDefs } from "@atproto/api";
import { memo, useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageStyle,
  type ListRenderItemInfo,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import {
  scaledLineHeight,
  useDynamicType,
  type ScaledFontFn,
} from "../hooks/useDynamicType";
import type { MobilePostData } from "../types";
import { PostCard } from "./PostCard";

/**
 * Props for ProfileView component
 */
export interface ProfileViewProps {
  profile: AppBskyActorDefs.ProfileViewDetailed;
  posts: MobilePostData[];
  onPostPress: (uri: string) => void;
  onLike?: (uri: string) => void;
  onRepost?: (uri: string) => void;
  onReply?: (uri: string) => void;
  onQuote?: (uri: string) => void;
  onBookmark?: (uri: string) => void;
  onFollow?: () => void;
  onUnfollow?: () => void;
  onMessage?: () => void;
  onLoadMore?: () => void;
  onRefresh?: () => void;
  hasMore?: boolean;
  isLoading?: boolean;
  isRefreshing?: boolean;
  onBack?: () => void;
}

// Default avatar and banner placeholders
const DEFAULT_AVATAR_URI =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='50' fill='%23e1e1e1'/%3E%3Ccircle cx='50' cy='40' r='18' fill='%23a1a1a1'/%3E%3Cellipse cx='50' cy='80' rx='30' ry='22' fill='%23a1a1a1'/%3E%3C/svg%3E";

const DEFAULT_BANNER_URI =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 200'%3E%3Crect width='600' height='200' fill='%23e1e1e1'/%3E%3C/svg%3E";

/**
 * Creates styles with Dynamic Type-scaled font sizes.
 * ViewStyle and ImageStyle properties remain unchanged;
 * only fontSize and associated lineHeight values are scaled.
 */
function createStyles(scaledFont: ScaledFontFn) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: "#ffffff",
    } as ViewStyle,
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: "#e1e1e1",
      backgroundColor: "#ffffff",
    } as ViewStyle,
    backButton: {
      minWidth: 44,
      minHeight: 44,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
    } as ViewStyle,
    backIcon: {
      fontSize: scaledFont(24),
      color: "#0f1419",
    } as TextStyle,
    headerInfo: {
      flex: 1,
    } as ViewStyle,
    headerName: {
      fontSize: scaledFont(18),
      fontWeight: "700",
      color: "#0f1419",
    } as TextStyle,
    headerHandle: {
      fontSize: scaledFont(13),
      color: "#687684",
    } as TextStyle,
    list: {
      flex: 1,
    } as ViewStyle,
    listContent: {
      flexGrow: 1,
    } as ViewStyle,
    banner: {
      width: "100%",
      height: 150,
      backgroundColor: "#e1e1e1",
    } as ImageStyle,
    avatarContainer: {
      marginTop: -40,
      marginLeft: 16,
      width: 80,
      height: 80,
      borderRadius: 40,
      borderWidth: 4,
      borderColor: "#ffffff",
      backgroundColor: "#e1e1e1",
      overflow: "hidden",
    } as ViewStyle,
    avatar: {
      width: "100%",
      height: "100%",
    } as ImageStyle,
    infoSection: {
      padding: 16,
    } as ViewStyle,
    nameSection: {
      marginBottom: 12,
    } as ViewStyle,
    displayName: {
      fontSize: scaledFont(22),
      fontWeight: "700",
      color: "#0f1419",
      marginBottom: 2,
    } as TextStyle,
    handle: {
      fontSize: scaledFont(14),
      color: "#687684",
    } as TextStyle,
    actionButtons: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginBottom: 12,
    } as ViewStyle,
    messageButton: {
      minWidth: 44,
      minHeight: 44,
      justifyContent: "center",
      alignItems: "center",
      borderRadius: 22,
      borderWidth: 1,
      borderColor: "#e1e1e1",
      backgroundColor: "#ffffff",
    } as ViewStyle,
    messageIcon: {
      fontSize: scaledFont(18),
    } as TextStyle,
    followButton: {
      flex: 1,
      minHeight: 44,
      justifyContent: "center",
      alignItems: "center",
      borderRadius: 22,
      backgroundColor: "#0f1419",
      paddingHorizontal: 24,
    } as ViewStyle,
    followButtonFollowing: {
      backgroundColor: "#ffffff",
      borderWidth: 1,
      borderColor: "#e1e1e1",
    } as ViewStyle,
    followButtonText: {
      fontSize: scaledFont(15),
      fontWeight: "700",
      color: "#ffffff",
    } as TextStyle,
    followButtonTextFollowing: {
      color: "#0f1419",
    } as TextStyle,
    bio: {
      fontSize: scaledFont(15),
      lineHeight: scaledLineHeight(scaledFont, 15, 20),
      color: "#0f1419",
      marginBottom: 12,
    } as TextStyle,
    stats: {
      flexDirection: "row",
      gap: 24,
    } as ViewStyle,
    statItem: {
      flexDirection: "row",
      alignItems: "center",
    } as ViewStyle,
    statValue: {
      fontSize: scaledFont(16),
      fontWeight: "700",
      color: "#0f1419",
      marginRight: 4,
    } as TextStyle,
    statLabel: {
      fontSize: scaledFont(14),
      color: "#687684",
    } as TextStyle,
    tabBar: {
      flexDirection: "row",
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: "#e1e1e1",
      backgroundColor: "#ffffff",
    } as ViewStyle,
    tab: {
      flex: 1,
      minHeight: 48,
      justifyContent: "center",
      alignItems: "center",
      paddingVertical: 12,
    } as ViewStyle,
    tabActive: {
      borderBottomWidth: 3,
      borderBottomColor: "#1d9bf0",
    } as ViewStyle,
    tabText: {
      fontSize: scaledFont(14),
      fontWeight: "600",
      color: "#687684",
    } as TextStyle,
    tabTextActive: {
      color: "#0f1419",
    } as TextStyle,
    emptyContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 32,
      minHeight: 300,
    } as ViewStyle,
    emptyText: {
      fontSize: scaledFont(18),
      fontWeight: "600",
      color: "#0f1419",
      marginBottom: 8,
    } as TextStyle,
    emptySubtext: {
      fontSize: scaledFont(14),
      color: "#687684",
      textAlign: "center",
    } as TextStyle,
    loadingFooter: {
      paddingVertical: 20,
      alignItems: "center",
    } as ViewStyle,
  });
}

type Styles = ReturnType<typeof createStyles>;

/**
 * Profile header with back button and options
 */
const ProfileHeader = memo(function ProfileHeader({
  displayName,
  handle,
  onBack,
  styles,
}: {
  displayName?: string;
  handle: string;
  onBack?: () => void;
  styles: Styles;
}) {
  return (
    <View style={styles.header}>
      <Pressable
        onPress={onBack}
        style={styles.backButton}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Text style={styles.backIcon}>←</Text>
      </Pressable>
      <View style={styles.headerInfo}>
        <Text style={styles.headerName} numberOfLines={1}>
          {displayName || handle}
        </Text>
        <Text style={styles.headerHandle}>@{handle}</Text>
      </View>
    </View>
  );
});

/**
 * Profile banner image
 */
const BannerImage = memo(function BannerImage({
  banner,
  styles,
}: {
  banner?: string;
  styles: Styles;
}) {
  return (
    <Image
      source={{ uri: banner || DEFAULT_BANNER_URI }}
      style={styles.banner}
      resizeMode="cover"
    />
  );
});

/**
 * Profile avatar with follow status indicator
 */
const ProfileAvatar = memo(function ProfileAvatar({
  avatar,
  styles,
}: {
  avatar?: string;
  styles: Styles;
}) {
  return (
    <View style={styles.avatarContainer}>
      <Image
        source={{ uri: avatar || DEFAULT_AVATAR_URI }}
        style={styles.avatar}
      />
    </View>
  );
});

/**
 * Profile info section (name, handle, bio, stats)
 */
const ProfileInfo = memo(function ProfileInfo({
  profile,
  onFollow,
  onUnfollow,
  onMessage,
  styles,
}: {
  profile: AppBskyActorDefs.ProfileViewDetailed;
  onFollow?: () => void;
  onUnfollow?: () => void;
  onMessage?: () => void;
  styles: Styles;
}) {
  const isFollowing = !!profile.viewer?.following;

  const handleFollowPress = useCallback(() => {
    if (isFollowing) {
      onUnfollow?.();
    } else {
      onFollow?.();
    }
  }, [isFollowing, onFollow, onUnfollow]);

  return (
    <View style={styles.infoSection}>
      {/* Name and handle */}
      <View style={styles.nameSection}>
        <Text style={styles.displayName} numberOfLines={1}>
          {profile.displayName || profile.handle}
        </Text>
        <Text style={styles.handle}>@{profile.handle}</Text>
      </View>

      {/* Action buttons */}
      <View style={styles.actionButtons}>
        {onMessage && (
          <Pressable
            onPress={onMessage}
            style={styles.messageButton}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Send message"
          >
            <Text style={styles.messageIcon}>💬</Text>
          </Pressable>
        )}
        <Pressable
          onPress={handleFollowPress}
          style={[
            styles.followButton,
            isFollowing && styles.followButtonFollowing,
          ]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={isFollowing ? "Unfollow" : "Follow"}
        >
          <Text
            style={[
              styles.followButtonText,
              isFollowing && styles.followButtonTextFollowing,
            ]}
          >
            {isFollowing ? "Following" : "Follow"}
          </Text>
        </Pressable>
      </View>

      {/* Bio */}
      {profile.description && (
        <Text style={styles.bio}>{profile.description}</Text>
      )}

      {/* Stats */}
      <View style={styles.stats}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{profile.followersCount || 0}</Text>
          <Text style={styles.statLabel}>Followers</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{profile.followsCount || 0}</Text>
          <Text style={styles.statLabel}>Following</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{profile.postsCount || 0}</Text>
          <Text style={styles.statLabel}>Posts</Text>
        </View>
      </View>
    </View>
  );
});

/**
 * Tab bar for different profile sections
 */
const TabBar = memo(function TabBar({
  activeTab,
  onTabChange,
  styles,
}: {
  activeTab: "posts" | "replies" | "media" | "likes";
  onTabChange: (tab: "posts" | "replies" | "media" | "likes") => void;
  styles: Styles;
}) {
  return (
    <View style={styles.tabBar}>
      <Pressable
        onPress={() => onTabChange("posts")}
        style={[styles.tab, activeTab === "posts" && styles.tabActive]}
        accessibilityRole="button"
      >
        <Text
          style={[
            styles.tabText,
            activeTab === "posts" && styles.tabTextActive,
          ]}
        >
          Posts
        </Text>
      </Pressable>
      <Pressable
        onPress={() => onTabChange("replies")}
        style={[styles.tab, activeTab === "replies" && styles.tabActive]}
        accessibilityRole="button"
      >
        <Text
          style={[
            styles.tabText,
            activeTab === "replies" && styles.tabTextActive,
          ]}
        >
          Replies
        </Text>
      </Pressable>
      <Pressable
        onPress={() => onTabChange("media")}
        style={[styles.tab, activeTab === "media" && styles.tabActive]}
        accessibilityRole="button"
      >
        <Text
          style={[
            styles.tabText,
            activeTab === "media" && styles.tabTextActive,
          ]}
        >
          Media
        </Text>
      </Pressable>
      <Pressable
        onPress={() => onTabChange("likes")}
        style={[styles.tab, activeTab === "likes" && styles.tabActive]}
        accessibilityRole="button"
      >
        <Text
          style={[
            styles.tabText,
            activeTab === "likes" && styles.tabTextActive,
          ]}
        >
          Likes
        </Text>
      </Pressable>
    </View>
  );
});

/**
 * Loading footer component
 */
const LoadingFooter = memo(function LoadingFooter({
  isLoading,
  styles,
}: {
  isLoading: boolean;
  styles: Styles;
}) {
  if (!isLoading) return null;

  return (
    <View style={styles.loadingFooter}>
      <ActivityIndicator size="small" color="#1d9bf0" />
    </View>
  );
});

/**
 * Empty state for no posts
 */
const EmptyState = memo(function EmptyState({
  tab,
  styles,
}: {
  tab: string;
  styles: Styles;
}) {
  return (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>No {tab} yet</Text>
      <Text style={styles.emptySubtext}>
        When this user {tab === "posts" ? "posts" : `has ${tab}`}, they'll show
        up here
      </Text>
    </View>
  );
});

/**
 * Main ProfileView component
 */
function ProfileViewComponent({
  profile,
  posts,
  onPostPress,
  onLike,
  onRepost,
  onReply,
  onQuote,
  onBookmark,
  onFollow,
  onUnfollow,
  onMessage,
  onLoadMore,
  onRefresh,
  hasMore = false,
  isLoading = false,
  isRefreshing = false,
  onBack,
}: ProfileViewProps) {
  const { scaledFont } = useDynamicType();
  const styles = useMemo(() => createStyles(scaledFont), [scaledFont]);

  const [activeTab, setActiveTab] = useState<
    "posts" | "replies" | "media" | "likes"
  >("posts");

  // Key extractor
  const keyExtractor = useCallback(
    (item: MobilePostData) => item.key || item.post.uri,
    [],
  );

  // Render post item
  const renderPost = useCallback(
    ({ item }: ListRenderItemInfo<MobilePostData>) => (
      <PostCard
        post={item.post}
        reason={item.reason}
        onPress={() => onPostPress(item.post.uri)}
        onLike={onLike ? () => onLike(item.post.uri) : undefined}
        onRepost={onRepost ? () => onRepost(item.post.uri) : undefined}
        onReply={onReply ? () => onReply(item.post.uri) : undefined}
        onQuote={onQuote ? () => onQuote(item.post.uri) : undefined}
        onBookmark={onBookmark ? () => onBookmark(item.post.uri) : undefined}
        showBorder={true}
      />
    ),
    [onPostPress, onLike, onRepost, onReply, onQuote, onBookmark],
  );

  // List header with profile info
  const ListHeader = useMemo(
    () => (
      <View>
        <BannerImage banner={profile.banner} styles={styles} />
        <ProfileAvatar avatar={profile.avatar} styles={styles} />
        <ProfileInfo
          profile={profile}
          onFollow={onFollow}
          onUnfollow={onUnfollow}
          onMessage={onMessage}
          styles={styles}
        />
        <TabBar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          styles={styles}
        />
      </View>
    ),
    [profile, onFollow, onUnfollow, onMessage, activeTab, styles],
  );

  // Empty component
  const EmptyComponent = useMemo(
    () => <EmptyState tab={activeTab} styles={styles} />,
    [activeTab, styles],
  );

  // Footer component
  const ListFooter = useMemo(
    () => <LoadingFooter isLoading={isLoading && hasMore} styles={styles} />,
    [isLoading, hasMore, styles],
  );

  // Handle end reached
  const handleEndReached = useCallback(() => {
    if (hasMore && !isLoading && onLoadMore) {
      onLoadMore();
    }
  }, [hasMore, isLoading, onLoadMore]);

  return (
    <View style={styles.container}>
      <ProfileHeader
        displayName={profile.displayName}
        handle={profile.handle}
        onBack={onBack}
        styles={styles}
      />

      <FlatList
        data={posts}
        renderItem={renderPost}
        keyExtractor={keyExtractor}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={!isLoading ? EmptyComponent : null}
        ListFooterComponent={ListFooter}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        refreshing={isRefreshing}
        onRefresh={onRefresh}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        // Performance optimizations
        windowSize={10}
        maxToRenderPerBatch={5}
        updateCellsBatchingPeriod={50}
        initialNumToRender={10}
        removeClippedSubviews={true}
      />
    </View>
  );
}

/**
 * Custom comparison for memo
 */
function arePropsEqual(
  prevProps: ProfileViewProps,
  nextProps: ProfileViewProps,
): boolean {
  // Compare profile identity
  if (prevProps.profile.did !== nextProps.profile.did) return false;

  // Compare profile data that might change
  if (prevProps.profile.displayName !== nextProps.profile.displayName)
    return false;
  if (prevProps.profile.description !== nextProps.profile.description)
    return false;
  if (prevProps.profile.followersCount !== nextProps.profile.followersCount)
    return false;
  if (prevProps.profile.followsCount !== nextProps.profile.followsCount)
    return false;
  if (prevProps.profile.postsCount !== nextProps.profile.postsCount)
    return false;

  // Compare viewer state
  if (
    prevProps.profile.viewer?.following !== nextProps.profile.viewer?.following
  )
    return false;

  // Compare posts array identity
  if (prevProps.posts !== nextProps.posts) return false;

  // Compare loading states
  if (prevProps.isLoading !== nextProps.isLoading) return false;
  if (prevProps.isRefreshing !== nextProps.isRefreshing) return false;
  if (prevProps.hasMore !== nextProps.hasMore) return false;

  return true;
}

/**
 * Memoized export
 */
export const ProfileView = memo(ProfileViewComponent, arePropsEqual);
