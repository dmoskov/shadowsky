/**
 * React Query client configuration
 */

import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Stale time of 1 minute
      staleTime: 60 * 1000,
      // Cache time of 5 minutes
      gcTime: 5 * 60 * 1000,
      // Retry failed requests up to 3 times
      retry: (failureCount, error: any) => {
        // Don't retry on 4xx errors
        if (error?.status >= 400 && error?.status < 500) {
          return false
        }
        return failureCount < 3
      },
      // Show previous data while fetching new data
      refetchOnWindowFocus: false,
    },
    mutations: {
      // Retry mutations once on failure
      retry: 1,
    },
  },
})