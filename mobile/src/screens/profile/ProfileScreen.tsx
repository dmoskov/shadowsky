import React from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { useProfile, useFollowUser, useUnfollowUser } from "../../hooks/api/useProfile";
import { useAuthorFeed } from "../../hooks/api/useFeed";
import { Avatar } from "../../components/Avatar";
import { PostCard } from "../../components/PostCard";
import { AppBskyFeedDefs } from "@atproto/api";
import { useAuth } from "../../contexts/AuthContext";

interface ProfileScreenProps {
  handle: string;
  onNavigateToPost?: (uri: string) => void;
  onNavigateToProfile?: (handle: string) => void;
}

export function ProfileScreen({ handle, onNavigateToPost, onNavigateToProfile }: ProfileScreenProps) {
  const { data: profile, isLoading: isLoadingProfile, error: profileError } = useProfile(handle);
  const {
    data: feedData,
    isLoading: isLoadingFeed,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useAuthorFeed(handle);
  const { account } = useAuth();
  const followMutation = useFollowUser();
  const unfollowMutation = useUnfollowUser();

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
          <ActivityIndicator size="large" color="#3b82f6" />
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
          <View style={styles.stat}>
            <Text style={styles.statValue}>{profile.followersCount ?? 0}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{profile.followsCount ?? 0}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </View>
        </View>

        {/* Follow/Unfollow Button */}
        {!isOwnProfile && (
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
        <ActivityIndicator size="small" color="#3b82f6" />
      </View>
    );
  };

  const renderEmpty = () => {
    if (isLoadingFeed) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
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
        contentContainerStyle={posts.length === 0 ? styles.emptyList : undefined}
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
  followButton: {
    backgroundColor: "#3b82f6",
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 24,
    alignItems: "center",
    marginBottom: 16,
  },
  followingButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#3b82f6",
  },
  followButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  followingButtonText: {
    color: "#3b82f6",
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
