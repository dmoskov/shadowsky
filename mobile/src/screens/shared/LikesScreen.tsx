import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import {AppBskyFeedDefs, AppBskyFeedGetLikes} from '@atproto/api';
import {usePostLikes} from '../../hooks/api/usePosts';
import {Avatar} from '../../components/Avatar';
import {FollowButton} from '../../components/FollowButton';
import {colors} from '../../constants/theme';
import {useAuth} from '../../contexts/AuthContext';

interface LikesScreenProps {
  postUri: string;
  onNavigateToProfile?: (handle: string) => void;
}

export function LikesScreen({postUri, onNavigateToProfile}: LikesScreenProps) {
  const {account} = useAuth();
  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    isRefetching,
  } = usePostLikes(postUri);

  const likes = data?.pages.flatMap((page) => page.likes) ?? [];

  const renderLike = ({item}: {item: AppBskyFeedGetLikes.Like}) => {
    const isOwnProfile = account?.did === item.actor.did;

    return (
      <TouchableOpacity
        style={styles.likeItem}
        onPress={() => onNavigateToProfile?.(item.actor.handle)}
        activeOpacity={0.7}>
        <Avatar uri={item.actor.avatar} size={48} />
        <View style={styles.userInfo}>
          <Text style={styles.displayName} numberOfLines={1}>
            {item.actor.displayName || item.actor.handle}
          </Text>
          <Text style={styles.handle} numberOfLines={1}>
            @{item.actor.handle}
          </Text>
          {item.actor.description && (
            <Text style={styles.description} numberOfLines={2}>
              {item.actor.description}
            </Text>
          )}
        </View>
        {!isOwnProfile && (
          <View style={styles.buttonContainer}>
            <FollowButton
              did={item.actor.did}
              followUri={item.actor.viewer?.following}
              isFollowing={!!item.actor.viewer?.following}
              size="small"
            />
          </View>
        )}
      </TouchableOpacity>
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
    if (isLoading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Failed to load likes</Text>
        </View>
      );
    }

    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>No likes yet</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={likes}
        renderItem={renderLike}
        keyExtractor={(item, index) => item.actor.did || `like-${index}`}
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
            refreshing={isRefetching && !isLoading}
            onRefresh={refetch}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        contentContainerStyle={likes.length === 0 ? styles.emptyList : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  likeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceElevated,
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  displayName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  handle: {
    color: colors.textSecondary,
    fontSize: 14,
    marginBottom: 4,
  },
  description: {
    color: colors.borderLight,
    fontSize: 13,
    lineHeight: 18,
  },
  buttonContainer: {
    marginLeft: 8,
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  errorText: {
    color: colors.danger,
    fontSize: 16,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 16,
  },
  emptyList: {
    flexGrow: 1,
  },
});
