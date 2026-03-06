/**
 * Native Search View Component
 *
 * React Native wrapper for the native SwiftUI SearchView.
 * Handles data fetching, serialization, and event bridging.
 */

import React, {
  useEffect,
  useCallback,
  useState,
  useRef,
  useMemo,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { requireNativeViewManager } from 'expo-modules-core';
import { ViewProps, Platform, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSearchActors } from '../../../src/hooks/api/useProfile';
import { useSearchPosts } from '../../../src/hooks/api/useSearchPosts';
import { useTrendingData } from '../../../src/hooks/useTrending';
import { useRouter } from 'expo-router';
import { setSearchResults, setTrendingData, setSearchHistory, setTypeaheadResults } from './NativeSearchModule';
import { SearchFilterSheet, type SearchFilterValues } from '../../../src/components/SearchFilterSheet';

const SEARCH_HISTORY_KEY = '@search_history';
const MAX_HISTORY_ITEMS = 20;

type TabType = 'people' | 'posts' | 'hashtags';

// Lazy-load native view (only available on iOS)
let NativeSearchViewNative: any = null;
if (Platform.OS === 'ios') {
  NativeSearchViewNative = requireNativeViewManager('NativeSearch');
}

// MARK: - Event Types

export interface NativeSearchViewEvents {
  onQueryChange?: (event: { nativeEvent: { query: string } }) => void;
  onTabChange?: (event: { nativeEvent: { tab: string } }) => void;
  onRefresh?: () => void;
  onLoadMore?: () => void;
  onProfilePress?: (event: { nativeEvent: { handle: string } }) => void;
  onPostPress?: (event: {
    nativeEvent: { authorHandle: string; postId: string };
  }) => void;
  onTrendingTopicPress?: (event: { nativeEvent: { topic: string } }) => void;
  onHistoryItemPress?: (event: { nativeEvent: { query: string } }) => void;
  onClearHistory?: () => void;
  onFilterPress?: () => void;
}

// MARK: - Props Types

export interface NativeSearchViewProps
  extends ViewProps,
    NativeSearchViewEvents {
  query?: string;
  activeTab?: string;
  isLoading?: boolean;
  isRefreshing?: boolean;
  isLoadingMore?: boolean;
  isLoadingTrending?: boolean;
  error?: string | null;
  showHistory?: boolean;
  activeFilterCount?: number;
  scrollToTopTrigger?: number;
}

// MARK: - Low-level Native View

const NativeSearchViewRaw = forwardRef<any, NativeSearchViewProps>(
  (props, _ref) => {
    if (Platform.OS !== 'ios' || !NativeSearchViewNative) {
      return <View {...props} />;
    }
    return <NativeSearchViewNative {...props} />;
  },
);

NativeSearchViewRaw.displayName = 'NativeSearchViewRaw';

// MARK: - High-level Component with Data Bridge

export interface NativeSearchHandle {
  scrollToTop: () => void;
}

interface NativeSearchOuterProps extends ViewProps {
  scrollToTopTrigger?: number;
}

const NativeSearchView = forwardRef<NativeSearchHandle, NativeSearchOuterProps>(
  (props, ref) => {
    const { scrollToTopTrigger = 0, ...viewProps } = props;
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [activeTab, setActiveTab] = useState<TabType>('posts');
    const [isManualRefreshing, setIsManualRefreshing] = useState(false);
    const [searchHistory, setSearchHistoryState] = useState<string[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState<SearchFilterValues>({
      sort: 'top',
      mediaFilter: 'all',
    });
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const typeaheadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [typeaheadQuery, setTypeaheadQuery] = useState('');

    // Data hooks
    const { topics, trends, isLoading: isLoadingTrending } = useTrendingData();

    const {
      data: actors,
      isLoading: isLoadingActors,
      refetch: refetchActors,
    } = useSearchActors(activeTab === 'people' ? debouncedQuery : '');

    // Typeahead: search actors with shorter debounce for instant suggestions
    const {
      data: typeaheadActors,
      isLoading: isLoadingTypeahead,
    } = useSearchActors(typeaheadQuery);

    // Build API filters (exclude mediaFilter which is applied client-side)
    const apiFilters = useMemo(() => {
      const { mediaFilter: _media, ...rest } = filters;
      return rest;
    }, [filters]);

    const {
      data: postsData,
      isLoading: isLoadingPosts,
      fetchNextPage,
      hasNextPage,
      isFetchingNextPage,
      refetch: refetchPosts,
    } = useSearchPosts(
      activeTab === 'posts' || activeTab === 'hashtags'
        ? activeTab === 'hashtags' && debouncedQuery && !debouncedQuery.startsWith('#')
          ? `#${debouncedQuery}`
          : debouncedQuery
        : '',
      apiFilters,
    );

    const isLoading =
      activeTab === 'people' ? isLoadingActors : isLoadingPosts;

    // Calculate active filter count
    const activeFilterCount = useMemo(() => {
      let count = 0;
      if (filters.sort !== 'top') count++;
      if (filters.mediaFilter && filters.mediaFilter !== 'all') count++;
      if (filters.since) count++;
      if (filters.lang) count++;
      if (filters.author) count++;
      if (filters.domain) count++;
      return count;
    }, [filters]);

    // Load search history on mount
    useEffect(() => {
      loadSearchHistory();
    }, []);

    // Debounce search query
    useEffect(() => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      debounceTimer.current = setTimeout(() => {
        setDebouncedQuery(searchQuery);
        if (searchQuery && searchQuery.length > 0) {
          setShowHistory(false);
        }
      }, 300);
      return () => {
        if (debounceTimer.current) {
          clearTimeout(debounceTimer.current);
        }
      };
    }, [searchQuery]);

    // Typeahead debounce (faster, 150ms) for person suggestions
    useEffect(() => {
      if (typeaheadTimer.current) {
        clearTimeout(typeaheadTimer.current);
      }
      if (!searchQuery || searchQuery.trim().length < 2) {
        setTypeaheadQuery('');
        return;
      }
      typeaheadTimer.current = setTimeout(() => {
        setTypeaheadQuery(searchQuery.trim());
      }, 150);
      return () => {
        if (typeaheadTimer.current) {
          clearTimeout(typeaheadTimer.current);
        }
      };
    }, [searchQuery]);

    // Save to history when query settles
    useEffect(() => {
      if (debouncedQuery && debouncedQuery.trim().length > 1) {
        saveToHistory(debouncedQuery);
      }
    }, [debouncedQuery]);

    // Push trending data to native
    useEffect(() => {
      const trendingPayload = JSON.stringify({
        topics: (topics || []).map((t: any) => ({
          tag: t.tag || t.topic || '',
          displayName: t.displayName || t.tag || '',
        })),
        trends: (trends || []).map((t: any) => ({
          topic: t.topic || '',
          displayName: t.displayName || t.topic || '',
          postCount: t.postCount || 0,
        })),
        isLoading: isLoadingTrending,
      });
      try {
        setTrendingData(trendingPayload);
      } catch {
        // Module not loaded
      }
    }, [topics, trends, isLoadingTrending]);

    // Push search results to native (with client-side media filtering)
    useEffect(() => {
      if (activeTab === 'people' && actors) {
        const payload = JSON.stringify({
          tab: 'people',
          actors: actors.map((a: any) => ({
            did: a.did,
            handle: a.handle,
            displayName: a.displayName,
            avatar: a.avatar,
            description: a.description,
            isVerified: a.verification?.verifiedStatus === 'valid' || undefined,
          })),
          hasMore: false,
        });
        try {
          setSearchResults(payload);
        } catch {
          // Module not loaded
        }
      }
    }, [actors, activeTab]);

    useEffect(() => {
      if (
        (activeTab === 'posts' || activeTab === 'hashtags') &&
        postsData?.pages
      ) {
        let allPosts = postsData.pages.flatMap((page: any) => page.feed || []);

        // Apply client-side media filtering
        if (filters.mediaFilter && filters.mediaFilter !== 'all') {
          allPosts = allPosts.filter((item: any) => {
            const embed = item.post?.embed;
            if (!embed) return filters.mediaFilter === 'links';
            const media = embed?.media;
            switch (filters.mediaFilter) {
              case 'images':
                return embed.$type === 'app.bsky.embed.images#view' ||
                  (embed.$type === 'app.bsky.embed.recordWithMedia#view' &&
                    media?.$type === 'app.bsky.embed.images#view');
              case 'videos':
                return embed.$type === 'app.bsky.embed.video#view' ||
                  (embed.$type === 'app.bsky.embed.recordWithMedia#view' &&
                    media?.$type === 'app.bsky.embed.video#view');
              case 'links':
                return embed.$type === 'app.bsky.embed.external#view' ||
                  (embed.$type === 'app.bsky.embed.recordWithMedia#view' &&
                    media?.$type === 'app.bsky.embed.external#view');
              default:
                return true;
            }
          });
        }

        const payload = JSON.stringify({
          tab: 'posts',
          posts: allPosts.map((item: any) => ({
            post: {
              uri: item.post?.uri || '',
              author: {
                handle: item.post?.author?.handle || '',
                displayName: item.post?.author?.displayName,
                avatar: item.post?.author?.avatar,
                isVerified: item.post?.author?.verification?.verifiedStatus === 'valid' || undefined,
              },
              record: {
                text: (item.post?.record as { text?: string })?.text || '',
              },
              indexedAt: item.post?.indexedAt || '',
              likeCount: item.post?.likeCount || 0,
              repostCount: item.post?.repostCount || 0,
              replyCount: item.post?.replyCount || 0,
            },
          })),
          hasMore: hasNextPage || false,
          append: false,
        });
        try {
          setSearchResults(payload);
        } catch {
          // Module not loaded
        }
      }
    }, [postsData, activeTab, hasNextPage, filters.mediaFilter]);

    // Push search history to native
    useEffect(() => {
      try {
        setSearchHistory(JSON.stringify({ history: searchHistory }));
      } catch {
        // Module not loaded
      }
    }, [searchHistory]);

    // Push typeahead results to native
    useEffect(() => {
      const payload = JSON.stringify({
        actors: (typeaheadActors || []).slice(0, 5).map((a: any) => ({
          did: a.did,
          handle: a.handle,
          displayName: a.displayName,
          avatar: a.avatar,
          description: a.description,
          isVerified: a.verification?.verifiedStatus === 'valid' || undefined,
        })),
        isLoading: isLoadingTypeahead,
      });
      try {
        setTypeaheadResults(payload);
      } catch {
        // Module not loaded
      }
    }, [typeaheadActors, isLoadingTypeahead]);

    // History management
    const loadSearchHistory = async () => {
      try {
        const history = await AsyncStorage.getItem(SEARCH_HISTORY_KEY);
        if (history) {
          setSearchHistoryState(JSON.parse(history));
        }
      } catch {
        // Silently fail
      }
    };

    const saveToHistory = async (query: string) => {
      try {
        const trimmedQuery = query.trim();
        if (!trimmedQuery) return;

        const history = await AsyncStorage.getItem(SEARCH_HISTORY_KEY);
        let historyArray: string[] = history ? JSON.parse(history) : [];
        historyArray = historyArray.filter((item) => item !== trimmedQuery);
        historyArray.unshift(trimmedQuery);
        historyArray = historyArray.slice(0, MAX_HISTORY_ITEMS);

        await AsyncStorage.setItem(
          SEARCH_HISTORY_KEY,
          JSON.stringify(historyArray),
        );
        setSearchHistoryState(historyArray);
      } catch {
        // Silently fail
      }
    };

    const clearHistory = async () => {
      try {
        await AsyncStorage.removeItem(SEARCH_HISTORY_KEY);
        setSearchHistoryState([]);
      } catch {
        // Silently fail
      }
    };

    // Event handlers
    const handleQueryChange = useCallback(
      (event: { nativeEvent: { query: string } }) => {
        const query = event.nativeEvent.query;
        setSearchQuery(query);
        if (!query && searchHistory.length > 0) {
          setShowHistory(true);
        }
      },
      [searchHistory],
    );

    const handleTabChange = useCallback(
      (event: { nativeEvent: { tab: string } }) => {
        setActiveTab(event.nativeEvent.tab as TabType);
      },
      [],
    );

    const handleRefresh = useCallback(() => {
      setIsManualRefreshing(true);
      const refetch = activeTab === 'people' ? refetchActors : refetchPosts;
      refetch().finally(() => setIsManualRefreshing(false));
    }, [activeTab, refetchActors, refetchPosts]);

    const handleLoadMore = useCallback(() => {
      if (
        (activeTab === 'posts' || activeTab === 'hashtags') &&
        hasNextPage &&
        !isFetchingNextPage
      ) {
        fetchNextPage();
      }
    }, [activeTab, hasNextPage, isFetchingNextPage, fetchNextPage]);

    const handleProfilePress = useCallback(
      (event: { nativeEvent: { handle: string } }) => {
        router.push(
          `/(app)/(tabs)/(search)/profile/${event.nativeEvent.handle}`,
        );
      },
      [router],
    );

    const handlePostPress = useCallback(
      (event: { nativeEvent: { authorHandle: string; postId: string } }) => {
        const { authorHandle, postId } = event.nativeEvent;
        router.push(
          `/(app)/(tabs)/(search)/profile/${authorHandle}/post/${postId}`,
        );
      },
      [router],
    );

    const handleTrendingTopicPress = useCallback(
      (event: { nativeEvent: { topic: string } }) => {
        const topic = event.nativeEvent.topic;
        setSearchQuery(topic);
        setActiveTab('hashtags');
        setShowHistory(false);
      },
      [],
    );

    const handleHistoryItemPress = useCallback(
      (event: { nativeEvent: { query: string } }) => {
        setSearchQuery(event.nativeEvent.query);
        setShowHistory(false);
      },
      [],
    );

    const handleClearHistory = useCallback(() => {
      clearHistory();
    }, []);

    const handleFilterPress = useCallback(() => {
      setShowFilters(true);
    }, []);

    const handleApplyFilters = useCallback((newFilters: SearchFilterValues) => {
      setFilters(newFilters);
    }, []);

    useImperativeHandle(ref, () => ({
      scrollToTop: () => {
        // Scroll-to-top is triggered via the scrollToTopTrigger prop
      },
    }));

    return (
      <View style={{ flex: 1 }}>
        <NativeSearchViewRaw
          {...viewProps}
          query={searchQuery}
          activeTab={activeTab}
          isLoading={isLoading && !!debouncedQuery}
          isRefreshing={isManualRefreshing}
          isLoadingMore={isFetchingNextPage}
          isLoadingTrending={isLoadingTrending}
          showHistory={showHistory}
          activeFilterCount={activeFilterCount}
          scrollToTopTrigger={scrollToTopTrigger}
          onQueryChange={handleQueryChange}
          onTabChange={handleTabChange}
          onRefresh={handleRefresh}
          onLoadMore={handleLoadMore}
          onProfilePress={handleProfilePress}
          onPostPress={handlePostPress}
          onTrendingTopicPress={handleTrendingTopicPress}
          onHistoryItemPress={handleHistoryItemPress}
          onClearHistory={handleClearHistory}
          onFilterPress={handleFilterPress}
          style={{ flex: 1 }}
        />
        <SearchFilterSheet
          visible={showFilters}
          onClose={() => setShowFilters(false)}
          filters={filters}
          onApplyFilters={handleApplyFilters}
        />
      </View>
    );
  },
);

NativeSearchView.displayName = 'NativeSearchView';

export default NativeSearchView;
