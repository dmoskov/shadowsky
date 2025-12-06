/**
 * React Hook for Input Debouncing Service
 *
 * Provides React-friendly access to the Input Debouncing Service
 * with automatic cleanup and memoization.
 *
 * @module hooks/useInputDebouncing
 */

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  inputDebouncingService,
  type InteractionType,
  type InteractionConfig,
  type InteractionMetrics,
  type DebouncedFunction,
  type ThrottledFunction,
} from "../services/input-debouncing-service";

/**
 * Hook to create a debounced callback for a specific interaction type.
 *
 * @param callback - The callback function to debounce
 * @param type - The interaction type (affects default delay and behavior)
 * @param customDelay - Optional custom delay to override the default
 * @returns Debounced function with cancel, flush, and pending methods
 *
 * @example
 * function SearchInput() {
 *   const [query, setQuery] = useState('');
 *
 *   const debouncedSearch = useDebouncedInteraction(
 *     (value: string) => performSearch(value),
 *     'searching'
 *   );
 *
 *   const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
 *     setQuery(e.target.value);
 *     debouncedSearch(e.target.value);
 *   };
 *
 *   return <input value={query} onChange={handleChange} />;
 * }
 */
export function useDebouncedInteraction<T extends (...args: unknown[]) => unknown>(
  callback: T,
  type: InteractionType = "custom",
  customDelay?: number
): DebouncedFunction<T> {
  const callbackRef = useRef(callback);
  const debouncedRef = useRef<DebouncedFunction<T> | null>(null);

  // Keep callback ref updated
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Create debounced function once
  useEffect(() => {
    debouncedRef.current = inputDebouncingService.debounce(
      ((...args: Parameters<T>) => callbackRef.current(...args)) as T,
      type,
      customDelay
    );

    return () => {
      debouncedRef.current?.cancel();
    };
  }, [type, customDelay]);

  // Stable wrapper that uses the ref
  const debouncedFn = useCallback(
    ((...args: Parameters<T>) => {
      debouncedRef.current?.(...args);
    }) as DebouncedFunction<T>,
    []
  );

  // Add control methods
  (debouncedFn as DebouncedFunction<T>).cancel = useCallback(() => {
    debouncedRef.current?.cancel();
  }, []);

  (debouncedFn as DebouncedFunction<T>).flush = useCallback(() => {
    debouncedRef.current?.flush();
  }, []);

  (debouncedFn as DebouncedFunction<T>).pending = useCallback(() => {
    return debouncedRef.current?.pending() ?? false;
  }, []);

  return debouncedFn as DebouncedFunction<T>;
}

/**
 * Hook to create a throttled callback for a specific interaction type.
 *
 * @param callback - The callback function to throttle
 * @param type - The interaction type (affects default interval and behavior)
 * @param customInterval - Optional custom interval to override the default
 * @returns Throttled function with cancel method
 *
 * @example
 * function ScrollTracker() {
 *   const throttledTrack = useThrottledInteraction(
 *     () => trackScrollPosition(),
 *     'scrolling'
 *   );
 *
 *   useEffect(() => {
 *     window.addEventListener('scroll', throttledTrack);
 *     return () => window.removeEventListener('scroll', throttledTrack);
 *   }, [throttledTrack]);
 * }
 */
export function useThrottledInteraction<T extends (...args: unknown[]) => unknown>(
  callback: T,
  type: InteractionType = "scrolling",
  customInterval?: number
): ThrottledFunction<T> {
  const callbackRef = useRef(callback);
  const throttledRef = useRef<ThrottledFunction<T> | null>(null);

  // Keep callback ref updated
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Create throttled function once
  useEffect(() => {
    throttledRef.current = inputDebouncingService.throttle(
      ((...args: Parameters<T>) => callbackRef.current(...args)) as T,
      type,
      customInterval
    );

    return () => {
      throttledRef.current?.cancel();
    };
  }, [type, customInterval]);

  // Stable wrapper
  const throttledFn = useCallback(
    ((...args: Parameters<T>) => {
      throttledRef.current?.(...args);
    }) as ThrottledFunction<T>,
    []
  );

  // Add cancel method
  (throttledFn as ThrottledFunction<T>).cancel = useCallback(() => {
    throttledRef.current?.cancel();
  }, []);

  return throttledFn as ThrottledFunction<T>;
}

/**
 * Hook to get interaction configuration for a specific type.
 *
 * @param type - The interaction type
 * @returns The configuration for the interaction type
 *
 * @example
 * function DebugPanel() {
 *   const typingConfig = useInteractionConfig('typing');
 *   return <div>Typing delay: {typingConfig.debounceDelay}ms</div>;
 * }
 */
export function useInteractionConfig(type: InteractionType): InteractionConfig {
  return useMemo(() => inputDebouncingService.getConfig(type), [type]);
}

/**
 * Hook to get the effective delay for an interaction type.
 * Takes into account device capabilities and adaptive settings.
 *
 * @param type - The interaction type
 * @returns The effective delay in milliseconds
 *
 * @example
 * function StatusDisplay() {
 *   const searchDelay = useEffectiveDelay('searching');
 *   return <div>Search results will appear after {searchDelay}ms</div>;
 * }
 */
export function useEffectiveDelay(type: InteractionType): number {
  return useMemo(() => inputDebouncingService.getEffectiveDelay(type), [type]);
}

/**
 * Hook to get interaction metrics for a specific type.
 *
 * @param type - The interaction type
 * @returns The metrics for the interaction type, or undefined if not available
 *
 * @example
 * function MetricsDisplay() {
 *   const typingMetrics = useInteractionMetrics('typing');
 *   if (!typingMetrics) return null;
 *   return <div>Total typing calls: {typingMetrics.totalCalls}</div>;
 * }
 */
export function useInteractionMetrics(
  type: InteractionType
): InteractionMetrics | undefined {
  return useMemo(() => inputDebouncingService.getMetrics(type), [type]);
}

/**
 * Hook to access the full input debouncing service API.
 *
 * @returns Object with service methods
 *
 * @example
 * function PerformancePanel() {
 *   const { generateReport, resetMetrics, isDeviceLowEnd } = useInputDebouncingService();
 *
 *   const report = generateReport();
 *   return (
 *     <div>
 *       <p>Low-end device: {isDeviceLowEnd() ? 'Yes' : 'No'}</p>
 *       <button onClick={() => resetMetrics()}>Reset Metrics</button>
 *     </div>
 *   );
 * }
 */
export function useInputDebouncingService() {
  return useMemo(
    () => ({
      /** Configure the service */
      configure: inputDebouncingService.configure.bind(inputDebouncingService),
      /** Get configuration for an interaction type */
      getConfig: inputDebouncingService.getConfig.bind(inputDebouncingService),
      /** Get effective delay for an interaction type */
      getEffectiveDelay: inputDebouncingService.getEffectiveDelay.bind(
        inputDebouncingService
      ),
      /** Get metrics for an interaction type */
      getMetrics: inputDebouncingService.getMetrics.bind(inputDebouncingService),
      /** Get all metrics */
      getAllMetrics: inputDebouncingService.getAllMetrics.bind(
        inputDebouncingService
      ),
      /** Reset metrics */
      resetMetrics: inputDebouncingService.resetMetrics.bind(
        inputDebouncingService
      ),
      /** Cancel all pending interactions */
      cancelAll: inputDebouncingService.cancelAll.bind(inputDebouncingService),
      /** Check if device is low-end */
      isDeviceLowEnd: inputDebouncingService.isDeviceLowEnd.bind(
        inputDebouncingService
      ),
      /** Get performance multiplier */
      getPerformanceMultiplier:
        inputDebouncingService.getPerformanceMultiplier.bind(
          inputDebouncingService
        ),
      /** Generate performance report */
      generateReport: inputDebouncingService.generateReport.bind(
        inputDebouncingService
      ),
    }),
    []
  );
}

/**
 * Hook for debouncing typing interactions specifically.
 * Convenience wrapper with typing-optimized defaults.
 *
 * @param callback - The callback to debounce
 * @param customDelay - Optional custom delay (default: 150ms)
 * @returns Debounced function
 *
 * @example
 * function TextInput() {
 *   const debouncedSave = useTypingDebounce((text: string) => saveText(text));
 *   return <input onChange={e => debouncedSave(e.target.value)} />;
 * }
 */
export function useTypingDebounce<T extends (...args: unknown[]) => unknown>(
  callback: T,
  customDelay?: number
): DebouncedFunction<T> {
  return useDebouncedInteraction(callback, "typing", customDelay);
}

/**
 * Hook for debouncing search interactions specifically.
 * Convenience wrapper with search-optimized defaults (longer delay).
 *
 * @param callback - The callback to debounce
 * @param customDelay - Optional custom delay (default: 300ms)
 * @returns Debounced function
 *
 * @example
 * function SearchBox() {
 *   const debouncedSearch = useSearchDebounce((query: string) => search(query));
 *   return <input onChange={e => debouncedSearch(e.target.value)} />;
 * }
 */
export function useSearchDebounce<T extends (...args: unknown[]) => unknown>(
  callback: T,
  customDelay?: number
): DebouncedFunction<T> {
  return useDebouncedInteraction(callback, "searching", customDelay);
}

/**
 * Hook for throttling scroll interactions specifically.
 * Convenience wrapper with scroll-optimized defaults (~60fps).
 *
 * @param callback - The callback to throttle
 * @param customInterval - Optional custom interval (default: 16ms)
 * @returns Throttled function
 *
 * @example
 * function InfiniteScroll() {
 *   const throttledCheck = useScrollThrottle(() => checkIfNearBottom());
 *
 *   useEffect(() => {
 *     window.addEventListener('scroll', throttledCheck);
 *     return () => window.removeEventListener('scroll', throttledCheck);
 *   }, [throttledCheck]);
 * }
 */
export function useScrollThrottle<T extends (...args: unknown[]) => unknown>(
  callback: T,
  customInterval?: number
): ThrottledFunction<T> {
  return useThrottledInteraction(callback, "scrolling", customInterval);
}

/**
 * Hook for throttling resize interactions specifically.
 * Convenience wrapper with resize-optimized defaults.
 *
 * @param callback - The callback to debounce
 * @param customDelay - Optional custom delay (default: 150ms)
 * @returns Debounced function
 *
 * @example
 * function ResponsiveLayout() {
 *   const debouncedResize = useResizeDebounce(() => recalculateLayout());
 *
 *   useEffect(() => {
 *     window.addEventListener('resize', debouncedResize);
 *     return () => window.removeEventListener('resize', debouncedResize);
 *   }, [debouncedResize]);
 * }
 */
export function useResizeDebounce<T extends (...args: unknown[]) => unknown>(
  callback: T,
  customDelay?: number
): DebouncedFunction<T> {
  return useDebouncedInteraction(callback, "resizing", customDelay);
}
