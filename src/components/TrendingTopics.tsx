/**
 * TrendingTopics component - displays trending topics in a carousel format
 */

import { Flame, Hash, TrendingUp } from "lucide-react";
import React from "react";
import type { Trend, TrendingTopic } from "../hooks/useTrending";

interface TrendingTopicsProps {
  topics?: TrendingTopic[];
  trends?: Trend[];
  onTopicClick: (topic: string) => void;
  isLoading?: boolean;
}

export const TrendingTopics: React.FC<TrendingTopicsProps> = ({
  topics = [],
  trends = [],
  onTopicClick,
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} style={{ color: "var(--asph-primary)" }} />
          <span
            className="text-sm font-medium"
            style={{ color: "var(--asph-text-secondary)" }}
          >
            Trending
          </span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[...Array(5)].map((_, i) => (
            <div
              key={`trending-skeleton-${i}`}
              className="h-8 w-24 shrink-0 animate-pulse rounded-full"
              style={{ backgroundColor: "var(--asph-bg-secondary)" }}
            />
          ))}
        </div>
      </div>
    );
  }

  // Prefer detailed trends if available, fall back to simple topics
  const displayItems =
    trends.length > 0
      ? trends.map((t) => ({
          topic: t.displayName || t.topic,
          isHot: t.status === "hot",
          postCount: t.postCount,
          category: t.category,
        }))
      : topics.map((t) => ({
          topic: t.topic,
          isHot: false,
          postCount: undefined,
          category: undefined,
        }));

  if (displayItems.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <TrendingUp size={16} style={{ color: "var(--asph-primary)" }} />
        <span
          className="text-sm font-medium"
          style={{ color: "var(--asph-text-secondary)" }}
        >
          Trending Now
        </span>
      </div>

      <div
        className="flex gap-2 overflow-x-auto pb-2"
        style={{
          scrollbarWidth: "thin",
          scrollbarColor: "var(--asph-border-primary) transparent",
        }}
      >
        {displayItems.map((item, index) => (
          <button
            key={`${item.topic}-${index}`}
            onClick={() => onTopicClick(item.topic)}
            className="group flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-all hover:border-blue-400 hover:shadow-sm"
            style={{
              backgroundColor: "var(--asph-bg-secondary)",
              borderColor: item.isHot
                ? "var(--asph-primary)"
                : "var(--asph-border-primary)",
              color: "var(--asph-text-primary)",
            }}
          >
            {item.isHot ? (
              <Flame
                size={14}
                className="text-orange-500"
                aria-label="Hot topic"
              />
            ) : (
              <Hash
                size={14}
                style={{ color: "var(--asph-text-tertiary)" }}
                aria-hidden="true"
              />
            )}
            <span className="max-w-[150px] truncate">{item.topic}</span>
            {item.postCount && item.postCount > 1000 && (
              <span
                className="text-xs"
                style={{ color: "var(--asph-text-tertiary)" }}
              >
                {item.postCount >= 1000
                  ? `${(item.postCount / 1000).toFixed(1)}k`
                  : item.postCount}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};
