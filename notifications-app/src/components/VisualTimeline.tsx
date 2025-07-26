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
  postUri?: string // For post-specific aggregations
  aggregationType: 'post' | 'follow' | 'mixed' // Type of aggregation
}

export const VisualTimeline: React.FC = () => {
  const { agent } = useAuth()

  const { data, isLoading } = useQuery({
    queryKey: ['notifications-visual-timeline'],
    queryFn: async () => {
      if (!agent) throw new Error('Not authenticated')
      const response = await agent.listNotifications({ limit: 100 })
      return response.data
    }
  })

  // Smart aggregation based on notification type and context
  const aggregatedEvents = React.useMemo(() => {
    if (!data?.notifications) return []

    const events: AggregatedEvent[] = []
    const sorted = [...data.notifications].sort((a, b) => 
      new Date(b.indexedAt).getTime() - new Date(a.indexedAt).getTime()
    )

    // Group follow notifications together, and post-related notifications by post URI
    sorted.forEach(notification => {
      const notifTime = new Date(notification.indexedAt)
      
      // Find an existing event to potentially aggregate with
      let aggregated = false
      
      if (notification.reason === 'follow') {
        // Look for recent follow events to aggregate with
        for (let i = events.length - 1; i >= 0; i--) {
          const event = events[i]
          if (event.aggregationType === 'follow' && 
              differenceInMinutes(event.time, notifTime) <= 60) {
            // Aggregate follows within 60 minutes
            event.notifications.push(notification)
            event.actors.add(notification.author.handle)
            aggregated = true
            break
          }
        }
      } else if (['like', 'repost', 'quote'].includes(notification.reason) && notification.uri) {
        // Look for events about the same post
        for (let i = events.length - 1; i >= 0; i--) {
          const event = events[i]
          if (event.postUri === notification.uri && 
              differenceInHours(event.time, notifTime) <= 24) {
            // Aggregate post interactions within 24 hours
            event.notifications.push(notification)
            event.types.add(notification.reason)
            event.actors.add(notification.author.handle)
            aggregated = true
            break
          }
        }
      }
      
      if (!aggregated) {
        // Create a new event
        const newEvent: AggregatedEvent = {
          time: notifTime,
          notifications: [notification],
          types: new Set([notification.reason]),
          actors: new Set([notification.author.handle]),
          aggregationType: notification.reason === 'follow' ? 'follow' : 
                          ['like', 'repost', 'quote'].includes(notification.reason) ? 'post' : 'mixed'
        }
        
        if (notification.uri && ['like', 'repost', 'quote'].includes(notification.reason)) {
          newEvent.postUri = notification.uri
        }
        
        events.push(newEvent)
      }
    })

    return events
  }, [data])

  // Calculate visual spacing based on time gaps
  const getSpacingClass = (currentTime: Date, previousTime?: Date) => {
    if (!previousTime) return ''
    
    const hoursDiff = differenceInHours(previousTime, currentTime)
    
    if (hoursDiff >= 24) return 'mt-12'
    if (hoursDiff >= 12) return 'mt-8'
    if (hoursDiff >= 6) return 'mt-6'
    if (hoursDiff >= 3) return 'mt-4'
    if (hoursDiff >= 1) return 'mt-3'
    return 'mt-2'
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
                <div className="mb-3">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: 'var(--bsky-primary)' }}
                    />
                    <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--bsky-text-secondary)' }}>
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
                <div className="relative flex-shrink-0" style={{ paddingTop: '14px' }}>
                  <div 
                    className={`w-2 h-2 rounded-full ${differenceInHours(new Date(), event.time) < 1 ? 'timeline-dot-recent' : ''}`}
                    style={{ 
                      backgroundColor: event.aggregationType === 'post' ? 'var(--bsky-primary)' : 
                                      event.aggregationType === 'follow' ? 'var(--bsky-follow)' :
                                      'var(--bsky-text-secondary)'
                    }}
                  />
                </div>

                {/* Event card */}
                <div 
                  className={`flex-1 p-3 rounded-lg timeline-event-card ${
                    event.notifications.length > 1 ? 'timeline-aggregated' : ''
                  } ${
                    event.aggregationType === 'follow' ? 'timeline-follow-aggregate' : 
                    event.aggregationType === 'post' ? 'timeline-post-aggregate' : ''
                  }`}
                  style={{ 
                    backgroundColor: event.notifications.length === 1 ? 'var(--bsky-bg-secondary)' : undefined,
                    border: '1px solid var(--bsky-border-color)'
                  }}
                >
                  {/* Single notification */}
                  {event.notifications.length === 1 ? (
                    <div>
                      <div className="flex items-center gap-3">
                        <img 
                          src={event.notifications[0].author.avatar} 
                          alt={event.notifications[0].author.handle}
                          className="w-8 h-8 rounded-full"
                        />
                        <div className="flex-1 flex items-center gap-2">
                          {getReasonIcon(event.notifications[0].reason)}
                          <span className="font-medium text-sm">
                            {event.notifications[0].author.displayName || event.notifications[0].author.handle}
                          </span>
                          <span className="text-sm" style={{ color: 'var(--bsky-text-secondary)' }}>
                            {getActionText(event.notifications[0].reason)}
                          </span>
                        </div>
                      </div>
                      {/* Show post preview for single notifications too */}
                      {event.notifications[0].reason !== 'follow' && event.notifications[0].record?.value?.text && (
                        <div className="mt-2 ml-11 p-2 rounded timeline-post-preview" style={{ backgroundColor: 'var(--bsky-bg-tertiary)' }}>
                          <p className="text-xs line-clamp-2" style={{ color: 'var(--bsky-text-secondary)' }}>
                            {event.notifications[0].record.value.text}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Aggregated notifications */
                    <div>
                      <div className="flex items-center gap-3">
                        {/* Actor avatars */}
                        <div className="flex -space-x-2 avatar-stack flex-shrink-0">
                          {event.notifications.slice(0, 5).map((notif, i) => (
                            <img 
                              key={`${notif.uri}-${i}`}
                              src={notif.author.avatar} 
                              alt={notif.author.handle}
                              className="w-6 h-6 rounded-full border-2"
                              style={{ borderColor: 'var(--bsky-bg-secondary)' }}
                              title={notif.author.displayName || notif.author.handle}
                            />
                          ))}
                          {event.notifications.length > 5 && (
                            <div 
                              className="w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-medium"
                              style={{ 
                                backgroundColor: 'var(--bsky-bg-tertiary)',
                                borderColor: 'var(--bsky-bg-secondary)',
                                fontSize: '10px'
                              }}
                            >
                              +{event.notifications.length - 5}
                            </div>
                          )}
                        </div>
                        
                        {/* Compact summary */}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {event.aggregationType === 'follow' ? (
                              <>
                                <span className="font-medium text-sm">
                                  {event.actors.size} new {event.actors.size === 1 ? 'follower' : 'followers'}
                                </span>
                                {getReasonIcon('follow')}
                              </>
                            ) : (
                              <>
                                <span className="font-medium text-sm">
                                  {event.actors.size} {event.actors.size === 1 ? 'person' : 'people'}
                                </span>
                                <span className="text-sm" style={{ color: 'var(--bsky-text-secondary)' }}>•</span>
                                {Array.from(event.types).map((type, i) => (
                                  <span key={type} className="flex items-center gap-1 text-sm">
                                    {getReasonIcon(type)}
                                    <span style={{ color: 'var(--bsky-text-secondary)' }}>
                                      {getActionCount(event.notifications, type)}
                                    </span>
                                    {i < event.types.size - 1 && <span style={{ color: 'var(--bsky-text-secondary)' }}>•</span>}
                                  </span>
                                ))}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Post preview for aggregated post notifications */}
                      {event.aggregationType === 'post' && event.notifications[0].record?.value?.text && (
                        <div className="mt-3 p-3 rounded timeline-post-preview" style={{ backgroundColor: 'var(--bsky-bg-tertiary)' }}>
                          <p className="text-xs font-medium mb-1" style={{ color: 'var(--bsky-text-tertiary)' }}>
                            Your post:
                          </p>
                          <p className="text-sm line-clamp-3" style={{ color: 'var(--bsky-text-primary)' }}>
                            {event.notifications[0].record.value.text}
                          </p>
                          <div className="mt-2 text-xs flex items-center gap-2" style={{ color: 'var(--bsky-text-tertiary)' }}>
                            <span>{event.notifications.filter(n => n.reason === 'like').length} likes</span>
                            <span>•</span>
                            <span>{event.notifications.filter(n => n.reason === 'repost').length} reposts</span>
                            {event.notifications.some(n => n.reason === 'quote') && (
                              <>
                                <span>•</span>
                                <span>{event.notifications.filter(n => n.reason === 'quote').length} quotes</span>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Visual gap indicator for large time gaps */}
              {previousEvent && differenceInHours(previousEvent.time, event.time) >= 12 && (
                <div 
                  className="absolute left-12 -top-3 text-xs timeline-gap-indicator"
                  style={{ 
                    color: 'var(--bsky-text-tertiary)',
                    transform: 'translateX(-50%)',
                    fontSize: '10px'
                  }}
                >
                  {Math.floor(differenceInHours(previousEvent.time, event.time))}h
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