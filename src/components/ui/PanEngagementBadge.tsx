import { Activity } from "lucide-react";
import React, { useMemo } from "react";
import {
  PAN_ENGAGEMENT_LABELS,
  isPanLabel,
  type PanLabelConfig,
} from "../../config/pan-labeler";
import { Tooltip } from "./Tooltip";

interface PanEngagementBadgeProps {
  labels: Array<{ val: string; src?: string }>;
}

export const PanEngagementBadge: React.FC<PanEngagementBadgeProps> = ({
  labels,
}) => {
  const panLabels = useMemo(() => {
    if (!labels || labels.length === 0) return [];
    return labels
      .filter(isPanLabel)
      .map((l) => ({
        val: l.val,
        config: PAN_ENGAGEMENT_LABELS[l.val],
      }))
      .filter((l): l is { val: string; config: PanLabelConfig } => !!l.config);
  }, [labels]);

  if (panLabels.length === 0) return null;

  const hasDisruptive = panLabels.some(
    (l) => l.config.category === "disruptive",
  );
  const hasConstructive = panLabels.some(
    (l) => l.config.category === "constructive",
  );

  // Color based on label mix
  let pillColor: string;
  let pillBg: string;
  let pillBorder: string;
  if (hasDisruptive && hasConstructive) {
    // Mixed
    pillColor = "#d97706";
    pillBg = "rgba(217, 119, 6, 0.1)";
    pillBorder = "rgba(217, 119, 6, 0.3)";
  } else if (hasDisruptive) {
    pillColor = "#dc2626";
    pillBg = "rgba(220, 38, 38, 0.1)";
    pillBorder = "rgba(220, 38, 38, 0.3)";
  } else {
    pillColor = "#059669";
    pillBg = "rgba(5, 150, 105, 0.1)";
    pillBorder = "rgba(5, 150, 105, 0.3)";
  }

  const tooltipContent = (
    <div className="space-y-1.5">
      {panLabels.map(({ val, config }) => (
        <div key={val} className="flex items-start gap-2">
          <span
            className="mt-0.5 inline-block h-2 w-2 flex-shrink-0 rounded-full"
            style={{ backgroundColor: config.color }}
          />
          <div>
            <span className="font-medium" style={{ color: config.color }}>
              {config.displayName}
            </span>
            <span className="ml-1 opacity-80">{config.description}</span>
          </div>
        </div>
      ))}
      <div
        className="mt-1 border-t pt-1 text-xs opacity-60"
        style={{ borderColor: "rgba(255,255,255,0.15)" }}
      >
        Powered by pan engagement analysis
      </div>
    </div>
  );

  return (
    <Tooltip content={tooltipContent} delay={200}>
      <span
        className="inline-flex cursor-default items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-all hover:scale-105"
        style={{
          color: pillColor,
          backgroundColor: pillBg,
          border: `1px solid ${pillBorder}`,
        }}
      >
        <Activity size={12} />
        <span>Engagement</span>
      </span>
    </Tooltip>
  );
};
