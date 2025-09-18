import { useCallback, useRef } from "react";

/**
 * Hook that throttles a function to prevent excessive calls
 * Useful for reducing re-renders and improving mobile performance
 */
export function useThrottle<T extends (...args: any[]) => any>(
  fn: T,
  delay: number,
): T {
  const lastCall = useRef<number>(0);
  const lastCallTimer = useRef<NodeJS.Timeout>();

  return useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now();

      if (now - lastCall.current >= delay) {
        lastCall.current = now;
        return fn(...args);
      }

      // Clear any pending throttled call
      if (lastCallTimer.current) {
        clearTimeout(lastCallTimer.current);
      }

      // Schedule call at the end of the throttle period
      lastCallTimer.current = setTimeout(
        () => {
          lastCall.current = Date.now();
          fn(...args);
        },
        delay - (now - lastCall.current),
      );
    },
    [fn, delay],
  ) as T;
}

/**
 * Hook that debounces a function to prevent rapid successive calls
 */
export function useDebounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number,
): T {
  const timer = useRef<NodeJS.Timeout>();

  return useCallback(
    (...args: Parameters<T>) => {
      if (timer.current) {
        clearTimeout(timer.current);
      }

      timer.current = setTimeout(() => {
        fn(...args);
      }, delay);
    },
    [fn, delay],
  ) as T;
}
