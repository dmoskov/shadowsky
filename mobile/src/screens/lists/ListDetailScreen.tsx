import React, {useCallback, useMemo, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Image,
} from 'react-native';
import {
  useList,
  useListMembers,
  useRemoveFromList,
  useDeleteList,
  useUpdateList,
} from '../../hooks/api';
import {useAppNavigation} from '../../hooks/useNavigation';
import {AppBskyGraphDefs} from '@atproto/api';
import {colors} from '../../constants/theme';

interface ListDetailScreenProps {
  listUri: string;
}

interface MemberItemProps {
  member: AppBskyGraphDefs.ListItemView;
  onRemove: (uri: string) => void;
  onProfilePress: (handle: string) => void;
  isOwner: boolean;
}

function MemberItem({member, onRemove, onProfilePress, isOwner}: MemberItemProps) {
  const subject = member.subject;

  return (
    <View style={styles.memberItem}>
      <TouchableOpacity
        style={styles.memberContent}
        onPress={() => onProfilePress(subject.handle)}>
        {subject.avatar ? (
          <Image source={{uri: subject.avatar}} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarText}>
              {subject.displayName?.[0] || subject.handle[0].toUpperCase()}
            </Text>
          </View>
        )}
        <View style={styles.memberInfo}>
          <Text style={styles.displayName}>
            {subject.displayName || subject.handle}
          </Text>
          <Text style={styles.handle}>@{subject.handle}</Text>
        </View>
      </TouchableOpacity>
      {isOwner && (
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => onRemove(member.uri)}>
          <Text style={styles.removeButtonText}>Remove</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export function ListDetailScreen({listUri}: ListDetailScreenProps) {
  const {data: listData, isLoading: isLoadingList} = useList(listUri);
  const {
    data,
    isLoading,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isRefetching,
  } = useListMembers(listUri);
  const {mutateAsync: removeFromList} = useRemoveFromList();
  const {mutateAsync: deleteList} = useDeleteList();
  const {mutateAsync: updateList} = useUpdateList();
  const {goBack, router} = useAppNavigation();

  const [isDeleting, setIsDeleting] = useState(false);

  // Flatten paginated members data
  const members = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((page) => page.items);
  }, [data]);

  const handleRemoveMember = useCallback(
    async (memberUri: string) => {
      Alert.alert(
        'Remove Member',
        'Are you sure you want to remove this member from the list?',
        [
          {text: 'Cancel', style: 'cancel'},
          {
            text: 'Remove',
            style: 'destructive',
            onPress: async () => {
              try {
                await removeFromList({listItemUri: memberUri, listUri});
                Alert.alert('Success', 'Member removed from list');
              } catch (error) {
                Alert.alert(
                  'Error',
                  error instanceof Error
                    ? error.message
                    : 'Failed to remove member'
                );
              }
            },
          },
        ]
      );
    },
    [removeFromList, listUri]
  );

  const handleDeleteList = useCallback(() => {
    Alert.alert(
      'Delete List',
      'Are you sure you want to delete this list? This action cannot be undone.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsDeleting(true);
              await deleteList(listUri);
              Alert.alert('Success', 'List deleted successfully', [
                {text: 'OK', onPress: () => goBack()},
              ]);
            } catch (error) {
              setIsDeleting(false);
              Alert.alert(
                'Error',
                error instanceof Error ? error.message : 'Failed to delete list'
              );
            }
          },
        },
      ]
    );
  }, [deleteList, listUri, goBack]);

  const handleEditList = useCallback(() => {
    // Navigate to edit screen (we'll need to create this or use a modal)
    Alert.alert('Edit List', 'Edit functionality coming soon');
  }, []);

  const handleProfilePress = useCallback(
    (handle: string) => {
      router.push(`/(app)/(tabs)/(home)/profile/${handle}`);
    },
    [router]
  );

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderEmpty = () => {
    if (isLoading || isLoadingList) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.loadingText}>Loading members...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Failed to load members</Text>
          <Text style={styles.errorSubtext}>
            {error instanceof Error ? error.message : 'Unknown error'}
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>No members yet</Text>
        <Text style={styles.emptySubtext}>
          Add users to this list to see them here
        </Text>
      </View>
    );
  };

  const renderHeader = () => {
    if (!listData) return null;

    return (
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.listName}>{listData.name}</Text>
          {listData.description && (
            <Text style={styles.listDescription}>{listData.description}</Text>
          )}
          <Text style={styles.listMemberCount}>
            {listData.listItemCount || 0} members
          </Text>
          <Text style={styles.listPurpose}>
            {listData.purpose === 'app.bsky.graph.defs#curatelist'
              ? 'Curate List'
              : 'Mod List'}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleEditList}>
            <Text style={styles.actionButtonText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={handleDeleteList}
            disabled={isDeleting}>
            {isDeleting ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={styles.deleteButtonText}>Delete</Text>
            )}
          </TouchableOpacity>
        </View>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Members</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={members}
        renderItem={({item}) => (
          <MemberItem
            member={item}
            onRemove={handleRemoveMember}
            onProfilePress={handleProfilePress}
            isOwner={true} // TODO: Check if current user is the list owner
          />
        )}
        keyExtractor={(item) => item.uri}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={members.length === 0 ? styles.emptyContainer : undefined}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          isFetchingNextPage ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : null
        }
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
    backgroundColor: '#0f0f14',
    borderBottomWidth: 1,
    borderBottomColor: '#1f1f2e',
  },
  headerContent: {
    padding: 16,
  },
  listName: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  listDescription: {
    color: '#9ca3af',
    fontSize: 15,
    marginBottom: 8,
    lineHeight: 20,
  },
  listMemberCount: {
    color: '#6b7280',
    fontSize: 14,
    marginBottom: 4,
  },
  listPurpose: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#1f1f2e',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2d2d3e',
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: '#991b1b',
    borderColor: '#b91c1c',
  },
  deleteButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  sectionHeader: {
    padding: 16,
    paddingTop: 12,
    backgroundColor: '#0a0a0f',
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1f1f2e',
  },
  memberContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  avatarPlaceholder: {
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '600',
  },
  memberInfo: {
    flex: 1,
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
  removeButton: {
    backgroundColor: '#991b1b',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  removeButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  loadingText: {
    color: '#9ca3af',
    fontSize: 14,
    marginTop: 12,
  },
  emptyText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtext: {
    color: '#9ca3af',
    fontSize: 14,
    textAlign: 'center',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  errorSubtext: {
    color: '#9ca3af',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});
