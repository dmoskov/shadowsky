/**
 * Hook for network-aware loading strategies
 *
 * Adapts app behavior based on network conditions to improve performance
 * on slow connections while maintaining good UX on fast connections.
 */

import { useCallback, useEffect, useState } from "react";
import {
  getNetworkInfo,
  subscribeToNetworkChanges,
  type NetworkInfoSnapshot,
  type NetworkQuality,
} from "../utils/network-info";

/**
 * Loading strategy configuration based on network conditions
 */
export interface LoadingStrategy {
  /** Network quality level */
  quality: NetworkQuality;
  /** Whether to defer non-critical initialization */
  deferNonCritical: boolean;
  /** Whether to skip route prefetching */
  skipRoutePrefetch: boolean;
  /** Whether to use reduced image quality */
  reduceImageQuality: boolean;
  /** Whether to disable animations */
  reduceAnimations: boolean;
  /** Query stale time in milliseconds */
  queryStaleTime: number;
  /** Query cache time in milliseconds */
  queryCacheTime: number;
  /** Maximum concurrent requests */
  maxConcurrentRequests: number;
  /** Whether to enable background sync */
  enableBackgroundSync: boolean;
}

/**
 * Get loading strategy based on network quality and device type
 */
function getLoadingStrategy(
  quality: NetworkQuality,
  isMobile: boolean,
): LoadingStrategy {
  const baseStaleTime = isMobile ? 15 * 60 * 1000 : 30 * 60 * 1000;
  const baseCacheTime = isMobile ? 30 * 60 * 1000 : 2 * 60 * 60 * 1000;

  switch (quality) {
    case "excellent":
      return {
        quality,
        deferNonCritical: false,
        skipRoutePrefetch: false,
        reduceImageQuality: false,
        reduceAnimations: false,
        queryStaleTime: baseStaleTime,
        queryCacheTime: baseCacheTime,
        maxConcurrentRequests: isMobile ? 6 : 10,
        enableBackgroundSync: true,
      };

    case "good":
      return {
        quality,
        deferNonCritical: false,
        skipRoutePrefetch: false,
        reduceImageQuality: false,
        reduceAnimations: false,
        queryStaleTime: baseStaleTime,
        queryCacheTime: baseCacheTime,
        maxConcurrentRequests: isMobile ? 4 : 8,
        enableBackgroundSync: true,
      };

    case "moderate":
      return {
        quality,
        deferNonCritical: true,
        skipRoutePrefetch: true,
        reduceImageQuality: false,
        reduceAnimations: false,
        queryStaleTime: baseStaleTime * 1.5,
        queryCacheTime: baseCacheTime * 1.5,
        maxConcurrentRequests: isMobile ? 3 : 5,
        enableBackgroundSync: true,
      };

    case "poor":
      return {
        quality,
        deferNonCritical: true,
        skipRoutePrefetch: true,
        reduceImageQuality: true,
        reduceAnimations: true,
        queryStaleTime: baseStaleTime * 2,
        queryCacheTime: baseCacheTime * 2,
        maxConcurrentRequests: 2,
        enableBackgroundSync: false,
      };

    case "offline":
      return {
        quality,
        deferNonCritical: true,
        skipRoutePrefetch: true,
        reduceImageQuality: true,
        reduceAnimations: true,
        queryStaleTime: Infinity,
        queryCacheTime: Infinity,
        maxConcurrentRequests: 0,
        enableBackgroundSync: false,
      };
  }
}

/**
 * Hook to get current loading strategy based on network conditions
 */
export function useNetworkAwareLoading(): LoadingStrategy {
  const [networkInfo, setNetworkInfo] = useState<NetworkInfoSnapshot>(() =>
    getNetworkInfo(),
  );

  useEffect(() => {
    return subscribeToNetworkChanges(setNetworkInfo);
  }, []);

  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  return getLoadingStrategy(networkInfo.quality, isMobile);
}

/**
 * Get initial loading strategy synchronously (for use outside React)
 */
export function getInitialLoadingStrategy(): LoadingStrategy {
  const networkInfo = getNetworkInfo();
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  return getLoadingStrategy(networkInfo.quality, isMobile);
}

/**
 * Check if we should defer initialization based on network conditions
 */
export function shouldDeferInit(): boolean {
  const strategy = getInitialLoadingStrategy();
  return strategy.deferNonCritical;
}

/**
 * Hook to check if an operation should be deferred
 */
export function useDeferredOperation(): {
  shouldDefer: boolean;
  executeWhenReady: (fn: () => void) => void;
} {
  const strategy = useNetworkAwareLoading();

  const executeWhenReady = useCallback(
    (fn: () => void) => {
      if (strategy.deferNonCritical) {
        // Use requestIdleCallback for non-critical operations on slow networks
        if ("requestIdleCallback" in window) {
          window.requestIdleCallback(fn, { timeout: 5000 });
        } else {
          setTimeout(fn, 100);
        }
      } else {
        fn();
      }
    },
    [strategy.deferNonCritical],
  );

  return {
    shouldDefer: strategy.deferNonCritical,
    executeWhenReady,
  };
}
