import React, { useState, useMemo, useRef } from 'react'
import { MessageCircle, Search, ArrowLeft, Users, Loader2, ExternalLink, CornerDownRight, ChevronDown } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { formatDistanceToNow } from 'date-fns'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import type { Notification } from '@atproto/api/dist/client/types/app/bsky/notification/listNotifications'
import { getNotificationUrl, atUriToBskyUrl } from '../utils/url-helpers'
import type { AppBskyFeedDefs } from '@atproto/api'
import { useNotificationPosts } from '../hooks/useNotificationPosts'
import { debug } from '@bsky/shared'

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

interface ThreadNode {
  notification?: Notification
  post?: Post
  children: ThreadNode[]
  depth: number
  isRoot?: boolean
}

// Memoized conversation item component to prevent unnecessary re-renders
// while still updating when root post data changes
const ConversationItem = React.memo(({
  convo,
  isSelected,
  onClick,
  allPostsMap,
  session,
  filteredConversationsIndex,
  isLoadingRootPost
}: {
  convo: ConversationThread
  isSelected: boolean
  onClick: () => void
  allPostsMap: Map<string, Post>
  session: any
  filteredConversationsIndex: number
  isLoadingRootPost: boolean
}) => {
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
    latestReplyAuthor: convo.latestReply.author.handle,
    isLoadingRootPost
  })

  debug.log('show loading state?', isGroup,isLoadingRootPost, convo.rootPost?.author)
  // If we're loading the root post, show loading state
  if (isLoadingRootPost && !convo.rootPost?.author) {
    debug.log('--- show loading state', isGroup,isLoadingRootPost, convo.rootPost?.author)
    return (
      <div className={`w-full text-left p-4 transition-all ${
        isSelected ? 'bg-opacity-10 bg-blue-500' : ''
      }`}
      style={{ borderBottom: '1px solid var(--bsky-border-primary)' }}>
        <div className="flex items-center gap-3">
          {/* Avatar placeholder */}
          <div className="relative flex-shrink-0">
            <div className="w-12 h-12 rounded-full flex items-center justify-center animate-pulse"
                 style={{ background: 'var(--bsky-bg-secondary)' }}>
              <Loader2 size={20} className="animate-spin" style={{ color: 'var(--bsky-text-tertiary)' }} />
            </div>
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
              <div className="flex items-center gap-2">
                <div className="h-4 w-32 rounded animate-pulse" style={{ background: 'var(--bsky-bg-secondary)' }} />
                <Loader2 size={12} className="animate-spin" style={{ color: 'var(--bsky-text-tertiary)' }} />
              </div>
              <span className="text-xs" style={{ color: 'var(--bsky-text-secondary)' }}>
                {formatDistanceToNow(new Date(convo.latestReply.indexedAt), { addSuffix: true })}
              </span>
            </div>
            
            <div className="h-3 w-full rounded mb-2 animate-pulse" style={{ background: 'var(--bsky-bg-secondary)' }} />
            
            {/* Still show latest reply info */}
            <div className="flex items-center gap-2 text-xs">
              {convo.latestReply.author.avatar ? (
                <img 
                  src={convo.latestReply.author.avatar} 
                  alt={convo.latestReply.author.handle}
                  className="w-5 h-5 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" 
                     style={{ background: 'var(--bsky-bg-tertiary)' }}>
                  <span className="text-xs">
                    {convo.latestReply.author.displayName?.[0] || convo.latestReply.author.handle?.[0] || 'U'}
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
      </div>
    )
  }

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 transition-all hover:bg-opacity-10 hover:bg-blue-500 ${
        isSelected ? 'bg-opacity-10 bg-blue-500' : ''
      }`}
      style={{ borderBottom: '1px solid var(--bsky-border-primary)' }}
    >
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          {mainParticipantAvatar ? (
            <img 
              src={mainParticipantAvatar} 
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
            {convo.latestReply.author.avatar ? (
              <img 
                src={convo.latestReply.author.avatar} 
                alt={convo.latestReply.author.handle}
                className="w-5 h-5 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" 
                   style={{ background: 'var(--bsky-bg-tertiary)' }}>
                <span className="text-xs">
                  {convo.latestReply.author.displayName?.[0] || convo.latestReply.author.handle?.[0] || 'U'}
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
  return (
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.convo.rootPost?.uri === nextProps.convo.rootPost?.uri &&
    prevProps.convo.rootPost?.author?.handle === nextProps.convo.rootPost?.author?.handle &&
    prevProps.convo.rootPost?.author?.avatar === nextProps.convo.rootPost?.author?.avatar &&
    prevProps.convo.latestReply.uri === nextProps.convo.latestReply.uri &&
    prevProps.convo.replies.filter(r => !r.isRead).length === nextProps.convo.replies.filter(r => !r.isRead).length &&
    prevProps.allPostsMap.get(prevProps.convo.latestReply.uri) === nextProps.allPostsMap.get(nextProps.convo.latestReply.uri) &&
    prevProps.isLoadingRootPost === nextProps.isLoadingRootPost
  )
})

export const ConversationsSimple: React.FC = () => {
  debug.log('[ConversationsSimple] Component rendering')
  
  const { session } = useAuth()
  const [selectedConvo, setSelectedConvo] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [additionalRootUris, setAdditionalRootUris] = useState<Set<string>>(new Set())
  const [rootPostsVersion, setRootPostsVersion] = useState(0) // Track root posts updates
  const threadContainerRef = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()

  // Subscribe to extended notifications data properly
  const { data: extendedData } = useQuery({
    queryKey: ['notifications-extended'],
    // Don't fetch - just subscribe to existing data from BackgroundNotificationLoader
    queryFn: () => queryClient.getQueryData(['notifications-extended']) || { pages: [] },
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  })
  debug.log('[ConversationsSimple] Extended data:', !!extendedData, extendedData?.pages?.length)
  
  // Extract reply notifications
  const replyNotifications = React.useMemo(() => {
    if (!extendedData?.pages) {
      debug.log('[ConversationsSimple] No extended data pages')
      return []
    }
    const allNotifications = extendedData.pages.flatMap((page: any) => page.notifications)
    const replies = allNotifications.filter((n: Notification) => n.reason === 'reply')
    debug.log('[ConversationsSimple] Found reply notifications:', replies.length)
    return replies
  }, [extendedData])

  // Create a list of notifications that includes both replies AND their root posts
  const notificationsWithRoots = React.useMemo(() => {
    const urisToFetch = new Set<string>()
    const fakeNotifications: Notification[] = []
    
    // First pass: collect all reply URIs and their reasonSubjects
    replyNotifications.forEach((notification) => {
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
  const { data: posts, fetchedPosts, totalPosts, percentageFetched } = useNotificationPosts(notificationsWithRoots)
  
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
    
    const discoveredRootUris = new Set<string>()
    
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
      
      if (missing.length === 0) {
        return cached
      }
      
      const posts: Post[] = [...cached]
      
      // Batch fetch missing posts (25 at a time)
      for (let i = 0; i < missing.length; i += 25) {
        const batch = missing.slice(i, i + 25)
        try {
          const response = await rateLimitedPostFetch(async () => 
            agent.app.bsky.feed.getPosts({ uris: batch })
          )
          const newPosts = response.data.posts as Post[]
          posts.push(...newPosts)
          
          // Cache the newly fetched posts
          PostCache.save(newPosts)
        } catch (error) {
          debug.error('Failed to fetch root posts batch:', error)
        }
      }
      
      return posts
    },
    enabled: !!session && additionalRootUris.size > 0,
    staleTime: 60 * 60 * 1000, // 1 hour
    gcTime: 2 * 60 * 60 * 1000, // 2 hours
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
      debug.log('[ConversationsSimple] Root posts loaded, forcing re-render:', additionalRootPosts.length)
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
    const threadMap = new Map<string, ConversationThread>()
    
    // Helper function to find the true root of a thread by following the reply chain
    const findRootUri = (uri: string): string => {
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
          return findRootUri(record.reply.parent.uri)
        }
      }
      
      // Otherwise, this is the root (or we can't find higher)
      return uri
    }
    
    replyNotifications.forEach((notification: Notification) => {
      // Start with reasonSubject as initial guess for root
      let rootUri = notification.reasonSubject || notification.uri
      
      // If we have the post data, find the true root
      const post = allPostsMap.get(notification.uri)
      if (post) {
        rootUri = findRootUri(notification.uri)
      } else if (notification.reasonSubject && allPostsMap.get(notification.reasonSubject)) {
        // If we don't have the reply post but have the parent, start from there
        rootUri = findRootUri(notification.reasonSubject)
      }
      
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
      thread.participants.add(notification.author.handle)
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
    return Array.from(threadMap.values()).sort((a, b) => 
      new Date(b.latestReply.indexedAt).getTime() - new Date(a.latestReply.indexedAt).getTime()
    )
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

  // Get the selected conversation
  const selectedConversation = useMemo(() => {
    return conversations.find(c => c.rootUri === selectedConvo)
  }, [conversations, selectedConvo])

  // Debug: Log rendering state
  React.useEffect(() => {
    debug.log('[ConversationsSimple] State:', {
      hasExtendedData: !!extendedData,
      extendedDataPages: extendedData?.pages?.length || 0,
      notificationCount: replyNotifications.length,
      postsLoaded: posts?.length || 0,
      additionalRootPosts: additionalRootPosts?.length || 0,
      allPostsMapSize: allPostsMap.size,
      conversationsCount: conversations.length,
      rootUrisDiscovered: additionalRootUris.size,
      filteredConversationsCount: filteredConversations.length
    })
  }, [extendedData, replyNotifications.length, posts, additionalRootPosts, allPostsMap.size, conversations.length, additionalRootUris.size, filteredConversations.length])

  // Build thread tree structure for the selected conversation
  const threadTree = useMemo(() => {
    if (!selectedConversation) return null
    
    const nodeMap = new Map<string, ThreadNode>()
    const rootNodes: ThreadNode[] = []
    
    // Create root node if we have the root post
    if (selectedConversation.rootPost) {
      const rootNode: ThreadNode = {
        post: selectedConversation.rootPost,
        children: [],
        depth: 0,
        isRoot: true
      }
      nodeMap.set(selectedConversation.rootUri, rootNode)
      rootNodes.push(rootNode)
    } else {
      // If we don't have the root post, create a placeholder
      const rootNode: ThreadNode = {
        post: undefined,
        children: [],
        depth: 0,
        isRoot: true
      }
      nodeMap.set(selectedConversation.rootUri, rootNode)
      rootNodes.push(rootNode)
    }
    
    // Create nodes for all replies
    selectedConversation.replies.forEach(notification => {
      const post = allPostsMap.get(notification.uri)
      if (post) {
        const node: ThreadNode = {
          notification,
          post,
          children: [],
          depth: 0
        }
        nodeMap.set(notification.uri, node)
      }
    })
    
    // Build parent-child relationships
    selectedConversation.replies.forEach(notification => {
      const post = allPostsMap.get(notification.uri)
      const childNode = nodeMap.get(notification.uri)
      if (!childNode) return
      
      // Get the parent URI from the reply
      const postRecord = post?.record as any
      const parentUri = postRecord?.reply?.parent?.uri
      
      if (parentUri) {
        const parentNode = nodeMap.get(parentUri)
        
        if (parentNode) {
          // Found parent in our nodes
          parentNode.children.push(childNode)
          childNode.depth = parentNode.depth + 1
        } else {
          // Parent not in our nodes, check if it should be attached to root
          if (parentUri === selectedConversation.rootUri || rootNodes.length > 0) {
            // This is a direct reply to the root post or we have a root node
            rootNodes[0].children.push(childNode)
            childNode.depth = 1
          }
        }
      }
    })
    
    // Sort children by timestamp
    const sortChildren = (node: ThreadNode) => {
      node.children.sort((a, b) => {
        const aTime = a.notification?.indexedAt || a.post?.indexedAt || ''
        const bTime = b.notification?.indexedAt || b.post?.indexedAt || ''
        return new Date(aTime).getTime() - new Date(bTime).getTime()
      })
      node.children.forEach(sortChildren)
    }
    
    rootNodes.forEach(sortChildren)
    
    return rootNodes
  }, [selectedConversation, allPostsMap])

  // Render thread nodes recursively
  const renderThreadNodes = (nodes: ThreadNode[]) => {
    return nodes.map((node) => {
      const post = node.post
      const notification = node.notification
      const isUnread = notification && !notification.isRead
      const author = post?.author || notification?.author
      const postUrl = post?.uri && author?.handle 
        ? atUriToBskyUrl(post.uri, author.handle) 
        : notification ? getNotificationUrl(notification) : null

      // Handle root node without post
      if (node.isRoot && !post) {
        return (
          <div key={selectedConversation?.rootUri || Math.random()} className="mb-4">
            <div className="flex-1 p-4 rounded-lg" 
                 style={{ 
                   backgroundColor: 'var(--bsky-bg-secondary)',
                   border: '1px solid var(--bsky-border-primary)'
                 }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-medium px-2 py-1 rounded-full" 
                      style={{ 
                        backgroundColor: 'var(--bsky-bg-primary)', 
                        color: 'var(--bsky-text-secondary)',
                        border: '1px solid var(--bsky-border-primary)'
                      }}>
                  Original Post
                </span>
              </div>
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <p className="text-sm mb-2" style={{ color: 'var(--bsky-text-secondary)' }}>
                    {percentageFetched < 100 || additionalRootUris.size > (additionalRootPosts?.length || 0) 
                      ? 'Loading original post...' 
                      : 'Original post unavailable'}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--bsky-text-tertiary)' }}>
                    {percentageFetched < 100 
                      ? `Loading posts: ${fetchedPosts}/${totalPosts}` 
                      : additionalRootUris.size > (additionalRootPosts?.length || 0)
                        ? `Loading root posts: ${additionalRootPosts?.length || 0}/${additionalRootUris.size}`
                        : 'The post may have been deleted or is not accessible'}
                  </p>
                </div>
              </div>
            </div>
            {/* Render children */}
            {node.children.length > 0 && (
              <div>{renderThreadNodes(node.children)}</div>
            )}
          </div>
        )
      }

      return (
        <div key={post?.uri || notification?.uri || `node-${node.depth}-${notification?.indexedAt}`} className="mb-4">
          {/* Thread line connector for nested replies */}
          {node.depth > 0 && (
            <div className="flex">
              <div 
                className="w-8 flex-shrink-0 flex justify-center"
                style={{ marginLeft: `${(node.depth - 1) * 48}px` }}
              >
                <div 
                  className="w-0.5 h-6 -mt-6"
                  style={{ backgroundColor: 'var(--bsky-border-primary)' }}
                />
              </div>
              <div className="flex-1" />
            </div>
          )}

          {/* Post content */}
          <div 
            className={`flex ${node.depth > 0 ? '' : ''}`}
            style={{ marginLeft: `${node.depth * 48}px` }}
          >
            {/* Branch indicator */}
            {node.depth > 0 && (
              <div className="w-8 flex-shrink-0 flex items-start justify-center pt-3">
                <CornerDownRight size={16} style={{ color: 'var(--bsky-text-tertiary)' }} />
              </div>
            )}

            {/* Post card */}
            <div 
              className={`flex-1 p-4 rounded-lg cursor-pointer transition-all hover:bg-opacity-5 hover:bg-blue-500 ${
                isUnread ? 'ring-2 ring-blue-500 ring-opacity-30' : ''
              }`}
              style={{ 
                backgroundColor: node.isRoot 
                  ? 'var(--bsky-bg-secondary)'
                  : (isUnread ? 'var(--bsky-bg-primary)' : 'var(--bsky-bg-secondary)'),
                border: '1px solid var(--bsky-border-primary)'
              }}
              onClick={() => {
                if (postUrl) {
                  window.open(postUrl, '_blank', 'noopener,noreferrer')
                }
              }}
            >
              {node.isRoot && (
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium px-2 py-1 rounded-full" 
                        style={{ 
                          backgroundColor: 'var(--bsky-bg-primary)', 
                          color: 'var(--bsky-text-secondary)',
                          border: '1px solid var(--bsky-border-primary)'
                        }}>
                    Original Post
                  </span>
                  {post && (
                    <span className="text-xs" style={{ color: 'var(--bsky-text-tertiary)' }}>
                      {formatDistanceToNow(
                        new Date((post.record as any)?.createdAt || post.indexedAt), 
                        { addSuffix: true }
                      )}
                    </span>
                  )}
                </div>
              )}

              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  {author?.avatar ? (
                    <img 
                      src={author.avatar} 
                      alt={author.handle}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full flex items-center justify-center" 
                         style={{ background: 'var(--bsky-bg-tertiary)' }}>
                      <span className="text-sm font-semibold">
                        {author?.handle?.charAt(0).toUpperCase() || 'U'}
                      </span>
                    </div>
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1 min-w-0">
                      <span className="font-semibold text-sm truncate" style={{ color: 'var(--bsky-text-primary)' }}>
                        {author?.displayName || author?.handle || 'Unknown'}
                      </span>
                      <span className="text-xs flex-shrink-0" style={{ color: 'var(--bsky-text-secondary)' }}>
                        @{author?.handle || 'unknown'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <time className="text-xs" style={{ color: 'var(--bsky-text-tertiary)' }}>
                        {formatDistanceToNow(
                          new Date((post?.record as any)?.createdAt || post?.indexedAt || Date.now()), 
                          { addSuffix: true }
                        )}
                      </time>
                      <ExternalLink size={14} style={{ color: 'var(--bsky-text-tertiary)' }} />
                    </div>
                  </div>
                  
                  <p className="text-sm break-words" style={{ color: 'var(--bsky-text-primary)', lineHeight: '1.5' }}>
                    {post ? ((post.record as any)?.text || '[No text]') : (
                      <span style={{ color: 'var(--bsky-text-secondary)' }}>
                        <Loader2 size={14} className="inline animate-spin mr-1" />
                        Loading post content...
                      </span>
                    )}
                  </p>
                  
                  {isUnread && (
                    <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded-full" 
                          style={{ 
                            backgroundColor: 'var(--bsky-primary)', 
                            color: 'white'
                          }}>
                      New
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Render children */}
          {node.children.length > 0 && (
            <div>{renderThreadNodes(node.children)}</div>
          )}
        </div>
      )
    })
  }

  // Always render the UI immediately, even if data is still loading
  // This provides a non-blocking experience
  return (
    <div className="flex h-[calc(100vh-4rem)] relative" style={{ background: 'var(--bsky-bg-primary)' }}>
      {/* Left Panel - Conversations List */}
      <div className={`${selectedConvo ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-96`} 
           style={{ borderRight: '1px solid var(--bsky-border-primary)' }}>
        {/* Search Header */}
        <div className="p-4" style={{ borderBottom: '1px solid var(--bsky-border-primary)' }}>
          <div className="relative">
            <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2" 
                   style={{ color: 'var(--bsky-text-tertiary)' }} />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg bsky-input"
              style={{ 
                background: 'var(--bsky-bg-secondary)',
                border: '1px solid var(--bsky-border-primary)',
                color: 'var(--bsky-text-primary)'
              }}
            />
          </div>
          <p className="text-xs mt-2" style={{ color: 'var(--bsky-text-secondary)' }}>
            Showing {Math.min(5, filteredConversations.length)} of {filteredConversations.length} conversation{filteredConversations.length !== 1 ? 's' : ''} from {replyNotifications.length} reply notifications (DEBUG MODE: Limited to 5)
          </p>
        </div>

        {/* Loading indicator for posts */}
        {percentageFetched < 100 && totalPosts > 0 && (
          <div className="px-4 py-2" style={{ borderBottom: '1px solid var(--bsky-border-primary)' }}>
            <div className="flex items-center gap-2">
              <Loader2 size={16} className="animate-spin" style={{ color: 'var(--bsky-primary)' }} />
              <span className="text-xs" style={{ color: 'var(--bsky-text-secondary)' }}>
                Loading posts... {fetchedPosts}/{totalPosts} ({percentageFetched}%)
              </span>
            </div>
            <div className="mt-1 h-1 rounded-full overflow-hidden" style={{ background: 'var(--bsky-bg-secondary)' }}>
              <div 
                className="h-full transition-all duration-300" 
                style={{ 
                  width: `${percentageFetched}%`,
                  background: 'var(--bsky-primary)' 
                }}
              />
            </div>
          </div>
        )}

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto">
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
          ) : filteredConversations.slice(0, 10).map((convo, index) => {
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
            
            return (
              <ConversationItem
                key={convo.rootUri}
                convo={convo}
                isSelected={selectedConvo === convo.rootUri}
                onClick={() => setSelectedConvo(convo.rootUri)}
                allPostsMap={allPostsMap}
                session={session}
                filteredConversationsIndex={index}
                isLoadingRootPost={isLoadingRootPost}
              />
            )
          })}
        </div>
      </div>

      {/* Right Panel - Conversation View */}
      {selectedConvo && selectedConversation && (
        <div className="flex-1 flex flex-col">
          {/* Conversation Header */}
          <div className="p-4 flex items-center justify-between" 
               style={{ borderBottom: '1px solid var(--bsky-border-primary)' }}>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedConvo(null)}
                className="md:hidden p-2 rounded-lg hover:bg-opacity-10 hover:bg-blue-500 transition-all"
              >
                <ArrowLeft size={20} style={{ color: 'var(--bsky-text-secondary)' }} />
              </button>
              
              <div className="flex items-center gap-2">
                <MessageCircle size={20} style={{ color: 'var(--bsky-text-secondary)' }} />
                <div>
                  <h2 className="font-semibold" style={{ color: 'var(--bsky-text-primary)' }}>
                    Thread with {selectedConversation.participants.size} participant{selectedConversation.participants.size !== 1 ? 's' : ''}
                  </h2>
                  <p className="text-sm" style={{ color: 'var(--bsky-text-secondary)' }}>
                    {selectedConversation.totalReplies} repl{selectedConversation.totalReplies === 1 ? 'y' : 'ies'}
                  </p>
                </div>
              </div>
            </div>

            <a
              href={getNotificationUrl(selectedConversation.latestReply)}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg hover:bg-opacity-10 hover:bg-blue-500 transition-all flex items-center gap-1"
              style={{ color: 'var(--bsky-text-secondary)' }}
            >
              <ExternalLink size={20} />
              <span className="text-sm">View on Bluesky</span>
            </a>
          </div>

          {/* Thread View */}
          <div className="flex-1 overflow-y-auto p-4" ref={threadContainerRef}>
            {threadTree && renderThreadNodes(threadTree)}
          </div>
        </div>
      )}

      {/* Empty state when no conversation selected (desktop only) */}
      {!selectedConvo && (
        <div className="hidden md:flex flex-1 items-center justify-center">
          <div className="text-center">
            <MessageCircle size={64} className="mx-auto mb-4" style={{ color: 'var(--bsky-text-tertiary)' }} />
            <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--bsky-text-primary)' }}>Select a conversation</h2>
            <p style={{ color: 'var(--bsky-text-secondary)' }}>Choose a conversation thread from the left to view replies</p>
          </div>
        </div>
      )}
    </div>
  )
}
