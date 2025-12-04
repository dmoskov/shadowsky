/**
 * BackgroundSyncIndicator - Visual indicator for background async mutations
 *
 * Shows a subtle indicator when React Query is refetching data in the background
 * after invalidateQueries calls. This provides user feedback that data is being
 * refreshed without blocking the UI.
 *
 * Features:
 * - Tracks both queries (refetching) and mutations (in-flight)
 * - Subtle, non-intrusive design that appears in a fixed position
 * - Auto-dismisses when sync completes
 * - Accessible via ARIA live announcements
 * - Uses existing design system tokens
 */

import { useIsFetching, useIsMutating } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { useDelayedBoolean, useMinDuration } from "../../hooks/useTiming";
import { useAriaLiveSafe } from "./AriaLiveRegion";

interface BackgroundSyncIndicatorProps {
  /** Position of the indicator */
  position?: "top-right" | "bottom-right" | "bottom-left";
  /** Minimum time to show the indicator (prevents flash) */
  minDisplayDuration?: number;
  /** Delay before showing the indicator (prevents flash for quick operations) */
  showDelay?: number;
  /** Custom className for positioning overrides */
  className?: string;
}

export const BackgroundSyncIndicator: React.FC<
  BackgroundSyncIndicatorProps
> = ({
  position = "bottom-right",
  minDisplayDuration = 500,
  showDelay = 300,
  className = "",
}) => {
  const isFetching = useIsFetching();
  const isMutating = useIsMutating();
  const { announce } = useAriaLiveSafe();

  const isActive = isFetching > 0 || isMutating > 0;

  // Delay showing to prevent flash for quick operations
  const shouldShowDelayed = useDelayedBoolean(isActive, showDelay);

  // Ensure minimum display duration once shown
  const shouldShow = useMinDuration(shouldShowDelayed, minDisplayDuration);

  // Track previous state for announcements
  const wasShowingRef = useRef(false);
  const [hasAnnounced, setHasAnnounced] = useState(false);

  // Announce when sync starts and completes
  useEffect(() => {
    if (shouldShow && !wasShowingRef.current) {
      // Sync started
      announce("Refreshing data");
      setHasAnnounced(true);
    } else if (!shouldShow && wasShowingRef.current && hasAnnounced) {
      // Sync completed
      announce("Data refreshed");
      setHasAnnounced(false);
    }
    wasShowingRef.current = shouldShow;
  }, [shouldShow, announce, hasAnnounced]);

  if (!shouldShow) {
    return null;
  }

  const positionClasses = {
    "top-right": "top-16 right-4",
    "bottom-right": "bottom-20 right-4 lg:bottom-4",
    "bottom-left": "bottom-20 left-4 lg:bottom-4",
  };

  // Generate descriptive text based on activity
  const getStatusText = () => {
    if (isMutating > 0 && isFetching > 0) {
      return "Syncing changes";
    } else if (isMutating > 0) {
      return "Saving";
    } else {
      return "Refreshing";
    }
  };

  return (
    <div
      className={`fixed z-40 ${positionClasses[position]} ${className}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div
        className="bg-bsky-bg-secondary/95 flex items-center gap-2 rounded-full border border-bsky-border-primary px-3 py-1.5 shadow-md backdrop-blur-sm transition-all duration-200"
        style={{
          animation: "fadeIn 200ms ease-out",
        }}
      >
        <RefreshCw
          className="h-3.5 w-3.5 animate-spin text-bsky-primary"
          aria-hidden="true"
        />
        <span className="text-xs font-medium text-bsky-text-secondary">
          {getStatusText()}
        </span>
      </div>
    </div>
  );
};

/**
 * Hook to manually check if background sync is active.
 * Useful for components that need to know sync status without showing indicator.
 */
export function useIsBackgroundSyncing(): {
  isSyncing: boolean;
  fetchCount: number;
  mutationCount: number;
} {
  const isFetching = useIsFetching();
  const isMutating = useIsMutating();

  return {
    isSyncing: isFetching > 0 || isMutating > 0,
    fetchCount: isFetching,
    mutationCount: isMutating,
  };
}

export default BackgroundSyncIndicator;
