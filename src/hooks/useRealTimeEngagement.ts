/**
 * useRealTimeEngagement Hook
 *
 * Provides real-time engagement counter updates for posts in the viewport.
 * Integrates with the WebSocket-based engagement service and handles
 * viewport tracking automatically.
 *
 * Features:
 * - Automatic viewport tracking with IntersectionObserver
 * - Throttled updates to minimize re-renders
 * - Integration with React Query for cache updates
 * - Feature flag gated
 */

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { WS_CONFIG } from "../config/websocket.config";
import {
  getRealTimeEngagementService,
  type EngagementServiceMetrics,
  type PostEngagement,
} from "../services/real-time-engagement-service";

/**
 * Options for useRealTimeEngagement hook
 */
export interface UseRealTimeEngagementOptions {
  /** Whether to automatically track viewport (default: true) */
  autoTrackViewport?: boolean;
  /** CSS selector for post elements (default: '[data-post-uri]') */
  postSelector?: string;
  /** Root element for IntersectionObserver (default: null = viewport) */
  root?: Element | null;
  /** Root margin for IntersectionObserver (default: '100px') */
  rootMargin?: string;
  /** Whether to enable debug logging */
  debug?: boolean;
}

/**
 * Return type for useRealTimeEngagement hook
 */
export interface UseRealTimeEngagementReturn {
  /** Whether real-time engagement is enabled */
  isEnabled: boolean;
  /** Toggle real-time engagement on/off */
  setEnabled: (enabled: boolean) => void;
  /** Current service metrics */
  metrics: EngagementServiceMetrics | null;
  /** Manually update visible posts (for custom viewport tracking) */
  updateVisiblePosts: (uris: string[]) => void;
  /** Map of post URIs to their latest engagement counts */
  engagementData: Map<string, PostEngagement>;
  /** Get engagement for a specific post URI */
  getEngagement: (uri: string) => PostEngagement | undefined;
}

/**
 * Hook for subscribing to real-time engagement updates
 */
export function useRealTimeEngagement(
  options: UseRealTimeEngagementOptions = {},
): UseRealTimeEngagementReturn {
  const {
    autoTrackViewport = true,
    postSelector = "[data-post-uri]",
    root = null,
    rootMargin = "100px",
    debug = false,
  } = options;

  const queryClient = useQueryClient();
  const service = useMemo(() => getRealTimeEngagementService(), []);

  const [isEnabled, setIsEnabledState] = useState(service.isEnabled());
  const [metrics, setMetrics] = useState<EngagementServiceMetrics | null>(null);
  const [engagementData, setEngagementData] = useState<
    Map<string, PostEngagement>
  >(new Map());

  // Track visible post URIs
  const visiblePostsRef = useRef<Set<string>>(new Set());
  const observerRef = useRef<IntersectionObserver | null>(null);
  const updateThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Toggle enabled state
  const setEnabled = useCallback(
    (enabled: boolean) => {
      service.setEnabled(enabled);
      setIsEnabledState(enabled);
    },
    [service],
  );

  // Manual update visible posts (for custom viewport tracking)
  const updateVisiblePosts = useCallback(
    (uris: string[]) => {
      service.updateVisiblePosts(uris);
    },
    [service],
  );

  // Get engagement for a specific URI
  const getEngagement = useCallback(
    (uri: string): PostEngagement | undefined => {
      return engagementData.get(uri);
    },
    [engagementData],
  );

  // Handle engagement updates from service
  useEffect(() => {
    if (!isEnabled) return;

    const handleUpdates = (updates: PostEngagement[]) => {
      if (debug) {
        console.log("[RealTimeEngagement] Received updates:", updates.length);
      }

      // Update local state
      setEngagementData((prev) => {
        const next = new Map(prev);
        for (const update of updates) {
          next.set(update.uri, update);
        }
        return next;
      });

      // Update React Query cache for feed queries
      // This allows the updates to propagate to PostCard components
      for (const update of updates) {
        // Invalidate any queries that might contain this post
        // Using a pattern that matches feed-related queries
        queryClient.setQueriesData(
          { predicate: (query) => query.queryKey[0] === "timeline" },
          (oldData: unknown) => {
            if (!oldData || typeof oldData !== "object") return oldData;

            // Handle InfiniteQueryData structure
            const data = oldData as {
              pages?: Array<{
                feed?: Array<{
                  post?: {
                    uri?: string;
                    likeCount?: number;
                    repostCount?: number;
                    replyCount?: number;
                  };
                }>;
              }>;
            };

            if (data.pages) {
              return {
                ...data,
                pages: data.pages.map((page) => {
                  if (!page.feed) return page;
                  return {
                    ...page,
                    feed: page.feed.map((item) => {
                      if (item.post?.uri === update.uri) {
                        return {
                          ...item,
                          post: {
                            ...item.post,
                            likeCount: update.likeCount,
                            repostCount: update.repostCount,
                            replyCount: update.replyCount,
                          },
                        };
                      }
                      return item;
                    }),
                  };
                }),
              };
            }

            return oldData;
          },
        );
      }
    };

    const unsubscribe = service.addListener(handleUpdates);
    return unsubscribe;
  }, [isEnabled, service, queryClient, debug]);

  // Set up IntersectionObserver for automatic viewport tracking
  useEffect(() => {
    if (!isEnabled || !autoTrackViewport) return;

    // Throttled function to send viewport updates
    const sendViewportUpdate = () => {
      if (updateThrottleRef.current) return;

      updateThrottleRef.current = setTimeout(() => {
        updateThrottleRef.current = null;
        const uris = Array.from(visiblePostsRef.current);
        if (uris.length > 0) {
          service.updateVisiblePosts(uris);
          if (debug) {
            console.log(
              "[RealTimeEngagement] Viewport update:",
              uris.length,
              "posts",
            );
          }
        }
      }, WS_CONFIG.ENGAGEMENT_VIEWPORT_THROTTLE_MS);
    };

    // Create IntersectionObserver
    observerRef.current = new IntersectionObserver(
      (entries) => {
        let changed = false;

        for (const entry of entries) {
          const postUri =
            entry.target.getAttribute("data-post-uri") ||
            entry.target
              .closest("[data-post-uri]")
              ?.getAttribute("data-post-uri");

          if (!postUri) continue;

          if (entry.isIntersecting) {
            if (!visiblePostsRef.current.has(postUri)) {
              visiblePostsRef.current.add(postUri);
              changed = true;
            }
          } else {
            if (visiblePostsRef.current.has(postUri)) {
              visiblePostsRef.current.delete(postUri);
              changed = true;
            }
          }
        }

        if (changed) {
          sendViewportUpdate();
        }
      },
      {
        root,
        rootMargin,
        threshold: 0,
      },
    );

    // Observe existing posts
    const observePosts = () => {
      const posts = document.querySelectorAll(postSelector);
      posts.forEach((post) => {
        observerRef.current?.observe(post);
      });
    };

    // Initial observation
    observePosts();

    // Set up MutationObserver to watch for new posts
    const mutationObserver = new MutationObserver((mutations) => {
      let shouldReobserve = false;
      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          shouldReobserve = true;
          break;
        }
      }
      if (shouldReobserve) {
        observePosts();
      }
    });

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      mutationObserver.disconnect();
      if (updateThrottleRef.current) {
        clearTimeout(updateThrottleRef.current);
        updateThrottleRef.current = null;
      }
      visiblePostsRef.current.clear();
    };
  }, [
    isEnabled,
    autoTrackViewport,
    postSelector,
    root,
    rootMargin,
    service,
    debug,
  ]);

  // Periodically update metrics
  useEffect(() => {
    if (!isEnabled) return;

    const updateMetrics = () => {
      setMetrics(service.getMetrics());
    };

    // Initial metrics
    updateMetrics();

    // Update metrics every 5 seconds
    const interval = setInterval(updateMetrics, 5000);
    return () => clearInterval(interval);
  }, [isEnabled, service]);

  return {
    isEnabled,
    setEnabled,
    metrics,
    updateVisiblePosts,
    engagementData,
    getEngagement,
  };
}

/**
 * Hook for getting real-time engagement for a single post
 * Optimized for individual post components
 */
export function usePostEngagement(postUri: string): PostEngagement | undefined {
  const [engagement, setEngagement] = useState<PostEngagement | undefined>(
    undefined,
  );
  const service = useMemo(() => getRealTimeEngagementService(), []);

  useEffect(() => {
    if (!service.isEnabled()) return;

    const handleUpdates = (updates: PostEngagement[]) => {
      const update = updates.find((u) => u.uri === postUri);
      if (update) {
        setEngagement(update);
      }
    };

    return service.addListener(handleUpdates);
  }, [postUri, service]);

  return engagement;
}

/**
 * Hook for checking and toggling real-time engagement feature flag
 */
export function useRealTimeEngagementFlag(): {
  isEnabled: boolean;
  setEnabled: (enabled: boolean) => void;
} {
  const service = useMemo(() => getRealTimeEngagementService(), []);
  const [isEnabled, setIsEnabledState] = useState(service.isEnabled());

  const setEnabled = useCallback(
    (enabled: boolean) => {
      service.setEnabled(enabled);
      setIsEnabledState(enabled);
    },
    [service],
  );

  return { isEnabled, setEnabled };
}

export default useRealTimeEngagement;
