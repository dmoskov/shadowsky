/**
 * usePageVisibility Hook
 *
 * Returns whether the page is currently visible. Used to gate polling intervals
 * so that React Query refetchInterval timers don't fire when the tab is hidden.
 *
 * Usage:
 *   const isVisible = usePageVisibility();
 *   useQuery({ refetchInterval: isVisible ? 30_000 : false, ... });
 */

import { useEffect, useState } from "react";

export function usePageVisibility(): boolean {
  const [isVisible, setIsVisible] = useState(
    typeof document !== "undefined" ? !document.hidden : true,
  );

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsVisible(!document.hidden);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return isVisible;
}
