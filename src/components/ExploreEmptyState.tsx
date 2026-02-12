/**
 * ExploreEmptyState component - displays trending content when search is empty
 * Combines trending topics carousel and suggested accounts
 */

import { RefreshCw, Sparkles, TrendingUp } from "lucide-react";
import React from "react";
import { useTrendingData } from "../hooks/useTrending";
import { SuggestedAccounts } from "./SuggestedAccounts";
import { TrendingTopics } from "./TrendingTopics";

interface ExploreEmptyStateProps {
  onTopicClick: (topic: string) => void;
  onAccountClick: (handle: string) => void;
}

export const ExploreEmptyState: React.FC<ExploreEmptyStateProps> = ({
  onTopicClick,
  onAccountClick,
}) => {
  const { topics, suggested, trends, isLoading, error, refetchAll } =
    useTrendingData({ limit: 15 });

  // Collect unique actors from all trends
  const trendingActors = React.useMemo(() => {
    const actorMap = new Map<
      string,
      NonNullable<(typeof trends)[number]["actors"]>[number]
    >();
    trends.forEach((trend) => {
      trend.actors?.forEach((actor) => {
        if (!actorMap.has(actor.did)) {
          actorMap.set(actor.did, actor);
        }
      });
    });
    return Array.from(actorMap.values());
  }, [trends]);

  if (error) {
    return (
      <div className="space-y-4 p-4">
        <div
          className="rounded-lg border p-6 text-center"
          style={{
            backgroundColor: "var(--asph-bg-secondary)",
            borderColor: "var(--asph-border-primary)",
          }}
        >
          <Sparkles
            size={32}
            className="mx-auto mb-3"
            style={{ color: "var(--asph-text-tertiary)" }}
          />
          <p
            className="mb-2 text-sm"
            style={{ color: "var(--asph-text-primary)" }}
          >
            Unable to load trending content
          </p>
          <button
            onClick={() => refetchAll()}
            className="mx-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors"
            style={{
              backgroundColor: "var(--asph-primary)",
              color: "white",
            }}
          >
            <RefreshCw size={14} />
            Try again
          </button>
        </div>
      </div>
    );
  }

  const hasContent =
    topics.length > 0 || trends.length > 0 || suggested.length > 0;

  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp size={20} style={{ color: "var(--asph-primary)" }} />
          <h3
            className="font-medium"
            style={{ color: "var(--asph-text-primary)" }}
          >
            Explore
          </h3>
        </div>
        {hasContent && (
          <button
            onClick={() => refetchAll()}
            className="rounded-full p-1.5 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
            style={{ color: "var(--asph-text-tertiary)" }}
            aria-label="Refresh trending content"
          >
            <RefreshCw size={16} />
          </button>
        )}
      </div>

      {/* Trending Topics Carousel */}
      <TrendingTopics
        topics={topics}
        trends={trends}
        onTopicClick={onTopicClick}
        isLoading={isLoading}
      />

      {/* Suggested Accounts from Trends */}
      {trendingActors.length > 0 && (
        <SuggestedAccounts
          actors={trendingActors}
          onAccountClick={onAccountClick}
          isLoading={isLoading}
        />
      )}

      {/* Suggested Feeds Section */}
      {suggested.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles size={16} style={{ color: "var(--asph-primary)" }} />
            <span
              className="text-sm font-medium"
              style={{ color: "var(--asph-text-secondary)" }}
            >
              Suggested Topics
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {suggested.slice(0, 8).map((item, index) => (
              <button
                key={`${item.topic}-${index}`}
                onClick={() => onTopicClick(item.topic)}
                className="rounded-full border px-3 py-1.5 text-sm transition-all hover:border-blue-400 hover:shadow-sm"
                style={{
                  backgroundColor: "var(--asph-bg-secondary)",
                  borderColor: "var(--asph-border-primary)",
                  color: "var(--asph-text-primary)",
                }}
              >
                {item.topic}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search tip */}
      <div
        className="rounded-lg p-3 text-center text-xs"
        style={{
          backgroundColor: "var(--asph-bg-secondary)",
          color: "var(--asph-text-tertiary)",
        }}
      >
        <p>Type a query above to search posts</p>
        <p className="mt-1">
          Press{" "}
          <kbd className="rounded bg-gray-200 px-1 dark:bg-gray-700">/</kbd> to
          focus search
        </p>
      </div>
    </div>
  );
};
