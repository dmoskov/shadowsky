import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { TrendingUp, Users, Heart, MessageCircle, BarChart3 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { format, subDays, startOfDay } from 'date-fns'

export const NotificationsAnalytics: React.FC = () => {
  const { agent } = useAuth()

  const { data: notifications } = useQuery({
    queryKey: ['notifications-analytics'],
    queryFn: async () => {
      if (!agent) throw new Error('Not authenticated')
      
      // Fetch notifications until we have 7 days worth of data
      const allNotifications: typeof agent.app.bsky.notification.listNotifications._output.notifications = []
      let cursor: string | undefined
      const sevenDaysAgo = subDays(new Date(), 7)
      let hasMoreToFetch = true
      
      while (hasMoreToFetch) {
        const response = await agent.app.bsky.notification.listNotifications({ 
          limit: 100,
          cursor 
        })
        
        allNotifications.push(...response.data.notifications)
        cursor = response.data.cursor
        
        // Check if we've fetched notifications older than 7 days or no more cursor
        const oldestNotification = response.data.notifications[response.data.notifications.length - 1]
        if (!cursor || (oldestNotification && new Date(oldestNotification.indexedAt) < sevenDaysAgo)) {
          hasMoreToFetch = false
        }
        
        // Safety limit to prevent infinite loops
        if (allNotifications.length > 1000) {
          hasMoreToFetch = false
        }
      }
      
      // Filter to only include notifications from the last 7 days
      const filteredNotifications = allNotifications.filter(
        notif => new Date(notif.indexedAt) >= sevenDaysAgo
      )
      
      return { notifications: filteredNotifications }
    }
  })

  const analytics = React.useMemo(() => {
    if (!notifications?.notifications) return null

    const now = new Date()
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = startOfDay(subDays(now, 6 - i))
      return {
        date,
        label: format(date, 'EEE'),
        likes: 0,
        reposts: 0,
        follows: 0,
        replies: 0,
        total: 0
      }
    })

    // Count notifications by day and type
    notifications.notifications.forEach(notification => {
      const notifDate = startOfDay(new Date(notification.indexedAt))
      const dayData = last7Days.find(day => 
        day.date.getTime() === notifDate.getTime()
      )
      
      if (dayData) {
        dayData.total++
        switch (notification.reason) {
          case 'like': dayData.likes++; break
          case 'repost': dayData.reposts++; break
          case 'follow': dayData.follows++; break
          case 'reply': dayData.replies++; break
        }
      }
    })

    // Find most active users
    const userActivity = new Map<string, number>()
    notifications.notifications.forEach(notification => {
      const key = notification.author.handle
      userActivity.set(key, (userActivity.get(key) || 0) + 1)
    })

    const topUsers = Array.from(userActivity.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([handle, count]) => {
        const user = notifications.notifications.find(n => n.author.handle === handle)?.author
        return { handle, count, user }
      })

    // Calculate engagement rate
    const totalEngagement = notifications.notifications.length
    const uniqueUsers = new Set(notifications.notifications.map(n => n.author.did)).size

    return {
      last7Days,
      topUsers,
      totalEngagement,
      uniqueUsers,
      averagePerDay: totalEngagement / 7
    }
  }, [notifications])

  if (!analytics) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 rounded w-1/4" style={{ backgroundColor: 'var(--bsky-bg-tertiary)' }}></div>
          <div className="h-64 rounded" style={{ backgroundColor: 'var(--bsky-bg-tertiary)' }}></div>
        </div>
      </div>
    )
  }

  const maxValue = Math.max(...analytics.last7Days.map(d => d.total))

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2 flex items-center gap-2">
          <BarChart3 className="text-blue-500" />
          Notifications Analytics
        </h1>
        <p style={{ color: 'var(--bsky-text-secondary)' }}>Track how others are interacting with your posts and profile</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bsky-card p-4">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="text-green-500" size={24} />
            <span className="text-2xl font-bold">{analytics.totalEngagement}</span>
          </div>
          <p className="text-sm" style={{ color: 'var(--bsky-text-secondary)' }}>Notifications Received (7 days)</p>
        </div>
        
        <div className="bsky-card p-4">
          <div className="flex items-center justify-between mb-2">
            <Users className="text-blue-500" size={24} />
            <span className="text-2xl font-bold">{analytics.uniqueUsers}</span>
          </div>
          <p className="text-sm" style={{ color: 'var(--bsky-text-secondary)' }}>Users Who Interacted</p>
        </div>
        
        <div className="bsky-card p-4">
          <div className="flex items-center justify-between mb-2">
            <MessageCircle className="text-purple-500" size={24} />
            <span className="text-2xl font-bold">{analytics.averagePerDay.toFixed(1)}</span>
          </div>
          <p className="text-sm" style={{ color: 'var(--bsky-text-secondary)' }}>Avg Notifications per Day</p>
        </div>
      </div>

      {/* Activity Chart */}
      <div className="bsky-card p-6">
        <h2 className="text-lg font-semibold mb-4">Notifications Received by Type (7 Days)</h2>
        <div className="space-y-4">
          {analytics.last7Days.map((day) => (
            <div key={day.label} className="flex items-center gap-4">
              <span className="text-sm w-12" style={{ color: 'var(--bsky-text-secondary)' }}>{day.label}</span>
              <div className="flex-1 flex gap-1">
                <div 
                  className="h-6 rounded transition-all duration-500"
                  style={{ 
                    width: `${(day.likes / maxValue) * 100}%`,
                    backgroundColor: 'var(--bsky-like)'
                  }}
                  title={`${day.likes} likes received`}
                />
                <div 
                  className="h-6 rounded transition-all duration-500"
                  style={{ 
                    width: `${(day.reposts / maxValue) * 100}%`,
                    backgroundColor: 'var(--bsky-repost)'
                  }}
                  title={`${day.reposts} reposts received`}
                />
                <div 
                  className="h-6 rounded transition-all duration-500"
                  style={{ 
                    width: `${(day.follows / maxValue) * 100}%`,
                    backgroundColor: 'var(--bsky-follow)'
                  }}
                  title={`${day.follows} new followers`}
                />
                <div 
                  className="h-6 rounded transition-all duration-500"
                  style={{ 
                    width: `${(day.replies / maxValue) * 100}%`,
                    backgroundColor: 'var(--bsky-reply)'
                  }}
                  title={`${day.replies} replies received`}
                />
              </div>
              <span className="text-sm w-12 text-right" style={{ color: 'var(--bsky-text-primary)' }}>{day.total}</span>
            </div>
          ))}
        </div>
        
        <div className="flex gap-4 mt-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: 'var(--bsky-like)' }}></div>
            <span style={{ color: 'var(--bsky-text-secondary)' }}>Likes</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: 'var(--bsky-repost)' }}></div>
            <span style={{ color: 'var(--bsky-text-secondary)' }}>Reposts</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: 'var(--bsky-follow)' }}></div>
            <span style={{ color: 'var(--bsky-text-secondary)' }}>Follows</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: 'var(--bsky-reply)' }}></div>
            <span style={{ color: 'var(--bsky-text-secondary)' }}>Replies</span>
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
                  src={user.avatar} 
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
              <span className="text-sm" style={{ color: 'var(--bsky-text-primary)' }}>{count} notifications from them</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}