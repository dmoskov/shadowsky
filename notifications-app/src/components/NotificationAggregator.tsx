import React from 'react'
import { Heart, Repeat2, UserPlus } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import type { Notification } from '@atproto/api/dist/client/types/app/bsky/notification/listNotifications'

interface AggregatedNotification {
  type: 'aggregated'
  reason: string
  count: number
  users: Array<{
    did: string
    handle: string
    displayName?: string
    avatar?: string
  }>
  latestTimestamp: string
  notifications: Notification[]
}

interface SingleNotification {
  type: 'single'
  notification: Notification
}

type ProcessedNotification = AggregatedNotification | SingleNotification

export function aggregateNotifications(notifications: Notification[]): ProcessedNotification[] {
  const processed: ProcessedNotification[] = []
  const aggregationWindow = 4 * 60 * 60 * 1000 // 4 hours in milliseconds
  
  // Group notifications by reason and time window
  const groups = new Map<string, Notification[]>()
  
  notifications.forEach(notification => {
    // Only aggregate certain types
    if (['like', 'repost', 'follow'].includes(notification.reason)) {
      const key = `${notification.reason}-${notification.uri || 'no-uri'}`
      if (!groups.has(key)) {
        groups.set(key, [])
      }
      groups.get(key)!.push(notification)
    } else {
      // Don't aggregate replies, mentions, quotes - they're more important individually
      processed.push({ type: 'single', notification })
    }
  })
  
  // Process groups
  groups.forEach((groupNotifications, key) => {
    const [reason] = key.split('-')
    
    // Sort by timestamp
    groupNotifications.sort((a, b) => 
      new Date(b.indexedAt).getTime() - new Date(a.indexedAt).getTime()
    )
    
    // Check if we should aggregate
    if (groupNotifications.length >= 3) {
      // Find time clusters
      const clusters: Notification[][] = []
      let currentCluster: Notification[] = [groupNotifications[0]]
      
      for (let i = 1; i < groupNotifications.length; i++) {
        const timeDiff = new Date(groupNotifications[i - 1].indexedAt).getTime() - 
                        new Date(groupNotifications[i].indexedAt).getTime()
        
        if (timeDiff <= aggregationWindow) {
          currentCluster.push(groupNotifications[i])
        } else {
          if (currentCluster.length >= 3) {
            clusters.push(currentCluster)
          } else {
            // Add as individual notifications
            currentCluster.forEach(n => processed.push({ type: 'single', notification: n }))
          }
          currentCluster = [groupNotifications[i]]
        }
      }
      
      // Handle last cluster
      if (currentCluster.length >= 3) {
        clusters.push(currentCluster)
      } else {
        currentCluster.forEach(n => processed.push({ type: 'single', notification: n }))
      }
      
      // Create aggregated notifications for clusters
      clusters.forEach(cluster => {
        const uniqueUsers = new Map<string, typeof cluster[0]['author']>()
        cluster.forEach(n => {
          uniqueUsers.set(n.author.did, n.author)
        })
        
        const aggregated: AggregatedNotification = {
          type: 'aggregated',
          reason,
          count: cluster.length,
          users: Array.from(uniqueUsers.values()).map(author => ({
            did: author.did,
            handle: author.handle,
            displayName: author.displayName,
            avatar: author.avatar
          })),
          latestTimestamp: cluster[0].indexedAt,
          notifications: cluster
        }
        
        processed.push(aggregated)
      })
    } else {
      // Too few to aggregate
      groupNotifications.forEach(n => processed.push({ type: 'single', notification: n }))
    }
  })
  
  // Sort all processed notifications by latest timestamp
  processed.sort((a, b) => {
    const timeA = a.type === 'single' 
      ? new Date(a.notification.indexedAt).getTime()
      : new Date(a.latestTimestamp).getTime()
    const timeB = b.type === 'single'
      ? new Date(b.notification.indexedAt).getTime()
      : new Date(b.latestTimestamp).getTime()
    return timeB - timeA
  })
  
  return processed
}

interface AggregatedNotificationItemProps {
  item: AggregatedNotification
  onExpand?: () => void
}

export const AggregatedNotificationItem: React.FC<AggregatedNotificationItemProps> = ({ item, onExpand }) => {
  const getIcon = () => {
    switch (item.reason) {
      case 'like': return <Heart size={18} style={{ color: 'var(--bsky-like)' }} fill="currentColor" />
      case 'repost': return <Repeat2 size={18} style={{ color: 'var(--bsky-repost)' }} />
      case 'follow': return <UserPlus size={18} style={{ color: 'var(--bsky-follow)' }} />
      default: return null
    }
  }
  
  const getActionText = () => {
    switch (item.reason) {
      case 'like': return 'liked your post'
      case 'repost': return 'reposted your post'
      case 'follow': return item.count === 1 ? 'followed you' : 'new followers'
      default: return 'interacted with your post'
    }
  }
  
  const displayUsers = item.users.slice(0, 3)
  const remainingCount = item.users.length - displayUsers.length
  const hasUnread = item.notifications.some(n => !n.isRead)
  
  return (
    <div
      className={`bsky-notification flex gap-3 p-4 cursor-pointer ${
        hasUnread ? 'bsky-notification-unread' : ''
      }`}
      onClick={onExpand}
    >
      <div className="flex-shrink-0 pt-1">
        {getIcon()}
      </div>
      
      <div className="flex-1">
        {/* Avatar stack */}
        <div className="flex items-center gap-2 mb-2">
          <div className="flex -space-x-2">
            {displayUsers.map((user, idx) => (
              <div key={user.did} style={{ zIndex: displayUsers.length - idx }}>
                {user.avatar ? (
                  <img 
                    src={user.avatar} 
                    alt={user.handle}
                    className="w-8 h-8 bsky-avatar border-2"
                    style={{ borderColor: 'var(--bsky-bg-primary)' }}
                  />
                ) : (
                  <div 
                    className="w-8 h-8 bsky-avatar border-2 flex items-center justify-center" 
                    style={{ 
                      background: 'var(--bsky-bg-tertiary)',
                      borderColor: 'var(--bsky-bg-primary)'
                    }}
                  >
                    <span className="text-xs font-semibold">{user.handle.charAt(0).toUpperCase()}</span>
                  </div>
                )}
              </div>
            ))}
            {remainingCount > 0 && (
              <div 
                className="w-8 h-8 bsky-avatar border-2 flex items-center justify-center"
                style={{ 
                  background: 'var(--bsky-bg-secondary)',
                  borderColor: 'var(--bsky-bg-primary)',
                  zIndex: 0
                }}
              >
                <span className="text-xs font-semibold">+{remainingCount}</span>
              </div>
            )}
          </div>
          
          {hasUnread && (
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: 'var(--bsky-primary)' }}></div>
          )}
        </div>
        
        {/* Aggregated text */}
        <p className="text-sm">
          <span className="font-bold" style={{ color: 'var(--bsky-text-primary)' }}>
            {item.count} {getActionText()}
          </span>
        </p>
        
        {/* User names preview */}
        <p className="text-xs mt-1" style={{ color: 'var(--bsky-text-secondary)' }}>
          {displayUsers.map((user, idx) => (
            <span key={user.did}>
              {user.displayName || user.handle}
              {idx < displayUsers.length - 1 && ', '}
            </span>
          ))}
          {remainingCount > 0 && ` and ${remainingCount} others`}
        </p>
        
        {/* Post preview if applicable */}
        {item.reason !== 'follow' && item.notifications[0].record && 
         typeof item.notifications[0].record === 'object' && 'text' in item.notifications[0].record && (
          <p className="text-sm mt-2 line-clamp-2" style={{ color: 'var(--bsky-text-secondary)' }}>
            {(item.notifications[0].record as { text?: string }).text}
          </p>
        )}
        
        <time className="text-xs mt-1 block" style={{ color: 'var(--bsky-text-tertiary)' }}>
          {formatDistanceToNow(new Date(item.latestTimestamp), { addSuffix: true })}
        </time>
      </div>
    </div>
  )
}