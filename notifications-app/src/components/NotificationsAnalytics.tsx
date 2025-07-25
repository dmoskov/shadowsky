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
      const response = await agent.listNotifications({ limit: 100 })
      return response.data
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
          <div className="h-8 bg-gray-800 rounded w-1/4"></div>
          <div className="h-64 bg-gray-800 rounded"></div>
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
          Analytics
        </h1>
        <p className="text-gray-400">Understand your notification patterns</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="text-green-500" size={24} />
            <span className="text-2xl font-bold">{analytics.totalEngagement}</span>
          </div>
          <p className="text-sm text-gray-400">Total Engagements (7 days)</p>
        </div>
        
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <Users className="text-blue-500" size={24} />
            <span className="text-2xl font-bold">{analytics.uniqueUsers}</span>
          </div>
          <p className="text-sm text-gray-400">Unique Users</p>
        </div>
        
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <MessageCircle className="text-purple-500" size={24} />
            <span className="text-2xl font-bold">{analytics.averagePerDay.toFixed(1)}</span>
          </div>
          <p className="text-sm text-gray-400">Average per Day</p>
        </div>
      </div>

      {/* Activity Chart */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">7-Day Activity</h2>
        <div className="space-y-4">
          {analytics.last7Days.map((day) => (
            <div key={day.label} className="flex items-center gap-4">
              <span className="text-sm text-gray-400 w-12">{day.label}</span>
              <div className="flex-1 flex gap-1">
                <div 
                  className="bg-pink-500 h-6 rounded transition-all duration-500"
                  style={{ width: `${(day.likes / maxValue) * 100}%` }}
                  title={`${day.likes} likes`}
                />
                <div 
                  className="bg-green-500 h-6 rounded transition-all duration-500"
                  style={{ width: `${(day.reposts / maxValue) * 100}%` }}
                  title={`${day.reposts} reposts`}
                />
                <div 
                  className="bg-blue-500 h-6 rounded transition-all duration-500"
                  style={{ width: `${(day.follows / maxValue) * 100}%` }}
                  title={`${day.follows} follows`}
                />
                <div 
                  className="bg-purple-500 h-6 rounded transition-all duration-500"
                  style={{ width: `${(day.replies / maxValue) * 100}%` }}
                  title={`${day.replies} replies`}
                />
              </div>
              <span className="text-sm text-gray-300 w-12 text-right">{day.total}</span>
            </div>
          ))}
        </div>
        
        <div className="flex gap-4 mt-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-pink-500 rounded"></div>
            <span className="text-gray-400">Likes</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-500 rounded"></div>
            <span className="text-gray-400">Reposts</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-blue-500 rounded"></div>
            <span className="text-gray-400">Follows</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-purple-500 rounded"></div>
            <span className="text-gray-400">Replies</span>
          </div>
        </div>
      </div>

      {/* Top Users */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Heart className="text-pink-500" size={20} />
          Most Active Users
        </h2>
        <div className="space-y-3">
          {analytics.topUsers.map(({ handle, count, user }) => (
            <div key={handle} className="flex items-center gap-3">
              {user?.avatar ? (
                <img 
                  src={user.avatar} 
                  alt={handle}
                  className="w-10 h-10 rounded-full"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
                  {handle.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1">
                <p className="text-sm font-medium">{user?.displayName || handle}</p>
                <p className="text-xs text-gray-400">@{handle}</p>
              </div>
              <span className="text-sm text-gray-300">{count} interactions</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}