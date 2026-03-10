/**
 * PostingTimeRecommendations - Shows top 5 recommended posting times
 * based on historical engagement data analysis.
 */

import { Clock, Sparkles, TrendingUp } from "lucide-react";
import React from "react";
import type { PostingTimeAnalysis } from "../../services/posting-time-recommendations";

interface PostingTimeRecommendationsProps {
  analysis: PostingTimeAnalysis;
  dateRangeLabel: string;
}

export const PostingTimeRecommendations: React.FC<
  PostingTimeRecommendationsProps
> = ({ analysis, dateRangeLabel }) => {
  if (analysis.recommendations.length === 0) {
    return (
      <div
        className="asph-card p-6"
        style={{ background: "var(--asph-bg-secondary)" }}
      >
        <h2
          className="mb-4 flex items-center gap-2 text-lg font-semibold"
          style={{ color: "var(--asph-text-primary)" }}
        >
          <Sparkles size={20} className="text-amber-500" />
          Recommended Posting Times
        </h2>
        <div
          className="rounded-lg p-6 text-center"
          style={{ backgroundColor: "var(--asph-bg-tertiary)" }}
        >
          <Clock
            size={32}
            className="mx-auto mb-2 opacity-50"
            style={{ color: "var(--asph-text-secondary)" }}
          />
          <p
            className="text-sm"
            style={{ color: "var(--asph-text-secondary)" }}
          >
            Not enough posting data to generate recommendations. Keep posting
            and check back later!
          </p>
        </div>
      </div>
    );
  }

  const confidenceColor = (confidence: "high" | "medium" | "low"): string => {
    switch (confidence) {
      case "high":
        return "#22c55e";
      case "medium":
        return "#eab308";
      case "low":
        return "#94a3b8";
    }
  };

  return (
    <div
      className="asph-card p-6"
      style={{ background: "var(--asph-bg-secondary)" }}
    >
      <div className="mb-4 flex items-center justify-between">
        <h2
          className="flex items-center gap-2 text-lg font-semibold"
          style={{ color: "var(--asph-text-primary)" }}
        >
          <Sparkles size={20} className="text-amber-500" />
          Recommended Posting Times
        </h2>
        <span
          className="text-xs"
          style={{ color: "var(--asph-text-secondary)" }}
        >
          Based on {dateRangeLabel} of data
        </span>
      </div>
      <p
        className="mb-4 text-sm"
        style={{ color: "var(--asph-text-secondary)" }}
      >
        Your top {analysis.recommendations.length} time slots ranked by
        engagement, weighted toward recent activity
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {analysis.recommendations.map((rec, i) => (
          <div
            key={`rec-${rec.dayOfWeek}-${rec.hour}`}
            className="relative rounded-lg p-4 transition-all hover:scale-[1.02]"
            style={{
              backgroundColor: "var(--asph-bg-tertiary)",
              border:
                i === 0
                  ? "2px solid var(--asph-primary)"
                  : "1px solid var(--asph-border-primary)",
            }}
          >
            {/* Rank badge */}
            <div className="mb-2 flex items-center justify-between">
              <span
                className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold"
                style={{
                  backgroundColor:
                    i === 0
                      ? "var(--asph-primary)"
                      : "var(--asph-bg-secondary)",
                  color: i === 0 ? "white" : "var(--asph-text-secondary)",
                }}
              >
                {i + 1}
              </span>
              <span
                className="rounded-full px-2 py-0.5 text-xs font-medium"
                style={{
                  backgroundColor: confidenceColor(rec.confidence),
                  color: "white",
                }}
              >
                {rec.confidence}
              </span>
            </div>

            {/* Time and day */}
            <div
              className="text-base font-bold"
              style={{ color: "var(--asph-text-primary)" }}
            >
              {rec.label}
            </div>

            {/* Engagement metric */}
            <div className="mt-2 flex items-center gap-1">
              <TrendingUp size={14} style={{ color: "var(--asph-primary)" }} />
              <span
                className="text-sm font-medium"
                style={{ color: "var(--asph-primary)" }}
              >
                ~{rec.avgEngagement}
              </span>
              <span
                className="text-xs"
                style={{ color: "var(--asph-text-secondary)" }}
              >
                avg
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Weekly refresh note */}
      {analysis.lastCalculated && (
        <div
          className="mt-4 text-xs"
          style={{ color: "var(--asph-text-secondary)" }}
        >
          Last updated:{" "}
          {new Date(analysis.lastCalculated).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
          {" - Refreshes weekly"}
        </div>
      )}
    </div>
  );
};
