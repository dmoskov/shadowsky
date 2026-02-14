import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import {useLists} from '../../hooks/api';
import {useAppNavigation} from '../../hooks/useNavigation';
import {AppBskyGraphDefs} from '@atproto/api';
import {colors} from '../../constants/theme';

interface ListItemProps {
  list: AppBskyGraphDefs.ListView;
  onPress: () => void;
}

function ListItem({list, onPress}: ListItemProps) {
  return (
    <TouchableOpacity style={styles.listItem} onPress={onPress}>
      <View style={styles.listContent}>
        <Text style={styles.listName}>{list.name}</Text>
        {list.description && (
          <Text style={styles.listDescription} numberOfLines={2}>
            {list.description}
          </Text>
        )}
        <Text style={styles.listMemberCount}>
          {list.listItemCount || 0} members
        </Text>
      </View>
      <View style={styles.chevron}>
        <Text style={styles.chevronText}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

export function ListsScreen() {
  const {data, isLoading, error, refetch, isRefetching} = useLists();
  const {navigateToList, router} = useAppNavigation();

  const handleListPress = (list: AppBskyGraphDefs.ListView) => {
    // Extract the list URI or use it directly
    navigateToList(encodeURIComponent(list.uri));
  };

  const handleCreateList = () => {
    router.push('/(app)/lists/create');
  };

  const renderEmpty = () => {
    if (isLoading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.loadingText}>Loading lists...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Failed to load lists</Text>
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
        <Text style={styles.emptyText}>No lists yet</Text>
        <Text style={styles.emptySubtext}>
          Create lists on the web or other clients to see them here
        </Text>
      </View>
    );
  };

  const lists = data?.lists || [];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.createButton} onPress={handleCreateList}>
          <Text style={styles.createButtonText}>+ Create List</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={lists}
        renderItem={({item}) => (
          <ListItem list={item} onPress={() => handleListPress(item)} />
        )}
        keyExtractor={(item) => item.uri}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={lists.length === 0 ? styles.emptyContainer : undefined}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceAlt,
    backgroundColor: colors.background,
  },
  createButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  createButtonText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceAlt,
  },
  listContent: {
    flex: 1,
  },
  listName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  listDescription: {
    color: colors.textSecondary,
    fontSize: 14,
    marginBottom: 4,
  },
  listMemberCount: {
    color: colors.textTertiary,
    fontSize: 13,
  },
  chevron: {
    marginLeft: 8,
  },
  chevronText: {
    color: colors.textTertiary,
    fontSize: 24,
    fontWeight: '300',
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
    color: colors.textSecondary,
    fontSize: 14,
    marginTop: 12,
  },
  emptyText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtext: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
  },
  errorText: {
    color: colors.danger,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  errorSubtext: {
    color: colors.textSecondary,
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
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
});
