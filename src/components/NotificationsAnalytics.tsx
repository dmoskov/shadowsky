import React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { TrendingUp, Users, Heart, MessageCircle, BarChart3, Bell, Clock, Repeat2, UserPlus, Calendar, Activity } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { format, subDays, startOfDay, subHours } from 'date-fns'
import { useExtendedNotifications } from '../hooks/useExtendedNotifications'
import { BackgroundNotificationLoader } from './BackgroundNotificationLoader'
import { useFeatureTracking, useInteractionTracking } from '../hooks/useAnalytics'
import { analytics as analyticsService } from '../services/analytics'
import { proxifyBskyImage } from '../utils/image-proxy'

type TimeRange = '1d' | '3d' | '7d' | '4w'

// Component to track when charts come into view
const TrackedChart: React.FC<{ chartName: string; children: React.ReactNode }> = ({ chartName, children }) => {
  const ref = React.useRef<HTMLDivElement>(null)
  const [hasTracked, setHasTracked] = React.useState(false)
  
  React.useEffect(() => {
    if (hasTracked || !ref.current) return
    
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasTracked) {
          analyticsService.trackAnalyticsView(chartName)
          setHasTracked(true)
        }
      },
      { threshold: 0.5 }
    )
    
    observer.observe(ref.current)
    
    return () => observer.disconnect()
  }, [chartName, hasTracked])
  
  return <div ref={ref}>{children}</div>
}

export const NotificationsAnalytics: React.FC = () => {
  const { agent } = useAuth()
  const queryClient = useQueryClient()
  const [timeRange, setTimeRange] = React.useState<TimeRange>('7d')
  
  // Analytics hooks
  const { trackFeatureAction } = useFeatureTracking('analytics')
  const { trackClick } = useInteractionTracking()
  
  // Wrap setTimeRange to track analytics
  const handleTimeRangeChange = (newRange: TimeRange) => {
    setTimeRange(newRange)
    trackFeatureAction('time_range_changed', { range: newRange })
    analyticsService.trackAnalyticsInteraction('time_range_changed', newRange)
  }
  

  // Check if we have extended data available (from memory or IndexedDB)
  const { extendedData, hasExtendedData } = useExtendedNotifications()

  // Query for current stats - only fetch if we don't have extended data
  const { data: currentStats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['notifications-summary'],
    queryFn: async () => {
      if (!agent) throw new Error('Not authenticated')
      const response = await agent.app.bsky.notification.listNotifications({ limit: 50 })
      return response.data
    },
    refetchInterval: 60 * 1000, // Refetch every 60 seconds - reduced from 10s
    enabled: !hasExtendedData, // Don't fetch if we have extended data
    refetchOnWindowFocus: false
  })

  // Query for analytics data - use extended data if available, otherwise fetch
  const { data: notifications } = useQuery({
    queryKey: ['notifications-analytics', timeRange, hasExtendedData],
    queryFn: async () => {
      if (!agent) throw new Error('Not authenticated')
      
      // If we have extended data (from IndexedDB), use it instead of fetching
      if (hasExtendedData && extendedData?.pages) {
        const allNotifications = extendedData.pages.flatMap((page: any) => page.notifications)
        console.log('📊 Using cached data for analytics:', {
          totalNotifications: allNotifications.length,
          oldestDate: allNotifications.length > 0 ? new Date(allNotifications[allNotifications.length - 1].indexedAt) : null,
          newestDate: allNotifications.length > 0 ? new Date(allNotifications[0].indexedAt) : null,
          timeRange
        })
        return { notifications: allNotifications }
      }
      
      // Otherwise, fetch fresh data based on the selected time range
      const allNotifications: any[] = []
      let cursor: string | undefined
      
      // Determine how far back to fetch based on time range
      const cutoffDate = timeRange === '1d' ? subDays(new Date(), 1) :
                        timeRange === '3d' ? subDays(new Date(), 3) :
                        timeRange === '7d' ? subDays(new Date(), 7) :
                        subDays(new Date(), 28)
      
      let hasMoreToFetch = true
      
      while (hasMoreToFetch) {
        const response = await agent.app.bsky.notification.listNotifications({ 
          limit: 100,
          cursor 
        })
        
        allNotifications.push(...response.data.notifications)
        cursor = response.data.cursor
        
        // Check if we've fetched notifications older than cutoff date or no more cursor
        const oldestNotification = response.data.notifications[response.data.notifications.length - 1]
        if (!cursor || (oldestNotification && new Date(oldestNotification.indexedAt) < cutoffDate)) {
          hasMoreToFetch = false
        }
        
        // Safety limit to prevent infinite loops
        if (allNotifications.length > 5000) {
          hasMoreToFetch = false
        }
      }
      
      return { notifications: allNotifications }
    },
    enabled: !!agent,
    staleTime: hasExtendedData ? 5 * 60 * 1000 : 2 * 60 * 1000, // Longer stale time if using cached data
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchInterval: 60 * 1000, // Refetch every 60 seconds - reduced from 10s
    refetchOnMount: 'always', // Always fetch fresh data on mount
    refetchOnWindowFocus: false // Don't refetch on window focus
  })

  const analytics = React.useMemo(() => {
    // Always generate analytics structure, even with no data
    if (!notifications?.notifications) return null

    const now = new Date()
    
    // Filter notifications based on selected time range
    // Note: notification.indexedAt is in UTC but new Date() automatically converts to local timezone
    const timeRangeHours = {
      '1d': 24,
      '3d': 72,
      '7d': 168,
      '4w': 672
    }
    
    const cutoffDate = subHours(now, timeRangeHours[timeRange])
    const filteredNotifications = notifications.notifications.filter(
      (n: any) => new Date(n.indexedAt) >= cutoffDate
    )
    
    console.log('📊 Analytics filtering:', {
      timeRange,
      totalNotifications: notifications.notifications.length,
      filteredCount: filteredNotifications.length,
      cutoffDate,
      hasExtendedData
    })
    
    
    // Don't return null if no data - still show the chart structure
    // if (filteredNotifications.length === 0) return null
    
    // Calculate the actual date range of the filtered data
    const sortedNotifications = filteredNotifications.length > 0 
      ? [...filteredNotifications].sort(
          (a, b) => new Date(a.indexedAt).getTime() - new Date(b.indexedAt).getTime()
        )
      : []
    
    const oldestDate = sortedNotifications.length > 0 
      ? new Date(sortedNotifications[0].indexedAt)
      : cutoffDate
    const newestDate = sortedNotifications.length > 0 
      ? new Date(sortedNotifications[sortedNotifications.length - 1].indexedAt)
      : now
    
    // Create time buckets based on the selected range
    let buckets: Array<{
      startDate: Date
      endDate: Date
      label: string
      likes: number
      reposts: number
      follows: number
      replies: number
      mentions: number
      total: number
    }> = []
    
    if (timeRange === '1d') {
      // Hourly buckets for last 24 hours (group by 2-hour chunks)
      for (let i = 11; i >= 0; i--) {
        const endDate = subHours(now, i * 2)
        const startDate = subHours(now, (i + 1) * 2)
        
        // Check if this bucket is today or yesterday
        const isToday = endDate.toDateString() === now.toDateString()
        const yesterday = new Date(now)
        yesterday.setDate(yesterday.getDate() - 1)
        const isYesterday = endDate.toDateString() === yesterday.toDateString()
        
        let label = format(endDate, 'h a')
        if (!isToday && isYesterday) {
          // Add "Yesterday" prefix for clarity only when it's actually yesterday
          label = `Yesterday ${format(endDate, 'h a')}`
        } else if (i === 0) {
          // Most recent bucket
          label = 'Now'
        }
        
        buckets.push({
          startDate,
          endDate,
          label,
          likes: 0,
          reposts: 0,
          follows: 0,
          replies: 0,
          mentions: 0,
          total: 0
        })
      }
    } else if (timeRange === '3d') {
      // 6-hour buckets for 3 days
      for (let i = 11; i >= 0; i--) {
        const endDate = subHours(now, i * 6)
        const startDate = subHours(now, (i + 1) * 6)
        buckets.push({
          startDate,
          endDate,
          label: i === 0 ? 'Now' : format(endDate, 'EEE h a'),
          likes: 0,
          reposts: 0,
          follows: 0,
          replies: 0,
          mentions: 0,
          total: 0
        })
      }
    } else if (timeRange === '7d') {
      // Daily buckets for 7 days
      for (let i = 6; i >= 0; i--) {
        const date = startOfDay(subDays(now, i))
        const nextDate = startOfDay(subDays(now, i - 1))
        buckets.push({
          startDate: date,
          endDate: i === 0 ? now : nextDate,
          label: format(date, 'EEE'),
          likes: 0,
          reposts: 0,
          follows: 0,
          replies: 0,
          mentions: 0,
          total: 0
        })
      }
    } else {
      // Daily buckets for 4 weeks (28 days)
      for (let i = 27; i >= 0; i--) {
        const date = startOfDay(subDays(now, i))
        const nextDate = i === 0 ? now : startOfDay(subDays(now, i - 1))
        buckets.push({
          startDate: date,
          endDate: nextDate,
          label: i === 0 ? 'Today' : i === 1 ? 'Yesterday' : format(date, 'MMM d'),
          likes: 0,
          reposts: 0,
          follows: 0,
          replies: 0,
          mentions: 0,
          total: 0
        })
      }
    }

    // Count notifications by bucket and type
    
    filteredNotifications.forEach((notification: any) => {
      // Parse the UTC timestamp and it will automatically convert to local timezone
      const notifDate = new Date(notification.indexedAt)
      const bucket = buckets.find(b => 
        notifDate >= b.startDate && notifDate < b.endDate
      )
      
      if (bucket) {
        bucket.total++
        switch (notification.reason) {
          case 'like': bucket.likes++; break
          case 'repost': bucket.reposts++; break
          case 'follow': bucket.follows++; break
          case 'reply': bucket.replies++; break
          case 'mention': bucket.mentions++; break
        }
      }
    })

    // Find most active users (use filtered notifications, excluding subscription notifications)
    const userActivity = new Map<string, number>()
    filteredNotifications.forEach((notification: any) => {
      // Exclude starterpack-joined notifications from "Top Users Engaging"
      if (notification.reason !== 'starterpack-joined') {
        const key = notification.author.handle
        userActivity.set(key, (userActivity.get(key) || 0) + 1)
      }
    })

    const topUsers = Array.from(userActivity.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([handle, count]) => {
        const user = filteredNotifications.find((n: any) => n.author.handle === handle)?.author
        return { handle, count, user }
      })

    // Calculate engagement rate
    const totalEngagement = filteredNotifications.length
    const uniqueUsers = filteredNotifications.length > 0 
      ? new Set(filteredNotifications.map((n: any) => n.author.did)).size
      : 0
    const hourSpan = Math.max(1, (newestDate.getTime() - oldestDate.getTime()) / (1000 * 60 * 60))
    const daySpan = Math.max(1, hourSpan / 24)

    return {
      buckets,
      topUsers,
      totalEngagement,
      uniqueUsers,
      averagePerDay: totalEngagement / daySpan,
      averagePerHour: totalEngagement / hourSpan,
      daySpan,
      oldestDate,
      newestDate,
      timeRange
    }
  }, [notifications, timeRange])

  // Calculate current stats - use analytics data if we have extended data
  const stats = React.useMemo(() => {
    // If we have extended data, calculate stats from the analytics data
    if (hasExtendedData && notifications?.notifications) {
      // Get notifications from the last 24 hours for "recent" stats
      const oneDayAgo = subDays(new Date(), 1)
      const recentNotifications = notifications.notifications.filter(
        (n: any) => new Date(n.indexedAt) >= oneDayAgo
      )
      
      
      const counts = {
        total: recentNotifications.length,
        unread: 0, // Extended data doesn't include read status
        likes: recentNotifications.filter((n: any) => n.reason === 'like').length,
        reposts: recentNotifications.filter((n: any) => n.reason === 'repost').length,
        follows: recentNotifications.filter((n: any) => n.reason === 'follow').length,
        mentions: recentNotifications.filter((n: any) => n.reason === 'mention').length,
        replies: recentNotifications.filter((n: any) => n.reason === 'reply').length,
      }
      
      return counts
    }
    
    // Otherwise use the current stats query
    if (!currentStats) return null

    const counts = {
      total: currentStats.notifications.length,
      unread: currentStats.notifications.filter((n: any) => !n.isRead).length,
      likes: currentStats.notifications.filter((n: any) => n.reason === 'like').length,
      reposts: currentStats.notifications.filter((n: any) => n.reason === 'repost').length,
      follows: currentStats.notifications.filter((n: any) => n.reason === 'follow').length,
      mentions: currentStats.notifications.filter((n: any) => n.reason === 'mention').length,
      replies: currentStats.notifications.filter((n: any) => n.reason === 'reply').length,
    }

    return counts
  }, [currentStats, hasExtendedData, notifications])

  if (!analytics || isLoadingStats) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 rounded w-1/4" style={{ backgroundColor: 'var(--bsky-bg-tertiary)' }}></div>
          <div className="h-64 rounded" style={{ backgroundColor: 'var(--bsky-bg-tertiary)' }}></div>
        </div>
      </div>
    )
  }

  const maxValue = Math.max(1, ...analytics.buckets.map(b => b.total))

  return (
    <div className="p-6 space-y-6">
      {/* Background loader - no UI */}
      <BackgroundNotificationLoader />
      
      {/* Page Header with inline stats */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--bsky-text-primary)' }}>Analytics</h1>
          <div className="flex items-center gap-4 text-sm" style={{ color: 'var(--bsky-text-secondary)' }}>
            <span className="flex items-center gap-1">
              <Bell size={16} />
              {stats?.total || 0} in last 24h
            </span>
            <span className="flex items-center gap-1">
              <TrendingUp size={16} />
              {Math.round(analytics?.averagePerDay || 0)}/day avg
            </span>
            <span className="flex items-center gap-1">
              <Users size={16} />
              {analytics?.uniqueUsers || 0} unique users
            </span>
          </div>
        </div>
        
        {/* Data source indicator */}
        {hasExtendedData && (
          <div className="flex items-center gap-2 text-sm px-3 py-1 rounded-lg" style={{
            backgroundColor: 'var(--bsky-bg-tertiary)',
            color: 'var(--bsky-text-secondary)'
          }}>
            <Activity size={14} />
            <span>Using extended history</span>
          </div>
        )}
      </div>

      {/* Activity Chart */}
      <div className="bsky-card p-6" style={{
        background: 'var(--bsky-bg-secondary)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div className="absolute top-0 right-0 w-64 h-64 opacity-5" style={{
          background: 'radial-gradient(circle, var(--bsky-primary) 0%, transparent 70%)',
          transform: 'translate(30%, -30%)'
        }} />
        <div className="flex items-center justify-between mb-4" style={{ position: 'relative', zIndex: 10 }}>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Activity className="text-green-500" size={20} />
            Activity Timeline
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                handleTimeRangeChange('1d')
              }}
              className="px-3 py-1 text-sm rounded-lg transition-all cursor-pointer hover:opacity-80"
              style={{
                backgroundColor: timeRange === '1d' ? 'var(--bsky-primary)' : 'var(--bsky-bg-tertiary)',
                color: timeRange === '1d' ? 'white' : 'var(--bsky-text-secondary)',
                border: 'none'
              }}
              type="button"
            >
              24h
            </button>
            <button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                handleTimeRangeChange('3d')
              }}
              className="px-3 py-1 text-sm rounded-lg transition-all cursor-pointer hover:opacity-80"
              style={{
                backgroundColor: timeRange === '3d' ? 'var(--bsky-primary)' : 'var(--bsky-bg-tertiary)',
                color: timeRange === '3d' ? 'white' : 'var(--bsky-text-secondary)',
                border: 'none'
              }}
              type="button"
            >
              3d
            </button>
            <button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                handleTimeRangeChange('7d')
              }}
              className="px-3 py-1 text-sm rounded-lg transition-all cursor-pointer hover:opacity-80"
              style={{
                backgroundColor: timeRange === '7d' ? 'var(--bsky-primary)' : 'var(--bsky-bg-tertiary)',
                color: timeRange === '7d' ? 'white' : 'var(--bsky-text-secondary)',
                border: 'none'
              }}
              type="button"
            >
              7d
            </button>
            <button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                handleTimeRangeChange('4w')
              }}
              className="px-3 py-1 text-sm rounded-lg transition-all cursor-pointer hover:opacity-80"
              style={{
                backgroundColor: timeRange === '4w' ? 'var(--bsky-primary)' : 'var(--bsky-bg-tertiary)',
                color: timeRange === '4w' ? 'white' : 'var(--bsky-text-secondary)',
                border: 'none'
              }}
              type="button"
            >
              4w
            </button>
          </div>
        </div>
        <div className="relative" style={{ height: '300px', marginTop: '20px' }}>
          {/* Y-axis labels */}
          <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-xs" style={{ width: '40px', color: 'var(--bsky-text-secondary)' }}>
            <span>{maxValue}</span>
            <span>{Math.round(maxValue * 0.75)}</span>
            <span>{Math.round(maxValue * 0.5)}</span>
            <span>{Math.round(maxValue * 0.25)}</span>
            <span>0</span>
          </div>
          
          {/* Chart area */}
          <div className="ml-12 h-full relative">
            {/* Grid lines */}
            <div className="absolute inset-0">
              {[0, 0.25, 0.5, 0.75, 1].map((fraction) => (
                <div
                  key={fraction}
                  className="absolute w-full"
                  style={{
                    bottom: `${fraction * 100}%`,
                    borderBottom: '1px solid',
                    borderColor: 'var(--bsky-border-secondary)',
                    opacity: fraction === 0 ? 1 : 0.2
                  }}
                />
              ))}
            </div>
            
            {/* Bars */}
            <div className="relative h-full flex items-end justify-between" style={{ gap: timeRange === '4w' ? '2px' : '4px', paddingBottom: '30px' }}>
              {analytics.buckets.map((bucket, index) => {
                const barWidth = timeRange === '4w' 
                  ? `${100 / analytics.buckets.length}%` 
                  : `${100 / analytics.buckets.length - 1}%`
                return (
                  <div
                    key={`${bucket.label}-${index}`}
                    className="relative group"
                    style={{ 
                      width: barWidth, 
                      minWidth: timeRange === '4w' ? '8px' : '20px', 
                      maxWidth: timeRange === '4w' ? '30px' : '60px' 
                    }}
                  >
                    {/* Stacked bar */}
                    <div className="absolute bottom-0 left-0 right-0 flex flex-col-reverse rounded-t-lg overflow-hidden transition-all duration-300 hover:opacity-90">
                      {/* Likes - bottom of stack */}
                      {bucket.likes > 0 && (
                        <div
                          className="w-full transition-all duration-500"
                          style={{
                            height: `${(bucket.likes / maxValue) * 270}px`,
                            background: 'linear-gradient(180deg, #f87171 0%, #ef4444 100%)'
                          }}
                          title={`${bucket.likes} likes`}
                        />
                      )}
                      {/* Reposts */}
                      {bucket.reposts > 0 && (
                        <div
                          className="w-full transition-all duration-500"
                          style={{
                            height: `${(bucket.reposts / maxValue) * 270}px`,
                            background: 'linear-gradient(180deg, #93c5fd 0%, #60a5fa 100%)'
                          }}
                          title={`${bucket.reposts} reposts`}
                        />
                      )}
                      {/* Follows */}
                      {bucket.follows > 0 && (
                        <div
                          className="w-full transition-all duration-500"
                          style={{
                            height: `${(bucket.follows / maxValue) * 270}px`,
                            background: 'linear-gradient(180deg, #c4b5fd 0%, #a78bfa 100%)'
                          }}
                          title={`${bucket.follows} follows`}
                        />
                      )}
                      {/* Replies */}
                      {bucket.replies > 0 && (
                        <div
                          className="w-full transition-all duration-500"
                          style={{
                            height: `${(bucket.replies / maxValue) * 270}px`,
                            background: 'linear-gradient(180deg, #86efac 0%, #4ade80 100%)'
                          }}
                          title={`${bucket.replies} replies`}
                        />
                      )}
                      {/* Mentions - top of stack */}
                      {bucket.mentions > 0 && (
                        <div
                          className="w-full transition-all duration-500"
                          style={{
                            height: `${(bucket.mentions / maxValue) * 270}px`,
                            background: 'linear-gradient(180deg, #fda4af 0%, #fb7185 100%)'
                          }}
                          title={`${bucket.mentions} mentions`}
                        />
                      )}
                    </div>
                    
                    {/* Hover tooltip */}
                    <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                      <div className="px-3 py-2 rounded-lg text-xs whitespace-nowrap" style={{
                        backgroundColor: 'var(--bsky-bg-primary)',
                        color: 'var(--bsky-text-primary)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                        border: '1px solid var(--bsky-border-primary)'
                      }}>
                        <div className="font-bold mb-1">{bucket.total} total</div>
                        {bucket.likes > 0 && <div style={{ color: '#ef4444' }}>{bucket.likes} likes</div>}
                        {bucket.reposts > 0 && <div style={{ color: '#60a5fa' }}>{bucket.reposts} reposts</div>}
                        {bucket.follows > 0 && <div style={{ color: '#a78bfa' }}>{bucket.follows} follows</div>}
                        {bucket.replies > 0 && <div style={{ color: '#4ade80' }}>{bucket.replies} replies</div>}
                        {bucket.mentions > 0 && <div style={{ color: '#fb7185' }}>{bucket.mentions} mentions</div>}
                      </div>
                    </div>
                    
                    {/* X-axis label */}
                    {(timeRange !== '4w' || index % 4 === 0 || index === analytics.buckets.length - 1) && (
                      <div className="absolute top-full mt-1 left-0 right-0 text-center">
                        <span className="text-xs" style={{ 
                          color: 'var(--bsky-text-secondary)', 
                          fontSize: timeRange === '4w' ? '9px' : '10px' 
                        }}>
                          {bucket.label}
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-3 mt-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: '#ef4444' }}></div>
            <span style={{ color: 'var(--bsky-text-secondary)' }}>Likes</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: '#60a5fa' }}></div>
            <span style={{ color: 'var(--bsky-text-secondary)' }}>Reposts</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: '#a78bfa' }}></div>
            <span style={{ color: 'var(--bsky-text-secondary)' }}>Follows</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: '#4ade80' }}></div>
            <span style={{ color: 'var(--bsky-text-secondary)' }}>Replies</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: '#fb7185' }}></div>
            <span style={{ color: 'var(--bsky-text-secondary)' }}>Mentions</span>
          </div>
        </div>
      </div>

      {/* Top Users */}
      <div className="bsky-card p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Heart style={{ color: 'var(--bsky-like)' }} size={20} />
          Top Users Engaging With Your Content
        </h2>
        <div className="space-y-3">
          {analytics.topUsers.map(({ handle, count, user }) => (
            <div key={handle} className="flex items-center gap-3">
              {user?.avatar ? (
                <img 
                  src={proxifyBskyImage(user.avatar)} 
                  alt={handle}
                  className="w-10 h-10 rounded-full border-2"
                  style={{ borderColor: 'var(--bsky-border-primary)' }}
                />
              ) : (
                <div 
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ 
                    backgroundColor: 'var(--bsky-bg-tertiary)',
                    color: 'var(--bsky-text-secondary)'
                  }}
                >
                  {handle.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1">
                <p className="text-sm font-medium" style={{ color: 'var(--bsky-text-primary)' }}>{user?.displayName || handle}</p>
                <p className="text-xs" style={{ color: 'var(--bsky-text-secondary)' }}>@{handle}</p>
              </div>
              <span className="text-sm" style={{ color: 'var(--bsky-text-primary)' }}>{count} interactions</span>
            </div>
          ))}
        </div>
      </div>

      {/* Engagement Summary */}
      <div className="bsky-card p-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <Calendar size={20} className="text-blue-500" />
            <span className="text-sm font-medium" style={{ color: 'var(--bsky-text-primary)' }}>
              {timeRange === '1d' ? 'Last 24 hours' : timeRange === '3d' ? 'Last 3 days' : timeRange === '7d' ? 'Last 7 days' : 'Last 4 weeks'}
            </span>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <div>
              <span className="font-semibold" style={{ color: 'var(--bsky-text-primary)' }}>{analytics.totalEngagement}</span>
              <span style={{ color: 'var(--bsky-text-secondary)' }}> total interactions</span>
            </div>
            <div>
              <span className="font-semibold" style={{ color: 'var(--bsky-text-primary)' }}>
                {timeRange === '1d' ? analytics.averagePerHour.toFixed(1) : Math.round(analytics.averagePerDay)}
              </span>
              <span style={{ color: 'var(--bsky-text-secondary)' }}> {timeRange === '1d' ? 'per hour' : 'per day'}</span>
            </div>
          </div>
        </div>
        <div className="mt-2 text-xs" style={{ color: 'var(--bsky-text-secondary)' }}>
          {(() => {
            const now = new Date()
            const startDate = timeRange === '1d' ? subHours(now, 24) :
                             timeRange === '3d' ? subDays(now, 3) :
                             timeRange === '7d' ? subDays(now, 7) :
                             subDays(now, 28)
            return `${format(startDate, 'MMM d, h:mm a')} - ${format(now, 'MMM d, h:mm a')} (${Intl.DateTimeFormat().resolvedOptions().timeZone})`
          })()}
        </div>
      </div>

    </div>
  )
}



function getNotificationAction(reason: string): string {
  switch (reason) {
    case 'like': return 'liked your post'
    case 'repost': return 'reposted your post'
    case 'follow': return 'followed you'
    case 'mention': return 'mentioned you'
    case 'reply': return 'replied to your post'
    case 'quote': return 'quoted your post'
    default: return 'interacted with your post'
  }
}