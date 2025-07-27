import React, { useState } from 'react'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { Download, Loader2, Calendar, CheckCircle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { getNotificationService } from '../services/atproto/notifications'
import { format, subDays } from 'date-fns'

export const ExtendedNotificationsFetcher: React.FC = () => {
  const { session } = useAuth()
  const queryClient = useQueryClient()
  const [fetchingStatus, setFetchingStatus] = useState<'idle' | 'fetching' | 'complete'>('idle')
  const [progress, setProgress] = useState({ 
    totalNotifications: 0, 
    daysReached: 0,
    oldestDate: null as Date | null 
  })
  
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

  const handleFetch4Weeks = async () => {
    setFetchingStatus('fetching')
    setProgress({ totalNotifications: 0, daysReached: 0, oldestDate: null })
    
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
    
    // Invalidate the analytics query to use the new extended data
    queryClient.invalidateQueries({ queryKey: ['notifications-analytics'] })
  }

  const allNotifications = data?.pages.flatMap(page => page.notifications) || []
  
  const handleClearData = () => {
    queryClient.removeQueries({ queryKey: ['notifications-extended'] })
    setFetchingStatus('idle')
    setProgress({ totalNotifications: 0, daysReached: 0, oldestDate: null })
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
                Data Loaded
              </span>
            )}
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--bsky-text-secondary)' }}>
            {hasCachedData 
              ? `Currently viewing ${cachedStats?.totalNotifications || 0} notifications from ${cachedStats?.daysReached || 0} days`
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
                : 'linear-gradient(135deg, var(--bsky-primary) 0%, var(--bsky-accent) 100%)'
            }}
          >
            {fetchingStatus === 'fetching' ? (
              <>
                <Loader2 className="animate-spin" size={16} />
                Fetching...
              </>
            ) : hasCachedData ? (
              <>
                <CheckCircle size={16} />
                Update Data
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
      {hasCachedData && fetchingStatus === 'idle' && cachedStats && (
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
        </div>
      )}
      
      {fetchingStatus !== 'idle' && (
        <div className="space-y-3">
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
            <div className="mt-4 p-4 rounded-lg" style={{ backgroundColor: 'var(--bsky-bg-tertiary)' }}>
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
          )}
        </div>
      )}
    </div>
  )
}