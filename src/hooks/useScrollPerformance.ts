import { useScrollPerformanceOptimized } from "./useRAFScroll";

interface ScrollPerformanceOptions {
  /** Enable passive scrolling for better performance (now always true with RAF batching) */
  passive?: boolean;
  /** Throttle scroll events (ms) - deprecated, RAF batching handles this */
  throttle?: number;
  /** Disable pointer events during scroll */
  disablePointerEventsOnScroll?: boolean;
}

/**
 * Hook to optimize scroll performance on mobile devices
 * Now uses RAF batching service for smooth 60fps scrolling
 *
 * @deprecated Use useScrollPerformanceOptimized from useRAFScroll.ts directly
 */
export function useScrollPerformance(
  element: HTMLElement | null,
  options: ScrollPerformanceOptions = {},
) {
  const { disablePointerEventsOnScroll = true } = options;

  // Delegate to RAF-based implementation
  return useScrollPerformanceOptimized(element, {
    disablePointerEvents: disablePointerEventsOnScroll,
  });
}

// Note: usePrefersReducedMotion has moved to AccessibilityContext
// Re-export for backward compatibility
export { usePrefersReducedMotion } from "../contexts/AccessibilityContext";
