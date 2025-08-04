import { useEffect, useState } from 'react'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import { getNotificationService } from '../services/atproto/notifications'
import { subDays } from 'date-fns'
import { ExtendedFetchCache } from '../utils/extendedFetchCache'
import { NotificationCacheService } from '../services/notification-cache-service'
import { prefetchNotificationPosts, prefetchRootPosts } from '../utils/prefetchNotificationPosts'
import type { Notification } from '@atproto/api/dist/client/types/app/bsky/notification/listNotifications'
import { debug } from '@bsky/shared'
import { useNotificationTracking } from '../hooks/useAnalytics'
import { analytics } from '../services/analytics'
import React from 'react'

/**
 * Silently loads 4 weeks of notifications in the background
 * No UI - just data fetching
 */
export const BackgroundNotificationLoader: React.FC = () => {
  debug.log('[BackgroundNotificationLoader] Component mounting', {
    timestamp: new Date().toISOString()
  })
  
  const { session } = useAuth()
  const queryClient = useQueryClient()
  const [cacheService] = useState(() => NotificationCacheService.getInstance())
  const [isIndexedDBReady, setIsIndexedDBReady] = useState(false)
  const [hasFetched, setHasFetched] = useState(false)
  const [enablePolling, setEnablePolling] = useState(false)
  const { trackNotificationLoad } = useNotificationTracking()
  
  // Check if we already have cached data
  const cachedData = queryClient.getQueryData(['notifications-extended']) as any
  const hasCachedData = cachedData?.pages?.length > 0
  
  // Check if cached data is stale (older than 5 minutes)
  const isCachedDataStale = React.useMemo(() => {
    if (!hasCachedData || !cachedData?.pages?.[0]?.notifications?.[0]) return true
    const newestNotification = cachedData.pages[0].notifications[0]
    const dataAge = Date.now() - new Date(newestNotification.indexedAt).getTime()
    const isStale = dataAge > 5 * 60 * 1000 // 5 minutes
    
    debug.log('[BackgroundNotificationLoader] Cache staleness check:', {
      hasCachedData,
      dataAgeMs: dataAge,
      dataAgeMinutes: dataAge / (60 * 1000),
      isStale,
      newestNotificationDate: newestNotification.indexedAt,
      timestamp: new Date().toISOString()
    })
    
    return isStale
  }, [hasCachedData, cachedData])
  
  const {
    data,
    fetchNextPage,
    hasNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['notifications-extended'],
    queryFn: async ({ pageParam }) => {
      debug.log('[BackgroundNotificationLoader] Fetching notifications page:', {
        pageParam,
        enablePolling,
        timestamp: new Date().toISOString()
      })
      
      const { atProtoClient } = await import('../services/atproto')
      const agent = atProtoClient.agent
      if (!agent) throw new Error('Not authenticated')
      const notificationService = getNotificationService(agent)
      const result = await notificationService.listNotifications(pageParam, false, 100)
      
      debug.log('[BackgroundNotificationLoader] Fetched notifications page:', {
        notificationCount: result.notifications.length,
        cursor: result.cursor,
        hasMore: !!result.cursor,
        timestamp: new Date().toISOString()
      })
      
      return result
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.cursor,
    enabled: enablePolling, // Enable polling after initial load
    staleTime: 30 * 60 * 1000, // 30 minutes
    refetchInterval: enablePolling ? 60 * 1000 : false, // Poll every 60 seconds when enabled - reduced from 10s
  })

  // Initialize IndexedDB
  useEffect(() => {
    const initCache = async () => {
      debug.log('[BackgroundNotificationLoader] Initializing IndexedDB', {
        timestamp: new Date().toISOString()
      })
      
      try {
        await cacheService.init()
        setIsIndexedDBReady(true)
        debug.log('[BackgroundNotificationLoader] IndexedDB ready', {
          timestamp: new Date().toISOString()
        })
      } catch (error) {
        debug.error('[BackgroundNotificationLoader] Failed to initialize IndexedDB:', error)
        setIsIndexedDBReady(false)
      }
    }
    initCache()
  }, [cacheService])

  // Load from IndexedDB on mount
  useEffect(() => {
    debug.log('[BackgroundNotificationLoader] IndexedDB load check:', {
      hasSession: !!session,
      hasCachedData,
      isCachedDataStale,
      isIndexedDBReady,
      shouldLoad: session && (isCachedDataStale || !hasCachedData) && isIndexedDBReady,
      timestamp: new Date().toISOString()
    })
    
    if (!session || (hasCachedData && !isCachedDataStale) || !isIndexedDBReady) return
    
    const loadCachedData = async () => {
      const startTime = Date.now()
      const hasCached = await cacheService.hasCachedData()
      debug.log('[BackgroundNotificationLoader] Checking for cached data:', {
        hasCached,
        timestamp: new Date().toISOString()
      })
      
      if (hasCached) {
        debug.log('[BackgroundNotificationLoader] Loading notifications from IndexedDB', {
          timestamp: new Date().toISOString()
        })
        const cachedResult = await cacheService.getCachedNotifications(10000)
        
        if (cachedResult.notifications.length > 0) {
          const pages = []
          const pageSize = 100
          for (let i = 0; i < cachedResult.notifications.length; i += pageSize) {
            const pageNotifications = cachedResult.notifications.slice(i, i + pageSize)
            pages.push({
              notifications: pageNotifications,
              cursor: i + pageSize < cachedResult.notifications.length ? `page-${i + pageSize}` : undefined
            })
          }
          
          queryClient.setQueryData(['notifications-extended'], {
            pages,
            pageParams: [undefined, ...pages.slice(0, -1).map((_, i) => `page-${(i + 1) * pageSize}`)]
          })
          
          debug.log('[BackgroundNotificationLoader] Set query data from cache:', {
            pageCount: pages.length,
            totalNotifications: cachedResult.notifications.length,
            timestamp: new Date().toISOString()
          })
          
          // Trigger re-render in components watching this data
          queryClient.invalidateQueries({ 
            queryKey: ['notifications-extended'],
            refetchType: 'none' // Don't refetch, just notify subscribers
          })
          
          setHasFetched(true)
          
          // Enable polling after loading from cache
          setEnablePolling(true)
          debug.log('[BackgroundNotificationLoader] Enabled polling after loading from cache', {
            timestamp: new Date().toISOString()
          })
          
          // Track cache load performance
          const loadDuration = Date.now() - startTime
          trackNotificationLoad(loadDuration, cachedResult.notifications.length, 'cache')
          analytics.trackPerformance('cache_load_duration', loadDuration, {
            notification_count: cachedResult.notifications.length,
            source: 'indexeddb'
          })
          
          // Prefetch posts for cached reply notifications in the background
          const { atProtoClient } = await import('../services/atproto')
          const agent = atProtoClient.agent
          if (agent) {
            const replyNotifications = cachedResult.notifications.filter(n => n.reason === 'reply')
            if (replyNotifications.length > 0) {
              debug.log('🔄 Background prefetching posts for cached conversations...')
              prefetchNotificationPosts(replyNotifications, agent).then(() => {
                return prefetchRootPosts(replyNotifications, agent)
              }).then(() => {
                debug.log('✅ Background post prefetch complete')
              }).catch(error => {
                debug.error('Error prefetching posts:', error)
              })
            }
          }
        }
      }
    }
    
    loadCachedData()
  }, [session, hasCachedData, isIndexedDBReady, queryClient, cacheService])

  // Auto-fetch 4 weeks if no data exists or data is stale
  useEffect(() => {
    debug.log('[BackgroundNotificationLoader] Auto-fetch check:', {
      hasSession: !!session,
      isIndexedDBReady,
      hasFetched,
      hasCachedData,
      isCachedDataStale,
      enablePolling,
      shouldFetch: session && isIndexedDBReady && !hasFetched && (isCachedDataStale || !hasCachedData) && !enablePolling,
      timestamp: new Date().toISOString()
    })
    
    if (!session || !isIndexedDBReady || hasFetched || (hasCachedData && !isCachedDataStale) || enablePolling) return
    
    const fetchData = async () => {
      const startTime = Date.now()
      debug.log('[BackgroundNotificationLoader] Starting auto-fetch of 4 weeks', {
        timestamp: new Date().toISOString()
      })
      setHasFetched(true)
      
      // Enable the query first to allow manual fetching
      setEnablePolling(true)
      
      // Start fetching
      const initialResult = await refetch()
      if (!initialResult.isSuccess || !initialResult.data) return
      
      const fourWeeksAgo = subDays(new Date(), 28)
      let shouldContinue = true
      let currentPage = 1
      let totalNotifications = 0
      
      // Continue fetching until we reach 4 weeks
      while (shouldContinue && currentPage < 100) {
        debug.log('[BackgroundNotificationLoader] Fetching page:', {
          currentPage,
          timestamp: new Date().toISOString()
        })
        
        const result = await fetchNextPage()
        if (result.isError || !result.data) {
          debug.error('[BackgroundNotificationLoader] Fetch error:', {
            error: result.error,
            currentPage,
            timestamp: new Date().toISOString()
          })
          break
        }
        
        const latestData = result.data
        if (latestData?.pages) {
          const allNotifications = latestData.pages.flatMap(page => page.notifications)
          totalNotifications = allNotifications.length
          
          if (allNotifications.length > 0) {
            const oldestNotification = allNotifications[allNotifications.length - 1]
            const oldestDate = new Date(oldestNotification.indexedAt)
            
            debug.log('[BackgroundNotificationLoader] Progress:', {
              currentPage,
              totalNotifications,
              oldestDate: oldestDate.toISOString(),
              fourWeeksAgo: fourWeeksAgo.toISOString(),
              reachedTarget: oldestDate < fourWeeksAgo,
              timestamp: new Date().toISOString()
            })
            
            if (oldestDate < fourWeeksAgo) {
              shouldContinue = false
              break
            }
          }
          
          const lastPage = latestData.pages[latestData.pages.length - 1]
          if (!lastPage.cursor) {
            debug.log('[BackgroundNotificationLoader] No more pages', {
              currentPage,
              totalNotifications,
              timestamp: new Date().toISOString()
            })
            shouldContinue = false
            break
          }
        }
        
        currentPage++
      }
      
      // Save to IndexedDB
      const finalData = queryClient.getQueryData(['notifications-extended']) as any
      if (finalData?.pages && isIndexedDBReady) {
        debug.log('[BackgroundNotificationLoader] Saving to IndexedDB:', {
          pageCount: finalData.pages.length,
          timestamp: new Date().toISOString()
        })
        
        for (let i = 0; i < finalData.pages.length; i++) {
          const page = finalData.pages[i]
          await cacheService.cacheNotifications(page.notifications, i + 1)
        }
        
        const allNotifications = finalData.pages.flatMap((page: any) => page.notifications)
        totalNotifications = allNotifications.length
        if (allNotifications.length > 0) {
          const oldestDate = new Date(allNotifications[allNotifications.length - 1].indexedAt)
          const newestDate = new Date(allNotifications[0].indexedAt)
          const daysReached = Math.floor((new Date().getTime() - oldestDate.getTime()) / (1000 * 60 * 60 * 24))
          
          ExtendedFetchCache.saveMetadata(
            allNotifications.length,
            oldestDate,
            newestDate,
            daysReached
          )
          
          // Prefetch posts for reply notifications
          const { atProtoClient } = await import('../services/atproto')
          const agent = atProtoClient.agent
          if (agent) {
            const replyNotifications = allNotifications.filter((n: Notification) => n.reason === 'reply')
            if (replyNotifications.length > 0) {
              debug.log('🔄 Prefetching posts for conversations...')
              await prefetchNotificationPosts(replyNotifications, agent)
              await prefetchRootPosts(replyNotifications, agent)
              debug.log('✅ Posts prefetched for conversations')
            }
          }
        }
      }
      
      // Invalidate analytics queries
      queryClient.invalidateQueries({ queryKey: ['notifications-analytics'] })
      
      // Track performance metrics
      const loadDuration = Date.now() - startTime
      trackNotificationLoad(loadDuration, totalNotifications, 'api')
      analytics.trackPerformance('background_load_duration', loadDuration, {
        notification_count: totalNotifications,
        pages_loaded: currentPage
      })
      queryClient.invalidateQueries({ queryKey: ['notifications-visual-timeline'] })
    }
    
    // Small delay to let component settle
    const timer = setTimeout(fetchData, 1000)
    return () => clearTimeout(timer)
  }, [session, isIndexedDBReady, hasFetched, hasCachedData, enablePolling, refetch, fetchNextPage, queryClient, cacheService])
  
  // Save new notifications to IndexedDB when data changes (from polling)
  useEffect(() => {
    if (!data?.pages || !isIndexedDBReady || !enablePolling) return
    
    const saveNewNotifications = async () => {
      debug.log('[BackgroundNotificationLoader] Checking for new notifications to save:', {
        pageCount: data.pages.length,
        enablePolling,
        timestamp: new Date().toISOString()
      })
      
      // Get all notifications from the query data
      const allNotifications = data.pages.flatMap((page: any) => page.notifications)
      debug.log('[BackgroundNotificationLoader] Total notifications in query data:', {
        count: allNotifications.length,
        timestamp: new Date().toISOString()
      })
      
      if (allNotifications.length > 0) {
        // Save to IndexedDB (it will handle deduplication)
        for (let i = 0; i < data.pages.length; i++) {
          const page = data.pages[i]
          await cacheService.cacheNotifications(page.notifications, i + 1)
        }
        
        // Update metadata
        const oldestDate = new Date(allNotifications[allNotifications.length - 1].indexedAt)
        const newestDate = new Date(allNotifications[0].indexedAt)
        const daysReached = Math.floor((new Date().getTime() - oldestDate.getTime()) / (1000 * 60 * 60 * 24))
        
        ExtendedFetchCache.saveMetadata(
          allNotifications.length,
          oldestDate,
          newestDate,
          daysReached
        )
        
        debug.log('[BackgroundNotificationLoader] Saved notifications to IndexedDB:', {
          count: allNotifications.length,
          daysReached,
          timestamp: new Date().toISOString()
        })
        
        // Prefetch posts for new reply notifications
        const { atProtoClient } = await import('../services/atproto')
        const agent = atProtoClient.agent
        if (agent) {
          const replyNotifications = allNotifications.filter((n: Notification) => n.reason === 'reply')
          if (replyNotifications.length > 0) {
            debug.log('🔄 Prefetching posts for new conversations...')
            await prefetchNotificationPosts(replyNotifications, agent)
            await prefetchRootPosts(replyNotifications, agent)
            debug.log('✅ Posts prefetched for new conversations')
          }
        }
        
        // Trigger re-render in components watching this data
        queryClient.invalidateQueries({ 
          queryKey: ['notifications-extended'],
          refetchType: 'none' // Don't refetch, just notify subscribers
        })
      }
    }
    
    saveNewNotifications()
  }, [data, isIndexedDBReady, enablePolling, cacheService, queryClient])

  // Debug lifecycle
  React.useEffect(() => {
    debug.log('[BackgroundNotificationLoader] Component state:', {
      isIndexedDBReady,
      hasFetched,
      enablePolling,
      hasCachedData,
      isCachedDataStale,
      dataPages: data?.pages?.length || 0,
      timestamp: new Date().toISOString()
    })
  }, [isIndexedDBReady, hasFetched, enablePolling, hasCachedData, isCachedDataStale, data])
  
  // No UI - just background loading
  return null
}