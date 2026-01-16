/**
 * PrefetchLink Component
 *
 * A link component that implements intelligent route prefetching:
 * 1. Hover intent detection (prefetch on hover after 150ms delay)
 * 2. Code-splitting chunk preloading for the target route
 *
 * Use this for navigation links to make route transitions feel instant.
 */

import React, { memo, useCallback, useRef } from "react";
import { NavLink, NavLinkProps } from "react-router";
import { useRoutePrefetch } from "../../hooks/useRoutePrefetch";

// Hover intent delay (150ms is optimal for detecting intentional hovers)
const HOVER_INTENT_DELAY_MS = 150;

export interface PrefetchLinkProps extends Omit<
  NavLinkProps,
  "to" | "onMouseEnter" | "onMouseLeave"
> {
  /** The route path to navigate to */
  to: string;
  /** Optional profile handle to prefetch (for profile links) */
  profileHandle?: string;
  /** Optional post URI to prefetch (for thread links) */
  postUri?: string;
  /** Disable prefetching (useful for conditional prefetch) */
  disablePrefetch?: boolean;
  /** Custom click handler (receives event) */
  onCustomClick?: (e: React.MouseEvent) => void;
}

/**
 * Navigation link with intelligent route prefetching.
 *
 * Features:
 * - Hover intent detection (150ms delay before prefetch)
 * - Route chunk preloading for code-split routes
 * - Optional profile/thread data prefetching
 * - Cancels prefetch if mouse leaves before delay completes
 *
 * @example
 * ```tsx
 * // Basic navigation link with chunk prefetching
 * <PrefetchLink to="/notifications">Notifications</PrefetchLink>
 *
 * // Profile link with data prefetching
 * <PrefetchLink to={`/profile/${handle}`} profileHandle={handle}>
 *   View Profile
 * </PrefetchLink>
 *
 * // Thread link with data prefetching
 * <PrefetchLink to={`/thread/${handle}/${postId}`} postUri={postUri}>
 *   View Thread
 * </PrefetchLink>
 * ```
 */
const PrefetchLinkComponent: React.FC<PrefetchLinkProps> = ({
  to,
  profileHandle,
  postUri,
  disablePrefetch = false,
  onCustomClick,
  children,
  ...navLinkProps
}) => {
  const {
    prefetchRouteChunk,
    cancelPrefetchRouteChunk,
    prefetchProfile,
    cancelPrefetchProfile,
    prefetchThread,
    cancelPrefetchThread,
  } = useRoutePrefetch();

  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isPrefetchedRef = useRef(false);

  const handleMouseEnter = useCallback(() => {
    if (disablePrefetch) return;

    // Clear any existing timer
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
    }

    // Hover intent detection: wait before prefetching
    hoverTimerRef.current = setTimeout(() => {
      if (isPrefetchedRef.current) return;

      // Prefetch the route chunk
      prefetchRouteChunk(to);

      // Prefetch profile data if handle provided
      if (profileHandle) {
        prefetchProfile(profileHandle);
      }

      // Prefetch thread data if URI provided
      if (postUri) {
        prefetchThread(postUri);
      }

      isPrefetchedRef.current = true;
      hoverTimerRef.current = null;
    }, HOVER_INTENT_DELAY_MS);
  }, [
    to,
    profileHandle,
    postUri,
    disablePrefetch,
    prefetchRouteChunk,
    prefetchProfile,
    prefetchThread,
  ]);

  const handleMouseLeave = useCallback(() => {
    // Cancel pending prefetch if mouse leaves before delay completes
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }

    // Cancel any pending API prefetches
    if (!isPrefetchedRef.current) {
      cancelPrefetchRouteChunk(to);
      if (profileHandle) {
        cancelPrefetchProfile(profileHandle);
      }
      if (postUri) {
        cancelPrefetchThread(postUri);
      }
    }
  }, [
    to,
    profileHandle,
    postUri,
    cancelPrefetchRouteChunk,
    cancelPrefetchProfile,
    cancelPrefetchThread,
  ]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (onCustomClick) {
        onCustomClick(e);
      }
    },
    [onCustomClick],
  );

  return (
    <NavLink
      to={to}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      {...navLinkProps}
    >
      {children}
    </NavLink>
  );
};

export const PrefetchLink = memo(PrefetchLinkComponent);

/**
 * Simple prefetch link for basic navigation (no profile/thread prefetching).
 * Use this for navigation menu items.
 */
export interface SimplePrefetchLinkProps extends Omit<
  NavLinkProps,
  "to" | "onMouseEnter" | "onMouseLeave"
> {
  to: string;
  disablePrefetch?: boolean;
}

const SimplePrefetchLinkComponent: React.FC<SimplePrefetchLinkProps> = ({
  to,
  disablePrefetch = false,
  children,
  ...navLinkProps
}) => {
  const { getRoutePrefetchHandlers } = useRoutePrefetch();

  const handlers = disablePrefetch ? {} : getRoutePrefetchHandlers(to);

  return (
    <NavLink to={to} {...handlers} {...navLinkProps}>
      {children}
    </NavLink>
  );
};

export const SimplePrefetchLink = memo(SimplePrefetchLinkComponent);
