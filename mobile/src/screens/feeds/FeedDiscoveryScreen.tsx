import React, {useState, useEffect, useMemo} from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import {useRouter} from 'expo-router';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {colors} from '../../constants/theme';
import {
  usePopularFeedGenerators,
  useSuggestedFeeds,
  useSearchFeedGenerators,
  useSavedFeeds,
  useSaveFeed,
  useUnsaveFeed,
  usePinFeed,
  useUnpinFeed,
  usePinnedFeeds,
} from '../../hooks/api';
import {AppBskyFeedDefs} from '@atproto/api';

type TabType = 'popular' | 'suggested' | 'search';

interface FeedDiscoveryScreenProps {
  initialTab?: TabType;
}

export function FeedDiscoveryScreen({initialTab = 'popular'}: FeedDiscoveryScreenProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const {data: savedFeedsData} = useSavedFeeds();
  const savedFeedUris = useMemo(() => {
    return new Set(savedFeedsData?.map((feed) => feed.uri) || []);
  }, [savedFeedsData]);

  const {data: pinnedFeedUris} = usePinnedFeeds();
  const pinnedFeedUrisSet = useMemo(() => {
    return new Set(pinnedFeedUris || []);
  }, [pinnedFeedUris]);

  const {mutate: saveFeed} = useSaveFeed();
  const {mutate: unsaveFeed} = useUnsaveFeed();
  const {mutate: pinFeed} = usePinFeed();
  const {mutate: unpinFeed} = useUnpinFeed();

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch data based on active tab
  const {
    data: popularData,
    isLoading: isLoadingPopular,
    fetchNextPage: fetchNextPopular,
    hasNextPage: hasNextPopular,
    isFetchingNextPage: isFetchingNextPopular,
    refetch: refetchPopular,
  } = usePopularFeedGenerators();

  const {
    data: suggestedData,
    isLoading: isLoadingSuggested,
    fetchNextPage: fetchNextSuggested,
    hasNextPage: hasNextSuggested,
    isFetchingNextPage: isFetchingNextSuggested,
    refetch: refetchSuggested,
  } = useSuggestedFeeds();

  const {
    data: searchData,
    isLoading: isLoadingSearch,
    fetchNextPage: fetchNextSearch,
    hasNextPage: hasNextSearch,
    isFetchingNextPage: isFetchingNextSearch,
    refetch: refetchSearch,
  } = useSearchFeedGenerators(debouncedQuery);

  const feeds = useMemo(() => {
    let data;
    switch (activeTab) {
      case 'popular':
        data = popularData;
        break;
      case 'suggested':
        data = suggestedData;
        break;
      case 'search':
        data = searchData;
        break;
    }
    return data?.pages.flatMap((page) => page.feeds) || [];
  }, [activeTab, popularData, suggestedData, searchData]);

  const isLoading =
    activeTab === 'popular'
      ? isLoadingPopular
      : activeTab === 'suggested'
        ? isLoadingSuggested
        : isLoadingSearch;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    switch (activeTab) {
      case 'popular':
        await refetchPopular();
        break;
      case 'suggested':
        await refetchSuggested();
        break;
      case 'search':
        await refetchSearch();
        break;
    }
    setIsRefreshing(false);
  };

  const handleLoadMore = () => {
    let hasNext, isFetching, fetchNext;
    switch (activeTab) {
      case 'popular':
        hasNext = hasNextPopular;
        isFetching = isFetchingNextPopular;
        fetchNext = fetchNextPopular;
        break;
      case 'suggested':
        hasNext = hasNextSuggested;
        isFetching = isFetchingNextSuggested;
        fetchNext = fetchNextSuggested;
        break;
      case 'search':
        hasNext = hasNextSearch;
        isFetching = isFetchingNextSearch;
        fetchNext = fetchNextSearch;
        break;
    }
    if (hasNext && !isFetching) {
      fetchNext();
    }
  };

  const handleFeedPress = (feedUri: string) => {
    router.push({
      pathname: '/(app)/(tabs)/(home)' as any,
      params: {feedUri},
    });
  };

  const handleToggleSave = (feedUri: string) => {
    if (savedFeedUris.has(feedUri)) {
      unsaveFeed(feedUri);
    } else {
      saveFeed(feedUri);
    }
  };

  const handleTogglePin = (feedUri: string) => {
    if (pinnedFeedUrisSet.has(feedUri)) {
      unpinFeed(feedUri);
    } else {
      pinFeed(feedUri);
    }
  };

  const renderFeedCard = ({item}: {item: AppBskyFeedDefs.GeneratorView}) => {
    const isSaved = savedFeedUris.has(item.uri);
    const isPinned = pinnedFeedUrisSet.has(item.uri);
    const likeCount = item.likeCount || 0;

    return (
      <TouchableOpacity
        style={styles.feedCard}
        onPress={() => handleFeedPress(item.uri)}
        activeOpacity={0.7}>
        <View style={styles.feedHeader}>
          {item.avatar ? (
            <Image source={{uri: item.avatar}} style={styles.feedAvatar} />
          ) : (
            <View style={[styles.feedAvatar, styles.feedAvatarPlaceholder]}>
              <Text style={styles.feedAvatarText}>{item.displayName?.[0] || '📰'}</Text>
            </View>
          )}
          <View style={styles.feedInfo}>
            <Text style={styles.feedName} numberOfLines={1}>
              {item.displayName}
            </Text>
            <Text style={styles.feedCreator} numberOfLines={1}>
              by @{item.creator.handle}
            </Text>
          </View>
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.saveButton, isSaved && styles.saveButtonActive]}
              onPress={() => handleToggleSave(item.uri)}
              activeOpacity={0.7}>
              <Text style={[styles.saveButtonText, isSaved && styles.saveButtonTextActive]}>
                {isSaved ? '✓' : '+'}
              </Text>
            </TouchableOpacity>
            {isSaved && (
              <TouchableOpacity
                style={[styles.pinButton, isPinned && styles.pinButtonActive]}
                onPress={() => handleTogglePin(item.uri)}
                activeOpacity={0.7}>
                <Text style={[styles.pinButtonText, isPinned && styles.pinButtonTextActive]}>
                  📌
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
        {item.description && (
          <Text style={styles.feedDescription} numberOfLines={3}>
            {item.description}
          </Text>
        )}
        <View style={styles.feedFooter}>
          <Text style={styles.feedLikes}>❤️ {likeCount.toLocaleString()} likes</Text>
          {isPinned && <Text style={styles.pinnedBadge}>📌 Pinned</Text>}
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => {
    if (isLoading) {
      return null;
    }

    if (activeTab === 'search' && !debouncedQuery) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>Search for custom feeds</Text>
          <Text style={styles.emptyStateSubtext}>Enter a search term to discover feeds</Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyStateText}>No feeds found</Text>
        <Text style={styles.emptyStateSubtext}>Try a different search or check back later</Text>
      </View>
    );
  };

  const renderFooter = () => {
    if (!isFetchingNextPopular && !isFetchingNextSuggested && !isFetchingNextSearch) {
      return null;
    }
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  };

  return (
    <View style={[styles.container, {paddingTop: insets.top}]}>
      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'popular' && styles.tabActive]}
          onPress={() => setActiveTab('popular')}
          activeOpacity={0.7}>
          <Text style={[styles.tabText, activeTab === 'popular' && styles.tabTextActive]}>
            Popular
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'suggested' && styles.tabActive]}
          onPress={() => setActiveTab('suggested')}
          activeOpacity={0.7}>
          <Text style={[styles.tabText, activeTab === 'suggested' && styles.tabTextActive]}>
            Suggested
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'search' && styles.tabActive]}
          onPress={() => setActiveTab('search')}
          activeOpacity={0.7}>
          <Text style={[styles.tabText, activeTab === 'search' && styles.tabTextActive]}>Search</Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar (only visible in search tab) */}
      {activeTab === 'search' && (
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search for feeds..."
            placeholderTextColor="#8899A6"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      )}

      {/* Feed List */}
      {isLoading && feeds.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={feeds}
          renderItem={renderFeedCard}
          keyExtractor={(item) => item.uri}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmptyState}
          ListFooterComponent={renderFooter}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
          removeClippedSubviews={true}
          maxToRenderPerBatch={8}
          windowSize={5}
          initialNumToRender={8}
          updateCellsBatchingPeriod={50}
          getItemLayout={(data, index) => ({
            length: 160,
            offset: 172 * index,
            index,
          })}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#15202B',
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#38444D',
    backgroundColor: '#192734',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8899A6',
  },
  tabTextActive: {
    color: colors.primary,
  },
  searchContainer: {
    padding: 12,
    backgroundColor: '#192734',
    borderBottomWidth: 1,
    borderBottomColor: '#38444D',
  },
  searchInput: {
    backgroundColor: '#253341',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    color: '#FFFFFF',
  },
  listContent: {
    padding: 12,
  },
  feedCard: {
    backgroundColor: '#192734',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#38444D',
  },
  feedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  feedAvatar: {
    width: 48,
    height: 48,
    borderRadius: 8,
    marginRight: 12,
  },
  feedAvatarPlaceholder: {
    backgroundColor: '#253341',
    justifyContent: 'center',
    alignItems: 'center',
  },
  feedAvatarText: {
    fontSize: 24,
  },
  feedInfo: {
    flex: 1,
    marginRight: 12,
  },
  feedName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  feedCreator: {
    fontSize: 14,
    color: '#8899A6',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  saveButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.primary,
    minWidth: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonActive: {
    backgroundColor: '#253341',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  saveButtonTextActive: {
    color: colors.primary,
  },
  pinButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#253341',
    borderWidth: 1,
    borderColor: '#38444D',
    minWidth: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pinButtonText: {
    fontSize: 14,
  },
  pinButtonTextActive: {
    fontSize: 14,
  },
  feedDescription: {
    fontSize: 14,
    color: '#D9D9D9',
    lineHeight: 20,
    marginBottom: 12,
  },
  feedFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  feedLikes: {
    fontSize: 14,
    color: '#8899A6',
  },
  pinnedBadge: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
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
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#8899A6',
    textAlign: 'center',
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});
