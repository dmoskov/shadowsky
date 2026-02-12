import type { AppBskyFeedDefs } from "@atproto/api";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowDown,
  ArrowUp,
  Clock,
  Filter,
  Search,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useHiddenPosts } from "../contexts/HiddenPostsContext";
import { useModeration } from "../contexts/ModerationContext";
import { useSearch } from "../hooks/useSearch";
import { useTrendingData } from "../hooks/useTrending";
import type { SearchHistoryEntry } from "../services/search-history-db";
import { ExploreEmptyState } from "./ExploreEmptyState";
import { PostCard } from "./PostCard";
import { SearchFilterPanel } from "./SearchFilterPanel";
import { ThreadModal } from "./ThreadModal";
import { EmptyState } from "./ui/EmptyState";

interface SearchColumnProps {
  isFocused?: boolean;
  onClose?: () => void;
  initialQuery?: string;
}

const SearchColumnComponent: React.FC<SearchColumnProps> = ({
  isFocused = false,
  onClose,
  initialQuery,
}) => {
  const { isPostHidden } = useHiddenPosts();
  const { isUserMuted, isUserBlocked, isThreadMuted } = useModeration();

  // Fetch trending data for autocomplete suggestions
  const { topics: trendingTopics, trends } = useTrendingData({ limit: 5 });

  const {
    query,
    setQuery,
    allPosts,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    searchHistory,
    removeFromHistory,
    clearHistory,
    executeSearch,
    activeQuery,
    sortOrder,
    setSortOrder,
    filters,
    setFilters,
    fullSearchQuery,
  } = useSearch({ enabled: true });

  // UI state
  const [showDropdown, setShowDropdown] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [selectedPostUri, setSelectedPostUri] = useState<string | null>(null);
  const [showThread, setShowThread] = useState(false);
  const [focusedPostIndex, setFocusedPostIndex] = useState(-1);

  // Refs
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Filter results based on moderation
  const filteredResults = useMemo(() => {
    return allPosts.filter(
      (post) =>
        !isPostHidden(post.uri) &&
        !isUserMuted(post.author.did) &&
        !isUserBlocked(post.author.did) &&
        !isThreadMuted(post.uri),
    );
  }, [allPosts, isPostHidden, isUserMuted, isUserBlocked, isThreadMuted]);

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return (
      filters.hasMedia ||
      filters.mediaType !== "all" ||
      filters.fromUsers.length > 0 ||
      filters.sinceDate ||
      filters.untilDate ||
      filters.language ||
      filters.engagement.minLikes > 0 ||
      filters.engagement.minReposts > 0 ||
      filters.engagement.minReplies > 0
    );
  }, [filters]);

  // Intersection observer for infinite scroll
  useEffect(() => {
    if (!loadMoreRef.current || !hasNextPage || isFetchingNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          fetchNextPage();
        }
      },
      { rootMargin: "400px" },
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Handle clicking outside dropdown to close it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !inputRef.current?.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus input when column is focused
  useEffect(() => {
    if (isFocused && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isFocused]);

  // Handle initial query from props (e.g., from trending topic click)
  useEffect(() => {
    if (initialQuery) {
      setQuery(initialQuery);
      executeSearch(initialQuery);
    }
  }, [initialQuery, setQuery, executeSearch]);

  // Handle input change
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setQuery(e.target.value);
      setShowDropdown(true);
      setSelectedSuggestionIndex(-1);
    },
    [setQuery],
  );

  // Handle suggestion selection
  const handleSelectSuggestion = useCallback(
    (entry: SearchHistoryEntry) => {
      setQuery(entry.query);
      // Restore filters from history entry if available
      if (entry.filters) {
        setFilters((prev) => ({
          ...prev,
          hasMedia: entry.filters?.hasMedia || false,
          fromUsers: entry.filters?.fromUsers || [],
          sinceDate: entry.filters?.sinceDate || "",
          untilDate: entry.filters?.untilDate || "",
          language: entry.filters?.language || "",
        }));
      }
      executeSearch(entry.query);
      setShowDropdown(false);
      setSelectedSuggestionIndex(-1);
      setFocusedPostIndex(-1);
    },
    [setQuery, setFilters, executeSearch],
  );

  // Handle form submission
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (
        selectedSuggestionIndex >= 0 &&
        searchHistory[selectedSuggestionIndex]
      ) {
        handleSelectSuggestion(searchHistory[selectedSuggestionIndex]);
      } else if (query.trim()) {
        executeSearch();
        setShowDropdown(false);
        setFocusedPostIndex(-1);
      }
    },
    [
      query,
      selectedSuggestionIndex,
      searchHistory,
      executeSearch,
      handleSelectSuggestion,
    ],
  );

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!showDropdown && e.key !== "ArrowDown") {
        if (e.key === "ArrowDown") {
          setShowDropdown(true);
        }
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          if (showDropdown && searchHistory.length > 0) {
            setSelectedSuggestionIndex((prev) =>
              Math.min(prev + 1, searchHistory.length - 1),
            );
          } else if (!showDropdown) {
            setShowDropdown(true);
          }
          break;

        case "ArrowUp":
          e.preventDefault();
          if (showDropdown) {
            if (selectedSuggestionIndex <= 0) {
              setShowDropdown(false);
              setSelectedSuggestionIndex(-1);
            } else {
              setSelectedSuggestionIndex((prev) => prev - 1);
            }
          }
          break;

        case "Escape":
          setShowDropdown(false);
          setSelectedSuggestionIndex(-1);
          break;

        case "Tab":
          if (showDropdown && selectedSuggestionIndex >= 0) {
            e.preventDefault();
            handleSelectSuggestion(searchHistory[selectedSuggestionIndex]);
          }
          break;
      }
    },
    [
      showDropdown,
      searchHistory,
      selectedSuggestionIndex,
      handleSelectSuggestion,
    ],
  );

  // Handle keyboard navigation for results
  useEffect(() => {
    if (!isFocused || !filteredResults.length) return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Don't interfere when typing in input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedPostIndex((prev) =>
          Math.min(prev + 1, filteredResults.length - 1),
        );
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedPostIndex((prev) => Math.max(prev - 1, -1));
      } else if (e.key === "Enter" && focusedPostIndex >= 0) {
        e.preventDefault();
        const post = filteredResults[focusedPostIndex];
        if (post) {
          setSelectedPostUri(post.uri);
          setShowThread(true);
        }
      } else if (e.key === "/" || e.key === "s") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [isFocused, filteredResults, focusedPostIndex]);

  // Scroll focused post into view
  useEffect(() => {
    if (focusedPostIndex >= 0 && resultsContainerRef.current) {
      const postElements =
        resultsContainerRef.current.querySelectorAll("[data-post-index]");
      const focusedElement = postElements[focusedPostIndex] as HTMLElement;
      if (focusedElement) {
        focusedElement.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      }
    }
  }, [focusedPostIndex]);

  // Handle post click
  const handlePostClick = useCallback((post: AppBskyFeedDefs.PostView) => {
    setSelectedPostUri(post.uri);
    setShowThread(true);
  }, []);

  // Handle clear search
  const handleClearSearch = useCallback(() => {
    setQuery("");
    setShowDropdown(true);
    inputRef.current?.focus();
  }, [setQuery]);

  return (
    <div
      ref={containerRef}
      className="flex h-full flex-col"
      style={{ outline: "none" }}
    >
      {/* Header with Search Input */}
      <div
        className="asph-glass sticky top-0 z-20 border-b"
        style={{ borderColor: "var(--asph-border-primary)" }}
      >
        <div className="flex items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Search size={20} style={{ color: "var(--asph-primary)" }} />
            <h2
              className="text-lg font-semibold"
              style={{ color: "var(--asph-text-primary)" }}
            >
              Search
            </h2>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="rounded-full p-1.5 transition-all hover:bg-gray-200 dark:hover:bg-gray-700"
              style={{ color: "var(--asph-text-secondary)" }}
              aria-label="Close column"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Search Form */}
        <form onSubmit={handleSubmit} className="relative px-4 pb-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 transform"
                style={{ color: "var(--asph-text-tertiary)" }}
              />
              <input
                ref={inputRef}
                type="search"
                placeholder="Search posts..."
                value={query}
                onChange={handleInputChange}
                onFocus={() => setShowDropdown(true)}
                onKeyDown={handleKeyDown}
                className="w-full rounded-lg py-2 pl-10 pr-10 text-sm"
                style={{
                  backgroundColor: "var(--asph-bg-secondary)",
                  border: "1px solid var(--asph-border-primary)",
                  color: "var(--asph-text-primary)",
                }}
                autoComplete="off"
                aria-label="Search posts"
                aria-expanded={showDropdown && searchHistory.length > 0}
                aria-controls="search-history-dropdown"
                aria-autocomplete="list"
                aria-activedescendant={
                  selectedSuggestionIndex >= 0
                    ? `search-history-item-${selectedSuggestionIndex}`
                    : undefined
                }
              />
              {query && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transform rounded-full p-1 hover:bg-gray-200 dark:hover:bg-gray-600"
                  aria-label="Clear search"
                >
                  <X
                    size={14}
                    style={{ color: "var(--asph-text-tertiary)" }}
                    aria-hidden="true"
                  />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={`relative rounded-lg border p-2 transition-all ${showFilters ? "ring-2" : ""}`}
              style={{
                backgroundColor: hasActiveFilters
                  ? "var(--asph-primary)"
                  : "var(--asph-bg-secondary)",
                borderColor: "var(--asph-border-primary)",
                color: hasActiveFilters
                  ? "white"
                  : "var(--asph-text-secondary)",
              }}
              aria-label={`${showFilters ? "Hide" : "Show"} search filters${hasActiveFilters ? " (filters active)" : ""}`}
              aria-expanded={showFilters}
              aria-controls="search-filter-panel"
            >
              <Filter size={18} aria-hidden="true" />
              {hasActiveFilters && (
                <span
                  className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-red-500"
                  aria-hidden="true"
                />
              )}
            </button>
          </div>

          {/* Autocomplete Dropdown */}
          {showDropdown &&
            (searchHistory.length > 0 ||
              trends.length > 0 ||
              trendingTopics.length > 0) && (
              <div
                ref={dropdownRef}
                id="search-history-dropdown"
                role="listbox"
                aria-label="Search suggestions"
                className="asph-scrollbar absolute left-4 right-4 top-full z-30 mt-1 max-h-80 overflow-y-auto rounded-lg border shadow-lg"
                style={{
                  backgroundColor: "var(--asph-bg-primary)",
                  borderColor: "var(--asph-border-primary)",
                }}
              >
                {/* Trending Suggestions */}
                {(trends.length > 0 || trendingTopics.length > 0) && (
                  <>
                    <div
                      className="flex items-center gap-1.5 border-b px-3 py-2"
                      style={{ borderColor: "var(--asph-border-primary)" }}
                    >
                      <TrendingUp
                        size={12}
                        style={{ color: "var(--asph-primary)" }}
                      />
                      <span
                        className="text-xs font-medium"
                        style={{ color: "var(--asph-text-secondary)" }}
                      >
                        Trending
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 px-3 py-2">
                      {trends.length > 0
                        ? trends.slice(0, 5).map((trend, index) => (
                            <button
                              key={`trending-${index}`}
                              type="button"
                              onClick={() => {
                                setQuery(trend.topic);
                                executeSearch(trend.topic);
                                setShowDropdown(false);
                              }}
                              className="rounded-full border px-2.5 py-1 text-xs transition-all hover:border-blue-400"
                              style={{
                                backgroundColor: "var(--asph-bg-secondary)",
                                borderColor: "var(--asph-border-primary)",
                                color: "var(--asph-text-primary)",
                              }}
                            >
                              {trend.displayName || trend.topic}
                            </button>
                          ))
                        : trendingTopics.slice(0, 5).map((topic, index) => (
                            <button
                              key={`trending-topic-${index}`}
                              type="button"
                              onClick={() => {
                                setQuery(topic.topic);
                                executeSearch(topic.topic);
                                setShowDropdown(false);
                              }}
                              className="rounded-full border px-2.5 py-1 text-xs transition-all hover:border-blue-400"
                              style={{
                                backgroundColor: "var(--asph-bg-secondary)",
                                borderColor: "var(--asph-border-primary)",
                                color: "var(--asph-text-primary)",
                              }}
                            >
                              {topic.topic}
                            </button>
                          ))}
                    </div>
                  </>
                )}

                {/* Recent Searches */}
                {searchHistory.length > 0 && (
                  <>
                    <div
                      className="flex items-center justify-between border-b px-3 py-2"
                      style={{ borderColor: "var(--asph-border-primary)" }}
                    >
                      <span
                        className="flex items-center gap-1.5 text-xs font-medium"
                        style={{ color: "var(--asph-text-secondary)" }}
                      >
                        <Clock size={12} />
                        Recent Searches
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          clearHistory();
                        }}
                        className="flex items-center gap-1 text-xs transition-colors hover:text-red-500"
                        style={{ color: "var(--asph-text-tertiary)" }}
                        aria-label="Clear search history"
                      >
                        <Trash2 size={12} aria-hidden="true" />
                        Clear
                      </button>
                    </div>

                    <div className="py-1" role="group">
                      {searchHistory.map((entry, index) => (
                        <button
                          key={entry.id}
                          id={`search-history-item-${index}`}
                          type="button"
                          role="option"
                          aria-selected={selectedSuggestionIndex === index}
                          onClick={() => handleSelectSuggestion(entry)}
                          className={`group flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors ${
                            selectedSuggestionIndex === index
                              ? "bg-blue-50 dark:bg-blue-900/20"
                              : "hover:bg-gray-100 dark:hover:bg-gray-800"
                          }`}
                        >
                          <div className="flex min-w-0 flex-1 items-center gap-2">
                            <Clock
                              size={14}
                              className="shrink-0"
                              style={{ color: "var(--asph-text-tertiary)" }}
                            />
                            <div className="min-w-0 flex-1">
                              <span
                                className="block truncate"
                                style={{ color: "var(--asph-text-primary)" }}
                              >
                                {entry.query}
                              </span>
                              <span
                                className="text-xs"
                                style={{ color: "var(--asph-text-tertiary)" }}
                              >
                                {formatDistanceToNow(new Date(entry.timestamp))}{" "}
                                ago
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFromHistory(entry.id);
                            }}
                            className="shrink-0 rounded p-1 opacity-0 transition-opacity hover:bg-gray-200 group-hover:opacity-100 dark:hover:bg-gray-700"
                            style={{ color: "var(--asph-text-tertiary)" }}
                            aria-label={`Remove "${entry.query}" from search history`}
                          >
                            <X size={12} aria-hidden="true" />
                          </button>
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {/* Keyboard hints */}
                <div
                  className="flex items-center gap-3 border-t px-3 py-2 text-xs"
                  style={{
                    borderColor: "var(--asph-border-primary)",
                    color: "var(--asph-text-tertiary)",
                  }}
                  aria-hidden="true"
                >
                  <span className="flex items-center gap-1">
                    <ArrowUp size={10} />
                    <ArrowDown size={10} />
                    navigate
                  </span>
                  <span>Enter to select</span>
                  <span>Esc to close</span>
                </div>
              </div>
            )}
        </form>

        {/* Advanced Filters Panel */}
        {showFilters && (
          <SearchFilterPanel filters={filters} setFilters={setFilters} />
        )}

        {/* Sort Order Toggle - only show when we have results */}
        {activeQuery && (
          <div
            className="flex items-center justify-between border-t px-4 py-2"
            style={{ borderColor: "var(--asph-border-primary)" }}
          >
            <span
              className="text-xs"
              style={{ color: "var(--asph-text-secondary)" }}
            >
              {filteredResults.length} results
              {fullSearchQuery !== activeQuery && (
                <span
                  className="ml-1"
                  style={{ color: "var(--asph-text-tertiary)" }}
                >
                  ({fullSearchQuery})
                </span>
              )}
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setSortOrder("latest")}
                className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs transition-colors ${
                  sortOrder === "latest"
                    ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                    : "hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
                style={
                  sortOrder !== "latest"
                    ? { color: "var(--asph-text-secondary)" }
                    : {}
                }
                aria-label="Sort by latest"
                aria-pressed={sortOrder === "latest"}
              >
                <Clock size={12} aria-hidden="true" />
                Latest
              </button>
              <button
                onClick={() => setSortOrder("top")}
                className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs transition-colors ${
                  sortOrder === "top"
                    ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                    : "hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
                style={
                  sortOrder !== "top"
                    ? { color: "var(--asph-text-secondary)" }
                    : {}
                }
                aria-label="Sort by top engagement"
                aria-pressed={sortOrder === "top"}
              >
                <TrendingUp size={12} aria-hidden="true" />
                Top
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      <div
        ref={resultsContainerRef}
        className="asph-scrollbar flex-1 overflow-y-auto"
        role="feed"
        aria-label="Search results"
      >
        {/* Loading State */}
        {isLoading && (
          <div
            className="flex items-center justify-center p-8"
            role="status"
            aria-label="Loading search results"
          >
            <div
              className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"
              aria-hidden="true"
            />
            <span className="sr-only">Loading search results...</span>
          </div>
        )}

        {/* Empty State - No Query: Show Explore/Trending */}
        {!activeQuery && !isLoading && (
          <ExploreEmptyState
            onTopicClick={(topic) => {
              setQuery(topic);
              executeSearch(topic);
            }}
            onAccountClick={(handle) => {
              setQuery(`from:${handle}`);
              executeSearch(`from:${handle}`);
            }}
          />
        )}

        {/* Empty State - No Results */}
        {activeQuery && !isLoading && filteredResults.length === 0 && (
          <EmptyState
            variant="search"
            message="Try different keywords or adjust your filters"
            compact
          />
        )}

        {/* Results List */}
        {!isLoading && filteredResults.length > 0 && (
          <div>
            {filteredResults.map((post, index) => (
              <div
                key={post.uri}
                data-post-index={index}
                className={`transition-colors ${
                  focusedPostIndex === index
                    ? "border-l-4 border-l-blue-500 bg-blue-50/50 dark:bg-blue-900/10"
                    : ""
                }`}
              >
                <PostCard
                  post={post}
                  onClick={() => handlePostClick(post)}
                  showBorder={true}
                />
              </div>
            ))}

            {/* Load More Trigger */}
            {hasNextPage && (
              <div ref={loadMoreRef} className="flex justify-center py-4">
                {isFetchingNextPage && (
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                )}
              </div>
            )}

            {/* End of results */}
            {!hasNextPage && filteredResults.length > 0 && (
              <div className="py-4 text-center">
                <p
                  className="text-xs"
                  style={{ color: "var(--asph-text-tertiary)" }}
                >
                  End of results
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Thread Modal */}
      {showThread && selectedPostUri && (
        <ThreadModal
          postUri={selectedPostUri}
          onClose={() => {
            setShowThread(false);
            setSelectedPostUri(null);
          }}
        />
      )}
    </div>
  );
};

/**
 * Memoized SearchColumn for optimal SkyDeck performance
 */
export const SearchColumn = React.memo(
  SearchColumnComponent,
  (prevProps, nextProps) => {
    return (
      prevProps.isFocused === nextProps.isFocused &&
      prevProps.initialQuery === nextProps.initialQuery
    );
  },
);

SearchColumn.displayName = "SearchColumn";
