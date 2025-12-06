/**
 * AnimatedList - Wrapper component for smooth content insertion animations
 *
 * Provides smooth animations for inserting new items into lists without causing
 * Cumulative Layout Shift (CLS). Works with any list-based content (posts, notifications, etc.)
 *
 * Features:
 * - FLIP animation technique for smooth height transitions
 * - "New content above" indicator when user is scrolled down
 * - Automatic new item highlighting
 * - Respects prefers-reduced-motion
 * - Zero CLS during content insertion
 */

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { NewContentIndicator } from "./NewContentIndicator";

export interface AnimatedListItem {
  /** Unique identifier for the item */
  id: string;
  /** Optional timestamp for sorting */
  timestamp?: string | number;
}

export interface AnimatedListProps<T extends AnimatedListItem> {
  /** Array of items to render */
  items: T[];
  /** Render function for each item */
  renderItem: (
    item: T,
    index: number,
    isNew: boolean,
  ) => React.ReactNode;
  /** Unique key for the list (used for scroll position tracking) */
  listKey?: string;
  /** Enable animations (default: true) */
  enableAnimations?: boolean;
  /** Animation duration in ms (default: 300) */
  animationDuration?: number;
  /** Show new content indicator (default: true) */
  showNewContentIndicator?: boolean;
  /** Label for new content indicator (default: "new items") */
  newContentLabel?: string;
  /** Singular label (default: "new item") */
  newContentSingularLabel?: string;
  /** Scroll threshold for showing indicator (default: 200px) */
  scrollThreshold?: number;
  /** Additional container className */
  className?: string;
  /** Container style */
  style?: React.CSSProperties;
  /** Role for accessibility (default: "list") */
  role?: string;
  /** Aria label for accessibility */
  ariaLabel?: string;
  /** Called when new items are detected */
  onNewItems?: (newIds: Set<string>) => void;
  /** Called when user scrolls to new items */
  onAcknowledgeNewItems?: () => void;
  /** Time to highlight new items in ms (default: 2000) */
  highlightDuration?: number;
}

// Check for reduced motion preference
function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    document.documentElement.getAttribute("data-reduce-motion") === "true"
  );
}

export function AnimatedList<T extends AnimatedListItem>({
  items,
  renderItem,
  listKey = "default",
  enableAnimations = true,
  animationDuration = 300,
  showNewContentIndicator = true,
  newContentLabel = "new items",
  newContentSingularLabel = "new item",
  scrollThreshold = 200,
  className = "",
  style,
  role = "list",
  ariaLabel,
  onNewItems,
  onAcknowledgeNewItems,
  highlightDuration = 2000,
}: AnimatedListProps<T>): React.ReactElement {
  // State for tracking new items
  const [newItemIds, setNewItemIds] = useState<Set<string>>(new Set());
  const [pendingAboveCount, setPendingAboveCount] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const previousItemsRef = useRef<Map<string, T>>(new Map());
  const previousIdsRef = useRef<Set<string>>(new Set());
  const isInitialMount = useRef(true);
  const scrollPositionRef = useRef(0);

  // Check if animations should be used
  const shouldAnimate = enableAnimations && !prefersReducedMotion();

  // Track scroll position
  useEffect(() => {
    const handleScroll = () => {
      scrollPositionRef.current = window.scrollY;

      // Clear pending count when user scrolls to top
      if (scrollPositionRef.current < scrollThreshold && pendingAboveCount > 0) {
        setPendingAboveCount(0);
        onAcknowledgeNewItems?.();
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [scrollThreshold, pendingAboveCount, onAcknowledgeNewItems]);

  // FLIP animation for existing items
  const animateItemsShift = useCallback(
    (container: HTMLElement, newIds: Set<string>) => {
      if (!shouldAnimate) return;

      const children = container.querySelectorAll("[data-list-item-id]");

      // FIRST: Record current positions
      const firstPositions = new Map<string, DOMRect>();
      children.forEach((child) => {
        const id = child.getAttribute("data-list-item-id");
        if (id && !newIds.has(id)) {
          firstPositions.set(id, child.getBoundingClientRect());
        }
      });

      // Wait for React to update DOM
      requestAnimationFrame(() => {
        const updatedChildren = container.querySelectorAll("[data-list-item-id]");

        updatedChildren.forEach((child, index) => {
          const id = child.getAttribute("data-list-item-id");
          if (!id) return;

          const el = child as HTMLElement;

          if (newIds.has(id)) {
            // New item: animate in
            el.style.opacity = "0";
            el.style.transform = "translateY(-20px)";

            requestAnimationFrame(() => {
              el.style.transition = `opacity ${animationDuration}ms ease-out, transform ${animationDuration}ms ease-out`;
              el.style.opacity = "1";
              el.style.transform = "translateY(0)";
            });
          } else if (firstPositions.has(id)) {
            // Existing item: FLIP animation
            const firstRect = firstPositions.get(id)!;
            const lastRect = child.getBoundingClientRect();
            const deltaY = firstRect.top - lastRect.top;

            if (Math.abs(deltaY) > 1) {
              el.style.transform = `translateY(${deltaY}px)`;
              el.style.transition = "none";

              const delay = Math.min(index * 20, 200); // Stagger delay

              requestAnimationFrame(() => {
                el.style.transition = `transform ${animationDuration}ms ease-out ${delay}ms`;
                el.style.transform = "translateY(0)";
              });
            }
          }
        });

        // Clean up styles after animation
        setTimeout(() => {
          updatedChildren.forEach((child) => {
            const el = child as HTMLElement;
            el.style.transform = "";
            el.style.transition = "";
            el.style.opacity = "";
          });
          setIsAnimating(false);
        }, animationDuration + 250);
      });
    },
    [shouldAnimate, animationDuration],
  );

  // Process item changes
  useLayoutEffect(() => {
    // Skip on initial mount
    if (isInitialMount.current) {
      isInitialMount.current = false;

      // Build initial item map
      const itemMap = new Map<string, T>();
      const idSet = new Set<string>();
      items.forEach((item) => {
        itemMap.set(item.id, item);
        idSet.add(item.id);
      });
      previousItemsRef.current = itemMap;
      previousIdsRef.current = idSet;
      return;
    }

    // Identify new items (items not in previous set)
    const newIds = new Set<string>();
    items.forEach((item) => {
      if (!previousIdsRef.current.has(item.id)) {
        newIds.add(item.id);
      }
    });

    if (newIds.size > 0) {
      // Check if user is scrolled down
      const isScrolledDown = scrollPositionRef.current > scrollThreshold;

      if (isScrolledDown && showNewContentIndicator) {
        // User is scrolled down - show indicator instead of animating
        setPendingAboveCount((prev) => prev + newIds.size);
      } else if (shouldAnimate && containerRef.current) {
        // User is at top - animate insertion
        setIsAnimating(true);
        setNewItemIds(newIds);
        animateItemsShift(containerRef.current, newIds);

        // Clear highlighting after duration
        setTimeout(() => {
          setNewItemIds(new Set());
        }, highlightDuration);
      } else {
        // No animation - just highlight briefly
        setNewItemIds(newIds);
        setTimeout(() => {
          setNewItemIds(new Set());
        }, highlightDuration);
      }

      // Notify parent of new items
      onNewItems?.(newIds);
    }

    // Update previous refs
    const itemMap = new Map<string, T>();
    const idSet = new Set<string>();
    items.forEach((item) => {
      itemMap.set(item.id, item);
      idSet.add(item.id);
    });
    previousItemsRef.current = itemMap;
    previousIdsRef.current = idSet;
  }, [
    items,
    scrollThreshold,
    showNewContentIndicator,
    shouldAnimate,
    animateItemsShift,
    highlightDuration,
    onNewItems,
  ]);

  // Handle scrolling to new items
  const handleScrollToNew = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    setPendingAboveCount(0);
    onAcknowledgeNewItems?.();
  }, [onAcknowledgeNewItems]);

  // Memoize rendered items
  const renderedItems = useMemo(() => {
    return items.map((item, index) => {
      const isNew = newItemIds.has(item.id);
      const itemClasses = [
        "content-item-animated",
        isNew && shouldAnimate ? "content-item-new" : "",
        isNew && shouldAnimate ? "animate-content-insert" : "",
      ]
        .filter(Boolean)
        .join(" ");

      return (
        <div
          key={item.id}
          data-list-item-id={item.id}
          className={itemClasses}
        >
          {renderItem(item, index, isNew)}
        </div>
      );
    });
  }, [items, newItemIds, shouldAnimate, renderItem]);

  return (
    <>
      {/* New content indicator */}
      {showNewContentIndicator && (
        <NewContentIndicator
          count={pendingAboveCount}
          show={pendingAboveCount > 0}
          onClick={handleScrollToNew}
          label={newContentLabel}
          singularLabel={newContentSingularLabel}
        />
      )}

      {/* List container */}
      <div
        ref={containerRef}
        className={`content-insertion-container ${className}`}
        style={style}
        role={role}
        aria-label={ariaLabel}
        data-animating={isAnimating ? "true" : undefined}
      >
        {renderedItems}
      </div>
    </>
  );
}

AnimatedList.displayName = "AnimatedList";

/**
 * useAnimatedListItem - Hook for individual animated list items
 *
 * Use this when you want more control over individual item animations
 * without the full AnimatedList wrapper.
 */
export interface UseAnimatedListItemOptions {
  id: string;
  isNew: boolean;
  animationDuration?: number;
  highlightDuration?: number;
}

export interface UseAnimatedListItemResult {
  className: string;
  style: React.CSSProperties;
  isAnimating: boolean;
}

export function useAnimatedListItem({
  id,
  isNew,
  animationDuration = 300,
  highlightDuration = 2000,
}: UseAnimatedListItemOptions): UseAnimatedListItemResult {
  const [isAnimating, setIsAnimating] = useState(isNew);
  const [showHighlight, setShowHighlight] = useState(isNew);

  useEffect(() => {
    if (isNew) {
      setIsAnimating(true);
      setShowHighlight(true);

      // End animation state
      const animTimer = setTimeout(() => {
        setIsAnimating(false);
      }, animationDuration);

      // End highlight state
      const highlightTimer = setTimeout(() => {
        setShowHighlight(false);
      }, highlightDuration);

      return () => {
        clearTimeout(animTimer);
        clearTimeout(highlightTimer);
      };
    }
  }, [isNew, animationDuration, highlightDuration]);

  const shouldAnimate = !prefersReducedMotion();

  const className = [
    "content-item-animated",
    showHighlight && shouldAnimate ? "content-item-new" : "",
    isAnimating && shouldAnimate ? "animate-content-insert" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const style: React.CSSProperties = {};

  return {
    className,
    style,
    isAnimating,
  };
}
