import React, { useState, useRef, useEffect } from 'react'
import { Heart, Repeat2, UserPlus, MessageCircle, AtSign, Quote, Filter, CheckCheck, Image, Loader, ChevronUp, Crown, Settings, Database, Users } from 'lucide-react'
import { useNotifications, useUnreadCount, useMarkNotificationsRead } from '../hooks/useNotifications'
import { useNotificationPosts, postHasImages } from '../hooks/useNotificationPosts'
import { useFollowing } from '../hooks/useFollowing'
import { formatDistanceToNow } from 'date-fns'
import type { Notification } from '@atproto/api/dist/client/types/app/bsky/notification/listNotifications'
import { aggregateNotifications, AggregatedNotificationItem } from './NotificationAggregator'
import { TopAccountsView } from './TopAccountsView'
import { getNotificationUrl } from '../utils/url-helpers'
import { useLocation } from 'react-router-dom'
import { NotificationCache } from '../utils/notificationCache'
import { debug } from '@bsky/shared'
import { useNotificationTracking, useFeatureTracking, useInteractionTracking } from '../hooks/useAnalytics'

type NotificationFilter = 'all' | 'likes' | 'reposts' | 'follows' | 'mentions' | 'replies' | 'quotes' | 'images' | 'top-accounts' | 'from-following'

export const NotificationsFeed: React.FC = () => {
  const location = useLocation()
  const searchParams = new URLSearchParams(location.search)
  const showTopAccounts = searchParams.get('top') === '1'
  const debugMode = searchParams.has('debug')
  
  const [filter, setFilter] = useState<NotificationFilter>('all')
  const [showUnreadOnly, setShowUnreadOnly] = useState(false)
  const [expandedAggregations, setExpandedAggregations] = useState<Set<string>>(new Set())
  const [minFollowerCount, setMinFollowerCount] = useState(10000)
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [isFromCache, setIsFromCache] = useState(false)
  const loadMoreRef = useRef<HTMLDivElement>(null)
  
  // Analytics hooks
  const { trackNotificationView, trackNotificationInteraction } = useNotificationTracking()
  const { trackFeatureAction } = useFeatureTracking('notifications_feed')
  const { trackClick } = useInteractionTracking()
  
  // Wrap setFilter to track analytics
  const handleFilterChange = (newFilter: NotificationFilter) => {
    setFilter(newFilter)
    trackFeatureAction('filter_changed', { filter: newFilter })
  }
  
  // Reset filter if top accounts is hidden but was selected
  useEffect(() => {
    if (!showTopAccounts && filter === 'top-accounts') {
      setFilter('all')
    }
  }, [showTopAccounts, filter])
  
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
  const { data: followingSet, isLoading: isLoadingFollowing } = useFollowing()
  
  const notifications = React.useMemo(() => {
    const timestamp = new Date().toLocaleTimeString()
    if (!data?.pages) {
      debug.log(`📊 [${timestamp}] NotificationsFeed: No data pages available`)
      return []
    }
    const allNotifications = data.pages.flatMap((page: any) => page.notifications)
    debug.log(`📊 [${timestamp}] NotificationsFeed: Computed ${allNotifications.length} notifications from ${data.pages.length} pages`)
    return allNotifications
  }, [data])

  // Debug effect to track data changes
  useEffect(() => {
    const timestamp = new Date().toLocaleTimeString()
    debug.log(`🔍 [${timestamp}] NotificationsFeed render state:`, {
      isLoading,
      hasData: !!data,
      pagesCount: data?.pages?.length || 0,
      notificationsCount: notifications.length,
      error: error ? error.message : null
    })
    
    // Track notification view when data loads
    if (!isLoading && notifications.length > 0) {
      trackNotificationView(filter === 'all' ? 'all' : filter, notifications.length)
    }
  }, [isLoading, data, notifications.length, error, filter, trackNotificationView])

  // Check if data is from cache
  useEffect(() => {
    const timestamp = new Date().toLocaleTimeString()
    const cacheInfo = NotificationCache.getCacheInfo()
    
    debug.log(`🎯 [${timestamp}] Cache indicator check:`, {
      hasAllCache: cacheInfo.hasAllCache,
      isLoading,
      notificationsCount: notifications.length,
      priority: false // This component always uses priority=false
    })
    
    if (cacheInfo.hasAllCache && !isLoading && notifications.length > 0) {
      debug.log(`✨ [${timestamp}] Showing cache indicator for ${notifications.length} notifications`)
      setIsFromCache(true)
      // Hide the indicator after 5 seconds (increased from 3)
      const timer = setTimeout(() => {
        debug.log(`🫥 [${timestamp}] Hiding cache indicator`)
        setIsFromCache(false)
      }, 5000)
      return () => clearTimeout(timer)
    } else {
      debug.log(`❌ [${timestamp}] Not showing cache indicator - conditions not met`)
      setIsFromCache(false)
    }
  }, [isLoading, notifications.length])

  // Update page title with unread count
  useEffect(() => {
    if (unreadCount !== undefined && unreadCount !== null && unreadCount > 0) {
      document.title = `(${unreadCount}) Bluesky Notifications`
    } else {
      document.title = 'Bluesky Notifications'
    }
    
    // Cleanup
    return () => {
      document.title = 'Bluesky Notifications'
    }
  }, [unreadCount])

  // Fetch posts for notifications that might have images
  // We always fetch posts to show images in all views
  const { data: posts, totalPosts, fetchedPosts, isFetchingMore, percentageFetched } = useNotificationPosts(notifications)

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

  // Removed automatic loading of 3 pages - let intersection observer handle it
  // This was causing the UI to flicker as it loaded 3 times automatically

  const filteredNotifications = React.useMemo(() => {
    if (!notifications) return []
    
    let filtered = notifications

    if (filter === 'images') {
      // Filter notifications that have posts with images
      if (posts && posts.length > 0) {
        const postsWithImages = new Set(
          posts.filter(postHasImages).map(post => post.uri)
        )
        filtered = filtered.filter((n: Notification) => {
          if (!['like', 'repost', 'reply', 'quote'].includes(n.reason)) return false
          // For reposts and likes, use reasonSubject which contains the original post URI
          const postUri = (n.reason === 'repost' || n.reason === 'like') && n.reasonSubject ? n.reasonSubject : n.uri
          return postsWithImages.has(postUri)
        })
      } else {
        // While posts are loading, show empty
        filtered = []
      }
    } else if (filter !== 'all' && filter !== 'top-accounts' && filter !== 'from-following') {
      const filterMap: Record<Exclude<NotificationFilter, 'all' | 'images' | 'top-accounts' | 'from-following'>, string[]> = {
        likes: ['like'],
        reposts: ['repost'],
        follows: ['follow'],
        mentions: ['mention'],
        replies: ['reply'],
        quotes: ['quote']
      }
      filtered = filtered.filter((n: Notification) => filterMap[filter as Exclude<NotificationFilter, 'all' | 'images' | 'top-accounts' | 'from-following'>].includes(n.reason))
    }
    
    // Filter for notifications from people you follow
    if (filter === 'from-following' && followingSet) {
      filtered = filtered.filter((n: Notification) => followingSet.has(n.author.did))
    }

    if (showUnreadOnly) {
      filtered = filtered.filter((n: Notification) => !n.isRead)
    }

    return filtered
  }, [notifications, filter, showUnreadOnly, posts, followingSet])

  // Create a map for quick post lookup
  const postMap = React.useMemo(() => {
    if (!posts) return new Map()
    const map = new Map(posts.map(post => [post.uri, post]))
    return map
  }, [posts, fetchedPosts]) // Add fetchedPosts to dependencies to ensure map updates

  const getNotificationIcon = React.useCallback((reason: string) => {
    switch (reason) {
      case 'like': return <Heart size={18} style={{ color: 'var(--bsky-like)' }} fill="currentColor" />
      case 'repost': return <Repeat2 size={18} style={{ color: 'var(--bsky-repost)' }} />
      case 'follow': return <UserPlus size={18} style={{ color: 'var(--bsky-follow)' }} />
      case 'mention': return <AtSign size={18} style={{ color: 'var(--bsky-mention)' }} />
      case 'reply': return <MessageCircle size={18} style={{ color: 'var(--bsky-reply)' }} />
      case 'quote': return <Quote size={18} style={{ color: 'var(--bsky-quote)' }} />
      default: return null
    }
  }, [])

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
    <div className="bsky-font">
      {/* Header with filters */}
      <div className="sticky top-0 bsky-glass z-10" style={{ borderBottom: '1px solid var(--bsky-border-primary)' }}>
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {unreadCount !== undefined && unreadCount !== null && unreadCount > 0 && (
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
        <div className="flex gap-1 bsky-tabs-container">
          <FilterTab
            active={filter === 'all'}
            onClick={() => handleFilterChange('all')}
            icon={<Filter size={16} />}
            label="All"
          />
          <FilterTab
            active={filter === 'likes'}
            onClick={() => handleFilterChange('likes')}
            icon={<Heart size={16} />}
            label="Likes"
          />
          <FilterTab
            active={filter === 'reposts'}
            onClick={() => handleFilterChange('reposts')}
            icon={<Repeat2 size={16} />}
            label="Reposts"
          />
          <FilterTab
            active={filter === 'follows'}
            onClick={() => handleFilterChange('follows')}
            icon={<UserPlus size={16} />}
            label="Follows"
          />
          <FilterTab
            active={filter === 'mentions'}
            onClick={() => handleFilterChange('mentions')}
            icon={<AtSign size={16} />}
            label="Mentions"
          />
          <FilterTab
            active={filter === 'replies'}
            onClick={() => handleFilterChange('replies')}
            icon={<MessageCircle size={16} />}
            label="Replies"
          />
          <FilterTab
            active={filter === 'quotes'}
            onClick={() => handleFilterChange('quotes')}
            icon={<Quote size={16} />}
            label="Quotes"
          />
          <FilterTab
            active={filter === 'images'}
            onClick={() => handleFilterChange('images')}
            icon={<Image size={16} />}
            label="Images"
          />
          <FilterTab
            active={filter === 'from-following'}
            onClick={() => handleFilterChange('from-following')}
            icon={<Users size={16} />}
            label="Following"
            disabled={isLoadingFollowing}
          />
          {showTopAccounts && (
            <FilterTab
              active={filter === 'top-accounts'}
              onClick={() => handleFilterChange('top-accounts')}
              icon={<Crown size={16} />}
              label="Top Accounts"
            />
          )}
        </div>
        </div>
      </div>

      {/* Post loading progress indicator - only show if we're actually fetching from API */}
      {isFetchingMore && percentageFetched < 100 && fetchedPosts < totalPosts && (
        <div className="border-b" style={{ 
          borderColor: 'var(--bsky-border-secondary)',
          backgroundColor: 'var(--bsky-bg-secondary)',
          fontSize: '0.875rem',
          color: 'var(--bsky-text-secondary)'
        }}>
          <div className="max-w-4xl mx-auto px-4 md:px-6 py-2">
            <div className="flex items-center justify-between">
              <span>Loading post content...</span>
              <span>{percentageFetched}% ({fetchedPosts}/{totalPosts} posts)</span>
            </div>
            <div className="mt-1 h-1 bg-gray-200 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bsky-border-primary)' }}>
              <div 
                className="h-full transition-all duration-300 ease-out"
                style={{ 
                  width: `${percentageFetched}%`,
                  backgroundColor: 'var(--bsky-primary)'
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Notifications list */}
      <div className="max-w-4xl mx-auto pt-4 md:pt-8">
        {filter === 'top-accounts' ? (
          <TopAccountsView 
            notifications={notifications} 
            minFollowerCount={minFollowerCount}
            onConfigClick={() => setShowConfigModal(true)}
          />
        ) : filteredNotifications.length === 0 ? (
          <div className="p-12 text-center" style={{ color: 'var(--bsky-text-tertiary)' }}>
            <div className="text-5xl mb-4 opacity-20">📭</div>
            <p className="text-lg">No notifications to show</p>
            <p className="text-sm mt-2">Check back later for updates</p>
          </div>
        ) : (
          ['all', 'likes', 'reposts', 'follows', 'quotes', 'from-following'].includes(filter) ? (
            // Show aggregated notifications for tabs that support aggregation
            (() => {
              const processedNotifications = aggregateNotifications(filteredNotifications)
              
              return processedNotifications.map((item, index) => {
                if (item.type === 'aggregated') {
                  const aggregationKey = `${item.reason}-${item.latestTimestamp}-${index}`
                  const isExpanded = expandedAggregations.has(aggregationKey)
                  
                  return (
                    <div key={aggregationKey}>
                      <AggregatedNotificationItem
                        item={item}
                        postMap={postMap}
                        showTypeLabel={filter === 'all'}
                        isFetchingMore={isFetchingMore}
                        fetchedPosts={fetchedPosts}
                        totalPosts={totalPosts}
                        percentageFetched={percentageFetched}
                        onExpand={() => {
                          const newExpanded = new Set(expandedAggregations)
                          if (isExpanded) {
                            newExpanded.delete(aggregationKey)
                          } else {
                            newExpanded.add(aggregationKey)
                          }
                          setExpandedAggregations(newExpanded)
                        }}
                      />
                      
                      {/* Show individual notifications when expanded */}
                      {isExpanded && (
                        <div className="ml-12 border-l-2" style={{ borderColor: 'var(--bsky-border-secondary)' }}>
                          {item.notifications.map(notification => (
                            <NotificationItem 
                              key={`${notification.uri}-${notification.indexedAt}`}
                              notification={notification}
                              postMap={postMap}
                              getNotificationIcon={getNotificationIcon}
                              showTypeLabel={filter === 'all'}
                              isFetchingMore={isFetchingMore}
                              fetchedPosts={fetchedPosts}
                              totalPosts={totalPosts}
                              percentageFetched={percentageFetched}
                            />
                          ))}
                          <button
                            onClick={() => {
                              const newExpanded = new Set(expandedAggregations)
                              newExpanded.delete(aggregationKey)
                              setExpandedAggregations(newExpanded)
                            }}
                            className="p-2 text-xs flex items-center gap-1 hover:opacity-80"
                            style={{ color: 'var(--bsky-text-secondary)' }}
                          >
                            <ChevronUp size={14} />
                            Collapse
                          </button>
                        </div>
                      )}
                    </div>
                  )
                } else {
                  return (
                    <NotificationItem 
                      key={`${item.notification.uri}-${item.notification.indexedAt}`}
                      notification={item.notification}
                      postMap={postMap}
                      getNotificationIcon={getNotificationIcon}
                      showTypeLabel={filter === 'all'}
                      isFetchingMore={isFetchingMore}
                      fetchedPosts={fetchedPosts}
                      totalPosts={totalPosts}
                      percentageFetched={percentageFetched}
                    />
                  )
                }
              })
            })()
          ) : (
            // Show regular notifications for mentions, replies, and images tabs (no aggregation)
            filteredNotifications.map((notification: Notification) => (
              <NotificationItem 
                key={`${notification.uri}-${notification.indexedAt}`}
                notification={notification}
                postMap={postMap}
                getNotificationIcon={getNotificationIcon}
                showTypeLabel={filter === 'all'}
                isFetchingMore={isFetchingMore}
                fetchedPosts={fetchedPosts}
                totalPosts={totalPosts}
                percentageFetched={percentageFetched}
              />
            ))
          )
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
      
      {/* Configuration Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bsky-card p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--bsky-text-primary)' }}>
              Top Accounts Settings
            </h3>
            
            <div className="mb-4">
              <label className="block text-sm mb-2" style={{ color: 'var(--bsky-text-secondary)' }}>
                Minimum Follower Count
              </label>
              <input
                type="number"
                value={minFollowerCount}
                onChange={(e) => setMinFollowerCount(Number(e.target.value))}
                className="w-full px-3 py-2 rounded bsky-input"
                style={{ 
                  backgroundColor: 'var(--bsky-bg-secondary)',
                  border: '1px solid var(--bsky-border-primary)',
                  color: 'var(--bsky-text-primary)'
                }}
                min="0"
                step="1000"
              />
              <p className="text-xs mt-1" style={{ color: 'var(--bsky-text-tertiary)' }}>
                Show accounts with at least this many followers
              </p>
            </div>
            
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowConfigModal(false)}
                className="bsky-button-secondary"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowConfigModal(false)}
                className="bsky-button-primary"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface FilterTabProps {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  disabled?: boolean
}

const FilterTab: React.FC<FilterTabProps> = ({ active, onClick, icon, label, disabled }) => {
  return (
    <button
      onClick={onClick}
      className={`bsky-tab flex items-center gap-1.5 ${active ? 'bsky-tab-active' : ''} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      title={label}
      disabled={disabled}
    >
      <span style={{ opacity: active ? 1 : 0.7 }}>{icon}</span>
      <span className="bsky-tab-label">{label}</span>
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

interface NotificationItemProps {
  notification: Notification
  postMap: Map<string, any>
  getNotificationIcon: (reason: string) => React.ReactNode
  showTypeLabel?: boolean
  isFetchingMore?: boolean
  fetchedPosts?: number
  totalPosts?: number
  percentageFetched?: number
}

const NotificationItem: React.FC<NotificationItemProps> = React.memo(({ 
  notification, 
  postMap, 
  getNotificationIcon, 
  showTypeLabel = false,
  isFetchingMore = false,
  fetchedPosts = 0,
  totalPosts = 0,
  percentageFetched = 100
}) => {
  // Get the post for all notification types that reference posts
  // For reposts and likes, use reasonSubject which contains the original post URI
  const postUri = (notification.reason === 'repost' || notification.reason === 'like') && notification.reasonSubject 
    ? notification.reasonSubject 
    : notification.uri
  
  const post = ['like', 'repost', 'reply', 'quote'].includes(notification.reason) 
    ? postMap.get(postUri) 
    : undefined
  const postAuthorHandle = post?.author?.handle
  
  const notificationUrl = getNotificationUrl(notification, postAuthorHandle)
  
  // Get notification type label
  const getNotificationTypeLabel = (reason: string): string => {
    switch (reason) {
      case 'like': return 'Like'
      case 'repost': return 'Repost'
      case 'follow': return 'Follow'
      case 'mention': return 'Mention'
      case 'reply': return 'Reply'
      case 'quote': return 'Quote'
      default: return reason.charAt(0).toUpperCase() + reason.slice(1)
    }
  }
  
  // Helper to render post content box
  const renderPostContent = () => {
    
    // For likes, reposts, replies, and quotes - show loading state if post not yet loaded
    if (['like', 'repost', 'reply', 'quote'].includes(notification.reason)) {
      // Show loading indicator if post should exist but isn't loaded yet
      if (!post && postMap.size === 0) {
        return (
          <div className="mt-3 p-4 rounded-lg" style={{ 
            backgroundColor: 'var(--bsky-bg-secondary)', 
            border: '1px solid var(--bsky-border-primary)',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
          }}>
            <div className="flex items-center gap-2">
              <Loader className="animate-spin" size={16} style={{ color: 'var(--bsky-primary)' }} />
              <span className="text-sm" style={{ color: 'var(--bsky-text-secondary)' }}>
                Loading post content...
              </span>
            </div>
          </div>
        )
      }
      
      if (!post) {
        // Check if we're still fetching more posts
        if (isFetchingMore && fetchedPosts < totalPosts) {
          return (
            <div className="mt-3 p-4 rounded-lg" style={{ 
              backgroundColor: 'var(--bsky-bg-secondary)', 
              border: '1px solid var(--bsky-border-primary)',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
            }}>
              <div className="flex items-center gap-2">
                <Loader className="animate-spin" size={16} style={{ color: 'var(--bsky-primary)' }} />
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
    }
    
    // For likes, reposts, replies, and quotes - show the referenced post
    if (['like', 'repost', 'reply', 'quote'].includes(notification.reason) && post) {
      const hasImages = post.embed?.$type === 'app.bsky.embed.images#view' || 
                       (post.embed?.$type === 'app.bsky.embed.recordWithMedia#view' && 
                        post.embed.media?.$type === 'app.bsky.embed.images#view')
      
      return (
        <div className="mt-3 p-4 rounded-lg" style={{ 
          backgroundColor: 'var(--bsky-bg-secondary)', 
          border: '1px solid var(--bsky-border-primary)',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium" style={{ color: 'var(--bsky-text-tertiary)' }}>
              {notification.reason === 'reply' ? 'Replying to your post:' : 
               notification.reason === 'quote' ? 'Quoting your post:' : 
               'Your post:'}
            </span>
            {post.author?.avatar ? (
              <img 
                src={post.author.avatar} 
                alt={post.author.handle}
                className="w-5 h-5 bsky-avatar"
              />
            ) : (
              <div className="w-5 h-5 bsky-avatar flex items-center justify-center text-xs" 
                   style={{ background: 'var(--bsky-bg-tertiary)' }}>
                {post.author?.handle?.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="text-xs font-medium" style={{ color: 'var(--bsky-text-secondary)' }}>
              {post.author?.displayName || post.author?.handle || 'Unknown'}
            </span>
            {hasImages && (
              <span className="text-xs flex items-center gap-1" style={{ color: 'var(--bsky-text-tertiary)' }}>
                · 📷
              </span>
            )}
          </div>
          
          {post.record?.text ? (
            <p className="text-sm" style={{ color: 'var(--bsky-text-primary)', lineHeight: '1.5' }}>
              {post.record.text}
            </p>
          ) : (
            <p className="text-sm italic" style={{ color: 'var(--bsky-text-tertiary)' }}>
              [Post with no text]
            </p>
          )}
          
          {/* Display images if present */}
          {(() => {
            if (!post.embed) return null
            
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
                        height: images.length === 1 ? '200px' : '120px'
                      }}
                      loading="lazy"
                    />
                  ))}
                </div>
              </div>
            )
          })()}
        </div>
      )
    }
    
    // For mentions - show the post where you were mentioned
    if (notification.reason === 'mention' && notification.record && typeof notification.record === 'object' && 'text' in notification.record) {
      return (
        <div className="mt-3 p-4 rounded-lg" style={{ 
          backgroundColor: 'var(--bsky-bg-secondary)', 
          border: '1px solid var(--bsky-border-primary)',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium" style={{ color: 'var(--bsky-text-tertiary)' }}>
              Mentioned you in:
            </span>
            {notification.author.avatar ? (
              <img 
                src={notification.author.avatar} 
                alt={notification.author.handle}
                className="w-5 h-5 bsky-avatar"
              />
            ) : (
              <div className="w-5 h-5 bsky-avatar flex items-center justify-center text-xs" 
                   style={{ background: 'var(--bsky-bg-tertiary)' }}>
                {notification.author.handle.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="text-xs font-medium" style={{ color: 'var(--bsky-text-secondary)' }}>
              {notification.author.displayName || notification.author.handle}
            </span>
          </div>
          <p className="text-sm" style={{ color: 'var(--bsky-text-primary)', lineHeight: '1.5' }}>
            {(notification.record as { text?: string }).text}
          </p>
        </div>
      )
    }
    
    // For follows - no post to show
    if (notification.reason === 'follow') {
      return null
    }
    
    // Fallback for any other notification types with record text
    if (notification.record && typeof notification.record === 'object' && 'text' in notification.record) {
      return (
        <div className="mt-3 p-4 rounded-lg" style={{ 
          backgroundColor: 'var(--bsky-bg-secondary)', 
          border: '1px solid var(--bsky-border-primary)',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          <p className="text-sm" style={{ color: 'var(--bsky-text-primary)', lineHeight: '1.5' }}>
            {(notification.record as { text?: string }).text}
          </p>
        </div>
      )
    }
    
    return null
  }
  
  return (
    <a
      href={notificationUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`bsky-notification flex gap-3 py-4 px-4 md:px-6 cursor-pointer block no-underline ${
        !notification.isRead ? 'bsky-notification-unread' : ''
      }`}
      style={{ textDecoration: 'none', color: 'inherit' }}
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
          {showTypeLabel && (
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xs font-medium px-2 py-0.5 rounded-full" 
                    style={{ 
                      backgroundColor: 'var(--bsky-bg-secondary)', 
                      color: 'var(--bsky-text-secondary)',
                      border: '1px solid var(--bsky-border-primary)'
                    }}>
                {getNotificationTypeLabel(notification.reason)}
              </span>
            </div>
          )}
          <p className="text-sm">
            <span className="font-semibold" style={{ color: 'var(--bsky-text-primary)' }}>
              {notification.author.displayName || notification.author.handle}
            </span>
            {' '}
            <span style={{ color: 'var(--bsky-text-secondary)' }}>
              {getNotificationText(notification.reason)}
            </span>
          </p>
          
          {/* Show the referenced post content */}
          {renderPostContent()}
          
          <time className="text-xs mt-2 block" style={{ color: 'var(--bsky-text-tertiary)' }}>
            {formatDistanceToNow(new Date(notification.indexedAt), { addSuffix: true })}
          </time>
        </div>
      </div>
    </a>
  )
})