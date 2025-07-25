import React, { useState, useRef, useEffect } from 'react'
import { Heart, Repeat2, UserPlus, MessageCircle, AtSign, Quote, Filter, CheckCheck, Image, Loader } from 'lucide-react'
import { useNotifications, useUnreadCount, useMarkNotificationsRead } from '../hooks/useNotifications'
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
      // Filter for notifications that contain images
      filtered = filtered.filter((n: Notification) => {
        // Check if the notification has a record with embed containing images
        if (n.record && typeof n.record === 'object' && 'embed' in n.record) {
          const embed = (n.record as any).embed
          return embed && (
            embed.$type === 'app.bsky.embed.images' ||
            embed.$type === 'app.bsky.embed.images#view' ||
            (embed.images && Array.isArray(embed.images))
          )
        }
        return false
      })
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
  }, [notifications, filter, showUnreadOnly])

  const getNotificationIcon = (reason: string) => {
    switch (reason) {
      case 'like': return <Heart size={18} className="text-pink-500" />
      case 'repost': return <Repeat2 size={18} className="text-green-500" />
      case 'follow': return <UserPlus size={18} className="text-blue-500" />
      case 'mention': return <AtSign size={18} className="text-purple-500" />
      case 'reply': return <MessageCircle size={18} className="text-sky-500" />
      case 'quote': return <Quote size={18} className="text-indigo-500" />
      default: return null
    }
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-gray-800 rounded-lg p-4 h-20"></div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-900/20 border border-red-500/20 rounded-lg p-4 text-red-400">
          Failed to load notifications
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header with filters */}
      <div className="sticky top-0 bg-gray-900 border-b border-gray-800 p-4 z-10">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold">
            All Notifications 
            {unreadCount && unreadCount > 0 && (
              <span className="ml-2 text-sm font-normal text-gray-400">
                ({unreadCount} unread)
              </span>
            )}
            {notifications.length > 0 && (
              <span className="ml-2 text-sm font-normal text-gray-500">
                · {notifications.length} loaded
              </span>
            )}
          </h1>
          <div className="flex items-center gap-2">
            {unreadCount && unreadCount > 0 && (
              <button
                onClick={() => markAllAsRead()}
                disabled={isMarkingAsRead}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
              >
                <CheckCheck size={16} />
                Mark all read
              </button>
            )}
            <button
              onClick={() => setShowUnreadOnly(!showUnreadOnly)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                showUnreadOnly 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              Unread Only
            </button>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2">
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
      <div className="divide-y divide-gray-800">
        {filteredNotifications.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            No notifications to show
          </div>
        ) : (
          filteredNotifications.map((notification: Notification) => (
            <div
              key={`${notification.uri}-${notification.indexedAt}`}
              className={`flex gap-3 p-4 hover:bg-gray-800/50 transition-colors cursor-pointer ${
                !notification.isRead ? 'bg-blue-900/10' : ''
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
                      className="w-10 h-10 rounded-full"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
                      {notification.author.handle.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm">
                    <span className="font-medium">
                      {notification.author.displayName || notification.author.handle}
                    </span>
                    {' '}
                    <span className="text-gray-400">
                      {getNotificationText(notification.reason)}
                    </span>
                  </p>
                  {notification.record && typeof notification.record === 'object' && 'text' in notification.record && (
                    <p className="text-gray-400 text-sm mt-1 line-clamp-2">
                      {(notification.record as { text?: string }).text}
                    </p>
                  )}
                  {/* Display images if present */}
                  {notification.record && typeof notification.record === 'object' && 'embed' in notification.record && (
                    <div className="mt-2">
                      {(() => {
                        const embed = (notification.record as any).embed
                        if (embed && embed.images && Array.isArray(embed.images)) {
                          return (
                            <div className="grid grid-cols-2 gap-2 max-w-sm">
                              {embed.images.slice(0, 4).map((img: any, idx: number) => (
                                <img 
                                  key={idx}
                                  src={img.thumb || img.fullsize}
                                  alt={img.alt || ''}
                                  className="rounded-lg object-cover w-full h-24"
                                />
                              ))}
                            </div>
                          )
                        }
                        return null
                      })()}
                    </div>
                  )}
                  <time className="text-gray-500 text-xs mt-1 block">
                    {formatDistanceToNow(new Date(notification.indexedAt), { addSuffix: true })}
                  </time>
                </div>
              </div>
            </div>
          ))
        )}
        
        {/* Loading more indicator */}
        {(hasNextPage || isFetchingNextPage) && (
          <div ref={loadMoreRef} className="p-6 flex justify-center">
            {isFetchingNextPage ? (
              <div className="flex items-center gap-2 text-gray-400">
                <Loader className="animate-spin" size={20} />
                <span>Loading more notifications...</span>
              </div>
            ) : (
              <div className="text-gray-500 text-sm">
                Scroll to load more
              </div>
            )}
          </div>
        )}
        
        {/* End of notifications message */}
        {!hasNextPage && notifications.length > 0 && (
          <div className="p-6 text-center text-gray-500 text-sm">
            {notifications.length >= 1000 
              ? `Showing maximum of 1,000 notifications`
              : `No more notifications from the last 14 days`}
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
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
        active 
          ? 'bg-blue-600 text-white' 
          : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
      }`}
    >
      {icon}
      {label}
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