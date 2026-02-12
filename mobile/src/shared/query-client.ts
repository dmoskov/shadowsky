/**
 * Centralized React Query client configuration
 * Provides unified query defaults, retry logic, and mobile-specific optimizations
 */

import { QueryClient, QueryCache, MutationCache, onlineManager } from '@tanstack/react-query';
import { AppState, AppStateStatus } from 'react-native';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

// Type for error responses from AT Protocol
interface AtProtoError {
  status?: number;
  message?: string;
  error?: string;
}

/**
 * Global state for rate limiting
 */
let isRateLimited = false;
let rateLimitResumeTime = 0;

/**
 * Check if we're currently rate limited
 */
export function isCurrentlyRateLimited(): boolean {
  if (!isRateLimited) return false;

  const now = Date.now();
  if (now >= rateLimitResumeTime) {
    isRateLimited = false;
    return false;
  }

  return true;
}

/**
 * Set rate limit state
 */
export function setRateLimited(retryAfterSeconds: number) {
  isRateLimited = true;
  rateLimitResumeTime = Date.now() + (retryAfterSeconds * 1000);
}

/**
 * Get seconds until rate limit expires
 */
export function getSecondsUntilRateLimitExpires(): number {
  if (!isRateLimited) return 0;
  const seconds = Math.ceil((rateLimitResumeTime - Date.now()) / 1000);
  return Math.max(0, seconds);
}

/**
 * Query cache with global error handler for rate limiting
 */
const queryCache = new QueryCache({
  onError: (error) => {
    const atProtoError = error as AtProtoError;

    // Handle 429 rate limiting
    if (atProtoError?.status === 429) {
      // Extract Retry-After header value (defaults to 60 seconds)
      const retryAfter = 60; // TODO: Extract from response headers when available
      setRateLimited(retryAfter);

      console.warn(`Rate limited, pausing queries for ${retryAfter} seconds`);

      // Pause all queries
      queryClient.getQueryCache().getAll().forEach(query => {
        query.cancel();
      });
    }
  },
});

/**
 * Mutation cache for consistent mutation behavior
 */
const mutationCache = new MutationCache({
  onError: (error) => {
    const atProtoError = error as AtProtoError;

    // Handle 429 rate limiting for mutations
    if (atProtoError?.status === 429) {
      const retryAfter = 60;
      setRateLimited(retryAfter);
      console.warn(`Rate limited on mutation, pausing for ${retryAfter} seconds`);
    }
  },
});

/**
 * Centralized QueryClient with mobile-optimized defaults
 */
export const queryClient = new QueryClient({
  queryCache,
  mutationCache,
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,      // 5 minutes - data stays fresh
      gcTime: 30 * 60 * 1000,         // 30 minutes - garbage collection
      retry: (failureCount, error) => {
        const atProtoError = error as AtProtoError;

        // Don't retry if we're rate limited
        if (isCurrentlyRateLimited()) {
          return false;
        }

        // Don't retry auth errors
        if (atProtoError?.status === 401 || atProtoError?.status === 403) {
          return false;
        }

        // Don't retry client errors
        if (atProtoError?.status === 400 || atProtoError?.status === 404) {
          return false;
        }

        // Don't retry rate limit errors (handled by global handler)
        if (atProtoError?.status === 429) {
          return false;
        }

        // Retry up to 3 times for everything else
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => {
        // Exponential backoff: 1s, 2s, 4s, capped at 30s
        return Math.min(1000 * 2 ** attemptIndex, 30000);
      },
      refetchOnWindowFocus: false, // Not applicable on mobile
      refetchOnReconnect: true,    // Refetch when network reconnects
    },
    mutations: {
      retry: (failureCount, error) => {
        const atProtoError = error as AtProtoError;

        // Don't retry if we're rate limited
        if (isCurrentlyRateLimited()) {
          return false;
        }

        // Don't retry auth or client errors
        if (atProtoError?.status && atProtoError.status >= 400 && atProtoError.status < 500) {
          return false;
        }

        // Retry once for server errors
        return failureCount < 1;
      },
      retryDelay: 1000, // 1 second delay for mutation retries
    },
  },
});

/**
 * AppState listener for mobile-specific query behavior
 * Handles app backgrounding/foregrounding intelligently
 */
let lastActiveTime = Date.now();
let appStateSubscription: any = null;

/**
 * Setup AppState listener for query invalidation on foreground
 */
export function setupAppStateListener() {
  // Cleanup existing listener if any
  if (appStateSubscription) {
    appStateSubscription.remove();
  }

  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    const now = Date.now();

    if (nextAppState === 'active') {
      // App came to foreground
      const backgroundDuration = now - lastActiveTime;
      const fiveMinutes = 5 * 60 * 1000;

      // If app was in background for more than 5 minutes, invalidate stale queries
      if (backgroundDuration > fiveMinutes) {
        console.log(`App foregrounded after ${Math.round(backgroundDuration / 1000)}s, invalidating stale queries`);
        queryClient.invalidateQueries({ stale: true });
      }

      // Resume refetch intervals
      queryClient.resumePausedMutations();
    } else if (nextAppState === 'background' || nextAppState === 'inactive') {
      // App going to background - record time
      lastActiveTime = now;

      // Pause all ongoing queries and intervals
      // Note: React Query automatically pauses network requests when app is backgrounded
      // We just record the time for smart revalidation on foreground
    }
  };

  // Subscribe to AppState changes
  appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

  return () => {
    if (appStateSubscription) {
      appStateSubscription.remove();
    }
  };
}

/**
 * Cleanup function to remove AppState listener
 */
export function cleanupAppStateListener() {
  if (appStateSubscription) {
    appStateSubscription.remove();
    appStateSubscription = null;
  }
}

/**
 * Setup network status monitoring for React Query
 * Integrates NetInfo with React Query's onlineManager to:
 * - Pause queries when offline
 * - Resume and revalidate queries when back online
 */
export function setupNetworkListener() {
  // Tell React Query how to check online status
  onlineManager.setEventListener((setOnline) => {
    return NetInfo.addEventListener((state: NetInfoState) => {
      const isOnline = state.isConnected === true && state.isInternetReachable !== false;

      // Update React Query's online status
      setOnline(isOnline);

      // If coming back online, invalidate and refetch stale queries
      if (isOnline) {
        console.log('[NetworkListener] Back online, invalidating stale queries');
        queryClient.invalidateQueries({ stale: true });
      } else {
        console.log('[NetworkListener] Offline detected, pausing queries');
      }
    });
  });

  // Also setup initial state
  NetInfo.fetch().then((state: NetInfoState) => {
    const isOnline = state.isConnected === true && state.isInternetReachable !== false;
    onlineManager.setOnline(isOnline);
  });
}
