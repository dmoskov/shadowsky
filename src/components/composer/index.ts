/**
 * Composer module exports
 * Progressive disclosure architecture for the post composer
 *
 * Architecture:
 * - Level 1 (Primary): Always visible - ComposerTextArea, ComposerMediaUpload
 * - Level 2 (Standard): Expandable - ComposerThreadPreview, ComposerSettings
 * - Level 3 (Advanced): Expandable - ComposerAIFeatures
 * - ComposerToolbar: Orchestrates section visibility
 */

// Types and constants
export * from "./types";

// Utility functions
export * from "./utils";

// Performance benchmarking (development only)
export {
  areBenchmarksEnabled,
  benchmarkNumberingApplication,
  benchmarkTextSplitting,
  disableComposerBenchmarks,
  enableComposerBenchmarks,
  generateReport,
  trackRender,
  useRenderTimer,
} from "./performance";

// Hooks
export { useComposerState } from "./useComposerState";
export type { UseComposerStateReturn } from "./useComposerState";

export {
  shouldEnableProgressiveDisclosure,
  useComposerFeatureFlags,
} from "./useComposerFeatureFlags";
export type { UseComposerFeatureFlagsReturn } from "./useComposerFeatureFlags";

// Level 1 (Primary) Components - Always visible
export { ComposerMediaUpload } from "./ComposerMediaUpload";
export { ComposerTextArea } from "./ComposerTextArea";

// Level 2 (Standard) Components - Expandable
export { ComposerSettings } from "./ComposerSettings";
export { ComposerThreadPreview } from "./ComposerThreadPreview";

// Level 3 (Advanced) Components - Expandable
export { ComposerAIFeatures } from "./ComposerAIFeatures";

// Toolbar - Orchestrates visibility
export { ComposerToolbar } from "./ComposerToolbar";
