/**
 * MobileFollowsScreen Component for React Native
 *
 * Suggested follows screen for mobile onboarding.
 * Fetches suggestions from AT Protocol and lets users follow accounts.
 */

import { memo, useCallback, useState } from "react";
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

interface SuggestedUser {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
  description?: string;
  viewer?: {
    following?: string;
  };
}

export interface MobileFollowsScreenProps {
  suggestedUsers: SuggestedUser[];
  isLoading: boolean;
  onFollowToggle: (did: string) => Promise<boolean>;
  onContinue: (followedDids: string[]) => void;
  onBack: () => void;
  onSkip: () => void;
}

const DEFAULT_AVATAR_URI =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='50' fill='%23333344'/%3E%3Ccircle cx='50' cy='40' r='18' fill='%23555566'/%3E%3Cellipse cx='50' cy='80' rx='30' ry='22' fill='%23555566'/%3E%3C/svg%3E";

const UserCard = memo(function UserCard({
  user,
  isFollowed,
  isInProgress,
  onToggle,
}: {
  user: SuggestedUser;
  isFollowed: boolean;
  isInProgress: boolean;
  onToggle: (user: SuggestedUser) => void;
}) {
  return (
    <View style={styles.userCard}>
      <View style={styles.userInfo}>
        <Image
          source={{ uri: user.avatar || DEFAULT_AVATAR_URI }}
          style={styles.avatar}
          accessibilityLabel={user.displayName || user.handle}
        />
        <View style={styles.userTextContainer}>
          <Text style={styles.displayName} numberOfLines={1}>
            {user.displayName || user.handle}
          </Text>
          <Text style={styles.handle} numberOfLines={1}>
            @{user.handle}
          </Text>
        </View>
      </View>

      {user.description ? (
        <Text style={styles.description} numberOfLines={2}>
          {user.description}
        </Text>
      ) : null}

      <Pressable
        onPress={() => onToggle(user)}
        disabled={isInProgress || !!user.viewer?.following}
        style={[
          styles.followButton,
          isFollowed && styles.followButtonFollowed,
          (isInProgress || !!user.viewer?.following) &&
            styles.followButtonDisabled,
        ]}
        accessibilityRole="button"
        accessibilityLabel={
          isFollowed ? "Following" : `Follow ${user.displayName || user.handle}`
        }
      >
        {isInProgress ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <Text
            style={[
              styles.followButtonText,
              isFollowed && styles.followButtonTextFollowed,
            ]}
          >
            {isFollowed || user.viewer?.following ? "Following" : "Follow"}
          </Text>
        )}
      </Pressable>
    </View>
  );
});

export const MobileFollowsScreen = memo(function MobileFollowsScreen({
  suggestedUsers,
  isLoading,
  onFollowToggle,
  onContinue,
  onBack,
  onSkip,
}: MobileFollowsScreenProps) {
  const [followedUsers, setFollowedUsers] = useState<Set<string>>(new Set());
  const [followingInProgress, setFollowingInProgress] = useState<Set<string>>(
    new Set(),
  );

  const handleFollowToggle = useCallback(
    async (user: SuggestedUser) => {
      if (followingInProgress.has(user.did)) return;

      setFollowingInProgress((prev) => new Set([...prev, user.did]));
      try {
        if (followedUsers.has(user.did)) {
          setFollowedUsers((prev) => {
            const next = new Set(prev);
            next.delete(user.did);
            return next;
          });
        } else {
          const success = await onFollowToggle(user.did);
          if (success) {
            setFollowedUsers((prev) => new Set([...prev, user.did]));
          }
        }
      } finally {
        setFollowingInProgress((prev) => {
          const next = new Set(prev);
          next.delete(user.did);
          return next;
        });
      }
    },
    [followedUsers, followingInProgress, onFollowToggle],
  );

  const handleContinue = useCallback(() => {
    onContinue(Array.from(followedUsers));
  }, [onContinue, followedUsers]);

  const renderUser = useCallback(
    ({ item }: ListRenderItemInfo<SuggestedUser>) => (
      <UserCard
        user={item}
        isFollowed={followedUsers.has(item.did)}
        isInProgress={followingInProgress.has(item.did)}
        onToggle={handleFollowToggle}
      />
    ),
    [followedUsers, followingInProgress, handleFollowToggle],
  );

  const keyExtractor = useCallback((item: SuggestedUser) => item.did, []);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Text style={styles.headerIconText}>{"👥"}</Text>
        </View>
        <Text style={styles.title}>Discover people to follow</Text>
        <Text style={styles.subtitle}>
          Here are some suggested accounts to get you started
        </Text>
        <Text style={styles.counter}>
          {followedUsers.size > 0
            ? `Following ${followedUsers.size} account${followedUsers.size !== 1 ? "s" : ""}`
            : "Follow at least a few accounts to see content"}
        </Text>
      </View>

      {/* User list */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={styles.loadingText}>Loading suggestions...</Text>
        </View>
      ) : suggestedUsers.length > 0 ? (
        <FlatList
          data={suggestedUsers}
          renderItem={renderUser}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={ListSeparator}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            No suggestions available at the moment. You can discover more
            accounts later.
          </Text>
        </View>
      )}

      {/* Navigation */}
      <View style={styles.navigation}>
        <Pressable
          onPress={onBack}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>

        <View style={styles.rightButtons}>
          <Pressable
            onPress={onSkip}
            style={styles.skipButton}
            accessibilityRole="button"
            accessibilityLabel="Skip"
          >
            <Text style={styles.skipButtonText}>Skip</Text>
          </Pressable>

          <Pressable
            onPress={handleContinue}
            style={styles.continueButton}
            accessibilityRole="button"
            accessibilityLabel="Continue"
          >
            <Text style={styles.continueButtonText}>Continue</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
});

const ListSeparator = memo(function ListSeparator() {
  return <View style={styles.separator} />;
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  } as ViewStyle,
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    alignItems: "center",
  } as ViewStyle,
  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(99, 102, 241, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  } as ViewStyle,
  headerIconText: {
    fontSize: 28,
  } as TextStyle,
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#ffffff",
    textAlign: "center",
    marginBottom: 8,
  } as TextStyle,
  subtitle: {
    fontSize: 15,
    color: "#8a8a9a",
    textAlign: "center",
    marginBottom: 8,
  } as TextStyle,
  counter: {
    fontSize: 13,
    color: "#555566",
  } as TextStyle,
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  } as ViewStyle,
  loadingText: {
    fontSize: 14,
    color: "#8a8a9a",
    marginTop: 12,
  } as TextStyle,
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  } as ViewStyle,
  userCard: {
    backgroundColor: "#111122",
    borderRadius: 12,
    padding: 14,
  } as ViewStyle,
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  } as ViewStyle,
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  } as ImageStyle,
  userTextContainer: {
    flex: 1,
  } as ViewStyle,
  displayName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#ffffff",
  } as TextStyle,
  handle: {
    fontSize: 13,
    color: "#555566",
  } as TextStyle,
  description: {
    fontSize: 13,
    color: "#8a8a9a",
    marginBottom: 10,
    lineHeight: 18,
  } as TextStyle,
  followButton: {
    backgroundColor: "#6366f1",
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: "center",
  } as ViewStyle,
  followButtonFollowed: {
    backgroundColor: "#1a1a2e",
  } as ViewStyle,
  followButtonDisabled: {
    opacity: 0.5,
  } as ViewStyle,
  followButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ffffff",
  } as TextStyle,
  followButtonTextFollowed: {
    color: "#8a8a9a",
  } as TextStyle,
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  } as ViewStyle,
  emptyText: {
    fontSize: 15,
    color: "#8a8a9a",
    textAlign: "center",
  } as TextStyle,
  separator: {
    height: 10,
  } as ViewStyle,
  navigation: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: "#1a1a2e",
  } as ViewStyle,
  backButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#333344",
  } as ViewStyle,
  backButtonText: {
    fontSize: 15,
    fontWeight: "500",
    color: "#8a8a9a",
  } as TextStyle,
  rightButtons: {
    flexDirection: "row",
    gap: 10,
  } as ViewStyle,
  skipButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#333344",
  } as ViewStyle,
  skipButtonText: {
    fontSize: 15,
    fontWeight: "500",
    color: "#8a8a9a",
  } as TextStyle,
  continueButton: {
    backgroundColor: "#6366f1",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
  } as ViewStyle,
  continueButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#ffffff",
  } as TextStyle,
});
