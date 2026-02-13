import React from "react";
import { getTimeOfDayColor } from "./TimelineVisuals";
import { DayGroup } from "./types";

interface DayGroupHeaderProps {
  dayGroup: DayGroup;
  isInSkyDeck: boolean;
  dayGroupColors: Map<string, { color: string; position: number }>;
}

export const DayGroupHeader: React.FC<DayGroupHeaderProps> = ({
  dayGroup,
  isInSkyDeck,
  dayGroupColors,
}) => {
  return (
    <div
      className={`mb-2 px-4 py-1.5 backdrop-blur-md sm:px-6 ${!isInSkyDeck ? "timeline-sticky-banner" : "sticky"}`}
      style={{
        ...(isInSkyDeck
          ? {
              position: "sticky",
              WebkitPosition: "-webkit-sticky",
              top: "0",
              zIndex: 30,
            }
          : {}),
        backgroundColor: "var(--asph-bg-primary)",
        borderBottom: "1px solid var(--asph-border-primary)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
        // iOS Safari fixes
        transform: "translateZ(0)",
        willChange: "transform",
      }}
    >
      <div className="flex items-center gap-2">
        <div
          className="h-2 w-2 rounded-full transition-all duration-700 ease-out"
          style={{
            backgroundColor: dayGroupColors.get(dayGroup.label)?.color
              ? dayGroupColors
                  .get(dayGroup.label)!
                  .color.replace(/[\d.]+\)$/, "1)")
              : dayGroup.events.length > 0
                ? getTimeOfDayColor(
                    dayGroup.events[0].time,
                  ).borderColor.replace(/[\d.]+\)$/, "1)")
                : "var(--asph-primary)",
            boxShadow: dayGroupColors.get(dayGroup.label)?.color
              ? `0 0 8px ${dayGroupColors.get(dayGroup.label)!.color.replace(/[\d.]+\)$/, "0.4)")}`
              : "none",
            transform: "scale(1)",
          }}
        />
        <h2
          className="text-sm font-semibold uppercase tracking-wide"
          style={{ color: "var(--asph-text-secondary)" }}
        >
          {dayGroup.label}
        </h2>
      </div>
    </div>
  );
};
