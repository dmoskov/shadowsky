import React, { useState, useMemo } from 'react'
import { MessageCircle, Search, ArrowLeft, Users, Loader2, ExternalLink, CornerDownRight } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { formatDistanceToNow } from 'date-fns'
import { useNotifications } from '../hooks/useNotifications'
import { useNotificationPosts } from '../hooks/useNotificationPosts'
import type { Notification } from '@atproto/api/dist/client/types/app/bsky/notification/listNotifications'
import { getNotificationUrl, atUriToBskyUrl } from '../utils/url-helpers'
import type { Post } from '@bsky/shared'
import '../styles/conversations.css'

interface ConversationThread {
  rootUri: string
  rootPost?: Post
  replies: Notification[]
  participants: Set<string>
  latestReply: Notification
  totalReplies: number
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

  // Fetch all notifications
  const { 
    data, 
    isLoading, 
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useNotifications()

  const notifications = React.useMemo(() => {
    if (!data?.pages) return []
    return data.pages.flatMap((page: any) => page.notifications)
  }, [data])

  // Filter for reply notifications only
  const replyNotifications = useMemo(() => {
    return notifications.filter((n: Notification) => n.reason === 'reply')
  }, [notifications])

  // Fetch posts for the reply notifications
  const { data: posts } = useNotificationPosts(replyNotifications)

  // Create a map for quick post lookup
  const postMap = React.useMemo(() => {
    if (!posts) return new Map()
    return new Map(posts.map(post => [post.uri, post]))
  }, [posts])

  // Group notifications into conversation threads
  const conversations = useMemo(() => {
    const threadMap = new Map<string, ConversationThread>()
    
    replyNotifications.forEach((notification: Notification) => {
      // Get the root post URI from the notification
      let rootUri = notification.reasonSubject || notification.uri
      
      // If this is a reply, try to find the actual root of the thread
      const post = postMap.get(notification.uri)
      if (post?.record?.reply?.root?.uri) {
        rootUri = post.record.reply.root.uri
      }
      
      if (!threadMap.has(rootUri)) {
        threadMap.set(rootUri, {
          rootUri,
          rootPost: postMap.get(rootUri),
          replies: [],
          participants: new Set(),
          latestReply: notification,
          totalReplies: 0
        })
      }
      
      const thread = threadMap.get(rootUri)!
      thread.replies.push(notification)
      thread.participants.add(notification.author.handle)
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
      const rootPostMatch = convo.rootPost?.record?.text?.toLowerCase().includes(searchQuery.toLowerCase())
      
      // Search in reply text
      const replyMatch = convo.replies.some(reply => {
        const replyPost = postMap.get(reply.uri)
        return replyPost?.record?.text?.toLowerCase().includes(searchQuery.toLowerCase())
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
      if (post?.record?.reply?.parent?.uri) {
        const parentUri = post.record.reply.parent.uri
        const parentNode = nodeMap.get(parentUri)
        const childNode = nodeMap.get(notification.uri)
        
        if (parentNode && childNode) {
          parentNode.children.push(childNode)
          childNode.depth = parentNode.depth + 1
        } else if (childNode && !parentNode) {
          // If parent is not in our notifications, attach to root
          if (rootNodes.length > 0) {
            rootNodes[0].children.push(childNode)
            childNode.depth = 1
          } else {
            rootNodes.push(childNode)
          }
        }
      } else {
        // No parent specified, attach to root
        const node = nodeMap.get(notification.uri)
        if (node && rootNodes.length > 0 && !rootNodes.includes(node)) {
          rootNodes[0].children.push(node)
          node.depth = 1
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

  // Load more notifications automatically
  React.useEffect(() => {
    if (data?.pages && data.pages.length === 1 && hasNextPage && !isFetchingNextPage) {
      // Load at least a few pages automatically
      const loadInitialPages = async () => {
        for (let i = 0; i < 3 && hasNextPage; i++) {
          await fetchNextPage()
        }
      }
      loadInitialPages()
    }
  }, [data?.pages?.length, hasNextPage, isFetchingNextPage, fetchNextPage])

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

      return (
        <div key={post?.uri || notification?.uri || Math.random()} className="mb-4">
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
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <time className="text-xs" style={{ color: 'var(--bsky-text-tertiary)' }}>
                        {formatDistanceToNow(
                          new Date(notification?.indexedAt || post?.indexedAt || Date.now()), 
                          { addSuffix: true }
                        )}
                      </time>
                      <ExternalLink size={14} style={{ color: 'var(--bsky-text-tertiary)' }} />
                    </div>
                  </div>
                  
                  <p className="text-sm break-words" style={{ color: 'var(--bsky-text-primary)', lineHeight: '1.5' }}>
                    {post?.record?.text || '[No text]'}
                  </p>

                  {/* Engagement metrics */}
                  {(post?.replyCount > 0 || post?.repostCount > 0 || post?.likeCount > 0) && (
                    <div className="flex items-center gap-4 mt-2">
                      {post.replyCount > 0 && (
                        <span className="text-xs flex items-center gap-1" style={{ color: 'var(--bsky-text-tertiary)' }}>
                          <MessageCircle size={12} />
                          {post.replyCount}
                        </span>
                      )}
                      {post.repostCount > 0 && (
                        <span className="text-xs flex items-center gap-1" style={{ color: 'var(--bsky-text-tertiary)' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3" />
                          </svg>
                          {post.repostCount}
                        </span>
                      )}
                      {post.likeCount > 0 && (
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

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: 'var(--bsky-bg-primary)' }}>
        <div className="text-center">
          <Loader2 size={32} className="animate-spin mb-4 mx-auto" style={{ color: 'var(--bsky-primary)' }} />
          <p style={{ color: 'var(--bsky-text-secondary)' }}>Loading conversations...</p>
        </div>
      </div>
    )
  }

  // Show error or empty state
  if (error || conversations.length === 0) {
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
    <div className="flex h-[calc(100vh-4rem)]" style={{ background: 'var(--bsky-bg-primary)' }}>
      {/* Left Panel - Conversations List */}
      <div className={`${selectedConvo ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-96`} 
           style={{ borderRight: '1px solid var(--bsky-border-primary)' }}>
        {/* Search Header */}
        <div className="p-4" style={{ borderBottom: '1px solid var(--bsky-border-primary)' }}>
          <h1 className="text-xl font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--bsky-text-primary)' }}>
            <MessageCircle size={24} />
            Conversations
          </h1>
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
            Showing {filteredConversations.length} conversation{filteredConversations.length !== 1 ? 's' : ''} from reply notifications
          </p>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.map((convo) => {
            const isSelected = selectedConvo === convo.rootUri
            const latestReplyPost = postMap.get(convo.latestReply.uri)
            const previewText = latestReplyPost?.record?.text || convo.rootPost?.record?.text || 'No preview available'
            const isGroup = convo.participants.size > 2
            const unreadCount = convo.replies.filter(r => !r.isRead).length

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
                  {/* Avatar */}
                  <div className="relative">
                    {isGroup ? (
                      <div className="w-12 h-12 rounded-full flex items-center justify-center"
                           style={{ background: 'var(--bsky-bg-secondary)' }}>
                        <Users size={24} style={{ color: 'var(--bsky-text-tertiary)' }} />
                      </div>
                    ) : (
                      convo.latestReply.author.avatar ? (
                        <img 
                          src={convo.latestReply.author.avatar} 
                          alt={convo.latestReply.author.handle}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bsky-gradient flex items-center justify-center text-white font-medium">
                          {convo.latestReply.author.displayName?.[0] || convo.latestReply.author.handle?.[0] || 'U'}
                        </div>
                      )
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
                        {isGroup 
                          ? `${convo.participants.size} participants`
                          : (convo.latestReply.author.displayName || convo.latestReply.author.handle || 'Unknown')
                        }
                      </h3>
                      <span className="text-xs" style={{ color: 'var(--bsky-text-tertiary)' }}>
                        {formatDistanceToNow(new Date(convo.latestReply.indexedAt), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm truncate" style={{ color: 'var(--bsky-text-secondary)' }}>
                      {previewText.length > 50 ? previewText.substring(0, 50) + '...' : previewText}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs" style={{ color: 'var(--bsky-text-tertiary)' }}>
                        {convo.totalReplies} repl{convo.totalReplies === 1 ? 'y' : 'ies'}
                      </span>
                      {isGroup && (
                        <span className="text-xs" style={{ color: 'var(--bsky-text-tertiary)' }}>
                          · {Array.from(convo.participants).slice(0, 3).join(', ')}
                          {convo.participants.size > 3 && ` +${convo.participants.size - 3}`}
                        </span>
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
          <div className="flex-1 overflow-y-auto p-4">
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