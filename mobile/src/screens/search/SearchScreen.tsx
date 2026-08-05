import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useScrollToTop } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSearchActors } from "../../hooks/api/useProfile";
import { useSearchPosts } from "../../hooks/api/useSearchPosts";
import { Avatar } from "../../components/Avatar";
import { FeedList } from "../../components/FeedList";
import { NativeFeedList as _NativeFeedList } from "../../../modules/native-feed-list";

const NativeFeedList = Platform.OS === "ios" ? _NativeFeedList : null;
import { useScrollChrome } from "../../contexts/ScrollChromeContext";
import { PostCardSkeleton } from "../../components/PostCardSkeleton";
import { TrendingTopics } from "../../components/TrendingTopics";
import { SearchFilterSheet, type SearchFilterValues } from "../../components/SearchFilterSheet";
import { EditPostModal } from "../../components/EditPostModal";
import { findPostInFeedPages, useNativePostEditor } from "../../hooks/useNativePostEditor";
import { CloseIcon, SearchIcon } from "../../components/icons";
import { AppBskyActorDefs, AppBskyFeedDefs, AppBskyEmbedRecordWithMedia } from "@atproto/api";
import { useBookmarks } from "../../hooks/api/useBookmarks";
import { useTrendingData } from "../../hooks/useTrending";
import { useTheme } from "../../contexts/ThemeContext";
import { useOfflineFeedEnhancer, useOfflineFeedStatus } from "../../hooks/useOfflineFeed";
import StaleContentIndicator from "../../components/StaleContentIndicator";

import { createLogger } from '../../utils/logger';
import {fontSize} from '../../utils/typography';

const logger = createLogger('SearchScreen');
const SEARCH_HISTORY_KEY = "@search_history";
const MAX_HISTORY_ITEMS = 20;

// Feature flag for native search view on iOS
const USE_NATIVE_SEARCH = Platform.OS === 'ios';

// Lazy-load native search module to avoid crashes on Android
let NativeSearchComponent: React.ComponentType<any> | null = null;
if (USE_NATIVE_SEARCH) {
  try {
    const mod = require('../../../modules/native-search');
    NativeSearchComponent = mod.NativeSearchView;
  } catch (e) {
    // Native module not available, fall back to JS
  }
}

type TabType = "people" | "posts" | "hashtags";
type MediaFilter = "all" | "images" | "videos" | "links";

interface SearchScreenProps {
  query?: string;
}

interface SearchFilters {
  sort: "top" | "latest";
  since?: string;
  until?: string;
  lang?: string;
  author?: string;
  domain?: string;
  mediaFilter?: MediaFilter;
}

export function SearchScreen({ query: initialQuery }: SearchScreenProps) {
  const { colors } = useTheme();
  const router = useRouter();

  const styles = useMemo(() => createStyles(colors), [colors]);

  // Scroll-to-top support: must run before conditional return (rules of hooks)
  const [nativeScrollTrigger, setNativeScrollTrigger] = useState(0);
  const nativeScrollRef = useRef<any>({
    scrollToTop: () => setNativeScrollTrigger(prev => prev + 1),
  });
  const { handleScroll: handleChromeScroll } = useScrollChrome();
  const scrollRef = useRef<FlatList>(null);

  // Register scroll-to-top for this screen (handles tab re-tap)
  useScrollToTop(
    USE_NATIVE_SEARCH && NativeSearchComponent ? nativeScrollRef : scrollRef
  );

  // On iOS, render the native SwiftUI search view
  if (USE_NATIVE_SEARCH && NativeSearchComponent) {
    return (
      <View style={styles.nativeSearchContainer}>
        <NativeSearchComponent
          scrollToTopTrigger={nativeScrollTrigger}
          style={styles.nativeSearchView}
        />
      </View>
    );
  }
  const [activeTab, setActiveTab] = useState<TabType>("posts");
  const [searchQuery, setSearchQuery] = useState(initialQuery || "");
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery || "");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const handleCloseFilters = useCallback(() => setShowFilters(false), []);
  const [filters, setFilters] = useState<SearchFilters>({
    sort: "top",
    mediaFilter: "all",
  });
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const { toggleBookmark, isBookmarked: checkIsBookmarked } = useBookmarks();
  const { topics, trends, isLoading: isLoadingTrending } = useTrendingData();

  // Load search history on mount
  useEffect(() => {
    loadSearchHistory();
  }, []);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      if (searchQuery && searchQuery.length > 0) {
        setShowHistory(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Save to history only when debounced query settles (not on every keystroke)
  useEffect(() => {
    if (debouncedQuery && debouncedQuery.trim().length > 1) {
      saveToHistory(debouncedQuery);
    }
  }, [debouncedQuery]);

  const loadSearchHistory = async () => {
    try {
      const history = await AsyncStorage.getItem(SEARCH_HISTORY_KEY);
      if (history) {
        setSearchHistory(JSON.parse(history));
      }
    } catch (error) {
      logger.error('Failed to load search history:', error);
    }
  };

  const saveToHistory = async (query: string) => {
    try {
      const trimmedQuery = query.trim();
      if (!trimmedQuery) return;

      const history = await AsyncStorage.getItem(SEARCH_HISTORY_KEY);
      let historyArray: string[] = history ? JSON.parse(history) : [];

      // Remove duplicate if exists
      historyArray = historyArray.filter((item) => item !== trimmedQuery);

      // Add to beginning
      historyArray.unshift(trimmedQuery);

      // Limit to MAX_HISTORY_ITEMS
      historyArray = historyArray.slice(0, MAX_HISTORY_ITEMS);

      await AsyncStorage.setItem(
        SEARCH_HISTORY_KEY,
        JSON.stringify(historyArray)
      );
      setSearchHistory(historyArray);
    } catch (error) {
      logger.error('Failed to save search history:', error);
    }
  };

  const clearHistory = async () => {
    try {
      await AsyncStorage.removeItem(SEARCH_HISTORY_KEY);
      setSearchHistory([]);
    } catch (error) {
      logger.error('Failed to clear search history:', error);
    }
  };

  // Build search query with hashtag prefix for hashtag tab
  const effectiveQuery = useMemo(() => {
    if (activeTab === "hashtags" && debouncedQuery && !debouncedQuery.startsWith("#")) {
      return `#${debouncedQuery}`;
    }
    return debouncedQuery;
  }, [activeTab, debouncedQuery]);

  // Fetch search results based on active tab
  const {
    data: actors,
    isLoading: isLoadingActors,
    isError: isErrorActors,
    refetch: refetchActors,
  } = useSearchActors(activeTab === "people" ? debouncedQuery : "");

  const apiFilters = useMemo(() => {
    const { mediaFilter: _media, ...rest } = filters;
    return rest;
  }, [filters]);

  const searchPostsQuery = useSearchPosts(
    activeTab === "posts" || activeTab === "hashtags" ? effectiveQuery : "",
    apiFilters
  );
  const enhancedSearchQuery = useOfflineFeedEnhancer(searchPostsQuery, 'search', ['searchPosts', effectiveQuery, apiFilters]);
  const {
    data: postsData,
    isLoading: isLoadingPosts,
    isError: isErrorPosts,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch: refetchPosts,
  } = enhancedSearchQuery;
  const { isServingCached: isSearchServingCached, isStale: isSearchStale, isOnline: isSearchOnline } = enhancedSearchQuery;
  const searchOfflineStatus = useOfflineFeedStatus();

  // Native context menu "Edit Post" → RN edit sheet. The native event carries
  // only a URI, so resolve it against the results we already hold.
  const findPostForEdit = useCallback(
    (uri: string) => findPostInFeedPages(postsData?.pages, uri),
    [postsData?.pages],
  );
  const postEditor = useNativePostEditor(findPostForEdit);

  const posts = useMemo(() => {
    let allPosts = postsData?.pages.flatMap((page) => page.feed) || [];

    // Apply media filter
    if (filters.mediaFilter && filters.mediaFilter !== "all") {
      allPosts = allPosts.filter((post) => {
        const embed = post.post.embed;
        if (!embed) return filters.mediaFilter === "links";

        const media = (embed as AppBskyEmbedRecordWithMedia.View).media;
        switch (filters.mediaFilter) {
          case "images":
            return embed.$type === "app.bsky.embed.images#view" ||
                   (embed.$type === "app.bsky.embed.recordWithMedia#view" &&
                    media?.$type === "app.bsky.embed.images#view");
          case "videos":
            return embed.$type === "app.bsky.embed.video#view" ||
                   (embed.$type === "app.bsky.embed.recordWithMedia#view" &&
                    media?.$type === "app.bsky.embed.video#view");
          case "links":
            return embed.$type === "app.bsky.embed.external#view" ||
                   (embed.$type === "app.bsky.embed.recordWithMedia#view" &&
                    media?.$type === "app.bsky.embed.external#view");
          default:
            return true;
        }
      });
    }

    return allPosts;
  }, [postsData, filters.mediaFilter]);

  const isLoading =
    activeTab === "people" ? isLoadingActors : isLoadingPosts;
  const isError =
    activeTab === "people" ? isErrorActors : isErrorPosts;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    if (activeTab === "people") {
      await refetchActors();
    } else {
      await refetchPosts();
    }
    setIsRefreshing(false);
  };

  const handleLoadMore = () => {
    if ((activeTab === "posts" || activeTab === "hashtags") && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  const handleProfilePress = (handle: string) => {
    router.push(`/(app)/(tabs)/(search)/profile/${handle}`);
  };

  const handlePostPress = (post: AppBskyFeedDefs.FeedViewPost) => {
    const postAuthor = post.post.author.handle;
    const postId = post.post.uri.split("/").pop();
    router.push(`/(app)/(tabs)/(search)/thread/${postId}?handle=${postAuthor}&did=${encodeURIComponent(post.post.author.did)}`);
  };


  // Native event handlers for NativeFeedList (wrap native events to match JS API)
  const handleNativePostPress = useCallback((event: { nativeEvent: { uri: string; handle: string } }) => {
    const { uri, handle } = event.nativeEvent;
    const postId = uri.split("/").pop();
    const did = uri.split("/")[2]; // at://did/app.bsky.feed.post/postId
    router.push("/(app)/(tabs)/(search)/thread/" + postId + "?handle=" + handle + "&did=" + encodeURIComponent(did));
  }, [router]);

  const handleNativeProfilePress = useCallback((event: { nativeEvent: { handle: string } }) => {
    router.push("/(app)/(tabs)/(search)/profile/" + event.nativeEvent.handle);
  }, [router]);

  const handleNativeBookmark = useCallback((event: { nativeEvent: { uri: string } }) => {
    const { uri } = event.nativeEvent;
    const feedViewPost = posts.find(p => p.post.uri === uri);
    if (feedViewPost) {
      toggleBookmark(feedViewPost.post);
    }
  }, [posts, toggleBookmark]);

  const handleHistoryItemPress = (query: string) => {
    setSearchQuery(query);
    setShowHistory(false);
  };

  const handleTrendingTopicClick = (topic: string) => {
    // Remove # prefix if present
    const cleanTopic = topic.startsWith("#") ? topic.slice(1) : topic;
    setSearchQuery(cleanTopic);
    setActiveTab("posts");
    setShowHistory(false);
  };

  const isBookmarked = (postUri: string) => {
    return checkIsBookmarked(postUri);
  };

  const handleBookmark = (post: AppBskyFeedDefs.FeedViewPost) => {
    toggleBookmark(post.post);
  };

  const handleApplyFilters = useCallback((newFilters: SearchFilterValues) => {
    setFilters(newFilters);
  }, []);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.sort !== "top") count++;
    if (filters.mediaFilter && filters.mediaFilter !== "all") count++;
    if (filters.since) count++;
    if (filters.lang) count++;
    if (filters.author) count++;
    if (filters.domain) count++;
    return count;
  }, [filters]);

  const renderSearchResult = ({
    item,
  }: {
    item: AppBskyActorDefs.ProfileView;
  }) => (
    <TouchableOpacity
      style={styles.resultItem}
      onPress={() => handleProfilePress(item.handle)}
      activeOpacity={0.7}
    >
      <Avatar uri={item.avatar} size={48} />
      <View style={styles.resultInfo}>
        <Text style={styles.displayName} numberOfLines={1}>
          {item.displayName || item.handle}
        </Text>
        <Text style={styles.handle} numberOfLines={1}>
          @{item.handle}
        </Text>
        {item.description && (
          <Text style={styles.description} numberOfLines={2}>
            {item.description}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => {
    if (isLoading) {
      return null;
    }

    if (!debouncedQuery) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>
            {activeTab === "people"
              ? "Search for users by name or handle"
              : activeTab === "hashtags"
              ? "Search for posts by hashtag"
              : "Search for posts by keyword"}
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyStateText}>No results found</Text>
        <Text style={styles.emptyStateSubtext}>
          Try a different search term
        </Text>
      </View>
    );
  };

  const renderHistoryItem = ({ item }: { item: string }) => (
    <TouchableOpacity
      style={styles.historyItem}
      onPress={() => handleHistoryItemPress(item)}
      activeOpacity={0.7}
    >
      <Text style={styles.historyText}>{item}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <View style={styles.searchInputContainer}>
          <SearchIcon size={18} color={colors.textTertiary} />
          <TextInput
            style={styles.input}
            placeholder="Search posts, users, hashtags..."
            placeholderTextColor={colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => setShowHistory(searchHistory.length > 0 && !searchQuery)}
            onSubmitEditing={() => {
              if (searchQuery.trim()) {
                setDebouncedQuery(searchQuery);
                setShowHistory(false);
              }
            }}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            returnKeyType="search"
            enablesReturnKeyAutomatically
            accessibilityLabel="Search"
            accessibilityHint="Search posts, users, and hashtags"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setSearchQuery("");
                setDebouncedQuery("");
                setShowHistory(false);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Clear search"
              accessibilityRole="button"
            >
              <CloseIcon size={18} color={colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Trending Topics */}
      {!showHistory && !debouncedQuery && (
        <TrendingTopics
          topics={topics}
          trends={trends}
          onTopicClick={handleTrendingTopicClick}
          isLoading={isLoadingTrending}
        />
      )}

      {/* Search History Suggestions */}
      {showHistory && searchHistory.length > 0 && (
        <View style={styles.historyContainer}>
          <View style={styles.historyHeader}>
            <Text style={styles.historyTitle}>Recent Searches</Text>
            <TouchableOpacity onPress={clearHistory}>
              <Text style={styles.clearHistoryText}>Clear</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            onScroll={(e) => handleChromeScroll(e.nativeEvent.contentOffset.y)}
            scrollEventThrottle={16}
            data={searchHistory}
            keyExtractor={(item, index) => `${item}-${index}`}
            renderItem={renderHistoryItem}
            style={styles.historyList}
            keyboardShouldPersistTaps="handled"
          />
        </View>
      )}

      {/* Tabs */}
      {!showHistory && (
        <>
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === "people" && styles.activeTab]}
              onPress={() => setActiveTab("people")}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === "people" && styles.activeTabText,
                ]}
              >
                People
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === "posts" && styles.activeTab]}
              onPress={() => setActiveTab("posts")}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === "posts" && styles.activeTabText,
                ]}
              >
                Posts
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === "hashtags" && styles.activeTab]}
              onPress={() => setActiveTab("hashtags")}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === "hashtags" && styles.activeTabText,
                ]}
              >
                Hashtags
              </Text>
            </TouchableOpacity>
          </View>

          {/* Filter button for Posts/Hashtags tab */}
          {(activeTab === "posts" || activeTab === "hashtags") && debouncedQuery && (
            <View style={styles.filterBar}>
              <TouchableOpacity
                style={[
                  styles.filterButton,
                  activeFilterCount > 0 && styles.filterButtonActive,
                ]}
                onPress={() => setShowFilters(true)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.filterButtonText,
                    activeFilterCount > 0 && styles.filterButtonTextActive,
                  ]}
                >
                  Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Offline indicator for search results */}
          {(activeTab === "posts" || activeTab === "hashtags") && (
            <StaleContentIndicator
              isStale={isSearchServingCached || isSearchStale}
              lastCachedAt={searchOfflineStatus.lastCachedAt}
              onRetry={isSearchOnline ? refetchPosts : undefined}
              isOnline={isSearchOnline}
            />
          )}

          {/* Content */}
          {isLoading && debouncedQuery ? (
            <View style={styles.loadingContainer} testID="search-loading">
              <PostCardSkeleton />
              <PostCardSkeleton />
              <PostCardSkeleton />
            </View>
          ) : activeTab === "people" ? (
            <FlatList
            onScroll={(e) => handleChromeScroll(e.nativeEvent.contentOffset.y)}
            scrollEventThrottle={16}
              ref={scrollRef}
              data={actors || []}
              keyExtractor={(item) => item.did}
              renderItem={renderSearchResult}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={renderEmptyState}
              removeClippedSubviews={true}
              windowSize={10}
              maxToRenderPerBatch={15}
              initialNumToRender={15}
              updateCellsBatchingPeriod={50}
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshing}
                  onRefresh={handleRefresh}
                  tintColor={colors.primary}
                  colors={[colors.primary]}
                />
              }
            />
          ) : (
            NativeFeedList ? (
              <NativeFeedList
                query={enhancedSearchQuery}
                onPostPress={handleNativePostPress}
                onProfilePress={handleNativeProfilePress}
                onBookmark={handleNativeBookmark}
                onEditPost={postEditor.handleNativeEditPost}
                currentUserDid={postEditor.currentUserDid}
                onScroll={(e) => handleChromeScroll(e.nativeEvent.y)}
                emptyMessage={!debouncedQuery
                  ? (activeTab === "hashtags" ? "Search for posts by hashtag" : "Search for posts by keyword")
                  : "No results found"
                }
              />
            ) : (
              <FeedList
                posts={posts}
                isLoading={isLoadingPosts && !!debouncedQuery}
                isRefreshing={isRefreshing}
                isLoadingMore={isFetchingNextPage}
                error={isError ? new Error("Failed to load posts") : null}
                onRefresh={handleRefresh}
                onLoadMore={handleLoadMore}
                onPostPress={handlePostPress}
                onProfilePress={handleProfilePress}
                onBookmark={handleBookmark}
                isBookmarked={isBookmarked}
                emptyMessage={!debouncedQuery
                  ? (activeTab === "hashtags" ? "Search for posts by hashtag" : "Search for posts by keyword")
                  : "No results found"
                }
              />
            )
          )}
        </>
      )}

      {/* Advanced Search Filters Sheet */}
      <SearchFilterSheet
        visible={showFilters}
        onClose={handleCloseFilters}
        filters={filters}
        onApplyFilters={handleApplyFilters}
      />

      {/* Edit sheet, opened from the native context menu */}
      {postEditor.editingPost && (
        <EditPostModal
          visible
          post={postEditor.editingPost}
          currentUserDid={postEditor.currentUserDid}
          onClose={postEditor.closeEditor}
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
  searchBar: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceElevated,
  },
  searchInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceElevated,
    borderRadius: 8,
    paddingHorizontal: 12,
    gap: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    color: colors.text,
    fontSize: fontSize.callout,
  },
  tabContainer: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceElevated,
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  activeTab: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: fontSize.callout,
    fontWeight: "600",
    color: colors.textTertiary,
  },
  activeTabText: {
    color: colors.primary,
  },
  filterBar: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceElevated,
  },
  filterButton: {
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  filterButtonText: {
    color: colors.textSecondary,
    fontSize: fontSize.subheadline,
    fontWeight: "500",
  },
  listContent: {
    flexGrow: 1,
  },
  resultItem: {
    flexDirection: "row",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceElevated,
    alignItems: "flex-start",
  },
  resultInfo: {
    flex: 1,
    marginLeft: 12,
  },
  displayName: {
    color: colors.text,
    fontSize: fontSize.callout,
    fontWeight: "600",
    marginBottom: 2,
  },
  handle: {
    color: colors.textSecondary,
    fontSize: fontSize.subheadline,
    marginBottom: 4,
  },
  description: {
    color: colors.textTertiary,
    fontSize: fontSize.subheadline,
    marginTop: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: fontSize.callout,
    marginTop: 12,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  emptyStateText: {
    color: colors.textSecondary,
    fontSize: fontSize.headline,
    textAlign: "center",
    marginBottom: 8,
  },
  emptyStateSubtext: {
    color: colors.textTertiary,
    fontSize: fontSize.subheadline,
    textAlign: "center",
  },
  historyContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceElevated,
  },
  historyTitle: {
    color: colors.text,
    fontSize: fontSize.callout,
    fontWeight: "600",
  },
  clearHistoryText: {
    color: colors.primary,
    fontSize: fontSize.subheadline,
  },
  historyList: {
    flex: 1,
  },
  historyItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceElevated,
  },
  historyText: {
    color: colors.textSecondary,
    fontSize: fontSize.callout,
  },
  filterButtonActive: {
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  filterButtonTextActive: {
    color: colors.primary,
  },
  nativeSearchContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  nativeSearchView: {
    flex: 1,
  },
  });
}
