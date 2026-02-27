import { AppBskyFeedDefs } from "@atproto/api";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PostCardSkeleton } from "../../components/PostCardSkeleton";
import { CloseIcon, SearchIcon } from "../../components/icons";
import { useTheme } from "../../contexts/ThemeContext";
import {
  usePinFeed,
  usePinnedFeeds,
  usePopularFeedGenerators,
  useSavedFeeds,
  useSaveFeed,
  useSearchFeedGenerators,
  useSuggestedFeeds,
  useUnpinFeed,
  useUnsaveFeed,
} from "../../hooks/api";

type TabType = "popular" | "suggested" | "search";

interface FeedDiscoveryScreenProps {
  initialTab?: TabType;
  embedded?: boolean;
}

export function FeedDiscoveryScreen({
  initialTab = "popular",
  embedded = false,
}: FeedDiscoveryScreenProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { data: savedFeedsData } = useSavedFeeds();
  const savedFeedUris = useMemo(() => {
    return new Set(savedFeedsData?.map((feed) => feed.uri) || []);
  }, [savedFeedsData]);

  const { data: pinnedFeedUris } = usePinnedFeeds();
  const pinnedFeedUrisSet = useMemo(() => {
    return new Set(pinnedFeedUris || []);
  }, [pinnedFeedUris]);

  const { mutate: saveFeed } = useSaveFeed();
  const { mutate: unsaveFeed } = useUnsaveFeed();
  const { mutate: pinFeed } = usePinFeed();
  const { mutate: unpinFeed } = useUnpinFeed();

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
      case "popular":
        data = popularData;
        break;
      case "suggested":
        data = suggestedData;
        break;
      case "search":
        data = searchData;
        break;
    }
    return data?.pages.flatMap((page) => page.feeds) || [];
  }, [activeTab, popularData, suggestedData, searchData]);

  const isLoading =
    activeTab === "popular"
      ? isLoadingPopular
      : activeTab === "suggested"
        ? isLoadingSuggested
        : isLoadingSearch;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    switch (activeTab) {
      case "popular":
        await refetchPopular();
        break;
      case "suggested":
        await refetchSuggested();
        break;
      case "search":
        await refetchSearch();
        break;
    }
    setIsRefreshing(false);
  };

  const handleLoadMore = () => {
    let hasNext, isFetching, fetchNext;
    switch (activeTab) {
      case "popular":
        hasNext = hasNextPopular;
        isFetching = isFetchingNextPopular;
        fetchNext = fetchNextPopular;
        break;
      case "suggested":
        hasNext = hasNextSuggested;
        isFetching = isFetchingNextSuggested;
        fetchNext = fetchNextSuggested;
        break;
      case "search":
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
      pathname: "/(app)/(tabs)/(home)" as any,
      params: { feedUri },
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

  const renderFeedCard = ({
    item,
  }: {
    item: AppBskyFeedDefs.GeneratorView;
  }) => {
    const isSaved = savedFeedUris.has(item.uri);
    const isPinned = pinnedFeedUrisSet.has(item.uri);
    const likeCount = item.likeCount || 0;

    return (
      <TouchableOpacity
        style={styles.feedCard}
        onPress={() => handleFeedPress(item.uri)}
        activeOpacity={0.7}
      >
        <View style={styles.feedHeader}>
          {item.avatar ? (
            <Image source={{ uri: item.avatar }} style={styles.feedAvatar} />
          ) : (
            <View style={[styles.feedAvatar, styles.feedAvatarPlaceholder]}>
              <Text style={styles.feedAvatarText}>
                {item.displayName?.[0] || "📰"}
              </Text>
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
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.saveButtonText,
                  isSaved && styles.saveButtonTextActive,
                ]}
              >
                {isSaved ? "✓" : "+"}
              </Text>
            </TouchableOpacity>
            {isSaved && (
              <TouchableOpacity
                style={[styles.pinButton, isPinned && styles.pinButtonActive]}
                onPress={() => handleTogglePin(item.uri)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.pinButtonText,
                    isPinned && styles.pinButtonTextActive,
                  ]}
                >
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
          <Text style={styles.feedLikes}>
            ❤️ {likeCount.toLocaleString()} likes
          </Text>
          {isPinned && <Text style={styles.pinnedBadge}>📌 Pinned</Text>}
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => {
    if (isLoading) {
      return null;
    }

    if (activeTab === "search" && !debouncedQuery) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>Search for custom feeds</Text>
          <Text style={styles.emptyStateSubtext}>
            Enter a search term to discover feeds
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyStateText}>No feeds found</Text>
        <Text style={styles.emptyStateSubtext}>
          Try a different search or check back later
        </Text>
      </View>
    );
  };

  const renderFooter = () => {
    if (
      !isFetchingNextPopular &&
      !isFetchingNextSuggested &&
      !isFetchingNextSearch
    ) {
      return null;
    }
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  };

  return (
    <View style={[styles.container, !embedded && { paddingTop: insets.top }]}>
      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "popular" && styles.tabActive]}
          onPress={() => setActiveTab("popular")}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "popular" && styles.tabTextActive,
            ]}
          >
            Popular
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "suggested" && styles.tabActive]}
          onPress={() => setActiveTab("suggested")}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "suggested" && styles.tabTextActive,
            ]}
          >
            Suggested
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "search" && styles.tabActive]}
          onPress={() => setActiveTab("search")}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "search" && styles.tabTextActive,
            ]}
          >
            Search
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar (only visible in search tab) */}
      {activeTab === "search" && (
        <View style={styles.searchContainer}>
          <View style={styles.searchInputWrapper}>
            <SearchIcon size={18} color={colors.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search for feeds..."
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              returnKeyType="search"
              accessibilityLabel="Search feeds"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setSearchQuery("");
                  setDebouncedQuery("");
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel="Clear search"
                accessibilityRole="button"
              >
                <CloseIcon size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Feed List */}
      {isLoading && feeds.length === 0 ? (
        <View style={styles.loadingContainer}>
          <PostCardSkeleton />
          <PostCardSkeleton />
          <PostCardSkeleton />
          <PostCardSkeleton />
        </View>
      ) : (
        <FlatList
          data={feeds}
          keyboardDismissMode="on-drag"
          renderItem={renderFeedCard}
          keyExtractor={(item) => item.uri}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmptyState}
          ListFooterComponent={renderFooter}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
            />
          }
          removeClippedSubviews={true}
          maxToRenderPerBatch={8}
          windowSize={5}
          initialNumToRender={8}
          updateCellsBatchingPeriod={50}
          getItemLayout={(_data, index) => ({
            length: 160,
            offset: 172 * index,
            index,
          })}
        />
      )}
    </View>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.surface,
    },
    tabs: {
      flexDirection: "row",
      borderBottomWidth: 1,
      borderBottomColor: colors.surface,
      backgroundColor: colors.surface,
    },
    tab: {
      flex: 1,
      paddingVertical: 16,
      alignItems: "center",
    },
    tabActive: {
      borderBottomWidth: 2,
      borderBottomColor: colors.primary,
    },
    tabText: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.textSecondary,
    },
    tabTextActive: {
      color: colors.primary,
    },
    searchContainer: {
      padding: 12,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.surface,
    },
    searchInputWrapper: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: 20,
      paddingHorizontal: 12,
      gap: 8,
    },
    searchInput: {
      flex: 1,
      paddingVertical: 10,
      fontSize: 16,
      color: colors.text,
    },
    listContent: {
      padding: 12,
    },
    feedCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.surface,
    },
    feedHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 12,
    },
    feedAvatar: {
      width: 48,
      height: 48,
      borderRadius: 8,
      marginRight: 12,
    },
    feedAvatarPlaceholder: {
      backgroundColor: colors.surface,
      justifyContent: "center",
      alignItems: "center",
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
      fontWeight: "700",
      color: colors.text,
      marginBottom: 2,
    },
    feedCreator: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    actionButtons: {
      flexDirection: "row",
      gap: 8,
    },
    saveButton: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: colors.primary,
      minWidth: 36,
      alignItems: "center",
      justifyContent: "center",
    },
    saveButtonActive: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    saveButtonText: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.text,
    },
    saveButtonTextActive: {
      color: colors.primary,
    },
    pinButton: {
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.surface,
      minWidth: 36,
      alignItems: "center",
      justifyContent: "center",
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
      color: colors.textMuted,
      lineHeight: 20,
      marginBottom: 12,
    },
    feedFooter: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    feedLikes: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    pinnedBadge: {
      fontSize: 12,
      color: colors.primary,
      fontWeight: "600",
    },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    emptyState: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 32,
      paddingVertical: 64,
    },
    emptyStateText: {
      fontSize: 18,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 8,
      textAlign: "center",
    },
    emptyStateSubtext: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: "center",
    },
    footerLoader: {
      paddingVertical: 20,
      alignItems: "center",
    },
  });
}
