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
import { setSearchResults, setTrendingData, setSearchHistory } from '../index';

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

const NativeSearchView = forwardRef<NativeSearchHandle, ViewProps>(
  (props, ref) => {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [activeTab, setActiveTab] = useState<TabType>('posts');
    const [isManualRefreshing, setIsManualRefreshing] = useState(false);
    const [searchHistory, setSearchHistoryState] = useState<string[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Data hooks
    const { topics, trends, isLoading: isLoadingTrending } = useTrendingData();

    const {
      data: actors,
      isLoading: isLoadingActors,
      refetch: refetchActors,
    } = useSearchActors(activeTab === 'people' ? debouncedQuery : '');

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
      { sort: 'top' },
    );

    const isLoading =
      activeTab === 'people' ? isLoadingActors : isLoadingPosts;

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

    // Push search results to native
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
        const allPosts = postsData.pages.flatMap((page: any) => page.feed || []);
        const payload = JSON.stringify({
          tab: 'posts',
          posts: allPosts.map((item: any) => ({
            post: {
              uri: item.post?.uri || '',
              author: {
                handle: item.post?.author?.handle || '',
                displayName: item.post?.author?.displayName,
                avatar: item.post?.author?.avatar,
              },
              record: {
                text: (item.post?.record as any)?.text || '',
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
    }, [postsData, activeTab, hasNextPage]);

    // Push search history to native
    useEffect(() => {
      try {
        setSearchHistory(JSON.stringify({ history: searchHistory }));
      } catch {
        // Module not loaded
      }
    }, [searchHistory]);

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

    useImperativeHandle(ref, () => ({
      scrollToTop: () => {
        // SwiftUI handles scroll-to-top natively
      },
    }));

    return (
      <NativeSearchViewRaw
        {...props}
        query={searchQuery}
        activeTab={activeTab}
        isLoading={isLoading && !!debouncedQuery}
        isRefreshing={isManualRefreshing}
        isLoadingMore={isFetchingNextPage}
        isLoadingTrending={isLoadingTrending}
        showHistory={showHistory}
        onQueryChange={handleQueryChange}
        onTabChange={handleTabChange}
        onRefresh={handleRefresh}
        onLoadMore={handleLoadMore}
        onProfilePress={handleProfilePress}
        onPostPress={handlePostPress}
        onTrendingTopicPress={handleTrendingTopicPress}
        onHistoryItemPress={handleHistoryItemPress}
        onClearHistory={handleClearHistory}
        style={{ flex: 1 }}
      />
    );
  },
);

NativeSearchView.displayName = 'NativeSearchView';

export default NativeSearchView;
