import React, { useRef, useState, useMemo, useCallback } from "react";
import { AppBskyFeedDefs } from "@atproto/api";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  RefreshControl,
} from "react-native";
import { useScrollToTop } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { Avatar } from "../../components/Avatar";
import { PostCard } from "../../components/PostCard";
import { ProfileTabBar, ProfileTab } from "../../components/ProfileTabBar";
import { useAuth } from "../../contexts/AuthContext";
import { useAuthorFeed, useActorLikes, usePostThread } from "../../hooks/api/useFeed";
import { useTopPosts } from "../../hooks/api/useTopPosts";
import { useProfile } from "../../hooks/api/useProfile";
import { useActorStarterPacks } from "../../hooks/api/useStarterPacks";
import { useBookmarks, useBookmarkCount } from "../../hooks/api/useBookmarks";
import { useTheme } from "../../contexts/ThemeContext";
import { ProfileSkeleton } from "../../components/ProfileSkeleton";
import { TopPostsShowcase } from "../../components/TopPostsShowcase";
import { PinIcon } from "../../components/icons";
import { AuthorFeedFilter } from "../../services/atproto/feeds";
import { triggerHaptic } from "../../utils/haptics";
import {fontSize} from '../../utils/typography';

interface MyProfileScreenProps {
  onNavigateToPost?: (uri: string) => void;
  onNavigateToProfile?: (handle: string) => void;
  onNavigateToEditProfile?: () => void;
  onNavigateToFollowers?: (actor: string) => void;
  onNavigateToFollowing?: (actor: string) => void;
  onSignOut?: () => void;
}

export function MyProfileScreen({
  onNavigateToPost,
  onNavigateToProfile,
  onNavigateToEditProfile,
  onNavigateToFollowers,
  onNavigateToFollowing,
  onSignOut,
}: MyProfileScreenProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { account, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<ProfileTab>("posts");
  const { data: profile, isLoading: isLoadingProfile, refetch: refetchProfile } = useProfile(
    account?.handle || "",
  );

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

  // Use different hooks based on the active tab
  const {
    data: feedData,
    isLoading: isLoadingFeed,
    fetchNextPage: fetchNextFeedPage,
    hasNextPage: hasNextFeedPage,
    isFetchingNextPage: isFetchingNextFeedPage,
    refetch: refetchFeed,
  } = useAuthorFeed(account?.handle || "", getFilter());

  const {
    data: likesData,
    isLoading: isLoadingLikes,
    fetchNextPage: fetchNextLikesPage,
    hasNextPage: hasNextLikesPage,
    isFetchingNextPage: isFetchingNextLikesPage,
    refetch: refetchLikes,
  } = useActorLikes(account?.handle || "");

  const [isRefreshing, setIsRefreshing] = useState(false);
  const scrollRef = useRef<FlatList>(null);

  // Fetch starter packs for this user
  const { data: starterPacksData } = useActorStarterPacks(account?.handle || "");
  const { isBookmarked, toggleBookmark } = useBookmarks();
  const bookmarkCount = useBookmarkCount();

  // Fetch pinned post if the profile has one
  const pinnedPostUri = profile?.pinnedPost?.uri;
  const { data: pinnedPostThread } = usePostThread(pinnedPostUri ?? "");
  const pinnedPost = pinnedPostThread && "post" in pinnedPostThread ? pinnedPostThread.post as AppBskyFeedDefs.PostView : null;

  // Fetch top posts by engagement
  const { data: topPostsData, isLoading: isTopPostsLoading } = useTopPosts({
    handle: account?.handle || "",
    limit: 10,
    enabled: !!account?.handle,
  });

  // Enable scroll-to-top on tab press
  useScrollToTop(scrollRef);

  const handleSignOut = async () => {
    try {
      await signOut();
      onSignOut?.();
    } catch (error) {
      // Error is handled by the auth context
    }
  };

  // Build top-posts feed items so FlatList can render them
  const topPostsFeedItems: AppBskyFeedDefs.FeedViewPost[] = useMemo(() => {
    if (!topPostsData?.topPosts) return [];
    return topPostsData.topPosts.map((item) => ({
      post: item.post,
      reply: undefined,
      reason: undefined,
      feedContext: undefined,
    } as AppBskyFeedDefs.FeedViewPost));
  }, [topPostsData]);

  // Get posts based on the active tab
  const posts = activeTab === "likes"
    ? likesData?.pages.flatMap((page) => page.feed) ?? []
    : activeTab === "top"
    ? topPostsFeedItems
    : feedData?.pages.flatMap((page) => page.feed) ?? [];

  const isLoading = activeTab === "likes" ? isLoadingLikes : activeTab === "top" ? isTopPostsLoading : isLoadingFeed;
  const fetchNextPage = activeTab === "likes" ? fetchNextLikesPage : fetchNextFeedPage;
  const hasNextPage = activeTab === "likes" ? hasNextLikesPage : activeTab === "top" ? false : hasNextFeedPage;
  const isFetchingNextPage = activeTab === "likes" ? isFetchingNextLikesPage : activeTab === "top" ? false : isFetchingNextFeedPage;

  const handleMentionPress = useCallback((mentionHandle: string, _did: string) => {
    onNavigateToProfile?.(mentionHandle);
  }, [onNavigateToProfile]);

  const handleHashtagPress = useCallback((tag: string) => {
    router.push({ pathname: '/(tabs)/(search)', params: { q: '#' + tag } } as any);
  }, [router]);

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
    // Scroll to top when changing tabs
    scrollRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  const handleBookmark = (post: AppBskyFeedDefs.FeedViewPost) => {
    triggerHaptic("light");
    toggleBookmark(post.post);
  };

  const renderPost = ({ item }: { item: AppBskyFeedDefs.FeedViewPost }) => (
    <PostCard
      post={item}
      onPress={() => onNavigateToPost?.(item.post.uri)}
      onPressProfile={(handle) => onNavigateToProfile?.(handle)}
      onBookmark={() => handleBookmark(item)}
      isBookmarked={isBookmarked(item.post.uri)}
      onMentionPress={handleMentionPress}
      onHashtagPress={handleHashtagPress}
    />
  );

  const renderHeader = () => {
    if (isLoadingProfile || !profile) {
      return <ProfileSkeleton />;
    }

    return (
      <View style={styles.header}>
        {/* Avatar and Display Name */}
        <View style={styles.profileInfo}>
          <Avatar uri={profile.avatar} size={96} />
          <Text style={styles.displayName}>
            {profile.displayName || profile.handle}
          </Text>
          <Text style={styles.handle}>@{profile.handle}</Text>
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
            onPress={() => onNavigateToFollowers?.(account?.handle || "")}
            activeOpacity={0.7}>
            <Text style={styles.statValue}>{profile.followersCount ?? 0}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.stat}
            onPress={() => onNavigateToFollowing?.(account?.handle || "")}
            activeOpacity={0.7}>
            <Text style={styles.statValue}>{profile.followsCount ?? 0}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </TouchableOpacity>
        </View>

        {/* Starter Packs */}
        {starterPacksData?.starterPacks && starterPacksData.starterPacks.length > 0 && (
          <View style={styles.starterPacksContainer}>
            <Text style={styles.starterPacksTitle}>My Starter Packs</Text>
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

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.editProfileButton} onPress={onNavigateToEditProfile}>
            <Text style={styles.editProfileButtonText}>Edit Profile</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.bookmarksButton}
            onPress={() => router.push("/(app)/(tabs)/(profile)/bookmarks")}
            activeOpacity={0.7}
          >
            <Text style={styles.bookmarksButtonText}>
              Bookmarks{bookmarkCount > 0 ? ` (${bookmarkCount})` : ''}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutButtonText}>Sign Out</Text>
        </TouchableOpacity>
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
      return <ProfileSkeleton />;
    }

    const emptyMessage = activeTab === "likes" ? "No likes yet" : activeTab === "top" ? "No top posts found" : "No posts yet";
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>{emptyMessage}</Text>
      </View>
    );
  };

  if (!account) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Not authenticated</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        ref={scrollRef}
        data={posts}
        renderItem={renderPost}
        keyExtractor={(item, index) => item.post.uri || `post-${index}`}
        ListHeaderComponent={
          <>
            {renderHeader()}
            {renderTabBar()}
            {topPostsData && topPostsData.topPosts.length > 0 && activeTab === "posts" && (
              <TopPostsShowcase
                topPosts={topPostsData.topPosts}
                totalPostsAnalyzed={topPostsData.totalPostsAnalyzed}
                onPostPress={(uri) => onNavigateToPost?.(uri)}
              />
            )}
            {pinnedPost && activeTab === "posts" && (
              <View style={styles.pinnedPostContainer}>
                <View style={styles.pinnedPostLabel}>
                  <PinIcon size={12} color={colors.textSecondary} />
                  <Text style={styles.pinnedPostLabelText}>Pinned</Text>
                </View>
                <PostCard
                  post={{ post: pinnedPost, reply: undefined } as AppBskyFeedDefs.FeedViewPost}
                  onPress={() => onNavigateToPost?.(pinnedPost.uri)}
                  onPressProfile={(profileHandle) => onNavigateToProfile?.(profileHandle)}
                  onBookmark={() => handleBookmark({ post: pinnedPost, reply: undefined } as AppBskyFeedDefs.FeedViewPost)}
                  isBookmarked={isBookmarked(pinnedPost.uri)}
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
        removeClippedSubviews={true}
        windowSize={7}
        maxToRenderPerBatch={5}
        initialNumToRender={8}
        updateCellsBatchingPeriod={50}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        contentContainerStyle={
          posts.length === 0 ? styles.emptyList : undefined
        }
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
  },
  errorText: {
    color: colors.danger,
    fontSize: fontSize.callout,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceElevated,
  },
  profileInfo: {
    alignItems: "center",
    marginBottom: 16,
  },
  displayName: {
    color: colors.text,
    fontSize: fontSize.title2,
    fontWeight: "bold",
    marginTop: 12,
  },
  handle: {
    color: colors.textSecondary,
    fontSize: fontSize.callout,
    marginTop: 4,
  },
  bio: {
    color: colors.text,
    fontSize: fontSize.subheadline,
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
    color: colors.text,
    fontSize: fontSize.title3,
    fontWeight: "bold",
  },
  statLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.subheadline,
    marginTop: 4,
  },
  actionButtons: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  editProfileButton: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 24,
    alignItems: "center",
  },
  editProfileButtonText: {
    color: colors.text,
    fontSize: fontSize.callout,
    fontWeight: "600",
  },
  bookmarksButton: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  bookmarksButtonText: {
    color: colors.text,
    fontSize: fontSize.callout,
    fontWeight: "600",
  },
  signOutButton: {
    backgroundColor: colors.danger,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 24,
    alignItems: "center",
    marginBottom: 16,
  },
  signOutButtonText: {
    color: colors.text,
    fontSize: fontSize.callout,
    fontWeight: "600",
  },
  postsHeader: {
    color: colors.text,
    fontSize: fontSize.headline,
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
    fontSize: fontSize.callout,
  },
  emptyList: {
    flexGrow: 1,
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
    fontSize: fontSize.caption1,
    fontWeight: "600",
  },
  starterPacksContainer: {
    marginBottom: 16,
  },
  starterPacksTitle: {
    color: colors.text,
    fontSize: fontSize.headline,
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
    fontSize: fontSize.callout,
    fontWeight: "600",
    marginBottom: 4,
  },
  starterPackMeta: {
    color: colors.textSecondary,
    fontSize: fontSize.subheadline,
  },
  starterPackArrow: {
    color: colors.primary,
    fontSize: fontSize.title2,
    fontWeight: "300",
    marginLeft: 8,
  },
  });
}
