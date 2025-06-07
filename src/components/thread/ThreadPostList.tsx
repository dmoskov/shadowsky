import React from 'react'
import { motion } from 'framer-motion'
import { MessageCircle } from 'lucide-react'
import clsx from 'clsx'
import { PostCard } from '../feed/PostCard'
import { ErrorBoundary } from '../core/ErrorBoundary'
import { ThreadLine } from './ThreadLine'
import { ThreadService } from '../../services/atproto/thread'
import type { Post, FeedItem } from '../../types/atproto'
import type { ThreadViewPost } from '../../services/atproto/thread'
import type { AppBskyFeedDefs } from '@atproto/api'

interface ThreadPostListProps {
  thread: ThreadViewPost
  onReply: (post: Post) => void
  onViewThread: (uri: string) => void
}

export const ThreadPostList: React.FC<ThreadPostListProps> = ({
  thread,
  onReply,
  onViewThread
}) => {
  // Get ancestors
  const ancestors = ThreadService.getAncestors(thread)
  
  // Convert ThreadViewPost to FeedItem for PostCard
  const threadPostToFeedItem = (post: ThreadViewPost): FeedItem => ({
    post: post.post,
    reply: post.parent ? {
      root: ancestors[0]?.post || post.post,
      parent: (post.parent as ThreadViewPost).post
    } : undefined
  })

  return (
    <div className="thread-posts">
      {/* Ancestors (parent posts) */}
      {ancestors.map((ancestor, index) => (
        <motion.div
          key={ancestor.post.uri}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
          className="thread-ancestor"
          data-post-uri={ancestor.post.uri}
          data-author-handle={ancestor.post.author.handle}
        >
          <ErrorBoundary
            fallback={(_, reset) => (
              <div className="post-error card">
                <p className="error-text">Failed to display post</p>
                <button onClick={reset} className="btn btn-secondary btn-sm">
                  Retry
                </button>
              </div>
            )}
          >
            <PostCard 
              item={threadPostToFeedItem(ancestor)}
              onReply={onReply}
              showParentPost={false}
            />
          </ErrorBoundary>
        </motion.div>
      ))}
      
      {/* Main post */}
      <motion.div
        className="thread-main-post"
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: ancestors.length * 0.05 }}
        data-post-uri={thread.post.uri}
        data-author-handle={thread.post.author.handle}
      >
        <ErrorBoundary
          fallback={(_, reset) => (
            <div className="post-error card">
              <p className="error-text">Failed to display post</p>
              <button onClick={reset} className="btn btn-secondary btn-sm">
                Retry
              </button>
            </div>
          )}
        >
          <div className="thread-focal-post">
            <PostCard 
              item={threadPostToFeedItem(thread)}
              onReply={onReply}
              onViewThread={onViewThread}
              showParentPost={false}
            />
            <div className="focal-post-indicator">Main Post</div>
          </div>
        </ErrorBoundary>
      </motion.div>
      
      {/* Descendants (replies) */}
      {thread.replies && thread.replies.length > 0 && (
        <div className="thread-replies">
          <div className="thread-replies-header">
            <MessageCircle size={18} />
            <span>{countAllReplies(thread)} {countAllReplies(thread) === 1 ? 'Reply' : 'Replies'}</span>
          </div>
          
          {renderThreadReplies(thread.replies, 0, onReply, onViewThread, ancestors, thread.post.author.handle)}
        </div>
      )}
    </div>
  )
}

// Helper function to count all replies recursively
function countAllReplies(thread: ThreadViewPost): number {
  let count = 0
  
  const countReplies = (node: ThreadViewPost) => {
    if (node.replies && Array.isArray(node.replies)) {
      for (const reply of node.replies) {
        if (reply.$type === 'app.bsky.feed.defs#threadViewPost') {
          count++
          countReplies(reply as ThreadViewPost)
        }
      }
    }
  }
  
  countReplies(thread)
  return count
}

// Render nested replies with proper hierarchy
function renderThreadReplies(
  replies: AppBskyFeedDefs.ThreadViewPost[] | AppBskyFeedDefs.NotFoundPost[] | AppBskyFeedDefs.BlockedPost[] | { $type: string }[],
  depth: number,
  onReply: (post: Post) => void,
  onViewThread: (uri: string) => void,
  ancestors: ThreadViewPost[],
  parentAuthor?: string
): React.ReactNode {
  if (!replies || !Array.isArray(replies)) return null
  
  return replies.map((reply, index) => {
    if (reply.$type !== 'app.bsky.feed.defs#threadViewPost') return null
    
    const threadReply = reply as ThreadViewPost
    const hasReplies = threadReply.replies && threadReply.replies.length > 0
    const isLastReply = index === replies.length - 1
    const originalPosterDid = ancestors[0]?.post.author.did
    const isOriginalPoster = threadReply.post.author.did === originalPosterDid
    
    return (
      <div key={`${threadReply.post.uri}-${depth}-${index}`} className="thread-branch">
        {/* Thread connection lines */}
        <ThreadLine 
          depth={depth}
          isLast={isLastReply}
          hasReplies={hasReplies}
        />
        
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: Math.min(index * 0.05, 0.5) }}
          className={clsx(
            "thread-post-nested",
            `depth-${Math.min(depth, 5)}`,
            { "depth-max": depth > 5 }
          )}
          data-post-uri={threadReply.post.uri}
          data-author-handle={threadReply.post.author.handle}
        >
          <ErrorBoundary
            fallback={(_, reset) => (
              <div className="post-error card">
                <p className="error-text">Failed to display reply</p>
                <button onClick={reset} className="btn btn-secondary btn-sm">
                  Retry
                </button>
              </div>
            )}
          >
            <div className={clsx("thread-post-wrapper", { 
              "has-replies": hasReplies,
              "is-op": isOriginalPoster 
            })}>
              <PostCard 
                item={{
                  post: threadReply.post,
                  reply: threadReply.parent && threadReply.parent.$type === 'app.bsky.feed.defs#threadViewPost' ? {
                    root: ancestors[0]?.post || threadReply.post,
                    parent: (threadReply.parent as ThreadViewPost).post
                  } : undefined
                }}
                onReply={onReply}
                onViewThread={onViewThread}
                showParentPost={false}
              />
              
              {/* Original poster indicator */}
              {isOriginalPoster && depth > 0 && (
                <span className="is-op-indicator">OP</span>
              )}
            </div>
          </ErrorBoundary>
        </motion.div>
        
        {/* Render nested replies */}
        {hasReplies && (
          <div className="thread-children">
            {renderThreadReplies(
              threadReply.replies!, 
              depth + 1, 
              onReply, 
              onViewThread, 
              ancestors,
              threadReply.post.author.handle
            )}
          </div>
        )}
      </div>
    )
  })
}