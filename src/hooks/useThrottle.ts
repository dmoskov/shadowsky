/**
 * Throttle Hook
 *
 * Re-exports throttle-related hooks from the centralized timing utilities.
 * This file is maintained for backward compatibility.
 *
 * @deprecated Use hooks from './useTiming' directly.
 */

import { TIMING } from "../utils/timing";
import { useDebouncedCallback, useThrottledCallback } from "./useTiming";

/**
 * Hook that throttles a function to prevent excessive calls.
 * Useful for reducing re-renders and improving mobile performance.
 *
 * @param fn - Function to throttle
 * @param delay - Minimum time between calls in milliseconds
 * @returns Throttled function
 *
 * @deprecated Use useThrottledCallback from './useTiming' directly.
 *
 * @example
 * const throttledUpdate = useThrottle((value) => {
 *   updatePosition(value);
 * }, 100);
 */
export function useThrottle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number = TIMING.THROTTLE_INTERVAL,
): T {
  return useThrottledCallback(fn, delay);
}

/**
 * Hook that debounces a function to prevent rapid successive calls.
 *
 * @param fn - Function to debounce
 * @param delay - Delay in milliseconds
 * @returns Debounced function
 *
 * @deprecated Use useDebouncedCallback from './useTiming' directly.
 *
 * @example
 * const debouncedSearch = useDebounce((query) => {
 *   performSearch(query);
 * }, 300);
 */
export function useDebounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number = TIMING.DEBOUNCE_DELAY,
): T {
  return useDebouncedCallback(fn, delay);
}

// Re-export the hooks with their canonical names
export { useDebouncedCallback, useThrottledCallback };
