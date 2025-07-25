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
          <div className="h-8 bg-gray-800 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-800 rounded-lg"></div>
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
        <p className="text-gray-400">Monitor your Bluesky activity at a glance</p>
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
      <div className="bg-gray-800 rounded-lg p-6">
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
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <TrendingUp size={20} />
          Recent Activity
        </h2>
        <div className="space-y-3">
          {recentNotifications.map((notification) => (
            <div key={notification.uri} className="flex items-start gap-3 p-3 bg-gray-700/50 rounded-lg">
              <div className="flex-shrink-0">
                {notification.author.avatar ? (
                  <img 
                    src={notification.author.avatar} 
                    alt={notification.author.handle}
                    className="w-10 h-10 rounded-full"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center">
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
                <p className="text-xs text-gray-400 mt-1">
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
  const colorClasses = {
    blue: 'bg-blue-900/20 text-blue-400 border-blue-500/20',
    yellow: 'bg-yellow-900/20 text-yellow-400 border-yellow-500/20',
    pink: 'bg-pink-900/20 text-pink-400 border-pink-500/20',
    green: 'bg-green-900/20 text-green-400 border-green-500/20',
  }

  return (
    <div className={`p-4 rounded-lg border ${colorClasses[color as keyof typeof colorClasses]}`}>
      <div className="flex items-center justify-between mb-2">
        <Icon size={24} />
        <span className="text-2xl font-bold">{value}</span>
      </div>
      <p className="text-sm opacity-80">{label}</p>
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
  
  const colorClasses = {
    pink: 'bg-pink-500',
    green: 'bg-green-500',
    blue: 'bg-blue-500',
    purple: 'bg-purple-500',
    indigo: 'bg-indigo-500',
  }

  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span>{label}</span>
        <span className="text-gray-400">{count}</span>
      </div>
      <div className="w-full bg-gray-700 rounded-full h-2">
        <div 
          className={`h-2 rounded-full transition-all duration-500 ${colorClasses[color as keyof typeof colorClasses]}`}
          style={{ width: `${percentage}%` }}
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