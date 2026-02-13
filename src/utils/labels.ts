/**
 * Content Label Utilities
 *
 * Utilities for parsing, interpreting, and displaying AT Protocol content labels.
 * Handles label severity, user preferences, and display text for content warnings.
 */

import type { ComAtprotoLabelDefs } from "@atproto/api";

/**
 * Label types supported by AT Protocol
 */
export type LabelType =
  | "porn"
  | "sexual"
  | "nudity"
  | "graphic-media"
  | "spam"
  | "impersonation"
  | "unknown";

/**
 * Label severity levels
 * - blur: Show with blur effect, tap to reveal
 * - warn: Show with content warning overlay
 * - hide: Completely hide content
 */
export type LabelSeverity = "blur" | "warn" | "hide";

/**
 * User preference for handling each label type
 */
export type LabelPreference = "show" | "warn" | "hide";

/**
 * Content filter preferences for all label types
 */
export interface ContentFilterPreferences {
  porn: LabelPreference;
  sexual: LabelPreference;
  nudity: LabelPreference;
  "graphic-media": LabelPreference;
  spam: LabelPreference;
  impersonation: LabelPreference;
}

/**
 * Default content filter preferences (conservative defaults)
 */
export const DEFAULT_CONTENT_FILTER_PREFERENCES: ContentFilterPreferences = {
  porn: "hide",
  sexual: "warn",
  nudity: "warn",
  "graphic-media": "warn",
  spam: "hide",
  impersonation: "warn",
};

/**
 * Label metadata including display text and default severity
 */
interface LabelMetadata {
  displayName: string;
  description: string;
  defaultSeverity: LabelSeverity;
  icon: string;
}

/**
 * Metadata for each label type
 */
const LABEL_METADATA: Record<LabelType, LabelMetadata> = {
  porn: {
    displayName: "Adult Content",
    description: "Pornographic or sexually explicit content",
    defaultSeverity: "hide",
    icon: "🔞",
  },
  sexual: {
    displayName: "Sexually Suggestive",
    description: "Sexually suggestive content",
    defaultSeverity: "warn",
    icon: "⚠️",
  },
  nudity: {
    displayName: "Nudity",
    description: "Non-sexual nudity",
    defaultSeverity: "warn",
    icon: "👁️",
  },
  "graphic-media": {
    displayName: "Graphic Media",
    description: "Graphic or violent content",
    defaultSeverity: "warn",
    icon: "⚠️",
  },
  spam: {
    displayName: "Spam",
    description: "Spam or misleading content",
    defaultSeverity: "hide",
    icon: "🚫",
  },
  impersonation: {
    displayName: "Impersonation",
    description: "Account impersonating someone else",
    defaultSeverity: "warn",
    icon: "⚠️",
  },
  unknown: {
    displayName: "Flagged Content",
    description: "Content flagged by moderators",
    defaultSeverity: "warn",
    icon: "⚠️",
  },
};

/**
 * Parse a label value into a LabelType
 */
export function parseLabelType(val: string): LabelType {
  const normalized = val.toLowerCase();
  if (
    normalized === "porn" ||
    normalized === "sexual" ||
    normalized === "nudity" ||
    normalized === "graphic-media" ||
    normalized === "spam" ||
    normalized === "impersonation"
  ) {
    return normalized;
  }
  return "unknown";
}

/**
 * Get metadata for a label type
 */
export function getLabelMetadata(labelType: LabelType): LabelMetadata {
  return LABEL_METADATA[labelType];
}

/**
 * Get the most severe label from a list of labels
 */
export function getMostSevereLabel(
  labels: ComAtprotoLabelDefs.Label[] | undefined,
): LabelType | null {
  if (!labels || labels.length === 0) return null;

  const severityOrder: Record<LabelSeverity, number> = {
    hide: 3,
    warn: 2,
    blur: 1,
  };

  let mostSevere: LabelType | null = null;
  let highestSeverity = 0;

  for (const label of labels) {
    const labelType = parseLabelType(label.val);
    const metadata = getLabelMetadata(labelType);
    const severity = severityOrder[metadata.defaultSeverity];

    if (severity > highestSeverity) {
      highestSeverity = severity;
      mostSevere = labelType;
    }
  }

  return mostSevere;
}

/**
 * Labeler-specific label preference (for third-party labelers)
 */
export interface LabelerLabelPreference {
  labelerDid: string;
  label: string;
  visibility: "show" | "warn" | "hide";
}

/**
 * Check if content should be hidden based on labels and preferences
 * Now supports both native labels and third-party labeler labels
 */
export function shouldHideContent(
  labels: ComAtprotoLabelDefs.Label[] | undefined,
  preferences: ContentFilterPreferences,
  labelerPreferences?: LabelerLabelPreference[],
): boolean {
  if (!labels || labels.length === 0) return false;

  for (const label of labels) {
    // Check for labeler-specific preference first
    if (label.src && labelerPreferences) {
      const labelerPref = labelerPreferences.find(
        (p) => p.labelerDid === label.src && p.label === label.val,
      );
      if (labelerPref && labelerPref.visibility === "hide") return true;
    }

    // Fall back to native label preferences
    const labelType = parseLabelType(label.val);
    if (labelType !== "unknown") {
      const preference = preferences[labelType];
      if (preference === "hide") return true;
    }
  }

  return false;
}

/**
 * Check if content should show a warning based on labels and preferences
 * Now supports both native labels and third-party labeler labels
 */
export function shouldWarnContent(
  labels: ComAtprotoLabelDefs.Label[] | undefined,
  preferences: ContentFilterPreferences,
  labelerPreferences?: LabelerLabelPreference[],
): boolean {
  if (!labels || labels.length === 0) return false;

  for (const label of labels) {
    // Check for labeler-specific preference first
    if (label.src && labelerPreferences) {
      const labelerPref = labelerPreferences.find(
        (p) => p.labelerDid === label.src && p.label === label.val,
      );
      if (labelerPref && labelerPref.visibility === "warn") return true;
    }

    // Fall back to native label preferences
    const labelType = parseLabelType(label.val);
    if (labelType !== "unknown") {
      const preference = preferences[labelType];
      if (preference === "warn") return true;
    }
  }

  return false;
}

/**
 * Check if images should be blurred based on labels and preferences
 * Now supports both native labels and third-party labeler labels
 */
export function shouldBlurImages(
  labels: ComAtprotoLabelDefs.Label[] | undefined,
  preferences: ContentFilterPreferences,
  labelerPreferences?: LabelerLabelPreference[],
): boolean {
  if (!labels || labels.length === 0) return false;

  // Blur images for warn or hide preferences
  for (const label of labels) {
    // Check for labeler-specific preference first
    if (label.src && labelerPreferences) {
      const labelerPref = labelerPreferences.find(
        (p) => p.labelerDid === label.src && p.label === label.val,
      );
      if (
        labelerPref &&
        (labelerPref.visibility === "warn" || labelerPref.visibility === "hide")
      ) {
        return true;
      }
    }

    // Fall back to native label preferences
    const labelType = parseLabelType(label.val);
    if (labelType !== "unknown") {
      const preference = preferences[labelType];
      if (preference === "warn" || preference === "hide") return true;
    }
  }

  return false;
}

/**
 * Get display text for a content warning
 */
export function getContentWarningText(
  labels: ComAtprotoLabelDefs.Label[] | undefined,
): string {
  const mostSevere = getMostSevereLabel(labels);
  if (!mostSevere) return "Sensitive Content";

  const metadata = getLabelMetadata(mostSevere);
  return metadata.displayName;
}

/**
 * Get detailed description for a content warning
 */
export function getContentWarningDescription(
  labels: ComAtprotoLabelDefs.Label[] | undefined,
): string {
  const mostSevere = getMostSevereLabel(labels);
  if (!mostSevere) return "This content may be sensitive";

  const metadata = getLabelMetadata(mostSevere);
  return metadata.description;
}

/**
 * Get icon for a content warning
 */
export function getContentWarningIcon(
  labels: ComAtprotoLabelDefs.Label[] | undefined,
): string {
  const mostSevere = getMostSevereLabel(labels);
  if (!mostSevere) return "⚠️";

  const metadata = getLabelMetadata(mostSevere);
  return metadata.icon;
}

/**
 * Check if an author has labels (account-level warnings)
 */
export function hasAuthorLabels(
  authorLabels: ComAtprotoLabelDefs.Label[] | undefined,
): boolean {
  return !!authorLabels && authorLabels.length > 0;
}

/**
 * Get warning text for author labels
 */
export function getAuthorWarningText(
  authorLabels: ComAtprotoLabelDefs.Label[] | undefined,
): string {
  if (!authorLabels || authorLabels.length === 0) {
    return "Account Warning";
  }

  const labelType = parseLabelType(authorLabels[0].val);
  const metadata = getLabelMetadata(labelType);
  return `Account: ${metadata.displayName}`;
}
