/**
 * Debounce Hook
 *
 * Re-exports the useDelayedValue hook from the centralized timing utilities.
 * This file is maintained for backward compatibility.
 *
 * @deprecated Use useDelayedValue from './useTiming' directly.
 */

import { useDelayedValue } from "./useTiming";

/**
 * Debounces a value by delaying updates until a specified time has passed.
 *
 * @param value - The value to debounce
 * @param delay - Delay in milliseconds
 * @returns The debounced value
 *
 * @deprecated Use useDelayedValue from './useTiming' directly.
 *
 * @example
 * const [query, setQuery] = useState('');
 * const debouncedQuery = useDebounce(query, 300);
 *
 * useEffect(() => {
 *   if (debouncedQuery) {
 *     performSearch(debouncedQuery);
 *   }
 * }, [debouncedQuery]);
 */
export function useDebounce<T>(value: T, delay: number): T {
  return useDelayedValue(value, delay);
}

// Re-export the hook with its canonical name
export { useDelayedValue };
