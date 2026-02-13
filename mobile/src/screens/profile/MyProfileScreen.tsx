import React, { useRef, useState } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useScrollToTop } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { Avatar } from "../../components/Avatar";
import { PostCard } from "../../components/PostCard";
import { ProfileTabBar, ProfileTab } from "../../components/ProfileTabBar";
import { useAuth } from "../../contexts/AuthContext";
import { useAuthorFeed, useActorLikes } from "../../hooks/api/useFeed";
import { useProfile } from "../../hooks/api/useProfile";
import { colors } from "../../constants/theme";
import { AuthorFeedFilter } from "../../services/atproto/feeds";

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
  const router = useRouter();
  const insets = useSafeAreaInsets();
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

  // Get posts based on the active tab
  const posts = activeTab === "likes"
    ? likesData?.pages.flatMap((page) => page.feed) ?? []
    : feedData?.pages.flatMap((page) => page.feed) ?? [];

  const isLoading = activeTab === "likes" ? isLoadingLikes : isLoadingFeed;
  const fetchNextPage = activeTab === "likes" ? fetchNextLikesPage : fetchNextFeedPage;
  const hasNextPage = activeTab === "likes" ? hasNextLikesPage : hasNextFeedPage;
  const isFetchingNextPage = activeTab === "likes" ? isFetchingNextLikesPage : isFetchingNextFeedPage;

  const handleMentionPress = (handle: string, did: string) => {
    onNavigateToProfile?.(handle);
  };

  const handleHashtagPress = (tag: string) => {
    router.push({ pathname: '/(tabs)/(search)', params: { q: '#' + tag } });
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
    // Scroll to top when changing tabs
    scrollRef.current?.scrollToOffset({ offset: 0, animated: true });
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
    if (isLoadingProfile || !profile) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      );
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

        {/* Edit Profile Button */}
        <TouchableOpacity style={styles.editProfileButton} onPress={onNavigateToEditProfile}>
          <Text style={styles.editProfileButtonText}>Edit Profile</Text>
        </TouchableOpacity>

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

  if (!account) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Not authenticated</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <FlatList
        ref={scrollRef}
        data={posts}
        renderItem={renderPost}
        keyExtractor={(item, index) => item.post.uri || `post-${index}`}
        ListHeaderComponent={
          <>
            {renderHeader()}
            {renderTabBar()}
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
        contentContainerStyle={
          posts.length === 0 ? styles.emptyList : undefined
        }
      />
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
  },
  profileInfo: {
    alignItems: "center",
    marginBottom: 16,
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
  editProfileButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 24,
    alignItems: "center",
    marginBottom: 12,
  },
  editProfileButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  signOutButton: {
    backgroundColor: "#ef4444",
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 24,
    alignItems: "center",
    marginBottom: 16,
  },
  signOutButtonText: {
    color: "#ffffff",
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
});
