import { useEffect, useState } from "react";
import { appPreferencesService } from "../services/app-preferences-service";

/**
 * Manages sidebar state including open/closed and collapsed states
 * Auto-collapses sidebar when viewport is too narrow for 3 columns
 */
export function useSidebarManagement(isAuthenticated: boolean) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Auto-collapse sidebar when viewport is too narrow for 3 columns
  useEffect(() => {
    const checkViewportWidth = async () => {
      // Get column width from preferences
      if (isAuthenticated) {
        const prefs = await appPreferencesService.getPreferences();
        const columnWidth = prefs?.columnWidth || 320;

        // Sidebar: 256px, 3 columns: 3*columnWidth + 2*12px gap + 24px padding
        const totalNeeded = 256 + 3 * columnWidth + 2 * 12 + 24;
        const shouldCollapse =
          window.innerWidth < totalNeeded && window.innerWidth >= 1024; // Only on desktop
        setIsSidebarCollapsed(shouldCollapse);
      } else {
        // Default calculation if not authenticated
        const shouldCollapse =
          window.innerWidth < 1280 && window.innerWidth >= 1024;
        setIsSidebarCollapsed(shouldCollapse);
      }
    };

    checkViewportWidth();
    window.addEventListener("resize", checkViewportWidth);
    return () => window.removeEventListener("resize", checkViewportWidth);
  }, [isAuthenticated]);

  return {
    isSidebarOpen,
    setIsSidebarOpen,
    isSidebarCollapsed,
    setIsSidebarCollapsed,
  };
}
