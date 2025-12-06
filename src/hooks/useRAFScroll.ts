/**
 * RAF Scroll Hooks
 *
 * React hooks for consuming the scroll batching service.
 * Provides easy-to-use APIs for scroll-related UI updates.
 *
 * @module hooks/useRAFScroll
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  scrollBatchingService,
  type ScrollCallback,
  type ScrollState,
  type ScrollSubscriptionOptions,
} from "../services/scroll-batching-service";

// ============================================================================
// useRAFScroll
// ============================================================================

/**
 * Hook for subscribing to batched scroll events using requestAnimationFrame.
 *
 * This hook automatically manages subscription lifecycle and provides
 * scroll state that's updated at 60fps without causing layout thrashing.
 *
 * @param callback - Optional callback to receive scroll state updates
 * @param options - Subscription options
 * @returns Current scroll state
 *
 * @example
 * // Basic usage with state
 * const { scrollY, direction, isScrolling } = useRAFScroll();
 *
 * @example
 * // With callback
 * useRAFScroll((state) => {
 *   setShowButton(state.scrollY > 200);
 * });
 *
 * @example
 * // Element scroll with threshold
 * const containerRef = useRef<HTMLDivElement>(null);
 * const scrollState = useRAFScroll(undefined, {
 *   element: containerRef.current,
 *   threshold: 50
 * });
 */
export function useRAFScroll(
  callback?: ScrollCallback,
  options: ScrollSubscriptionOptions = {},
): ScrollState {
  const [scrollState, setScrollState] = useState<ScrollState>({
    scrollY: typeof window !== "undefined" ? window.scrollY : 0,
    scrollX: typeof window !== "undefined" ? window.scrollX : 0,
    previousScrollY: 0,
    direction: 0,
    velocity: 0,
    timestamp: 0,
    isScrolling: false,
    source: options.element ? "element" : "window",
  });

  // Keep callback ref stable
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  // Stable options ref to avoid effect re-running
  const optionsRef = useRef(options);

  // Only update options ref when element changes (key option that affects subscription)
  useEffect(() => {
    optionsRef.current = options;
  }, [options.element, options.priority, options.threshold, options.onDirectionChange]);

  useEffect(() => {
    const handleScroll: ScrollCallback = (state) => {
      setScrollState(state);
      callbackRef.current?.(state);
    };

    const unsubscribe = scrollBatchingService.subscribe(
      handleScroll,
      optionsRef.current,
    );

    return unsubscribe;
  }, [options.element]); // Re-subscribe when element changes

  return scrollState;
}

// ============================================================================
// useScrollDirection
// ============================================================================

/**
 * Hook that tracks scroll direction with RAF batching.
 *
 * @param element - Optional element to track (default: window)
 * @returns Current scroll direction: 'up' | 'down' | null
 *
 * @example
 * const direction = useScrollDirection();
 * // direction is 'up', 'down', or null
 *
 * @example
 * // Track element scroll
 * const containerRef = useRef<HTMLDivElement>(null);
 * const direction = useScrollDirection(containerRef.current);
 */
export function useScrollDirection(
  element?: HTMLElement | null,
): "up" | "down" | null {
  const [direction, setDirection] = useState<"up" | "down" | null>(null);

  useRAFScroll(
    useCallback((state: ScrollState) => {
      if (state.direction === 1) {
        setDirection("down");
      } else if (state.direction === -1) {
        setDirection("up");
      }
      // Keep last direction when stationary
    }, []),
    { element, onDirectionChange: true },
  );

  return direction;
}

// ============================================================================
// useScrollPosition
// ============================================================================

/**
 * Hook that tracks scroll position with RAF batching.
 *
 * @param element - Optional element to track (default: window)
 * @param threshold - Minimum scroll delta to trigger update
 * @returns Object with scrollY, scrollX, and isScrolling
 *
 * @example
 * const { scrollY, isScrolling } = useScrollPosition();
 *
 * @example
 * // With threshold to reduce updates
 * const { scrollY } = useScrollPosition(null, 50);
 */
export function useScrollPosition(
  element?: HTMLElement | null,
  threshold = 0,
): { scrollY: number; scrollX: number; isScrolling: boolean } {
  const scrollState = useRAFScroll(undefined, { element, threshold });

  return {
    scrollY: scrollState.scrollY,
    scrollX: scrollState.scrollX,
    isScrolling: scrollState.isScrolling,
  };
}

// ============================================================================
// useScrollVisibility
// ============================================================================

/**
 * Hook for showing/hiding UI elements based on scroll behavior.
 * Perfect for floating action buttons, headers, etc.
 *
 * @param options - Configuration options
 * @returns Whether the element should be visible
 *
 * @example
 * // Hide on scroll down, show on scroll up (default behavior)
 * const isVisible = useScrollVisibility();
 *
 * @example
 * // With minimum scroll position
 * const isVisible = useScrollVisibility({
 *   hideOnScrollDown: true,
 *   showThreshold: 100
 * });
 */
export function useScrollVisibility(options: {
  /** Hide when scrolling down (default: true) */
  hideOnScrollDown?: boolean;
  /** Show when scrolling up (default: true) */
  showOnScrollUp?: boolean;
  /** Minimum scroll position before hiding (default: 100) */
  showThreshold?: number;
  /** Element to track (default: window) */
  element?: HTMLElement | null;
} = {}): boolean {
  const {
    hideOnScrollDown = true,
    showOnScrollUp = true,
    showThreshold = 100,
    element,
  } = options;

  const [isVisible, setIsVisible] = useState(true);

  useRAFScroll(
    useCallback(
      (state: ScrollState) => {
        // Always show near top of page
        if (state.scrollY < showThreshold) {
          setIsVisible(true);
          return;
        }

        // Hide on scroll down
        if (hideOnScrollDown && state.direction === 1) {
          setIsVisible(false);
        }

        // Show on scroll up
        if (showOnScrollUp && state.direction === -1) {
          setIsVisible(true);
        }
      },
      [hideOnScrollDown, showOnScrollUp, showThreshold],
    ),
    { element, onDirectionChange: true },
  );

  return isVisible;
}

// ============================================================================
// useScrollThreshold
// ============================================================================

/**
 * Hook that triggers when scroll passes a threshold.
 *
 * @param threshold - Scroll position threshold in pixels
 * @param element - Optional element to track (default: window)
 * @returns Whether scroll position is past the threshold
 *
 * @example
 * const isPastHeader = useScrollThreshold(200);
 * // true when scrolled past 200px
 */
export function useScrollThreshold(
  threshold: number,
  element?: HTMLElement | null,
): boolean {
  const [isPast, setIsPast] = useState(false);
  const lastStateRef = useRef(false);

  useRAFScroll(
    useCallback(
      (state: ScrollState) => {
        const newState = state.scrollY > threshold;
        if (newState !== lastStateRef.current) {
          lastStateRef.current = newState;
          setIsPast(newState);
        }
      },
      [threshold],
    ),
    { element },
  );

  return isPast;
}

// ============================================================================
// useInfiniteScroll
// ============================================================================

/**
 * Hook for implementing infinite scroll with RAF batching.
 *
 * @param options - Configuration options
 * @returns Object with ref and loading state
 *
 * @example
 * const { ref, canLoadMore } = useInfiniteScroll({
 *   onLoadMore: loadMorePosts,
 *   hasMore: hasNextPage,
 *   threshold: 200
 * });
 *
 * return (
 *   <div ref={ref} className="scroll-container">
 *     {posts.map(renderPost)}
 *     {canLoadMore && <Spinner />}
 *   </div>
 * );
 */
export function useInfiniteScroll(options: {
  /** Callback to load more items */
  onLoadMore: () => void | Promise<void>;
  /** Whether there are more items to load */
  hasMore: boolean;
  /** Whether currently loading */
  isLoading?: boolean;
  /** Distance from bottom to trigger load (default: 200) */
  threshold?: number;
}): {
  ref: (element: HTMLElement | null) => void;
  canLoadMore: boolean;
} {
  const { onLoadMore, hasMore, isLoading = false, threshold = 200 } = options;

  const elementRef = useRef<HTMLElement | null>(null);
  const [element, setElement] = useState<HTMLElement | null>(null);

  // Ref callback to track element
  const refCallback = useCallback((el: HTMLElement | null) => {
    elementRef.current = el;
    setElement(el);
  }, []);

  // Track if we can load more
  const canLoadMore = hasMore && !isLoading;

  // Keep callback ref stable
  const onLoadMoreRef = useRef(onLoadMore);
  onLoadMoreRef.current = onLoadMore;

  useRAFScroll(
    useCallback(
      (_state: ScrollState) => {
        if (!canLoadMore || !elementRef.current) return;

        const el = elementRef.current;
        const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;

        if (distanceFromBottom < threshold) {
          onLoadMoreRef.current();
        }
      },
      [canLoadMore, threshold],
    ),
    { element },
  );

  return {
    ref: refCallback,
    canLoadMore,
  };
}

// ============================================================================
// useScrollPerformanceOptimized
// ============================================================================

/**
 * Enhanced scroll performance hook that combines RAF batching with
 * pointer-events optimization.
 *
 * @param element - Element to optimize scroll for
 * @param options - Performance options
 * @returns Object with isScrolling state
 *
 * @example
 * const containerRef = useRef<HTMLDivElement>(null);
 * const { isScrolling } = useScrollPerformanceOptimized(containerRef.current);
 */
export function useScrollPerformanceOptimized(
  element: HTMLElement | null,
  options: {
    /** Disable pointer events during scroll (default: true) */
    disablePointerEvents?: boolean;
  } = {},
): { isScrolling: boolean } {
  const { disablePointerEvents = true } = options;

  const [isScrolling, setIsScrolling] = useState(false);
  const scrollingRef = useRef(false);

  useRAFScroll(
    useCallback(
      (state: ScrollState) => {
        const wasScrolling = scrollingRef.current;
        scrollingRef.current = state.isScrolling;

        // Update state only on change
        if (state.isScrolling !== wasScrolling) {
          setIsScrolling(state.isScrolling);

          // Manage pointer events
          if (disablePointerEvents) {
            if (state.isScrolling) {
              document.body.style.pointerEvents = "none";
            } else {
              document.body.style.pointerEvents = "";
            }
          }
        }
      },
      [disablePointerEvents],
    ),
    { element },
  );

  // Cleanup pointer events on unmount
  useEffect(() => {
    return () => {
      if (disablePointerEvents) {
        document.body.style.pointerEvents = "";
      }
    };
  }, [disablePointerEvents]);

  return { isScrolling };
}
