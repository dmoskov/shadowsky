/**
 * Route Prefetch Hook
 *
 * Provides prefetch functions for profiles and threads that can be triggered
 * on link hover to make navigation feel instant. Uses React Query's prefetchQuery
 * to populate the cache before the user navigates.
 */

import { getProfileService } from "@bsky/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";

// Debounce delay to prevent excessive prefetching on rapid mouse movements
const PREFETCH_DELAY_MS = 100;

// Stale time for prefetched data (5 minutes - matches query-client defaults)
const PREFETCH_STALE_TIME = 1000 * 60 * 5;

export function useRoutePrefetch() {
  const { agent } = useAuth();
  const queryClient = useQueryClient();

  // Track pending prefetch timers to cancel them if mouse leaves quickly
  const pendingPrefetchRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  /**
   * Prefetch profile data for a given handle
   * Call this on mouseEnter of profile links
   */
  const prefetchProfile = useCallback(
    (handle: string) => {
      if (!agent || !handle) return;

      // Cancel any existing pending prefetch for this handle
      const existingTimer = pendingPrefetchRef.current.get(`profile:${handle}`);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      // Debounce the prefetch to avoid excessive API calls
      const timer = setTimeout(() => {
        // Check if data is already cached and fresh
        const existingData = queryClient.getQueryData(["profile", handle]);
        if (existingData) {
          pendingPrefetchRef.current.delete(`profile:${handle}`);
          return;
        }

        // Prefetch the profile data
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
   * Prefetch thread data for a given post URI
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

      // Debounce the prefetch
      const timer = setTimeout(() => {
        // Check if data is already cached
        const existingData = queryClient.getQueryData(["thread", postUri]);
        if (existingData) {
          pendingPrefetchRef.current.delete(`thread:${postUri}`);
          return;
        }

        // Prefetch the thread data
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

  return {
    prefetchProfile,
    cancelPrefetchProfile,
    prefetchThread,
    cancelPrefetchThread,
    getProfilePrefetchHandlers,
    getThreadPrefetchHandlers,
  };
}
