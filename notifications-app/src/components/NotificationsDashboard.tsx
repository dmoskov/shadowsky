import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Bell, Heart, Repeat2, UserPlus, MessageCircle, TrendingUp, Clock } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { formatDistanceToNow } from 'date-fns'

export const NotificationsDashboard: React.FC = () => {
  const { agent } = useAuth()

  const { data: notifications, isLoading } = useQuery({
    queryKey: ['notifications-summary'],
    queryFn: async () => {
      if (!agent) throw new Error('Not authenticated')
      const response = await agent.app.bsky.notification.listNotifications({ limit: 50 })
      return response.data
    },
    refetchInterval: 30000 // Refresh every 30 seconds
  })

  const stats = React.useMemo(() => {
    if (!notifications) return null

    const counts = {
      total: notifications.notifications.length,
      unread: notifications.notifications.filter(n => !n.isRead).length,
      likes: notifications.notifications.filter(n => n.reason === 'like').length,
      reposts: notifications.notifications.filter(n => n.reason === 'repost').length,
      follows: notifications.notifications.filter(n => n.reason === 'follow').length,
      mentions: notifications.notifications.filter(n => n.reason === 'mention').length,
      replies: notifications.notifications.filter(n => n.reason === 'reply').length,
    }

    return counts
  }, [notifications])

  const recentNotifications = notifications?.notifications.slice(0, 5) || []

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 rounded w-1/4" style={{ backgroundColor: 'var(--bsky-bg-tertiary)' }}></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 rounded-lg" style={{ backgroundColor: 'var(--bsky-bg-tertiary)' }}></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">Notifications Dashboard</h1>
        <p style={{ color: 'var(--bsky-text-secondary)' }}>Monitor your Bluesky activity at a glance</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Bell}
          label="Total Notifications"
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
      </div>

      {/* Notification Types */}
      <div className="bsky-card p-6">
        <h2 className="text-lg font-semibold mb-4">Notification Breakdown</h2>
        <div className="space-y-3">
          <NotificationTypeBar label="Likes" count={stats?.likes || 0} total={stats?.total || 1} color="pink" />
          <NotificationTypeBar label="Reposts" count={stats?.reposts || 0} total={stats?.total || 1} color="green" />
          <NotificationTypeBar label="Replies" count={stats?.replies || 0} total={stats?.total || 1} color="blue" />
          <NotificationTypeBar label="Mentions" count={stats?.mentions || 0} total={stats?.total || 1} color="purple" />
          <NotificationTypeBar label="Follows" count={stats?.follows || 0} total={stats?.total || 1} color="indigo" />
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bsky-card p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <TrendingUp size={20} />
          Recent Activity
        </h2>
        <div className="space-y-3">
          {recentNotifications.map((notification) => (
            <div key={notification.uri} className="flex items-start gap-3 p-3 rounded-lg" style={{ backgroundColor: 'var(--bsky-bg-tertiary)' }}>
              <div className="flex-shrink-0">
                {notification.author.avatar ? (
                  <img 
                    src={notification.author.avatar} 
                    alt={notification.author.handle}
                    className="w-10 h-10 rounded-full"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--bsky-bg-hover)' }}>
                    {notification.author.handle.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm">
                  <span className="font-medium">{notification.author.displayName || notification.author.handle}</span>
                  {' '}
                  {getNotificationAction(notification.reason)}
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--bsky-text-secondary)' }}>
                  {formatDistanceToNow(new Date(notification.indexedAt), { addSuffix: true })}
                </p>
              </div>
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
    blue: { backgroundColor: 'rgba(0, 133, 255, 0.1)', color: 'var(--bsky-primary)', borderColor: 'rgba(0, 133, 255, 0.3)' },
    yellow: { backgroundColor: 'rgba(250, 204, 21, 0.1)', color: '#facc15', borderColor: 'rgba(250, 204, 21, 0.3)' },
    pink: { backgroundColor: 'rgba(236, 72, 153, 0.1)', color: '#ec4899', borderColor: 'rgba(236, 72, 153, 0.3)' },
    green: { backgroundColor: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', borderColor: 'rgba(34, 197, 94, 0.3)' },
  }

  const style = colorStyles[color as keyof typeof colorStyles]

  return (
    <div className="bsky-card p-4" style={{ borderColor: style.borderColor }}>
      <div className="flex items-center justify-between mb-2">
        <Icon size={24} style={{ color: style.color }} />
        <span className="text-2xl font-bold">{value}</span>
      </div>
      <p className="text-sm" style={{ color: 'var(--bsky-text-secondary)' }}>{label}</p>
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