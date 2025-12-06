/**
 * Timing Utilities
 *
 * Centralized timing constants and utility functions for consistent behavior
 * across the application. These utilities help prevent common timing-related
 * issues like flash of loading state, jittery UI updates, and rapid re-renders.
 *
 * For INP-optimized debouncing with adaptive delays, see:
 * - InputDebouncingService: services/input-debouncing-service.ts
 * - React hooks: hooks/useInputDebouncing.ts
 *
 * @module utils/timing
 */

// ============================================================================
// Timing Constants
// ============================================================================

/**
 * Centralized timing configuration for the application.
 * Use these values instead of magic numbers to ensure consistency.
 */
export const TIMING = {
  /** Minimum time to show loading state to prevent flash (ms) */
  MIN_LOADING_DURATION: 300,
  /** Default debounce delay for user input (ms) */
  DEBOUNCE_DELAY: 150,
  /** Default throttle interval (ms) */
  THROTTLE_INTERVAL: 100,
  /** Delay before showing loading indicator for quick operations (ms) */
  LOADING_DELAY: 150,
  /** Delay for prefetch operations to avoid excessive API calls (ms) */
  PREFETCH_DELAY: 100,
  /** Delay for link preview fetching (ms) */
  LINK_PREVIEW_DELAY: 500,
  /** Delay for background pre-generation tasks (ms) */
  PRE_GENERATION_DELAY: 5000,
  /** Service worker state polling interval (ms) */
  SW_POLL_INTERVAL: 5000,
  /** Undo window duration (ms) */
  UNDO_WINDOW: 5000,
  /** Scroll event throttle (approximately 60fps) */
  SCROLL_THROTTLE: 16,
  /** Pointer events re-enable delay after scroll stops (ms) */
  SCROLL_END_DELAY: 150,
} as const;

/**
 * Interaction-specific timing constants.
 * These values are optimized for good INP (Interaction to Next Paint) scores.
 *
 * For adaptive debouncing that responds to device capabilities,
 * use the InputDebouncingService instead.
 *
 * @see services/input-debouncing-service.ts
 */
export const INTERACTION_TIMING = {
  /** Typing debounce delay (ms) - balances responsiveness with performance */
  TYPING: 150,
  /** Click debounce delay (ms) - immediate for critical interactions */
  CLICKING: 0,
  /** Scroll throttle interval (ms) - ~60fps for smooth scrolling */
  SCROLLING: 16,
  /** Resize debounce delay (ms) - allows layout recalculation to batch */
  RESIZING: 150,
  /** Search debounce delay (ms) - longer delay to reduce API calls */
  SEARCHING: 300,
  /** Navigation debounce delay (ms) - quick but prevents double-clicks */
  NAVIGATION: 50,
  /** Media control throttle interval (ms) */
  MEDIA: 100,
  /** Form input debounce delay (ms) */
  FORM: 200,
  /** INP budget target (ms) - Google's threshold for "good" INP */
  INP_BUDGET: 200,
} as const;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Creates a promise that resolves after the specified delay.
 * Useful for adding delays in async operations.
 *
 * @param ms - Delay in milliseconds
 * @returns Promise that resolves after the delay
 *
 * @example
 * await delay(1000); // Wait 1 second
 *
 * @example
 * // Add delay between API calls
 * for (const item of items) {
 *   await processItem(item);
 *   await delay(100);
 * }
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Creates a cancellable timeout.
 * Returns both a promise and a cancel function.
 *
 * @param ms - Delay in milliseconds
 * @returns Object with promise and cancel function
 *
 * @example
 * const { promise, cancel } = cancellableDelay(1000);
 * // Later: cancel() to prevent the timeout from completing
 * await promise;
 */
export function cancellableDelay(ms: number): {
  promise: Promise<boolean>;
  cancel: () => void;
} {
  let timeoutId: ReturnType<typeof setTimeout>;
  let resolvePromise: (value: boolean) => void;

  const promise = new Promise<boolean>((resolve) => {
    resolvePromise = resolve;
    timeoutId = setTimeout(() => {
      resolve(true);
    }, ms);
  });

  const cancel = () => {
    clearTimeout(timeoutId);
    resolvePromise(false);
  };

  return { promise, cancel };
}

/**
 * Calculates remaining time for minimum duration enforcement.
 * Returns 0 if the minimum duration has already passed.
 *
 * @param startTime - Start timestamp (from Date.now())
 * @param minDuration - Minimum duration in milliseconds
 * @returns Remaining time in milliseconds
 *
 * @example
 * const startTime = Date.now();
 * // ... operation completes ...
 * const remaining = getRemainingTime(startTime, TIMING.MIN_LOADING_DURATION);
 * if (remaining > 0) {
 *   await delay(remaining);
 * }
 */
export function getRemainingTime(
  startTime: number,
  minDuration: number,
): number {
  const elapsed = Date.now() - startTime;
  return Math.max(0, minDuration - elapsed);
}

/**
 * Creates a debounced version of a function.
 * The function will only be called after the specified delay
 * has passed since the last invocation.
 *
 * @param fn - Function to debounce
 * @param delay - Delay in milliseconds
 * @returns Debounced function with cancel method
 *
 * @example
 * const debouncedSearch = debounce((query) => search(query), 300);
 * input.addEventListener('input', (e) => debouncedSearch(e.target.value));
 * // Later: debouncedSearch.cancel() to cancel pending invocation
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number,
): T & { cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const debouncedFn = ((...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delay);
  }) as T & { cancel: () => void };

  debouncedFn.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return debouncedFn;
}

/**
 * Creates a throttled version of a function.
 * The function will be called at most once per the specified interval.
 *
 * @param fn - Function to throttle
 * @param interval - Minimum time between calls in milliseconds
 * @returns Throttled function
 *
 * @example
 * const throttledScroll = throttle(() => updatePosition(), 16);
 * window.addEventListener('scroll', throttledScroll);
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  interval: number,
): T {
  let lastCallTime = 0;
  let pendingTimeoutId: ReturnType<typeof setTimeout> | null = null;

  return ((...args: Parameters<T>) => {
    const now = Date.now();

    if (now - lastCallTime >= interval) {
      lastCallTime = now;
      return fn(...args);
    }

    // Schedule a trailing call
    if (pendingTimeoutId) {
      clearTimeout(pendingTimeoutId);
    }

    pendingTimeoutId = setTimeout(
      () => {
        lastCallTime = Date.now();
        fn(...args);
        pendingTimeoutId = null;
      },
      interval - (now - lastCallTime),
    );
  }) as T;
}

/**
 * Type for timeout ID that works across Node.js and browser environments.
 */
export type TimeoutId = ReturnType<typeof setTimeout>;

/**
 * Type for interval ID that works across Node.js and browser environments.
 */
export type IntervalId = ReturnType<typeof setInterval>;
