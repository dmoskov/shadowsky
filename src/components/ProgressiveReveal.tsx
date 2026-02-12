/**
 * ProgressiveReveal - Component for progressive content loading based on complexity
 *
 * Renders content progressively based on thread complexity scoring:
 * - Shows initial batch of items
 * - Provides "Show more" button to reveal additional batches
 * - Adapts to complexity level for optimal UX
 * - Supports both automatic and manual reveal
 */

import { ChevronDown, ChevronUp, Eye, Layers } from "lucide-react";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  ComplexityLevel,
  ThreadComplexityScore,
} from "../services/thread-complexity-scorer";

// ============================================================================
// Types
// ============================================================================

export interface ProgressiveRevealProps<T> {
  /** All items to be progressively revealed */
  items: T[];
  /** Complexity score for adaptive thresholds */
  complexityScore: ThreadComplexityScore;
  /** Render function for each item */
  renderItem: (
    item: T,
    index: number,
    isNewlyRevealed: boolean,
  ) => React.ReactNode;
  /** Key extractor for React list rendering */
  keyExtractor: (item: T, index: number) => string;
  /** Optional custom initial count (overrides complexity-based) */
  initialCount?: number;
  /** Optional custom batch size (overrides complexity-based) */
  batchSize?: number;
  /** Show complexity indicator badge */
  showComplexityBadge?: boolean;
  /** Callback when items are revealed */
  onReveal?: (revealedCount: number, totalCount: number) => void;
  /** Enable intersection observer for auto-reveal */
  autoRevealOnScroll?: boolean;
  /** CSS class for container */
  className?: string;
  /** Animate newly revealed items */
  animateNewItems?: boolean;
}

export interface ProgressiveRevealState {
  revealedCount: number;
  isRevealing: boolean;
  hasMore: boolean;
  hiddenCount: number;
}

// ============================================================================
// Complexity Badge Component
// ============================================================================

const COMPLEXITY_STYLES: Record<
  ComplexityLevel,
  { bg: string; text: string; label: string }
> = {
  minimal: {
    bg: "var(--asph-success-10)",
    text: "var(--asph-success-light)",
    label: "Simple",
  },
  low: {
    bg: "var(--asph-info-10)",
    text: "var(--asph-info)",
    label: "Light",
  },
  medium: {
    bg: "var(--asph-warning-10)",
    text: "var(--asph-warning-light)",
    label: "Moderate",
  },
  high: {
    bg: "var(--asph-orange-10)",
    text: "var(--asph-orange)",
    label: "Complex",
  },
  extreme: {
    bg: "var(--asph-error-10)",
    text: "var(--asph-error)",
    label: "Very Complex",
  },
};

interface ComplexityBadgeProps {
  complexityScore: ThreadComplexityScore;
}

const ComplexityBadge: React.FC<ComplexityBadgeProps> = ({
  complexityScore,
}) => {
  const style = COMPLEXITY_STYLES[complexityScore.level];

  return (
    <div
      className="flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium"
      style={{
        backgroundColor: style.bg,
        color: style.text,
        border: `1px solid ${style.text}20`,
      }}
      title={`Complexity score: ${complexityScore.score}/100`}
    >
      <Layers size={12} />
      {style.label}
    </div>
  );
};

// ============================================================================
// Show More Button Component
// ============================================================================

interface ShowMoreButtonProps {
  hiddenCount: number;
  batchSize: number;
  isRevealing: boolean;
  complexityLevel: ComplexityLevel;
  onShowMore: () => void;
  onShowAll: () => void;
}

const ShowMoreButton: React.FC<ShowMoreButtonProps> = ({
  hiddenCount,
  batchSize,
  isRevealing,
  complexityLevel,
  onShowMore,
  onShowAll,
}) => {
  const style = COMPLEXITY_STYLES[complexityLevel];
  const showingNext = Math.min(batchSize, hiddenCount);

  return (
    <div className="my-4 flex items-center justify-center gap-2">
      <button
        onClick={onShowMore}
        disabled={isRevealing}
        className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all hover:scale-105 disabled:cursor-wait disabled:opacity-70"
        style={{
          backgroundColor: style.bg,
          color: style.text,
          border: `1px solid ${style.text}30`,
        }}
      >
        {isRevealing ? (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          <ChevronDown size={16} />
        )}
        Show {showingNext} more
        <span
          className="rounded-full px-1.5 py-0.5 text-xs"
          style={{ backgroundColor: `${style.text}15` }}
        >
          {hiddenCount} hidden
        </span>
      </button>

      {hiddenCount > batchSize && (
        <button
          onClick={onShowAll}
          disabled={isRevealing}
          className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition-all hover:bg-blue-500 hover:bg-opacity-10 disabled:cursor-wait disabled:opacity-70"
          style={{ color: "var(--asph-text-secondary)" }}
          title="Show all remaining items"
        >
          <Eye size={14} />
          Show all
        </button>
      )}
    </div>
  );
};

// ============================================================================
// Collapse Button Component
// ============================================================================

interface CollapseButtonProps {
  totalCount: number;
  initialCount: number;
  onCollapse: () => void;
}

const CollapseButton: React.FC<CollapseButtonProps> = ({
  totalCount,
  initialCount,
  onCollapse,
}) => {
  if (totalCount <= initialCount) return null;

  return (
    <div className="my-4 flex justify-center">
      <button
        onClick={onCollapse}
        className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition-all hover:bg-blue-500 hover:bg-opacity-10"
        style={{ color: "var(--asph-text-secondary)" }}
      >
        <ChevronUp size={14} />
        Collapse to {initialCount}
      </button>
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

function ProgressiveRevealInner<T>(
  props: ProgressiveRevealProps<T>,
  ref: React.ForwardedRef<{ reset: () => void; revealAll: () => void }>,
) {
  const {
    items,
    complexityScore,
    renderItem,
    keyExtractor,
    initialCount,
    batchSize,
    showComplexityBadge = false,
    onReveal,
    autoRevealOnScroll = false,
    className = "",
    animateNewItems = true,
  } = props;

  // Calculate effective thresholds
  const effectiveInitialCount = useMemo(
    () =>
      initialCount !== undefined
        ? initialCount
        : Math.min(complexityScore.initialRevealCount, items.length),
    [initialCount, complexityScore.initialRevealCount, items.length],
  );

  const effectiveBatchSize = useMemo(
    () => batchSize ?? complexityScore.revealBatchSize,
    [batchSize, complexityScore.revealBatchSize],
  );

  // State
  const [revealedCount, setRevealedCount] = useState(() =>
    Math.min(effectiveInitialCount, items.length),
  );
  const [isRevealing, setIsRevealing] = useState(false);
  const [newlyRevealedStart, setNewlyRevealedStart] = useState(-1);

  // Refs
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const revealTimeoutRef = useRef<NodeJS.Timeout>();

  // Derived state
  const hasMore = revealedCount < items.length;
  const hiddenCount = items.length - revealedCount;
  const visibleItems = useMemo(
    () => items.slice(0, revealedCount),
    [items, revealedCount],
  );

  // Reset when items change
  useEffect(() => {
    setRevealedCount(Math.min(effectiveInitialCount, items.length));
    setNewlyRevealedStart(-1);
  }, [items.length, effectiveInitialCount]);

  // Handle show more
  const handleShowMore = useCallback(() => {
    if (isRevealing || !hasMore) return;

    setIsRevealing(true);
    setNewlyRevealedStart(revealedCount);

    // Simulate slight delay for animation
    revealTimeoutRef.current = setTimeout(() => {
      const newCount = Math.min(
        revealedCount + effectiveBatchSize,
        items.length,
      );
      setRevealedCount(newCount);
      setIsRevealing(false);
      onReveal?.(newCount, items.length);

      // Clear animation marker after animation completes
      setTimeout(() => setNewlyRevealedStart(-1), 500);
    }, 150);
  }, [
    isRevealing,
    hasMore,
    revealedCount,
    effectiveBatchSize,
    items.length,
    onReveal,
  ]);

  // Handle show all
  const handleShowAll = useCallback(() => {
    if (isRevealing) return;

    setIsRevealing(true);
    setNewlyRevealedStart(revealedCount);

    revealTimeoutRef.current = setTimeout(() => {
      setRevealedCount(items.length);
      setIsRevealing(false);
      onReveal?.(items.length, items.length);

      setTimeout(() => setNewlyRevealedStart(-1), 500);
    }, 150);
  }, [isRevealing, revealedCount, items.length, onReveal]);

  // Handle collapse
  const handleCollapse = useCallback(() => {
    const newCount = Math.min(effectiveInitialCount, items.length);
    setRevealedCount(newCount);
    setNewlyRevealedStart(-1);
    onReveal?.(newCount, items.length);
  }, [effectiveInitialCount, items.length, onReveal]);

  // Reset function for imperative API
  const reset = useCallback(() => {
    setRevealedCount(Math.min(effectiveInitialCount, items.length));
    setNewlyRevealedStart(-1);
    setIsRevealing(false);
  }, [effectiveInitialCount, items.length]);

  // Reveal all function for imperative API
  const revealAll = useCallback(() => {
    setRevealedCount(items.length);
    setNewlyRevealedStart(-1);
  }, [items.length]);

  // Expose imperative API
  React.useImperativeHandle(ref, () => ({ reset, revealAll }), [
    reset,
    revealAll,
  ]);

  // Auto-reveal on scroll (intersection observer)
  useEffect(() => {
    if (!autoRevealOnScroll || !hasMore || !loadMoreRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isRevealing) {
          handleShowMore();
        }
      },
      { rootMargin: "200px", threshold: 0 },
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [autoRevealOnScroll, hasMore, isRevealing, handleShowMore]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (revealTimeoutRef.current) {
        clearTimeout(revealTimeoutRef.current);
      }
    };
  }, []);

  // Don't render anything if no items
  if (items.length === 0) return null;

  return (
    <div className={`progressive-reveal ${className}`}>
      {/* Complexity badge header */}
      {showComplexityBadge && (
        <div className="mb-3 flex items-center justify-between">
          <ComplexityBadge complexityScore={complexityScore} />
          <span
            className="text-xs"
            style={{ color: "var(--asph-text-tertiary)" }}
          >
            {revealedCount} of {items.length} shown
          </span>
        </div>
      )}

      {/* Rendered items */}
      <div className="progressive-reveal-items">
        {visibleItems.map((item, index) => {
          const isNewlyRevealed =
            animateNewItems &&
            newlyRevealedStart >= 0 &&
            index >= newlyRevealedStart;

          return (
            <div
              key={keyExtractor(item, index)}
              className={
                isNewlyRevealed ? "animate-fade-in-slide-up" : undefined
              }
              style={
                isNewlyRevealed
                  ? {
                      animation: "fadeInSlideUp 0.3s ease-out forwards",
                      animationDelay: `${(index - newlyRevealedStart) * 50}ms`,
                      opacity: 0,
                    }
                  : undefined
              }
            >
              {renderItem(item, index, isNewlyRevealed)}
            </div>
          );
        })}
      </div>

      {/* Show more button */}
      {hasMore && (
        <div ref={loadMoreRef}>
          <ShowMoreButton
            hiddenCount={hiddenCount}
            batchSize={effectiveBatchSize}
            isRevealing={isRevealing}
            complexityLevel={complexityScore.level}
            onShowMore={handleShowMore}
            onShowAll={handleShowAll}
          />
        </div>
      )}

      {/* Collapse button when fully expanded */}
      {!hasMore && revealedCount > effectiveInitialCount && (
        <CollapseButton
          totalCount={items.length}
          initialCount={effectiveInitialCount}
          onCollapse={handleCollapse}
        />
      )}
    </div>
  );
}

// Forward ref with generic support
export const ProgressiveReveal = React.forwardRef(ProgressiveRevealInner) as <
  T,
>(
  props: ProgressiveRevealProps<T> & {
    ref?: React.ForwardedRef<{ reset: () => void; revealAll: () => void }>;
  },
) => React.ReactElement;

// ============================================================================
// CSS Keyframes (add to global styles or component)
// ============================================================================

// Add this to your global CSS or use a styled-component:
// @keyframes fadeInSlideUp {
//   from {
//     opacity: 0;
//     transform: translateY(10px);
//   }
//   to {
//     opacity: 1;
//     transform: translateY(0);
//   }
// }

// ============================================================================
// Exports
// ============================================================================

export { COMPLEXITY_STYLES };
export type { ComplexityLevel };
