import React from 'react';
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

interface MutedAccountsScreenProps {
  onNavigateToProfile?: (handle: string) => void;
}

export function MutedAccountsScreen({ onNavigateToProfile }: MutedAccountsScreenProps) {
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
        <ActivityIndicator size="small" color="#3b82f6" />
      </View>
    );
  };

  const renderEmpty = () => {
    if (isLoading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
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
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#3b82f6"
            colors={['#3b82f6']}
          />
        }
        contentContainerStyle={accounts.length === 0 ? styles.emptyList : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  headerDescription: {
    color: '#9ca3af',
    fontSize: 14,
  },
  accountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
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
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  handle: {
    color: '#9ca3af',
    fontSize: 14,
  },
  unmuteButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#3b82f6',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  unmuteButtonText: {
    color: '#3b82f6',
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
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    color: '#9ca3af',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 16,
    textAlign: 'center',
  },
  emptyList: {
    flexGrow: 1,
  },
});
