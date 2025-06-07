/**
 * React Query client configuration
 */

import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Stale time of 5 minutes - data is fresh for longer
      staleTime: 5 * 60 * 1000,
      // Cache time of 30 minutes - keep data in cache longer
      gcTime: 30 * 60 * 1000,
      // Retry failed requests with exponential backoff
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors
        const err = error as Error & { status?: number }
        if (err?.status && err.status >= 400 && err.status < 500) {
          return false
        }
        // Retry up to 3 times with exponential backoff
        if (failureCount < 3) {
          // Wait 1s, 2s, 4s between retries
          const delay = Math.min(1000 * Math.pow(2, failureCount), 4000)
          return new Promise(resolve => setTimeout(resolve, delay)).then(() => true)
        }
        return false
      },
      // Prevent refetching on window focus
      refetchOnWindowFocus: false,
      // Prevent refetching on reconnect for 30 seconds
      refetchOnReconnect: 'always',
      // Network mode - don't refetch if offline
      networkMode: 'online',
    },
    mutations: {
      // Retry mutations once on failure
      retry: 1,
      // Network mode for mutations
      networkMode: 'online',
    },
  },
})