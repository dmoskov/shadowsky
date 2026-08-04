/**
 * Centralized Model Configuration
 *
 * Provides a single source of truth for Anthropic model names used across
 * all Lambda handlers. This makes it easy to update models across the
 * entire application.
 */

/**
 * Available Anthropic models
 *
 * Update these values when upgrading to newer model versions.
 * All handlers using MODELS will automatically use the new versions.
 */
export const MODELS = {
  /** Claude Sonnet - balanced performance and cost, good for most tasks */
  SONNET: 'claude-sonnet-5',

  /** Claude Haiku - fastest and most cost-effective, good for simpler tasks */
  HAIKU: 'claude-haiku-4-5',

  /** Claude Opus - most capable, best for complex reasoning tasks */
  OPUS: 'claude-opus-4-8',
} as const;

export type ModelName = (typeof MODELS)[keyof typeof MODELS];

/**
 * Default token limits for different model tiers
 * These are recommended starting points - adjust per handler as needed
 */
export const DEFAULT_MAX_TOKENS = {
  /** Default for Sonnet - balanced output length */
  SONNET: 1000,

  /** Default for Haiku - shorter responses */
  HAIKU: 500,

  /** Default for Opus - longer, more detailed responses */
  OPUS: 2000,
} as const;

/**
 * Model recommendations by use case
 */
export const MODEL_RECOMMENDATIONS = {
  /** Quick suggestions, hashtags, simple analysis */
  QUICK_SUGGESTIONS: MODELS.SONNET,

  /** Thread summaries, content analysis */
  CONTENT_ANALYSIS: MODELS.SONNET,

  /** Tone adjustment, writing feedback */
  WRITING_ASSISTANCE: MODELS.SONNET,

  /** Complex multi-step analysis, style matching */
  COMPLEX_ANALYSIS: MODELS.SONNET,

  /** Image alt-text generation */
  IMAGE_ANALYSIS: MODELS.SONNET,
} as const;
