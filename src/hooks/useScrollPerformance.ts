import { useEffect, useRef } from "react";

interface ScrollPerformanceOptions {
  /** Enable passive scrolling for better performance */
  passive?: boolean;
  /** Throttle scroll events (ms) */
  throttle?: number;
  /** Disable pointer events during scroll */
  disablePointerEventsOnScroll?: boolean;
}

/**
 * Hook to optimize scroll performance on mobile devices
 * Reduces jank and improves smoothness
 */
export function useScrollPerformance(
  element: HTMLElement | null,
  options: ScrollPerformanceOptions = {},
) {
  const {
    passive = true,
    throttle = 16, // ~60fps
    disablePointerEventsOnScroll = true,
  } = options;

  const scrollTimer = useRef<NodeJS.Timeout>();
  const isScrolling = useRef(false);

  useEffect(() => {
    if (!element) return;

    let lastScrollTime = 0;

    const handleScroll = (_e: Event) => {
      const now = Date.now();

      // Throttle scroll events
      if (throttle && now - lastScrollTime < throttle) {
        return;
      }
      lastScrollTime = now;

      // Disable pointer events during scroll for better performance
      if (disablePointerEventsOnScroll && !isScrolling.current) {
        isScrolling.current = true;
        document.body.style.pointerEvents = "none";
      }

      // Re-enable pointer events after scroll stops
      if (scrollTimer.current) {
        clearTimeout(scrollTimer.current);
      }

      scrollTimer.current = setTimeout(() => {
        if (disablePointerEventsOnScroll) {
          document.body.style.pointerEvents = "";
          isScrolling.current = false;
        }
      }, 150);
    };

    // Use passive event listener for better scroll performance
    element.addEventListener("scroll", handleScroll, { passive });

    return () => {
      element.removeEventListener("scroll", handleScroll);
      if (scrollTimer.current) {
        clearTimeout(scrollTimer.current);
      }
      // Reset pointer events on cleanup
      if (disablePointerEventsOnScroll) {
        document.body.style.pointerEvents = "";
      }
    };
  }, [element, passive, throttle, disablePointerEventsOnScroll]);

  return {
    isScrolling: isScrolling.current,
  };
}

// Note: usePrefersReducedMotion has moved to AccessibilityContext
// Re-export for backward compatibility
export { usePrefersReducedMotion } from "../contexts/AccessibilityContext";
