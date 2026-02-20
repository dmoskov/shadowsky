/**
 * Hook to propagate async errors into the nearest React error boundary.
 *
 * React error boundaries only catch errors thrown during rendering. Errors in
 * event handlers, useEffect callbacks, setTimeout, or async functions are NOT
 * caught. This hook provides a function that forces a re-render with the error
 * so the nearest ErrorBoundary can catch it.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const throwToErrorBoundary = useAsyncErrorBoundary();
 *
 *   const handleClick = async () => {
 *     try {
 *       await riskyOperation();
 *     } catch (error) {
 *       throwToErrorBoundary(error);
 *     }
 *   };
 *
 *   return <button onClick={handleClick}>Do something</button>;
 * }
 * ```
 */

import { useCallback, useState } from "react";

export function useAsyncErrorBoundary(): (error: unknown) => void {
  const [, setError] = useState<unknown>();

  return useCallback((error: unknown) => {
    setError(() => {
      throw error instanceof Error ? error : new Error(String(error));
    });
  }, []);
}
