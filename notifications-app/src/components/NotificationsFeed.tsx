import React, { useState, useRef, useEffect } from 'react'
import { Heart, Repeat2, UserPlus, MessageCircle, AtSign, Quote, Filter, CheckCheck, Image, Loader } from 'lucide-react'
import { useNotifications, useUnreadCount, useMarkNotificationsRead } from '../hooks/useNotifications'
import { useNotificationPosts, postHasImages } from '../hooks/useNotificationPosts'
import { formatDistanceToNow } from 'date-fns'
import type { Notification } from '@atproto/api/dist/client/types/app/bsky/notification/listNotifications'

type NotificationFilter = 'all' | 'likes' | 'reposts' | 'follows' | 'mentions' | 'replies' | 'images'

export const NotificationsFeed: React.FC = () => {
  const [filter, setFilter] = useState<NotificationFilter>('all')
  const [showUnreadOnly, setShowUnreadOnly] = useState(false)
  const loadMoreRef = useRef<HTMLDivElement>(null)
  
  const { 
    data, 
    isLoading, 
    error, 
    fetchNextPage, 
    hasNextPage, 
    isFetchingNextPage 
  } = useNotifications()
  const { data: unreadCount } = useUnreadCount()
  const { mutate: markAllAsRead, isPending: isMarkingAsRead } = useMarkNotificationsRead()
  
  const notifications = React.useMemo(() => {
    if (!data?.pages) return []
    return data.pages.flatMap((page: any) => page.notifications)
  }, [data])

  // Fetch posts for notifications that might have images
  // We always fetch posts to show images in all views
  const { data: posts } = useNotificationPosts(notifications)

  // Set up intersection observer to load more notifications
  useEffect(() => {
    if (!loadMoreRef.current || !hasNextPage || isFetchingNextPage) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          fetchNextPage()
        }
      },
      { threshold: 0.1 }
    )

    observer.observe(loadMoreRef.current)

    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  // Automatically load more notifications on first load
  useEffect(() => {
    if (data?.pages && data.pages.length === 1 && hasNextPage && !isFetchingNextPage) {
      // Load at least a few pages automatically
      const loadInitialPages = async () => {
        for (let i = 0; i < 3 && hasNextPage; i++) {
          await fetchNextPage()
        }
      }
      loadInitialPages()
    }
  }, [data?.pages?.length])

  const filteredNotifications = React.useMemo(() => {
    if (!notifications) return []
    
    let filtered = notifications

    if (filter === 'images') {
      // Filter notifications that have posts with images
      if (posts && posts.length > 0) {
        const postsWithImages = new Set(
          posts.filter(postHasImages).map(post => post.uri)
        )
        filtered = filtered.filter((n: Notification) => 
          ['like', 'repost', 'reply', 'quote'].includes(n.reason) && 
          postsWithImages.has(n.uri)
        )
      } else {
        // While posts are loading, show empty
        filtered = []
      }
    } else if (filter !== 'all') {
      const filterMap: Record<Exclude<NotificationFilter, 'all' | 'images'>, string[]> = {
        likes: ['like'],
        reposts: ['repost'],
        follows: ['follow'],
        mentions: ['mention'],
        replies: ['reply']
      }
      filtered = filtered.filter((n: Notification) => filterMap[filter as Exclude<NotificationFilter, 'all' | 'images'>].includes(n.reason))
    }

    if (showUnreadOnly) {
      filtered = filtered.filter((n: Notification) => !n.isRead)
    }

    return filtered
  }, [notifications, filter, showUnreadOnly, posts])

  // Create a map for quick post lookup
  const postMap = React.useMemo(() => {
    if (!posts) return new Map()
    return new Map(posts.map(post => [post.uri, post]))
  }, [posts])

  const getNotificationIcon = (reason: string) => {
    switch (reason) {
      case 'like': return <Heart size={18} style={{ color: 'var(--bsky-like)' }} fill="currentColor" />
      case 'repost': return <Repeat2 size={18} style={{ color: 'var(--bsky-repost)' }} />
      case 'follow': return <UserPlus size={18} style={{ color: 'var(--bsky-follow)' }} />
      case 'mention': return <AtSign size={18} style={{ color: 'var(--bsky-mention)' }} />
      case 'reply': return <MessageCircle size={18} style={{ color: 'var(--bsky-reply)' }} />
      case 'quote': return <Quote size={18} style={{ color: 'var(--bsky-quote)' }} />
      default: return null
    }
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bsky-card p-4 h-20 bsky-loading"></div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bsky-card p-4" style={{ borderColor: 'var(--bsky-error)', backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
          <p style={{ color: 'var(--bsky-error)' }}>Failed to load notifications</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto bsky-font">
      {/* Header with filters */}
      <div className="sticky top-0 bsky-glass p-4 z-10" style={{ borderBottom: '1px solid var(--bsky-border-primary)' }}>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold bsky-gradient-text">
            Notifications
            {unreadCount && unreadCount > 0 && (
              <span className="ml-2 text-sm font-normal" style={{ color: 'var(--bsky-text-secondary)' }}>
                {unreadCount} new
              </span>
            )}
            {notifications.length > 0 && (
              <span className="ml-2 text-xs font-normal" style={{ color: 'var(--bsky-text-tertiary)' }}>
                · {notifications.length} total
              </span>
            )}
          </h1>
          <div className="flex items-center gap-2">
            {unreadCount && unreadCount > 0 && (
              <button
                onClick={() => markAllAsRead()}
                disabled={isMarkingAsRead}
                className="bsky-button-primary flex items-center gap-1.5 text-sm disabled:opacity-50"
              >
                <CheckCheck size={16} />
                Mark all read
              </button>
            )}
            <button
              onClick={() => setShowUnreadOnly(!showUnreadOnly)}
              className={showUnreadOnly ? 'bsky-button-primary text-sm' : 'bsky-button-secondary text-sm'}
            >
              {showUnreadOnly ? '✓ ' : ''}Unread Only
            </button>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 overflow-x-auto mt-4 border-b" style={{ borderColor: 'var(--bsky-border-primary)' }}>
          <FilterTab
            active={filter === 'all'}
            onClick={() => setFilter('all')}
            icon={<Filter size={16} />}
            label="All"
          />
          <FilterTab
            active={filter === 'likes'}
            onClick={() => setFilter('likes')}
            icon={<Heart size={16} />}
            label="Likes"
          />
          <FilterTab
            active={filter === 'reposts'}
            onClick={() => setFilter('reposts')}
            icon={<Repeat2 size={16} />}
            label="Reposts"
          />
          <FilterTab
            active={filter === 'follows'}
            onClick={() => setFilter('follows')}
            icon={<UserPlus size={16} />}
            label="Follows"
          />
          <FilterTab
            active={filter === 'mentions'}
            onClick={() => setFilter('mentions')}
            icon={<AtSign size={16} />}
            label="Mentions"
          />
          <FilterTab
            active={filter === 'replies'}
            onClick={() => setFilter('replies')}
            icon={<MessageCircle size={16} />}
            label="Replies"
          />
          <FilterTab
            active={filter === 'images'}
            onClick={() => setFilter('images')}
            icon={<Image size={16} />}
            label="Images"
          />
        </div>
      </div>

      {/* Notifications list */}
      <div>
        {filteredNotifications.length === 0 ? (
          <div className="p-12 text-center" style={{ color: 'var(--bsky-text-tertiary)' }}>
            <div className="text-5xl mb-4 opacity-20">📭</div>
            <p className="text-lg">No notifications to show</p>
            <p className="text-sm mt-2">Check back later for updates</p>
          </div>
        ) : (
          filteredNotifications.map((notification: Notification) => (
            <div
              key={`${notification.uri}-${notification.indexedAt}`}
              className={`bsky-notification flex gap-3 p-4 cursor-pointer ${
                !notification.isRead ? 'bsky-notification-unread' : ''
              }`}
            >
              <div className="flex-shrink-0 pt-1">
                {getNotificationIcon(notification.reason)}
              </div>
              
              <div className="flex gap-3 flex-1">
                <div className="flex-shrink-0">
                  {notification.author.avatar ? (
                    <img 
                      src={notification.author.avatar} 
                      alt={notification.author.handle}
                      className="w-10 h-10 bsky-avatar"
                    />
                  ) : (
                    <div className="w-10 h-10 bsky-avatar flex items-center justify-center" style={{ background: 'var(--bsky-bg-tertiary)' }}>
                      <span className="text-sm font-semibold">{notification.author.handle.charAt(0).toUpperCase()}</span>
                    </div>
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm">
                    <span className="font-semibold" style={{ color: 'var(--bsky-text-primary)' }}>
                      {notification.author.displayName || notification.author.handle}
                    </span>
                    {' '}
                    <span style={{ color: 'var(--bsky-text-secondary)' }}>
                      {getNotificationText(notification.reason)}
                    </span>
                  </p>
                  {notification.record && typeof notification.record === 'object' && 'text' in notification.record && (
                    <p className="text-sm mt-1 line-clamp-2" style={{ color: 'var(--bsky-text-secondary)' }}>
                      {(notification.record as { text?: string }).text}
                    </p>
                  )}
                  {/* Display images if present */}
                  {(() => {
                    // Get the post for this notification if it's about a post
                    const post = ['like', 'repost', 'reply', 'quote'].includes(notification.reason) 
                      ? postMap.get(notification.uri) 
                      : undefined
                    
                    if (!post?.embed) return null
                    
                    let images: Array<{ thumb: string; fullsize: string; alt?: string }> = []
                    
                    // Extract images from different embed types
                    if (post.embed.$type === 'app.bsky.embed.images#view' && post.embed.images) {
                      images = post.embed.images
                    } else if (
                      post.embed.$type === 'app.bsky.embed.recordWithMedia#view' && 
                      post.embed.media?.$type === 'app.bsky.embed.images#view' &&
                      post.embed.media.images
                    ) {
                      images = post.embed.media.images
                    }
                    
                    if (images.length === 0) return null
                    
                    return (
                      <div className="mt-2">
                        <div className="grid grid-cols-2 gap-2 max-w-sm">
                          {images.slice(0, 4).map((img, idx) => (
                            <img 
                              key={idx}
                              src={img.thumb}
                              alt={img.alt || ''}
                              className="rounded-lg object-cover w-full h-24 border" 
                              style={{ borderColor: 'var(--bsky-border-primary)' }}
                              loading="lazy"
                            />
                          ))}
                        </div>
                      </div>
                    )
                  })()}
                  <time className="text-xs mt-1 block" style={{ color: 'var(--bsky-text-tertiary)' }}>
                    {formatDistanceToNow(new Date(notification.indexedAt), { addSuffix: true })}
                  </time>
                </div>
              </div>
            </div>
          ))
        )}
        
        {/* Loading more indicator */}
        {(hasNextPage || isFetchingNextPage) && (
          <div ref={loadMoreRef} className="p-8 flex justify-center">
            {isFetchingNextPage ? (
              <div className="flex items-center gap-2" style={{ color: 'var(--bsky-text-secondary)' }}>
                <Loader className="animate-spin" size={20} style={{ color: 'var(--bsky-primary)' }} />
                <span className="text-sm">Loading more...</span>
              </div>
            ) : (
              <div className="text-sm" style={{ color: 'var(--bsky-text-tertiary)' }}>
                <div className="animate-pulse">↓ Scroll for more</div>
              </div>
            )}
          </div>
        )}
        
        {/* End of notifications message */}
        {!hasNextPage && notifications.length > 0 && (
          <div className="p-8 text-center">
            <div className="bsky-badge mb-2">
              {notifications.length >= 1000 
                ? `1,000 notifications max`
                : `End of notifications`}
            </div>
            <p className="text-xs" style={{ color: 'var(--bsky-text-tertiary)' }}>
              {notifications.length >= 1000 
                ? 'Showing the most recent 1,000 notifications'
                : 'No more notifications from the last 14 days'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

interface FilterTabProps {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}

const FilterTab: React.FC<FilterTabProps> = ({ active, onClick, icon, label }) => {
  return (
    <button
      onClick={onClick}
      className={`bsky-tab flex items-center gap-1.5 ${active ? 'bsky-tab-active' : ''}`}
    >
      <span style={{ opacity: active ? 1 : 0.7 }}>{icon}</span>
      <span>{label}</span>
    </button>
  )
}

function getNotificationText(reason: string): string {
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