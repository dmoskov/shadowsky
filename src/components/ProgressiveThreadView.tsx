/**
 * ProgressiveThreadView - Thread viewer that adapts UI complexity to match thread complexity
 *
 * Philosophy: Show minimal chrome for simple threads, progressively reveal features
 * as threads become more complex. This reduces cognitive load for simple conversations
 * while providing powerful navigation tools for viral threads.
 *
 * Complexity Tiers:
 * - minimal (0-2 replies): Just the post, no summary
 * - simple (3-9 replies): Post + basic replies, brief TL;DR
 * - moderate (10-29 replies): + participant avatars, branch hints, 2-3 sentence summary
 * - complex (30-74 replies): + analytics badge, collapse controls, paragraph summary
 * - viral (75+ replies): Full chrome with minimap, navigation, detailed summary
 */

import type { AppBskyFeedDefs } from "@atproto/api";
import { BarChart3, GitBranch, Users } from "lucide-react";
import React, { useMemo } from "react";
import {
  calculateComplexityFromPosts,
  type ThreadComplexityScore,
} from "../services/thread-complexity-scorer";
import { ProgressiveThreadSummary } from "./ProgressiveThreadSummary";
import { ThreadEngagementAnalytics } from "./ThreadEngagementAnalytics";
import { ThreadMinimap } from "./ThreadMinimap";
import { ThreadViewer, type ThreadViewerProps } from "./ThreadViewer";
import { ThrottledAvatar } from "./ui/ThrottledAvatar";

type Post = AppBskyFeedDefs.PostView;

// Complexity tier thresholds based on reply count
export type ComplexityTier =
  | "minimal"
  | "simple"
  | "moderate"
  | "complex"
  | "viral";

export interface ComplexityTierConfig {
  tier: ComplexityTier;
  replyThreshold: number;
  showSummary: boolean;
  summaryDepth: "none" | "brief" | "moderate" | "detailed" | "comprehensive";
  showParticipants: boolean;
  showBranchIndicators: boolean;
  showCollapseControls: boolean;
  showAnalyticsBadge: boolean;
  showMinimap: boolean;
  showContextBar: boolean;
  showEngagementAnalytics: boolean;
}

const TIER_CONFIGS: Record<ComplexityTier, ComplexityTierConfig> = {
  minimal: {
    tier: "minimal",
    replyThreshold: 0,
    showSummary: false,
    summaryDepth: "none",
    showParticipants: false,
    showBranchIndicators: false,
    showCollapseControls: false,
    showAnalyticsBadge: false,
    showMinimap: false,
    showContextBar: false,
    showEngagementAnalytics: false,
  },
  simple: {
    tier: "simple",
    replyThreshold: 3,
    showSummary: true,
    summaryDepth: "brief",
    showParticipants: false,
    showBranchIndicators: false,
    showCollapseControls: false,
    showAnalyticsBadge: false,
    showMinimap: false,
    showContextBar: false,
    showEngagementAnalytics: false,
  },
  moderate: {
    tier: "moderate",
    replyThreshold: 10,
    showSummary: true,
    summaryDepth: "moderate",
    showParticipants: true,
    showBranchIndicators: true,
    showCollapseControls: false,
    showAnalyticsBadge: false,
    showMinimap: true, // Show minimap starting at 10+ replies
    showContextBar: false,
    showEngagementAnalytics: false,
  },
  complex: {
    tier: "complex",
    replyThreshold: 30,
    showSummary: true,
    summaryDepth: "detailed",
    showParticipants: true,
    showBranchIndicators: true,
    showCollapseControls: true,
    showAnalyticsBadge: true,
    showMinimap: false,
    showContextBar: true,
    showEngagementAnalytics: false,
  },
  viral: {
    tier: "viral",
    replyThreshold: 75,
    showSummary: true,
    summaryDepth: "comprehensive",
    showParticipants: true,
    showBranchIndicators: true,
    showCollapseControls: true,
    showAnalyticsBadge: true,
    showMinimap: true,
    showContextBar: true,
    showEngagementAnalytics: true,
  },
};

/**
 * Determine complexity tier from post count and optional complexity score
 */
export function getComplexityTier(
  replyCount: number,
  complexityScore?: ThreadComplexityScore,
): ComplexityTier {
  // If we have a complexity score, use it to potentially upgrade the tier
  // for threads that are structurally complex despite lower post counts
  if (complexityScore && complexityScore.level === "extreme") {
    return "viral";
  }
  if (complexityScore && complexityScore.level === "high") {
    return replyCount >= 30 ? "viral" : "complex";
  }

  if (replyCount >= 75) return "viral";
  if (replyCount >= 30) return "complex";
  if (replyCount >= 10) return "moderate";
  if (replyCount >= 3) return "simple";
  return "minimal";
}

/**
 * Get configuration for a complexity tier
 */
export function getTierConfig(tier: ComplexityTier): ComplexityTierConfig {
  return TIER_CONFIGS[tier];
}

interface ProgressiveThreadViewProps
  extends Omit<ThreadViewerProps, "threadSummary"> {
  /** Thread URI for summary caching */
  threadUri: string;
  /** Current user's DID for minimap */
  currentUserDid?: string;
  /** Focused post index for minimap */
  focusedIndex?: number;
  /** Callback when navigating via minimap */
  onNavigate?: (index: number) => void;
  /** Ref for scroll container (for minimap viewport tracking) */
  scrollContainerRef?: React.RefObject<HTMLDivElement>;
  /** Show analytics panel (user toggle) */
  showAnalytics?: boolean;
  /** Callback when clicking a post in analytics */
  onAnalyticsPostClick?: (post: Post) => void;
  /** Force a specific tier (for testing/override) */
  forceTier?: ComplexityTier;
}

/**
 * Thread stats bar showing participants and branches
 */
function ThreadStatsBar({
  posts,
  config,
}: {
  posts: Post[];
  config: ComplexityTierConfig;
}) {
  const stats = useMemo(() => {
    const uniqueAuthors = new Set(posts.map((p) => p.author.did));
    const authorAvatars = posts
      .reduce(
        (acc, p) => {
          if (!acc.find((a) => a.did === p.author.did)) {
            acc.push({
              did: p.author.did,
              avatar: p.author.avatar,
              handle: p.author.handle,
            });
          }
          return acc;
        },
        [] as { did: string; avatar?: string; handle: string }[],
      )
      .slice(0, 5);

    // Count branches (posts with multiple children)
    const childCounts = new Map<string, number>();
    posts.forEach((p) => {
      const record = p.record as { reply?: { parent?: { uri: string } } };
      const parentUri = record?.reply?.parent?.uri;
      if (parentUri) {
        childCounts.set(parentUri, (childCounts.get(parentUri) || 0) + 1);
      }
    });
    const branchCount = Array.from(childCounts.values()).filter(
      (c) => c > 1,
    ).length;

    return {
      participantCount: uniqueAuthors.size,
      authorAvatars,
      branchCount,
    };
  }, [posts]);

  if (!config.showParticipants && !config.showBranchIndicators) {
    return null;
  }

  return (
    <div
      className="mb-3 flex items-center gap-4 text-sm"
      style={{ color: "var(--bsky-text-secondary)" }}
    >
      {config.showParticipants && stats.participantCount > 1 && (
        <div className="flex items-center gap-2">
          <div className="flex -space-x-2">
            {stats.authorAvatars.map((author, idx) => (
              <ThrottledAvatar
                key={author.did}
                src={author.avatar}
                alt={author.handle}
                className="h-6 w-6 border-2"
                style={{
                  borderColor: "var(--bsky-bg-primary)",
                  zIndex: stats.authorAvatars.length - idx,
                }}
                fallbackInitial={author.handle?.charAt(0).toUpperCase()}
              />
            ))}
          </div>
          <span className="flex items-center gap-1">
            <Users size={14} />
            {stats.participantCount} participants
          </span>
        </div>
      )}

      {config.showBranchIndicators && stats.branchCount > 0 && (
        <span className="flex items-center gap-1">
          <GitBranch size={14} />
          {stats.branchCount} {stats.branchCount === 1 ? "branch" : "branches"}
        </span>
      )}

      {config.showAnalyticsBadge && (
        <span className="flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-xs text-blue-500">
          <BarChart3 size={12} />
          Analytics available
        </span>
      )}
    </div>
  );
}

/**
 * ProgressiveThreadView - Adapts UI complexity to match thread complexity
 */
export function ProgressiveThreadView({
  posts,
  threadUri,
  currentUserDid,
  focusedIndex = 0,
  onNavigate,
  scrollContainerRef,
  showAnalytics = false,
  onAnalyticsPostClick,
  forceTier,
  rootUri,
  ...viewerProps
}: ProgressiveThreadViewProps) {
  // Calculate complexity metrics
  const { config, complexityScore } = useMemo(() => {
    const replyCount = Math.max(0, posts.length - 1);

    // Build basic tree metrics
    let maxDepth = 0;
    let branchCount = 0;
    const depthMap = new Map<string, number>();

    posts.forEach((p) => {
      const record = p.record as { reply?: { parent?: { uri: string } } };
      const parentUri = record?.reply?.parent?.uri;
      if (!parentUri) {
        depthMap.set(p.uri, 0);
      } else if (depthMap.has(parentUri)) {
        const depth = (depthMap.get(parentUri) || 0) + 1;
        depthMap.set(p.uri, depth);
        maxDepth = Math.max(maxDepth, depth);
      }
    });

    // Count branches
    const childCounts = new Map<string, number>();
    posts.forEach((p) => {
      const record = p.record as { reply?: { parent?: { uri: string } } };
      const parentUri = record?.reply?.parent?.uri;
      if (parentUri) {
        childCounts.set(parentUri, (childCounts.get(parentUri) || 0) + 1);
      }
    });
    branchCount = Array.from(childCounts.values()).filter((c) => c > 1).length;

    const score = calculateComplexityFromPosts(posts, maxDepth, branchCount);
    const determinedTier = forceTier || getComplexityTier(replyCount, score);

    return {
      config: getTierConfig(determinedTier),
      complexityScore: score,
    };
  }, [posts, forceTier]);

  // Build parent URI map for summary depth calculation
  const parentUris = useMemo(() => {
    const map = new Map<string, string>();
    posts.forEach((p) => {
      const record = p.record as { reply?: { parent?: { uri: string } } };
      if (record?.reply?.parent?.uri) {
        map.set(p.uri, record.reply.parent.uri);
      }
    });
    return map;
  }, [posts]);

  return (
    <div className="progressive-thread-view">
      {/* Thread Stats Bar - shown for moderate+ threads */}
      <ThreadStatsBar posts={posts} config={config} />

      {/* Progressive Summary - adapts to complexity */}
      {config.showSummary && posts.length >= 3 && (
        <ProgressiveThreadSummary
          posts={posts}
          threadUri={threadUri}
          parentUris={parentUris}
          summaryDepth={config.summaryDepth}
          className="mb-4"
        />
      )}

      {/* Engagement Analytics - shown for viral threads or when toggled */}
      {(config.showEngagementAnalytics || showAnalytics) &&
        posts.length > 0 && (
          <ThreadEngagementAnalytics
            posts={posts}
            className="mb-4"
            collapsed={!showAnalytics}
            onPostClick={onAnalyticsPostClick}
          />
        )}

      {/* Thread Viewer */}
      <ThreadViewer
        posts={posts}
        rootUri={rootUri}
        {...viewerProps}
        maxInitialReplies={complexityScore.initialRevealCount}
      />

      {/* Minimap - shown for viral threads */}
      {config.showMinimap && scrollContainerRef && onNavigate && (
        <ThreadMinimap
          posts={posts}
          currentIndex={focusedIndex}
          currentUserDid={currentUserDid}
          onNavigate={onNavigate}
          rootUri={rootUri}
          scrollContainerRef={scrollContainerRef}
        />
      )}
    </div>
  );
}

export default ProgressiveThreadView;
