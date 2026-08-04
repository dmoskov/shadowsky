import { useEffect, useRef, useState } from "react";

/**
 * Tracks whether an element has ever come near the viewport.
 *
 * Latches: once true it stays true, so scrolling a deck column out of view
 * doesn't tear down its data. The point is to avoid fetching columns the user
 * has never looked at, not to unload the ones they have.
 *
 * Falls back to true wherever IntersectionObserver is unavailable (jsdom in
 * tests, older browsers) — better to load eagerly than to render nothing.
 *
 * @param rootMargin How early to trigger. The default starts a column loading
 *   just before it scrolls into view, so it feels instant rather than lazy.
 */
export function useHasBeenVisible<T extends Element = HTMLDivElement>(
  rootMargin = "300px",
) {
  const ref = useRef<T | null>(null);
  const [hasBeenVisible, setHasBeenVisible] = useState(false);

  useEffect(() => {
    if (hasBeenVisible) return; // Latched — nothing left to watch.

    if (typeof IntersectionObserver === "undefined") {
      setHasBeenVisible(true);
      return;
    }

    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setHasBeenVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [hasBeenVisible, rootMargin]);

  return { ref, hasBeenVisible };
}
