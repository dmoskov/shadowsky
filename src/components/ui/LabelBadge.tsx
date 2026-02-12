import { AlertTriangle, Eye, EyeOff, Flag, Shield, X } from "lucide-react";
import React from "react";
import { Tooltip } from "./Tooltip";

/**
 * AT Protocol Label Structure
 * Labels are applied by moderators or automated systems to flag content
 */
export interface Label {
  val: string; // The label value (e.g., "spam", "porn", "sexual")
  src?: string; // Source DID of labeler
  uri?: string; // URI of the labeled content
  cid?: string; // CID of the labeled content
  neg?: boolean; // Whether this is a negation (removal) of a label
}

/**
 * Label types and their display properties
 */
export const LABEL_DEFINITIONS: Record<
  string,
  {
    label: string;
    icon: React.ReactNode;
    color: string;
    bgColor: string;
    borderColor: string;
    description: string;
    severity: "info" | "warning" | "error";
    isContentWarning?: boolean;
  }
> = {
  // Adult Content Labels
  porn: {
    label: "Adult Content",
    icon: <EyeOff size={12} />,
    color: "#dc2626",
    bgColor: "rgba(220, 38, 38, 0.1)",
    borderColor: "rgba(220, 38, 38, 0.3)",
    description: "Contains adult/pornographic content",
    severity: "error",
    isContentWarning: true,
  },
  sexual: {
    label: "Sexual Content",
    icon: <EyeOff size={12} />,
    color: "#ea580c",
    bgColor: "rgba(234, 88, 12, 0.1)",
    borderColor: "rgba(234, 88, 12, 0.3)",
    description: "Contains sexual content",
    severity: "error",
    isContentWarning: true,
  },
  nudity: {
    label: "Nudity",
    icon: <Eye size={12} />,
    color: "#ea580c",
    bgColor: "rgba(234, 88, 12, 0.1)",
    borderColor: "rgba(234, 88, 12, 0.3)",
    description: "Contains nudity",
    severity: "warning",
    isContentWarning: true,
  },
  "graphic-media": {
    label: "Graphic Content",
    icon: <AlertTriangle size={12} />,
    color: "#dc2626",
    bgColor: "rgba(220, 38, 38, 0.1)",
    borderColor: "rgba(220, 38, 38, 0.3)",
    description: "Contains graphic violence or disturbing imagery",
    severity: "error",
    isContentWarning: true,
  },

  // Spam and Manipulation
  spam: {
    label: "Spam",
    icon: <X size={12} />,
    color: "#9333ea",
    bgColor: "rgba(147, 51, 234, 0.1)",
    borderColor: "rgba(147, 51, 234, 0.3)",
    description: "Flagged as spam",
    severity: "warning",
  },
  impersonation: {
    label: "Impersonation",
    icon: <Shield size={12} />,
    color: "#dc2626",
    bgColor: "rgba(220, 38, 38, 0.1)",
    borderColor: "rgba(220, 38, 38, 0.3)",
    description: "Account may be impersonating someone",
    severity: "error",
  },
  scam: {
    label: "Scam",
    icon: <Flag size={12} />,
    color: "#dc2626",
    bgColor: "rgba(220, 38, 38, 0.1)",
    borderColor: "rgba(220, 38, 38, 0.3)",
    description: "Flagged as potential scam",
    severity: "error",
  },

  // Misinformation
  misleading: {
    label: "Misleading",
    icon: <AlertTriangle size={12} />,
    color: "#f59e0b",
    bgColor: "rgba(245, 158, 11, 0.1)",
    borderColor: "rgba(245, 158, 11, 0.3)",
    description: "May contain misleading information",
    severity: "warning",
  },

  // Generic content warnings
  "!hide": {
    label: "Hidden",
    icon: <EyeOff size={12} />,
    color: "#6b7280",
    bgColor: "rgba(107, 114, 128, 0.1)",
    borderColor: "rgba(107, 114, 128, 0.3)",
    description: "Content hidden by moderation",
    severity: "info",
  },
  "!warn": {
    label: "Warning",
    icon: <AlertTriangle size={12} />,
    color: "#f59e0b",
    bgColor: "rgba(245, 158, 11, 0.1)",
    borderColor: "rgba(245, 158, 11, 0.3)",
    description: "Content has a warning",
    severity: "warning",
  },
};

/**
 * Check if a label should trigger content blurring/hiding
 */
export const isContentWarningLabel = (label: Label | string): boolean => {
  const val = typeof label === "string" ? label : label.val;
  const def = LABEL_DEFINITIONS[val];
  return def?.isContentWarning === true;
};

/**
 * Get all content warning labels from a list
 */
export const getContentWarningLabels = (
  labels?: Array<Label | { val: string }>,
): string[] => {
  if (!labels || labels.length === 0) return [];
  return labels
    .map((label) => (typeof label === "object" ? label.val : label))
    .filter((val) => isContentWarningLabel(val));
};

/**
 * Get human-readable text for content warnings
 */
export const getContentWarningText = (
  labels?: Array<Label | { val: string }>,
): string => {
  const warningLabels = getContentWarningLabels(labels);
  if (warningLabels.length === 0) return "Sensitive Content";

  for (const val of warningLabels) {
    const def = LABEL_DEFINITIONS[val];
    if (def) return def.label;
  }

  return "Sensitive Content";
};

interface LabelBadgeProps {
  labels: Array<Label | { val: string }>;
  maxDisplay?: number;
  size?: "sm" | "md" | "lg";
  showContentWarningsOnly?: boolean;
  className?: string;
}

/**
 * LabelBadge Component
 * Displays AT Protocol moderation labels on posts and profiles
 */
export const LabelBadge: React.FC<LabelBadgeProps> = ({
  labels,
  maxDisplay = 3,
  size = "sm",
  showContentWarningsOnly = false,
  className = "",
}) => {
  if (!labels || labels.length === 0) return null;

  // Filter and deduplicate labels
  const uniqueLabels = Array.from(
    new Set(
      labels.map((label) =>
        typeof label === "object" ? label.val : (label as string),
      ),
    ),
  );

  // Filter to content warnings only if requested
  const displayLabels = showContentWarningsOnly
    ? uniqueLabels.filter((val) => isContentWarningLabel(val))
    : uniqueLabels;

  if (displayLabels.length === 0) return null;

  // Limit number of displayed labels
  const visibleLabels = displayLabels.slice(0, maxDisplay);
  const remainingCount = displayLabels.length - visibleLabels.length;

  // Size classes
  const sizeClasses = {
    sm: "text-xs px-2 py-0.5 gap-1",
    md: "text-sm px-2.5 py-1 gap-1.5",
    lg: "text-base px-3 py-1.5 gap-2",
  };

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {visibleLabels.map((val) => {
        const def = LABEL_DEFINITIONS[val] || LABEL_DEFINITIONS["!warn"] || {};
        return (
          <Tooltip
            key={val}
            content={def.description || `Label: ${val}`}
            delay={300}
          >
            <span
              className={`inline-flex items-center rounded-full font-medium transition-all hover:scale-105 ${sizeClasses[size]}`}
              style={{
                color: def.color || "#6b7280",
                backgroundColor: def.bgColor || "rgba(107, 114, 128, 0.1)",
                border: `1px solid ${def.borderColor || "rgba(107, 114, 128, 0.3)"}`,
              }}
            >
              {def.icon}
              <span>{def.label || val}</span>
            </span>
          </Tooltip>
        );
      })}
      {remainingCount > 0 && (
        <Tooltip
          content={`${remainingCount} more label${remainingCount > 1 ? "s" : ""}`}
          delay={300}
        >
          <span
            className={`inline-flex items-center rounded-full font-medium ${sizeClasses[size]}`}
            style={{
              color: "var(--asph-text-secondary)",
              backgroundColor: "var(--asph-bg-tertiary)",
              border: "1px solid var(--asph-border-primary)",
            }}
          >
            +{remainingCount}
          </span>
        </Tooltip>
      )}
    </div>
  );
};

/**
 * Compact label indicator - shows just a colored dot with count
 */
export const LabelIndicator: React.FC<{
  labels: Array<Label | { val: string }>;
  showContentWarningsOnly?: boolean;
}> = ({ labels, showContentWarningsOnly = false }) => {
  if (!labels || labels.length === 0) return null;

  const uniqueLabels = Array.from(
    new Set(
      labels.map((label) =>
        typeof label === "object" ? label.val : (label as string),
      ),
    ),
  );

  const displayLabels = showContentWarningsOnly
    ? uniqueLabels.filter((val) => isContentWarningLabel(val))
    : uniqueLabels;

  if (displayLabels.length === 0) return null;

  // Get the highest severity label for color
  let highestSeverity: "info" | "warning" | "error" = "info";
  for (const val of displayLabels) {
    const def = LABEL_DEFINITIONS[val];
    if (def?.severity === "error") {
      highestSeverity = "error";
      break;
    }
    if (def?.severity === "warning") {
      highestSeverity = "warning";
    }
  }

  const severityColors = {
    info: "#6b7280",
    warning: "#f59e0b",
    error: "#dc2626",
  };

  // Create a detailed tooltip with all label descriptions
  const tooltipContent = displayLabels
    .map((val) => {
      const def = LABEL_DEFINITIONS[val];
      return def ? `${def.label}: ${def.description}` : val;
    })
    .join("\n");

  return (
    <Tooltip content={tooltipContent} delay={300}>
      <div
        className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
        style={{
          backgroundColor: `${severityColors[highestSeverity]}20`,
          color: severityColors[highestSeverity],
          border: `1px solid ${severityColors[highestSeverity]}40`,
        }}
      >
        <Shield size={10} />
        <span>{displayLabels.length}</span>
      </div>
    </Tooltip>
  );
};
