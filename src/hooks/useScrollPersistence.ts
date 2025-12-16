/**
 * useScrollPersistence Hook
 *
 * Automatically saves and restores scroll position for a thread.
 * Uses sessionStorage for persistence across navigation within a session.
 */

import { useEffect, useRef } from "react";
import {
  getPersistedScrollPosition,
  setPersistedScrollPosition,
} from "../utils/thread-helpers";

export interface UseScrollPersistenceOptions {
  threadId: string;
  scrollContainerRef: React.RefObject<HTMLDivElement | null> | undefined;
  focusedIndex: number;
  highlightUri?: string;
  onRestoreScrollPosition?: (focusedIndex: number) => void;
  debounceMs?: number;
}

/**
 * Hook to persist and restore scroll position for a thread
 *
 * @param options - Configuration options
 */
export function useScrollPersistence({
  threadId,
  scrollContainerRef,
  focusedIndex,
  highlightUri,
  onRestoreScrollPosition,
  debounceMs = 150,
}: UseScrollPersistenceOptions): void {
  const hasRestoredScrollPosition = useRef(false);
  const scrollSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Save scroll position on scroll (debounced)
  useEffect(() => {
    if (!threadId || !scrollContainerRef?.current) return;

    const scrollContainer = scrollContainerRef.current;

    const handleScroll = () => {
      // Clear any pending save
      if (scrollSaveTimerRef.current) {
        clearTimeout(scrollSaveTimerRef.current);
      }

      // Debounce the save to avoid excessive writes
      scrollSaveTimerRef.current = setTimeout(() => {
        const scrollTop = scrollContainer.scrollTop;
        setPersistedScrollPosition(threadId, {
          scrollTop,
          focusedIndex,
          timestamp: Date.now(),
        });
      }, debounceMs);
    };

    scrollContainer.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      scrollContainer.removeEventListener("scroll", handleScroll);
      // Clear pending timer on cleanup
      if (scrollSaveTimerRef.current) {
        clearTimeout(scrollSaveTimerRef.current);
      }
    };
  }, [threadId, scrollContainerRef, focusedIndex, debounceMs]);

  // Restore scroll position on mount
  useEffect(() => {
    if (!threadId || hasRestoredScrollPosition.current) return;
    if (!scrollContainerRef?.current) return;
    // Don't restore if there's a highlight URI (user navigated to specific post)
    if (highlightUri) return;

    const savedPosition = getPersistedScrollPosition(threadId);
    if (!savedPosition) return;

    hasRestoredScrollPosition.current = true;

    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      const scrollContainer = scrollContainerRef.current;
      if (!scrollContainer) return;

      // Restore scroll position
      scrollContainer.scrollTop = savedPosition.scrollTop;

      // Restore focused index if we have a callback
      if (savedPosition.focusedIndex >= 0 && onRestoreScrollPosition) {
        onRestoreScrollPosition(savedPosition.focusedIndex);
      }
    });
  }, [threadId, scrollContainerRef, highlightUri, onRestoreScrollPosition]);

  // Save position on unmount/navigation away
  useEffect(() => {
    return () => {
      if (!threadId || !scrollContainerRef?.current) return;

      const scrollContainer = scrollContainerRef.current;
      const scrollTop = scrollContainer.scrollTop;

      // Only save if we've scrolled somewhere meaningful
      if (scrollTop > 0) {
        setPersistedScrollPosition(threadId, {
          scrollTop,
          focusedIndex,
          timestamp: Date.now(),
        });
      }
    };
  }, [threadId, scrollContainerRef, focusedIndex]);
}
