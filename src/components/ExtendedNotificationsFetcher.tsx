import React, { useState, useEffect } from 'react'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { Download, Loader2, Calendar, CheckCircle, RefreshCw, HardDrive, Database } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { getNotificationService } from '../services/atproto/notifications'
import { format, subDays } from 'date-fns'
import { ExtendedFetchCache } from '../utils/extendedFetchCache'
import { StorageManager } from '../utils/storageManager'
import { NotificationCacheService } from '../services/notification-cache-service'
import { prefetchNotificationPosts, prefetchRootPosts } from '../utils/prefetchNotificationPosts'
import { debug } from '@bsky/shared'

export const ExtendedNotificationsFetcher: React.FC = () => {
  const { session } = useAuth()
  const queryClient = useQueryClient()
  const [fetchingStatus, setFetchingStatus] = useState<'idle' | 'fetching' | 'complete'>('idle')
  const [progress, setProgress] = useState({ 
    totalNotifications: 0, 
    daysReached: 0,
    oldestDate: null as Date | null 
  })
  const [autoFetchTriggered, setAutoFetchTriggered] = useState(false)
  const [loadedFromStorage, setLoadedFromStorage] = useState(false)
  const [cacheService] = useState(() => NotificationCacheService.getInstance())
  const [isIndexedDBReady, setIsIndexedDBReady] = useState(false)
  const [initialFetchStarted, setInitialFetchStarted] = useState(false)
  
  // Check if we already have cached data
  const cachedData = queryClient.getQueryData(['notifications-extended']) as any
  const hasCachedData = cachedData?.pages?.length > 0
  const cachedNotifications = cachedData?.pages?.flatMap((page: any) => page.notifications) || []
  const cachedStats = React.useMemo(() => {
    if (!hasCachedData || cachedNotifications.length === 0) return null
    
    const oldestNotification = cachedNotifications[cachedNotifications.length - 1]
    const oldestDate = new Date(oldestNotification.indexedAt)
    const daysReached = Math.floor((new Date().getTime() - oldestDate.getTime()) / (1000 * 60 * 60 * 24))
    
    return {
      totalNotifications: cachedNotifications.length,
      daysReached,
      oldestDate,
      newestDate: new Date(cachedNotifications[0].indexedAt)
    }
  }, [hasCachedData, cachedNotifications])

  // Check for recent extended fetch metadata
  const fetchInfo = ExtendedFetchCache.getFetchInfo()
  
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['notifications-extended'],
    queryFn: async ({ pageParam }) => {
      const { atProtoClient } = await import('../services/atproto')
      const agent = atProtoClient.agent
      if (!agent) throw new Error('Not authenticated')
      const notificationService = getNotificationService(agent)
      return notificationService.listNotifications(pageParam, false, 100) // Use max limit
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.cursor,
    enabled: false, // Manual trigger only
    staleTime: Infinity, // Don't auto-refetch
    refetchInterval: 10 * 1000, // Refetch every 10 seconds when enabled
  })

  // Initialize IndexedDB
  useEffect(() => {
    const initCache = async () => {
      try {
        await cacheService.init()
        setIsIndexedDBReady(true)
      } catch (error) {
        debug.error('Failed to initialize IndexedDB:', error)
        // Fall back to localStorage behavior
        setIsIndexedDBReady(false)
      }
    }
    initCache()
  }, [])

  // Load persisted data from IndexedDB or localStorage on mount
  useEffect(() => {
    if (!session || hasCachedData || !isIndexedDBReady) return
    
    const loadCachedData = async () => {
      // First try IndexedDB
      const hasCached = await cacheService.hasCachedData()
      if (hasCached) {
        debug.log('📊 Loading extended notifications from IndexedDB')
        const cachedResult = await cacheService.getCachedNotifications(10000) // Load up to 10k notifications
        
        if (cachedResult.notifications.length > 0) {
          // Convert to React Query format
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
          
          const oldestNotification = cachedResult.notifications[cachedResult.notifications.length - 1]
          const oldestDate = new Date(oldestNotification.indexedAt)
          const daysReached = Math.floor((new Date().getTime() - oldestDate.getTime()) / (1000 * 60 * 60 * 24))
          
          setProgress({
            totalNotifications: cachedResult.notifications.length,
            daysReached,
            oldestDate
          })
          
          setLoadedFromStorage(true)
          
          // Prefetch posts for cached reply notifications in the background
          const { atProtoClient } = await import('../services/atproto')
          const agent = atProtoClient.agent
          if (agent) {
            // Don't await - let it run in the background
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
          
          return
        }
      }
      
      // No longer fall back to localStorage - IndexedDB is our only source
      debug.log('📊 No extended notifications found in IndexedDB')
    }
    
    loadCachedData()
  }, [session, hasCachedData, isIndexedDBReady])

  // Auto-fetch missing notifications if we have recent 4-week data
  useEffect(() => {
    if (!session || autoFetchTriggered || hasCachedData || fetchingStatus !== 'idle') return
    
    if (fetchInfo.shouldAutoFetch && fetchInfo.metadata) {
      debug.log('🔄 Auto-fetching missing notifications due to recent 4-week fetch')
      setAutoFetchTriggered(true)
      handleFetchMissing()
    }
  }, [session, autoFetchTriggered, hasCachedData, fetchingStatus, fetchInfo.shouldAutoFetch])

  // Auto-fetch 4 weeks of data on mount if no cached data exists
  useEffect(() => {
    if (!session || !isIndexedDBReady || initialFetchStarted || hasCachedData || loadedFromStorage || fetchingStatus !== 'idle') return
    
    // Small delay to ensure component is fully mounted
    const timer = setTimeout(() => {
      debug.log('🚀 Starting automatic 4-week fetch on mount')
      setInitialFetchStarted(true)
      handleFetch4Weeks()
    }, 500)
    
    return () => clearTimeout(timer)
  }, [session, isIndexedDBReady, initialFetchStarted, hasCachedData, loadedFromStorage, fetchingStatus])

  const handleFetch4Weeks = async () => {
    setFetchingStatus('fetching')
    setProgress({ totalNotifications: 0, daysReached: 0, oldestDate: null })
    setLoadedFromStorage(false)
    
    debug.log('Starting 4-week fetch...')
    
    // Don't remove existing data - let React Query handle the refresh
    // This will replace the data instead of clearing it first
    
    // Start fetching
    const initialResult = await refetch()
    debug.log('Initial fetch result:', { 
      isSuccess: initialResult.isSuccess,
      hasData: !!initialResult.data,
      pagesCount: initialResult.data?.pages?.length 
    })
    
    const fourWeeksAgo = subDays(new Date(), 28)
    let currentPage = 1 // Start at 1 since we already fetched the first page
    let shouldContinue = initialResult.isSuccess && !!initialResult.data
    
    // Check if we need to continue after the first fetch
    if (shouldContinue && initialResult.data?.pages) {
      const firstPageNotifications = initialResult.data.pages[0]?.notifications || []
      if (firstPageNotifications.length > 0) {
        const oldestDate = new Date(firstPageNotifications[firstPageNotifications.length - 1].indexedAt)
        const daysReached = Math.floor((new Date().getTime() - oldestDate.getTime()) / (1000 * 60 * 60 * 24))
        
        // Update initial progress
        setProgress({
          totalNotifications: firstPageNotifications.length,
          daysReached,
          oldestDate
        })
        
        if (oldestDate < fourWeeksAgo) {
          debug.log('First page already spans 4 weeks')
          shouldContinue = false
        }
      }
    }
    
    // Continue fetching until we reach 4 weeks or no more data
    while (shouldContinue) {
      currentPage++
      debug.log(`Fetching page ${currentPage}...`)
      
      // Fetch next page and wait for result
      const result = await fetchNextPage()
      
      debug.log('Fetch result:', { 
        hasNextPage: result.hasNextPage, 
        isError: result.isError,
        pagesCount: result.data?.pages?.length 
      })
      
      // Check if we got an error
      if (result.isError) {
        debug.log('Error occurred during fetch:', result.error)
        shouldContinue = false
        break
      }
      
      // Check if the fetch was successful but returned no next page
      if (!result.data) {
        debug.log('No data returned from fetch')
        shouldContinue = false
        break
      }
      
      // Update progress with the latest data
      const latestData = result.data
      if (latestData?.pages) {
        const allNotifications = latestData.pages.flatMap(page => page.notifications)
        const totalCount = allNotifications.length
        
        if (allNotifications.length > 0) {
          const oldestNotification = allNotifications[allNotifications.length - 1]
          const oldestDate = new Date(oldestNotification.indexedAt)
          const daysReached = Math.floor((new Date().getTime() - oldestDate.getTime()) / (1000 * 60 * 60 * 24))
          
          setProgress({
            totalNotifications: totalCount,
            daysReached,
            oldestDate
          })
          
          // Check if we've reached 4 weeks
          if (oldestDate < fourWeeksAgo) {
            debug.log('Reached 4-week limit')
            shouldContinue = false
            break
          }
        }
        
        // Check if we have more pages to fetch
        const lastPage = latestData.pages[latestData.pages.length - 1]
        if (!lastPage.cursor) {
          debug.log('No more cursor - reached end of notifications')
          shouldContinue = false
          break
        }
      }
      
      // Safety limit
      if (currentPage > 100) {
        debug.log('Reached page limit')
        shouldContinue = false
        break
      }
    }
    
    // Get the final data state after all fetches
    const finalData = queryClient.getQueryData(['notifications-extended']) as any
    if (finalData?.pages) {
      const allNotifications = finalData.pages.flatMap((page: any) => page.notifications)
      if (allNotifications.length > 0) {
        const oldestNotification = allNotifications[allNotifications.length - 1]
        const newestNotification = allNotifications[0]
        const oldestDate = new Date(oldestNotification.indexedAt)
        const newestDate = new Date(newestNotification.indexedAt)
        const daysReached = Math.floor((new Date().getTime() - oldestDate.getTime()) / (1000 * 60 * 60 * 24))
        
        setProgress({
          totalNotifications: allNotifications.length,
          daysReached,
          oldestDate
        })
        
        // Save to IndexedDB
        if (isIndexedDBReady) {
          debug.log('💾 Saving notifications to IndexedDB...')
          for (let i = 0; i < finalData.pages.length; i++) {
            const page = finalData.pages[i]
            await cacheService.cacheNotifications(page.notifications, i + 1)
          }
          debug.log('✅ Saved to IndexedDB')
        }
        
        // Prefetch posts for reply notifications
        const { atProtoClient } = await import('../services/atproto')
        const agent = atProtoClient.agent
        if (agent) {
          debug.log('🔄 Prefetching posts for conversations...')
          
          // Get reply notifications
          const replyNotifications = allNotifications.filter((n: any) => n.reason === 'reply')
          
          if (replyNotifications.length > 0) {
            // Prefetch the reply posts and root posts
            await prefetchNotificationPosts(replyNotifications, agent)
            await prefetchRootPosts(replyNotifications, agent)
            debug.log('✅ Posts prefetched for conversations')
          }
        }
        
        // No longer save to localStorage - IndexedDB is our primary storage
        // ExtendedFetchCache metadata is still useful for tracking fetch times
        ExtendedFetchCache.saveMetadata(
          allNotifications.length,
          oldestDate,
          newestDate,
          daysReached
        )
      }
    }
    
    setFetchingStatus('complete')
    
    // Invalidate the analytics query to use the new extended data
    queryClient.invalidateQueries({ queryKey: ['notifications-analytics'] })
    queryClient.invalidateQueries({ queryKey: ['notifications-visual-timeline'] })
  }

  const handleFetchMissing = async () => {
    setFetchingStatus('fetching')
    
    const metadata = fetchInfo.metadata
    if (!metadata) return
    
    debug.log('📊 Fetching notifications since last extended fetch')
    
    // Start fetching from the beginning
    const initialResult = await refetch()
    
    if (!initialResult.isSuccess || !initialResult.data) {
      setFetchingStatus('idle')
      return
    }
    
    // Don't invalidate immediately - wait until we have new data
    // This prevents the analytics from losing data during the fetch
    
    // Fetch until we reach the newest notification from our last fetch
    const targetDate = new Date(metadata.newestNotificationDate)
    let shouldContinue = true
    let currentPage = 1
    
    while (shouldContinue && hasNextPage) {
      const latestData = queryClient.getQueryData(['notifications-extended']) as any
      if (latestData?.pages) {
        const allNotifs = latestData.pages.flatMap((page: any) => page.notifications)
        
        // Check if we've reached notifications we already have
        const oldestInBatch = allNotifs[allNotifs.length - 1]
        if (oldestInBatch) {
          const oldestDate = new Date(oldestInBatch.indexedAt)
          if (oldestDate <= targetDate) {
            debug.log('✅ Reached previously fetched notifications')
            shouldContinue = false
            break
          }
        }
      }
      
      if (shouldContinue) {
        currentPage++
        const result = await fetchNextPage()
        if (result.isError || !result.hasNextPage) {
          shouldContinue = false
        }
      }
      
      // Safety limit
      if (currentPage > 10) {
        debug.log('Reached page limit for missing notifications')
        shouldContinue = false
      }
    }
    
    // Update progress
    const finalData = queryClient.getQueryData(['notifications-extended']) as any
    if (finalData?.pages) {
      const allNotifications = finalData.pages.flatMap((page: any) => page.notifications)
      if (allNotifications.length > 0) {
        const oldestNotification = allNotifications[allNotifications.length - 1]
        const newestNotification = allNotifications[0]
        const oldestDate = new Date(oldestNotification.indexedAt)
        const newestDate = new Date(newestNotification.indexedAt)
        const daysReached = Math.floor((new Date().getTime() - oldestDate.getTime()) / (1000 * 60 * 60 * 24))
        
        setProgress({
          totalNotifications: allNotifications.length,
          daysReached,
          oldestDate
        })
        
        // Save the updated data to IndexedDB
        if (isIndexedDBReady) {
          debug.log('💾 Saving updated notifications to IndexedDB...')
          // Clear and re-save all pages to ensure consistency
          await cacheService.clearCache()
          for (let i = 0; i < finalData.pages.length; i++) {
            const page = finalData.pages[i]
            await cacheService.cacheNotifications(page.notifications, i + 1)
          }
          debug.log('✅ Updated IndexedDB with new notifications')
        }
        
        // Prefetch posts for reply notifications
        const { atProtoClient } = await import('../services/atproto')
        const agent = atProtoClient.agent
        if (agent) {
          debug.log('🔄 Prefetching posts for conversations...')
          
          // Get reply notifications
          const replyNotifications = allNotifications.filter((n: any) => n.reason === 'reply')
          
          if (replyNotifications.length > 0) {
            // Prefetch the reply posts and root posts
            await prefetchNotificationPosts(replyNotifications, agent)
            await prefetchRootPosts(replyNotifications, agent)
            debug.log('✅ Posts prefetched for conversations')
          }
        }
        
        // Update metadata
        ExtendedFetchCache.saveMetadata(
          allNotifications.length,
          oldestDate,
          newestDate,
          daysReached
        )
      }
    }
    
    setFetchingStatus('complete')
    
    // Only invalidate after we've successfully fetched new data
    // This ensures analytics always has data to display
    if (finalData?.pages?.length > 0) {
      queryClient.invalidateQueries({ queryKey: ['notifications-analytics'] })
      queryClient.invalidateQueries({ queryKey: ['notifications-visual-timeline'] })
    }
  }

  const allNotifications = data?.pages.flatMap(page => page.notifications) || []
  
  const handleClearData = async () => {
    queryClient.removeQueries({ queryKey: ['notifications-extended'] })
    setFetchingStatus('idle')
    setProgress({ totalNotifications: 0, daysReached: 0, oldestDate: null })
    setLoadedFromStorage(false)
    
    // Clear IndexedDB
    if (isIndexedDBReady) {
      await cacheService.clearCache()
    }
    
    // Clear the metadata and data so we don't auto-fetch on next load
    ExtendedFetchCache.clearAll()
    // Invalidate the analytics query to refresh without extended data
    queryClient.invalidateQueries({ queryKey: ['notifications-analytics'] })
    queryClient.invalidateQueries({ queryKey: ['notifications-visual-timeline'] })
  }
  
  // Show minimal UI during initial automatic fetch
  if (fetchingStatus === 'fetching' && !hasCachedData && initialFetchStarted && !autoFetchTriggered) {
    return (
      <div className="bsky-card p-6 mb-6" style={{
        background: 'linear-gradient(135deg, var(--bsky-bg-secondary) 0%, rgba(59, 130, 246, 0.05) 100%)',
        borderColor: 'var(--bsky-primary)',
        borderWidth: '2px'
      }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Loader2 className="animate-spin text-blue-500" size={24} />
            <div>
              <h2 className="text-lg font-semibold">Loading Extended Analytics</h2>
              <p className="text-sm mt-1" style={{ color: 'var(--bsky-text-secondary)' }}>
                Fetching 4 weeks of notification history...
              </p>
            </div>
          </div>
        </div>
        
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="font-medium">Progress</span>
            <span style={{ color: 'var(--bsky-text-secondary)' }}>
              {progress.totalNotifications} notifications • {progress.daysReached} days
            </span>
          </div>
          
          <div className="w-full rounded-full h-3" style={{ backgroundColor: 'var(--bsky-bg-tertiary)' }}>
            <div 
              className="h-3 rounded-full transition-all duration-300 relative overflow-hidden"
              style={{ 
                width: `${Math.min((progress.daysReached / 28) * 100, 100)}%`,
                background: 'linear-gradient(90deg, var(--bsky-primary) 0%, var(--bsky-accent) 100%)'
              }}
            >
              <div 
                className="absolute inset-0 opacity-30"
                style={{
                  background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.5) 50%, transparent 100%)',
                  animation: 'slide 1.5s infinite'
                }}
              />
            </div>
          </div>
          
          {progress.oldestDate && (
            <p className="text-sm" style={{ color: 'var(--bsky-text-secondary)' }}>
              Reached: {format(progress.oldestDate, 'MMM d, yyyy')}
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="bsky-card p-6 mb-6" style={{
      background: hasCachedData 
        ? 'linear-gradient(135deg, var(--bsky-bg-secondary) 0%, rgba(0, 133, 255, 0.05) 100%)'
        : 'var(--bsky-bg-secondary)',
      borderColor: hasCachedData ? 'var(--bsky-primary)' : 'var(--bsky-border-primary)',
      borderWidth: hasCachedData ? '2px' : '1px'
    }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Calendar className={hasCachedData ? "text-green-500" : "text-blue-500"} />
            Extended Notification History
            {hasCachedData && (
              <span className="text-xs px-2 py-1 rounded-full" style={{
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                color: 'var(--bsky-success)',
                border: '1px solid rgba(16, 185, 129, 0.3)'
              }}>
                {loadedFromStorage ? 'Loaded from Cache' : 'Data Loaded'}
              </span>
            )}
            {!hasCachedData && fetchInfo.hasRecentFullFetch && (
              <span className="text-xs px-2 py-1 rounded-full" style={{
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                color: 'var(--bsky-primary)',
                border: '1px solid rgba(59, 130, 246, 0.3)'
              }}>
                Recent fetch {fetchInfo.hoursSinceLastFetch?.toFixed(1)}h ago
              </span>
            )}
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--bsky-text-secondary)' }}>
            {hasCachedData 
              ? `Currently viewing ${cachedStats?.totalNotifications || 0} notifications from ${cachedStats?.daysReached || 0} days`
              : fetchInfo.hasRecentFullFetch && fetchInfo.metadata
              ? `Last fetched ${fetchInfo.metadata.totalNotificationsFetched} notifications (${fetchInfo.metadata.daysReached} days) ${fetchingStatus === 'fetching' ? '• Auto-updating...' : ''}`
              : 'Extended analytics will load automatically...'
            }
          </p>
        </div>
        
        <div className="flex gap-2">
          {(fetchingStatus === 'complete' || hasCachedData) && (
            <button
              onClick={handleClearData}
              className="bsky-button-secondary flex items-center gap-2"
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                borderColor: 'rgba(239, 68, 68, 0.3)',
                color: 'var(--bsky-error)'
              }}
            >
              Clear Data
            </button>
          )}
          
          {hasCachedData && (
            <button
              onClick={handleFetch4Weeks}
              disabled={!session || fetchingStatus === 'fetching'}
              className="bsky-button-primary flex items-center gap-2"
              style={{
                background: 'linear-gradient(135deg, var(--bsky-success) 0%, #059669 100%)'
              }}
            >
              {fetchingStatus === 'fetching' ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  Updating...
                </>
              ) : (
                <>
                  <RefreshCw size={16} />
                  Refresh Data
                </>
              )}
            </button>
          )}
        </div>
      </div>
      
      {/* Show cached data stats when not fetching */}
      {fetchingStatus === 'idle' && (hasCachedData && cachedStats ? (
        <div className="mt-4 p-4 rounded-lg" style={{ 
          backgroundColor: 'rgba(0, 133, 255, 0.05)',
          border: '1px solid rgba(0, 133, 255, 0.1)'
        }}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p style={{ color: 'var(--bsky-text-secondary)' }}>Total Notifications</p>
              <p className="text-lg font-semibold">{cachedStats.totalNotifications}</p>
            </div>
            <div>
              <p style={{ color: 'var(--bsky-text-secondary)' }}>Days Covered</p>
              <p className="text-lg font-semibold">{cachedStats.daysReached}</p>
            </div>
            <div>
              <p style={{ color: 'var(--bsky-text-secondary)' }}>From</p>
              <p className="text-lg font-semibold">{format(cachedStats.oldestDate, 'MMM d')}</p>
            </div>
            <div>
              <p style={{ color: 'var(--bsky-text-secondary)' }}>To</p>
              <p className="text-lg font-semibold">{format(cachedStats.newestDate, 'MMM d')}</p>
            </div>
          </div>
          {loadedFromStorage && (
            <p className="text-xs mt-2" style={{ color: 'var(--bsky-text-secondary)' }}>
              ✅ Data loaded from browser cache • No API calls required
            </p>
          )}
        </div>
      ) : fetchInfo.hasRecentFullFetch && fetchInfo.metadata && (
        <div className="mt-4 p-4 rounded-lg" style={{ 
          backgroundColor: 'rgba(251, 191, 36, 0.05)',
          border: '1px solid rgba(251, 191, 36, 0.2)'
        }}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p style={{ color: 'var(--bsky-text-secondary)' }}>Previously Fetched</p>
              <p className="text-lg font-semibold">{fetchInfo.metadata.totalNotificationsFetched}</p>
            </div>
            <div>
              <p style={{ color: 'var(--bsky-text-secondary)' }}>Days Covered</p>
              <p className="text-lg font-semibold">{fetchInfo.metadata.daysReached}</p>
            </div>
            <div>
              <p style={{ color: 'var(--bsky-text-secondary)' }}>From</p>
              <p className="text-lg font-semibold">{format(new Date(fetchInfo.metadata.oldestNotificationDate), 'MMM d')}</p>
            </div>
            <div>
              <p style={{ color: 'var(--bsky-text-secondary)' }}>To</p>
              <p className="text-lg font-semibold">{format(new Date(fetchInfo.metadata.newestNotificationDate), 'MMM d')}</p>
            </div>
          </div>
          <p className="text-xs mt-2" style={{ color: 'var(--bsky-text-secondary)' }}>
            ⚠️ Data not in memory. Click "Refresh Full History" to reload or it will auto-update with new notifications.
          </p>
        </div>
      ))}
      
      {fetchingStatus !== 'idle' && (
        <div className="space-y-3">
          {autoFetchTriggered && fetchingStatus === 'fetching' && (
            <div className="mb-3 p-3 rounded-lg flex items-center gap-2" style={{
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.3)'
            }}>
              <RefreshCw className="animate-spin text-blue-500" size={16} />
              <p className="text-sm">
                <span className="font-medium">Auto-updating notifications</span>
                <span style={{ color: 'var(--bsky-text-secondary)' }}> • Fetching notifications since your last 4-week download</span>
              </p>
            </div>
          )}
          
          <div className="flex justify-between text-sm">
            <span className="font-medium">Fetching Progress</span>
            <span style={{ color: 'var(--bsky-text-secondary)' }}>
              {progress.totalNotifications} notifications • {progress.daysReached} days
            </span>
          </div>
          
          <div className="w-full rounded-full h-3" style={{ backgroundColor: 'var(--bsky-bg-tertiary)' }}>
            <div 
              className="h-3 rounded-full transition-all duration-300 relative overflow-hidden"
              style={{ 
                width: `${Math.min((progress.daysReached / 28) * 100, 100)}%`,
                background: 'linear-gradient(90deg, var(--bsky-primary) 0%, var(--bsky-accent) 100%)'
              }}
            >
              <div 
                className="absolute inset-0 opacity-30"
                style={{
                  background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.5) 50%, transparent 100%)',
                  animation: 'slide 1.5s infinite'
                }}
              />
            </div>
          </div>
          
          {progress.oldestDate && (
            <p className="text-sm" style={{ color: 'var(--bsky-text-secondary)' }}>
              Oldest notification: {format(progress.oldestDate, 'MMM d, yyyy')}
            </p>
          )}
          
          {fetchingStatus === 'complete' && (
            <div className="mt-4 space-y-3">
              <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--bsky-bg-tertiary)' }}>
                <p className="text-sm font-medium mb-2">Fetch Complete!</p>
                <p className="text-sm" style={{ color: 'var(--bsky-text-secondary)' }}>
                  Successfully fetched {allNotifications.length} notifications spanning {
                    allNotifications.length > 0 
                      ? Math.floor((new Date().getTime() - new Date(allNotifications[allNotifications.length - 1].indexedAt).getTime()) / (1000 * 60 * 60 * 24))
                      : 0
                  } days.
                  The data is now available for all analytics views.
                </p>
              </div>
              
              {/* Storage optimization info */}
              <div className="p-3 rounded-lg flex items-center gap-3" style={{ 
                backgroundColor: 'rgba(59, 130, 246, 0.05)',
                border: '1px solid rgba(59, 130, 246, 0.2)'
              }}>
                <Database size={16} style={{ color: 'var(--bsky-primary)' }} />
                <div className="text-sm">
                  <p className="font-medium">IndexedDB Storage</p>
                  <p style={{ color: 'var(--bsky-text-secondary)' }}>
                    Data stored in high-performance IndexedDB for instant access
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}