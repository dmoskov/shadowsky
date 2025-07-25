import type { Notification } from '@atproto/api/dist/client/types/app/bsky/notification/listNotifications'

// Notification aggregation types and utilities
export interface AggregatedNotification {
  type: 'aggregated'
  reason: string
  authors: Array<{
    handle: string
    displayName?: string
    avatar?: string
  }>
  count: number
  latestTimestamp: string
  postUri?: string
  postText?: string
  notifications: Notification[]
}

export interface SingleNotification {
  type: 'single'
  notification: Notification
}

export type ProcessedNotification = AggregatedNotification | SingleNotification

export function aggregateNotifications(notifications: Notification[]): ProcessedNotification[] {
  const result: ProcessedNotification[] = []
  const aggregationMap = new Map<string, AggregatedNotification>()
  
  // Time window for aggregation (5 minutes)
  const TIME_WINDOW = 5 * 60 * 1000
  
  for (const notification of notifications) {
    const shouldAggregate = ['like', 'repost', 'follow', 'quote'].includes(notification.reason)
    
    if (!shouldAggregate) {
      // Don't aggregate mentions and replies
      result.push({ type: 'single', notification })
      continue
    }
    
    // Create aggregation key based on reason and post URI (for likes/reposts/quotes)
    const aggregationKey = notification.reason === 'follow' 
      ? 'follow'
      : `${notification.reason}-${notification.uri}`
    
    const existing = aggregationMap.get(aggregationKey)
    
    if (existing) {
      // Check if within time window
      const timeDiff = new Date(existing.latestTimestamp).getTime() - new Date(notification.indexedAt).getTime()
      
      if (Math.abs(timeDiff) <= TIME_WINDOW) {
        // Add to existing aggregation
        existing.authors.push({
          handle: notification.author.handle,
          displayName: notification.author.displayName,
          avatar: notification.author.avatar
        })
        existing.count++
        existing.notifications.push(notification)
        
        // Update latest timestamp
        if (new Date(notification.indexedAt) > new Date(existing.latestTimestamp)) {
          existing.latestTimestamp = notification.indexedAt
        }
        continue
      }
    }
    
    // Create new aggregation
    const aggregated: AggregatedNotification = {
      type: 'aggregated',
      reason: notification.reason,
      authors: [{
        handle: notification.author.handle,
        displayName: notification.author.displayName,
        avatar: notification.author.avatar
      }],
      count: 1,
      latestTimestamp: notification.indexedAt,
      postUri: notification.uri,
      postText: notification.record && typeof notification.record === 'object' && 'text' in notification.record
        ? (notification.record as { text?: string }).text
        : undefined,
      notifications: [notification]
    }
    
    aggregationMap.set(aggregationKey, aggregated)
  }
  
  // Convert aggregations to result array
  for (const [key, aggregation] of aggregationMap) {
    if (aggregation.count === 1) {
      // Single notification, don't aggregate
      result.push({ type: 'single', notification: aggregation.notifications[0] })
    } else {
      // Multiple notifications, keep aggregated
      result.push(aggregation)
    }
  }
  
  // Sort by latest timestamp
  result.sort((a, b) => {
    const timeA = a.type === 'aggregated' ? a.latestTimestamp : a.notification.indexedAt
    const timeB = b.type === 'aggregated' ? b.latestTimestamp : b.notification.indexedAt
    return new Date(timeB).getTime() - new Date(timeA).getTime()
  })
  
  return result
}

export function getAggregatedText(aggregation: AggregatedNotification): string {
  const { reason, count, authors } = aggregation
  
  // Get display names for the first few authors
  const authorNames = authors.slice(0, 3).map(a => a.displayName || a.handle)
  
  let text = ''
  
  if (count === 1) {
    text = `${authorNames[0]} `
  } else if (count === 2) {
    text = `${authorNames[0]} and ${authorNames[1]} `
  } else if (count === 3) {
    text = `${authorNames[0]}, ${authorNames[1]}, and ${authorNames[2]} `
  } else {
    const othersCount = count - 2
    text = `${authorNames[0]}, ${authorNames[1]}, and ${othersCount} others `
  }
  
  switch (reason) {
    case 'like':
      text += count === 1 ? 'liked your post' : 'liked your post'
      break
    case 'repost':
      text += count === 1 ? 'reposted your post' : 'reposted your post'
      break
    case 'follow':
      text += count === 1 ? 'followed you' : 'followed you'
      break
    case 'quote':
      text += count === 1 ? 'quoted your post' : 'quoted your post'
      break
    default:
      text += 'interacted with your post'
  }
  
  return text
}