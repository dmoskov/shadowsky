import { useEffect, useRef, useState } from "react";

interface UseIntersectionLoaderOptions {
  threshold?: number;
  rootMargin?: string;
  initialLoad?: number;
  increment?: number;
}

/**
 * Hook to progressively load items as user scrolls
 * Alternative to full virtualization that's more reliable
 */
export function useIntersectionLoader<T>(
  items: T[],
  options: UseIntersectionLoaderOptions = {},
) {
  const {
    threshold = 0.1,
    rootMargin = "400px", // Load more posts 400px before reaching the bottom
    initialLoad = window.innerWidth < 768 ? 10 : 20,
    increment = window.innerWidth < 768 ? 10 : 20,
  } = options;

  const [visibleCount, setVisibleCount] = useState(initialLoad);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && visibleCount < items.length) {
          // Load more items
          setVisibleCount((prev) => Math.min(prev + increment, items.length));
        }
      },
      {
        threshold,
        rootMargin,
      },
    );

    const currentRef = loadMoreRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
      observer.disconnect();
    };
  }, [visibleCount, items.length, increment, threshold, rootMargin]);

  // Reset visible count when items change significantly (e.g., feed switch)
  const itemsLengthRef = useRef(items.length);
  const firstItemRef = useRef(items[0]);
  useEffect(() => {
    // Only reset if the items list has fundamentally changed (not just a new reference)
    const firstItemChanged = items[0] !== firstItemRef.current;
    const lengthChangedSignificantly =
      Math.abs(items.length - itemsLengthRef.current) >
      itemsLengthRef.current * 0.5;
    if (firstItemChanged || lengthChangedSignificantly) {
      setVisibleCount(initialLoad);
    }
    itemsLengthRef.current = items.length;
    firstItemRef.current = items[0];
  }, [items.length, items[0], initialLoad]);

  return {
    visibleItems: items.slice(0, visibleCount),
    loadMoreRef,
    hasMore: visibleCount < items.length,
    totalItems: items.length,
    visibleCount,
  };
}
