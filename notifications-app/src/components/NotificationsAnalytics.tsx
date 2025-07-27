import React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { TrendingUp, Users, Heart, MessageCircle, BarChart3, Bell, Clock, Repeat2, UserPlus } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { format, subDays, startOfDay } from 'date-fns'
import { ExtendedNotificationsFetcher } from './ExtendedNotificationsFetcher'

export const NotificationsAnalytics: React.FC = () => {
  const { agent } = useAuth()
  const queryClient = useQueryClient()

  // Check if we have extended data available
  const extendedData = queryClient.getQueryData(['notifications-extended']) as any
  const hasExtendedData = extendedData?.pages?.length > 0

  // Query for current stats - only fetch if we don't have extended data
  const { data: currentStats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['notifications-summary'],
    queryFn: async () => {
      if (!agent) throw new Error('Not authenticated')
      const response = await agent.app.bsky.notification.listNotifications({ limit: 50 })
      return response.data
    },
    refetchInterval: 30000, // Refresh every 30 seconds
    enabled: !hasExtendedData // Don't fetch if we have extended data
  })

  // Query for analytics data - use extended data if available
  const { data: notifications } = useQuery({
    queryKey: ['notifications-analytics', hasExtendedData],
    queryFn: async () => {
      if (!agent) throw new Error('Not authenticated')
      
      // If we have extended data from the 4-week fetch, use that
      if (hasExtendedData) {
        const allNotifications = extendedData.pages.flatMap((page: any) => page.notifications)
        return { notifications: allNotifications }
      }
      
      // Otherwise, fetch notifications until we have 7 days worth of data
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
    },
    // Re-run when extended data changes
    enabled: !!agent,
  })

  const analytics = React.useMemo(() => {
    if (!notifications?.notifications || notifications.notifications.length === 0) return null

    const now = new Date()
    
    // Calculate the actual date range of the data
    const sortedNotifications = [...notifications.notifications].sort(
      (a, b) => new Date(a.indexedAt).getTime() - new Date(b.indexedAt).getTime()
    )
    const oldestDate = new Date(sortedNotifications[0].indexedAt)
    const newestDate = new Date(sortedNotifications[sortedNotifications.length - 1].indexedAt)
    const daySpan = Math.max(1, Math.ceil((newestDate.getTime() - oldestDate.getTime()) / (1000 * 60 * 60 * 24)) + 1)
    
    // Create array for the actual date range (up to 28 days for 4 weeks)
    const displayDays = Math.min(daySpan, 28)
    const daysArray = Array.from({ length: displayDays }, (_, i) => {
      const date = startOfDay(subDays(now, displayDays - 1 - i))
      return {
        date,
        label: displayDays <= 7 ? format(date, 'EEE') : format(date, 'M/d'),
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
      const dayData = daysArray.find(day => 
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
      daysArray,
      topUsers,
      totalEngagement,
      uniqueUsers,
      averagePerDay: totalEngagement / Math.max(1, daySpan),
      daySpan,
      oldestDate,
      newestDate
    }
  }, [notifications])

  // Calculate current stats - use analytics data if we have extended data
  const stats = React.useMemo(() => {
    // If we have extended data, calculate stats from the analytics data
    if (hasExtendedData && notifications?.notifications) {
      // Get notifications from the last 24 hours for "recent" stats
      const oneDayAgo = subDays(new Date(), 1)
      const recentNotifications = notifications.notifications.filter(
        n => new Date(n.indexedAt) >= oneDayAgo
      )
      
      const counts = {
        total: recentNotifications.length,
        unread: 0, // Extended data doesn't include read status
        likes: recentNotifications.filter(n => n.reason === 'like').length,
        reposts: recentNotifications.filter(n => n.reason === 'repost').length,
        follows: recentNotifications.filter(n => n.reason === 'follow').length,
        mentions: recentNotifications.filter(n => n.reason === 'mention').length,
        replies: recentNotifications.filter(n => n.reason === 'reply').length,
      }
      
      return counts
    }
    
    // Otherwise use the current stats query
    if (!currentStats) return null

    const counts = {
      total: currentStats.notifications.length,
      unread: currentStats.notifications.filter(n => !n.isRead).length,
      likes: currentStats.notifications.filter(n => n.reason === 'like').length,
      reposts: currentStats.notifications.filter(n => n.reason === 'repost').length,
      follows: currentStats.notifications.filter(n => n.reason === 'follow').length,
      mentions: currentStats.notifications.filter(n => n.reason === 'mention').length,
      replies: currentStats.notifications.filter(n => n.reason === 'reply').length,
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

  const maxValue = Math.max(...analytics.daysArray.map(d => d.total))

  return (
    <div className="p-6 space-y-6">
      <div className="relative overflow-hidden rounded-2xl p-6 mb-6" style={{
        background: 'linear-gradient(135deg, var(--bsky-primary) 0%, var(--bsky-accent) 100%)',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)'
      }}>
        <div className="absolute inset-0 opacity-10">
          <div style={{
            position: 'absolute',
            top: '-50%',
            right: '-10%',
            width: '300px',
            height: '300px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%)'
          }} />
        </div>
        <div className="relative">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3 text-white">
            <div className="p-3 rounded-xl" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
              <BarChart3 size={28} />
            </div>
            Analytics Dashboard
            {hasExtendedData && (
              <span className="text-sm font-normal px-3 py-1.5 rounded-full" style={{ 
                backgroundColor: 'rgba(255,255,255,0.2)', 
                backdropFilter: 'blur(10px)'
              }}>
                🔎 Extended View
              </span>
            )}
          </h1>
          <p className="text-white/80 text-lg">
            {hasExtendedData 
              ? `📅 Analyzing ${analytics?.daySpan || 0} days of notification history`
              : '📊 Monitor your Bluesky activity and engagement metrics in real-time'
            }
          </p>
        </div>
      </div>

      {/* Extended Notifications Fetcher */}
      <ExtendedNotificationsFetcher />

      {/* Current Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" style={{
        marginTop: '-3rem',
        position: 'relative',
        zIndex: 10
      }}>
        {hasExtendedData ? (
          <>
            <StatCard
              icon={Clock}
              label="Last 24 Hours"
              value={stats?.total || 0}
              color="blue"
            />
            <StatCard
              icon={TrendingUp}
              label="Daily Average"
              value={Math.round(analytics?.averagePerDay || 0)}
              color="green"
            />
            <StatCard
              icon={Heart}
              label="Today's Likes"
              value={stats?.likes || 0}
              color="pink"
            />
            <StatCard
              icon={UserPlus}
              label="Today's Followers"
              value={stats?.follows || 0}
              color="purple"
            />
          </>
        ) : (
          <>
            <StatCard
              icon={Bell}
              label="Recent Activity"
              value={stats?.total || 0}
              color="blue"
            />
            <StatCard
              icon={Clock}
              label="Unread"
              value={stats?.unread || 0}
              color="yellow"
            />
            <StatCard
              icon={Heart}
              label="Likes"
              value={stats?.likes || 0}
              color="pink"
            />
            <StatCard
              icon={UserPlus}
              label="New Followers"
              value={stats?.follows || 0}
              color="green"
            />
          </>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bsky-card p-4">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="text-green-500" size={24} />
            <span className="text-2xl font-bold">{analytics.totalEngagement}</span>
          </div>
          <p className="text-sm" style={{ color: 'var(--bsky-text-secondary)' }}>
            Total in {analytics.daySpan} day{analytics.daySpan !== 1 ? 's' : ''}
            {analytics.oldestDate && analytics.newestDate && (
              <span className="block text-xs mt-1">
                {format(analytics.oldestDate, 'MMM d')} - {format(analytics.newestDate, 'MMM d')}
              </span>
            )}
          </p>
        </div>
        
        <div className="bsky-card p-4">
          <div className="flex items-center justify-between mb-2">
            <Users className="text-blue-500" size={24} />
            <span className="text-2xl font-bold">{analytics.uniqueUsers}</span>
          </div>
          <p className="text-sm" style={{ color: 'var(--bsky-text-secondary)' }}>Unique Users</p>
        </div>
        
        <div className="bsky-card p-4">
          <div className="flex items-center justify-between mb-2">
            <BarChart3 className="text-purple-500" size={24} />
            <span className="text-2xl font-bold">{analytics.averagePerDay.toFixed(1)}</span>
          </div>
          <p className="text-sm" style={{ color: 'var(--bsky-text-secondary)' }}>Daily Average</p>
        </div>
      </div>

      {/* Notification Breakdown */}
      <div className="bsky-card p-6">
        <h2 className="text-lg font-semibold mb-4">
          {hasExtendedData ? `Notification Types (${analytics.daySpan} days)` : 'Recent Notification Types'}
        </h2>
        <div className="space-y-3">
          {hasExtendedData && notifications?.notifications ? (
            // Use full dataset for extended data
            (() => {
              const fullCounts = {
                likes: notifications.notifications.filter(n => n.reason === 'like').length,
                reposts: notifications.notifications.filter(n => n.reason === 'repost').length,
                replies: notifications.notifications.filter(n => n.reason === 'reply').length,
                mentions: notifications.notifications.filter(n => n.reason === 'mention').length,
                follows: notifications.notifications.filter(n => n.reason === 'follow').length,
              }
              const total = analytics.totalEngagement
              
              return (
                <>
                  <NotificationTypeBar label="Likes" count={fullCounts.likes} total={total} color="pink" />
                  <NotificationTypeBar label="Reposts" count={fullCounts.reposts} total={total} color="green" />
                  <NotificationTypeBar label="Replies" count={fullCounts.replies} total={total} color="blue" />
                  <NotificationTypeBar label="Mentions" count={fullCounts.mentions} total={total} color="purple" />
                  <NotificationTypeBar label="Follows" count={fullCounts.follows} total={total} color="indigo" />
                </>
              )
            })()
          ) : (
            // Use stats for recent data
            <>
              <NotificationTypeBar label="Likes" count={stats?.likes || 0} total={stats?.total || 1} color="pink" />
              <NotificationTypeBar label="Reposts" count={stats?.reposts || 0} total={stats?.total || 1} color="green" />
              <NotificationTypeBar label="Replies" count={stats?.replies || 0} total={stats?.total || 1} color="blue" />
              <NotificationTypeBar label="Mentions" count={stats?.mentions || 0} total={stats?.total || 1} color="purple" />
              <NotificationTypeBar label="Follows" count={stats?.follows || 0} total={stats?.total || 1} color="indigo" />
            </>
          )}
        </div>
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
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="text-green-500" size={20} />
          Activity Trend
          <span className="text-sm font-normal px-2 py-1 rounded-full" style={{
            backgroundColor: 'var(--bsky-bg-tertiary)',
            color: 'var(--bsky-text-secondary)'
          }}>
            {analytics.daySpan} day{analytics.daySpan !== 1 ? 's' : ''}
          </span>
        </h2>
        <div className="space-y-3">
          {analytics.daysArray.map((day) => (
            <div key={day.label} className="group flex items-center gap-4 p-2 rounded-lg transition-all hover:bg-opacity-50" style={{
              backgroundColor: 'transparent'
            }}>
              <span className="text-sm w-14 font-medium" style={{ color: 'var(--bsky-text-secondary)' }}>{day.label}</span>
              <div className="flex-1 relative h-8 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bsky-bg-tertiary)' }}>
                <div className="absolute inset-0 flex">
                  <div 
                    className="h-full transition-all duration-500 relative overflow-hidden"
                    style={{ 
                      width: `${(day.likes / maxValue) * 100}%`,
                      background: 'linear-gradient(90deg, var(--bsky-like) 0%, #e11d48 100%)'
                    }}
                    title={`${day.likes} likes received`}
                  >
                    <div className="absolute inset-0 opacity-30" style={{
                      background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)',
                      animation: 'slide 2s infinite'
                    }} />
                  </div>
                  <div 
                    className="h-full transition-all duration-500 relative overflow-hidden"
                    style={{ 
                      width: `${(day.reposts / maxValue) * 100}%`,
                      background: 'linear-gradient(90deg, var(--bsky-repost) 0%, #059669 100%)'
                    }}
                    title={`${day.reposts} reposts received`}
                  >
                    <div className="absolute inset-0 opacity-30" style={{
                      background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)',
                      animation: 'slide 2s infinite',
                      animationDelay: '0.5s'
                    }} />
                  </div>
                  <div 
                    className="h-full transition-all duration-500 relative overflow-hidden"
                    style={{ 
                      width: `${(day.follows / maxValue) * 100}%`,
                      background: 'linear-gradient(90deg, var(--bsky-follow) 0%, #0066cc 100%)'
                    }}
                    title={`${day.follows} new followers`}
                  >
                    <div className="absolute inset-0 opacity-30" style={{
                      background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)',
                      animation: 'slide 2s infinite',
                      animationDelay: '1s'
                    }} />
                  </div>
                  <div 
                    className="h-full transition-all duration-500 relative overflow-hidden"
                    style={{ 
                      width: `${(day.replies / maxValue) * 100}%`,
                      background: 'linear-gradient(90deg, var(--bsky-reply) 0%, #0891b2 100%)'
                    }}
                    title={`${day.replies} replies received`}
                  >
                    <div className="absolute inset-0 opacity-30" style={{
                      background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)',
                      animation: 'slide 2s infinite',
                      animationDelay: '1.5s'
                    }} />
                  </div>
                </div>
              </div>
              <span className="text-sm w-14 text-right font-bold group-hover:scale-110 transition-transform" style={{ color: 'var(--bsky-text-primary)' }}>{day.total}</span>
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

interface StatCardProps {
  icon: React.ElementType
  label: string
  value: number
  color: string
}

const StatCard: React.FC<StatCardProps> = ({ icon: Icon, label, value, color }) => {
  const colorStyles = {
    blue: { backgroundColor: 'rgba(0, 133, 255, 0.1)', color: 'var(--bsky-primary)', borderColor: 'rgba(0, 133, 255, 0.3)', gradient: 'linear-gradient(135deg, #0085ff 0%, #0066cc 100%)' },
    yellow: { backgroundColor: 'rgba(250, 204, 21, 0.1)', color: '#facc15', borderColor: 'rgba(250, 204, 21, 0.3)', gradient: 'linear-gradient(135deg, #facc15 0%, #f59e0b 100%)' },
    pink: { backgroundColor: 'rgba(236, 72, 153, 0.1)', color: '#ec4899', borderColor: 'rgba(236, 72, 153, 0.3)', gradient: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)' },
    green: { backgroundColor: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', borderColor: 'rgba(34, 197, 94, 0.3)', gradient: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' },
    purple: { backgroundColor: 'rgba(147, 51, 234, 0.1)', color: '#9333ea', borderColor: 'rgba(147, 51, 234, 0.3)', gradient: 'linear-gradient(135deg, #9333ea 0%, #7c3aed 100%)' },
  }

  const style = colorStyles[color as keyof typeof colorStyles]

  return (
    <div className="bsky-card p-6 transition-all duration-300 hover:scale-105 hover:shadow-lg" style={{ 
      borderColor: style.borderColor,
      backgroundColor: 'var(--bsky-bg-secondary)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <div className="absolute top-0 right-0 w-32 h-32 opacity-10" style={{
        background: style.gradient,
        borderRadius: '50%',
        transform: 'translate(50%, -50%)'
      }} />
      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <div className="p-3 rounded-xl" style={{ background: style.gradient }}>
            <Icon size={24} className="text-white" />
          </div>
          <span className="text-3xl font-bold">{value}</span>
        </div>
        <p className="text-sm font-medium" style={{ color: 'var(--bsky-text-secondary)' }}>{label}</p>
      </div>
    </div>
  )
}

interface NotificationTypeBarProps {
  label: string
  count: number
  total: number
  color: string
}

const NotificationTypeBar: React.FC<NotificationTypeBarProps> = ({ label, count, total, color }) => {
  const percentage = total > 0 ? (count / total) * 100 : 0
  
  const colorStyles = {
    pink: 'var(--bsky-like)',
    green: 'var(--bsky-repost)',
    blue: 'var(--bsky-primary)',
    purple: 'var(--bsky-accent)',
    indigo: '#6366f1',
  }

  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span>{label}</span>
        <span style={{ color: 'var(--bsky-text-secondary)' }}>{count}</span>
      </div>
      <div className="w-full rounded-full h-2" style={{ backgroundColor: 'var(--bsky-bg-tertiary)' }}>
        <div 
          className="h-2 rounded-full transition-all duration-500"
          style={{ 
            width: `${percentage}%`,
            backgroundColor: colorStyles[color as keyof typeof colorStyles]
          }}
        />
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