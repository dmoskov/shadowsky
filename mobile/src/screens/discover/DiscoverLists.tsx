import {useRouter} from 'expo-router';
import React, {useEffect, useMemo, useState} from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {Avatar} from '../../components/Avatar';
import {CloseIcon, SearchIcon} from '../../components/icons';
import {PostCardSkeleton} from '../../components/PostCardSkeleton';
import {useTheme} from '../../contexts/ThemeContext';
import {useSearchActors} from '../../hooks/api/useProfile';
import {fontSize} from '../../utils/typography';

type SubTab = 'suggested' | 'search';

export function DiscoverLists() {
  const {colors} = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('suggested');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Use actor search to find users, then we display them with option to view lists
  const {
    data: actors,
    isLoading,
    refetch,
  } = useSearchActors(activeSubTab === 'search' ? debouncedQuery : '');

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  const handleProfilePress = (handle: string) => {
    router.push(`/(app)/(tabs)/(search)/profile/${handle}` as any);
  };

  const renderActorItem = ({item}: {item: any}) => (
    <TouchableOpacity
      style={styles.actorCard}
      onPress={() => handleProfilePress(item.handle)}
      activeOpacity={0.7}>
      <Avatar uri={item.avatar} size={48} />
      <View style={styles.actorInfo}>
        <Text style={styles.actorName} numberOfLines={1}>
          {item.displayName || item.handle}
        </Text>
        <Text style={styles.actorHandle} numberOfLines={1}>
          @{item.handle}
        </Text>
        {item.description && (
          <Text style={styles.actorDescription} numberOfLines={2}>
            {item.description}
          </Text>
        )}
        <Text style={styles.viewListsHint}>Tap to view profile & lists</Text>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => {
    if (isLoading) return null;

    if (activeSubTab === 'search' && !debouncedQuery) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>Search for users</Text>
          <Text style={styles.emptyStateSubtext}>
            Find users to discover their public lists
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyStateText}>No results found</Text>
        <Text style={styles.emptyStateSubtext}>Try a different search term</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Sub-tabs */}
      <View style={styles.subTabs}>
        <TouchableOpacity
          style={[
            styles.subTab,
            activeSubTab === 'suggested' && styles.subTabActive,
          ]}
          onPress={() => setActiveSubTab('suggested')}
          activeOpacity={0.7}>
          <Text
            style={[
              styles.subTabText,
              activeSubTab === 'suggested' && styles.subTabTextActive,
            ]}>
            Browse
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.subTab,
            activeSubTab === 'search' && styles.subTabActive,
          ]}
          onPress={() => setActiveSubTab('search')}
          activeOpacity={0.7}>
          <Text
            style={[
              styles.subTabText,
              activeSubTab === 'search' && styles.subTabTextActive,
            ]}>
            Search
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search input */}
      {activeSubTab === 'search' && (
        <View style={styles.searchContainer}>
          <View style={styles.searchInputWrapper}>
            <SearchIcon size={18} color={colors.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search users to find their lists..."
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              accessibilityLabel="Search for users"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setSearchQuery('');
                  setDebouncedQuery('');
                }}
                hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
                accessibilityLabel="Clear search">
                <CloseIcon size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {activeSubTab === 'suggested' ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>Discover Lists</Text>
          <Text style={styles.emptyStateSubtext}>
            Switch to Search to find users and explore their public lists. Lists
            let you follow curated groups of accounts.
          </Text>
        </View>
      ) : isLoading && !actors ? (
        <View style={styles.loadingContainer}>
          <PostCardSkeleton />
          <PostCardSkeleton />
          <PostCardSkeleton />
        </View>
      ) : (
        <FlatList
          data={actors || []}
          keyExtractor={item => item.did}
          renderItem={renderActorItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
            />
          }
          removeClippedSubviews
          maxToRenderPerBatch={10}
          windowSize={7}
          initialNumToRender={10}
        />
      )}
    </View>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    subTabs: {
      flexDirection: 'row',
      paddingHorizontal: 12,
      paddingVertical: 8,
      gap: 8,
    },
    subTab: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: colors.surfaceElevated,
    },
    subTabActive: {
      backgroundColor: colors.primary,
    },
    subTabText: {
      fontSize: fontSize.subheadline,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    subTabTextActive: {
      color: '#fff',
    },
    searchContainer: {
      padding: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.surfaceElevated,
    },
    searchInputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceElevated,
      borderRadius: 20,
      paddingHorizontal: 12,
      gap: 8,
    },
    searchInput: {
      flex: 1,
      paddingVertical: 10,
      fontSize: fontSize.callout,
      color: colors.text,
    },
    listContent: {
      padding: 12,
    },
    actorCard: {
      flexDirection: 'row',
      padding: 16,
      backgroundColor: colors.surface,
      borderRadius: 12,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.surfaceElevated,
    },
    actorInfo: {
      flex: 1,
      marginLeft: 12,
    },
    actorName: {
      fontSize: fontSize.callout,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 2,
    },
    actorHandle: {
      fontSize: fontSize.subheadline,
      color: colors.textSecondary,
      marginBottom: 4,
    },
    actorDescription: {
      fontSize: fontSize.subheadline,
      color: colors.textMuted,
      lineHeight: 20,
      marginBottom: 4,
    },
    viewListsHint: {
      fontSize: fontSize.caption1,
      color: colors.primary,
      fontWeight: '500',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 32,
      paddingVertical: 64,
    },
    emptyStateText: {
      fontSize: fontSize.headline,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
      textAlign: 'center',
    },
    emptyStateSubtext: {
      fontSize: fontSize.subheadline,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
    },
  });
}
