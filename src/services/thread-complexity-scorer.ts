/**
 * ThreadComplexityScorer - Weighted complexity scoring for thread rendering optimization
 *
 * Calculates a complexity score (0-100) based on multiple thread metrics:
 * - Thread depth (nesting level)
 * - Reply count (total posts in thread)
 * - Branch count (number of conversation forks)
 * - Media density (posts with images/videos)
 * - Author diversity (unique participants)
 *
 * The score determines:
 * - How many posts to show initially (progressive reveal threshold)
 * - UI degradation level (simplified rendering for complex threads)
 * - Auto-collapse aggressiveness
 */

import type { AppBskyFeedDefs } from "@atproto/api";
import type { ThreadNode } from "../contexts/ThreadContext";

type Post = AppBskyFeedDefs.PostView;

// ============================================================================
// Types
// ============================================================================

export interface ThreadComplexityScore {
  /** Overall complexity score (0-100) */
  score: number;
  /** Classification based on score thresholds */
  level: ComplexityLevel;
  /** Individual metric scores */
  metrics: ComplexityMetrics;
  /** Recommended initial post count to display */
  initialRevealCount: number;
  /** Recommended "Show more" batch size */
  revealBatchSize: number;
  /** Whether to use simplified rendering */
  useSimplifiedRendering: boolean;
  /** Collapse depth threshold for this thread */
  collapseDepthThreshold: number;
}

export interface ComplexityMetrics {
  depthScore: number;
  replyCountScore: number;
  branchScore: number;
  mediaScore: number;
  authorDiversityScore: number;
}

export type ComplexityLevel = "minimal" | "low" | "medium" | "high" | "extreme";

export interface ComplexityWeights {
  depth: number;
  replyCount: number;
  branches: number;
  media: number;
  authorDiversity: number;
}

export interface ProgressiveRevealConfig {
  /** Initial posts to show */
  initialCount: number;
  /** Posts to add on each "Show more" click */
  batchSize: number;
  /** Maximum posts before mandatory pagination */
  maxBeforePagination: number;
}

// ============================================================================
// Constants
// ============================================================================

/** Default weights for complexity scoring */
const DEFAULT_WEIGHTS: ComplexityWeights = {
  depth: 0.25, // Deep threads are harder to navigate
  replyCount: 0.3, // Main driver of rendering cost
  branches: 0.2, // Branching adds visual complexity
  media: 0.15, // Media content is expensive to render
  authorDiversity: 0.1, // Many authors = harder to follow
};

/** Score thresholds for complexity levels */
const LEVEL_THRESHOLDS = {
  minimal: 20, // Score 0-20
  low: 40, // Score 21-40
  medium: 60, // Score 41-60
  high: 80, // Score 61-80
  extreme: 100, // Score 81-100
};

/** Progressive reveal configurations by complexity level */
const REVEAL_CONFIGS: Record<ComplexityLevel, ProgressiveRevealConfig> = {
  minimal: {
    initialCount: Infinity, // Show all
    batchSize: 10,
    maxBeforePagination: 100,
  },
  low: {
    initialCount: 25,
    batchSize: 15,
    maxBeforePagination: 75,
  },
  medium: {
    initialCount: 15,
    batchSize: 10,
    maxBeforePagination: 50,
  },
  high: {
    initialCount: 10,
    batchSize: 8,
    maxBeforePagination: 30,
  },
  extreme: {
    initialCount: 5,
    batchSize: 5,
    maxBeforePagination: 20,
  },
};

/** Collapse depth thresholds by complexity level */
const COLLAPSE_DEPTH_THRESHOLDS: Record<ComplexityLevel, number> = {
  minimal: Infinity, // Don't auto-collapse
  low: 6,
  medium: 4,
  high: 3,
  extreme: 2,
};

// ============================================================================
// Scoring Functions
// ============================================================================

/**
 * Calculate depth score (0-100)
 * Penalizes deep nesting which is harder to navigate
 */
function calculateDepthScore(maxDepth: number): number {
  // Score increases with depth:
  // 0-2: 0-10 (minimal)
  // 3-5: 10-40 (manageable)
  // 6-10: 40-70 (complex)
  // 11+: 70-100 (extreme)
  if (maxDepth <= 2) return maxDepth * 5;
  if (maxDepth <= 5) return 10 + (maxDepth - 2) * 10;
  if (maxDepth <= 10) return 40 + (maxDepth - 5) * 6;
  return Math.min(100, 70 + (maxDepth - 10) * 3);
}

/**
 * Calculate reply count score (0-100)
 * Main driver of rendering cost
 */
function calculateReplyCountScore(replyCount: number): number {
  // Score increases with count:
  // 0-10: 0-20 (minimal)
  // 11-30: 20-50 (moderate)
  // 31-75: 50-80 (high)
  // 76+: 80-100 (extreme)
  if (replyCount <= 10) return replyCount * 2;
  if (replyCount <= 30) return 20 + (replyCount - 10) * 1.5;
  if (replyCount <= 75) return 50 + (replyCount - 30) * 0.67;
  return Math.min(100, 80 + (replyCount - 75) * 0.27);
}

/**
 * Calculate branch score (0-100)
 * Conversation forks add visual complexity
 */
function calculateBranchScore(branchCount: number): number {
  // Score increases with branches:
  // 0-3: 0-15 (minimal)
  // 4-10: 15-50 (moderate)
  // 11-25: 50-80 (high)
  // 26+: 80-100 (extreme)
  if (branchCount <= 3) return branchCount * 5;
  if (branchCount <= 10) return 15 + (branchCount - 3) * 5;
  if (branchCount <= 25) return 50 + (branchCount - 10) * 2;
  return Math.min(100, 80 + (branchCount - 25) * 0.8);
}

/**
 * Calculate media score (0-100)
 * Media content is expensive to render
 */
function calculateMediaScore(
  postsWithMedia: number,
  totalPosts: number,
): number {
  if (totalPosts === 0) return 0;

  const mediaDensity = postsWithMedia / totalPosts;
  // High media density + high absolute count = high score
  const absoluteScore = Math.min(50, postsWithMedia * 5);
  const densityScore = mediaDensity * 50;

  return Math.min(100, absoluteScore + densityScore);
}

/**
 * Calculate author diversity score (0-100)
 * Many unique authors = harder to follow conversation
 */
function calculateAuthorDiversityScore(
  uniqueAuthors: number,
  totalPosts: number,
): number {
  if (totalPosts <= 1) return 0;

  // Diversity ratio: 1.0 = every post is a different author
  const diversityRatio = uniqueAuthors / totalPosts;

  // High diversity + high absolute count = high score
  const absoluteScore = Math.min(40, uniqueAuthors * 4);
  const ratioScore = diversityRatio * 60;

  return Math.min(100, absoluteScore + ratioScore);
}

/**
 * Determine complexity level from score
 */
function getComplexityLevel(score: number): ComplexityLevel {
  if (score <= LEVEL_THRESHOLDS.minimal) return "minimal";
  if (score <= LEVEL_THRESHOLDS.low) return "low";
  if (score <= LEVEL_THRESHOLDS.medium) return "medium";
  if (score <= LEVEL_THRESHOLDS.high) return "high";
  return "extreme";
}

// ============================================================================
// Main Scoring Functions
// ============================================================================

/**
 * Count posts with media (images, videos, or embedded content)
 */
function countPostsWithMedia(posts: Post[]): number {
  return posts.filter((post) => {
    const embed = post.embed;
    if (!embed) return false;

    const embedType = (embed as { $type?: string }).$type;
    return (
      embedType === "app.bsky.embed.images#view" ||
      embedType === "app.bsky.embed.video#view" ||
      embedType === "app.bsky.embed.recordWithMedia#view"
    );
  }).length;
}

/**
 * Count unique authors in a thread
 */
function countUniqueAuthors(posts: Post[]): number {
  const authors = new Set(posts.map((p) => p.author?.did).filter(Boolean));
  return authors.size;
}

/**
 * Count branch points in a thread tree
 */
function countBranches(nodes: ThreadNode[]): number {
  let count = 0;

  const traverse = (node: ThreadNode) => {
    if (node.children.length > 1) count++;
    node.children.forEach(traverse);
  };

  nodes.forEach(traverse);
  return count;
}

/**
 * Find maximum depth in thread tree
 */
function findMaxDepth(nodes: ThreadNode[]): number {
  let maxDepth = 0;

  const traverse = (node: ThreadNode) => {
    maxDepth = Math.max(maxDepth, node.depth);
    node.children.forEach(traverse);
  };

  nodes.forEach(traverse);
  return maxDepth;
}

/**
 * Calculate thread complexity score from posts array
 */
export function calculateComplexityFromPosts(
  posts: Post[],
  maxDepth: number,
  branchCount: number,
  weights: ComplexityWeights = DEFAULT_WEIGHTS,
): ThreadComplexityScore {
  const replyCount = Math.max(0, posts.length - 1);
  const postsWithMedia = countPostsWithMedia(posts);
  const uniqueAuthors = countUniqueAuthors(posts);

  // Calculate individual metric scores
  const metrics: ComplexityMetrics = {
    depthScore: calculateDepthScore(maxDepth),
    replyCountScore: calculateReplyCountScore(replyCount),
    branchScore: calculateBranchScore(branchCount),
    mediaScore: calculateMediaScore(postsWithMedia, posts.length),
    authorDiversityScore: calculateAuthorDiversityScore(
      uniqueAuthors,
      posts.length,
    ),
  };

  // Calculate weighted score
  const score = Math.round(
    metrics.depthScore * weights.depth +
      metrics.replyCountScore * weights.replyCount +
      metrics.branchScore * weights.branches +
      metrics.mediaScore * weights.media +
      metrics.authorDiversityScore * weights.authorDiversity,
  );

  const level = getComplexityLevel(score);
  const config = REVEAL_CONFIGS[level];

  return {
    score,
    level,
    metrics,
    initialRevealCount: config.initialCount,
    revealBatchSize: config.batchSize,
    useSimplifiedRendering: level === "high" || level === "extreme",
    collapseDepthThreshold: COLLAPSE_DEPTH_THRESHOLDS[level],
  };
}

/**
 * Calculate thread complexity score from thread tree
 */
export function calculateComplexityFromTree(
  nodes: ThreadNode[],
  posts: Post[],
  weights: ComplexityWeights = DEFAULT_WEIGHTS,
): ThreadComplexityScore {
  const maxDepth = findMaxDepth(nodes);
  const branchCount = countBranches(nodes);

  return calculateComplexityFromPosts(posts, maxDepth, branchCount, weights);
}

// ============================================================================
// React Hook
// ============================================================================

/**
 * Custom weights for specific use cases
 */
export const PERFORMANCE_FOCUSED_WEIGHTS: ComplexityWeights = {
  depth: 0.15,
  replyCount: 0.45, // Prioritize render count
  branches: 0.15,
  media: 0.2, // Media is expensive
  authorDiversity: 0.05,
};

export const NAVIGATION_FOCUSED_WEIGHTS: ComplexityWeights = {
  depth: 0.35, // Prioritize navigation complexity
  replyCount: 0.2,
  branches: 0.3, // Many branches = confusing navigation
  media: 0.05,
  authorDiversity: 0.1,
};

/**
 * Hook to calculate thread complexity with memoization
 * Use in components that need complexity-based rendering decisions
 */
export function useThreadComplexityScore(
  posts: Post[],
  maxDepth: number,
  branchCount: number,
  weights: ComplexityWeights = DEFAULT_WEIGHTS,
): ThreadComplexityScore {
  // Calculate once per input change
  return calculateComplexityFromPosts(posts, maxDepth, branchCount, weights);
}

/**
 * Get recommended settings for progressive reveal based on complexity
 */
export function getProgressiveRevealSettings(
  complexityScore: ThreadComplexityScore,
): ProgressiveRevealConfig {
  return REVEAL_CONFIGS[complexityScore.level];
}

/**
 * Determine if a specific node should be collapsed based on complexity score
 */
export function shouldCollapseNode(
  node: ThreadNode,
  complexityScore: ThreadComplexityScore,
  screenSize: "mobile" | "tablet" | "desktop" = "desktop",
): boolean {
  // Mobile is more aggressive with collapsing
  const depthAdjustment =
    screenSize === "mobile" ? -1 : screenSize === "tablet" ? 0 : 1;

  const effectiveThreshold = Math.max(
    1,
    complexityScore.collapseDepthThreshold + depthAdjustment,
  );

  return node.depth >= effectiveThreshold && node.children.length > 0;
}
