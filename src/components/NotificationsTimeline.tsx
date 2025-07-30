import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Calendar, Clock } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { format, startOfDay, isSameDay } from 'date-fns'
import { proxifyBskyImage } from '../utils/image-proxy'

export const NotificationsTimeline: React.FC = () => {
  const { agent } = useAuth()

  const { data, isLoading } = useQuery({
    queryKey: ['notifications-timeline'],
    queryFn: async () => {
      if (!agent) throw new Error('Not authenticated')
      const response = await agent.listNotifications({ limit: 100 })
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
              <div className="h-6 rounded w-32" style={{ backgroundColor: 'var(--bsky-bg-tertiary)' }}></div>
              <div className="h-20 rounded" style={{ backgroundColor: 'var(--bsky-bg-tertiary)' }}></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2 flex items-center gap-2">
          <Calendar className="text-blue-500" />
          Timeline View
        </h1>
        <p style={{ color: 'var(--bsky-text-secondary)' }}>Your notifications organized by day</p>
      </div>

      <div className="space-y-8">
        {groupedNotifications.map(({ date, notifications }) => (
          <div key={date.toISOString()}>
            <div className="sticky top-16 py-2 z-10" style={{ backgroundColor: 'var(--bsky-bg-primary)' }}>
              <h2 className="text-lg font-semibold" style={{ color: 'var(--bsky-text-primary)' }}>
                {isSameDay(date, new Date()) ? 'Today' : format(date, 'EEEE, MMMM d')}
              </h2>
            </div>

            <div className="mt-4 space-y-2">
              {notifications.map((notification) => (
                <div
                  key={`${notification.uri}-${notification.indexedAt}`}
                  className="flex gap-4 p-3 rounded-lg transition-colors bsky-card-hover"
                >
                  <div className="flex-shrink-0 text-xs w-16 pt-1" style={{ color: 'var(--bsky-text-secondary)' }}>
                    <Clock size={14} className="inline mr-1" />
                    {format(new Date(notification.indexedAt), 'HH:mm')}
                  </div>
                  
                  <div className="flex-1 flex items-start gap-3">
                    {notification.author.avatar ? (
                      <img 
                        src={proxifyBskyImage(notification.author.avatar)} 
                        alt={notification.author.handle}
                        className="w-8 h-8 rounded-full"
                        crossOrigin="anonymous"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs" style={{ backgroundColor: 'var(--bsky-bg-hover)' }}>
                        {notification.author.handle.charAt(0).toUpperCase()}
                      </div>
                    )}
                    
                    <div className="flex-1">
                      <p className="text-sm">
                        <span className="font-medium">
                          {notification.author.displayName || notification.author.handle}
                        </span>
                        {' '}
                        <span style={{ color: 'var(--bsky-text-secondary)' }}>
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
    case 'starterpack-joined': return 'joined via your starterpack'
    case 'verified': return 'verified your account'
    case 'unverified': return 'unverified your account'
    case 'like-via-repost': return 'liked a repost of your post'
    case 'repost-via-repost': return 'reposted a repost of your post'
    default: return 'interacted with your post'
  }
}