import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Calendar, Clock, Users, Heart, Repeat2, MessageCircle, Quote, UserPlus } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { format, differenceInMinutes, differenceInHours, startOfDay, isSameDay, isToday, isYesterday, formatDistanceToNow } from 'date-fns'
import '../styles/timeline.css'

interface AggregatedEvent {
  time: Date
  notifications: any[]
  types: Set<string>
  actors: Set<string>
}

export const VisualTimeline: React.FC = () => {
  const { agent } = useAuth()

  const { data, isLoading } = useQuery({
    queryKey: ['notifications-visual-timeline'],
    queryFn: async () => {
      if (!agent) throw new Error('Not authenticated')
      const response = await agent.listNotifications({ limit: 200 })
      return response.data
    }
  })

  // Aggregate notifications that happen close together (within 5 minutes)
  const aggregatedEvents = React.useMemo(() => {
    if (!data?.notifications) return []

    const events: AggregatedEvent[] = []
    const sorted = [...data.notifications].sort((a, b) => 
      new Date(b.indexedAt).getTime() - new Date(a.indexedAt).getTime()
    )

    sorted.forEach(notification => {
      const notifTime = new Date(notification.indexedAt)
      const lastEvent = events[events.length - 1]

      if (lastEvent && differenceInMinutes(lastEvent.time, notifTime) <= 5) {
        // Aggregate with the last event
        lastEvent.notifications.push(notification)
        lastEvent.types.add(notification.reason)
        lastEvent.actors.add(notification.author.handle)
      } else {
        // Create a new event
        events.push({
          time: notifTime,
          notifications: [notification],
          types: new Set([notification.reason]),
          actors: new Set([notification.author.handle])
        })
      }
    })

    return events
  }, [data])

  // Calculate visual spacing based on time gaps
  const getSpacingClass = (currentTime: Date, previousTime?: Date) => {
    if (!previousTime) return ''
    
    const hoursDiff = differenceInHours(previousTime, currentTime)
    
    if (hoursDiff >= 24) return 'mt-24'
    if (hoursDiff >= 12) return 'mt-20'
    if (hoursDiff >= 6) return 'mt-16'
    if (hoursDiff >= 3) return 'mt-12'
    if (hoursDiff >= 1) return 'mt-8'
    return 'mt-4'
  }

  const getTimeLabel = (date: Date) => {
    if (isToday(date)) return 'Today'
    if (isYesterday(date)) return 'Yesterday'
    return format(date, 'EEEE, MMMM d')
  }

  const getReasonIcon = (reason: string) => {
    switch (reason) {
      case 'like': return <Heart size={16} className="text-red-500" />
      case 'repost': return <Repeat2 size={16} className="text-green-500" />
      case 'follow': return <UserPlus size={16} className="text-blue-500" />
      case 'reply': return <MessageCircle size={16} className="text-purple-500" />
      case 'quote': return <Quote size={16} className="text-orange-500" />
      default: return <MessageCircle size={16} className="text-gray-500" />
    }
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex gap-4">
              <div className="w-24 h-6 rounded" style={{ backgroundColor: 'var(--bsky-bg-tertiary)' }}></div>
              <div className="flex-1 h-20 rounded" style={{ backgroundColor: 'var(--bsky-bg-tertiary)' }}></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  let lastDayLabel: string | null = null

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2 flex items-center gap-2">
          <Calendar className="text-blue-500" />
          Visual Timeline
        </h1>
        <p style={{ color: 'var(--bsky-text-secondary)' }}>
          Your activity over time with visual spacing
        </p>
      </div>

      <div className="relative">
        {/* Timeline line */}
        <div 
          className="absolute left-12 top-0 bottom-0 w-0.5"
          style={{ backgroundColor: 'var(--bsky-border-color)' }}
        />

        {aggregatedEvents.map((event, index) => {
          const dayLabel = getTimeLabel(event.time)
          const showDayLabel = dayLabel !== lastDayLabel
          lastDayLabel = dayLabel

          const previousEvent = aggregatedEvents[index - 1]
          const spacingClass = getSpacingClass(event.time, previousEvent?.time)

          return (
            <div 
              key={`${event.time.toISOString()}-${index}`} 
              className={`relative ${spacingClass}`}
            >
              {/* Day label */}
              {showDayLabel && (
                <div className="mb-6">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: 'var(--bsky-primary)' }}
                    />
                    <h2 className="text-lg font-semibold" style={{ color: 'var(--bsky-text-primary)' }}>
                      {dayLabel}
                    </h2>
                  </div>
                </div>
              )}

              {/* Time and event */}
              <div className="flex gap-4 items-start timeline-event">
                {/* Time */}
                <div className="w-16 text-right text-sm pt-2 timeline-time-label" style={{ color: 'var(--bsky-text-secondary)' }}>
                  {format(event.time, 'HH:mm')}
                </div>

                {/* Timeline dot */}
                <div className="relative flex-shrink-0">
                  <div 
                    className={`w-2 h-2 rounded-full mt-3 ${differenceInHours(new Date(), event.time) < 1 ? 'timeline-dot-recent' : ''}`}
                    style={{ backgroundColor: event.notifications.length > 3 ? 'var(--bsky-primary)' : 'var(--bsky-text-secondary)' }}
                  />
                </div>

                {/* Event card */}
                <div 
                  className={`flex-1 p-4 rounded-lg timeline-event-card ${event.notifications.length > 1 ? 'timeline-aggregated' : ''}`}
                  style={{ 
                    backgroundColor: event.notifications.length === 1 ? 'var(--bsky-bg-secondary)' : undefined,
                    border: '1px solid var(--bsky-border-color)'
                  }}
                >
                  {/* Single notification */}
                  {event.notifications.length === 1 ? (
                    <div className="flex items-start gap-3">
                      <img 
                        src={event.notifications[0].author.avatar} 
                        alt={event.notifications[0].author.handle}
                        className="w-10 h-10 rounded-full"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {getReasonIcon(event.notifications[0].reason)}
                          <span className="font-medium">
                            {event.notifications[0].author.displayName || event.notifications[0].author.handle}
                          </span>
                        </div>
                        <p className="text-sm" style={{ color: 'var(--bsky-text-secondary)' }}>
                          {getActionText(event.notifications[0].reason)}
                        </p>
                      </div>
                    </div>
                  ) : (
                    /* Aggregated notifications */
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Users size={20} className="text-blue-500" />
                        <span className="font-medium">
                          {event.actors.size} {event.actors.size === 1 ? 'person' : 'people'}
                        </span>
                      </div>
                      
                      {/* Action summary */}
                      <div className="flex flex-wrap gap-3 mb-3">
                        {Array.from(event.types).map(type => (
                          <div key={type} className="flex items-center gap-1.5 text-sm">
                            {getReasonIcon(type)}
                            <span>{getActionCount(event.notifications, type)} {type}s</span>
                          </div>
                        ))}
                      </div>

                      {/* Actor avatars */}
                      <div className="flex -space-x-2 avatar-stack">
                        {event.notifications.slice(0, 8).map((notif, i) => (
                          <img 
                            key={`${notif.uri}-${i}`}
                            src={notif.author.avatar} 
                            alt={notif.author.handle}
                            className="w-8 h-8 rounded-full border-2"
                            style={{ borderColor: 'var(--bsky-bg-secondary)' }}
                            title={notif.author.displayName || notif.author.handle}
                          />
                        ))}
                        {event.notifications.length > 8 && (
                          <div 
                            className="w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-medium"
                            style={{ 
                              backgroundColor: 'var(--bsky-bg-tertiary)',
                              borderColor: 'var(--bsky-bg-secondary)'
                            }}
                          >
                            +{event.notifications.length - 8}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Time ago label */}
                  <div className="mt-2 text-xs" style={{ color: 'var(--bsky-text-tertiary)' }}>
                    {formatDistanceToNow(event.time, { addSuffix: true })}
                  </div>
                </div>
              </div>

              {/* Visual gap indicator for large time gaps */}
              {previousEvent && differenceInHours(previousEvent.time, event.time) >= 6 && (
                <div 
                  className="absolute left-12 -top-8 text-xs px-2 py-1 rounded timeline-gap-indicator"
                  style={{ 
                    backgroundColor: 'var(--bsky-bg-tertiary)',
                    color: 'var(--bsky-text-secondary)',
                    transform: 'translateX(-50%)'
                  }}
                >
                  {Math.floor(differenceInHours(previousEvent.time, event.time))}h gap
                </div>
              )}
            </div>
          )
        })}

        {/* End of timeline */}
        <div className="relative mt-8 flex items-center gap-3">
          <div className="w-16" />
          <div 
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: 'var(--bsky-border-color)' }}
          />
          <span className="text-sm" style={{ color: 'var(--bsky-text-secondary)' }}>
            End of timeline
          </span>
        </div>
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

function getActionCount(notifications: any[], type: string): number {
  return notifications.filter(n => n.reason === type).length
}