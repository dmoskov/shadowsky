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
import { defaultFilters, useSearch } from "../hooks/useSearch";
import type { SearchHistoryEntry } from "../services/search-history-db";
import { PostCard } from "./PostCard";
import { SearchFilterPanel } from "./SearchFilterPanel";
import { ThreadModal } from "./ThreadModal";

interface SearchColumnProps {
  isFocused?: boolean;
  onClose?: () => void;
}

export const SearchColumn: React.FC<SearchColumnProps> = ({
  isFocused = false,
  onClose,
}) => {
  const { isPostHidden } = useHiddenPosts();
  const { isUserMuted, isUserBlocked, isThreadMuted } = useModeration();

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
        setFilters({
          hasMedia: entry.filters.hasMedia || false,
          fromUsers: entry.filters.fromUsers || [],
          sinceDate: entry.filters.sinceDate || "",
          untilDate: entry.filters.untilDate || "",
          language: entry.filters.language || "",
        });
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

  // Reset filters
  const resetFilters = useCallback(() => {
    setFilters(defaultFilters);
  }, [setFilters]);

  return (
    <div
      ref={containerRef}
      className="flex h-full flex-col"
      style={{ outline: "none" }}
    >
      {/* Header with Search Input */}
      <div
        className="bsky-glass sticky top-0 z-20 border-b"
        style={{ borderColor: "var(--bsky-border-primary)" }}
      >
        <div className="flex items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Search size={20} style={{ color: "var(--bsky-primary)" }} />
            <h2
              className="text-lg font-semibold"
              style={{ color: "var(--bsky-text-primary)" }}
            >
              Search
            </h2>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="rounded-full p-1.5 transition-all hover:bg-gray-200 dark:hover:bg-gray-700"
              style={{ color: "var(--bsky-text-secondary)" }}
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
                style={{ color: "var(--bsky-text-tertiary)" }}
              />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search posts..."
                value={query}
                onChange={handleInputChange}
                onFocus={() => setShowDropdown(true)}
                onKeyDown={handleKeyDown}
                className="w-full rounded-lg py-2 pl-10 pr-10 text-sm"
                style={{
                  backgroundColor: "var(--bsky-bg-secondary)",
                  border: "1px solid var(--bsky-border-primary)",
                  color: "var(--bsky-text-primary)",
                }}
                autoComplete="off"
              />
              {query && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transform rounded-full p-1 hover:bg-gray-200 dark:hover:bg-gray-600"
                >
                  <X size={14} style={{ color: "var(--bsky-text-tertiary)" }} />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={`relative rounded-lg border p-2 transition-all ${showFilters ? "ring-2" : ""}`}
              style={{
                backgroundColor: hasActiveFilters
                  ? "var(--bsky-primary)"
                  : "var(--bsky-bg-secondary)",
                borderColor: "var(--bsky-border-primary)",
                color: hasActiveFilters
                  ? "white"
                  : "var(--bsky-text-secondary)",
              }}
            >
              <Filter size={18} />
              {hasActiveFilters && (
                <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-red-500" />
              )}
            </button>
          </div>

          {/* Autocomplete Dropdown */}
          {showDropdown && searchHistory.length > 0 && (
            <div
              ref={dropdownRef}
              className="absolute left-4 right-4 top-full z-30 mt-1 max-h-80 overflow-y-auto rounded-lg border shadow-lg"
              style={{
                backgroundColor: "var(--bsky-bg-primary)",
                borderColor: "var(--bsky-border-primary)",
              }}
            >
              <div
                className="flex items-center justify-between border-b px-3 py-2"
                style={{ borderColor: "var(--bsky-border-primary)" }}
              >
                <span
                  className="flex items-center gap-1.5 text-xs font-medium"
                  style={{ color: "var(--bsky-text-secondary)" }}
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
                  style={{ color: "var(--bsky-text-tertiary)" }}
                >
                  <Trash2 size={12} />
                  Clear
                </button>
              </div>

              <div className="py-1">
                {searchHistory.map((entry, index) => (
                  <button
                    key={entry.id}
                    type="button"
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
                        style={{ color: "var(--bsky-text-tertiary)" }}
                      />
                      <div className="min-w-0 flex-1">
                        <span
                          className="block truncate"
                          style={{ color: "var(--bsky-text-primary)" }}
                        >
                          {entry.query}
                        </span>
                        <span
                          className="text-xs"
                          style={{ color: "var(--bsky-text-tertiary)" }}
                        >
                          {formatDistanceToNow(new Date(entry.timestamp))} ago
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
                      style={{ color: "var(--bsky-text-tertiary)" }}
                    >
                      <X size={12} />
                    </button>
                  </button>
                ))}
              </div>

              {/* Keyboard hints */}
              <div
                className="flex items-center gap-3 border-t px-3 py-2 text-xs"
                style={{
                  borderColor: "var(--bsky-border-primary)",
                  color: "var(--bsky-text-tertiary)",
                }}
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

        {/* Filters Panel */}
        {showFilters && (
          <div
            className="border-t px-4 py-3"
            style={{ borderColor: "var(--bsky-border-primary)" }}
          >
            <div className="space-y-3">
              {/* Quick Filters */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() =>
                    setFilters((prev: SearchFilters) => ({
                      ...prev,
                      hasMedia: !prev.hasMedia,
                    }))
                  }
                  className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs transition-colors ${filters.hasMedia ? "ring-2" : ""}`}
                  style={{
                    backgroundColor: filters.hasMedia
                      ? "var(--bsky-primary)"
                      : "var(--bsky-bg-secondary)",
                    color: filters.hasMedia
                      ? "white"
                      : "var(--bsky-text-secondary)",
                    borderWidth: "1px",
                    borderColor: "var(--bsky-border-primary)",
                  }}
                >
                  <Image size={12} />
                  Has media
                </button>
              </div>

              {/* Date Range */}
              <div>
                <label
                  className="mb-1 flex items-center gap-1 text-xs font-medium"
                  style={{ color: "var(--bsky-text-secondary)" }}
                >
                  <Calendar size={12} />
                  Date Range
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {[
                    { label: "24h", days: 1 },
                    { label: "7d", days: 7 },
                    { label: "30d", days: 30 },
                    { label: "1y", months: 12 },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => {
                        const today = new Date();
                        const since = preset.days
                          ? subDays(today, preset.days)
                          : subMonths(today, preset.months || 0);
                        setFilters((prev: SearchFilters) => ({
                          ...prev,
                          sinceDate: format(since, "yyyy-MM-dd"),
                          untilDate: format(today, "yyyy-MM-dd"),
                        }));
                      }}
                      className="rounded-md border px-2 py-0.5 text-xs transition-colors hover:bg-gray-500/10"
                      style={{
                        color: "var(--bsky-primary)",
                        borderColor: "var(--bsky-border-primary)",
                      }}
                    >
                      {preset.label}
                    </button>
                  ))}
                  {(filters.sinceDate || filters.untilDate) && (
                    <button
                      onClick={() =>
                        setFilters((prev: SearchFilters) => ({
                          ...prev,
                          sinceDate: "",
                          untilDate: "",
                        }))
                      }
                      className="rounded-md px-2 py-0.5 text-xs transition-colors hover:bg-gray-500/10"
                      style={{ color: "var(--bsky-text-tertiary)" }}
                    >
                      Clear
                    </button>
                  )}
                </div>
                {(filters.sinceDate || filters.untilDate) && (
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    <input
                      type="date"
                      value={filters.sinceDate}
                      onChange={(e) =>
                        setFilters((prev: SearchFilters) => ({
                          ...prev,
                          sinceDate: e.target.value,
                        }))
                      }
                      className="rounded-md border px-2 py-1"
                      style={{
                        backgroundColor: "var(--bsky-bg-secondary)",
                        borderColor: "var(--bsky-border-primary)",
                        color: "var(--bsky-text-primary)",
                        colorScheme: "dark",
                      }}
                    />
                    <span style={{ color: "var(--bsky-text-tertiary)" }}>
                      to
                    </span>
                    <input
                      type="date"
                      value={filters.untilDate}
                      onChange={(e) =>
                        setFilters((prev: SearchFilters) => ({
                          ...prev,
                          untilDate: e.target.value,
                        }))
                      }
                      className="rounded-md border px-2 py-1"
                      style={{
                        backgroundColor: "var(--bsky-bg-secondary)",
                        borderColor: "var(--bsky-border-primary)",
                        color: "var(--bsky-text-primary)",
                        colorScheme: "dark",
                      }}
                    />
                  </div>
                )}
              </div>

              {/* From User Filter */}
              <div>
                <label
                  className="mb-1 flex items-center gap-1 text-xs font-medium"
                  style={{ color: "var(--bsky-text-secondary)" }}
                >
                  <User size={12} />
                  From Users
                </label>
                <div className="flex flex-wrap gap-2">
                  {filters.fromUsers.map((user, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs"
                      style={{
                        backgroundColor: "var(--bsky-bg-secondary)",
                        borderColor: "var(--bsky-border-primary)",
                        color: "var(--bsky-text-primary)",
                      }}
                    >
                      <span>@{user}</span>
                      <button
                        onClick={() =>
                          setFilters((prev: SearchFilters) => ({
                            ...prev,
                            fromUsers: prev.fromUsers.filter(
                              (_, idx) => idx !== i,
                            ),
                          }))
                        }
                        className="ml-1 rounded hover:bg-gray-500/20"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                  <input
                    type="text"
                    placeholder="Add user..."
                    className="w-28 rounded-md border px-2 py-1 text-xs"
                    style={{
                      backgroundColor: "var(--bsky-bg-secondary)",
                      borderColor: "var(--bsky-border-primary)",
                      color: "var(--bsky-text-primary)",
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && e.currentTarget.value.trim()) {
                        e.preventDefault();
                        setFilters((prev: SearchFilters) => ({
                          ...prev,
                          fromUsers: [
                            ...prev.fromUsers,
                            e.currentTarget.value.trim().replace(/^@/, ""),
                          ],
                        }));
                        e.currentTarget.value = "";
                      }
                    }}
                  />
                </div>
              </div>

              {/* Language Filter */}
              <div>
                <label
                  className="mb-1 flex items-center gap-1 text-xs font-medium"
                  style={{ color: "var(--bsky-text-secondary)" }}
                >
                  <Globe size={12} />
                  Language
                </label>
                <select
                  value={filters.language}
                  onChange={(e) =>
                    setFilters((prev: SearchFilters) => ({
                      ...prev,
                      language: e.target.value,
                    }))
                  }
                  className="rounded-md border px-2 py-1 text-xs"
                  style={{
                    backgroundColor: "var(--bsky-bg-secondary)",
                    borderColor: "var(--bsky-border-primary)",
                    color: "var(--bsky-text-primary)",
                  }}
                >
                  <option value="">Any</option>
                  <option value="en">English</option>
                  <option value="ja">Japanese</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                  <option value="pt">Portuguese</option>
                  <option value="ko">Korean</option>
                  <option value="zh">Chinese</option>
                </select>
              </div>

              {/* Reset Filters */}
              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="text-xs transition-colors hover:underline"
                  style={{ color: "var(--bsky-text-tertiary)" }}
                >
                  Reset all filters
                </button>
              )}
            </div>
          </div>
        )}

        {/* Sort Order Toggle - only show when we have results */}
        {activeQuery && (
          <div
            className="flex items-center justify-between border-t px-4 py-2"
            style={{ borderColor: "var(--bsky-border-primary)" }}
          >
            <span
              className="text-xs"
              style={{ color: "var(--bsky-text-secondary)" }}
            >
              {filteredResults.length} results
              {fullSearchQuery !== activeQuery && (
                <span
                  className="ml-1"
                  style={{ color: "var(--bsky-text-tertiary)" }}
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
                    ? { color: "var(--bsky-text-secondary)" }
                    : {}
                }
              >
                <Clock size={12} />
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
                    ? { color: "var(--bsky-text-secondary)" }
                    : {}
                }
              >
                <TrendingUp size={12} />
                Top
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      <div ref={resultsContainerRef} className="flex-1 overflow-y-auto">
        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center p-8">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          </div>
        )}

        {/* Empty State - No Query */}
        {!activeQuery && !isLoading && (
          <div className="p-8 text-center">
            <Search
              size={48}
              className="mx-auto mb-4"
              style={{ color: "var(--bsky-text-tertiary)" }}
            />
            <p style={{ color: "var(--bsky-text-primary)" }}>
              Search Bluesky posts
            </p>
            <p
              className="mt-2 text-sm"
              style={{ color: "var(--bsky-text-secondary)" }}
            >
              Type a query and press Enter to search
            </p>
            <div
              className="mt-4 text-xs"
              style={{ color: "var(--bsky-text-tertiary)" }}
            >
              <p className="mb-1">Keyboard shortcuts:</p>
              <p>/ or s - Focus search</p>
              <p>j/k or arrows - Navigate results</p>
              <p>Enter - Open post</p>
            </div>
          </div>
        )}

        {/* Empty State - No Results */}
        {activeQuery && !isLoading && filteredResults.length === 0 && (
          <div className="p-8 text-center">
            <Search
              size={48}
              className="mx-auto mb-4"
              style={{ color: "var(--bsky-text-tertiary)" }}
            />
            <p style={{ color: "var(--bsky-text-primary)" }}>
              No results found
            </p>
            <p
              className="mt-2 text-sm"
              style={{ color: "var(--bsky-text-secondary)" }}
            >
              Try different keywords or adjust your filters
            </p>
          </div>
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
                  style={{ color: "var(--bsky-text-tertiary)" }}
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
