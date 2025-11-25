import type { AppBskyFeedDefs } from "@atproto/api";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { atProtoClient } from "../services/atproto";
import { useDebounce } from "./useDebounce";

const SEARCH_HISTORY_KEY = "bsky-search-history";
const MAX_HISTORY_ITEMS = 10;
const DEBOUNCE_MS = 300;

interface SearchResult {
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
  results: SearchResult | null;
  isLoading: boolean;
  error: Error | null;
  searchHistory: string[];
  addToHistory: (query: string) => void;
  removeFromHistory: (query: string) => void;
  clearHistory: () => void;
  executeSearch: (query?: string) => void;
  activeQuery: string;
  sortOrder: "top" | "latest";
  setSortOrder: (order: "top" | "latest") => void;
}

// Load search history from localStorage
const loadSearchHistory = (): string[] => {
  try {
    const saved = localStorage.getItem(SEARCH_HISTORY_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

// Save search history to localStorage
const saveSearchHistory = (history: string[]): void => {
  try {
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
  } catch {
    // Silently fail if localStorage is not available
  }
};

export function useSearch(options: UseSearchOptions = {}): UseSearchReturn {
  const { enabled = true, sortOrder: initialSortOrder = "latest" } = options;

  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [searchHistory, setSearchHistory] =
    useState<string[]>(loadSearchHistory);
  const [sortOrder, setSortOrder] = useState<"top" | "latest">(
    initialSortOrder,
  );

  const debouncedQuery = useDebounce(query, DEBOUNCE_MS);

  // Add query to search history
  const addToHistory = useCallback((searchQuery: string) => {
    if (!searchQuery.trim()) return;

    setSearchHistory((prev) => {
      const filtered = prev.filter((q) => q !== searchQuery);
      const updated = [searchQuery, ...filtered].slice(0, MAX_HISTORY_ITEMS);
      saveSearchHistory(updated);
      return updated;
    });
  }, []);

  // Remove query from search history
  const removeFromHistory = useCallback((searchQuery: string) => {
    setSearchHistory((prev) => {
      const updated = prev.filter((q) => q !== searchQuery);
      saveSearchHistory(updated);
      return updated;
    });
  }, []);

  // Clear all search history
  const clearHistory = useCallback(() => {
    setSearchHistory([]);
    try {
      localStorage.removeItem(SEARCH_HISTORY_KEY);
    } catch {
      // Silently fail
    }
  }, []);

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

  // Search posts query using React Query
  const {
    data: results,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["searchPosts", activeQuery, sortOrder],
    queryFn: async (): Promise<SearchResult> => {
      if (!activeQuery.trim()) {
        return { posts: [] };
      }

      const response = await atProtoClient.agent.app.bsky.feed.searchPosts({
        q: activeQuery,
        limit: 50,
        sort: sortOrder,
      });

      return {
        posts: response.data.posts,
        cursor: response.data.cursor,
      };
    },
    enabled: enabled && !!activeQuery.trim(),
    staleTime: 30000,
    gcTime: 5 * 60 * 1000,
  });

  // Suggestions based on search history that match current query
  const suggestions = useMemo(() => {
    if (!debouncedQuery.trim()) {
      return searchHistory.slice(0, 5);
    }

    const queryLower = debouncedQuery.toLowerCase();
    return searchHistory
      .filter((h) => h.toLowerCase().includes(queryLower))
      .slice(0, 5);
  }, [debouncedQuery, searchHistory]);

  return {
    query,
    setQuery,
    debouncedQuery,
    results: results ?? null,
    isLoading,
    error: error as Error | null,
    searchHistory:
      suggestions.length > 0 ? suggestions : searchHistory.slice(0, 5),
    addToHistory,
    removeFromHistory,
    clearHistory,
    executeSearch,
    activeQuery,
    sortOrder,
    setSortOrder,
  };
}
