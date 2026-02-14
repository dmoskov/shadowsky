/**
 * Centralized React Query client configuration
 * Provides unified query defaults, retry logic, mobile-specific optimizations,
 * and persistent offline cache for viewing content without network connection
 */

import { QueryClient, QueryCache, MutationCache, onlineManager } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, AppStateStatus } from 'react-native';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { loadPrefetchData, isPrefetchDataStale } from '../services/background-fetch';

// Type for error responses from AT Protocol
interface AtProtoError {
  status?: number;
  message?: string;
  error?: string;
  headers?: Record<string, string> | Headers;
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
 * Extract Retry-After value from headers
 * @param headers - Response headers from the error
 * @returns Number of seconds to wait, or default of 60 seconds
 */
function extractRetryAfter(headers?: Record<string, string> | Headers): number {
  const defaultRetryAfter = 60;

  if (!headers) {
    return defaultRetryAfter;
  }

  try {
    // Handle both Headers object and plain object
    let retryAfterValue: string | null = null;

    if (headers instanceof Headers) {
      retryAfterValue = headers.get('retry-after') || headers.get('Retry-After');
    } else {
      // Plain object - check both lowercase and capitalized keys
      retryAfterValue = headers['retry-after'] || headers['Retry-After'] || null;
    }

    if (retryAfterValue) {
      const parsed = parseInt(retryAfterValue, 10);
      if (!isNaN(parsed) && parsed > 0) {
        return parsed;
      }
    }
  } catch (error) {
    console.warn('Failed to parse Retry-After header:', error);
  }

  return defaultRetryAfter;
}

/**
 * Query cache with global error handler for rate limiting
 */
const queryCache = new QueryCache({
  onError: (error) => {
    const atProtoError = error as AtProtoError;

    // Handle 429 rate limiting
    if (atProtoError?.status === 429) {
      // Extract Retry-After header value from response headers
      const retryAfter = extractRetryAfter(atProtoError.headers);
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
      // Extract Retry-After header value from response headers
      const retryAfter = extractRetryAfter(atProtoError.headers);
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

  const handleAppStateChange = async (nextAppState: AppStateStatus) => {
    const now = Date.now();

    if (nextAppState === 'active') {
      // App came to foreground
      const backgroundDuration = now - lastActiveTime;
      const fiveMinutes = 5 * 60 * 1000;

      // Try to hydrate from prefetched data for instant display
      try {
        const prefetchData = await loadPrefetchData();
        const isStale = await isPrefetchDataStale();

        if (prefetchData && !isStale) {
          console.log('[QueryClient] Hydrating timeline from prefetched data');

          // Hydrate timeline query cache
          if (prefetchData.timeline) {
            queryClient.setQueryData(
              ['timeline'],
              {
                pages: [prefetchData.timeline],
                pageParams: [undefined],
              }
            );
          }

          // Hydrate unread count
          if (prefetchData.unreadCount !== undefined) {
            queryClient.setQueryData(['unreadCount'], prefetchData.unreadCount);
          }

          console.log('[QueryClient] Prefetched data hydrated successfully');
        }
      } catch (error) {
        console.error('[QueryClient] Error hydrating prefetched data:', error);
      }

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
let networkInvalidationTimer: ReturnType<typeof setTimeout> | null = null;
let wasOnline = true;

export function setupNetworkListener() {
  // Tell React Query how to check online status
  onlineManager.setEventListener((setOnline) => {
    return NetInfo.addEventListener((state: NetInfoState) => {
      const isOnline = state.isConnected === true && state.isInternetReachable !== false;

      // Update React Query's online status
      setOnline(isOnline);

      // Debounce invalidation to prevent flooding on startup
      // Only invalidate when transitioning from offline -> online
      if (isOnline && !wasOnline) {
        if (networkInvalidationTimer) {
          clearTimeout(networkInvalidationTimer);
        }
        networkInvalidationTimer = setTimeout(() => {
          console.log('[NetworkListener] Back online, invalidating stale queries');
          queryClient.invalidateQueries({ stale: true });
          networkInvalidationTimer = null;
        }, 2000);
      } else if (!isOnline) {
        wasOnline = false;
        console.log('[NetworkListener] Offline detected, pausing queries');
      }

      if (isOnline) {
        wasOnline = true;
      }
    });
  });

  // Setup initial state without triggering invalidation
  NetInfo.fetch().then((state: NetInfoState) => {
    const isOnline = state.isConnected === true && state.isInternetReachable !== false;
    wasOnline = isOnline;
    onlineManager.setOnline(isOnline);
  });
}

/**
 * AsyncStorage-based persister for React Query cache
 * Enables offline content viewing by persisting query results to device storage
 */
export const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'REACT_QUERY_OFFLINE_CACHE',
  throttleTime: 1000, // Throttle writes to reduce storage pressure
});

/**
 * Export PersistQueryClientProvider for app wrapper
 * This should be used in App.tsx to enable persistence
 */
export { PersistQueryClientProvider };
