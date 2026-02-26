import { RefreshCw, Search, TrendingUp } from "lucide-react";
import React, { useCallback, useState } from "react";
import { useTrendingData, type Trend } from "../hooks/useTrending";
import { TRENDING_CACHE_TTL } from "../services/trending-service";

interface TrendingColumnProps {
  isFocused?: boolean;
  onSearchTopic?: (topic: string) => void;
}

const TrendingColumnComponent: React.FC<TrendingColumnProps> = ({
  isFocused: _isFocused = false,
  onSearchTopic,
}) => {
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const { trends, topics, isLoading, error, refetchAll } = useTrendingData({
    limit: 10,
  });

  const handleRefresh = useCallback(() => {
    refetchAll();
    setLastRefresh(new Date());
  }, [refetchAll]);

  const handleTopicClick = useCallback(
    (topic: string) => {
      if (onSearchTopic) {
        onSearchTopic(topic);
      } else {
        // Dispatch a custom event that can be caught by other components
        window.dispatchEvent(
          new CustomEvent("searchTopic", { detail: { topic } }),
        );
      }
    },
    [onSearchTopic],
  );

  // Format relative time since last refresh
  const formatLastRefresh = () => {
    const now = new Date();
    const diffMs = now.getTime() - lastRefresh.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "just now";
    if (diffMins === 1) return "1 min ago";
    return `${diffMins} mins ago`;
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div
        className="asph-glass sticky top-0 z-20 border-b"
        style={{ borderColor: "var(--asph-border-primary)" }}
      >
        <div className="flex items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-2">
            <TrendingUp size={20} style={{ color: "var(--asph-primary)" }} />
            <h2
              className="text-lg font-semibold"
              style={{ color: "var(--asph-text-primary)" }}
            >
              Trending
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="text-xs"
              style={{ color: "var(--asph-text-tertiary)" }}
            >
              {formatLastRefresh()}
            </span>
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className={`rounded-full p-1.5 transition-all hover:bg-gray-200 dark:hover:bg-gray-700 ${
                isLoading ? "animate-spin" : ""
              }`}
              style={{ color: "var(--asph-text-secondary)" }}
              aria-label="Refresh trending"
              title="Refresh trending"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="asph-scrollbar flex-1 overflow-y-auto">
        {/* Loading State */}
        {isLoading && trends.length === 0 && (
          <div className="flex items-center justify-center p-8">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="p-4 text-center">
            <p
              className="text-sm"
              style={{ color: "var(--asph-text-secondary)" }}
            >
              Failed to load trending topics
            </p>
            <button
              onClick={handleRefresh}
              className="mt-2 text-sm text-blue-500 hover:underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Trending Items */}
        {!isLoading && !error && (
          <div
            className="divide-y"
            style={{ borderColor: "var(--asph-border-primary)" }}
          >
            {/* Detailed Trends */}
            {trends.length > 0 && (
              <div className="py-2">
                <div className="px-4 py-2">
                  <span
                    className="text-xs font-medium uppercase tracking-wide"
                    style={{ color: "var(--asph-text-tertiary)" }}
                  >
                    Trending Now
                  </span>
                </div>
                {trends.map((trend: Trend, index: number) => (
                  <TrendingItem
                    key={`trend-${index}`}
                    rank={index + 1}
                    topic={trend.displayName || trend.topic}
                    postCount={trend.postCount}
                    status={trend.status}
                    category={trend.category}
                    onClick={() =>
                      handleTopicClick(trend.displayName || trend.topic)
                    }
                  />
                ))}
              </div>
            )}

            {/* Simple Topics (fallback if no detailed trends) */}
            {trends.length === 0 && topics.length > 0 && (
              <div className="py-2">
                <div className="px-4 py-2">
                  <span
                    className="text-xs font-medium uppercase tracking-wide"
                    style={{ color: "var(--asph-text-tertiary)" }}
                  >
                    Popular Topics
                  </span>
                </div>
                {topics.map((topic, index) => (
                  <TrendingItem
                    key={`topic-${index}`}
                    rank={index + 1}
                    topic={topic.topic}
                    onClick={() => handleTopicClick(topic.topic)}
                  />
                ))}
              </div>
            )}

            {/* Empty State */}
            {trends.length === 0 && topics.length === 0 && !isLoading && (
              <div className="p-8 text-center">
                <TrendingUp
                  size={48}
                  className="mx-auto mb-4 opacity-30"
                  style={{ color: "var(--asph-text-tertiary)" }}
                />
                <p
                  className="text-sm"
                  style={{ color: "var(--asph-text-secondary)" }}
                >
                  No trending topics available
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer with auto-refresh info */}
      <div
        className="border-t px-4 py-2 text-center"
        style={{ borderColor: "var(--asph-border-primary)" }}
      >
        <span
          className="text-xs"
          style={{ color: "var(--asph-text-tertiary)" }}
        >
          Auto-refreshes every {Math.round(TRENDING_CACHE_TTL / 60000)} minutes
        </span>
      </div>
    </div>
  );
};

/**
 * Memoized TrendingColumn for optimal SkyDeck performance
 */
export const TrendingColumn = React.memo(TrendingColumnComponent);

TrendingColumn.displayName = "TrendingColumn";

// Individual trending item component
interface TrendingItemProps {
  rank: number;
  topic: string;
  postCount?: number;
  status?: "hot" | string;
  category?: string;
  onClick: () => void;
}

const TrendingItem: React.FC<TrendingItemProps> = ({
  rank,
  topic,
  postCount,
  status,
  category,
  onClick,
}) => {
  // Format post count for display
  const formatCount = (count?: number) => {
    if (!count) return null;
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    }
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  return (
    <button
      onClick={onClick}
      className="group flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
    >
      {/* Rank */}
      <div
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium"
        style={{
          backgroundColor:
            rank <= 3 ? "var(--asph-primary)" : "var(--asph-bg-secondary)",
          color: rank <= 3 ? "white" : "var(--asph-text-secondary)",
        }}
      >
        {rank}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className="truncate font-medium"
            style={{ color: "var(--asph-text-primary)" }}
          >
            {topic}
          </span>
          {status === "hot" && (
            <span className="shrink-0 rounded-full bg-orange-100 px-1.5 py-0.5 text-xs font-medium text-orange-600 dark:bg-orange-900/30 dark:text-orange-400">
              Hot
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-2">
          {category && (
            <span
              className="text-xs"
              style={{ color: "var(--asph-text-tertiary)" }}
            >
              {category}
            </span>
          )}
          {postCount && (
            <span
              className="text-xs"
              style={{ color: "var(--asph-text-tertiary)" }}
            >
              {formatCount(postCount)} posts
            </span>
          )}
        </div>
      </div>

      {/* Search icon on hover */}
      <Search
        size={16}
        className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
        style={{ color: "var(--asph-text-tertiary)" }}
      />
    </button>
  );
};

export default TrendingColumn;
