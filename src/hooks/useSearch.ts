import type { AppBskyFeedDefs } from "@atproto/api";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  getSearchHistoryDB,
  type SearchHistoryEntry,
} from "../services/search-history-db";
import { useDebounce } from "./useDebounce";

const MAX_HISTORY_ITEMS = 15;
const DEBOUNCE_MS = 300;

export type MediaType = "all" | "images" | "videos" | "links" | "text-only";

export type DatePreset = "today" | "week" | "month" | "year" | "custom" | null;

export interface EngagementThresholds {
  minLikes: number;
  minReposts: number;
  minReplies: number;
}

export interface SearchFilters {
  hasMedia: boolean;
  mediaType: MediaType;
  fromUsers: string[];
  sinceDate: string;
  untilDate: string;
  datePreset: DatePreset;
  language: string;
  engagement: EngagementThresholds;
}

export const defaultFilters: SearchFilters = {
  hasMedia: false,
  mediaType: "all",
  fromUsers: [],
  sinceDate: "",
  untilDate: "",
  datePreset: null,
  language: "",
  engagement: {
    minLikes: 0,
    minReposts: 0,
    minReplies: 0,
  },
};

// Storage key for persisted filter preferences
const FILTER_STORAGE_KEY = "bsky-search-filters";

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

// Check if a post has any media
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

// Check if a post has images specifically
const postHasImages = (post: AppBskyFeedDefs.PostView): boolean => {
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

  return false;
};

// Check if a post has videos specifically
const postHasVideo = (post: AppBskyFeedDefs.PostView): boolean => {
  if (!post.embed) return false;
  const embed = post.embed as Record<string, unknown>;
  return embed.$type === "app.bsky.embed.video#view";
};

// Check if a post has external links
const postHasLinks = (post: AppBskyFeedDefs.PostView): boolean => {
  if (!post.embed) return false;
  const embed = post.embed as Record<string, unknown>;

  if (embed.$type === "app.bsky.embed.external#view") {
    return true;
  }

  if (
    embed.$type === "app.bsky.embed.recordWithMedia#view" &&
    (embed.media as Record<string, unknown>)?.$type ===
      "app.bsky.embed.external#view"
  ) {
    return true;
  }

  return false;
};

// Check if a post is text-only (no embeds)
const postIsTextOnly = (post: AppBskyFeedDefs.PostView): boolean => {
  return !post.embed;
};

// Check if post meets engagement thresholds
const postMeetsEngagement = (
  post: AppBskyFeedDefs.PostView,
  thresholds: EngagementThresholds,
): boolean => {
  const likes = post.likeCount || 0;
  const reposts = post.repostCount || 0;
  const replies = post.replyCount || 0;

  return (
    likes >= thresholds.minLikes &&
    reposts >= thresholds.minReposts &&
    replies >= thresholds.minReplies
  );
};

// Load persisted filters from localStorage
const loadPersistedFilters = (): Partial<SearchFilters> | null => {
  try {
    const stored = localStorage.getItem(FILTER_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Silently fail
  }
  return null;
};

// Save filters to localStorage
const persistFilters = (filters: SearchFilters): void => {
  try {
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters));
  } catch {
    // Silently fail
  }
};

export function useSearch(options: UseSearchOptions = {}): UseSearchReturn {
  const { agent } = useAuth();
  const { enabled = true, sortOrder: initialSortOrder = "latest" } = options;

  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"top" | "latest">(
    initialSortOrder,
  );

  // Initialize filters with persisted values if available
  const [filters, setFilters] = useState<SearchFilters>(() => {
    const persisted = loadPersistedFilters();
    if (persisted) {
      return {
        ...defaultFilters,
        ...persisted,
        // Ensure engagement object is properly merged
        engagement: {
          ...defaultFilters.engagement,
          ...(persisted.engagement || {}),
        },
      };
    }
    return defaultFilters;
  });

  // Persist filters when they change
  useEffect(() => {
    persistFilters(filters);
  }, [filters]);

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
    queryFn: async ({ pageParam, signal }): Promise<SearchPage> => {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

      if (!fullSearchQuery.trim()) {
        return { posts: [], cursor: undefined };
      }

      const response = await agent!.app.bsky.feed.searchPosts({
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
    maxPages: 10,
    enabled: enabled && !!fullSearchQuery.trim(),
    staleTime: 30000,
    gcTime: 5 * 60 * 1000,
  });

  // Flatten and filter posts
  const allPosts = useMemo(() => {
    if (!searchData?.pages) return [];

    let posts = searchData.pages.flatMap((page) => page.posts);

    // Apply client-side media type filter
    if (filters.mediaType !== "all") {
      switch (filters.mediaType) {
        case "images":
          posts = posts.filter(postHasImages);
          break;
        case "videos":
          posts = posts.filter(postHasVideo);
          break;
        case "links":
          posts = posts.filter(postHasLinks);
          break;
        case "text-only":
          posts = posts.filter(postIsTextOnly);
          break;
      }
    } else if (filters.hasMedia) {
      // Legacy hasMedia filter for backwards compatibility
      posts = posts.filter(postHasMedia);
    }

    // Apply engagement threshold filters
    const hasEngagementFilters =
      filters.engagement.minLikes > 0 ||
      filters.engagement.minReposts > 0 ||
      filters.engagement.minReplies > 0;

    if (hasEngagementFilters) {
      posts = posts.filter((post) =>
        postMeetsEngagement(post, filters.engagement),
      );
    }

    return posts;
  }, [searchData, filters.hasMedia, filters.mediaType, filters.engagement]);

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
