import React, {useEffect, useMemo, useState} from 'react';
import {
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {CloseIcon, SearchIcon} from '../../components/icons';
import {PostCardSkeleton} from '../../components/PostCardSkeleton';
import {useTheme} from '../../contexts/ThemeContext';
import {
  useDirectoryLabelers,
  useSearchLabelers,
  useSubscribedLabelers,
  useSubscribeToLabeler,
  useUnsubscribeFromLabeler,
} from '../../hooks/api/useLabelers';
import {
  LABELER_CATEGORIES,
  type LabelerCategory,
  type LabelerInfo,
} from '../../services/atproto/labelers';
import {fontSize} from '../../utils/typography';

export function DiscoverLabelers() {
  const {colors} = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [activeCategory, setActiveCategory] = useState<LabelerCategory>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const {data: subscribedLabelers} = useSubscribedLabelers();
  const {
    data: directoryLabelers,
    isLoading: isLoadingDirectory,
    refetch: refetchDirectory,
  } = useDirectoryLabelers(activeCategory);
  const {
    data: searchResults,
    isLoading: isLoadingSearch,
    refetch: refetchSearch,
  } = useSearchLabelers(debouncedQuery);

  const {mutate: subscribe} = useSubscribeToLabeler();
  const {mutate: unsubscribe} = useUnsubscribeFromLabeler();

  const isLoading = debouncedQuery ? isLoadingSearch : isLoadingDirectory;
  const labelers = debouncedQuery ? searchResults : directoryLabelers;

  const isSubscribed = (did: string) => {
    return subscribedLabelers?.some(l => l.did === did) || false;
  };

  const handleToggleSubscription = (labeler: LabelerInfo) => {
    if (isSubscribed(labeler.did)) {
      unsubscribe(labeler.did);
    } else {
      subscribe(labeler.did);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    if (debouncedQuery) {
      await refetchSearch();
    } else {
      await refetchDirectory();
    }
    setIsRefreshing(false);
  };

  const renderLabelerCard = ({item}: {item: LabelerInfo}) => {
    const subscribed = isSubscribed(item.did);

    return (
      <View style={styles.labelerCard}>
        <View style={styles.labelerHeader}>
          {item.creator.avatar ? (
            <Image
              source={{uri: item.creator.avatar}}
              style={styles.labelerAvatar}
            />
          ) : (
            <View style={[styles.labelerAvatar, styles.labelerAvatarPlaceholder]}>
              <Text style={styles.labelerAvatarText}>
                {item.creator.displayName?.[0] || '🛡'}
              </Text>
            </View>
          )}
          <View style={styles.labelerInfo}>
            <Text style={styles.labelerName} numberOfLines={1}>
              {item.creator.displayName || item.creator.handle}
            </Text>
            <Text style={styles.labelerHandle} numberOfLines={1}>
              @{item.creator.handle}
            </Text>
          </View>
          <TouchableOpacity
            style={[
              styles.subscribeButton,
              subscribed && styles.subscribeButtonActive,
            ]}
            onPress={() => handleToggleSubscription(item)}
            activeOpacity={0.7}>
            <Text
              style={[
                styles.subscribeButtonText,
                subscribed && styles.subscribeButtonTextActive,
              ]}>
              {subscribed ? 'Subscribed' : 'Subscribe'}
            </Text>
          </TouchableOpacity>
        </View>
        {item.creator.description && (
          <Text style={styles.labelerDescription} numberOfLines={3}>
            {item.creator.description}
          </Text>
        )}
        <View style={styles.labelerFooter}>
          {item.category && (
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeText}>{item.category}</Text>
            </View>
          )}
          {item.likeCount !== undefined && (
            <Text style={styles.labelerLikes}>
              {item.likeCount.toLocaleString()} likes
            </Text>
          )}
        </View>
      </View>
    );
  };

  const renderEmptyState = () => {
    if (isLoading) return null;

    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyStateText}>
          {debouncedQuery
            ? 'No labelers found'
            : 'No labelers available'}
        </Text>
        <Text style={styles.emptyStateSubtext}>
          {debouncedQuery
            ? 'Try a different search term'
            : 'Check back later for new moderation services'}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Search */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <SearchIcon size={18} color={colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search labelers..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Search labelers"
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

      {/* Category chips */}
      {!debouncedQuery && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryChips}>
          {LABELER_CATEGORIES.map(category => (
            <TouchableOpacity
              key={category}
              style={[
                styles.categoryChip,
                activeCategory === category && styles.categoryChipActive,
              ]}
              onPress={() => setActiveCategory(category)}
              activeOpacity={0.7}>
              <Text
                style={[
                  styles.categoryChipText,
                  activeCategory === category && styles.categoryChipTextActive,
                ]}>
                {category}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Labelers list */}
      {isLoading && !labelers?.length ? (
        <View style={styles.loadingContainer}>
          <PostCardSkeleton />
          <PostCardSkeleton />
          <PostCardSkeleton />
        </View>
      ) : (
        <FlatList
          data={labelers || []}
          keyExtractor={item => item.did}
          renderItem={renderLabelerCard}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
            />
          }
          removeClippedSubviews
          maxToRenderPerBatch={8}
          windowSize={5}
          initialNumToRender={8}
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
    categoryChips: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 8,
    },
    categoryChip: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: colors.surfaceElevated,
    },
    categoryChipActive: {
      backgroundColor: colors.primary,
    },
    categoryChipText: {
      fontSize: fontSize.caption1,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    categoryChipTextActive: {
      color: '#fff',
    },
    listContent: {
      padding: 12,
    },
    labelerCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.surfaceElevated,
    },
    labelerHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    labelerAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      marginRight: 12,
    },
    labelerAvatarPlaceholder: {
      backgroundColor: colors.surfaceElevated,
      justifyContent: 'center',
      alignItems: 'center',
    },
    labelerAvatarText: {
      fontSize: fontSize.title2,
    },
    labelerInfo: {
      flex: 1,
      marginRight: 12,
    },
    labelerName: {
      fontSize: fontSize.callout,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 2,
    },
    labelerHandle: {
      fontSize: fontSize.subheadline,
      color: colors.textSecondary,
    },
    subscribeButton: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: colors.primary,
      minWidth: 90,
      alignItems: 'center',
    },
    subscribeButtonActive: {
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    subscribeButtonText: {
      fontSize: fontSize.caption1,
      fontWeight: '600',
      color: '#fff',
    },
    subscribeButtonTextActive: {
      color: colors.primary,
    },
    labelerDescription: {
      fontSize: fontSize.subheadline,
      color: colors.textMuted,
      lineHeight: 20,
      marginBottom: 12,
    },
    labelerFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    categoryBadge: {
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 10,
      backgroundColor: colors.surfaceElevated,
    },
    categoryBadgeText: {
      fontSize: fontSize.caption2,
      fontWeight: '600',
      color: colors.primary,
    },
    labelerLikes: {
      fontSize: fontSize.caption1,
      color: colors.textSecondary,
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
    },
  });
}
