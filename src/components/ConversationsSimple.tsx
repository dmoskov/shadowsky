import React, { useState, useMemo } from 'react'
import { Search, Loader2, MessageCircle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { formatDistanceToNow } from 'date-fns'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Notification } from '@atproto/api/dist/client/types/app/bsky/notification/listNotifications'
import type { AppBskyFeedDefs } from '@atproto/api'
import { useNotificationPosts } from '../hooks/useNotificationPosts'
import { debug } from '@bsky/shared'
import { useConversationTracking, useFeatureTracking } from '../hooks/useAnalytics'
import { proxifyBskyImage } from '../utils/image-proxy'
import { ThreadModal } from './ThreadModal'

type Post = AppBskyFeedDefs.PostView
import '../styles/conversations.css'

interface ConversationThread {
  rootUri: string
  rootPost?: Post
  replies: Notification[]
  participants: Set<string>
  latestReply: Notification
  totalReplies: number
  originalPostTime?: string
}


// Memoized conversation item component to prevent unnecessary re-renders
// while still updating when root post data changes
const ConversationItem = React.memo(({
  convo,
  isSelected,
  onClick,
  allPostsMap,
  filteredConversationsIndex,
  isLoadingRootPost,
  isFocused,
  onKeyDown
}: {
  convo: ConversationThread
  isSelected: boolean
  onClick: () => void
  allPostsMap: Map<string, Post>
  filteredConversationsIndex: number
  isLoadingRootPost: boolean
  isFocused?: boolean
  onKeyDown?: (e: React.KeyboardEvent) => void
}) => {
  // Log each conversation item render
  React.useEffect(() => {
    debug.log('[ConversationItem] Rendering:', {
      index: filteredConversationsIndex,
      rootUri: convo.rootUri,
      hasRootPost: !!convo.rootPost,
      isLoadingRootPost,
      isSelected,
      isFocused,
      unreadCount: convo.replies.filter(r => !r.isRead).length,
      timestamp: new Date().toISOString()
    })
  })
  
  const rootRecord = convo.rootPost?.record as any
  const previewText = rootRecord?.text || '[Post unavailable]'
  const isGroup = convo.participants.size > 2
  const unreadCount = convo.replies.filter(r => !r.isRead).length

  // Always show the root post author (original poster) regardless of group status
  let mainParticipantAvatar: string | undefined
  let mainParticipantDisplayName: string | undefined
  let mainParticipantHandle: string | undefined
  let avatarSource: string = 'unknown'
  
  // Always prefer root post author if available
  if (convo.rootPost?.author) {
    mainParticipantAvatar = convo.rootPost.author.avatar
    mainParticipantDisplayName = convo.rootPost.author.displayName
    mainParticipantHandle = convo.rootPost.author.handle
    avatarSource = 'rootPost'
  }
  
  // Log avatar usage
  debug.log('[ConversationsSimple] Avatar source:', {
    conversationIndex: filteredConversationsIndex,
    rootUri: convo.rootUri,
    avatarSource,
    hasRootPost: !!convo.rootPost,
    hasRootPostAuthor: !!convo.rootPost?.author,
    mainParticipantHandle,
    mainParticipantAvatar: !!mainParticipantAvatar,
    rootPostAuthor: convo.rootPost?.author?.handle,
    latestReplyAuthor: convo.latestReply.author?.handle,
    isLoadingRootPost
  })

  // Remove loading state - just render the conversation normally even if root post is loading

  return (
    <button
      onClick={onClick}
      onKeyDown={onKeyDown}
      className={`conversation-item w-full text-left py-4 px-4 sm:px-6 transition-all hover:bg-opacity-10 hover:bg-blue-500 ${
        isSelected ? 'bg-opacity-10 bg-blue-500' : ''
      } ${unreadCount > 0 ? 'conversation-unread' : ''} ${
        isFocused ? 'ring-2 ring-blue-500 ring-inset' : ''
      }`}
      style={{ borderBottom: '1px solid var(--bsky-border-primary)' }}
      tabIndex={isFocused ? 0 : -1}
    >
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          {mainParticipantAvatar ? (
            <img 
              src={proxifyBskyImage(mainParticipantAvatar)} 
              alt=""
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bsky-gradient flex items-center justify-center text-white font-medium">
              {mainParticipantDisplayName?.[0] || mainParticipantHandle?.[0] || 'U'}
            </div>
          )}
          {unreadCount > 0 && (
            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs text-white font-medium"
                 style={{ background: 'var(--bsky-primary)' }}>
              {unreadCount}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-medium truncate" style={{ color: 'var(--bsky-text-primary)' }}>
              {mainParticipantDisplayName || 
               mainParticipantHandle ||
               (isGroup ? `${convo.participants.size} people` : 'Thread')
              }
            </h3>
            <span className="text-xs" style={{ color: 'var(--bsky-text-secondary)' }}>
              {formatDistanceToNow(new Date(convo.latestReply.indexedAt), { addSuffix: true })}
            </span>
          </div>
          
          <p className="text-sm truncate mb-1" style={{ color: 'var(--bsky-text-secondary)' }}>
            {previewText.length > 80 ? previewText.substring(0, 80) + '...' : previewText}
          </p>
          
          {/* Show latest reply author and snippet */}
          <div className="flex items-center gap-2 text-xs">
            {/* Profile picture of commenter */}
            {convo.latestReply.author?.avatar ? (
              <img 
                src={proxifyBskyImage(convo.latestReply.author.avatar)} 
                alt={convo.latestReply.author?.handle || ''}
                className="w-5 h-5 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" 
                   style={{ background: 'var(--bsky-bg-tertiary)' }}>
                <span className="text-xs">
                  {convo.latestReply.author?.displayName?.[0] || convo.latestReply.author?.handle?.[0] || 'U'}
                </span>
              </div>
            )}
            <span className="truncate" style={{ color: 'var(--bsky-text-secondary)' }}>
              {(() => {
                const latestPost = allPostsMap.get(convo.latestReply.uri)
                const latestText = (latestPost?.record as any)?.text || 'replied'
                return latestText.length > 50 ? latestText.substring(0, 50) + '...' : latestText
              })()}
            </span>
          </div>
        </div>
      </div>
    </button>
  )
}, (prevProps, nextProps) => {
  // Custom comparison function for React.memo
  // Re-render if:
  // - Selection state changes
  // - Root post becomes available or changes
  // - Latest reply changes
  // - Unread count changes
  // - Loading state changes
  const shouldSkipRender = (
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isFocused === nextProps.isFocused &&
    prevProps.convo.rootPost?.uri === nextProps.convo.rootPost?.uri &&
    prevProps.convo.rootPost?.author?.handle === nextProps.convo.rootPost?.author?.handle &&
    prevProps.convo.rootPost?.author?.avatar === nextProps.convo.rootPost?.author?.avatar &&
    prevProps.convo.latestReply.uri === nextProps.convo.latestReply.uri &&
    prevProps.convo.replies.filter(r => !r.isRead).length === nextProps.convo.replies.filter(r => !r.isRead).length &&
    prevProps.allPostsMap.get(prevProps.convo.latestReply.uri) === nextProps.allPostsMap.get(nextProps.convo.latestReply.uri) &&
    prevProps.isLoadingRootPost === nextProps.isLoadingRootPost
  )
  
  if (!shouldSkipRender) {
    debug.log('[ConversationItem] Re-rendering due to prop change:', {
      index: nextProps.filteredConversationsIndex,
      rootUri: nextProps.convo.rootUri,
      changes: {
        isSelected: prevProps.isSelected !== nextProps.isSelected,
        isFocused: prevProps.isFocused !== nextProps.isFocused,
        rootPostUri: prevProps.convo.rootPost?.uri !== nextProps.convo.rootPost?.uri,
        rootPostAuthor: prevProps.convo.rootPost?.author?.handle !== nextProps.convo.rootPost?.author?.handle,
        rootPostAvatar: prevProps.convo.rootPost?.author?.avatar !== nextProps.convo.rootPost?.author?.avatar,
        latestReplyUri: prevProps.convo.latestReply.uri !== nextProps.convo.latestReply.uri,
        unreadCount: prevProps.convo.replies.filter(r => !r.isRead).length !== nextProps.convo.replies.filter(r => !r.isRead).length,
        latestReplyPost: prevProps.allPostsMap.get(prevProps.convo.latestReply.uri) !== nextProps.allPostsMap.get(nextProps.convo.latestReply.uri),
        isLoadingRootPost: prevProps.isLoadingRootPost !== nextProps.isLoadingRootPost
      },
      timestamp: new Date().toISOString()
    })
  }
  
  return shouldSkipRender
})

interface ConversationsSimpleProps {
  isFocused?: boolean;
  onClose?: () => void;
}

export const ConversationsSimple: React.FC<ConversationsSimpleProps> = ({ isFocused = true }) => {
  debug.log('[ConversationsSimple] Component rendering', {
    timestamp: new Date().toISOString(),
    isFocused
  })
  
  const { session } = useAuth()
  const [selectedConvo, setSelectedConvo] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [additionalRootUris, setAdditionalRootUris] = useState<Set<string>>(new Set())
  const [rootPostsVersion, setRootPostsVersion] = useState(0) // Track root posts updates
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const queryClient = useQueryClient()
  const containerRef = React.useRef<HTMLDivElement>(null)
  
  // Analytics hooks
  const { trackConversationView, trackConversationAction } = useConversationTracking()
  const { trackFeatureAction } = useFeatureTracking('conversations')
  
  // Wrap setSelectedConvo to track analytics
  const handleSelectConversation = (rootUri: string | null, messageCount?: number) => {
    debug.log('[ConversationsSimple] Selecting conversation:', {
      rootUri,
      messageCount,
      previousSelected: selectedConvo,
      timestamp: new Date().toISOString()
    })
    setSelectedConvo(rootUri)
    if (rootUri) {
      trackConversationView(rootUri, messageCount || 0)
      trackConversationAction('select')
    }
  }

  // Use state to store notifications data with persistence
  const [extendedData, setExtendedData] = useState(() => {
    const cached = queryClient.getQueryData(['notifications-extended']) as any
    return cached || { pages: [], pageParams: [] }
  })
  
  // Subscribe to query cache updates
  React.useEffect(() => {
    debug.log('[ConversationsSimple] Setting up cache subscription')
    let checkCount = 0
    const maxChecks = 30 // Check for up to 30 seconds
    
    // Check for data periodically
    const checkData = () => {
      const currentData = queryClient.getQueryData(['notifications-extended']) as any
      debug.log('[ConversationsSimple] Checking cache data:', {
        checkCount,
        hasData: !!currentData,
        pages: currentData?.pages?.length || 0,
        firstPageNotifications: currentData?.pages?.[0]?.notifications?.length || 0,
        timestamp: new Date().toISOString()
      })
      
      if (currentData?.pages?.length > 0) {
        setExtendedData(currentData)
        debug.log('[ConversationsSimple] Updated extended data from cache:', {
          pages: currentData.pages.length,
          notifications: currentData.pages[0]?.notifications?.length || 0,
          totalNotifications: currentData.pages.reduce((sum: number, page: any) => 
            sum + (page.notifications?.length || 0), 0
          ),
          timestamp: new Date().toISOString()
        })
        return true // Data found
      }
      
      checkCount++
      if (checkCount >= maxChecks) {
        debug.warn('[ConversationsSimple] No notification data found after 30 seconds', {
          timestamp: new Date().toISOString()
        })
        // Trigger a manual refresh of notifications
        queryClient.invalidateQueries({ queryKey: ['notifications-extended'] })
      }
      return false // No data yet
    }
    
    // Initial check
    const hasData = checkData()
    
    // Set up interval if no data initially
    let interval: NodeJS.Timeout | null = null
    if (!hasData) {
      interval = setInterval(() => {
        const found = checkData()
        if (found && interval) {
          clearInterval(interval)
          interval = null
        }
      }, 1000)
    }
    
    // Also subscribe to cache updates
    const unsubscribe = queryClient.getQueryCache().subscribe((event: any) => {
      if (event?.query?.queryKey?.[0] === 'notifications-extended') {
        debug.log('[ConversationsSimple] Cache event:', {
          type: event.type,
          state: event.query.state,
          timestamp: new Date().toISOString()
        })
        if (event.type === 'updated') {
          checkData()
        }
      }
    })
    
    return () => {
      if (interval) clearInterval(interval)
      unsubscribe()
    }
  }, [queryClient])
  
  debug.log('[ConversationsSimple] Extended data from query:', {
    hasData: !!extendedData,
    pages: extendedData?.pages?.length || 0,
    firstPageSize: extendedData?.pages?.[0]?.notifications?.length || 0
  })
  
  // Extract reply notifications
  const replyNotifications = React.useMemo(() => {
    const startTime = performance.now()
    if (!extendedData?.pages) {
      debug.log('[ConversationsSimple] No extended data pages', {
        timestamp: new Date().toISOString()
      })
      return []
    }
    debug.log(`[ConversationsSimple] Processing ${extendedData.pages.length} pages of notifications`, {
      timestamp: new Date().toISOString()
    })
    const allNotifications = extendedData.pages.flatMap((page: any) => page.notifications || [])
    debug.log(`[ConversationsSimple] Total notifications: ${allNotifications.length}`, {
      timestamp: new Date().toISOString()
    })
    const replies = allNotifications.filter((n: Notification) => n && n.reason === 'reply')
    debug.log('[ConversationsSimple] Found reply notifications:', {
      count: replies.length,
      processingTime: performance.now() - startTime,
      timestamp: new Date().toISOString()
    })
    
    // Log the newest and oldest reply dates for debugging
    if (replies.length > 0) {
      const newestReply = replies[0]
      const oldestReply = replies[replies.length - 1]
      debug.log('[ConversationsSimple] Reply date range:', {
        newest: new Date(newestReply.indexedAt).toISOString(),
        oldest: new Date(oldestReply.indexedAt).toISOString(),
        rangeInDays: (new Date(newestReply.indexedAt).getTime() - 
                      new Date(oldestReply.indexedAt).getTime()) / (1000 * 60 * 60 * 24)
      })
    }
    
    return replies
  }, [extendedData])

  // Create a list of notifications that includes both replies AND their root posts
  const notificationsWithRoots = React.useMemo(() => {
    const urisToFetch = new Set<string>()
    const fakeNotifications: Notification[] = []
    
    // First pass: collect all reply URIs and their reasonSubjects
    replyNotifications.forEach((notification: Notification) => {
      // Add the original notification
      fakeNotifications.push(notification)
      urisToFetch.add(notification.uri)
      
      // If we have a reasonSubject (the post being replied to), we need to fetch it too
      if (notification.reasonSubject && !urisToFetch.has(notification.reasonSubject)) {
        urisToFetch.add(notification.reasonSubject)
        // Create a minimal fake notification just to trigger fetching
        fakeNotifications.push({
          ...notification,
          uri: notification.reasonSubject,
          reason: 'reply' // Keep it as reply so it gets fetched
        })
      }
    })
    
    // Second pass: after initial posts are loaded, find all root posts
    // This is tricky because we need the post data to find roots, but we're creating the list to fetch posts
    // So we'll add a mechanism to fetch additional root posts discovered during loading
    
    return fakeNotifications
  }, [replyNotifications])

  // Fetch posts for all notifications including root posts
  const { data: posts, percentageFetched } = useNotificationPosts(notificationsWithRoots)
  
  debug.log('[ConversationsSimple] Post fetching status:', {
    notificationsCount: notificationsWithRoots.length,
    postsLoaded: posts?.length || 0,
    percentageFetched,
    timestamp: new Date().toISOString()
  })
  
  // Create post map
  const postMap = React.useMemo(() => {
    const map = new Map<string, Post>()
    
    if (posts && Array.isArray(posts)) {
      posts.forEach(post => {
        if (post && post.uri) {
          map.set(post.uri, post)
        }
      })
    }
    
    return map
  }, [posts])
  
  // Discover and fetch additional root posts as we load the reply chain
  React.useEffect(() => {
    if (!session || !posts) return
    
    const startTime = performance.now()
    const discoveredRootUris = new Set<string>()
    
    debug.log('[ConversationsSimple] Discovering root posts:', {
      postsToCheck: posts.length,
      currentRootUris: additionalRootUris.size,
      timestamp: new Date().toISOString()
    })
    
    // Look through all loaded posts to find root URIs we haven't fetched yet
    posts.forEach(post => {
      const record = post.record as any
      if (record?.reply?.root?.uri) {
        const rootUri = record.reply.root.uri
        // Check if we already have this root post or are already fetching it
        if (!postMap.has(rootUri) && !additionalRootUris.has(rootUri)) {
          discoveredRootUris.add(rootUri)
        }
      }
    })
    
    // If we found new root URIs, update state to trigger fetching
    if (discoveredRootUris.size > 0) {
      debug.log('[ConversationsSimple] Found new root URIs to fetch:', {
        count: discoveredRootUris.size,
        uris: Array.from(discoveredRootUris).slice(0, 5), // Log first 5
        discoveryTime: performance.now() - startTime,
        timestamp: new Date().toISOString()
      })
      
      setAdditionalRootUris(prev => {
        const newSet = new Set(prev)
        discoveredRootUris.forEach(uri => newSet.add(uri))
        return newSet
      })
    }
  }, [posts, postMap, session, additionalRootUris])
  
  // Fetch additional root posts
  const { data: additionalRootPosts } = useQuery({
    queryKey: ['additional-root-posts', Array.from(additionalRootUris).sort()],
    queryFn: async () => {
      if (additionalRootUris.size === 0) return []
      
      const { atProtoClient } = await import('../services/atproto')
      const agent = atProtoClient.agent
      if (!agent) throw new Error('Not authenticated')
      
      const { PostCache } = await import('../utils/postCache')
      const { rateLimitedPostFetch } = await import('../services/rate-limiter')
      
      const urisToFetch = Array.from(additionalRootUris)
      const { cached, missing } = await PostCache.getCachedPostsAsync(urisToFetch)
      
      debug.log('[ConversationsSimple] Root posts cache check:', {
        totalUris: urisToFetch.length,
        cachedCount: cached.length,
        missingCount: missing.length,
        cacheHitRate: cached.length > 0 ? (cached.length / urisToFetch.length * 100).toFixed(2) + '%' : '0%',
        timestamp: new Date().toISOString()
      })
      
      if (missing.length === 0) {
        return cached
      }
      
      const posts: Post[] = [...cached]
      
      // Batch fetch missing posts (25 at a time)
      for (let i = 0; i < missing.length; i += 25) {
        const batch = missing.slice(i, i + 25)
        const batchStartTime = performance.now()
        
        debug.log('[ConversationsSimple] Fetching root posts batch:', {
          batchIndex: Math.floor(i / 25) + 1,
          totalBatches: Math.ceil(missing.length / 25),
          batchSize: batch.length,
          timestamp: new Date().toISOString()
        })
        
        try {
          const response = await rateLimitedPostFetch(async () => 
            agent.app.bsky.feed.getPosts({ uris: batch })
          )
          const newPosts = response.data.posts as Post[]
          posts.push(...newPosts)
          
          debug.log('[ConversationsSimple] Root posts batch fetched:', {
            requestedCount: batch.length,
            receivedCount: newPosts.length,
            fetchTime: performance.now() - batchStartTime,
            timestamp: new Date().toISOString()
          })
          
          // Cache the newly fetched posts
          PostCache.save(newPosts)
        } catch (error) {
          debug.error('[ConversationsSimple] Failed to fetch root posts batch:', {
            error,
            batchIndex: Math.floor(i / 25) + 1,
            batchSize: batch.length,
            timestamp: new Date().toISOString()
          })
        }
      }
      
      return posts
    },
    enabled: !!session && additionalRootUris.size > 0,
    staleTime: 60 * 60 * 1000, // 1 hour
    gcTime: 2 * 60 * 60 * 1000, // 2 hours
    refetchOnMount: 'always', // Always fetch fresh data on mount
    refetchInterval: 60 * 1000, // Poll every 60 seconds
  })
  
  // Combine all posts (replies + roots)
  const allPosts = React.useMemo(() => {
    const combined = [...(posts || [])]
    if (additionalRootPosts) {
      additionalRootPosts.forEach(post => {
        if (!postMap.has(post.uri)) {
          combined.push(post)
        }
      })
    }
    return combined
  }, [posts, additionalRootPosts, postMap])
  
  // Force re-render when root posts are loaded by updating a version counter
  // This ensures conversation items update their avatars when root post authors become available
  React.useEffect(() => {
    if (additionalRootPosts && additionalRootPosts.length > 0) {
      debug.log('[ConversationsSimple] Root posts loaded, forcing re-render:', {
        count: additionalRootPosts.length,
        rootPostsWithAuthors: additionalRootPosts.filter(p => p.author).length,
        timestamp: new Date().toISOString()
      })
      setRootPostsVersion(v => v + 1)
    }
  }, [additionalRootPosts])
  
  // Update post map to include all posts
  const allPostsMap = React.useMemo(() => {
    const map = new Map<string, Post>()
    
    allPosts.forEach(post => {
      if (post && post.uri) {
        map.set(post.uri, post)
      }
    })
    
    return map
  }, [allPosts])


  // Group notifications into conversation threads
  // Include rootPostsVersion to force re-computation when root posts are loaded
  const conversations = useMemo(() => {
    const startTime = performance.now()
    debug.log('[ConversationsSimple] Starting conversation grouping:', {
      replyNotificationsCount: replyNotifications.length,
      allPostsMapSize: allPostsMap.size,
      rootPostsVersion,
      timestamp: new Date().toISOString()
    })
    
    const threadMap = new Map<string, ConversationThread>()
    
    // Helper function to find the true root of a thread by following the reply chain
    const findRootUri = (uri: string, visitedUris = new Set<string>()): string => {
      // Prevent infinite loops
      if (visitedUris.has(uri)) {
        return uri
      }
      visitedUris.add(uri)
      
      const post = allPostsMap.get(uri)
      const record = post?.record as any
      
      // If this post has a reply.root, that's the true root
      if (record?.reply?.root?.uri) {
        return record.reply.root.uri
      }
      
      // If this post has a reply.parent, follow it up the chain
      if (record?.reply?.parent?.uri && record.reply.parent.uri !== uri) {
        const parentPost = allPostsMap.get(record.reply.parent.uri)
        if (parentPost) {
          return findRootUri(record.reply.parent.uri, visitedUris)
        }
      }
      
      // Otherwise, this is the root (or we can't find higher)
      return uri
    }
    
    // First pass: collect all unique root URIs based on current data
    const rootUriMap = new Map<string, string>() // Maps notification URI to its determined root URI
    const rootUriDeterminations = { found: 0, fromPost: 0, fromReasonSubject: 0, fallback: 0 }
    
    replyNotifications.forEach((notification: Notification) => {
      try {
        // Determine the root URI for this notification
        let rootUri = notification.reasonSubject || notification.uri
        
        // If we have the post data, find the true root
        const post = allPostsMap.get(notification.uri)
        if (post) {
          const record = post.record as any
          // If the post explicitly declares its root, use that
          if (record?.reply?.root?.uri) {
            rootUri = record.reply.root.uri
            rootUriDeterminations.fromPost++
          } else {
            // Otherwise follow the chain
            rootUri = findRootUri(notification.uri)
            rootUriDeterminations.fromPost++
          }
        } else if (notification.reasonSubject) {
          // If we don't have the reply post but have the reasonSubject, use that as a stable identifier
          // Don't try to follow the chain if we don't have the data
          rootUri = notification.reasonSubject
          rootUriDeterminations.fromReasonSubject++
        } else {
          rootUriDeterminations.fallback++
        }
        
        rootUriMap.set(notification.uri, rootUri)
        rootUriDeterminations.found++
      } catch (error) {
        debug.error('[ConversationsSimple] Error determining root URI:', error, notification.uri)
        // Fallback to using the notification URI itself
        rootUriMap.set(notification.uri, notification.uri)
        rootUriDeterminations.fallback++
      }
    })
    
    debug.log('[ConversationsSimple] Root URI determination stats:', {
      ...rootUriDeterminations,
      totalNotifications: replyNotifications.length,
      uniqueRootUris: new Set(rootUriMap.values()).size,
      timestamp: new Date().toISOString()
    })
    
    // Second pass: group notifications by their determined root URI
    replyNotifications.forEach((notification: Notification) => {
      const rootUri = rootUriMap.get(notification.uri) || notification.uri
      
      if (!threadMap.has(rootUri)) {
        // Try to get the root post if it's loaded
        const rootPost = allPostsMap.get(rootUri)
        threadMap.set(rootUri, {
          rootUri,
          rootPost,
          replies: [],
          participants: new Set(),
          latestReply: notification,
          totalReplies: 0,
          originalPostTime: rootPost?.indexedAt || (rootPost?.record as any)?.createdAt
        })
      }
      
      const thread = threadMap.get(rootUri)!
      thread.replies.push(notification)
      if (notification.author?.handle) {
        thread.participants.add(notification.author.handle)
      }
      thread.totalReplies++
      
      // Update root post if we just loaded it
      if (!thread.rootPost && allPostsMap.get(rootUri)) {
        thread.rootPost = allPostsMap.get(rootUri)
        thread.originalPostTime = thread.rootPost?.indexedAt || (thread.rootPost?.record as any)?.createdAt
      }
      
      // Update latest reply if this one is newer
      if (new Date(notification.indexedAt) > new Date(thread.latestReply.indexedAt)) {
        thread.latestReply = notification
      }
    })
    
    // Sort conversations by latest activity
    const sortedConversations = Array.from(threadMap.values()).sort((a, b) => 
      new Date(b.latestReply.indexedAt).getTime() - new Date(a.latestReply.indexedAt).getTime()
    )
    
    const groupingTime = performance.now() - startTime
    debug.log('[ConversationsSimple] Conversations generated:', {
      count: sortedConversations.length,
      replyNotificationCount: replyNotifications.length,
      allPostsMapSize: allPostsMap.size,
      rootPostsVersion,
      groupingTime,
      conversationsWithRootPosts: sortedConversations.filter(c => c.rootPost).length,
      conversationsWithMultipleReplies: sortedConversations.filter(c => c.replies.length > 1).length,
      timestamp: new Date().toISOString()
    })
    
    return sortedConversations
  }, [replyNotifications, allPostsMap, rootPostsVersion]) // Include rootPostsVersion to trigger updates

  // Filter conversations based on search
  const filteredConversations = useMemo(() => {
    if (!searchQuery) return conversations
    
    return conversations.filter(convo => {
      // Search in participants
      const participantMatch = Array.from(convo.participants).some(handle =>
        handle.toLowerCase().includes(searchQuery.toLowerCase())
      )
      
      // Search in root post text if available
      const rootRecord = convo.rootPost?.record as any
      const rootPostMatch = rootRecord?.text?.toLowerCase().includes(searchQuery.toLowerCase())
      
      // Search in reply text
      const replyMatch = convo.replies.some(reply => {
        const replyPost = allPostsMap.get(reply.uri)
        const replyRecord = replyPost?.record as any
        return replyRecord?.text?.toLowerCase().includes(searchQuery.toLowerCase())
      })
      
      return participantMatch || rootPostMatch || replyMatch
    })
  }, [conversations, searchQuery, allPostsMap])

  // Debug selected conversation (kept for logging)
  useMemo(() => {
    const found = conversations.find(c => c.rootUri === selectedConvo)
    debug.log('[ConversationsSimple] Finding selected conversation:', {
      selectedConvo,
      found: !!found,
      foundRootUri: found?.rootUri,
      foundRootPost: !!found?.rootPost,
      conversationCount: conversations.length,
      timestamp: new Date().toISOString()
    })
    return found
  }, [conversations, selectedConvo])
  

  // Debug: Log rendering state
  React.useEffect(() => {
    debug.log('[ConversationsSimple] Component state update:', {
      hasExtendedData: !!extendedData,
      extendedDataPages: extendedData?.pages?.length || 0,
      notificationCount: replyNotifications.length,
      postsLoaded: posts?.length || 0,
      additionalRootPosts: additionalRootPosts?.length || 0,
      allPostsMapSize: allPostsMap.size,
      conversationsCount: conversations.length,
      rootUrisDiscovered: additionalRootUris.size,
      filteredConversationsCount: filteredConversations.length,
      percentageFetched,
      selectedConvo,
      searchQuery,
      timestamp: new Date().toISOString()
    })
  }, [extendedData, replyNotifications.length, posts, additionalRootPosts, allPostsMap.size, conversations.length, additionalRootUris.size, filteredConversations.length, percentageFetched, selectedConvo, searchQuery])

  // Handle keyboard navigation
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if this column is focused
      if (!isFocused) return
      
      // Only handle if no input is focused
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault()
        setFocusedIndex(prev => prev === -1 ? 0 : Math.min(prev + 1, filteredConversations.length - 1))
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault()
        setFocusedIndex(prev => prev === -1 ? 0 : Math.max(prev - 1, 0))
      } else if (e.key === 'Enter' && focusedIndex >= 0 && filteredConversations[focusedIndex]) {
        e.preventDefault()
        const convo = filteredConversations[focusedIndex]
        handleSelectConversation(convo.rootUri, convo.totalReplies)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [filteredConversations, focusedIndex, handleSelectConversation, isFocused])

  // Make container focusable for keyboard navigation and handle selection clearing
  React.useEffect(() => {
    if (isFocused) {
      // Focus container when column becomes focused
      // This ensures keyboard events are captured
      if (containerRef.current) {
        containerRef.current.focus()
      }
    } else {
      // Clear selection when column loses focus
      // Using setSelectedConvo directly to avoid circular dependency
      setSelectedConvo(null)
    }
  }, [isFocused]) // Only depend on isFocused

  // Scroll focused item into view
  React.useEffect(() => {
    const focusedElement = document.querySelector('.conversation-item:focus, .conversation-item.ring-2')
    if (focusedElement) {
      focusedElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [focusedIndex])



  // Always render the UI immediately, even if data is still loading
  // This provides a non-blocking experience
  return (
    <div ref={containerRef} className="conversations-container h-[calc(100vh-4rem)] w-full overflow-hidden" style={{ position: 'relative', outline: 'none' }} tabIndex={-1}>
      <div className="flex h-full relative w-full" style={{ 
        background: 'var(--bsky-bg-primary)', 
        overflow: 'hidden',
        maxWidth: '100vw'
      }}>
        {/* Conversations List - Full width */}
        <div className="flex flex-col w-full">
        {/* Search Header */}
        <div className="py-4 px-4 sm:px-6" style={{ borderBottom: '1px solid var(--bsky-border-primary)' }}>
          <div className="relative">
            <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2" 
                   style={{ color: 'var(--bsky-text-tertiary)' }} />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                if (e.target.value) {
                  trackFeatureAction('search', { query_length: e.target.value.length })
                }
              }}
              className="w-full pl-10 pr-4 py-2 rounded-lg bsky-input"
              style={{ 
                background: 'var(--bsky-bg-secondary)',
                border: '1px solid var(--bsky-border-primary)',
                color: 'var(--bsky-text-primary)'
              }}
            />
          </div>
          <p className="text-xs mt-2" style={{ color: 'var(--bsky-text-secondary)' }}>
            Showing {filteredConversations.length} conversation{filteredConversations.length !== 1 ? 's' : ''} from {replyNotifications.length} reply notifications
          </p>
        </div>

        {/* Removed loading indicator for posts */}

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto skydeck-scrollbar">
          {filteredConversations.length === 0 ? (
            <div className="p-8 text-center">
              {!extendedData || percentageFetched < 100 ? (
                // Still loading - show a subtle loading state
                <>
                  <Loader2 size={48} className="mx-auto mb-4 animate-spin" style={{ color: 'var(--bsky-text-tertiary)' }} />
                  <p className="text-sm" style={{ color: 'var(--bsky-text-secondary)' }}>
                    Loading conversations...
                  </p>
                </>
              ) : (
                // Fully loaded but no conversations
                <>
                  <MessageCircle size={48} className="mx-auto mb-4" style={{ color: 'var(--bsky-text-tertiary)' }} />
                  <p className="text-sm" style={{ color: 'var(--bsky-text-secondary)' }}>
                    {searchQuery ? 'No conversations match your search' : 'No reply notifications yet'}
                  </p>
                </>
              )}
            </div>
          ) : filteredConversations.map((convo, index) => {
            // Determine if we're still loading this conversation's root post
            const isLoadingRootPost = (
              // We've discovered this root URI needs to be fetched
              additionalRootUris.has(convo.rootUri) &&
              // But we haven't loaded it yet
              (!convo.rootPost || !convo.rootPost.author)
            ) || (
              // Or we're still in the initial post loading phase
              percentageFetched < 100 && !convo.rootPost
            )
            
            // Log loading state for first few items
            if (index < 5) {
              debug.log('[ConversationsSimple] Conversation render state:', {
                index,
                rootUri: convo.rootUri,
                hasRootPost: !!convo.rootPost,
                hasRootPostAuthor: !!convo.rootPost?.author,
                isInAdditionalRootUris: additionalRootUris.has(convo.rootUri),
                percentageFetched,
                isLoadingRootPost,
                timestamp: new Date().toISOString()
              })
            }
            
            return (
              <ConversationItem
                key={convo.rootUri}
                convo={convo}
                isSelected={selectedConvo === convo.rootUri && selectedConvo !== null}
                isFocused={focusedIndex === index}
                onClick={() => {
                  // Always handle click, even if column is not focused
                  // This will allow clicking in unfocused columns
                  handleSelectConversation(convo.rootUri, convo.totalReplies)
                  // Also update the focused index when clicking
                  setFocusedIndex(index)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && isFocused) {
                    e.preventDefault()
                    handleSelectConversation(convo.rootUri, convo.totalReplies)
                  }
                }}
                allPostsMap={allPostsMap}
                filteredConversationsIndex={index}
                isLoadingRootPost={isLoadingRootPost}
              />
            )
          })}
        </div>
      </div>
      </div>

      {/* Thread Modal for Conversations */}
      {selectedConvo && (
        <ThreadModal
          postUri={selectedConvo}
          onClose={() => handleSelectConversation(null)}
        />
      )}
    </div>
  )
}
