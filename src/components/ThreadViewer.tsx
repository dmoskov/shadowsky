import React, { useMemo, useEffect, useRef } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { CornerDownRight, ExternalLink, Loader2 } from 'lucide-react'
import type { AppBskyFeedDefs } from '@atproto/api'
import type { Notification } from '@atproto/api/dist/client/types/app/bsky/notification/listNotifications'
import { proxifyBskyImage } from '../utils/image-proxy'
import { atUriToBskyUrl, getNotificationUrl } from '../utils/url-helpers'

type Post = AppBskyFeedDefs.PostView

export interface ThreadNode {
  notification?: Notification
  post?: Post
  children: ThreadNode[]
  depth: number
  isRoot?: boolean
}

export interface ThreadViewerProps {
  posts: Post[]
  notifications?: Notification[]
  rootUri?: string
  highlightUri?: string
  onPostClick?: (uri: string) => void
  showUnreadIndicators?: boolean
  className?: string
}

export const ThreadViewer: React.FC<ThreadViewerProps> = ({
  posts,
  notifications = [],
  rootUri,
  highlightUri,
  onPostClick,
  showUnreadIndicators = true,
  className = ''
}) => {
  // Create a map of posts by URI
  const postMap = useMemo(() => {
    const map = new Map<string, Post>()
    posts.forEach(post => {
      if (post?.uri) {
        map.set(post.uri, post)
      }
    })
    return map
  }, [posts])

  // Create a map of notifications by URI
  const notificationMap = useMemo(() => {
    const map = new Map<string, Notification>()
    notifications.forEach(notification => {
      if (notification?.uri) {
        map.set(notification.uri, notification)
      }
    })
    return map
  }, [notifications])

  // Build thread tree structure
  const threadTree = useMemo(() => {
    const nodeMap = new Map<string, ThreadNode>()
    const rootNodes: ThreadNode[] = []
    
    // First, create all nodes
    posts.forEach(post => {
      const node: ThreadNode = {
        post,
        notification: notificationMap.get(post.uri),
        children: [],
        depth: 0
      }
      nodeMap.set(post.uri, node)
    })
    
    // Determine the root URI if not provided
    const actualRootUri = rootUri || (() => {
      // Find posts that are not replies to any other post in our set
      const childUris = new Set<string>()
      posts.forEach(post => {
        const record = post.record as any
        if (record?.reply?.parent?.uri) {
          childUris.add(post.uri)
        }
      })
      
      // Find posts that aren't children
      const roots = posts.filter(post => !childUris.has(post.uri))
      return roots[0]?.uri
    })()
    
    // Mark root node
    if (actualRootUri && nodeMap.has(actualRootUri)) {
      const rootNode = nodeMap.get(actualRootUri)!
      rootNode.isRoot = true
      rootNodes.push(rootNode)
    }
    
    // Build parent-child relationships
    nodeMap.forEach((childNode, uri) => {
      if (childNode.isRoot) return
      
      const post = childNode.post
      const postRecord = post?.record as any
      const parentUri = postRecord?.reply?.parent?.uri
      
      if (parentUri) {
        const parentNode = nodeMap.get(parentUri)
        
        if (parentNode) {
          parentNode.children.push(childNode)
          childNode.depth = parentNode.depth + 1
        } else if (actualRootUri && rootNodes.length > 0) {
          // Parent not found, attach to root
          rootNodes[0].children.push(childNode)
          childNode.depth = 1
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
    
    // If no root was found, return all orphan nodes
    if (rootNodes.length === 0) {
      nodeMap.forEach(node => {
        if (!node.children.length && !Array.from(nodeMap.values()).some(n => 
          n.children.includes(node)
        )) {
          rootNodes.push(node)
        }
      })
    }
    
    return rootNodes
  }, [posts, notificationMap, rootUri])

  // Find the maximum depth in the thread
  const maxThreadDepth = useMemo(() => {
    let maxDepth = 0
    
    const traverse = (node: ThreadNode) => {
      maxDepth = Math.max(maxDepth, node.depth)
      node.children.forEach(traverse)
    }
    
    threadTree.forEach(traverse)
    return maxDepth
  }, [threadTree])
  
  // Calculate dynamic indentation based on maximum thread depth
  const indentWidth = useMemo(() => {
    if (maxThreadDepth <= 3) return 48
    if (maxThreadDepth <= 5) return 32
    if (maxThreadDepth <= 7) return 24
    if (maxThreadDepth <= 9) return 16
    if (maxThreadDepth <= 12) return 12
    if (maxThreadDepth <= 15) return 8
    if (maxThreadDepth <= 20) return 6
    return 4 // For very deep threads
  }, [maxThreadDepth])
  
  // Ref for the highlighted post
  const highlightRef = useRef<HTMLDivElement>(null)
  
  // Scroll to highlighted post when it's rendered
  useEffect(() => {
    if (highlightUri && highlightRef.current) {
      setTimeout(() => {
        highlightRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        })
      }, 100) // Small delay to ensure DOM is ready
    }
  }, [highlightUri, posts])

  // Render thread nodes recursively
  const renderThreadNodes = (nodes: ThreadNode[]) => {
    return nodes.map((node) => {
      const post = node.post
      const notification = node.notification
      const isUnread = showUnreadIndicators && notification && !notification.isRead
      const isHighlighted = highlightUri && post?.uri === highlightUri
      const author = post?.author || notification?.author
      const postUrl = post?.uri && author?.handle 
        ? atUriToBskyUrl(post.uri, author.handle) 
        : notification ? getNotificationUrl(notification) : null

      return (
        <div 
          key={post?.uri || notification?.uri || `node-${node.depth}`} 
          className="mb-4"
          ref={isHighlighted ? highlightRef : null}
        >
          {/* Thread line connector for nested replies */}
          {node.depth > 0 && (
            <div className="flex">
              <div 
                className="w-8 flex-shrink-0 flex justify-center"
                style={{ marginLeft: `${(node.depth - 1) * indentWidth}px` }}
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
            className="flex"
            style={{ marginLeft: `${node.depth * indentWidth}px` }}
          >
            {/* Branch indicator */}
            {node.depth > 0 && (maxThreadDepth <= 15 || node.depth < 10) && (
              <div className="flex-shrink-0 flex items-start justify-center pt-3"
                   style={{ 
                     width: maxThreadDepth > 10 ? '16px' : maxThreadDepth > 7 ? '24px' : '32px',
                     marginRight: maxThreadDepth > 10 ? '4px' : '0'
                   }}>
                <CornerDownRight 
                  size={maxThreadDepth > 10 ? 10 : maxThreadDepth > 7 ? 12 : 16} 
                  style={{ 
                    color: 'var(--bsky-text-tertiary)',
                    opacity: maxThreadDepth > 15 ? 0.3 : maxThreadDepth > 10 ? 0.5 : 0.7
                  }} 
                />
              </div>
            )}

            {/* Post card */}
            <div 
              className={`flex-1 min-w-0 ${maxThreadDepth > 15 ? 'p-2' : maxThreadDepth > 10 ? 'p-3' : 'p-4'} rounded-lg cursor-pointer transition-all hover:bg-opacity-5 hover:bg-blue-500 ${
                isUnread ? 'ring-2 ring-blue-500 ring-opacity-30' : ''
              } ${isHighlighted ? 'ring-2 ring-orange-500 ring-opacity-50' : ''}`}
              style={{ 
                backgroundColor: isHighlighted 
                  ? 'rgba(251, 146, 60, 0.1)' // Orange highlight background
                  : (node.isRoot 
                    ? 'var(--bsky-bg-secondary)'
                    : (isUnread ? 'var(--bsky-bg-primary)' : 'var(--bsky-bg-secondary)')),
                border: isHighlighted 
                  ? '2px solid rgba(251, 146, 60, 0.5)' 
                  : '1px solid var(--bsky-border-primary)',
                overflow: 'hidden',
                fontSize: maxThreadDepth > 15 ? '0.75rem' : maxThreadDepth > 10 ? '0.875rem' : '1rem'
              }}
              onClick={() => {
                if (onPostClick && post?.uri) {
                  onPostClick(post.uri)
                } else if (postUrl) {
                  window.open(postUrl, '_blank', 'noopener,noreferrer')
                }
              }}
            >
              {(node.isRoot || node.depth > 5) && (
                <div className="flex items-center gap-2 mb-2">
                  {node.isRoot && (
                    <span className="text-xs font-medium px-2 py-1 rounded-full" 
                          style={{ 
                            backgroundColor: 'var(--bsky-bg-primary)', 
                            color: 'var(--bsky-text-secondary)',
                            border: '1px solid var(--bsky-border-primary)'
                          }}>
                      Original Post
                    </span>
                  )}
                  {node.depth > 5 && !node.isRoot && (
                    <span className="text-xs font-medium px-2 py-0.5 rounded" 
                          style={{ 
                            backgroundColor: 'var(--bsky-bg-tertiary)', 
                            color: 'var(--bsky-text-tertiary)',
                            opacity: 0.8
                          }}>
                      Depth: {node.depth}
                    </span>
                  )}
                  {post && node.isRoot && (
                    <span className="text-xs px-2 py-1 rounded" style={{ 
                      color: 'var(--bsky-text-tertiary)',
                      backgroundColor: 'var(--bsky-bg-primary)'
                    }}>
                      {formatDistanceToNow(
                        new Date((post.record as any)?.createdAt || post.indexedAt), 
                        { addSuffix: true }
                      )}
                    </span>
                  )}
                </div>
              )}

              <div className={`flex items-start ${maxThreadDepth > 15 ? 'gap-2' : 'gap-3'}`}>
                <div className="flex-shrink-0">
                  {author?.avatar ? (
                    <img 
                      src={proxifyBskyImage(author.avatar)} 
                      alt={author.handle}
                      className={`${maxThreadDepth > 15 ? 'w-6 h-6' : maxThreadDepth > 10 ? 'w-8 h-8' : 'w-10 h-10'} rounded-full object-cover`}
                    />
                  ) : (
                    <div className={`${maxThreadDepth > 15 ? 'w-6 h-6' : maxThreadDepth > 10 ? 'w-8 h-8' : 'w-10 h-10'} rounded-full flex items-center justify-center`}
                         style={{ background: 'var(--bsky-bg-tertiary)' }}>
                      <span className={`${maxThreadDepth > 15 ? 'text-xs' : 'text-sm'} font-semibold`}>
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
                      <time className="text-xs px-2 py-1 rounded" style={{ 
                        color: 'var(--bsky-text-tertiary)',
                        backgroundColor: 'var(--bsky-bg-primary)'
                      }}>
                        {formatDistanceToNow(
                          new Date((post?.record as any)?.createdAt || post?.indexedAt || Date.now()), 
                          { addSuffix: true }
                        )}
                      </time>
                      <ExternalLink size={14} style={{ color: 'var(--bsky-text-tertiary)' }} />
                    </div>
                  </div>
                  
                  <p className="text-sm break-words overflow-wrap-anywhere" style={{ 
                    color: 'var(--bsky-text-primary)', 
                    lineHeight: '1.5',
                    wordBreak: 'break-word',
                    overflowWrap: 'anywhere'
                  }}>
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

  return (
    <div className={`thread-viewer ${className}`}>
      {threadTree.length > 0 ? (
        renderThreadNodes(threadTree)
      ) : (
        <div className="p-8 text-center">
          <p style={{ color: 'var(--bsky-text-secondary)' }}>
            No posts to display
          </p>
        </div>
      )}
    </div>
  )
}