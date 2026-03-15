import { useCallback, useEffect, useRef, useState } from "react";

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

  // Reset visible count only when feed fundamentally changes (e.g., feed switch)
  // Use a stable identity key to avoid resetting on background refetches
  // which create new object references for the same data.
  const getItemKey = useCallback((item: T): string => {
    if (item && typeof item === "object" && "post" in item) {
      return (item as { post: { uri: string } }).post.uri;
    }
    return String(item);
  }, []);

  const firstItemKeyRef = useRef<string>("");
  const itemsLengthRef = useRef(items.length);
  useEffect(() => {
    const currentKey = items.length > 0 ? getItemKey(items[0]) : "";
    const lengthChangedSignificantly =
      Math.abs(items.length - itemsLengthRef.current) >
      Math.max(itemsLengthRef.current * 0.5, 10);

    // Only reset if the first item's identity changed (feed switch)
    // NOT on background refetches that return the same posts
    if (
      firstItemKeyRef.current &&
      currentKey &&
      currentKey !== firstItemKeyRef.current
    ) {
      setVisibleCount(initialLoad);
    } else if (
      lengthChangedSignificantly &&
      items.length < itemsLengthRef.current
    ) {
      // Only reset on significant shrink (page cleanup), not growth
      setVisibleCount(initialLoad);
    }

    firstItemKeyRef.current = currentKey;
    itemsLengthRef.current = items.length;
  }, [items, initialLoad, getItemKey]);

  return {
    visibleItems: items.slice(0, visibleCount),
    loadMoreRef,
    hasMore: visibleCount < items.length,
    totalItems: items.length,
    visibleCount,
  };
}
