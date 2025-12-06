/**
 * useContentInsertion - Smooth content insertion animation hook
 *
 * This hook implements the FLIP (First, Last, Invert, Play) animation technique
 * to smoothly animate new content insertion without causing Cumulative Layout Shift (CLS).
 *
 * Key features:
 * - Prevents CLS by using CSS transforms instead of layout changes
 * - Animates existing items down when new items are inserted at the top
 * - Respects prefers-reduced-motion for accessibility
 * - Supports both feed posts and notifications
 */

import { useCallback, useEffect, useRef, useState } from "react";

export interface ContentItem {
  id: string;
  timestamp?: string | number;
}

export interface ContentInsertionConfig {
  /** Animation duration in ms (default: 300ms) */
  animationDuration?: number;
  /** Easing function (default: ease-out) */
  easing?: string;
  /** Enable animation (default: true) */
  enabled?: boolean;
  /** Buffer zone height for new items indicator (default: 200px) */
  newItemsIndicatorThreshold?: number;
  /** Maximum number of items to animate simultaneously (default: 10) */
  maxAnimatedItems?: number;
  /** Stagger delay between item animations (default: 30ms) */
  staggerDelay?: number;
}

export interface ContentInsertionState<T extends ContentItem> {
  /** Items ready for display with animation data */
  displayItems: T[];
  /** IDs of newly inserted items (for highlighting) */
  newItemIds: Set<string>;
  /** Count of items above viewport that user hasn't scrolled to */
  pendingAboveCount: number;
  /** Whether animation is currently in progress */
  isAnimating: boolean;
  /** Ref callback to attach to the container element */
  containerRef: (element: HTMLElement | null) => void;
  /** Call when user scrolls to acknowledge new items above */
  acknowledgeNewItems: () => void;
  /** Manual trigger to insert pending items with animation */
  insertPendingItems: () => void;
}

// Check for reduced motion preference
function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    document.documentElement.getAttribute("data-reduce-motion") === "true"
  );
}

export function useContentInsertion<T extends ContentItem>(
  items: T[],
  config: ContentInsertionConfig = {},
): ContentInsertionState<T> {
  const {
    animationDuration = 300,
    easing = "cubic-bezier(0, 0, 0.2, 1)", // ease-out
    enabled = true,
    newItemsIndicatorThreshold = 200,
    maxAnimatedItems = 10,
    staggerDelay = 30,
  } = config;

  // State
  const [displayItems, setDisplayItems] = useState<T[]>(items);
  const [newItemIds, setNewItemIds] = useState<Set<string>>(new Set());
  const [pendingAboveCount, setPendingAboveCount] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  // Refs
  const containerRef = useRef<HTMLElement | null>(null);
  const previousItemsRef = useRef<Map<string, T>>(new Map());
  const previousIdsRef = useRef<Set<string>>(new Set());
  const scrollPositionRef = useRef(0);
  const isInitialMount = useRef(true);
  const animationFrameRef = useRef<number | null>(null);

  // Track scroll position
  useEffect(() => {
    const handleScroll = () => {
      scrollPositionRef.current = window.scrollY;

      // Clear pending count when user scrolls to top
      if (scrollPositionRef.current < newItemsIndicatorThreshold) {
        setPendingAboveCount(0);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [newItemsIndicatorThreshold]);

  // Container ref callback
  const setContainerRef = useCallback((element: HTMLElement | null) => {
    containerRef.current = element;
  }, []);

  // FLIP animation implementation
  const animateInsertion = useCallback(
    (newIds: Set<string>, allItems: T[]) => {
      if (!containerRef.current || prefersReducedMotion() || !enabled) {
        // Just update without animation
        setDisplayItems(allItems);
        setNewItemIds(newIds);
        setTimeout(() => setNewItemIds(new Set()), animationDuration);
        return;
      }

      const container = containerRef.current;

      // FIRST: Record current positions
      const firstPositions = new Map<string, DOMRect>();
      const children = container.querySelectorAll("[data-item-id]");
      children.forEach((child) => {
        const id = child.getAttribute("data-item-id");
        if (id) {
          firstPositions.set(id, child.getBoundingClientRect());
        }
      });

      // Update DOM
      setIsAnimating(true);
      setDisplayItems(allItems);
      setNewItemIds(newIds);

      // LAST: Calculate new positions and animate
      requestAnimationFrame(() => {
        const newChildren = container.querySelectorAll("[data-item-id]");
        const itemsToAnimate: { element: Element; delta: number }[] = [];

        newChildren.forEach((child) => {
          const id = child.getAttribute("data-item-id");
          if (!id) return;

          const lastRect = child.getBoundingClientRect();

          if (newIds.has(id)) {
            // New item: animate in from collapsed state
            const element = child as HTMLElement;
            element.style.opacity = "0";
            element.style.transform = "translateY(-20px)";
            element.style.transition = `opacity ${animationDuration}ms ${easing}, transform ${animationDuration}ms ${easing}`;

            requestAnimationFrame(() => {
              element.style.opacity = "1";
              element.style.transform = "translateY(0)";
            });
          } else if (firstPositions.has(id)) {
            // Existing item: FLIP animation
            const firstRect = firstPositions.get(id)!;
            const deltaY = firstRect.top - lastRect.top;

            if (Math.abs(deltaY) > 1) {
              itemsToAnimate.push({ element: child, delta: deltaY });
            }
          }
        });

        // INVERT & PLAY: Animate existing items
        itemsToAnimate
          .slice(0, maxAnimatedItems)
          .forEach(({ element, delta }, index) => {
            const el = element as HTMLElement;
            const delay = index * staggerDelay;

            el.style.transform = `translateY(${delta}px)`;
            el.style.transition = "none";

            requestAnimationFrame(() => {
              el.style.transition = `transform ${animationDuration}ms ${easing} ${delay}ms`;
              el.style.transform = "translateY(0)";
            });
          });

        // Clean up animation state
        const maxDelay =
          Math.min(itemsToAnimate.length, maxAnimatedItems) * staggerDelay;
        setTimeout(
          () => {
            setIsAnimating(false);

            // Clean up inline styles
            newChildren.forEach((child) => {
              const el = child as HTMLElement;
              el.style.transform = "";
              el.style.transition = "";
              el.style.opacity = "";
            });

            // Clear new item highlighting after animation
            setNewItemIds(new Set());
          },
          animationDuration + maxDelay + 50,
        );
      });
    },
    [enabled, animationDuration, easing, maxAnimatedItems, staggerDelay],
  );

  // Process item changes
  useEffect(() => {
    // Skip on initial mount
    if (isInitialMount.current) {
      isInitialMount.current = false;
      setDisplayItems(items);

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

    // Cancel any pending animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    animationFrameRef.current = requestAnimationFrame(() => {
      // Identify new items
      const currentIds = new Set(items.map((item) => item.id));
      const newIds = new Set<string>();

      items.forEach((item) => {
        if (!previousIdsRef.current.has(item.id)) {
          newIds.add(item.id);
        }
      });

      // Check if user is scrolled down (not at top)
      const isScrolledDown =
        scrollPositionRef.current > newItemsIndicatorThreshold;

      // If scrolled down and new items exist, increment pending count
      if (isScrolledDown && newIds.size > 0 && !isAnimating) {
        // Count how many new items are at the top
        const newItemsAtTop = items.filter((item) =>
          newIds.has(item.id),
        ).length;
        setPendingAboveCount((prev) => prev + newItemsAtTop);

        // Still update display items, but without animation
        setDisplayItems(items);
      } else if (newIds.size > 0) {
        // User is at top or near top - animate insertion
        animateInsertion(newIds, items);
      } else {
        // No new items, just update
        setDisplayItems(items);
      }

      // Update previous refs
      const itemMap = new Map<string, T>();
      items.forEach((item) => itemMap.set(item.id, item));
      previousItemsRef.current = itemMap;
      previousIdsRef.current = currentIds;
    });

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [items, animateInsertion, newItemsIndicatorThreshold, isAnimating]);

  // Acknowledge new items (user scrolled to top)
  const acknowledgeNewItems = useCallback(() => {
    setPendingAboveCount(0);
  }, []);

  // Manual trigger to insert pending items with animation
  const insertPendingItems = useCallback(() => {
    if (pendingAboveCount > 0) {
      // Scroll to top smoothly
      window.scrollTo({ top: 0, behavior: "smooth" });
      setPendingAboveCount(0);
    }
  }, [pendingAboveCount]);

  return {
    displayItems,
    newItemIds,
    pendingAboveCount,
    isAnimating,
    containerRef: setContainerRef,
    acknowledgeNewItems,
    insertPendingItems,
  };
}

/**
 * useNewContentIndicator - Hook for "new content above" indicator
 *
 * Shows an indicator when new content has been loaded above the viewport
 * that the user hasn't scrolled to yet.
 */
export interface NewContentIndicatorConfig {
  /** Threshold scroll position to show indicator (default: 200) */
  scrollThreshold?: number;
  /** Auto-hide after this many ms (0 = never, default: 0) */
  autoHideDelay?: number;
}

export interface NewContentIndicatorState {
  /** Whether to show the indicator */
  showIndicator: boolean;
  /** Number of new items above */
  count: number;
  /** Dismiss the indicator */
  dismiss: () => void;
  /** Scroll to new items */
  scrollToNew: () => void;
}

export function useNewContentIndicator(
  pendingCount: number,
  config: NewContentIndicatorConfig = {},
): NewContentIndicatorState {
  const { scrollThreshold = 200, autoHideDelay = 0 } = config;

  const [showIndicator, setShowIndicator] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Show indicator when there's pending content and user is scrolled down
    const shouldShow =
      pendingCount > 0 && window.scrollY > scrollThreshold && !dismissed;

    setShowIndicator(shouldShow);

    // Auto-hide after delay if configured
    if (shouldShow && autoHideDelay > 0) {
      const timer = setTimeout(() => setShowIndicator(false), autoHideDelay);
      return () => clearTimeout(timer);
    }
  }, [pendingCount, scrollThreshold, autoHideDelay, dismissed]);

  // Reset dismissed state when count goes to 0
  useEffect(() => {
    if (pendingCount === 0) {
      setDismissed(false);
    }
  }, [pendingCount]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    setShowIndicator(false);
  }, []);

  const scrollToNew = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    setDismissed(true);
    setShowIndicator(false);
  }, []);

  return {
    showIndicator,
    count: pendingCount,
    dismiss,
    scrollToNew,
  };
}
