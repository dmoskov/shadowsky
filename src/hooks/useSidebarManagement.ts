import { useEffect, useState } from "react";
import { appPreferencesService } from "../services/app-preferences-service";
import { useMediaQuery } from "./useMediaQuery";

const DEFAULT_COLUMN_WIDTH = 320;

/**
 * Computes the viewport width below which there isn't room for the sidebar plus
 * three columns, so the sidebar should auto-collapse.
 *
 * Sidebar: 256px, 3 columns: 3*columnWidth + 2*12px gap + 24px padding
 */
function collapseThreshold(columnWidth: number): number {
  return 256 + 3 * columnWidth + 2 * 12 + 24;
}

/**
 * Manages sidebar state including open/closed and collapsed states
 * Auto-collapses sidebar when viewport is too narrow for 3 columns.
 *
 * The collapse breakpoint is driven by matchMedia (via useMediaQuery) rather
 * than a per-event resize listener, so dragging the window stays smooth — the
 * collapsed state only flips when the viewport actually crosses the threshold.
 */
export function useSidebarManagement(isAuthenticated: boolean) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [columnWidth, setColumnWidth] = useState<number>(DEFAULT_COLUMN_WIDTH);

  // Resolve the user's column width once (and whenever auth changes); the
  // collapse threshold is derived from it. Unauthenticated users get a fixed
  // 1280px threshold below.
  useEffect(() => {
    let cancelled = false;

    if (!isAuthenticated) {
      setColumnWidth(DEFAULT_COLUMN_WIDTH);
      return;
    }

    void appPreferencesService.getPreferences().then((prefs) => {
      if (cancelled) return; // Stale async result — discard
      setColumnWidth(prefs?.columnWidth || DEFAULT_COLUMN_WIDTH);
    });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  // Only collapse on desktop (>=1024px). For authenticated users the upper
  // bound is the computed three-column threshold; otherwise a fixed 1280px.
  const upperBound = isAuthenticated ? collapseThreshold(columnWidth) : 1280;
  const isSidebarCollapsed = useMediaQuery(
    `(min-width: 1024px) and (max-width: ${upperBound - 1}px)`,
  );

  return {
    isSidebarOpen,
    setIsSidebarOpen,
    isSidebarCollapsed,
  };
}
