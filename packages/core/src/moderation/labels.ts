/**
 * Content Label Utilities
 *
 * Utilities for parsing, interpreting, and displaying AT Protocol content labels.
 * Handles label severity, user preferences, and display text for content warnings.
 */

/**
 * Minimal structural label shape accepted by the evaluation helpers.
 * ComAtprotoLabelDefs.Label is assignable; platforms may also pass plain
 * `{ val }` objects.
 */
export interface LabelLike {
  val: string;
  src?: string;
}

/**
 * Label types with user-configurable filter preferences.
 * The union of the label vocabularies previously implemented separately by
 * web (6 types) and mobile (10 types).
 */
export type FilterableLabelType =
  | "porn"
  | "sexual"
  | "nudity"
  | "graphic-media"
  | "gore"
  | "nsfl"
  | "spam"
  | "impersonation"
  | "scam"
  | "misleading";

/**
 * Label types supported by AT Protocol ("unknown" is the fallback for
 * unrecognized label values; it is never hidden/warned via preferences)
 */
export type LabelType = FilterableLabelType | "unknown";

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
export type ContentFilterPreferences = Record<
  FilterableLabelType,
  LabelPreference
>;

/**
 * Default content filter preferences (conservative defaults)
 */
export const DEFAULT_CONTENT_FILTER_PREFERENCES: ContentFilterPreferences = {
  porn: "hide",
  sexual: "warn",
  nudity: "warn",
  "graphic-media": "warn",
  gore: "warn",
  nsfl: "hide",
  spam: "hide",
  impersonation: "warn",
  scam: "warn",
  misleading: "warn",
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
  gore: {
    displayName: "Gore",
    description: "Gory or disturbing imagery",
    defaultSeverity: "warn",
    icon: "⚠️",
  },
  nsfl: {
    displayName: "NSFL",
    description: "Extremely disturbing content",
    defaultSeverity: "hide",
    icon: "🚫",
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
  scam: {
    displayName: "Scam",
    description: "Fraudulent or deceptive content",
    defaultSeverity: "warn",
    icon: "⚠️",
  },
  misleading: {
    displayName: "Misleading",
    description: "Misleading or false information",
    defaultSeverity: "warn",
    icon: "⚠️",
  },
  unknown: {
    displayName: "Sensitive Content",
    description: "Content flagged by moderators",
    defaultSeverity: "warn",
    icon: "⚠️",
  },
};

const FILTERABLE_LABEL_TYPES: readonly FilterableLabelType[] = [
  "porn",
  "sexual",
  "nudity",
  "graphic-media",
  "gore",
  "nsfl",
  "spam",
  "impersonation",
  "scam",
  "misleading",
];

/**
 * Parse a label value into a LabelType
 */
export function parseLabelType(val: string): LabelType {
  const normalized = val.toLowerCase();
  if ((FILTERABLE_LABEL_TYPES as readonly string[]).includes(normalized)) {
    return normalized as FilterableLabelType;
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
  labels: LabelLike[] | undefined,
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
  labels: LabelLike[] | undefined,
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
  labels: LabelLike[] | undefined,
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
  labels: LabelLike[] | undefined,
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
export function getContentWarningText(labels: LabelLike[] | undefined): string {
  const mostSevere = getMostSevereLabel(labels);
  if (!mostSevere) return "Sensitive Content";

  const metadata = getLabelMetadata(mostSevere);
  return metadata.displayName;
}

/**
 * Get detailed description for a content warning
 */
export function getContentWarningDescription(
  labels: LabelLike[] | undefined,
): string {
  const mostSevere = getMostSevereLabel(labels);
  if (!mostSevere) return "This content may be sensitive";

  const metadata = getLabelMetadata(mostSevere);
  return metadata.description;
}

/**
 * Get icon for a content warning
 */
export function getContentWarningIcon(labels: LabelLike[] | undefined): string {
  const mostSevere = getMostSevereLabel(labels);
  if (!mostSevere) return "⚠️";

  const metadata = getLabelMetadata(mostSevere);
  return metadata.icon;
}

/**
 * Check if an author has labels (account-level warnings)
 */
export function hasAuthorLabels(
  authorLabels: LabelLike[] | undefined,
): boolean {
  return !!authorLabels && authorLabels.length > 0;
}

/**
 * Get warning text for author labels
 */
export function getAuthorWarningText(
  authorLabels: LabelLike[] | undefined,
): string {
  if (!authorLabels || authorLabels.length === 0) {
    return "Account Warning";
  }

  const labelType = parseLabelType(authorLabels[0].val);
  const metadata = getLabelMetadata(labelType);
  return `Account: ${metadata.displayName}`;
}
