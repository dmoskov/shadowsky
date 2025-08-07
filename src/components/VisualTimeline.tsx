import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Clock, Heart, Repeat2, MessageCircle, Quote, UserPlus, ExternalLink, X } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { format, differenceInMinutes, differenceInHours, isToday, isYesterday, formatDistanceToNow } from 'date-fns'
import { useNotificationPosts } from '../hooks/useNotificationPosts'
import { proxifyBskyImage } from '../utils/image-proxy'
import { ThreadModal } from './ThreadModal'
import '../styles/timeline.css'

interface AggregatedEvent {
  time: Date
  notifications: any[]
  types: Set<string>
  actors: Set<string>
  postUri?: string // For post-specific aggregations
  aggregationType: 'post' | 'follow' | 'mixed' | 'post-burst' | 'user-activity' // Type of aggregation
  earliestTime?: Date // Track the earliest notification in the group
  latestTime?: Date // Track the latest notification in the group
  burstIntensity?: 'low' | 'medium' | 'high' // For post bursts
  postText?: string // Cache the post text for burst events
  primaryActor?: { // For user activity aggregation
    handle: string
    displayName?: string
    avatar?: string
  }
  affectedPosts?: Array<{ // Posts affected by user activity
    uri: string
    text?: string
  }>
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

interface VisualTimelineProps {
  hideTimeLabels?: boolean;
  isInSkyDeck?: boolean;
  isFocused?: boolean;
  onClose?: () => void;
}

export const VisualTimeline: React.FC<VisualTimelineProps> = ({ hideTimeLabels = false, isInSkyDeck = false, isFocused = true, onClose }) => {
  const { agent } = useAuth()
  const containerRef = React.useRef<HTMLDivElement>(null)
  const timelineItemsRef = React.useRef<Map<string, HTMLDivElement>>(new Map())
  const [selectedItemIndex, setSelectedItemIndex] = React.useState<number>(-1)
  const [selectedPostUri, setSelectedPostUri] = React.useState<string | null>(null)
  // Removed expandedItems state - cards are always expanded

  const { data, isLoading } = useQuery({
    queryKey: ['notifications-visual-timeline'],
    queryFn: async () => {
      if (!agent) throw new Error('Not authenticated')
      const response = await agent.listNotifications({ limit: 100 })
      return response.data
    },
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnMount: 'always', // Always fetch fresh data on mount
    refetchInterval: 60 * 1000, // Poll every 60 seconds after initial load
    enabled: !!agent // Only run when agent is available
  })


  // Get notifications from the response
  const notifications = data?.notifications || []

  // Fetch posts for notifications to show richer content
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

    // First pass: Group notifications by user to identify user activity bursts
    const userActivityGroups = new Map<string, any[]>()
    const userActivityTimeWindows = new Map<string, { start: Date, end: Date }>()
    
    sorted.forEach(notification => {
      const userKey = notification.author?.handle || notification.author?.did || 'unknown'
      const notifTime = new Date(notification.indexedAt)
      
      if (!userActivityGroups.has(userKey)) {
        userActivityGroups.set(userKey, [])
        userActivityTimeWindows.set(userKey, { start: notifTime, end: notifTime })
      } else {
        const timeWindow = userActivityTimeWindows.get(userKey)!
        // Check if this notification is within 30 minutes of the previous activity from this user
        if (differenceInMinutes(timeWindow.end, notifTime) <= 30) {
          // Part of the same activity burst
          userActivityGroups.get(userKey)!.push(notification)
          timeWindow.start = notifTime < timeWindow.start ? notifTime : timeWindow.start
          timeWindow.end = notifTime > timeWindow.end ? notifTime : timeWindow.end
        } else {
          // Too far apart, treat as separate activity
          // Process the previous burst if it qualifies
          const userNotifs = userActivityGroups.get(userKey)!
          if (userNotifs.length >= 3) {
            // Create user activity event for previous burst
            const affectedPosts = new Map<string, any>()
            userNotifs.forEach(n => {
              const postUri = (n.reason === 'repost' || n.reason === 'like') && n.reasonSubject 
                ? n.reasonSubject 
                : n.uri
              if (postUri && !affectedPosts.has(postUri)) {
                const post = postMap.get(postUri)
                affectedPosts.set(postUri, {
                  uri: postUri,
                  text: post?.record?.text
                })
              }
            })
            
            events.push({
              time: timeWindow.end,
              notifications: [...userNotifs],
              types: new Set(userNotifs.map(n => n.reason)),
              actors: new Set([userKey]),
              aggregationType: 'user-activity',
              earliestTime: timeWindow.start,
              latestTime: timeWindow.end,
              primaryActor: {
                handle: userNotifs[0].author?.handle || 'unknown',
                displayName: userNotifs[0].author?.displayName,
                avatar: userNotifs[0].author?.avatar
              },
              affectedPosts: Array.from(affectedPosts.values())
            })
          }
          // Start new burst
          userActivityGroups.set(userKey, [notification])
          userActivityTimeWindows.set(userKey, { start: notifTime, end: notifTime })
        }
      }
    })
    
    // Process remaining user activity bursts
    userActivityGroups.forEach((notifications, userKey) => {
      if (notifications.length >= 3) {
        const timeWindow = userActivityTimeWindows.get(userKey)!
        const affectedPosts = new Map<string, any>()
        notifications.forEach(n => {
          const postUri = (n.reason === 'repost' || n.reason === 'like') && n.reasonSubject 
            ? n.reasonSubject 
            : n.uri
          if (postUri && !affectedPosts.has(postUri)) {
            const post = postMap.get(postUri)
            affectedPosts.set(postUri, {
              uri: postUri,
              text: post?.record?.text
            })
          }
        })
        
        events.push({
          time: timeWindow.end,
          notifications: [...notifications],
          types: new Set(notifications.map(n => n.reason)),
          actors: new Set([userKey]),
          aggregationType: 'user-activity',
          earliestTime: timeWindow.start,
          latestTime: timeWindow.end,
          primaryActor: {
            handle: notifications[0].author?.handle || 'unknown',
            displayName: notifications[0].author?.displayName,
            avatar: notifications[0].author?.avatar
          },
          affectedPosts: Array.from(affectedPosts.values())
        })
      }
    })

    // Now handle remaining notifications that aren't part of user activity bursts
    const handledNotifications = new Set<string>()
    events.forEach(event => {
      event.notifications.forEach(n => handledNotifications.add(n.uri))
    })

    // Group remaining notifications by post URI to identify post bursts
    const postGroups = new Map<string, any[]>()
    const followGroups: any[] = []
    const otherNotifications: any[] = []

    sorted.forEach(notification => {
      if (handledNotifications.has(notification.uri)) return
      
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
          actors: new Set(notifications.map(n => n.author?.handle || 'unknown')),
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
            actors: new Set([notification.author?.handle || 'unknown']),
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
        const times = burst.map((n: any) => new Date(n.indexedAt).getTime())
        const latestTime = new Date(Math.max(...times))
        
        events.push({
          time: latestTime,
          notifications: burst,
          types: new Set(['follow']),
          actors: new Set(burst.map((n: any) => n.author?.handle || 'unknown')),
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
          actors: new Set([burst[0].author?.handle || 'unknown']),
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
        actors: new Set([notification.author?.handle || 'unknown']),
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

  const getTimeOfDay = (date: Date) => {
    const hour = date.getHours()
    
    if (hour >= 5 && hour < 9) return 'Early morning'
    if (hour >= 9 && hour < 12) return 'Morning'
    if (hour >= 12 && hour < 14) return 'Noon'
    if (hour >= 14 && hour < 17) return 'Afternoon'
    if (hour >= 17 && hour < 20) return 'Evening'
    if (hour >= 20 && hour < 24) return 'Night'
    return 'Late night'
  }

  const isDayTime = (date: Date) => {
    const hour = date.getHours()
    return hour >= 6 && hour < 18
  }

  // Get a color based on the time of day with smooth transitions
  const getTimeOfDayColor = (date: Date) => {
    const hour = date.getHours()
    const minute = date.getMinutes()
    const timeValue = hour + (minute / 60) // Convert to decimal hours
    
    // Define color stops for different times of day (REVERSED for newest-first display)
    const colorStops = [
      { time: 0, bg: 'rgba(25, 39, 77, 0.15)', border: 'rgba(55, 65, 81, 0.3)', shadow: 'rgba(17, 24, 39, 0.2)' }, // Midnight - deep blue
      { time: 4, bg: 'rgba(99, 102, 241, 0.1)', border: 'rgba(79, 70, 229, 0.25)', shadow: 'rgba(67, 56, 202, 0.15)' }, // Early morning - purple (was evening)
      { time: 6, bg: 'rgba(165, 180, 252, 0.1)', border: 'rgba(129, 140, 248, 0.25)', shadow: 'rgba(99, 102, 241, 0.15)' }, // Dawn - light purple (was dusk)
      { time: 8, bg: 'rgba(251, 207, 232, 0.1)', border: 'rgba(244, 114, 182, 0.25)', shadow: 'rgba(236, 72, 153, 0.15)' }, // Early morning - pink (was sunset)
      { time: 10, bg: 'rgba(254, 215, 170, 0.1)', border: 'rgba(251, 191, 36, 0.25)', shadow: 'rgba(245, 158, 11, 0.15)' }, // Morning - orange (was afternoon)
      { time: 12, bg: 'rgba(254, 240, 138, 0.1)', border: 'rgba(253, 224, 71, 0.3)', shadow: 'rgba(250, 204, 21, 0.2)' }, // Noon - bright yellow
      { time: 15, bg: 'rgba(254, 243, 199, 0.1)', border: 'rgba(252, 211, 77, 0.25)', shadow: 'rgba(251, 191, 36, 0.15)' }, // Afternoon - warm yellow (was morning)
      { time: 17, bg: 'rgba(251, 207, 232, 0.1)', border: 'rgba(249, 168, 212, 0.25)', shadow: 'rgba(236, 72, 153, 0.15)' }, // Sunset - light pink (was early morning)
      { time: 19, bg: 'rgba(236, 72, 153, 0.1)', border: 'rgba(244, 114, 182, 0.25)', shadow: 'rgba(219, 39, 119, 0.15)' }, // Dusk - pink (was dawn)
      { time: 21, bg: 'rgba(49, 46, 129, 0.15)', border: 'rgba(79, 70, 229, 0.25)', shadow: 'rgba(55, 48, 163, 0.2)' }, // Evening - indigo (was early morning)
      { time: 24, bg: 'rgba(25, 39, 77, 0.15)', border: 'rgba(55, 65, 81, 0.3)', shadow: 'rgba(17, 24, 39, 0.2)' } // Back to midnight
    ]
    
    // Find the two color stops we're between
    let prevStop = colorStops[0]
    let nextStop = colorStops[1]
    
    for (let i = 0; i < colorStops.length - 1; i++) {
      if (timeValue >= colorStops[i].time && timeValue < colorStops[i + 1].time) {
        prevStop = colorStops[i]
        nextStop = colorStops[i + 1]
        break
      }
    }
    
    // Calculate interpolation factor
    const factor = (timeValue - prevStop.time) / (nextStop.time - prevStop.time)
    
    // Helper function to interpolate between two rgba values
    const interpolateRgba = (start: string, end: string, factor: number) => {
      // Extract rgba values using regex
      const startMatch = start.match(/rgba?\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/)
      const endMatch = end.match(/rgba?\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/)
      
      if (!startMatch || !endMatch) return start
      
      const r = Math.round(parseInt(startMatch[1]) + (parseInt(endMatch[1]) - parseInt(startMatch[1])) * factor)
      const g = Math.round(parseInt(startMatch[2]) + (parseInt(endMatch[2]) - parseInt(startMatch[2])) * factor)
      const b = Math.round(parseInt(startMatch[3]) + (parseInt(endMatch[3]) - parseInt(startMatch[3])) * factor)
      const a = parseFloat(startMatch[4]) + (parseFloat(endMatch[4]) - parseFloat(startMatch[4])) * factor
      
      return `rgba(${r}, ${g}, ${b}, ${a})`
    }
    
    return {
      backgroundColor: interpolateRgba(prevStop.bg, nextStop.bg, factor),
      borderColor: interpolateRgba(prevStop.border, nextStop.border, factor),
      shadowColor: interpolateRgba(prevStop.shadow, nextStop.shadow, factor)
    }
  }

  const getReasonIcon = (reason: string) => {
    switch (reason) {
      case 'like': return <Heart size={14} style={{ color: 'var(--bsky-text-secondary)' }} />
      case 'repost': return <Repeat2 size={14} style={{ color: 'var(--bsky-text-secondary)' }} />
      case 'follow': return <UserPlus size={14} style={{ color: 'var(--bsky-text-secondary)' }} />
      case 'reply': return <MessageCircle size={14} style={{ color: 'var(--bsky-text-secondary)' }} />
      case 'quote': return <Quote size={14} style={{ color: 'var(--bsky-text-secondary)' }} />
      case 'starterpack-joined': return <UserPlus size={14} style={{ color: 'var(--bsky-text-secondary)' }} />
      case 'verified': return <MessageCircle size={14} style={{ color: 'var(--bsky-text-secondary)' }} />
      case 'unverified': return <MessageCircle size={14} style={{ color: 'var(--bsky-text-secondary)' }} />
      case 'like-via-repost': return <Heart size={14} style={{ color: 'var(--bsky-text-secondary)' }} />
      case 'repost-via-repost': return <Repeat2 size={14} style={{ color: 'var(--bsky-text-secondary)' }} />
      default: return <MessageCircle size={14} style={{ color: 'var(--bsky-text-secondary)' }} />
    }
  }

  // Group events by day - must be before conditional returns
  const eventsByDay = React.useMemo(() => {
    const groups: { [key: string]: { label: string; events: typeof aggregatedEvents } } = {}
    
    aggregatedEvents.forEach(event => {
      const dayLabel = getTimeLabel(event.time)
      if (!groups[dayLabel]) {
        groups[dayLabel] = { label: dayLabel, events: [] }
      }
      groups[dayLabel].events.push(event)
    })
    
    return Object.values(groups)
  }, [aggregatedEvents])

  // Flatten all events for keyboard navigation
  const allEvents = React.useMemo(() => {
    return eventsByDay.flatMap(day => day.events)
  }, [eventsByDay])

  // Generate unique key for each event
  const getEventKey = React.useCallback((event: AggregatedEvent, index: number) => {
    return `${event.time.toISOString()}-${index}`
  }, [])

  // Handle keyboard navigation
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // In SkyDeck mode, check if this column is focused
      if (isInSkyDeck && !isFocused) return
      
      // Only handle keyboard navigation if not in SkyDeck or focus is within the timeline
      if (!isInSkyDeck && !containerRef.current?.contains(document.activeElement)) return

      // Don't interfere with input fields or when modals are open
      if (e.target instanceof HTMLInputElement || 
          e.target instanceof HTMLTextAreaElement ||
          document.body.classList.contains('thread-modal-open') ||
          document.body.classList.contains('conversation-modal-open')) {
        return
      }

      let handled = false
      const currentIndex = selectedItemIndex

      switch (e.key) {
        case 'ArrowDown':
        case 'j': // vim-style down
          e.preventDefault()
          handled = true
          if (currentIndex < allEvents.length - 1) {
            setSelectedItemIndex(currentIndex + 1)
          }
          break
          
        case 'ArrowUp':
        case 'k': // vim-style up
          e.preventDefault()
          handled = true
          if (currentIndex > 0) {
            setSelectedItemIndex(currentIndex - 1)
          } else if (currentIndex === -1 && allEvents.length > 0) {
            // If nothing selected, select last item when going up
            setSelectedItemIndex(allEvents.length - 1)
          }
          break
          
        case 'ArrowLeft':
        case 'h': // vim-style left
          e.preventDefault()
          handled = true
          // Scroll horizontally left
          if (containerRef.current) {
            containerRef.current.scrollBy({ left: -200, behavior: 'smooth' })
          }
          break
          
        case 'ArrowRight':
        case 'l': // vim-style right
          e.preventDefault()
          handled = true
          // Scroll horizontally right
          if (containerRef.current) {
            containerRef.current.scrollBy({ left: 200, behavior: 'smooth' })
          }
          break
          
        case 'Enter':
        case ' ': // Space bar
          e.preventDefault()
          handled = true
          // Open thread viewer for the selected item
          if (currentIndex >= 0 && currentIndex < allEvents.length) {
            const event = allEvents[currentIndex]
            let postUriToOpen: string | null = null
            
            // For post bursts and post aggregations, use the postUri
            if (event.postUri) {
              postUriToOpen = event.postUri
            } else if (event.notifications.length > 0 && event.notifications[0].reason !== 'follow') {
              // For single notifications or other aggregations
              const notification = event.notifications[0]
              postUriToOpen = (notification.reason === 'repost' || notification.reason === 'like') && notification.reasonSubject 
                ? notification.reasonSubject 
                : notification.uri
            }
            
            if (postUriToOpen) {
              setSelectedPostUri(postUriToOpen)
            }
          }
          break
          
        case 'Home':
          e.preventDefault()
          handled = true
          if (allEvents.length > 0) {
            setSelectedItemIndex(0)
          }
          break
          
        case 'End':
          e.preventDefault()
          handled = true
          if (allEvents.length > 0) {
            setSelectedItemIndex(allEvents.length - 1)
          }
          break
          
        case 'PageUp':
          e.preventDefault()
          handled = true
          // Jump up by 5 items
          setSelectedItemIndex(Math.max(0, currentIndex - 5))
          break
          
        case 'PageDown':
          e.preventDefault()
          handled = true
          // Jump down by 5 items
          setSelectedItemIndex(Math.min(allEvents.length - 1, currentIndex + 5))
          break
          
        case 'Escape':
          // Clear selection
          setSelectedItemIndex(-1)
          handled = true
          break
      }

      // Prevent default browser scrolling if we handled the key
      if (handled) {
        e.stopPropagation()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedItemIndex, allEvents, getEventKey, isInSkyDeck, isFocused])

  // Make container focusable for keyboard navigation in SkyDeck
  React.useEffect(() => {
    if (containerRef.current && isInSkyDeck && isFocused) {
      // Focus container when column becomes focused in SkyDeck
      // This ensures keyboard events are captured
      containerRef.current.focus()
    }
  }, [isInSkyDeck, isFocused])

  // Scroll selected item into view
  React.useEffect(() => {
    if (selectedItemIndex >= 0 && selectedItemIndex < allEvents.length) {
      const event = allEvents[selectedItemIndex]
      const eventKey = getEventKey(event, selectedItemIndex)
      const element = timelineItemsRef.current.get(eventKey)
      
      if (element) {
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest'
        })
      }
    }
  }, [selectedItemIndex, allEvents, getEventKey])

  // Make timeline container focusable
  React.useEffect(() => {
    if (containerRef.current && !containerRef.current.hasAttribute('tabindex')) {
      containerRef.current.setAttribute('tabindex', '0')
      containerRef.current.style.outline = 'none'
      
      // Auto-focus in standalone mode or when focused in SkyDeck
      if (!isInSkyDeck || (isInSkyDeck && isFocused)) {
        containerRef.current.focus()
      }
    }
  }, [isInSkyDeck, isFocused])

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

  return (
    <div className="max-w-4xl mx-auto" ref={containerRef} tabIndex={-1} style={{ outline: 'none' }}>
      {/* Header */}
      <div className="sticky top-0 z-40 bsky-glass border-b" style={{ borderColor: 'var(--bsky-border-primary)' }}>
        <div className="px-4 py-3 flex items-center justify-between group">
          <div className="flex items-center gap-2">
            <Clock size={20} style={{ color: 'var(--bsky-primary)' }} />
            <h2 className="text-lg font-semibold" style={{ color: 'var(--bsky-text-primary)' }}>
              Visual Timeline
            </h2>
            <span className="text-xs ml-auto" style={{ color: 'var(--bsky-text-secondary)' }}>
              {selectedItemIndex === -1 ? 'Press ↓ or j to start' : 'Arrow keys/hjkl to navigate'}
            </span>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-all opacity-0 group-hover:opacity-100"
              style={{ color: 'var(--bsky-text-secondary)' }}
              aria-label="Close column"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>
      
      <div className="relative p-4 sm:p-6">
        {/* Timeline line */}
        <div 
          className="absolute left-[1.5rem] sm:left-[6.5rem] top-0 bottom-0 w-0.5"
          style={{ 
            background: 'linear-gradient(to bottom, var(--bsky-border-color) 0%, var(--bsky-border-color) 100%)',
            position: 'relative' 
          }}
        />

        {eventsByDay.map((dayGroup, dayIndex) => (
          <div key={dayGroup.label}>
            {/* Sticky day label */}
            <div 
              className="timeline-day-header -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 mb-3" 
              style={{ 
                position: 'sticky',
                // @ts-ignore - WebKit prefix for sticky positioning
                WebkitPosition: '-webkit-sticky',
                top: '60px', // Position below the main header which is ~60px tall
                zIndex: 30, // Higher than 20 but lower than main header's 40
                backgroundColor: 'var(--bsky-bg-primary)',
                borderBottom: '1px solid var(--bsky-border-color)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                // iOS Safari fixes
                transform: 'translateZ(0)',
                willChange: 'transform'
              }}>
              <div className="flex items-center gap-2">
                <div 
                  className="w-2 h-2 rounded-full"
                  style={{ 
                    backgroundColor: dayGroup.events.length > 0 
                      ? getTimeOfDayColor(dayGroup.events[0].time).borderColor.replace(/[\d.]+\)$/, '1)')
                      : 'var(--bsky-primary)' 
                  }}
                />
                <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--bsky-text-secondary)' }}>
                  {dayGroup.label}
                </h2>
              </div>
            </div>

            {/* Events for this day */}
            {dayGroup.events.map((event, eventIndex) => {
              const previousEvent = eventIndex > 0 ? dayGroup.events[eventIndex - 1] : 
                                   dayIndex > 0 ? eventsByDay[dayIndex - 1].events[eventsByDay[dayIndex - 1].events.length - 1] : null
              const spacingClass = getSpacingClass(event.time, previousEvent?.time)
              
              // Calculate the global index for this event
              let globalIndex = 0
              for (let i = 0; i < dayIndex; i++) {
                globalIndex += eventsByDay[i].events.length
              }
              globalIndex += eventIndex
              
              const eventKey = getEventKey(event, globalIndex)
              const isSelected = selectedItemIndex === globalIndex
              const isExpanded = true // Cards are always expanded

              return (
                <div 
                  key={eventKey} 
                  className={`relative ${spacingClass} timeline-item ${isSelected ? 'timeline-item-selected' : ''}`}
                  ref={(el) => {
                    if (el) {
                      timelineItemsRef.current.set(eventKey, el)
                    } else {
                      timelineItemsRef.current.delete(eventKey)
                    }
                  }}
                >
                  {/* Time and event */}
                  <div className="flex gap-2 sm:gap-4 items-start timeline-event">
                {/* Time - hide text on mobile, show only on desktop */}
                <div className={`${hideTimeLabels ? 'w-3' : 'w-3 sm:w-20'} text-right text-xs sm:text-sm pt-2 timeline-time-label`}>
                  {!hideTimeLabels && (
                    <span className="hidden sm:inline font-medium" style={{ 
                      color: isDayTime(event.time) ? '#d97706' : '#6366f1',
                      opacity: 0.8
                    }}>
                      {getTimeOfDay(event.time)}
                    </span>
                  )}
                </div>

                {/* Timeline dot */}
                <div className="relative flex-shrink-0 px-1 sm:px-0" style={{ paddingTop: '14px' }}>
                  <div 
                    className={`${event.aggregationType === 'post-burst' ? 'w-3 h-3' : 'w-2 h-2'} rounded-full`}
                    style={{ 
                      backgroundColor: getTimeOfDayColor(event.time).borderColor.replace(/[\d.]+\)$/, '1)'), // Use solid color for dot
                      opacity: event.aggregationType === 'post-burst' ? '0.9' : '0.7'
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
                    event.aggregationType === 'post-burst' ? 'timeline-post-burst' : 
                    event.aggregationType === 'user-activity' ? 'timeline-user-activity' : ''
                  } ${isSelected ? 'timeline-focused' : ''}`}
                  style={{ 
                    backgroundColor: getTimeOfDayColor(event.time).backgroundColor,
                    border: `1px solid ${isSelected ? 'var(--bsky-primary)' : getTimeOfDayColor(event.time).borderColor}`,
                    borderRadius: '8px',
                    boxShadow: isSelected 
                      ? `0 0 0 2px var(--bsky-primary), 0 1px 3px ${getTimeOfDayColor(event.time).shadowColor}`
                      : `0 1px 3px ${getTimeOfDayColor(event.time).shadowColor}`,
                    transition: 'all 0.2s ease-out',
                    cursor: 'pointer'
                  }}
                  tabIndex={isSelected ? 0 : -1}
                  aria-selected={isSelected}
                  aria-expanded={isExpanded}
                  role="button"
                  onClick={() => {
                    setSelectedItemIndex(globalIndex)
                    // Open thread viewer for post notifications
                    let postUriToOpen: string | null = null
                    
                    // For post bursts and post aggregations, use the postUri
                    if (event.postUri) {
                      postUriToOpen = event.postUri
                    } else if (event.notifications.length > 0 && event.notifications[0].reason !== 'follow') {
                      // For single notifications or other aggregations
                      const notification = event.notifications[0]
                      postUriToOpen = (notification.reason === 'repost' || notification.reason === 'like') && notification.reasonSubject 
                        ? notification.reasonSubject 
                        : notification.uri
                    }
                    
                    if (postUriToOpen) {
                      setSelectedPostUri(postUriToOpen)
                    }
                  }}
                  onKeyDown={(e) => {
                    // Handle Enter/Space on the element itself
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      // Open thread viewer for post notifications
                      let postUriToOpen: string | null = null
                      
                      // For post bursts and post aggregations, use the postUri
                      if (event.postUri) {
                        postUriToOpen = event.postUri
                      } else if (event.notifications.length > 0 && event.notifications[0].reason !== 'follow') {
                        // For single notifications or other aggregations
                        const notification = event.notifications[0]
                        postUriToOpen = (notification.reason === 'repost' || notification.reason === 'like') && notification.reasonSubject 
                          ? notification.reasonSubject 
                          : notification.uri
                      }
                      
                      if (postUriToOpen) {
                        setSelectedPostUri(postUriToOpen)
                      }
                    }
                  }}
                >
                  {/* Single notification */}
                  {event.notifications.length === 1 ? (
                    <div>
                      <div className="flex items-center gap-3">
                        {/* Removed expand/collapse indicator - cards are always expanded */}
                        <a 
                          href={getProfileUrl(event.notifications[0].author?.handle || 'unknown')}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-shrink-0 hover:opacity-80 transition-opacity"
                        >
                          <img 
                            src={proxifyBskyImage(event.notifications[0].author.avatar)} 
                            alt={event.notifications[0].author?.handle || 'unknown'}
                            className="w-8 h-8 rounded-full"
                          />
                        </a>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            {getReasonIcon(event.notifications[0].reason)}
                            <a 
                              href={getProfileUrl(event.notifications[0].author?.handle || 'unknown')}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium text-sm hover:underline"
                              style={{ color: 'var(--bsky-primary)' }}
                            >
                              {event.notifications[0].author?.displayName || event.notifications[0].author?.handle || 'Unknown'}
                            </a>
                          </div>
                          <div className="text-xs sm:text-sm mt-0.5" style={{ color: 'var(--bsky-text-secondary)' }}>
                            {getActionText(event.notifications[0].reason)}
                          </div>
                        </div>
                      </div>
                      {/* Show post preview for single notifications too */}
                      {event.notifications[0].reason !== 'follow' && isExpanded && (
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
                      {/* Removed expand/collapse indicator - cards are always expanded */}
                      {event.aggregationType === 'user-activity' ? (
                        // Special layout for user activity bursts
                        <div>
                          <div className="flex items-start gap-3 mb-3">
                            <a 
                              href={getProfileUrl(event.primaryActor!.handle)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-shrink-0 hover:opacity-80 transition-opacity"
                            >
                              <img 
                                src={proxifyBskyImage(event.primaryActor!.avatar)} 
                                alt={event.primaryActor!.handle}
                                className="w-10 h-10 rounded-full"
                                style={{ 
                                  border: '1px solid var(--bsky-border-color)'
                                }}
                              />
                            </a>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <a 
                                  href={getProfileUrl(event.primaryActor!.handle)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-bold text-base hover:underline"
                                  style={{ color: 'var(--bsky-primary)' }}
                                >
                                  {event.primaryActor!.displayName || event.primaryActor!.handle}
                                </a>
                                <span className="text-xs" style={{ color: 'var(--bsky-text-tertiary)' }}>
                                  • active
                                </span>
                              </div>
                              <p className="text-sm" style={{ color: 'var(--bsky-text-secondary)' }}>
                                {event.notifications.length} interactions over {
                                  event.earliestTime && event.latestTime ? 
                                  formatDistanceToNow(event.earliestTime, { addSuffix: false }) : 
                                  'time'
                                }
                              </p>
                            </div>
                          </div>
                          
                          {/* Engagement breakdown */}
                          <div className="flex flex-wrap gap-3 mb-3 text-sm" style={{ color: 'var(--bsky-text-secondary)' }}>
                            {event.notifications.filter(n => n.reason === 'like').length > 0 && (
                              <span>{event.notifications.filter(n => n.reason === 'like').length} likes</span>
                            )}
                            {event.notifications.filter(n => n.reason === 'repost').length > 0 && (
                              <span>{event.notifications.filter(n => n.reason === 'repost').length} reposts</span>
                            )}
                            {event.notifications.filter(n => n.reason === 'reply').length > 0 && (
                              <span>{event.notifications.filter(n => n.reason === 'reply').length} replies</span>
                            )}
                            {event.notifications.filter(n => n.reason === 'quote').length > 0 && (
                              <span>{event.notifications.filter(n => n.reason === 'quote').length} quotes</span>
                            )}
                          </div>
                          
                          {/* Affected posts */}
                          {event.affectedPosts && event.affectedPosts.length > 0 && isExpanded && (
                            <div className="space-y-2">
                              <p className="text-xs font-medium" style={{ color: 'var(--bsky-text-tertiary)' }}>
                                Posts they interacted with:
                              </p>
                              <div className="space-y-1.5">
                                {event.affectedPosts.slice(0, 3).map((post, i) => {
                                  // Get the post from postMap to find its author
                                  const fullPost = postMap.get(post.uri)
                                  const postUrl = fullPost ? getPostUrl(post.uri, fullPost.author?.handle) : null
                                  return (
                                    <a 
                                      key={`${post.uri}-${i}`}
                                      href={postUrl || '#'}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="block p-2 rounded text-xs hover:opacity-90 transition-opacity line-clamp-2" 
                                      style={{ 
                                        backgroundColor: 'var(--bsky-bg-tertiary)',
                                        border: '1px solid var(--bsky-border-primary)',
                                        textDecoration: 'none',
                                        color: 'var(--bsky-text-primary)'
                                      }}
                                    >
                                      {post.text || '[Post with no text]'}
                                    </a>
                                  )
                                })}
                                {event.affectedPosts.length > 3 && (
                                  <p className="text-xs" style={{ color: 'var(--bsky-text-tertiary)' }}>
                                    ...and {event.affectedPosts.length - 3} more posts
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : event.aggregationType === 'post-burst' ? (
                        // Special layout for post bursts
                        <div>
                          <div className="flex items-start gap-3 mb-3">
                            <div className="flex-shrink-0">
                              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{
                                backgroundColor: 'var(--bsky-bg-tertiary)',
                                border: '1px solid var(--bsky-border-color)'
                              }}>
                                <MessageCircle size={20} style={{ color: 'var(--bsky-text-secondary)' }} />
                              </div>
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-sm" style={{ color: 'var(--bsky-text-primary)' }}>
                                  Popular Post
                                </span>
                                {event.notifications.length >= 10 && (
                                  <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ 
                                    backgroundColor: 'var(--bsky-bg-tertiary)',
                                    color: 'var(--bsky-text-secondary)',
                                    border: '1px solid var(--bsky-border-color)'
                                  }}>
                                    {event.notifications.length}+ interactions
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
                          <div className="flex flex-wrap gap-3 mb-3">
                            {event.notifications.filter(n => n.reason === 'like').length > 0 && (
                              <div className="flex items-center gap-1 text-sm">
                                <Heart size={16} style={{ color: 'var(--bsky-text-secondary)' }} />
                                <span style={{ color: 'var(--bsky-text-secondary)' }}>{event.notifications.filter(n => n.reason === 'like').length}</span>
                              </div>
                            )}
                            {event.notifications.filter(n => n.reason === 'repost').length > 0 && (
                              <div className="flex items-center gap-1 text-sm">
                                <Repeat2 size={16} style={{ color: 'var(--bsky-text-secondary)' }} />
                                <span style={{ color: 'var(--bsky-text-secondary)' }}>{event.notifications.filter(n => n.reason === 'repost').length}</span>
                              </div>
                            )}
                            {event.notifications.filter(n => n.reason === 'reply').length > 0 && (
                              <div className="flex items-center gap-1 text-sm">
                                <MessageCircle size={16} style={{ color: 'var(--bsky-text-secondary)' }} />
                                <span style={{ color: 'var(--bsky-text-secondary)' }}>{event.notifications.filter(n => n.reason === 'reply').length}</span>
                              </div>
                            )}
                            {event.notifications.filter(n => n.reason === 'quote').length > 0 && (
                              <div className="flex items-center gap-1 text-sm">
                                <Quote size={16} style={{ color: 'var(--bsky-text-secondary)' }} />
                                <span style={{ color: 'var(--bsky-text-secondary)' }}>{event.notifications.filter(n => n.reason === 'quote').length}</span>
                              </div>
                            )}
                          </div>
                          
                          {/* Actor avatars in a grid for bursts */}
                          <div className="mb-3">
                            <div className="flex flex-wrap gap-1">
                              {event.notifications.slice(0, 12).map((notif, i) => (
                                <a
                                  key={`${notif.uri}-${i}`}
                                  href={getProfileUrl(notif.author?.handle || 'unknown')}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="hover:opacity-80 transition-opacity"
                                >
                                  <img 
                                    src={proxifyBskyImage(notif.author.avatar)} 
                                    alt={notif.author?.handle || 'unknown'}
                                    className="w-8 h-8 rounded-full"
                                    title={notif.author?.displayName || notif.author?.handle || 'Unknown'}
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
                                href={getProfileUrl(notif.author?.handle || 'unknown')}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:z-10 hover:scale-110 transition-transform"
                              >
                                <img 
                                  src={proxifyBskyImage(notif.author.avatar)} 
                                  alt={notif.author?.handle || 'unknown'}
                                  className="w-6 h-6 rounded-full border-2"
                                  style={{ borderColor: 'var(--bsky-bg-secondary)' }}
                                  title={notif.author?.displayName || notif.author?.handle || 'Unknown'}
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
                      {(event.aggregationType === 'post' || event.aggregationType === 'post-burst') && isExpanded && (
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
                            const postUrl = getPostUrl(postUri, post.author?.handle)
                            return (
                              <a 
                                href={postUrl || '#'}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block mt-3 p-3 rounded timeline-post-preview hover:opacity-90 transition-opacity" 
                                style={{ 
                                  backgroundColor: 'var(--bsky-bg-tertiary)',
                                  border: '1px solid var(--bsky-border-primary)',
                                  textDecoration: 'none'
                                }}
                              >
                                <p className="text-xs font-medium mb-1 flex items-center gap-1" style={{ color: 'var(--bsky-text-tertiary)' }}>
                                  Your post:
                                  <ExternalLink size={10} />
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
                              </a>
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
                      className="absolute left-[5rem] sm:left-[7.5rem] -top-3 text-xs timeline-gap-indicator"
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
          </div>
        ))}

        {/* End of timeline */}
        <div className="relative mt-8 flex items-center gap-3">
          <div className="w-24" />
          <div 
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: 'var(--bsky-border-color)' }}
          />
          <span className="text-sm" style={{ color: 'var(--bsky-text-secondary)' }}>
            {notifications.length === 0 ? 'No notifications yet' : `${notifications.length} recent notifications`}
          </span>
        </div>
      </div>
      
      {/* Thread Modal */}
      {selectedPostUri && (
        <ThreadModal
          postUri={selectedPostUri}
          onClose={() => setSelectedPostUri(null)}
        />
      )}
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

function getActionCount(notifications: any[], type: string): number {
  return notifications.filter(n => n.reason === type).length
}