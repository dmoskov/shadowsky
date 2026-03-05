import React, {useMemo, useState, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import {AppBskyActorDefs} from '@atproto/api';
import {usePostReposts} from '../../hooks/api/usePosts';
import {Avatar} from '../../components/Avatar';
import {FollowButton} from '../../components/FollowButton';
import {UserListSkeleton} from '../../components/UserListSkeleton';
import {useTheme} from '../../contexts/ThemeContext';
import {useAuth} from '../../contexts/AuthContext';
import {fontSize} from '../../utils/typography';

interface RepostsScreenProps {
  postUri: string;
  onNavigateToProfile?: (handle: string) => void;
}

export function RepostsScreen({postUri, onNavigateToProfile}: RepostsScreenProps) {
  const {colors} = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {account} = useAuth();
  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = usePostReposts(postUri);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const reposts = data?.pages.flatMap((page) => page.repostedBy) ?? [];

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    refetch().finally(() => setIsRefreshing(false));
  }, [refetch]);

  const renderRepost = ({item}: {item: AppBskyActorDefs.ProfileView}) => {
    const isOwnProfile = account?.did === item.did;

    return (
      <TouchableOpacity
        style={styles.repostItem}
        onPress={() => onNavigateToProfile?.(item.handle)}
        activeOpacity={0.7}>
        <Avatar uri={item.avatar} size={48} />
        <View style={styles.userInfo}>
          <Text style={styles.displayName} numberOfLines={1}>
            {item.displayName || item.handle}
          </Text>
          <Text style={styles.handle} numberOfLines={1}>
            @{item.handle}
          </Text>
          {item.description && (
            <Text style={styles.description} numberOfLines={2}>
              {item.description}
            </Text>
          )}
        </View>
        {!isOwnProfile && (
          <View style={styles.buttonContainer}>
            <FollowButton
              did={item.did}
              followUri={item.viewer?.following}
              isFollowing={!!item.viewer?.following}
              handle={item.handle}
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
      return <UserListSkeleton />;
    }

    if (error) {
      return (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Failed to load reposts</Text>
        </View>
      );
    }

    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>No reposts yet</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={reposts}
        keyboardDismissMode="on-drag"
        renderItem={renderRepost}
        keyExtractor={(item, index) => item.did || `repost-${index}`}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.5}
        removeClippedSubviews={true}
        windowSize={10}
        maxToRenderPerBatch={15}
        initialNumToRender={15}
        updateCellsBatchingPeriod={50}
        getItemLayout={(_data, index) => ({
          length: 73,
          offset: 73 * index,
          index,
        })}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        contentContainerStyle={reposts.length === 0 ? styles.emptyList : undefined}
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
    repostItem: {
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
      fontSize: fontSize.callout,
      fontWeight: '600',
      marginBottom: 2,
    },
    handle: {
      color: colors.textSecondary,
      fontSize: fontSize.subheadline,
      marginBottom: 4,
    },
    description: {
      color: colors.borderLight,
      fontSize: fontSize.footnote,
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
      fontSize: fontSize.callout,
    },
    emptyText: {
      color: colors.textSecondary,
      fontSize: fontSize.callout,
    },
    emptyList: {
      flexGrow: 1,
    },
  });
}
