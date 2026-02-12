import React from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useBlockedAccounts, useUnblockUser } from '../../hooks/api/useProfile';
import { Avatar } from '../../components/Avatar';
import { AppBskyActorDefs } from '@atproto/api';

interface BlockedAccountsScreenProps {
  onNavigateToProfile?: (handle: string) => void;
}

export function BlockedAccountsScreen({ onNavigateToProfile }: BlockedAccountsScreenProps) {
  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useBlockedAccounts();
  const unblockMutation = useUnblockUser();

  const accounts = data?.pages.flatMap((page) => page.blocks) ?? [];

  const handleUnblock = (account: AppBskyActorDefs.ProfileView) => {
    const blockUri = account.viewer?.blocking;
    if (!blockUri) return;

    Alert.alert(
      'Unblock User',
      `Are you sure you want to unblock @${account.handle}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          style: 'default',
          onPress: async () => {
            try {
              await unblockMutation.mutateAsync(blockUri);
              // Refetch to update the list
              refetch();
            } catch (error) {
              Alert.alert('Error', 'Failed to unblock user. Please try again.');
            }
          },
        },
      ]
    );
  };

  const renderAccount = ({ item }: { item: AppBskyActorDefs.ProfileView }) => (
    <View style={styles.accountItem}>
      <TouchableOpacity
        style={styles.accountInfo}
        onPress={() => onNavigateToProfile?.(item.handle)}
        activeOpacity={0.7}
      >
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
        style={styles.unblockButton}
        onPress={() => handleUnblock(item)}
        disabled={unblockMutation.isPending}
      >
        <Text style={styles.unblockButtonText}>
          {unblockMutation.isPending ? '...' : 'Unblock'}
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

    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No blocked accounts</Text>
        <Text style={styles.emptySubtext}>
          When you block someone, they won't be able to follow you or view your posts.
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Blocked Accounts</Text>
        <Text style={styles.headerDescription}>
          Manage accounts you've blocked
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
  unblockButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#ef4444',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 16,
  },
  unblockButtonText: {
    color: '#ef4444',
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
  emptyList: {
    flexGrow: 1,
  },
});
