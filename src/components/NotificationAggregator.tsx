import React from 'react'
import { Heart, Repeat2, UserPlus, Quote } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import type { Notification } from '@atproto/api/dist/client/types/app/bsky/notification/listNotifications'
import { getNotificationUrl } from '../utils/url-helpers'

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
  const aggregationWindow = 24 * 60 * 60 * 1000 // 24 hours in milliseconds for better grouping
  
  // Group notifications by reason and URI (for post-specific grouping)
  const groups = new Map<string, Notification[]>()
  
  notifications.forEach(notification => {
    // Only aggregate certain types
    if (['like', 'repost', 'follow', 'quote', 'starterpack-joined', 'like-via-repost', 'repost-via-repost'].includes(notification.reason)) {
      // For follows and starterpack-joined, group all together. For likes/reposts/quotes, group by post URI
      const key = ['follow', 'starterpack-joined'].includes(notification.reason)
        ? `${notification.reason}-all`
        : `${notification.reason}-${notification.uri || 'no-uri'}`
      
      if (!groups.has(key)) {
        groups.set(key, [])
      }
      groups.get(key)!.push(notification)
    } else {
      // Don't aggregate replies, mentions, verified, unverified - they're more important individually
      processed.push({ type: 'single', notification })
    }
  })
  
  // Process groups
  groups.forEach((groupNotifications, key) => {
    const [reason] = key.split('-')
    
    // Sort by timestamp (newest first)
    groupNotifications.sort((a, b) => 
      new Date(b.indexedAt).getTime() - new Date(a.indexedAt).getTime()
    )
    
    // Different thresholds for different notification types
    const minAggregationCount = reason === 'follow' ? 2 : 3
    
    // Check if we should aggregate
    if (groupNotifications.length >= minAggregationCount) {
      // Find time clusters
      const clusters: Notification[][] = []
      let currentCluster: Notification[] = [groupNotifications[0]]
      
      for (let i = 1; i < groupNotifications.length; i++) {
        const timeDiff = new Date(groupNotifications[i - 1].indexedAt).getTime() - 
                        new Date(groupNotifications[i].indexedAt).getTime()
        
        if (timeDiff <= aggregationWindow) {
          currentCluster.push(groupNotifications[i])
        } else {
          // Process current cluster
          if (currentCluster.length >= minAggregationCount) {
            clusters.push(currentCluster)
          } else {
            // Add as individual notifications
            currentCluster.forEach(n => processed.push({ type: 'single', notification: n }))
          }
          currentCluster = [groupNotifications[i]]
        }
      }
      
      // Handle last cluster
      if (currentCluster.length >= minAggregationCount) {
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
  postMap?: Map<string, any>
  showTypeLabel?: boolean
  isFetchingMore?: boolean
  fetchedPosts?: number
  totalPosts?: number
  percentageFetched?: number
}

export const AggregatedNotificationItem: React.FC<AggregatedNotificationItemProps> = React.memo(({ 
  item, 
  onExpand, 
  postMap, 
  showTypeLabel = false,
  isFetchingMore = false,
  fetchedPosts = 0,
  totalPosts = 0,
  percentageFetched = 100
}) => {
  const getIcon = () => {
    switch (item.reason) {
      case 'like': return <Heart size={18} style={{ color: 'var(--bsky-like)' }} fill="currentColor" />
      case 'repost': return <Repeat2 size={18} style={{ color: 'var(--bsky-repost)' }} />
      case 'follow': return <UserPlus size={18} style={{ color: 'var(--bsky-follow)' }} />
      case 'quote': return <Quote size={18} style={{ color: 'var(--bsky-quote)' }} />
      case 'starterpack-joined': return <UserPlus size={18} style={{ color: 'var(--bsky-follow)' }} />
      case 'like-via-repost': return <Heart size={18} style={{ color: 'var(--bsky-like)' }} fill="currentColor" />
      case 'repost-via-repost': return <Repeat2 size={18} style={{ color: 'var(--bsky-repost)' }} />
      default: return null
    }
  }
  
  const getNotificationTypeLabel = (reason: string): string => {
    switch (reason) {
      case 'like': return 'Likes'
      case 'repost': return 'Reposts'
      case 'follow': return 'Follows'
      case 'quote': return 'Quotes'
      case 'starterpack-joined': return 'Starterpack Joins'
      case 'like-via-repost': return 'Likes via Repost'
      case 'repost-via-repost': return 'Reposts via Repost'
      default: return reason.charAt(0).toUpperCase() + reason.slice(1) + 's'
    }
  }
  
  const getActionText = () => {
    switch (item.reason) {
      case 'like': 
        return item.count === 1 ? 'liked your post' : `recent likes on your post`
      case 'repost': 
        return item.count === 1 ? 'reposted your post' : `reposts of your post`
      case 'follow': 
        return item.count === 1 ? 'followed you' : 'new followers'
      case 'quote':
        return item.count === 1 ? 'quoted your post' : `quotes of your post`
      case 'starterpack-joined':
        return item.count === 1 ? 'joined via your starterpack' : 'joined via your starterpack'
      case 'like-via-repost':
        return item.count === 1 ? 'liked a repost of your post' : `likes on reposts of your post`
      case 'repost-via-repost':
        return item.count === 1 ? 'reposted a repost of your post' : `reposts of reposts of your post`
      default: 
        return 'interacted with your post'
    }
  }
  
  const displayUsers = item.users.slice(0, 3)
  const remainingCount = item.users.length - displayUsers.length
  const hasUnread = item.notifications.some(n => !n.isRead)
  
  // Get URL for the first notification (most recent)
  const firstNotification = item.notifications[0]
  const post = ['like', 'repost'].includes(firstNotification.reason) && postMap
    ? postMap.get(firstNotification.uri)
    : undefined
  const postAuthorHandle = post?.author?.handle
  const primaryUrl = getNotificationUrl(firstNotification, postAuthorHandle)
  
  const handleClick = (e: React.MouseEvent) => {
    // If clicking with modifier keys (Cmd/Ctrl), open in new tab and don't expand
    if (e.metaKey || e.ctrlKey) {
      window.open(primaryUrl, '_blank')
      e.preventDefault()
    } else {
      // Otherwise, expand the aggregated view
      if (onExpand) onExpand()
    }
  }
  
  return (
    <div
      className={`bsky-notification flex gap-3 py-4 cursor-pointer ${
        hasUnread ? 'bsky-notification-unread' : ''
      }`}
      onClick={handleClick}
      title="Cmd/Ctrl+Click to open in Bluesky"
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
        
        {/* Notification type label */}
        {showTypeLabel && (
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium px-2 py-0.5 rounded-full" 
                  style={{ 
                    backgroundColor: 'var(--bsky-bg-secondary)', 
                    color: 'var(--bsky-text-secondary)',
                    border: '1px solid var(--bsky-border-primary)'
                  }}>
              {getNotificationTypeLabel(item.reason)}
            </span>
          </div>
        )}
        
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
        {item.reason !== 'follow' && (() => {
          // Try to get the post from postMap first for richer content
          // For reposts and likes, use reasonSubject which contains the original post URI
          const notification = item.notifications[0]
          const postUri = (item.reason === 'repost' || item.reason === 'like') && notification.reasonSubject 
            ? notification.reasonSubject 
            : notification.uri
          const post = postMap?.get(postUri)
          
          // Show loading indicator if posts are still being fetched
          if (!post && postMap && postMap.size === 0) {
            return (
              <div className="mt-3 p-4 rounded-lg" style={{ 
                backgroundColor: 'var(--bsky-bg-secondary)', 
                border: '1px solid var(--bsky-border-primary)',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
              }}>
                <div className="flex items-center gap-2">
                  <div className="animate-spin h-4 w-4 border-2 border-gray-300 rounded-full border-t-blue-500"></div>
                  <span className="text-sm" style={{ color: 'var(--bsky-text-secondary)' }}>
                    Loading post content...
                  </span>
                </div>
              </div>
            )
          }
          
          if (post) {
            // We have full post data with author info
            const postText = post.record?.text || ''
            const postAuthor = post.author
            const hasImages = post.embed?.$type === 'app.bsky.embed.images#view' || 
                            (post.embed?.$type === 'app.bsky.embed.recordWithMedia#view' && 
                             post.embed.media?.$type === 'app.bsky.embed.images#view')
            
            // Extract images if present
            let images: Array<{ thumb: string; fullsize: string; alt?: string }> = []
            if (post.embed) {
              if (post.embed.$type === 'app.bsky.embed.images#view' && post.embed.images) {
                images = post.embed.images
              } else if (
                post.embed.$type === 'app.bsky.embed.recordWithMedia#view' && 
                post.embed.media?.$type === 'app.bsky.embed.images#view' &&
                post.embed.media.images
              ) {
                images = post.embed.media.images
              }
            }
            
            return (
              <div className="mt-3 p-4 rounded-lg" style={{ 
                backgroundColor: 'var(--bsky-bg-secondary)', 
                border: '1px solid var(--bsky-border-primary)',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
              }}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium" style={{ color: 'var(--bsky-text-tertiary)' }}>
                    {item.reason === 'quote' ? 'Quoting your post:' : 'Your post:'}
                  </span>
                  {postAuthor?.avatar ? (
                    <img 
                      src={postAuthor.avatar} 
                      alt={postAuthor.handle}
                      className="w-5 h-5 bsky-avatar"
                    />
                  ) : (
                    <div className="w-5 h-5 bsky-avatar flex items-center justify-center text-xs" 
                         style={{ background: 'var(--bsky-bg-tertiary)' }}>
                      {postAuthor?.handle?.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="text-xs font-medium" style={{ color: 'var(--bsky-text-secondary)' }}>
                    {postAuthor?.displayName || postAuthor?.handle || 'You'}
                  </span>
                  {hasImages && (
                    <span className="text-xs flex items-center gap-1" style={{ color: 'var(--bsky-text-tertiary)' }}>
                      · 📷
                    </span>
                  )}
                </div>
                {postText ? (
                  <p className="text-sm" style={{ color: 'var(--bsky-text-primary)', lineHeight: '1.5' }}>
                    {postText}
                  </p>
                ) : (
                  <p className="text-sm italic" style={{ color: 'var(--bsky-text-tertiary)' }}>
                    [Post with no text]
                  </p>
                )}
                
                {/* Display images if present */}
                {images.length > 0 && (
                  <div className="mt-3">
                    <div className={`grid gap-2 ${images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                      {images.slice(0, 4).map((img, idx) => (
                        <img 
                          key={idx}
                          src={img.thumb}
                          alt={img.alt || ''}
                          className="rounded-lg object-cover w-full border" 
                          style={{ 
                            borderColor: 'var(--bsky-border-primary)',
                            height: images.length === 1 ? '160px' : '100px'
                          }}
                          loading="lazy"
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          } else if (item.notifications[0].record && 
                     typeof item.notifications[0].record === 'object' && 
                     'text' in item.notifications[0].record) {
            // Fallback to record text
            return (
              <div className="mt-3 p-4 rounded-lg" style={{ 
                backgroundColor: 'var(--bsky-bg-secondary)',
                border: '1px solid var(--bsky-border-primary)',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
              }}>
                <p className="text-sm" style={{ color: 'var(--bsky-text-primary)', lineHeight: '1.5' }}>
                  {(item.notifications[0].record as { text?: string }).text}
                </p>
              </div>
            )
          } else if (!post && postMap && postMap.size > 0) {
            // Check if we're still fetching more posts
            if (isFetchingMore && fetchedPosts < totalPosts) {
              return (
                <div className="mt-3 p-4 rounded-lg" style={{ 
                  backgroundColor: 'var(--bsky-bg-secondary)', 
                  border: '1px solid var(--bsky-border-primary)',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                }}>
                  <div className="flex items-center gap-2">
                    <div className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-blue-500 rounded-full" />
                    <span className="text-sm" style={{ color: 'var(--bsky-text-secondary)' }}>
                      Loading post content... ({percentageFetched}% loaded)
                    </span>
                  </div>
                </div>
              )
            }
            
            // Post couldn't be loaded or doesn't exist
            return (
              <div className="mt-3 p-4 rounded-lg" style={{ 
                backgroundColor: 'var(--bsky-bg-secondary)', 
                border: '1px solid var(--bsky-border-primary)',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
              }}>
                <p className="text-sm italic" style={{ color: 'var(--bsky-text-tertiary)' }}>
                  [Unable to load post content]
                </p>
              </div>
            )
          }
          
          return null
        })()}
        
        <time className="text-xs mt-1 block" style={{ color: 'var(--bsky-text-tertiary)' }}>
          {formatDistanceToNow(new Date(item.latestTimestamp), { addSuffix: true })}
        </time>
      </div>
    </div>
  )
})