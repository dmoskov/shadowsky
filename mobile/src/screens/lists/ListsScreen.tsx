import React, {useMemo, useState, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import {UserListSkeleton} from "../../components/UserListSkeleton";
import {useLists} from '../../hooks/api';
import {useAppNavigation} from '../../hooks/useNavigation';
import {AppBskyGraphDefs} from '@atproto/api';
import {useTheme} from '../../contexts/ThemeContext';

interface ListItemProps {
  list: AppBskyGraphDefs.ListView;
  onPress: () => void;
  colors: any;
}

function ListItem({list, onPress, colors}: ListItemProps) {
  const styles = useMemo(() => createStyles(colors), [colors]);

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
  const {data, isLoading, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage} = useLists();
  const {navigateToList, router} = useAppNavigation();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    refetch().finally(() => setIsRefreshing(false));
  }, [refetch]);
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const lists = useMemo(
    () => data?.pages.flatMap((page) => page.lists) || [],
    [data],
  );

  const handleListPress = (list: AppBskyGraphDefs.ListView) => {
    // Extract the list URI or use it directly
    navigateToList(encodeURIComponent(list.uri));
  };

  const handleCreateList = () => {
    router.push('/(app)/lists/create');
  };

  const handleEndReached = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  const renderEmpty = () => {
    if (isLoading) {
      return <UserListSkeleton />;
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

  const renderFooter = () => {
    if (!isFetchingNextPage) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator color={colors.primary} size="small" />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.createButton} onPress={handleCreateList}>
          <Text style={styles.createButtonText}>+ Create List</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={lists}
        keyboardDismissMode="on-drag"
        renderItem={({item}) => (
          <ListItem list={item} onPress={() => handleListPress(item)} colors={colors} />
        )}
        keyExtractor={(item) => item.uri}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        contentContainerStyle={lists.length === 0 ? styles.emptyContainer : undefined}
        removeClippedSubviews={true}
        windowSize={10}
        maxToRenderPerBatch={10}
        initialNumToRender={10}
        updateCellsBatchingPeriod={50}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
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
    footerLoader: {
      paddingVertical: 16,
      alignItems: 'center',
    },
  });
}
