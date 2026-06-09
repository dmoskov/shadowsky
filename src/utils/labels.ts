/**
 * Content Label Utilities
 *
 * Migrated to @bsky/core (packages/core/src/moderation/labels.ts) so the
 * moderation policy logic is single-sourced across web and mobile. This
 * module re-exports for existing import paths.
 */

export {
  type LabelType,
  type LabelSeverity,
  type LabelPreference,
  type ContentFilterPreferences,
  type LabelerLabelPreference,
  DEFAULT_CONTENT_FILTER_PREFERENCES,
  parseLabelType,
  getLabelMetadata,
  getMostSevereLabel,
  shouldHideContent,
  shouldWarnContent,
  shouldBlurImages,
  getContentWarningText,
  getContentWarningDescription,
  getContentWarningIcon,
  hasAuthorLabels,
  getAuthorWarningText,
} from "@bsky/core";
