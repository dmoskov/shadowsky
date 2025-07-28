/**
 * React Query persistence adapter using IndexedDB
 * Enables automatic caching and restoration of query data
 */

import { PersistedClient, Persister } from '@tanstack/react-query-persist-client'
import { QueryClient, Query } from '@tanstack/react-query'
import { FeedStorageService } from './feed-storage'
import { NotificationStorageService } from './notification-storage'

const QUERY_CACHE_DB_NAME = 'BskyQueryCache'
const QUERY_CACHE_VERSION = 1

interface CachedQuery {
  queryKey: string
  queryHash: string
  state: any
  timestamp: number
}

/**
 * IndexedDB-based persister for React Query
 */
export class IndexedDBPersister implements Persister {
  private db: IDBDatabase | null = null
  private feedStorage = FeedStorageService.getInstance()
  private notificationStorage?: NotificationStorageService
  
  constructor(options?: {
    enableNotifications?: boolean
  }) {
    if (options?.enableNotifications) {
      this.notificationStorage = NotificationStorageService.getInstance()
    }
  }
  
  private async initDB(): Promise<void> {
    if (this.db) return
    
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(QUERY_CACHE_DB_NAME, QUERY_CACHE_VERSION)
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        
        if (!db.objectStoreNames.contains('queries')) {
          const store = db.createObjectStore('queries', { keyPath: 'queryHash' })
          store.createIndex('by_timestamp', 'timestamp')
          store.createIndex('by_key', 'queryKey')
        }
        
        if (!db.objectStoreNames.contains('client_state')) {
          db.createObjectStore('client_state', { keyPath: 'id' })
        }
      }
    })
  }
  
  async persistClient(client: PersistedClient): Promise<void> {
    await this.initDB()
    
    // Initialize storage services
    await Promise.all([
      this.feedStorage.init(),
      this.notificationStorage?.init()
    ])
    
    const transaction = this.db!.transaction(['client_state', 'queries'], 'readwrite')
    const clientStore = transaction.objectStore('client_state')
    const queryStore = transaction.objectStore('queries')
    
    // Save client state
    clientStore.put({
      id: 'main',
      timestamp: client.timestamp,
      buster: client.buster
    })
    
    // Save queries based on their type
    for (const [queryHash, query] of client.clientState.queries) {
      const queryKey = query.queryKey
      
      // Handle timeline/feed queries specially
      if (this.isTimelineQuery(queryKey)) {
        await this.persistTimelineQuery(query)
      } 
      // Handle notification queries
      else if (this.isNotificationQuery(queryKey) && this.notificationStorage) {
        await this.persistNotificationQuery(query)
      }
      // Store other queries normally
      else {
        const cachedQuery: CachedQuery = {
          queryKey: JSON.stringify(queryKey),
          queryHash,
          state: query.state,
          timestamp: Date.now()
        }
        queryStore.put(cachedQuery)
      }
    }
    
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  }
  
  async restoreClient(): Promise<PersistedClient | undefined> {
    await this.initDB()
    
    // Initialize storage services
    await Promise.all([
      this.feedStorage.init(),
      this.notificationStorage?.init()
    ])
    
    const transaction = this.db!.transaction(['client_state', 'queries'], 'readonly')
    const clientStore = transaction.objectStore('client_state')
    const queryStore = transaction.objectStore('queries')
    
    return new Promise((resolve, reject) => {
      const clientRequest = clientStore.get('main')
      
      clientRequest.onsuccess = async () => {
        const clientData = clientRequest.result
        if (!clientData) {
          resolve(undefined)
          return
        }
        
        const queries = new Map()
        
        // Restore timeline queries from feed storage
        const timelineData = await this.restoreTimelineQueries()
        for (const [queryHash, query] of timelineData) {
          queries.set(queryHash, query)
        }
        
        // Restore notification queries
        if (this.notificationStorage) {
          const notificationData = await this.restoreNotificationQueries()
          for (const [queryHash, query] of notificationData) {
            queries.set(queryHash, query)
          }
        }
        
        // Restore other queries
        const queryRequest = queryStore.getAll()
        queryRequest.onsuccess = () => {
          const cachedQueries = queryRequest.result as CachedQuery[]
          
          for (const cached of cachedQueries) {
            // Skip if already restored from specialized storage
            if (!queries.has(cached.queryHash)) {
              queries.set(cached.queryHash, {
                queryKey: JSON.parse(cached.queryKey),
                queryHash: cached.queryHash,
                state: cached.state
              })
            }
          }
          
          resolve({
            timestamp: clientData.timestamp,
            buster: clientData.buster,
            clientState: {
              queries,
              mutations: []
            }
          })
        }
        
        queryRequest.onerror = () => reject(queryRequest.error)
      }
      
      clientRequest.onerror = () => reject(clientRequest.error)
    })
  }
  
  async removeClient(): Promise<void> {
    await this.initDB()
    
    const transaction = this.db!.transaction(['client_state', 'queries'], 'readwrite')
    transaction.objectStore('client_state').clear()
    transaction.objectStore('queries').clear()
    
    // Also clear specialized storage
    await Promise.all([
      this.feedStorage.clearAll(),
      this.notificationStorage?.clearAll()
    ])
    
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  }
  
  /**
   * Check if a query is a timeline/feed query
   */
  private isTimelineQuery(queryKey: unknown[]): boolean {
    return queryKey[0] === 'timeline' || 
           queryKey[0] === 'authorFeed' ||
           queryKey[0] === 'feed'
  }
  
  /**
   * Check if a query is a notification query
   */
  private isNotificationQuery(queryKey: unknown[]): boolean {
    return queryKey[0] === 'notifications' ||
           queryKey[0] === 'notifications-extended'
  }
  
  /**
   * Persist timeline query data to feed storage
   */
  private async persistTimelineQuery(query: Query): Promise<void> {
    const queryKey = query.queryKey
    const feedType = queryKey[0] as string
    const state = query.state
    
    if (!state.data || state.status !== 'success') return
    
    // Handle infinite query data
    if (state.data.pages) {
      for (let i = 0; i < state.data.pages.length; i++) {
        const page = state.data.pages[i]
        if (page.feed) {
          await this.feedStorage.saveFeedPage(
            feedType,
            page.feed,
            page.cursor,
            `${feedType}_page_${i}`
          )
        }
      }
      
      // Save metadata
      await this.feedStorage.saveMetadata(feedType, {
        lastUpdate: state.dataUpdatedAt,
        totalCount: state.data.pages.reduce((acc: number, p: any) => 
          acc + (p.feed?.length || 0), 0
        ),
        version: '1.0'
      })
    }
  }
  
  /**
   * Persist notification query data
   */
  private async persistNotificationQuery(query: Query): Promise<void> {
    if (!this.notificationStorage) return
    
    const state = query.state
    if (!state.data || state.status !== 'success') return
    
    // Handle notification data based on structure
    if (state.data.pages) {
      for (const page of state.data.pages) {
        if (page.notifications) {
          await this.notificationStorage.saveNotifications(page.notifications)
        }
      }
    } else if (state.data.notifications) {
      await this.notificationStorage.saveNotifications(state.data.notifications)
    }
  }
  
  /**
   * Restore timeline queries from feed storage
   */
  private async restoreTimelineQueries(): Promise<Map<string, Query>> {
    const queries = new Map<string, Query>()
    
    // Get metadata for different feed types
    const feedTypes = ['timeline', 'authorFeed']
    
    for (const feedType of feedTypes) {
      const metadata = await this.feedStorage.getMetadata(feedType)
      if (!metadata) continue
      
      // Get pages for this feed
      const pages = await this.feedStorage.getFeedPages(feedType, { limit: 50 })
      if (pages.length === 0) continue
      
      // Reconstruct the infinite query data
      const reconstructedPages = []
      for (const page of pages) {
        const feedItems = await this.feedStorage.getFeedItemsByUris(page.postUris)
        if (feedItems.length > 0) {
          reconstructedPages.push({
            feed: feedItems,
            cursor: page.cursor
          })
        }
      }
      
      if (reconstructedPages.length > 0) {
        const queryKey = [feedType]
        const queryHash = this.hashQueryKey(queryKey)
        
        queries.set(queryHash, {
          queryKey,
          queryHash,
          state: {
            data: {
              pages: reconstructedPages,
              pageParams: reconstructedPages.map(p => p.cursor)
            },
            dataUpdatedAt: metadata.lastUpdate,
            status: 'success',
            fetchStatus: 'idle'
          }
        } as any)
      }
    }
    
    return queries
  }
  
  /**
   * Restore notification queries
   */
  private async restoreNotificationQueries(): Promise<Map<string, Query>> {
    if (!this.notificationStorage) return new Map()
    
    const queries = new Map<string, Query>()
    const metadata = await this.notificationStorage.getMetadata()
    
    if (metadata) {
      const notifications = await this.notificationStorage.getAllNotifications(100)
      
      if (notifications.length > 0) {
        const queryKey = ['notifications-extended']
        const queryHash = this.hashQueryKey(queryKey)
        
        queries.set(queryHash, {
          queryKey,
          queryHash,
          state: {
            data: {
              pages: [{
                notifications,
                cursor: undefined
              }],
              pageParams: [undefined]
            },
            dataUpdatedAt: metadata.lastFetch,
            status: 'success',
            fetchStatus: 'idle'
          }
        } as any)
      }
    }
    
    return queries
  }
  
  /**
   * Simple hash function for query keys
   */
  private hashQueryKey(queryKey: unknown[]): string {
    const str = JSON.stringify(queryKey)
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32bit integer
    }
    return hash.toString()
  }
}

/**
 * Create a configured query client with IndexedDB persistence
 */
export function createPersistedQueryClient(options?: {
  enableNotifications?: boolean
}): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Stale time of 5 minutes
        staleTime: 5 * 60 * 1000,
        // Cache time of 24 hours (since we persist to IndexedDB)
        gcTime: 24 * 60 * 60 * 1000,
        // Retry configuration
        retry: (failureCount, error) => {
          const err = error as Error & { status?: number }
          if (err?.status && err.status >= 400 && err.status < 500) {
            return false
          }
          return failureCount < 3
        },
        retryDelay: (failureCount) => {
          return Math.min(1000 * Math.pow(2, failureCount), 4000)
        },
        // Don't refetch on mount if data is fresh
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
        // Network mode
        networkMode: 'online',
      },
      mutations: {
        retry: 1,
        networkMode: 'online',
      },
    },
  })
}