/**
 * Scroll state tracking for pausing background work during active scrolling.
 *
 * Uses a module-level external store (compatible with useSyncExternalStore)
 * so any hook can subscribe without requiring a React context provider.
 *
 * FeedList calls `setScrolling(true)` on scroll start and `setScrolling(false)`
 * after scroll settles. A 5-second debounce ensures brief pauses during
 * momentum scrolling don't prematurely resume polling.
 */

import {useCallback, useSyncExternalStore} from 'react';

// --- Module-level store ---

let isScrolling = false;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

const SCROLL_SETTLE_DELAY = 5000; // 5s after scroll ends before resuming polling

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): boolean {
  return isScrolling;
}

/**
 * Mark scrolling as active. Clears any pending settle timer.
 */
function scrollStart() {
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  if (!isScrolling) {
    isScrolling = true;
    emitChange();
  }
}

/**
 * Signal that a scroll gesture ended. After SCROLL_SETTLE_DELAY ms
 * without another scrollStart(), marks scrolling as inactive.
 */
function scrollEnd() {
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    if (isScrolling) {
      isScrolling = false;
      emitChange();
    }
  }, SCROLL_SETTLE_DELAY);
}

// --- React hooks ---

/**
 * Subscribe to the current scroll state.
 * Returns true while the user is actively scrolling a feed.
 */
export function useIsScrolling(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Returns stable callbacks for FeedList to report scroll activity.
 */
export function useScrollReporter() {
  const onScrollBeginDrag = useCallback(() => {
    scrollStart();
  }, []);

  const onMomentumScrollEnd = useCallback(() => {
    scrollEnd();
  }, []);

  const onScrollEndDrag = useCallback(() => {
    // Also start the settle timer on drag end, in case
    // there's no momentum phase (e.g., slow scroll release).
    scrollEnd();
  }, []);

  return {onScrollBeginDrag, onMomentumScrollEnd, onScrollEndDrag};
}
