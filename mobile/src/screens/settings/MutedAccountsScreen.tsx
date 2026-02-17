import React, {useMemo} from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useMutedAccounts, useUnmuteUser } from '../../hooks/api/useProfile';
import { Avatar } from '../../components/Avatar';
import { AppBskyActorDefs } from '@atproto/api';
import {useTheme} from '../../contexts/ThemeContext';

interface MutedAccountsScreenProps {
  onNavigateToProfile?: (handle: string) => void;
}

export function MutedAccountsScreen({ onNavigateToProfile }: MutedAccountsScreenProps) {
  const {colors} = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useMutedAccounts();
  const unmuteMutation = useUnmuteUser();
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const accounts = data?.pages.flatMap((page) => page.mutes) ?? [];

  const handleUnmute = (account: AppBskyActorDefs.ProfileView) => {
    Alert.alert(
      'Unmute User',
      `Are you sure you want to unmute @${account.handle}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unmute',
          style: 'default',
          onPress: async () => {
            try {
              await unmuteMutation.mutateAsync(account.did);
              refetch();
            } catch (error) {
              Alert.alert('Error', 'Failed to unmute user. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  const renderAccount = ({ item }: { item: AppBskyActorDefs.ProfileView }) => (
    <View style={styles.accountItem}>
      <TouchableOpacity
        style={styles.accountInfo}
        onPress={() => onNavigateToProfile?.(item.handle)}
        activeOpacity={0.7}>
        <Avatar uri={item.avatar} size={48} />
        <View style={styles.accountDetails}>
          <Text style={styles.displayName} numberOfLines={1}>
            {item.displayName || item.handle}
          </Text>
          <Text style={styles.handle} numberOfLines={1}>
            @{item.handle}
          </Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.unmuteButton}
        onPress={() => handleUnmute(item)}
        disabled={unmuteMutation.isPending}>
        <Text style={styles.unmuteButtonText}>
          {unmuteMutation.isPending ? '...' : 'Unmute'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderFooter = () => {
    if (!isFetchingNextPage) return null;

    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.info} />
      </View>
    );
  };

  const renderEmpty = () => {
    if (isLoading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={colors.info} />
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.errorText}>Failed to load muted accounts</Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No muted accounts</Text>
        <Text style={styles.emptySubtext}>
          When you mute someone, you won't see their posts in your timeline.
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Muted Accounts</Text>
        <Text style={styles.headerDescription}>
          Manage accounts you've muted
        </Text>
      </View>
      <FlatList
        data={accounts}
        keyboardDismissMode="on-drag"
        renderItem={renderAccount}
        keyExtractor={(item) => item.did}
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
          length: 81,
          offset: 81 * index,
          index,
        })}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.info}
            colors={[colors.info]}
          />
        }
        contentContainerStyle={accounts.length === 0 ? styles.emptyList : undefined}
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
    header: {
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.surfaceElevated,
    },
    headerTitle: {
      color: colors.text,
      fontSize: 24,
      fontWeight: 'bold',
      marginBottom: 4,
    },
    headerDescription: {
      color: colors.textSecondary,
      fontSize: 14,
    },
    accountItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.surfaceElevated,
    },
    accountInfo: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      marginRight: 12,
    },
    accountDetails: {
      flex: 1,
      marginLeft: 12,
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
    },
    unmuteButton: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.info,
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 20,
    },
    unmuteButtonText: {
      color: colors.info,
      fontSize: 14,
      fontWeight: '600',
    },
    footerLoader: {
      paddingVertical: 16,
      alignItems: 'center',
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 32,
      paddingVertical: 48,
    },
    emptyText: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '600',
      marginBottom: 8,
      textAlign: 'center',
    },
    emptySubtext: {
      color: colors.textSecondary,
      fontSize: 14,
      textAlign: 'center',
      lineHeight: 20,
    },
    errorText: {
      color: colors.danger,
      fontSize: 16,
      textAlign: 'center',
    },
    emptyList: {
      flexGrow: 1,
    },
  });
}
