import React, { useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { Download, Loader2, Calendar, CheckCircle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { getNotificationService } from '../services/atproto/notifications'
import { format, subDays } from 'date-fns'

export const ExtendedNotificationsFetcher: React.FC = () => {
  const { session } = useAuth()
  const [fetchingStatus, setFetchingStatus] = useState<'idle' | 'fetching' | 'complete'>('idle')
  const [progress, setProgress] = useState({ 
    totalNotifications: 0, 
    daysReached: 0,
    oldestDate: null as Date | null 
  })

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
    
    // Start fetching
    await refetch()
    
    const fourWeeksAgo = subDays(new Date(), 28)
    let currentPage = 0
    
    // Continue fetching until we reach 4 weeks or no more data
    while (hasNextPage) {
      currentPage++
      
      // Update progress
      if (data?.pages) {
        const allNotifications = data.pages.flatMap(page => page.notifications)
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
            break
          }
        }
      }
      
      // Fetch next page
      await fetchNextPage()
      
      // Safety limit
      if (currentPage > 100) {
        console.log('Reached page limit')
        break
      }
    }
    
    // Final progress update
    if (data?.pages) {
      const allNotifications = data.pages.flatMap(page => page.notifications)
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
  }

  const allNotifications = data?.pages.flatMap(page => page.notifications) || []
  
  return (
    <div className="bsky-card p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Calendar className="text-blue-500" />
            Extended Notification History
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--bsky-text-secondary)' }}>
            Fetch up to 4 weeks of notification history for deeper analytics
          </p>
        </div>
        
        <button
          onClick={handleFetch4Weeks}
          disabled={!session || fetchingStatus === 'fetching'}
          className="bsky-button-primary flex items-center gap-2"
        >
          {fetchingStatus === 'fetching' ? (
            <>
              <Loader2 className="animate-spin" size={16} />
              Fetching...
            </>
          ) : fetchingStatus === 'complete' ? (
            <>
              <CheckCircle size={16} />
              Complete
            </>
          ) : (
            <>
              <Download size={16} />
              Fetch 4 Weeks
            </>
          )}
        </button>
      </div>
      
      {fetchingStatus !== 'idle' && (
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span>Progress</span>
            <span style={{ color: 'var(--bsky-text-secondary)' }}>
              {progress.totalNotifications} notifications • {progress.daysReached} days
            </span>
          </div>
          
          <div className="w-full rounded-full h-2" style={{ backgroundColor: 'var(--bsky-bg-tertiary)' }}>
            <div 
              className="h-2 rounded-full transition-all duration-300"
              style={{ 
                width: `${Math.min((progress.daysReached / 28) * 100, 100)}%`,
                backgroundColor: 'var(--bsky-primary)'
              }}
            />
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