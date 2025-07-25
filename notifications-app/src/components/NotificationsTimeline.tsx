import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Calendar, Clock } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { format, startOfDay, isSameDay } from 'date-fns'

export const NotificationsTimeline: React.FC = () => {
  const { agent } = useAuth()

  const { data, isLoading } = useQuery({
    queryKey: ['notifications-timeline'],
    queryFn: async () => {
      if (!agent) throw new Error('Not authenticated')
      const response = await agent.listNotifications({ limit: 200 })
      return response.data
    }
  })

  // Group notifications by day
  const groupedNotifications = React.useMemo(() => {
    if (!data?.notifications) return []

    const groups = new Map<string, typeof data.notifications>()
    
    data.notifications.forEach(notification => {
      const date = startOfDay(new Date(notification.indexedAt))
      const key = date.toISOString()
      
      if (!groups.has(key)) {
        groups.set(key, [])
      }
      groups.get(key)!.push(notification)
    })

    return Array.from(groups.entries())
      .map(([date, notifications]) => ({
        date: new Date(date),
        notifications: notifications.sort((a, b) => 
          new Date(b.indexedAt).getTime() - new Date(a.indexedAt).getTime()
        )
      }))
      .sort((a, b) => b.date.getTime() - a.date.getTime())
  }, [data])

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-6 bg-gray-800 rounded w-32"></div>
              <div className="h-20 bg-gray-800 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2 flex items-center gap-2">
          <Calendar className="text-blue-500" />
          Timeline View
        </h1>
        <p className="text-gray-400">Your notifications organized by day</p>
      </div>

      <div className="space-y-8">
        {groupedNotifications.map(({ date, notifications }) => (
          <div key={date.toISOString()}>
            <div className="sticky top-16 bg-gray-900 py-2 z-10">
              <h2 className="text-lg font-semibold text-gray-300">
                {isSameDay(date, new Date()) ? 'Today' : format(date, 'EEEE, MMMM d')}
              </h2>
            </div>

            <div className="mt-4 space-y-2">
              {notifications.map((notification) => (
                <div
                  key={`${notification.uri}-${notification.indexedAt}`}
                  className="flex gap-4 p-3 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  <div className="flex-shrink-0 text-xs text-gray-500 w-16 pt-1">
                    <Clock size={14} className="inline mr-1" />
                    {format(new Date(notification.indexedAt), 'HH:mm')}
                  </div>
                  
                  <div className="flex-1 flex items-start gap-3">
                    {notification.author.avatar ? (
                      <img 
                        src={notification.author.avatar} 
                        alt={notification.author.handle}
                        className="w-8 h-8 rounded-full"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs">
                        {notification.author.handle.charAt(0).toUpperCase()}
                      </div>
                    )}
                    
                    <div className="flex-1">
                      <p className="text-sm">
                        <span className="font-medium">
                          {notification.author.displayName || notification.author.handle}
                        </span>
                        {' '}
                        <span className="text-gray-400">
                          {getActionText(notification.reason)}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function getActionText(reason: string): string {
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