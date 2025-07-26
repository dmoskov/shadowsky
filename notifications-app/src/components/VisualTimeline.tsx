import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Calendar, Clock, Users, Heart, Repeat2, MessageCircle, Quote, UserPlus, ExternalLink } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { format, differenceInMinutes, differenceInHours, startOfDay, isSameDay, isToday, isYesterday, formatDistanceToNow } from 'date-fns'
import { useNotificationPosts } from '../hooks/useNotificationPosts'
import '../styles/timeline.css'

interface AggregatedEvent {
  time: Date
  notifications: any[]
  types: Set<string>
  actors: Set<string>
  postUri?: string // For post-specific aggregations
  aggregationType: 'post' | 'follow' | 'mixed' | 'post-burst' // Type of aggregation
  earliestTime?: Date // Track the earliest notification in the group
  latestTime?: Date // Track the latest notification in the group
  burstIntensity?: 'low' | 'medium' | 'high' // For post bursts
  postText?: string // Cache the post text for burst events
}

// Helper function to extract handle and rkey from AT URI
const parseAtUri = (uri: string) => {
  const match = uri.match(/at:\/\/(.+?)\/(.+?)\/(.+)/)
  if (!match) return null
  return {
    did: match[1],
    collection: match[2],
    rkey: match[3]
  }
}

// Helper function to generate Bluesky app URL for a post
const getPostUrl = (uri: string, authorHandle?: string) => {
  const parsed = parseAtUri(uri)
  if (!parsed || !authorHandle) return null
  
  // Bluesky post URLs follow the pattern: https://bsky.app/profile/{handle}/post/{rkey}
  return `https://bsky.app/profile/${authorHandle}/post/${parsed.rkey}`
}

// Helper function to generate Bluesky app URL for a profile
const getProfileUrl = (handle: string) => {
  // Remove @ if present
  const cleanHandle = handle.startsWith('@') ? handle.slice(1) : handle
  return `https://bsky.app/profile/${cleanHandle}`
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

  // Fetch posts for notifications to show richer content
  const notifications = data?.notifications || []
  const { data: posts } = useNotificationPosts(notifications)
  
  // Create a map for quick post lookup
  const postMap = React.useMemo(() => {
    if (!posts) return new Map()
    return new Map(posts.map(post => [post.uri, post]))
  }, [posts])

  // Smart aggregation based on notification type and context
  const aggregatedEvents = React.useMemo(() => {
    if (!data?.notifications) return []

    const events: AggregatedEvent[] = []
    const sorted = [...data.notifications].sort((a, b) => 
      new Date(b.indexedAt).getTime() - new Date(a.indexedAt).getTime()
    )

    // First pass: Group notifications by post URI to identify post bursts
    const postGroups = new Map<string, any[]>()
    const followGroups: any[] = []
    const otherNotifications: any[] = []

    sorted.forEach(notification => {
      if (['like', 'repost', 'quote', 'reply'].includes(notification.reason)) {
        // For likes and reposts, use reasonSubject which contains the original post URI
        const postUri = (notification.reason === 'repost' || notification.reason === 'like') && notification.reasonSubject 
          ? notification.reasonSubject 
          : notification.uri
        
        if (postUri) {
          if (!postGroups.has(postUri)) {
            postGroups.set(postUri, [])
          }
          postGroups.get(postUri)!.push(notification)
        }
      } else if (notification.reason === 'follow') {
        followGroups.push(notification)
      } else {
        otherNotifications.push(notification)
      }
    })

    // Process post groups to create burst events
    postGroups.forEach((notifications, postUri) => {
      if (notifications.length >= 3) {
        // This is a burst of activity on a single post
        const times = notifications.map(n => new Date(n.indexedAt).getTime())
        const earliestTime = new Date(Math.min(...times))
        const latestTime = new Date(Math.max(...times))
        const timeSpanHours = differenceInHours(latestTime, earliestTime)
        
        // Determine burst intensity based on notification count and time span
        let burstIntensity: 'low' | 'medium' | 'high' = 'low'
        if (notifications.length >= 10 && timeSpanHours <= 6) {
          burstIntensity = 'high'
        } else if (notifications.length >= 5 && timeSpanHours <= 12) {
          burstIntensity = 'medium'
        }

        // Get post text from post map if available
        const post = postMap.get(postUri)
        const postText = post?.record?.text

        const burstEvent: AggregatedEvent = {
          time: latestTime, // Use latest time for sorting
          notifications: notifications,
          types: new Set(notifications.map(n => n.reason)),
          actors: new Set(notifications.map(n => n.author.handle)),
          postUri: postUri,
          aggregationType: 'post-burst',
          earliestTime: earliestTime,
          latestTime: latestTime,
          burstIntensity: burstIntensity,
          postText: postText
        }
        events.push(burstEvent)
      } else {
        // Too few notifications for a burst, create individual or small grouped events
        notifications.forEach(notification => {
          events.push({
            time: new Date(notification.indexedAt),
            notifications: [notification],
            types: new Set([notification.reason]),
            actors: new Set([notification.author.handle]),
            postUri: postUri,
            aggregationType: 'post'
          })
        })
      }
    })

    // Process follow notifications with wider time window
    const followBursts: any[] = []
    let currentFollowBurst: any[] = []
    
    followGroups.forEach((notification, index) => {
      if (currentFollowBurst.length === 0) {
        currentFollowBurst.push(notification)
      } else {
        const lastTime = new Date(currentFollowBurst[currentFollowBurst.length - 1].indexedAt)
        const currentTime = new Date(notification.indexedAt)
        
        // Group follows within 2 hours
        if (differenceInHours(lastTime, currentTime) <= 2) {
          currentFollowBurst.push(notification)
        } else {
          // Save current burst and start new one
          if (currentFollowBurst.length > 0) {
            followBursts.push([...currentFollowBurst])
          }
          currentFollowBurst = [notification]
        }
      }
      
      // Save last burst
      if (index === followGroups.length - 1 && currentFollowBurst.length > 0) {
        followBursts.push(currentFollowBurst)
      }
    })

    // Create events for follow bursts
    followBursts.forEach(burst => {
      if (burst.length >= 2) {
        const times = burst.map(n => new Date(n.indexedAt).getTime())
        const latestTime = new Date(Math.max(...times))
        
        events.push({
          time: latestTime,
          notifications: burst,
          types: new Set(['follow']),
          actors: new Set(burst.map(n => n.author.handle)),
          aggregationType: 'follow',
          earliestTime: new Date(Math.min(...times)),
          latestTime: latestTime
        })
      } else {
        // Single follow
        events.push({
          time: new Date(burst[0].indexedAt),
          notifications: burst,
          types: new Set(['follow']),
          actors: new Set([burst[0].author.handle]),
          aggregationType: 'follow'
        })
      }
    })

    // Add other notifications as individual events
    otherNotifications.forEach(notification => {
      events.push({
        time: new Date(notification.indexedAt),
        notifications: [notification],
        types: new Set([notification.reason]),
        actors: new Set([notification.author.handle]),
        aggregationType: 'mixed'
      })
    })

    // Sort all events by time (newest first)
    events.sort((a, b) => b.time.getTime() - a.time.getTime())

    return events
  }, [data, postMap])

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
                    className={`${event.aggregationType === 'post-burst' ? 'w-4 h-4' : 'w-2 h-2'} rounded-full ${differenceInHours(new Date(), event.time) < 1 ? 'timeline-dot-recent' : ''}`}
                    style={{ 
                      backgroundColor: event.aggregationType === 'post-burst' ? 
                                      (event.burstIntensity === 'high' ? '#ff4757' : 
                                       event.burstIntensity === 'medium' ? '#ffa502' : 
                                       'var(--bsky-primary)') :
                                      event.aggregationType === 'post' ? 'var(--bsky-primary)' : 
                                      event.aggregationType === 'follow' ? 'var(--bsky-follow)' :
                                      'var(--bsky-text-secondary)',
                      boxShadow: event.aggregationType === 'post-burst' && event.burstIntensity === 'high' ? 
                                '0 0 0 4px rgba(255, 71, 87, 0.2)' : undefined
                    }}
                  />
                </div>

                {/* Event card */}
                <div 
                  className={`flex-1 p-3 rounded-lg timeline-event-card ${
                    event.notifications.length > 1 ? 'timeline-aggregated' : ''
                  } ${
                    event.aggregationType === 'follow' ? 'timeline-follow-aggregate' : 
                    event.aggregationType === 'post' ? 'timeline-post-aggregate' : 
                    event.aggregationType === 'post-burst' ? 'timeline-post-burst' : ''
                  }`}
                  style={{ 
                    backgroundColor: event.notifications.length === 1 && event.aggregationType !== 'post-burst' ? 'var(--bsky-bg-secondary)' : undefined,
                    border: event.aggregationType === 'post-burst' ? 
                           `2px solid ${event.burstIntensity === 'high' ? '#ff4757' : 
                                        event.burstIntensity === 'medium' ? '#ffa502' : 
                                        'var(--bsky-primary)'}` :
                           '1px solid var(--bsky-border-color)',
                    borderRadius: event.aggregationType === 'post-burst' ? '12px' : '8px'
                  }}
                >
                  {/* Single notification */}
                  {event.notifications.length === 1 ? (
                    <div>
                      <div className="flex items-center gap-3">
                        <a 
                          href={getProfileUrl(event.notifications[0].author.handle)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-shrink-0 hover:opacity-80 transition-opacity"
                        >
                          <img 
                            src={event.notifications[0].author.avatar} 
                            alt={event.notifications[0].author.handle}
                            className="w-8 h-8 rounded-full"
                          />
                        </a>
                        <div className="flex-1 flex items-center gap-2">
                          {getReasonIcon(event.notifications[0].reason)}
                          <a 
                            href={getProfileUrl(event.notifications[0].author.handle)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-sm hover:underline"
                            style={{ color: 'var(--bsky-primary)' }}
                          >
                            {event.notifications[0].author.displayName || event.notifications[0].author.handle}
                          </a>
                          <span className="text-sm" style={{ color: 'var(--bsky-text-secondary)' }}>
                            {getActionText(event.notifications[0].reason)}
                          </span>
                        </div>
                      </div>
                      {/* Show post preview for single notifications too */}
                      {event.notifications[0].reason !== 'follow' && (
                        (() => {
                          const notification = event.notifications[0]
                          
                          // Try to get full post data first
                          // For reposts and likes, use reasonSubject which contains the original post URI
                          const postUri = (notification.reason === 'repost' || notification.reason === 'like') && notification.reasonSubject 
                            ? notification.reasonSubject 
                            : notification.uri
                          const post = ['like', 'repost', 'reply', 'quote'].includes(notification.reason) 
                            ? postMap.get(postUri) 
                            : undefined
                          
                          if (post) {
                            // We have full post data
                            const postUrl = getPostUrl(postUri, post.author?.handle)
                            return (
                              <a 
                                href={postUrl || '#'}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block mt-2 ml-11 p-3 rounded timeline-post-preview hover:opacity-90 transition-opacity" 
                                style={{ 
                                  backgroundColor: 'var(--bsky-bg-tertiary)',
                                  border: '1px solid var(--bsky-border-primary)',
                                  textDecoration: 'none'
                                }}
                              >
                                <p className="text-xs font-medium mb-1 flex items-center gap-1" style={{ color: 'var(--bsky-text-tertiary)' }}>
                                  {notification.reason === 'reply' ? 'Replying to your post:' : 
                                   notification.reason === 'quote' ? 'Quoting your post:' : 'Your post:'}
                                  <ExternalLink size={10} />
                                </p>
                                <p className="text-xs line-clamp-2" style={{ color: 'var(--bsky-text-primary)' }}>
                                  {post.record?.text || '[Post with no text]'}
                                </p>
                              </a>
                            )
                          }
                          
                          // Fallback for mentions or when post data isn't available
                          const postText = notification.record?.text || 
                                         (notification.record && typeof notification.record === 'object' && 'text' in notification.record ? 
                                          (notification.record as { text?: string }).text : null)
                          
                          if (!postText) return null
                          
                          return (
                            <div className="mt-2 ml-11 p-3 rounded timeline-post-preview" style={{ 
                              backgroundColor: 'var(--bsky-bg-tertiary)',
                              border: '1px solid var(--bsky-border-primary)' 
                            }}>
                              <p className="text-xs font-medium mb-1" style={{ color: 'var(--bsky-text-tertiary)' }}>
                                {notification.reason === 'mention' ? 'Mentioned you in:' : 'Post:'}
                              </p>
                              <p className="text-xs line-clamp-2" style={{ color: 'var(--bsky-text-primary)' }}>
                                {postText}
                              </p>
                            </div>
                          )
                        })()
                      )}
                    </div>
                  ) : (
                    /* Aggregated notifications */
                    <div>
                      {event.aggregationType === 'post-burst' ? (
                        // Special layout for post bursts
                        <div>
                          <div className="flex items-start gap-3 mb-3">
                            <div className="flex-shrink-0">
                              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{
                                backgroundColor: event.burstIntensity === 'high' ? 'rgba(255, 71, 87, 0.1)' : 
                                               event.burstIntensity === 'medium' ? 'rgba(255, 165, 2, 0.1)' : 
                                               'rgba(0, 149, 246, 0.1)'
                              }}>
                                <span className="text-2xl">🔥</span>
                              </div>
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-bold text-base">
                                  Post Activity Burst
                                </span>
                                {event.burstIntensity === 'high' && (
                                  <span className="px-2 py-0.5 rounded-full text-xs font-medium text-white" style={{ backgroundColor: '#ff4757' }}>
                                    High Activity
                                  </span>
                                )}
                                {event.burstIntensity === 'medium' && (
                                  <span className="px-2 py-0.5 rounded-full text-xs font-medium text-white" style={{ backgroundColor: '#ffa502' }}>
                                    Medium Activity
                                  </span>
                                )}
                              </div>
                              <p className="text-sm" style={{ color: 'var(--bsky-text-secondary)' }}>
                                {event.actors.size} {event.actors.size === 1 ? 'person' : 'people'} engaged over {
                                  event.earliestTime && event.latestTime ? 
                                  formatDistanceToNow(event.earliestTime, { addSuffix: false }) : 
                                  'time'
                                }
                              </p>
                            </div>
                          </div>
                          
                          {/* Engagement breakdown */}
                          <div className="grid grid-cols-3 gap-2 mb-3">
                            {event.notifications.filter(n => n.reason === 'like').length > 0 && (
                              <div className="flex items-center gap-2 p-2 rounded" style={{ backgroundColor: 'rgba(255, 71, 87, 0.1)' }}>
                                <Heart size={20} className="text-red-500" />
                                <span className="font-semibold">{event.notifications.filter(n => n.reason === 'like').length}</span>
                              </div>
                            )}
                            {event.notifications.filter(n => n.reason === 'repost').length > 0 && (
                              <div className="flex items-center gap-2 p-2 rounded" style={{ backgroundColor: 'rgba(52, 211, 153, 0.1)' }}>
                                <Repeat2 size={20} className="text-green-500" />
                                <span className="font-semibold">{event.notifications.filter(n => n.reason === 'repost').length}</span>
                              </div>
                            )}
                            {event.notifications.filter(n => n.reason === 'reply').length > 0 && (
                              <div className="flex items-center gap-2 p-2 rounded" style={{ backgroundColor: 'rgba(147, 51, 234, 0.1)' }}>
                                <MessageCircle size={20} className="text-purple-500" />
                                <span className="font-semibold">{event.notifications.filter(n => n.reason === 'reply').length}</span>
                              </div>
                            )}
                            {event.notifications.filter(n => n.reason === 'quote').length > 0 && (
                              <div className="flex items-center gap-2 p-2 rounded" style={{ backgroundColor: 'rgba(251, 146, 60, 0.1)' }}>
                                <Quote size={20} className="text-orange-500" />
                                <span className="font-semibold">{event.notifications.filter(n => n.reason === 'quote').length}</span>
                              </div>
                            )}
                          </div>
                          
                          {/* Actor avatars in a grid for bursts */}
                          <div className="mb-3">
                            <div className="flex flex-wrap gap-1">
                              {event.notifications.slice(0, 12).map((notif, i) => (
                                <a
                                  key={`${notif.uri}-${i}`}
                                  href={getProfileUrl(notif.author.handle)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="hover:opacity-80 transition-opacity"
                                >
                                  <img 
                                    src={notif.author.avatar} 
                                    alt={notif.author.handle}
                                    className="w-8 h-8 rounded-full"
                                    title={notif.author.displayName || notif.author.handle}
                                  />
                                </a>
                              ))}
                              {event.notifications.length > 12 && (
                                <div 
                                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                                  style={{ 
                                    backgroundColor: 'var(--bsky-bg-tertiary)',
                                    color: 'var(--bsky-text-primary)'
                                  }}
                                >
                                  +{event.notifications.length - 12}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        // Regular aggregated layout
                        <div className="flex items-center gap-3">
                          {/* Actor avatars */}
                          <div className="flex -space-x-2 avatar-stack flex-shrink-0">
                            {event.notifications.slice(0, 5).map((notif, i) => (
                              <a
                                key={`${notif.uri}-${i}`}
                                href={getProfileUrl(notif.author.handle)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:z-10 hover:scale-110 transition-transform"
                              >
                                <img 
                                  src={notif.author.avatar} 
                                  alt={notif.author.handle}
                                  className="w-6 h-6 rounded-full border-2"
                                  style={{ borderColor: 'var(--bsky-bg-secondary)' }}
                                  title={notif.author.displayName || notif.author.handle}
                                />
                              </a>
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
                      )}
                      
                      {/* Post preview for aggregated post notifications */}
                      {(event.aggregationType === 'post' || event.aggregationType === 'post-burst') && (
                        (() => {
                          const notification = event.notifications[0]
                          
                          // Try to get full post data
                          // For reposts and likes, use reasonSubject which contains the original post URI
                          const postUri = (notification.reason === 'repost' || notification.reason === 'like') && notification.reasonSubject 
                            ? notification.reasonSubject 
                            : notification.uri
                          const post = postMap.get(postUri)
                          
                          if (post) {
                            // We have full post data
                            return (
                              <div className="mt-3 p-3 rounded timeline-post-preview" style={{ 
                                backgroundColor: 'var(--bsky-bg-tertiary)',
                                border: '1px solid var(--bsky-border-primary)' 
                              }}>
                                <p className="text-xs font-medium mb-1" style={{ color: 'var(--bsky-text-tertiary)' }}>
                                  Your post:
                                </p>
                                <p className="text-sm line-clamp-3" style={{ color: 'var(--bsky-text-primary)' }}>
                                  {post.record?.text || '[Post with no text]'}
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
                            )
                          }
                          
                          // Fallback when post data isn't available
                          const postText = notification.record?.text || 
                                         (notification.record && typeof notification.record === 'object' && 'text' in notification.record ? 
                                          (notification.record as { text?: string }).text : null)
                          
                          if (!postText) return null
                          
                          return (
                            <div className="mt-3 p-3 rounded timeline-post-preview" style={{ 
                              backgroundColor: 'var(--bsky-bg-tertiary)',
                              border: '1px solid var(--bsky-border-primary)' 
                            }}>
                              <p className="text-xs font-medium mb-1" style={{ color: 'var(--bsky-text-tertiary)' }}>
                                Your post:
                              </p>
                              <p className="text-sm line-clamp-3" style={{ color: 'var(--bsky-text-primary)' }}>
                                {postText}
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
                          )
                        })()
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