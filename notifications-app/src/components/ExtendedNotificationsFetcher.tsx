import React, { useState, useEffect } from 'react'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { Download, Loader2, Calendar, CheckCircle, RefreshCw, HardDrive } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { getNotificationService } from '../services/atproto/notifications'
import { format, subDays } from 'date-fns'
import { ExtendedFetchCache } from '../utils/extendedFetchCache'
import { StorageManager } from '../utils/storageManager'

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
  })

  // Load persisted data from localStorage on mount
  useEffect(() => {
    if (!session || hasCachedData) return
    
    const persistedData = ExtendedFetchCache.loadData()
    if (persistedData) {
      console.log('📊 Loading extended notifications from localStorage')
      // Set the data in React Query cache
      queryClient.setQueryData(['notifications-extended'], {
        pages: persistedData.pages,
        pageParams: [undefined, ...persistedData.pages.slice(0, -1).map(p => p.cursor)]
      })
      
      // Update progress state
      const allNotifications = persistedData.pages.flatMap(page => page.notifications)
      if (allNotifications.length > 0) {
        const oldestNotification = allNotifications[allNotifications.length - 1]
        const oldestDate = new Date(oldestNotification.indexedAt)
        const daysReached = Math.floor((new Date().getTime() - oldestDate.getTime()) / (1000 * 60 * 60 * 24))
        
        setProgress({
          totalNotifications: allNotifications.length,
          daysReached,
          oldestDate
        })
        
        setLoadedFromStorage(true)
      }
    }
  }, [session])

  // Auto-fetch missing notifications if we have recent 4-week data
  useEffect(() => {
    if (!session || autoFetchTriggered || hasCachedData || fetchingStatus !== 'idle') return
    
    if (fetchInfo.shouldAutoFetch && fetchInfo.metadata) {
      console.log('🔄 Auto-fetching missing notifications due to recent 4-week fetch')
      setAutoFetchTriggered(true)
      handleFetchMissing()
    }
  }, [session, autoFetchTriggered, hasCachedData, fetchingStatus, fetchInfo.shouldAutoFetch])

  const handleFetch4Weeks = async () => {
    setFetchingStatus('fetching')
    setProgress({ totalNotifications: 0, daysReached: 0, oldestDate: null })
    setLoadedFromStorage(false)
    
    console.log('Starting 4-week fetch...')
    
    // Reset the query first to clear any existing data
    queryClient.removeQueries({ queryKey: ['notifications-extended'] })
    
    // Start fetching
    const initialResult = await refetch()
    console.log('Initial fetch result:', { 
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
          console.log('First page already spans 4 weeks')
          shouldContinue = false
        }
      }
    }
    
    // Continue fetching until we reach 4 weeks or no more data
    while (shouldContinue) {
      currentPage++
      console.log(`Fetching page ${currentPage}...`)
      
      // Fetch next page and wait for result
      const result = await fetchNextPage()
      
      console.log('Fetch result:', { 
        hasNextPage: result.hasNextPage, 
        isError: result.isError,
        pagesCount: result.data?.pages?.length 
      })
      
      // Check if we got an error
      if (result.isError) {
        console.log('Error occurred during fetch:', result.error)
        shouldContinue = false
        break
      }
      
      // Check if the fetch was successful but returned no next page
      if (!result.data) {
        console.log('No data returned from fetch')
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
            console.log('Reached 4-week limit')
            shouldContinue = false
            break
          }
        }
        
        // Check if we have more pages to fetch
        const lastPage = latestData.pages[latestData.pages.length - 1]
        if (!lastPage.cursor) {
          console.log('No more cursor - reached end of notifications')
          shouldContinue = false
          break
        }
      }
      
      // Safety limit
      if (currentPage > 100) {
        console.log('Reached page limit')
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
        
        // Save data and metadata about this fetch
        ExtendedFetchCache.saveData(
          finalData.pages,
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
  }

  const handleFetchMissing = async () => {
    setFetchingStatus('fetching')
    
    const metadata = fetchInfo.metadata
    if (!metadata) return
    
    console.log('📊 Fetching notifications since last extended fetch')
    
    // Start fetching from the beginning
    const initialResult = await refetch()
    
    if (!initialResult.isSuccess || !initialResult.data) {
      setFetchingStatus('idle')
      return
    }
    
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
            console.log('✅ Reached previously fetched notifications')
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
        console.log('Reached page limit for missing notifications')
        shouldContinue = false
      }
    }
    
    // Update progress
    const finalData = queryClient.getQueryData(['notifications-extended']) as any
    if (finalData?.pages) {
      const allNotifications = finalData.pages.flatMap((page: any) => page.notifications)
      if (allNotifications.length > 0) {
        const oldestNotification = allNotifications[allNotifications.length - 1]
        const oldestDate = new Date(oldestNotification.indexedAt)
        const daysReached = Math.floor((new Date().getTime() - oldestDate.getTime()) / (1000 * 60 * 60 * 24))
        
        setProgress({
          totalNotifications: allNotifications.length,
          daysReached,
          oldestDate
        })
      }
    }
    
    setFetchingStatus('complete')
    queryClient.invalidateQueries({ queryKey: ['notifications-analytics'] })
  }

  const allNotifications = data?.pages.flatMap(page => page.notifications) || []
  
  const handleClearData = () => {
    queryClient.removeQueries({ queryKey: ['notifications-extended'] })
    setFetchingStatus('idle')
    setProgress({ totalNotifications: 0, daysReached: 0, oldestDate: null })
    setLoadedFromStorage(false)
    // Clear the metadata and data so we don't auto-fetch on next load
    ExtendedFetchCache.clearAll()
    // Invalidate the analytics query to refresh without extended data
    queryClient.invalidateQueries({ queryKey: ['notifications-analytics'] })
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
              : 'Fetch up to 4 weeks of notification history for deeper analytics'
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
          
          <button
            onClick={handleFetch4Weeks}
            disabled={!session || fetchingStatus === 'fetching'}
            className="bsky-button-primary flex items-center gap-2"
            style={{
              background: hasCachedData 
                ? 'linear-gradient(135deg, var(--bsky-success) 0%, #059669 100%)'
                : fetchingStatus === 'fetching' && autoFetchTriggered
                ? 'linear-gradient(135deg, var(--bsky-info) 0%, #3b82f6 100%)'
                : 'linear-gradient(135deg, var(--bsky-primary) 0%, var(--bsky-accent) 100%)'
            }}
          >
            {fetchingStatus === 'fetching' ? (
              <>
                <Loader2 className="animate-spin" size={16} />
                {autoFetchTriggered ? 'Auto-updating...' : 'Fetching...'}
              </>
            ) : hasCachedData ? (
              <>
                <CheckCircle size={16} />
                Update Data
              </>
            ) : fetchInfo.hasRecentFullFetch ? (
              <>
                <RefreshCw size={16} />
                Refresh Full History
              </>
            ) : (
              <>
                <Download size={16} />
                Fetch 4 Weeks
              </>
            )}
          </button>
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
                <HardDrive size={16} style={{ color: 'var(--bsky-primary)' }} />
                <div className="text-sm">
                  <p className="font-medium">Storage Optimized</p>
                  <p style={{ color: 'var(--bsky-text-secondary)' }}>
                    Data automatically compressed to maximize storage efficiency
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