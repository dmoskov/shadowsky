import React, { useState, useMemo, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useScrollToTop } from "@react-navigation/native";
import { useProfile } from "../../hooks/api/useProfile";
import { useAuthorFeed, useActorLikes } from "../../hooks/api/useFeed";
import { useActorStarterPacks } from "../../hooks/api/useStarterPacks";
import { PostCard } from "../../components/PostCard";
import { AppBskyFeedDefs } from "@atproto/api";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { AuthorFeedFilter } from "../../services/atproto/feeds";
import { useBookmarks } from "../../hooks/api/useBookmarks";
import { triggerHaptic } from "../../utils/haptics";
import { NativeProfileViewWithData } from "../../../modules/native-profile-view/src/NativeProfileView";
import {
  ProfileData,
  StarterPackData,
  ProfileTab,
} from "../../../modules/native-profile-view/src/NativeProfileViewTypes";
import { MyProfileScreen } from "./MyProfileScreen";

interface MyProfileScreenNativeProps {
  onNavigateToPost?: (uri: string) => void;
  onNavigateToProfile?: (handle: string) => void;
  onNavigateToEditProfile?: () => void;
  onNavigateToFollowers?: (actor: string) => void;
  onNavigateToFollowing?: (actor: string) => void;
  onSignOut?: () => void;
}

export function MyProfileScreenNative(props: MyProfileScreenNativeProps) {
  if (Platform.OS !== "ios") {
    return <MyProfileScreen {...props} />;
  }

  return <MyProfileScreenNativeIOS {...props} />;
}

function MyProfileScreenNativeIOS({
  onNavigateToPost,
  onNavigateToProfile,
  onNavigateToEditProfile,
  onNavigateToFollowers,
  onNavigateToFollowing,
  onSignOut,
}: MyProfileScreenNativeProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { account, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<ProfileTab>("posts");
  const {
    data: profile,
    isLoading: isLoadingProfile,
    refetch: refetchProfile,
  } = useProfile(account?.handle || "");

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

  const { data: starterPacksData } = useActorStarterPacks(
    account?.handle || "",
  );
  const { isBookmarked, toggleBookmark } = useBookmarks();

  useScrollToTop(scrollRef);

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

  // --- Event handlers ---

  const handleSignOut = useCallback(async () => {
    try {
      await signOut();
      onSignOut?.();
    } catch (_error) {
      // Error is handled by the auth context
    }
  }, [signOut, onSignOut]);

  const handleTabChange = useCallback(
    (event: { nativeEvent: { tab: string } }) => {
      setActiveTab(event.nativeEvent.tab as ProfileTab);
      scrollRef.current?.scrollToOffset({ offset: 0, animated: true });
    },
    [],
  );

  const handleFollowersPress = useCallback(() => {
    onNavigateToFollowers?.(account?.handle || "");
  }, [account?.handle, onNavigateToFollowers]);

  const handleFollowingPress = useCallback(() => {
    onNavigateToFollowing?.(account?.handle || "");
  }, [account?.handle, onNavigateToFollowing]);

  const handleEditProfile = useCallback(() => {
    onNavigateToEditProfile?.();
  }, [onNavigateToEditProfile]);

  const handleStarterPackPress = useCallback(
    (event: { nativeEvent: { uri: string } }) => {
      const encodedUri = encodeURIComponent(event.nativeEvent.uri);
      router.push(`/(app)/(tabs)/(home)/starter-pack/${encodedUri}`);
    },
    [router],
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
    (handle: string, _did: string) => {
      onNavigateToProfile?.(handle);
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

  const handleBookmark = useCallback(
    (post: AppBskyFeedDefs.FeedViewPost) => {
      triggerHaptic("light");
      toggleBookmark(post.post);
    },
    [toggleBookmark],
  );

  const renderPost = useCallback(
    ({ item }: { item: AppBskyFeedDefs.FeedViewPost }) => (
      <PostCard
        post={item}
        onPress={() => onNavigateToPost?.(item.post.uri)}
        onPressProfile={(handle) => onNavigateToProfile?.(handle)}
        onBookmark={() => handleBookmark(item)}
        isBookmarked={isBookmarked(item.post.uri)}
        onMentionPress={handleMentionPress}
        onHashtagPress={handleHashtagPress}
      />
    ),
    [
      onNavigateToPost,
      onNavigateToProfile,
      handleBookmark,
      isBookmarked,
      handleMentionPress,
      handleHashtagPress,
    ],
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
      <NativeProfileViewWithData
        profile={profileData}
        starterPacks={starterPacksForNative}
        isOwnProfile={true}
        isLoading={isLoadingProfile}
        error={null}
        onTabChange={handleTabChange}
        onFollowersPress={handleFollowersPress}
        onFollowingPress={handleFollowingPress}
        onEditProfile={handleEditProfile}
        onStarterPackPress={handleStarterPackPress}
        onSignOut={handleSignOut}
        onRefresh={handleRefresh}
        style={styles.nativeHeader}
      />
    );
  }, [
    profileData,
    starterPacksForNative,
    isLoadingProfile,
    styles,
    handleTabChange,
    handleFollowersPress,
    handleFollowingPress,
    handleEditProfile,
    handleStarterPackPress,
    handleSignOut,
    handleRefresh,
  ]);

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
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        onEndReached={handleEndReached}
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
        contentContainerStyle={posts.length === 0 ? styles.emptyList : undefined}
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
    nativeHeader: {
      minHeight: 400,
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
      fontSize: 16,
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
  });
}
