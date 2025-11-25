import type { AppBskyFeedDefs } from "@atproto/api";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { atProtoClient } from "../services/atproto";
import {
  getSearchHistoryDB,
  type SearchHistoryEntry,
} from "../services/search-history-db";
import { useDebounce } from "./useDebounce";

const MAX_HISTORY_ITEMS = 15;
const DEBOUNCE_MS = 300;

export interface SearchFilters {
  hasMedia: boolean;
  fromUsers: string[];
  sinceDate: string;
  untilDate: string;
  language: string;
}

export const defaultFilters: SearchFilters = {
  hasMedia: false,
  fromUsers: [],
  sinceDate: "",
  untilDate: "",
  language: "",
};

interface SearchPage {
  posts: AppBskyFeedDefs.PostView[];
  cursor?: string;
}

interface UseSearchOptions {
  enabled?: boolean;
  sortOrder?: "top" | "latest";
}

interface UseSearchReturn {
  query: string;
  setQuery: (query: string) => void;
  debouncedQuery: string;
  allPosts: AppBskyFeedDefs.PostView[];
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  fetchNextPage: () => void;
  error: Error | null;
  searchHistory: SearchHistoryEntry[];
  addToHistory: (query: string) => void;
  removeFromHistory: (id: string) => Promise<void>;
  clearHistory: () => Promise<void>;
  executeSearch: (query?: string) => void;
  activeQuery: string;
  sortOrder: "top" | "latest";
  setSortOrder: (order: "top" | "latest") => void;
  filters: SearchFilters;
  setFilters: React.Dispatch<React.SetStateAction<SearchFilters>>;
  fullSearchQuery: string;
}

// Build search query with filters
const buildSearchQuery = (query: string, filters: SearchFilters): string => {
  const parts: string[] = [];

  if (query.trim()) {
    parts.push(query.trim());
  }

  filters.fromUsers.forEach((user) => {
    if (user.trim()) {
      parts.push(`from:${user.trim().replace(/^@/, "")}`);
    }
  });

  if (filters.language) {
    parts.push(`lang:${filters.language}`);
  }

  if (filters.sinceDate) {
    parts.push(`since:${filters.sinceDate}`);
  }

  if (filters.untilDate) {
    parts.push(`until:${filters.untilDate}`);
  }

  return parts.join(" ");
};

// Check if a post has media
const postHasMedia = (post: AppBskyFeedDefs.PostView): boolean => {
  if (!post.embed) return false;

  const embed = post.embed as Record<string, unknown>;

  if (embed.$type === "app.bsky.embed.images#view") {
    return true;
  }

  if (
    embed.$type === "app.bsky.embed.recordWithMedia#view" &&
    (embed.media as Record<string, unknown>)?.$type ===
      "app.bsky.embed.images#view"
  ) {
    return true;
  }

  if (embed.$type === "app.bsky.embed.video#view") {
    return true;
  }

  return false;
};

export function useSearch(options: UseSearchOptions = {}): UseSearchReturn {
  const { enabled = true, sortOrder: initialSortOrder = "latest" } = options;

  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"top" | "latest">(
    initialSortOrder,
  );
  const [filters, setFilters] = useState<SearchFilters>(defaultFilters);

  const debouncedQuery = useDebounce(query, DEBOUNCE_MS);

  // Build full search query with filters
  const fullSearchQuery = useMemo(
    () => buildSearchQuery(activeQuery, filters),
    [activeQuery, filters],
  );

  // Fetch search history from IndexedDB
  const { data: searchHistory = [], refetch: refetchHistory } = useQuery({
    queryKey: ["searchHistory"],
    queryFn: async () => {
      try {
        const db = await getSearchHistoryDB();
        return db.getSearchHistory(MAX_HISTORY_ITEMS);
      } catch {
        return [];
      }
    },
    staleTime: 30000,
  });

  // Add query to search history
  const addToHistory = useCallback(
    async (searchQuery: string) => {
      if (!searchQuery.trim()) return;

      try {
        const db = await getSearchHistoryDB();
        await db.addSearchEntry(searchQuery.trim(), {
          hasMedia: filters.hasMedia,
          fromUsers: filters.fromUsers,
          sinceDate: filters.sinceDate,
          untilDate: filters.untilDate,
          language: filters.language,
          sort: sortOrder,
        });
        refetchHistory();
      } catch {
        // Silently fail
      }
    },
    [filters, sortOrder, refetchHistory],
  );

  // Remove entry from search history
  const removeFromHistory = useCallback(
    async (id: string) => {
      try {
        const db = await getSearchHistoryDB();
        await db.deleteEntry(id);
        refetchHistory();
      } catch {
        // Silently fail
      }
    },
    [refetchHistory],
  );

  // Clear all search history
  const clearHistory = useCallback(async () => {
    try {
      const db = await getSearchHistoryDB();
      await db.clearHistory();
      refetchHistory();
    } catch {
      // Silently fail
    }
  }, [refetchHistory]);

  // Execute search (manually triggered)
  const executeSearch = useCallback(
    (searchQuery?: string) => {
      const queryToExecute = searchQuery ?? query;
      if (queryToExecute.trim()) {
        setActiveQuery(queryToExecute.trim());
        addToHistory(queryToExecute.trim());
      }
    },
    [query, addToHistory],
  );

  // Infinite query for search results
  const {
    data: searchData,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
  } = useInfiniteQuery({
    queryKey: ["searchPosts", fullSearchQuery, sortOrder],
    queryFn: async ({ pageParam }): Promise<SearchPage> => {
      if (!fullSearchQuery.trim()) {
        return { posts: [], cursor: undefined };
      }

      const response = await atProtoClient.agent.app.bsky.feed.searchPosts({
        q: fullSearchQuery,
        limit: 25,
        cursor: pageParam,
        sort: sortOrder,
      });

      return {
        posts: response.data.posts,
        cursor: response.data.cursor,
      };
    },
    getNextPageParam: (lastPage) => lastPage.cursor,
    initialPageParam: undefined as string | undefined,
    enabled: enabled && !!fullSearchQuery.trim(),
    staleTime: 30000,
    gcTime: 5 * 60 * 1000,
  });

  // Flatten and filter posts
  const allPosts = useMemo(() => {
    if (!searchData?.pages) return [];

    let posts = searchData.pages.flatMap((page) => page.posts);

    // Apply client-side media filter
    if (filters.hasMedia) {
      posts = posts.filter(postHasMedia);
    }

    return posts;
  }, [searchData, filters.hasMedia]);

  // Filtered history based on current input
  const filteredHistory = useMemo(() => {
    if (!debouncedQuery.trim()) {
      return searchHistory;
    }

    const queryLower = debouncedQuery.toLowerCase();
    return searchHistory.filter((entry) =>
      entry.query.toLowerCase().includes(queryLower),
    );
  }, [debouncedQuery, searchHistory]);

  return {
    query,
    setQuery,
    debouncedQuery,
    allPosts,
    isLoading,
    isFetchingNextPage,
    hasNextPage: hasNextPage ?? false,
    fetchNextPage,
    error: error as Error | null,
    searchHistory: filteredHistory,
    addToHistory,
    removeFromHistory,
    clearHistory,
    executeSearch,
    activeQuery,
    sortOrder,
    setSortOrder,
    filters,
    setFilters,
    fullSearchQuery,
  };
}
