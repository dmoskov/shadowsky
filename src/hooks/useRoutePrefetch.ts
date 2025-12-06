/**
 * Route Prefetch Hook
 *
 * Provides intelligent route prefetching using simple heuristics:
 * 1. Hover intent detection (prefetch on hover after 150ms delay)
 * 2. Common navigation patterns (home->profile, feed->thread, etc.)
 *
 * Uses React Query's prefetchQuery for data and route-prefetch-service for chunks.
 */

import { getProfileService } from "@bsky/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";
import { useLocation } from "react-router";
import { useAuth } from "../contexts/AuthContext";
import { routePrefetchService } from "../services/route-prefetch-service";

// Debounce delay for hover intent detection (150ms is optimal for hover intent)
const PREFETCH_DELAY_MS = 150;

// Stale time for prefetched data (5 minutes - matches query-client defaults)
const PREFETCH_STALE_TIME = 1000 * 60 * 5;

export function useRoutePrefetch() {
  const { agent } = useAuth();
  const queryClient = useQueryClient();
  const location = useLocation();

  // Track pending prefetch timers to cancel them if mouse leaves quickly
  const pendingPrefetchRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Record navigation events for pattern-based prefetching
  useEffect(() => {
    routePrefetchService.recordNavigation(location.pathname);
  }, [location.pathname]);

  /**
   * Prefetch profile data for a given handle.
   * Implements hover intent detection with 150ms delay.
   * Call this on mouseEnter of profile links.
   */
  const prefetchProfile = useCallback(
    (handle: string) => {
      if (!agent || !handle) return;

      // Cancel any existing pending prefetch for this handle
      const existingTimer = pendingPrefetchRef.current.get(`profile:${handle}`);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      // Hover intent detection: wait 150ms before prefetching
      // This prevents prefetching on accidental hover-throughs
      const timer = setTimeout(() => {
        // Prefetch the route chunk first (fast, from local cache or CDN)
        routePrefetchService.prefetchRoute("profile");

        // Check if data is already cached and fresh
        const existingData = queryClient.getQueryData(["profile", handle]);
        if (existingData) {
          pendingPrefetchRef.current.delete(`profile:${handle}`);
          return;
        }

        // Prefetch the profile data from API
        queryClient.prefetchQuery({
          queryKey: ["profile", handle],
          queryFn: async () => {
            const profileService = getProfileService(agent);
            return profileService.getProfile(handle);
          },
          staleTime: PREFETCH_STALE_TIME,
        });

        pendingPrefetchRef.current.delete(`profile:${handle}`);
      }, PREFETCH_DELAY_MS);

      pendingPrefetchRef.current.set(`profile:${handle}`, timer);
    },
    [agent, queryClient],
  );

  /**
   * Cancel a pending profile prefetch (call on mouseLeave)
   */
  const cancelPrefetchProfile = useCallback((handle: string) => {
    const timer = pendingPrefetchRef.current.get(`profile:${handle}`);
    if (timer) {
      clearTimeout(timer);
      pendingPrefetchRef.current.delete(`profile:${handle}`);
    }
  }, []);

  /**
   * Prefetch thread data for a given post URI.
   * Implements hover intent detection with 150ms delay.
   * Call this on mouseEnter of thread links (timestamps, etc.)
   */
  const prefetchThread = useCallback(
    (postUri: string) => {
      if (!agent || !postUri) return;

      // Cancel any existing pending prefetch for this thread
      const existingTimer = pendingPrefetchRef.current.get(`thread:${postUri}`);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      // Hover intent detection: wait 150ms before prefetching
      const timer = setTimeout(() => {
        // Prefetch the route chunk first (fast, from local cache or CDN)
        routePrefetchService.prefetchRoute("thread");

        // Check if data is already cached
        const existingData = queryClient.getQueryData(["thread", postUri]);
        if (existingData) {
          pendingPrefetchRef.current.delete(`thread:${postUri}`);
          return;
        }

        // Prefetch the thread data from API
        queryClient.prefetchQuery({
          queryKey: ["thread", postUri],
          queryFn: async () => {
            const response = await agent.getPostThread({
              uri: postUri,
              depth: 10,
            });
            return response.data.thread;
          },
          staleTime: PREFETCH_STALE_TIME,
        });

        pendingPrefetchRef.current.delete(`thread:${postUri}`);
      }, PREFETCH_DELAY_MS);

      pendingPrefetchRef.current.set(`thread:${postUri}`, timer);
    },
    [agent, queryClient],
  );

  /**
   * Cancel a pending thread prefetch (call on mouseLeave)
   */
  const cancelPrefetchThread = useCallback((postUri: string) => {
    const timer = pendingPrefetchRef.current.get(`thread:${postUri}`);
    if (timer) {
      clearTimeout(timer);
      pendingPrefetchRef.current.delete(`thread:${postUri}`);
    }
  }, []);

  /**
   * Create mouse event handlers for profile links
   * Returns an object with onMouseEnter and onMouseLeave handlers
   */
  const getProfilePrefetchHandlers = useCallback(
    (handle: string) => ({
      onMouseEnter: () => prefetchProfile(handle),
      onMouseLeave: () => cancelPrefetchProfile(handle),
    }),
    [prefetchProfile, cancelPrefetchProfile],
  );

  /**
   * Create mouse event handlers for thread links
   * Returns an object with onMouseEnter and onMouseLeave handlers
   */
  const getThreadPrefetchHandlers = useCallback(
    (postUri: string) => ({
      onMouseEnter: () => prefetchThread(postUri),
      onMouseLeave: () => cancelPrefetchThread(postUri),
    }),
    [prefetchThread, cancelPrefetchThread],
  );

  /**
   * Prefetch a route's JavaScript chunk (code-splitting).
   * Implements hover intent detection with 150ms delay.
   * Call this on mouseEnter of navigation links.
   */
  const prefetchRouteChunk = useCallback((routePath: string) => {
    // Cancel any existing pending prefetch for this route
    const existingTimer = pendingPrefetchRef.current.get(`route:${routePath}`);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Hover intent detection: wait 150ms before prefetching
    const timer = setTimeout(() => {
      routePrefetchService.prefetchRoute(routePath);
      pendingPrefetchRef.current.delete(`route:${routePath}`);
    }, PREFETCH_DELAY_MS);

    pendingPrefetchRef.current.set(`route:${routePath}`, timer);
  }, []);

  /**
   * Cancel a pending route chunk prefetch
   */
  const cancelPrefetchRouteChunk = useCallback((routePath: string) => {
    const timer = pendingPrefetchRef.current.get(`route:${routePath}`);
    if (timer) {
      clearTimeout(timer);
      pendingPrefetchRef.current.delete(`route:${routePath}`);
    }
  }, []);

  /**
   * Create mouse event handlers for navigation links.
   * Returns an object with onMouseEnter and onMouseLeave handlers.
   */
  const getRoutePrefetchHandlers = useCallback(
    (routePath: string) => ({
      onMouseEnter: () => prefetchRouteChunk(routePath),
      onMouseLeave: () => cancelPrefetchRouteChunk(routePath),
    }),
    [prefetchRouteChunk, cancelPrefetchRouteChunk],
  );

  return {
    // Profile prefetching
    prefetchProfile,
    cancelPrefetchProfile,
    getProfilePrefetchHandlers,
    // Thread prefetching
    prefetchThread,
    cancelPrefetchThread,
    getThreadPrefetchHandlers,
    // Route chunk prefetching
    prefetchRouteChunk,
    cancelPrefetchRouteChunk,
    getRoutePrefetchHandlers,
    // Service access for advanced usage
    routePrefetchService,
  };
}
