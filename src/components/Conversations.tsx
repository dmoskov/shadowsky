import React, { useState, useMemo, useRef } from 'react'
import { MessageCircle, Search, ArrowLeft, Users, Loader2, ExternalLink, CornerDownRight, ChevronDown } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { formatDistanceToNow } from 'date-fns'
import { useReplyNotificationsFromCache } from '../hooks/useReplyNotificationsFromCache'
import { useNotificationPosts } from '../hooks/useNotificationPosts'
import { usePostsByUris } from '../hooks/usePostsByUris'
import { useQueryClient } from '@tanstack/react-query'
import type { Notification } from '@atproto/api/dist/client/types/app/bsky/notification/listNotifications'
import { getNotificationUrl, atUriToBskyUrl } from '../utils/url-helpers'
import type { AppBskyFeedDefs } from '@atproto/api'
import { debug } from '@bsky/shared'
import { proxifyBskyImage } from '../utils/image-proxy'

type Post = AppBskyFeedDefs.PostView
import '../styles/conversations.css'

// Component to render quote post embeds
const QuoteEmbed: React.FC<{ embed: any }> = ({ embed }) => {
  if (!embed || embed.$type !== 'app.bsky.embed.record#view') return null
  
  const record = embed.record
  if (record.$type !== 'app.bsky.embed.record#viewRecord') {
    // Handle deleted or blocked posts
    return (
      <div className="mt-2 p-3 rounded-lg" 
           style={{ 
             backgroundColor: 'var(--bsky-bg-tertiary)',
             border: '1px solid var(--bsky-border-primary)'
           }}>
        <p className="text-sm italic" style={{ color: 'var(--bsky-text-tertiary)' }}>
          {record.$type === 'app.bsky.embed.record#viewBlocked' 
            ? 'Blocked post' 
            : 'Post not found'}
        </p>
      </div>
    )
  }
  
  const quotedPost = record as any
  const author = quotedPost.author
  const postRecord = quotedPost.value
  
  return (
    <div className="mt-2 rounded-lg overflow-hidden cursor-pointer transition-all hover:bg-opacity-5 hover:bg-blue-500"
         style={{ 
           backgroundColor: 'var(--bsky-bg-tertiary)',
           border: '1px solid var(--bsky-border-primary)'
         }}
         onClick={(e) => {
           e.stopPropagation()
           if (quotedPost.uri && author?.handle) {
             const url = atUriToBskyUrl(quotedPost.uri, author.handle)
             if (url) {
               window.open(url, '_blank', 'noopener,noreferrer')
             }
           }
         }}>
      <div className="p-3">
        {/* Mini header */}
        <div className="flex items-center gap-2 mb-2">
          {author?.avatar ? (
            <img 
              src={proxifyBskyImage(author.avatar)} 
              alt={author.handle}
              className="w-4 h-4 rounded-full object-cover"
            />
          ) : (
            <div className="w-4 h-4 rounded-full flex items-center justify-center" 
                 style={{ backgroundColor: 'var(--bsky-bg-secondary)' }}>
              <span className="text-xs">{author?.handle?.charAt(0) || 'U'}</span>
            </div>
          )}
          <div className="flex items-baseline gap-1 text-xs min-w-0">
            <span className="font-medium truncate" style={{ color: 'var(--bsky-text-primary)' }}>
              {author?.displayName || author?.handle}
            </span>
            <span className="truncate" style={{ color: 'var(--bsky-text-secondary)' }}>
              @{author?.handle}
            </span>
          </div>
        </div>
        
        {/* Quote content */}
        {postRecord?.text && (
          <p className="text-sm whitespace-pre-wrap break-words" 
             style={{ color: 'var(--bsky-text-secondary)', lineHeight: '1.4' }}>
            {postRecord.text}
          </p>
        )}
      </div>
    </div>
  )
}

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

export const Conversations: React.FC = () => {
  const { } = useAuth()
  const [selectedConvo, setSelectedConvo] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const threadContainerRef = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()

  // Use the cache-aware hook which automatically checks extended notifications cache
  const { 
    data, 
    isLoading, 
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFromCache
  } = useReplyNotificationsFromCache()

  // Extract reply notifications from the data
  const replyNotifications = React.useMemo(() => {
    if (!data?.pages) return []
    return data.pages.flatMap((page: any) => page.notifications)
  }, [data])

  // Fetch posts for the reply notifications
  const { 
    data: posts, 
    isLoading: isLoadingPosts,
    isFetchingMore: isFetchingMorePosts,
    percentageFetched: postsPercentageFetched
  } = useNotificationPosts(replyNotifications)

  // Create initial map for reply posts
  const replyPostMap = React.useMemo(() => {
    if (!posts || !Array.isArray(posts) || posts.length === 0) return new Map()
    return new Map(posts.map((post: Post) => [post.uri, post]))
  }, [posts])

  // Collect unique root post URIs that need to be fetched
  const rootPostUris = React.useMemo(() => {
    const rootUris = new Set<string>()
    
    replyNotifications.forEach((notification: Notification) => {
      // Get the root post URI from the notification
      let rootUri = notification.reasonSubject || notification.uri
      
      // If this is a reply, try to find the actual root of the thread
      const post = replyPostMap.get(notification.uri)
      const record = post?.record as any
      if (record?.reply?.root?.uri) {
        rootUri = record.reply.root.uri
      }
      
      // Only add if we don't already have this post
      if (rootUri && !replyPostMap.has(rootUri)) {
        rootUris.add(rootUri)
      }
    })
    
    return Array.from(rootUris)
  }, [replyNotifications, replyPostMap])

  // Fetch the root posts that we don't have
  const { data: rootPosts, isLoading: isLoadingRootPosts } = usePostsByUris(rootPostUris)

  // Create combined map with all posts (replies + roots)
  const postMap = React.useMemo(() => {
    const map = new Map<string, Post>()
    
    // Add reply posts
    if (posts && Array.isArray(posts) && posts.length > 0) {
      posts.forEach((post: Post) => {
        if (post && post.uri) {
          map.set(post.uri, post)
        }
      })
    }
    
    // Add root posts
    if (rootPosts && rootPosts.length > 0) {
      rootPosts.forEach(post => {
        if (post && post.uri) {
          map.set(post.uri, post)
        }
      })
    }
    
    return map
  }, [posts, rootPosts])
  
  // Add debug logging
  React.useEffect(() => {
    debug.log('[Conversations] Loading state:', { 
      isLoading, 
      isLoadingPosts,
      isLoadingRootPosts,
      isFromCache,
      hasData: !!data, 
      pageCount: data?.pages?.length,
      notificationCount: replyNotifications.length,
      postCount: (Array.isArray(posts) ? posts.length : 0),
      rootPostCount: (Array.isArray(rootPosts) ? rootPosts.length : 0)
    })
  }, [isLoading, isLoadingPosts, isLoadingRootPosts, isFromCache, data, replyNotifications.length, posts, rootPosts])

  // Group notifications into conversation threads
  const conversations = useMemo(() => {
    const threadMap = new Map<string, ConversationThread>()
    
    replyNotifications.forEach((notification: Notification) => {
      // Get the root post URI from the notification
      let rootUri = notification.reasonSubject || notification.uri
      
      // If this is a reply, try to find the actual root of the thread
      const post = postMap.get(notification.uri)
      const record = post?.record as any
      if (record?.reply?.root?.uri) {
        rootUri = record.reply.root.uri
      }
      
      if (!threadMap.has(rootUri)) {
        const rootPost = postMap.get(rootUri)
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
      
      // Update latest reply if this one is newer
      if (new Date(notification.indexedAt) > new Date(thread.latestReply.indexedAt)) {
        thread.latestReply = notification
      }
    })
    
    // Sort conversations by latest activity
    return Array.from(threadMap.values()).sort((a, b) => 
      new Date(b.latestReply.indexedAt).getTime() - new Date(a.latestReply.indexedAt).getTime()
    )
  }, [replyNotifications, postMap])

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
        const replyPost = postMap.get(reply.uri)
        const replyRecord = replyPost?.record as any
        return replyRecord?.text?.toLowerCase().includes(searchQuery.toLowerCase())
      })
      
      return participantMatch || rootPostMatch || replyMatch
    })
  }, [conversations, searchQuery, postMap])

  // Get the selected conversation
  const selectedConversation = useMemo(() => {
    return conversations.find(c => c.rootUri === selectedConvo)
  }, [conversations, selectedConvo])

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
      // If we don't have the root post yet, create a placeholder
      // This prevents the first reply from being shown as root
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
      const post = postMap.get(notification.uri)
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
      const post = postMap.get(notification.uri)
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
  }, [selectedConversation, postMap])

  // Load more reply notifications automatically and aggressively (only if not from cache)
  React.useEffect(() => {
    if (!isFromCache && data?.pages && hasNextPage && !isFetchingNextPage) {
      // For conversations, we want to fetch more aggressively to get a good thread view
      const currentNotificationCount = data.pages.reduce((sum, page) => sum + page.notifications.length, 0)
      
      // Keep fetching until we have at least 150 reply notifications or no more pages
      // This ensures we get enough data for good conversation threads
      if (currentNotificationCount < 150) {
        fetchNextPage()
      }
    }
  }, [isFromCache, data?.pages, hasNextPage, isFetchingNextPage, fetchNextPage])


  // Render thread nodes recursively
  const renderThreadNodes = (nodes: ThreadNode[], postMap: Map<string, Post>) => {
    return nodes.map((node) => {
      const post = node.post
      const notification = node.notification
      const isUnread = notification && !notification.isRead
      const author = post?.author || notification?.author
      const postUrl = post?.uri && author?.handle 
        ? atUriToBskyUrl(post.uri, author.handle) 
        : notification ? getNotificationUrl(notification) : null

      // Handle root node without post - since we wait for all posts to load, this is truly unavailable
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
                    Original post unavailable
                  </p>
                  <p className="text-xs" style={{ color: 'var(--bsky-text-tertiary)' }}>
                    The post may have been deleted or is not accessible
                  </p>
                </div>
              </div>
            </div>
            {/* Render children even if root is unavailable */}
            {node.children.length > 0 && (
              <div>{renderThreadNodes(node.children, postMap)}</div>
            )}
          </div>
        )
      }
      
      // If root post is missing but we're not loading, just skip rendering it
      if (node.isRoot && !post) {
        // Still render children
        if (node.children.length > 0) {
          return <div key={selectedConversation?.rootUri || Math.random()}>{renderThreadNodes(node.children, postMap)}</div>
        }
        return null
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
              } ${
                notification?.uri === selectedConversation?.latestReply.uri ? 'ring-2 ring-blue-500 ring-opacity-50' : ''
              }`}
              style={{ 
                backgroundColor: node.isRoot 
                  ? 'var(--bsky-bg-secondary)'
                  : (notification?.uri === selectedConversation?.latestReply.uri 
                    ? 'var(--bsky-bg-tertiary)' 
                    : (isUnread ? 'var(--bsky-bg-primary)' : 'var(--bsky-bg-secondary)')),
                border: notification?.uri === selectedConversation?.latestReply.uri 
                  ? '2px solid var(--bsky-primary)' 
                  : '1px solid var(--bsky-border-primary)'
              }}
              onClick={() => {
                if (postUrl) {
                  window.open(postUrl, '_blank', 'noopener,noreferrer')
                }
              }}
              data-notification-uri={notification?.uri || ''}
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
                  {(post || selectedConversation?.originalPostTime) && (
                    <span className="text-xs" style={{ color: 'var(--bsky-text-tertiary)' }}>
                      {formatDistanceToNow(
                        new Date(
                          (post?.record as any)?.createdAt || 
                          post?.indexedAt || 
                          selectedConversation?.originalPostTime || 
                          Date.now()
                        ), 
                        { addSuffix: true }
                      )}
                    </span>
                  )}
                </div>
              )}

              {/* Mark the most recent notification */}
              {!node.isRoot && notification?.uri === selectedConversation?.latestReply.uri && (
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium px-2 py-1 rounded-full animate-pulse" 
                        style={{ 
                          backgroundColor: 'var(--bsky-primary)', 
                          color: 'white'
                        }}>
                    Most Recent Notification
                  </span>
                  <span className="text-xs" style={{ color: 'var(--bsky-text-secondary)' }}>
                    triggered {formatDistanceToNow(new Date(notification?.indexedAt || Date.now()), { addSuffix: true })}
                  </span>
                </div>
              )}

              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  {author?.avatar ? (
                    <img 
                      src={proxifyBskyImage(author.avatar)} 
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
                    <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                      <div className="flex items-center gap-2">
                        <time className="text-xs" style={{ color: 'var(--bsky-text-tertiary)' }}>
                          {formatDistanceToNow(
                            new Date((post?.record as any)?.createdAt || post?.indexedAt || Date.now()), 
                            { addSuffix: true }
                          )}
                        </time>
                        <ExternalLink size={14} style={{ color: 'var(--bsky-text-tertiary)' }} />
                      </div>
                      {notification && !node.isRoot && (
                        <span className="text-xs" style={{ color: 'var(--bsky-text-tertiary)' }}>
                          notified {formatDistanceToNow(new Date(notification.indexedAt), { addSuffix: true })}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <p className="text-sm break-words" style={{ color: 'var(--bsky-text-primary)', lineHeight: '1.5' }}>
                    {(post?.record as any)?.text || '[No text]'}
                  </p>

                  {/* Render quote post if present */}
                  {post?.embed && <QuoteEmbed embed={post.embed} />}

                  {/* Engagement metrics */}
                  {post && ((post.replyCount ?? 0) > 0 || (post.repostCount ?? 0) > 0 || (post.likeCount ?? 0) > 0) && (
                    <div className="flex items-center gap-4 mt-2">
                      {(post.replyCount ?? 0) > 0 && (
                        <span className="text-xs flex items-center gap-1" style={{ color: 'var(--bsky-text-tertiary)' }}>
                          <MessageCircle size={12} />
                          {post.replyCount}
                        </span>
                      )}
                      {(post.repostCount ?? 0) > 0 && (
                        <span className="text-xs flex items-center gap-1" style={{ color: 'var(--bsky-text-tertiary)' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3" />
                          </svg>
                          {post.repostCount}
                        </span>
                      )}
                      {(post.likeCount ?? 0) > 0 && (
                        <span className="text-xs flex items-center gap-1" style={{ color: 'var(--bsky-text-tertiary)' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                          </svg>
                          {post.likeCount}
                        </span>
                      )}
                    </div>
                  )}
                  
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
            <div>{renderThreadNodes(node.children, postMap)}</div>
          )}
        </div>
      )
    })
  }

  // Show loading state only on initial load when we have no data at all
  // Also wait for posts to be fully loaded (100% fetched) - but only if we have posts to load
  const actualIsLoading = isFromCache ? false : isLoading
  const needsPosts = replyNotifications.length > 0
  const postsStillLoading = needsPosts && postsPercentageFetched < 100
  const rootPostsStillLoading = rootPostUris.length > 0 && isLoadingRootPosts
  
  // Don't show loading if we're from cache and posts are ready or not needed
  const showLoading = (actualIsLoading && !data) || 
                     (needsPosts && (postsStillLoading || rootPostsStillLoading))
  
  if (showLoading) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: 'var(--bsky-bg-primary)' }}>
        <div className="text-center">
          <Loader2 size={32} className="animate-spin mb-4 mx-auto" style={{ color: 'var(--bsky-primary)' }} />
          <p style={{ color: 'var(--bsky-text-secondary)' }}>
            {postsStillLoading 
              ? `Loading conversation posts... ${postsPercentageFetched}%`
              : rootPostsStillLoading
              ? 'Loading original posts...'
              : 'Loading conversations...'
            }
          </p>
        </div>
      </div>
    )
  }

  // Show error or empty state (but not while loading more pages)
  if ((error || conversations.length === 0) && !isFetchingNextPage) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: 'var(--bsky-bg-primary)' }}>
        <div className="text-center max-w-md">
          <MessageCircle size={64} className="mx-auto mb-4" style={{ color: 'var(--bsky-text-tertiary)' }} />
          <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--bsky-text-primary)' }}>No Conversations Yet</h2>
          <p style={{ color: 'var(--bsky-text-secondary)' }}>
            {error ? 'Failed to load conversations.' : 'Reply notifications will appear here as conversations.'}
          </p>
        </div>
      </div>
    )
  }

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
            Showing {filteredConversations.length} conversation{filteredConversations.length !== 1 ? 's' : ''} from {replyNotifications.length} reply notifications
            {isFetchingNextPage && !isLoading && ' (loading more...)'}
          </p>
          <p className="text-xs mt-1 flex items-center gap-1" style={{ color: 'var(--bsky-text-tertiary)' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 3v18h18M21 9l-7 7-4-4-5 5" />
            </svg>
            Sorted by most recent notification activity
          </p>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.map((convo) => {
            const isSelected = selectedConvo === convo.rootUri
            // Always use root post for preview text
            // Never show reply text as the subject - only show the original post
            const rootRecord = convo.rootPost?.record as any
            const previewText = rootRecord?.text || '[Loading original post...]'
            const isGroup = convo.participants.size > 2
            const unreadCount = convo.replies.filter(r => !r.isRead).length

            // Get the latest reply post for preview
            const latestReplyPost = postMap.get(convo.latestReply.uri)
            const latestReplyRecord = latestReplyPost?.record as any
            const latestReplyText = latestReplyRecord?.text || '[Loading reply...]'

            return (
              <button
                key={convo.rootUri}
                onClick={() => setSelectedConvo(convo.rootUri)}
                className={`w-full text-left p-4 transition-all hover:bg-opacity-10 hover:bg-blue-500 ${
                  isSelected ? 'bg-opacity-10 bg-blue-500' : ''
                }`}
                style={{ borderBottom: '1px solid var(--bsky-border-primary)' }}
              >
                <div className="flex items-center gap-3">
                  {/* Clean avatar display */}
                  <div className="relative flex-shrink-0">
                    {isGroup ? (
                      // Group avatar - simple stacked view
                      <div className="w-12 h-12 rounded-full flex items-center justify-center"
                           style={{ background: 'var(--bsky-bg-secondary)' }}>
                        <Users size={24} style={{ color: 'var(--bsky-text-tertiary)' }} />
                      </div>
                    ) : (
                      // Single avatar - use root post author
                      <>
                        {(convo.rootPost?.author?.avatar || convo.latestReply.author.avatar) ? (
                          <img 
                            src={proxifyBskyImage(convo.rootPost?.author?.avatar || convo.latestReply.author.avatar)} 
                            alt=""
                            className="w-12 h-12 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bsky-gradient flex items-center justify-center text-white font-medium">
                            {convo.rootPost?.author?.displayName?.[0] || convo.rootPost?.author?.handle?.[0] || 
                             convo.latestReply.author.displayName?.[0] || convo.latestReply.author.handle?.[0] || 'U'}
                          </div>
                        )}
                      </>
                    )}
                    {/* Unread indicator dot */}
                    {unreadCount > 0 && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs text-white font-medium"
                           style={{ background: 'var(--bsky-primary)' }}>
                        {unreadCount}
                      </div>
                    )}
                  </div>

                  {/* Simplified content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-medium truncate" style={{ color: 'var(--bsky-text-primary)' }}>
                        {convo.rootPost?.author?.displayName || 
                         (isGroup 
                          ? `${convo.participants.size} people`
                          : 'Thread')
                        }
                      </h3>
                      <span className="text-xs" style={{ color: 'var(--bsky-text-secondary)' }}>
                        {formatDistanceToNow(new Date(convo.latestReply.indexedAt), { addSuffix: true })}
                      </span>
                    </div>
                    
                    {/* Single line preview of original post */}
                    <p className="text-sm truncate mb-1" style={{ color: 'var(--bsky-text-secondary)' }}>
                      {previewText.length > 80 ? previewText.substring(0, 80) + '...' : previewText}
                    </p>
                    
                    {/* Simple metadata */}
                    <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--bsky-text-tertiary)' }}>
                      <span>{convo.totalReplies} repl{convo.totalReplies === 1 ? 'y' : 'ies'}</span>
                      {isGroup && (
                        <span>{convo.participants.size} participants</span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
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
                    {selectedConversation.totalReplies} repl{selectedConversation.totalReplies === 1 ? 'y' : 'ies'} • 
                    <span style={{ color: 'var(--bsky-primary)' }}>
                      Most recent: {formatDistanceToNow(new Date(selectedConversation.latestReply.indexedAt), { addSuffix: true })}
                    </span>
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
            {/* Most Recent Notification Summary Card */}
            {selectedConversation && (() => {
              const latestReplyPost = postMap.get(selectedConversation.latestReply.uri)
              const latestReplyRecord = latestReplyPost?.record as any
              const latestReplyAuthor = selectedConversation.latestReply.author
              const latestReplyText = latestReplyRecord?.text || '[Loading reply...]'
              const latestReplyUrl = latestReplyPost?.uri && latestReplyAuthor?.handle 
                ? atUriToBskyUrl(latestReplyPost.uri, latestReplyAuthor.handle) 
                : (getNotificationUrl(selectedConversation.latestReply) || undefined)
              
              return (
                <div className="mb-4 p-4 rounded-lg shadow-sm" 
                     style={{ 
                       backgroundColor: 'var(--bsky-bg-tertiary)',
                       border: '2px solid var(--bsky-primary)'
                     }}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wide px-2 py-1 rounded" 
                            style={{ 
                              backgroundColor: 'var(--bsky-primary)', 
                              color: 'white'
                            }}>
                        Most Recent Notification
                      </span>
                      <span className="text-xs" style={{ color: 'var(--bsky-text-secondary)' }}>
                        {formatDistanceToNow(new Date(selectedConversation.latestReply.indexedAt), { addSuffix: true })}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        const mostRecentElement = document.querySelector(`[data-notification-uri="${selectedConversation.latestReply.uri}"]`)
                        if (mostRecentElement) {
                          mostRecentElement.scrollIntoView({
                            behavior: 'smooth',
                            block: 'center'
                          })
                          // Add highlight effect
                          mostRecentElement.classList.add('highlight-recent')
                          setTimeout(() => {
                            mostRecentElement.classList.remove('highlight-recent')
                          }, 2000)
                        }
                      }}
                      className="text-xs px-2 py-1 rounded hover:bg-opacity-10 hover:bg-blue-500 transition-all flex items-center gap-1"
                      style={{ color: 'var(--bsky-primary)' }}
                    >
                      <ChevronDown size={14} />
                      Jump to context
                    </button>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="flex-shrink-0">
                      {latestReplyAuthor?.avatar ? (
                        <img 
                          src={proxifyBskyImage(latestReplyAuthor.avatar)} 
                          alt={latestReplyAuthor.handle}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full flex items-center justify-center" 
                             style={{ background: 'var(--bsky-bg-secondary)' }}>
                          <span className="text-sm font-semibold">
                            {latestReplyAuthor?.handle?.charAt(0).toUpperCase() || 'U'}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-1 mb-1">
                        <span className="font-semibold text-sm" style={{ color: 'var(--bsky-text-primary)' }}>
                          {latestReplyAuthor?.displayName || latestReplyAuthor?.handle || 'Unknown'}
                        </span>
                        <span className="text-xs" style={{ color: 'var(--bsky-text-secondary)' }}>
                          @{latestReplyAuthor?.handle || 'unknown'}
                        </span>
                        <span className="text-xs" style={{ color: 'var(--bsky-text-tertiary)' }}>
                          replied to this thread
                        </span>
                      </div>
                      
                      <p className="text-sm mb-2" style={{ color: 'var(--bsky-text-primary)', lineHeight: '1.4' }}>
                        {latestReplyText.length > 200 ? latestReplyText.substring(0, 200) + '...' : latestReplyText}
                      </p>
                      
                      <a
                        href={latestReplyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs hover:underline"
                        style={{ color: 'var(--bsky-primary)' }}
                      >
                        <ExternalLink size={12} />
                        View on Bluesky
                      </a>
                    </div>
                  </div>
                </div>
              )
            })()}
            
            {/* Thread content */}
            {threadTree && renderThreadNodes(threadTree, postMap)}
          </div>

          {/* Info Footer */}
          <div className="p-4 text-center" style={{ borderTop: '1px solid var(--bsky-border-primary)' }}>
            <p className="text-sm" style={{ color: 'var(--bsky-text-secondary)' }}>
              This is a read-only view of reply notifications grouped by thread.
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--bsky-text-tertiary)' }}>
              To reply, click "View on Bluesky" above.
            </p>
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