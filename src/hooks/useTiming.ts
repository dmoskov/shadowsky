/**
 * Timing Hooks
 *
 * React hooks for common timing patterns like debouncing, throttling,
 * delayed values, and minimum duration enforcement.
 *
 * These hooks centralize timing-related logic to ensure consistent behavior
 * across the application and reduce code duplication.
 *
 * @module hooks/useTiming
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { getRemainingTime, TIMING, type TimeoutId } from "../utils/timing";

// ============================================================================
// useDelayedValue
// ============================================================================

/**
 * Delays updating a value until a specified delay has passed since the last change.
 * Useful for debouncing user input before triggering expensive operations.
 *
 * @param value - The value to debounce
 * @param delay - Delay in milliseconds (default: TIMING.DEBOUNCE_DELAY)
 * @returns The debounced value
 *
 * @example
 * function SearchInput() {
 *   const [query, setQuery] = useState('');
 *   const debouncedQuery = useDelayedValue(query, 300);
 *
 *   useEffect(() => {
 *     if (debouncedQuery) {
 *       performSearch(debouncedQuery);
 *     }
 *   }, [debouncedQuery]);
 *
 *   return <input value={query} onChange={e => setQuery(e.target.value)} />;
 * }
 */
export function useDelayedValue<T>(
  value: T,
  delay: number = TIMING.DEBOUNCE_DELAY,
): T {
  const [delayedValue, setDelayedValue] = useState<T>(value);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDelayedValue(value);
    }, delay);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [value, delay]);

  return delayedValue;
}

// ============================================================================
// useMinDuration
// ============================================================================

/**
 * Enforces a minimum duration for a boolean state.
 * When the input becomes true, ensures it stays true for at least the minimum duration.
 * Useful for preventing flash of loading states.
 *
 * @param isActive - The boolean state to enforce minimum duration on
 * @param minDuration - Minimum duration in milliseconds (default: TIMING.MIN_LOADING_DURATION)
 * @returns The state with minimum duration enforced
 *
 * @example
 * function LoadingButton() {
 *   const { isLoading, submit } = useSubmit();
 *   const showLoading = useMinDuration(isLoading, 300);
 *
 *   return (
 *     <button onClick={submit} disabled={showLoading}>
 *       {showLoading ? 'Loading...' : 'Submit'}
 *     </button>
 *   );
 * }
 */
export function useMinDuration(
  isActive: boolean,
  minDuration: number = TIMING.MIN_LOADING_DURATION,
): boolean {
  const [showActive, setShowActive] = useState(isActive);
  const startTimeRef = useRef<number | null>(null);
  const timeoutRef = useRef<TimeoutId | null>(null);

  useEffect(() => {
    if (isActive) {
      // Started - record start time
      startTimeRef.current = Date.now();
      setShowActive(true);
    } else if (startTimeRef.current !== null) {
      // Ended - check if min duration has passed
      const remaining = getRemainingTime(startTimeRef.current, minDuration);

      if (remaining > 0) {
        timeoutRef.current = setTimeout(() => {
          setShowActive(false);
          startTimeRef.current = null;
        }, remaining);
      } else {
        setShowActive(false);
        startTimeRef.current = null;
      }
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isActive, minDuration]);

  return showActive;
}

// ============================================================================
// useDelayedBoolean
// ============================================================================

/**
 * Delays showing a true state until after a specified delay.
 * When the input becomes true, waits before updating the output.
 * When the input becomes false, immediately updates the output.
 * Useful for preventing flash of loading indicators for quick operations.
 *
 * @param value - The boolean value to delay
 * @param delay - Delay in milliseconds (default: TIMING.LOADING_DELAY)
 * @returns The delayed boolean value
 *
 * @example
 * function LoadingIndicator({ isLoading }) {
 *   // Only show loading after 150ms to prevent flash for quick loads
 *   const showLoading = useDelayedBoolean(isLoading, 150);
 *
 *   if (!showLoading) return null;
 *   return <Spinner />;
 * }
 */
export function useDelayedBoolean(
  value: boolean,
  delay: number = TIMING.LOADING_DELAY,
): boolean {
  const [delayedValue, setDelayedValue] = useState(false);
  const timeoutRef = useRef<TimeoutId | null>(null);

  useEffect(() => {
    if (value) {
      timeoutRef.current = setTimeout(() => {
        setDelayedValue(true);
      }, delay);
    } else {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      setDelayedValue(false);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [value, delay]);

  return delayedValue;
}

// ============================================================================
// useCancellableTimeout
// ============================================================================

/**
 * Manages a cancellable timeout.
 * Returns functions to schedule and cancel the timeout.
 *
 * @returns Object with schedule, cancel, and isPending functions
 *
 * @example
 * function AutoSave() {
 *   const { schedule, cancel, isPending } = useCancellableTimeout();
 *
 *   const handleChange = (content) => {
 *     setContent(content);
 *     schedule(() => saveToServer(content), 2000);
 *   };
 *
 *   return (
 *     <>
 *       <textarea onChange={e => handleChange(e.target.value)} />
 *       {isPending() && <span>Saving...</span>}
 *     </>
 *   );
 * }
 */
export function useCancellableTimeout(): {
  schedule: (callback: () => void, delay: number) => void;
  cancel: () => void;
  isPending: () => boolean;
} {
  const timeoutRef = useRef<TimeoutId | null>(null);
  const isPendingRef = useRef(false);

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    isPendingRef.current = false;
  }, []);

  const schedule = useCallback(
    (callback: () => void, delay: number) => {
      cancel();
      isPendingRef.current = true;
      timeoutRef.current = setTimeout(() => {
        isPendingRef.current = false;
        timeoutRef.current = null;
        callback();
      }, delay);
    },
    [cancel],
  );

  const isPending = useCallback(() => isPendingRef.current, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancel();
    };
  }, [cancel]);

  return { schedule, cancel, isPending };
}

// ============================================================================
// useDebouncedCallback
// ============================================================================

/**
 * Creates a debounced version of a callback function.
 * The callback will only be invoked after the specified delay has passed
 * since the last call.
 *
 * @param callback - The callback function to debounce
 * @param delay - Delay in milliseconds (default: TIMING.DEBOUNCE_DELAY)
 * @returns The debounced callback function
 *
 * @example
 * function SearchInput() {
 *   const debouncedSearch = useDebouncedCallback(
 *     (query) => performSearch(query),
 *     300
 *   );
 *
 *   return <input onChange={e => debouncedSearch(e.target.value)} />;
 * }
 */
export function useDebouncedCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number = TIMING.DEBOUNCE_DELAY,
): T {
  const timeoutRef = useRef<TimeoutId | null>(null);

  const debouncedFn = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    },
    [callback, delay],
  ) as T;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedFn;
}

// ============================================================================
// useThrottledCallback
// ============================================================================

/**
 * Creates a throttled version of a callback function.
 * The callback will be invoked at most once per the specified interval.
 *
 * @param callback - The callback function to throttle
 * @param interval - Minimum time between calls in milliseconds (default: TIMING.THROTTLE_INTERVAL)
 * @returns The throttled callback function
 *
 * @example
 * function ScrollTracker() {
 *   const throttledTrack = useThrottledCallback(
 *     () => trackScrollPosition(),
 *     100
 *   );
 *
 *   useEffect(() => {
 *     window.addEventListener('scroll', throttledTrack);
 *     return () => window.removeEventListener('scroll', throttledTrack);
 *   }, [throttledTrack]);
 * }
 */
export function useThrottledCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  interval: number = TIMING.THROTTLE_INTERVAL,
): T {
  const lastCallRef = useRef<number>(0);
  const pendingTimeoutRef = useRef<TimeoutId | null>(null);

  const throttledFn = useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now();

      if (now - lastCallRef.current >= interval) {
        lastCallRef.current = now;
        return callback(...args);
      }

      // Schedule a trailing call
      if (pendingTimeoutRef.current) {
        clearTimeout(pendingTimeoutRef.current);
      }

      pendingTimeoutRef.current = setTimeout(
        () => {
          lastCallRef.current = Date.now();
          callback(...args);
          pendingTimeoutRef.current = null;
        },
        interval - (now - lastCallRef.current),
      );
    },
    [callback, interval],
  ) as T;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pendingTimeoutRef.current) {
        clearTimeout(pendingTimeoutRef.current);
      }
    };
  }, []);

  return throttledFn;
}

// ============================================================================
// useInterval
// ============================================================================

/**
 * Sets up an interval that automatically cleans up on unmount.
 * The interval is also reset when the callback or delay changes.
 *
 * @param callback - The callback to run on each interval
 * @param delay - Delay in milliseconds, or null to pause the interval
 *
 * @example
 * function PollingComponent() {
 *   const [data, setData] = useState(null);
 *
 *   useInterval(async () => {
 *     const newData = await fetchData();
 *     setData(newData);
 *   }, 5000); // Poll every 5 seconds
 * }
 */
export function useInterval(callback: () => void, delay: number | null): void {
  const savedCallback = useRef(callback);

  // Remember the latest callback
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the interval
  useEffect(() => {
    if (delay === null) {
      return;
    }

    const tick = () => {
      savedCallback.current();
    };

    const id = setInterval(tick, delay);
    return () => clearInterval(id);
  }, [delay]);
}

// ============================================================================
// useTimeout
// ============================================================================

/**
 * Sets up a timeout that automatically cleans up on unmount.
 * The timeout is reset when the callback or delay changes.
 *
 * @param callback - The callback to run after the delay
 * @param delay - Delay in milliseconds, or null to disable the timeout
 *
 * @example
 * function Notification({ message, onDismiss }) {
 *   // Auto-dismiss after 5 seconds
 *   useTimeout(onDismiss, 5000);
 *
 *   return <div>{message}</div>;
 * }
 */
export function useTimeout(callback: () => void, delay: number | null): void {
  const savedCallback = useRef(callback);

  // Remember the latest callback
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the timeout
  useEffect(() => {
    if (delay === null) {
      return;
    }

    const id = setTimeout(() => {
      savedCallback.current();
    }, delay);

    return () => clearTimeout(id);
  }, [delay]);
}
