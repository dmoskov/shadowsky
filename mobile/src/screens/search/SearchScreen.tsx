import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { useScrollToTop } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSearchActors } from "../../hooks/api/useProfile";
import { useSearchPosts } from "../../hooks/api/useSearchPosts";
import { Avatar } from "../../components/Avatar";
import { FeedList } from "../../components/FeedList";
import { AppBskyActorDefs, AppBskyFeedDefs } from "@atproto/api";
import { useBookmarks } from "../../hooks/api/useBookmarks";

const SEARCH_HISTORY_KEY = "@search_history";
const MAX_HISTORY_ITEMS = 20;

type TabType = "people" | "posts";

interface SearchScreenProps {
  query?: string;
}

interface SearchFilters {
  sort: "top" | "latest";
  since?: string;
  until?: string;
  lang?: string;
}

export function SearchScreen({ query: initialQuery }: SearchScreenProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("posts");
  const [searchQuery, setSearchQuery] = useState(initialQuery || "");
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery || "");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({
    sort: "top",
  });
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const scrollRef = useRef<FlatList>(null);

  const { bookmarks, toggleBookmark, isBookmarked: checkIsBookmarked } = useBookmarks();

  // Enable scroll-to-top on tab press
  useScrollToTop(scrollRef);

  // Load search history on mount
  useEffect(() => {
    loadSearchHistory();
  }, []);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      if (searchQuery && searchQuery.length > 0) {
        saveToHistory(searchQuery);
        setShowHistory(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadSearchHistory = async () => {
    try {
      const history = await AsyncStorage.getItem(SEARCH_HISTORY_KEY);
      if (history) {
        setSearchHistory(JSON.parse(history));
      }
    } catch (error) {
      console.error("Failed to load search history:", error);
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
      console.error("Failed to save search history:", error);
    }
  };

  const clearHistory = async () => {
    try {
      await AsyncStorage.removeItem(SEARCH_HISTORY_KEY);
      setSearchHistory([]);
    } catch (error) {
      console.error("Failed to clear search history:", error);
    }
  };

  // Fetch search results based on active tab
  const {
    data: actors,
    isLoading: isLoadingActors,
    isError: isErrorActors,
    refetch: refetchActors,
  } = useSearchActors(activeTab === "people" ? debouncedQuery : "");

  const {
    data: postsData,
    isLoading: isLoadingPosts,
    isError: isErrorPosts,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch: refetchPosts,
  } = useSearchPosts(activeTab === "posts" ? debouncedQuery : "", filters);

  const posts = useMemo(() => {
    return postsData?.pages.flatMap((page) => page.feed) || [];
  }, [postsData]);

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
    if (activeTab === "posts" && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  const handleProfilePress = (handle: string) => {
    router.push(`/(app)/(tabs)/(search)/profile/${handle}`);
  };

  const handlePostPress = (post: AppBskyFeedDefs.FeedViewPost) => {
    const postAuthor = post.post.author.handle;
    const postId = post.post.uri.split("/").pop();
    router.push(`/(app)/(tabs)/(search)/profile/${postAuthor}/post/${postId}`);
  };

  const handleHistoryItemPress = (query: string) => {
    setSearchQuery(query);
    setShowHistory(false);
  };

  const isBookmarked = (postUri: string) => {
    return checkIsBookmarked(postUri);
  };

  const handleBookmark = (post: AppBskyFeedDefs.FeedViewPost) => {
    toggleBookmark(post.post);
  };

  const applyFilters = (newFilters: Partial<SearchFilters>) => {
    setFilters({ ...filters, ...newFilters });
    setShowFilters(false);
  };

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
        <TextInput
          style={styles.input}
          placeholder="Search posts, users, feeds..."
          placeholderTextColor="#6b7280"
          value={searchQuery}
          onChangeText={setSearchQuery}
          onFocus={() => setShowHistory(searchHistory.length > 0 && !searchQuery)}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

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
            data={searchHistory}
            keyExtractor={(item, index) => `${item}-${index}`}
            renderItem={renderHistoryItem}
            style={styles.historyList}
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
          </View>

          {/* Filter button for Posts tab */}
          {activeTab === "posts" && debouncedQuery && (
            <View style={styles.filterBar}>
              <TouchableOpacity
                style={styles.filterButton}
                onPress={() => setShowFilters(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.filterButtonText}>
                  Filters ({filters.sort})
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Content */}
          {isLoading && debouncedQuery ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#1d9bf0" />
              <Text style={styles.loadingText}>Searching...</Text>
            </View>
          ) : activeTab === "people" ? (
            <FlatList
              ref={scrollRef}
              data={actors || []}
              keyExtractor={(item) => item.did}
              renderItem={renderSearchResult}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={renderEmptyState}
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshing}
                  onRefresh={handleRefresh}
                  tintColor="#3b82f6"
                  colors={["#3b82f6"]}
                />
              }
            />
          ) : (
            <FeedList
              posts={posts}
              isLoading={false}
              isRefreshing={isRefreshing}
              isLoadingMore={isFetchingNextPage}
              error={isError ? new Error("Failed to load posts") : null}
              onRefresh={handleRefresh}
              onLoadMore={handleLoadMore}
              onPostPress={handlePostPress}
              onProfilePress={handleProfilePress}
              onBookmark={handleBookmark}
              isBookmarked={isBookmarked}
              emptyMessage={renderEmptyState() as any}
            />
          )}
        </>
      )}

      {/* Filters Modal */}
      <Modal
        visible={showFilters}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFilters(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Search Filters</Text>
              <TouchableOpacity onPress={() => setShowFilters(false)}>
                <Text style={styles.modalClose}>Done</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.filterOptions}>
              <Text style={styles.filterLabel}>Sort By</Text>
              <View style={styles.filterGroup}>
                <TouchableOpacity
                  style={[
                    styles.filterOption,
                    filters.sort === "top" && styles.filterOptionActive,
                  ]}
                  onPress={() => applyFilters({ sort: "top" })}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.filterOptionText,
                      filters.sort === "top" && styles.filterOptionTextActive,
                    ]}
                  >
                    Top
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.filterOption,
                    filters.sort === "latest" && styles.filterOptionActive,
                  ]}
                  onPress={() => applyFilters({ sort: "latest" })}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.filterOptionText,
                      filters.sort === "latest" &&
                        styles.filterOptionTextActive,
                    ]}
                  >
                    Latest
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.filterLabel}>Date Range</Text>
              <View style={styles.filterGroup}>
                <TouchableOpacity
                  style={styles.filterOption}
                  onPress={() =>
                    applyFilters({
                      since: new Date(
                        Date.now() - 24 * 60 * 60 * 1000
                      ).toISOString(),
                      until: undefined,
                    })
                  }
                  activeOpacity={0.7}
                >
                  <Text style={styles.filterOptionText}>Last 24 hours</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.filterOption}
                  onPress={() =>
                    applyFilters({
                      since: new Date(
                        Date.now() - 7 * 24 * 60 * 60 * 1000
                      ).toISOString(),
                      until: undefined,
                    })
                  }
                  activeOpacity={0.7}
                >
                  <Text style={styles.filterOptionText}>Last 7 days</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.filterOption}
                  onPress={() =>
                    applyFilters({
                      since: new Date(
                        Date.now() - 30 * 24 * 60 * 60 * 1000
                      ).toISOString(),
                      until: undefined,
                    })
                  }
                  activeOpacity={0.7}
                >
                  <Text style={styles.filterOptionText}>Last 30 days</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.filterOption}
                  onPress={() =>
                    applyFilters({ since: undefined, until: undefined })
                  }
                  activeOpacity={0.7}
                >
                  <Text style={styles.filterOptionText}>All time</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.resetButton}
                onPress={() =>
                  applyFilters({
                    sort: "top",
                    since: undefined,
                    until: undefined,
                    lang: undefined,
                  })
                }
                activeOpacity={0.7}
              >
                <Text style={styles.resetButtonText}>Reset All Filters</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0f",
  },
  searchBar: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
  },
  input: {
    backgroundColor: "#1f2937",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: "#ffffff",
    fontSize: 16,
  },
  tabContainer: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  activeTab: {
    borderBottomColor: "#1d9bf0",
  },
  tabText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6b7280",
  },
  activeTabText: {
    color: "#1d9bf0",
  },
  filterBar: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
  },
  filterButton: {
    backgroundColor: "#1f2937",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  filterButtonText: {
    color: "#9ca3af",
    fontSize: 14,
    fontWeight: "500",
  },
  listContent: {
    flexGrow: 1,
  },
  resultItem: {
    flexDirection: "row",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
    alignItems: "flex-start",
  },
  resultInfo: {
    flex: 1,
    marginLeft: 12,
  },
  displayName: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
  },
  handle: {
    color: "#9ca3af",
    fontSize: 14,
    marginBottom: 4,
  },
  description: {
    color: "#6b7280",
    fontSize: 14,
    marginTop: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#9ca3af",
    fontSize: 16,
    marginTop: 12,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  emptyStateText: {
    color: "#9ca3af",
    fontSize: 18,
    textAlign: "center",
    marginBottom: 8,
  },
  emptyStateSubtext: {
    color: "#6b7280",
    fontSize: 14,
    textAlign: "center",
  },
  historyContainer: {
    flex: 1,
    backgroundColor: "#0a0a0f",
  },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
  },
  historyTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  clearHistoryText: {
    color: "#1d9bf0",
    fontSize: 14,
  },
  historyList: {
    flex: 1,
  },
  historyItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
  },
  historyText: {
    color: "#9ca3af",
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#0a0a0f",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
  },
  modalTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "600",
  },
  modalClose: {
    color: "#1d9bf0",
    fontSize: 16,
    fontWeight: "600",
  },
  filterOptions: {
    padding: 16,
  },
  filterLabel: {
    color: "#9ca3af",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 16,
    marginBottom: 8,
  },
  filterGroup: {
    gap: 8,
  },
  filterOption: {
    backgroundColor: "#1f2937",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "transparent",
  },
  filterOptionActive: {
    borderColor: "#1d9bf0",
    backgroundColor: "#1d4e6f",
  },
  filterOptionText: {
    color: "#9ca3af",
    fontSize: 16,
  },
  filterOptionTextActive: {
    color: "#1d9bf0",
    fontWeight: "600",
  },
  resetButton: {
    backgroundColor: "#1f2937",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 24,
    alignItems: "center",
  },
  resetButtonText: {
    color: "#ef4444",
    fontSize: 16,
    fontWeight: "600",
  },
});
