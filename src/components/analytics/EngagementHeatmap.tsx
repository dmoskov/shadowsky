/**
 * EngagementHeatmap - Visualizes engagement data as a day-of-week × hour-of-day heatmap.
 * Shows when the user's posts get the most engagement, helping identify optimal posting windows.
 */

import { Clock } from "lucide-react";
import React, { useMemo } from "react";
import type { PostingTimeRecommendation } from "../../services/posting-time-recommendations";

interface EngagementHeatmapProps {
  heatmapData: number[][]; // 7 rows (days, 0=Sun) × 24 cols (hours)
  recommendations?: PostingTimeRecommendation[];
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOUR_LABELS = [
  "12a",
  "",
  "",
  "3a",
  "",
  "",
  "6a",
  "",
  "",
  "9a",
  "",
  "",
  "12p",
  "",
  "",
  "3p",
  "",
  "",
  "6p",
  "",
  "",
  "9p",
  "",
  "",
];

function formatHour(hour: number): string {
  if (hour === 0) return "12 AM";
  if (hour === 12) return "12 PM";
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
}

export const EngagementHeatmap: React.FC<EngagementHeatmapProps> = ({
  heatmapData,
  recommendations,
}) => {
  const { maxVal, colorScale } = useMemo(() => {
    let max = 0;
    for (const row of heatmapData) {
      for (const val of row) {
        if (val > max) max = val;
      }
    }
    max = max || 1;

    // Build a color scale function
    const scale = (val: number): string => {
      if (val === 0) return "var(--asph-bg-tertiary)";
      const intensity = val / max;
      // Green-based scale from light to dark
      if (intensity < 0.25) return "rgba(74, 222, 128, 0.2)"; // green-400/20%
      if (intensity < 0.5) return "rgba(74, 222, 128, 0.4)"; // green-400/40%
      if (intensity < 0.75) return "rgba(34, 197, 94, 0.6)"; // green-500/60%
      return "rgba(22, 163, 74, 0.85)"; // green-600/85%
    };

    return { maxVal: max, colorScale: scale };
  }, [heatmapData]);

  const topSlots = useMemo(() => {
    if (!recommendations) return new Set<string>();
    return new Set(
      recommendations
        .filter((r) => r.dayOfWeek >= 0)
        .map((r) => `${r.dayOfWeek}-${r.hour}`),
    );
  }, [recommendations]);

  return (
    <div
      className="asph-card p-6"
      style={{ background: "var(--asph-bg-secondary)" }}
    >
      <h2
        className="mb-4 flex items-center gap-2 text-lg font-semibold"
        style={{ color: "var(--asph-text-primary)" }}
      >
        <Clock size={20} className="text-green-500" />
        Engagement by Time of Day
      </h2>
      <p
        className="mb-4 text-sm"
        style={{ color: "var(--asph-text-secondary)" }}
      >
        Brighter cells indicate higher average engagement
      </p>

      <div className="overflow-x-auto">
        <div style={{ minWidth: "600px" }}>
          {/* Hour labels */}
          <div className="mb-1 flex" style={{ paddingLeft: "40px" }}>
            {HOUR_LABELS.map((label, i) => (
              <div
                key={i}
                className="flex-1 text-center text-xs"
                style={{ color: "var(--asph-text-secondary)", fontSize: "9px" }}
              >
                {label}
              </div>
            ))}
          </div>

          {/* Heatmap grid */}
          {heatmapData.map((dayData, dayIdx) => (
            <div key={dayIdx} className="mb-0.5 flex items-center">
              <div
                className="w-10 flex-shrink-0 text-right text-xs"
                style={{
                  color: "var(--asph-text-secondary)",
                  paddingRight: "6px",
                }}
              >
                {DAY_LABELS[dayIdx]}
              </div>
              <div className="flex flex-1 gap-0.5">
                {dayData.map((val, hourIdx) => {
                  const isRecommended = topSlots.has(`${dayIdx}-${hourIdx}`);
                  return (
                    <div
                      key={hourIdx}
                      className="group relative flex-1"
                      style={{
                        aspectRatio: "1",
                        maxHeight: "24px",
                        backgroundColor: colorScale(val),
                        borderRadius: "3px",
                        border: isRecommended
                          ? "2px solid var(--asph-primary)"
                          : "none",
                        cursor: "default",
                      }}
                      title={`${DAY_LABELS[dayIdx]} ${formatHour(hourIdx)}: ${val} avg engagement`}
                    >
                      {/* Tooltip */}
                      <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 -translate-x-1/2 opacity-0 transition-opacity group-hover:opacity-100">
                        <div
                          className="whitespace-nowrap rounded px-2 py-1 text-xs"
                          style={{
                            backgroundColor: "var(--asph-bg-primary)",
                            color: "var(--asph-text-primary)",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                            border: "1px solid var(--asph-border-primary)",
                          }}
                        >
                          <div className="font-medium">
                            {DAY_LABELS[dayIdx]} {formatHour(hourIdx)}
                          </div>
                          <div style={{ color: "var(--asph-text-secondary)" }}>
                            {val > 0 ? `${val} avg` : "No data"}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-3 flex items-center justify-between text-xs">
        <span style={{ color: "var(--asph-text-secondary)" }}>
          Less engagement
        </span>
        <div className="flex gap-1">
          {[0, 0.25, 0.5, 0.75, 1].map((level) => (
            <div
              key={level}
              className="rounded"
              style={{
                width: "16px",
                height: "16px",
                backgroundColor:
                  level === 0
                    ? "var(--asph-bg-tertiary)"
                    : level < 0.25
                      ? "rgba(74, 222, 128, 0.2)"
                      : level < 0.5
                        ? "rgba(74, 222, 128, 0.4)"
                        : level < 0.75
                          ? "rgba(34, 197, 94, 0.6)"
                          : "rgba(22, 163, 74, 0.85)",
              }}
            />
          ))}
        </div>
        <span style={{ color: "var(--asph-text-secondary)" }}>
          More engagement
        </span>
      </div>

      {/* Max engagement note */}
      <div
        className="mt-2 text-right text-xs"
        style={{ color: "var(--asph-text-secondary)" }}
      >
        Peak: {maxVal} avg interactions
      </div>
    </div>
  );
};
