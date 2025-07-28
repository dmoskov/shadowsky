/**
 * React Query client configuration with IndexedDB persistence
 */

import { QueryClient } from '@tanstack/react-query'
import { feedStorage, notificationStorage } from './storage'

// Custom query client with persistence hooks
class PersistedQueryClient extends QueryClient {
  constructor(config?: any) {
    super(config)
    
    // Initialize storage services
    if (typeof window !== 'undefined') {
      this.initializeStorage()
    }
  }
  
  private async initializeStorage() {
    try {
      await Promise.all([
        feedStorage.init(),
        // Only init notification storage if in notifications app
        window.location.pathname.includes('notifications') ? notificationStorage.init() : Promise.resolve()
      ])
      
      // Restore cached data on startup
      await this.restoreCachedData()
    } catch (error) {
      console.error('Failed to initialize storage:', error)
    }
  }
  
  private async restoreCachedData() {
    try {
      // Restore timeline data if available
      const timelineMetadata = await feedStorage.getMetadata('timeline')
      if (timelineMetadata && this.isCacheFresh(timelineMetadata.lastUpdate)) {
        const pages = await feedStorage.getFeedPages('timeline', { limit: 5 })
        if (pages.length > 0) {
          // Reconstruct timeline data
          const timelineData = {
            pages: [],
            pageParams: []
          }
          
          for (const page of pages) {
            const items = await feedStorage.getFeedItemsByUris(page.postUris)
            if (items.length > 0) {
              timelineData.pages.push({ feed: items, cursor: page.cursor })
              timelineData.pageParams.push(page.cursor)
            }
          }
          
          if (timelineData.pages.length > 0) {
            // Set the data in React Query cache
            this.setQueryData(['timeline'], timelineData)
            console.log(`Restored ${timelineData.pages.length} timeline pages from cache`)
          }
        }
      }
    } catch (error) {
      console.error('Failed to restore cached data:', error)
    }
  }
  
  private isCacheFresh(lastUpdate: number): boolean {
    // Consider cache fresh if less than 5 minutes old
    return Date.now() - lastUpdate < 5 * 60 * 1000
  }
}

export const queryClient = new PersistedQueryClient({
  defaultOptions: {
    queries: {
      // Stale time of 5 minutes - data is fresh for longer
      staleTime: 5 * 60 * 1000,
      // Cache time of 24 hours - keep data in cache much longer
      gcTime: 24 * 60 * 60 * 1000,
      // Retry failed requests with exponential backoff
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors
        const err = error as Error & { status?: number }
        if (err?.status && err.status >= 400 && err.status < 500) {
          return false
        }
        // Retry up to 3 times
        return failureCount < 3
      },
      retryDelay: (failureCount) => {
        // Wait 1s, 2s, 4s between retries
        return Math.min(1000 * Math.pow(2, failureCount), 4000)
      },
      // Don't refetch on mount if data exists and is fresh
      refetchOnMount: (query) => {
        const state = query.state
        if (!state.data) return true
        
        // Check if data is stale
        const staleTime = query.options.staleTime ?? 5 * 60 * 1000
        const isStale = Date.now() - state.dataUpdatedAt > staleTime
        
        return isStale ? 'always' : false
      },
      // Prevent refetching on window focus
      refetchOnWindowFocus: false,
      // Prevent refetching on reconnect
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