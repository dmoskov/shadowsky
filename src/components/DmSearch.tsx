import { debug } from "@bsky/shared";
import { format } from "date-fns";
import {
  Calendar,
  ChevronDown,
  Filter,
  Image,
  Link2,
  Search,
  Text,
  User,
  X,
} from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  getDmSearchDB,
  type DmSearchFilters,
  type DmSearchResult,
} from "../services/dm-search-db";

interface DmSearchProps {
  conversationId?: string;
  onResultClick: (messageId: string, conversationId: string) => void;
  senders?: Array<{ did: string; handle?: string; displayName?: string }>;
}

export const DmSearch: React.FC<DmSearchProps> = ({
  conversationId,
  onResultClick,
  senders = [],
}) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DmSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<DmSearchFilters>({
    conversationId,
  });
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Update filters when conversationId prop changes
  useEffect(() => {
    setFilters((prev) => ({ ...prev, conversationId }));
  }, [conversationId]);

  const performSearch = useCallback(
    async (searchQuery: string, searchFilters: DmSearchFilters) => {
      setIsSearching(true);
      try {
        const db = await getDmSearchDB();
        const searchResults = await db.searchMessages(
          searchQuery,
          searchFilters,
          50,
        );
        setResults(searchResults);
      } catch (error) {
        debug.error("DM search error:", error);
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    [],
  );

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (query.trim().length >= 2 || hasActiveFilters(filters)) {
      debounceRef.current = setTimeout(() => {
        performSearch(query, filters);
      }, 300);
    } else {
      setResults([]);
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, filters, performSearch]);

  const hasActiveFilters = (f: DmSearchFilters): boolean => {
    return !!(
      f.senderDid ||
      f.startDate ||
      f.endDate ||
      (f.contentType && f.contentType !== "all")
    );
  };

  const clearFilters = () => {
    setFilters({ conversationId });
  };

  const handleResultClick = (result: DmSearchResult) => {
    onResultClick(result.message.id, result.message.conversationId);
  };

  const highlightMatch = (text: string, searchQuery: string): JSX.Element => {
    if (!searchQuery.trim()) {
      return <>{text}</>;
    }

    const queryLower = searchQuery.toLowerCase();
    const textLower = text.toLowerCase();
    const index = textLower.indexOf(queryLower);

    if (index === -1) {
      return <>{text}</>;
    }

    const before = text.slice(0, index);
    const match = text.slice(index, index + searchQuery.length);
    const after = text.slice(index + searchQuery.length);

    return (
      <>
        {before}
        <mark className="rounded bg-yellow-200 px-0.5 dark:bg-yellow-700">
          {match}
        </mark>
        {after}
      </>
    );
  };

  return (
    <div className="flex h-full flex-col">
      {/* Search input */}
      <div className="border-b border-bsky-border-primary p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-bsky-text-secondary" />
          <input
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search messages..."
            className="w-full rounded-lg border border-bsky-border-primary bg-bsky-bg-secondary py-2 pl-10 pr-10 text-sm text-bsky-text-primary placeholder-bsky-text-secondary focus-visible:border-bsky-primary focus-visible:outline-none"
            aria-label="Search messages"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-bsky-text-secondary hover:text-bsky-text-primary"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filter toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`mt-2 flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors ${
            hasActiveFilters(filters)
              ? "bg-bsky-primary text-white"
              : "text-bsky-text-secondary hover:bg-bsky-bg-secondary"
          }`}
        >
          <Filter className="h-3 w-3" />
          Filters
          {hasActiveFilters(filters) && (
            <span className="ml-1 rounded-full bg-white/20 px-1.5 text-xs">
              {
                [
                  filters.senderDid,
                  filters.startDate,
                  filters.endDate,
                  filters.contentType !== "all" && filters.contentType,
                ].filter(Boolean).length
              }
            </span>
          )}
          <ChevronDown
            className={`h-3 w-3 transition-transform ${showFilters ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="border-b border-bsky-border-primary bg-bsky-bg-secondary p-3">
          <div className="space-y-3">
            {/* Sender filter */}
            <div>
              <label className="mb-1 flex items-center gap-1 text-xs text-bsky-text-secondary">
                <User className="h-3 w-3" />
                Sender
              </label>
              <select
                value={filters.senderDid || ""}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    senderDid: e.target.value || undefined,
                  })
                }
                className="w-full rounded border border-bsky-border-primary bg-bsky-bg-primary px-2 py-1.5 text-sm text-bsky-text-primary focus-visible:border-bsky-primary focus-visible:outline-none"
              >
                <option value="">All senders</option>
                {senders.map((sender) => (
                  <option key={sender.did} value={sender.did}>
                    {sender.displayName || sender.handle || sender.did}
                  </option>
                ))}
              </select>
            </div>

            {/* Date range */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 flex items-center gap-1 text-xs text-bsky-text-secondary">
                  <Calendar className="h-3 w-3" />
                  From
                </label>
                <input
                  type="date"
                  value={
                    filters.startDate
                      ? format(filters.startDate, "yyyy-MM-dd")
                      : ""
                  }
                  onChange={(e) =>
                    setFilters({
                      ...filters,
                      startDate: e.target.value
                        ? new Date(e.target.value)
                        : undefined,
                    })
                  }
                  className="w-full rounded border border-bsky-border-primary bg-bsky-bg-primary px-2 py-1.5 text-sm text-bsky-text-primary focus-visible:border-bsky-primary focus-visible:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 flex items-center gap-1 text-xs text-bsky-text-secondary">
                  <Calendar className="h-3 w-3" />
                  To
                </label>
                <input
                  type="date"
                  value={
                    filters.endDate ? format(filters.endDate, "yyyy-MM-dd") : ""
                  }
                  onChange={(e) =>
                    setFilters({
                      ...filters,
                      endDate: e.target.value
                        ? new Date(e.target.value)
                        : undefined,
                    })
                  }
                  className="w-full rounded border border-bsky-border-primary bg-bsky-bg-primary px-2 py-1.5 text-sm text-bsky-text-primary focus-visible:border-bsky-primary focus-visible:outline-none"
                />
              </div>
            </div>

            {/* Content type */}
            <div>
              <label className="mb-1 block text-xs text-bsky-text-secondary">
                Content type
              </label>
              <div className="flex flex-wrap gap-1">
                {[
                  { value: "all", label: "All", icon: null },
                  { value: "text", label: "Text only", icon: Text },
                  { value: "media", label: "Media", icon: Image },
                  { value: "links", label: "Links", icon: Link2 },
                ].map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    onClick={() =>
                      setFilters({
                        ...filters,
                        contentType: value as DmSearchFilters["contentType"],
                      })
                    }
                    className={`flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors ${
                      (filters.contentType || "all") === value
                        ? "bg-bsky-primary text-white"
                        : "hover:bg-bsky-bg-primary/80 bg-bsky-bg-primary text-bsky-text-secondary"
                    }`}
                  >
                    {Icon && <Icon className="h-3 w-3" />}
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Clear filters */}
            {hasActiveFilters(filters) && (
              <button
                onClick={clearFilters}
                className="text-xs text-bsky-primary hover:underline"
              >
                Clear all filters
              </button>
            )}
          </div>
        </div>
      )}

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {isSearching ? (
          <div className="p-4 text-center text-sm text-bsky-text-secondary">
            Searching...
          </div>
        ) : results.length > 0 ? (
          <div className="divide-y divide-bsky-border-primary">
            {results.map((result) => (
              <button
                key={result.message.id}
                onClick={() => handleResultClick(result)}
                className="w-full cursor-pointer p-3 text-left transition-colors hover:bg-bsky-bg-secondary focus-visible:bg-bsky-bg-secondary focus-visible:outline-none"
              >
                <div className="flex items-center gap-2 text-xs text-bsky-text-secondary">
                  <span className="font-medium">
                    {result.message.senderDisplayName ||
                      result.message.senderHandle ||
                      "Unknown"}
                  </span>
                  <span>-</span>
                  <span>
                    {format(new Date(result.message.sentAt), "MMM d, yyyy")}
                  </span>
                  {result.message.hasMedia && (
                    <Image className="h-3 w-3 text-bsky-primary" />
                  )}
                  {result.message.hasLinks && (
                    <Link2 className="h-3 w-3 text-bsky-primary" />
                  )}
                </div>
                <div className="mt-1 text-sm text-bsky-text-primary">
                  {highlightMatch(result.matchSnippet, query)}
                </div>
              </button>
            ))}
          </div>
        ) : query.length >= 2 || hasActiveFilters(filters) ? (
          <div className="p-4 text-center text-sm text-bsky-text-secondary">
            No messages found
          </div>
        ) : (
          <div className="p-4 text-center text-sm text-bsky-text-secondary">
            Enter at least 2 characters to search
          </div>
        )}
      </div>
    </div>
  );
};
