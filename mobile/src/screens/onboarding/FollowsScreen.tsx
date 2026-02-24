import React, { memo, useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ListRenderItemInfo,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../contexts/ThemeContext";

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

export interface FollowsScreenProps {
  suggestedUsers: SuggestedUser[];
  isLoading: boolean;
  onFollowToggle: (did: string) => Promise<boolean>;
  onContinue: (followedDids: string[]) => void;
  onBack: () => void;
  onSkip: () => void;
}

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
  const { colors } = useTheme();

  return (
    <View style={[styles.userCard, { backgroundColor: colors.surface }]}>
      <View style={styles.userInfo}>
        {user.avatar ? (
          <Image
            source={{ uri: user.avatar }}
            style={styles.avatar}
            accessibilityLabel={user.displayName || user.handle}
          />
        ) : (
          <View
            style={[
              styles.avatar,
              styles.avatarPlaceholder,
              { backgroundColor: colors.border },
            ]}
          >
            <Text style={[styles.avatarPlaceholderText, { color: colors.textTertiary }]}>
              {(user.displayName || user.handle).charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={styles.userTextContainer}>
          <Text
            style={[styles.displayName, { color: colors.text }]}
            numberOfLines={1}
          >
            {user.displayName || user.handle}
          </Text>
          <Text
            style={[styles.handle, { color: colors.textTertiary }]}
            numberOfLines={1}
          >
            @{user.handle}
          </Text>
        </View>
      </View>

      {user.description ? (
        <Text
          style={[styles.description, { color: colors.textSecondary }]}
          numberOfLines={2}
        >
          {user.description}
        </Text>
      ) : null}

      <Pressable
        onPress={() => onToggle(user)}
        disabled={isInProgress || !!user.viewer?.following}
        style={[
          styles.followButton,
          { backgroundColor: colors.primary },
          isFollowed && {
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
          },
          (isInProgress || !!user.viewer?.following) &&
            styles.followButtonDisabled,
        ]}
        accessibilityRole="button"
        accessibilityLabel={
          isFollowed
            ? "Following"
            : `Follow ${user.displayName || user.handle}`
        }
      >
        {isInProgress ? (
          <ActivityIndicator size="small" color={colors.textOnPrimary} />
        ) : (
          <Text
            style={[
              styles.followButtonText,
              { color: isFollowed ? colors.textSecondary : colors.textOnPrimary },
            ]}
          >
            {isFollowed || user.viewer?.following ? "Following" : "Follow"}
          </Text>
        )}
      </Pressable>
    </View>
  );
});

export const FollowsScreen = memo(function FollowsScreen({
  suggestedUsers,
  isLoading,
  onFollowToggle,
  onContinue,
  onBack,
  onSkip,
}: FollowsScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
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

  const Separator = useMemo(
    () =>
      memo(function ListSeparator() {
        return <View style={styles.separator} />;
      }),
    [],
  );

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top,
        },
      ]}
    >
      <View style={styles.header}>
        <View
          style={[
            styles.headerIcon,
            { backgroundColor: colors.glowPrimary },
          ]}
        >
          <Text style={styles.headerIconText}>{"\u{1F465}"}</Text>
        </View>
        <Text style={[styles.title, { color: colors.text }]}>
          Discover people to follow
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Here are some suggested accounts to get you started
        </Text>
        <Text style={[styles.counter, { color: colors.textTertiary }]}>
          {followedUsers.size > 0
            ? `Following ${followedUsers.size} account${followedUsers.size !== 1 ? "s" : ""}`
            : "Follow at least a few accounts to see content"}
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading suggestions...
          </Text>
        </View>
      ) : suggestedUsers.length > 0 ? (
        <FlatList
          data={suggestedUsers}
          renderItem={renderUser}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={Separator}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            No suggestions available at the moment. You can discover more
            accounts later.
          </Text>
        </View>
      )}

      <View
        style={[
          styles.navigation,
          {
            borderTopColor: colors.border,
            paddingBottom: insets.bottom + 16,
          },
        ]}
      >
        <Pressable
          onPress={onBack}
          style={[styles.backButton, { borderColor: colors.border }]}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Text
            style={[styles.backButtonText, { color: colors.textSecondary }]}
          >
            Back
          </Text>
        </Pressable>

        <View style={styles.rightButtons}>
          <Pressable
            onPress={onSkip}
            style={[styles.skipButton, { borderColor: colors.border }]}
            accessibilityRole="button"
            accessibilityLabel="Skip"
          >
            <Text
              style={[styles.skipButtonText, { color: colors.textSecondary }]}
            >
              Skip
            </Text>
          </Pressable>

          <Pressable
            onPress={handleContinue}
            style={[
              styles.continueButton,
              { backgroundColor: colors.primary },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Continue"
          >
            <Text style={[styles.continueButtonText, { color: colors.textOnPrimary }]}>Continue</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    alignItems: "center",
  },
  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  headerIconText: {
    fontSize: 28,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    textAlign: "center",
    marginBottom: 8,
  },
  counter: {
    fontSize: 13,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 14,
    marginTop: 12,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  userCard: {
    borderRadius: 12,
    padding: 14,
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarPlaceholder: {
    justifyContent: "center",
    alignItems: "center",
  },
  avatarPlaceholderText: {
    fontSize: 18,
    fontWeight: "600",
  },
  userTextContainer: {
    flex: 1,
  },
  displayName: {
    fontSize: 15,
    fontWeight: "600",
  },
  handle: {
    fontSize: 13,
  },
  description: {
    fontSize: 13,
    marginBottom: 10,
    lineHeight: 18,
  },
  followButton: {
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: "center",
  },
  followButtonDisabled: {
    opacity: 0.5,
  },
  followButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 15,
    textAlign: "center",
  },
  separator: {
    height: 10,
  },
  navigation: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  backButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: "500",
  },
  rightButtons: {
    flexDirection: "row",
    gap: 10,
  },
  skipButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
  },
  skipButtonText: {
    fontSize: 15,
    fontWeight: "500",
  },
  continueButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  continueButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
