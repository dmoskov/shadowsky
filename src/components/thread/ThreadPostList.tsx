import React from 'react'
import { motion } from 'framer-motion'
import { MessageCircle } from 'lucide-react'
import clsx from 'clsx'
import { PostCardNative } from '../feed/PostCardNative'
import { ErrorBoundary } from '../core/ErrorBoundary'
import { ThreadService } from '../../services/atproto/thread'
import type { Post, FeedItem } from '@bsky/shared/types/atproto'
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
    <div>
      {/* Ancestors (parent posts) */}
      {ancestors.map((ancestor, index) => (
        <motion.div
          key={ancestor.post.uri}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
          className="relative"
          data-post-uri={ancestor.post.uri}
          data-author-handle={ancestor.post.author.handle}
        >
          <ErrorBoundary
            fallback={(_, reset) => (
              <div className="p-4 bg-red-900/20 border border-red-500/20 rounded-lg m-4">
                <p className="text-red-400 mb-2">Failed to display post</p>
                <button onClick={reset} className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded transition-colors text-sm">
                  Retry
                </button>
              </div>
            )}
          >
            <PostCardNative 
              item={threadPostToFeedItem(ancestor)}
              onReply={onReply}
              onViewThread={onViewThread}
              showParentPost={false}
              isInThread={true}
              isParentPost={true}
            />
          </ErrorBoundary>
        </motion.div>
      ))}
      
      {/* Main post */}
      <motion.div
        className="relative"
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: ancestors.length * 0.05 }}
        data-post-uri={thread.post.uri}
        data-author-handle={thread.post.author.handle}
      >
        <ErrorBoundary
          fallback={(_, reset) => (
            <div className="p-4 bg-red-900/20 border border-red-500/20 rounded-lg m-4">
              <p className="text-red-400 mb-2">Failed to display post</p>
              <button onClick={reset} className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded transition-colors text-sm">
                Retry
              </button>
            </div>
          )}
        >
          <div className="border-l-4 border-blue-500">
            <PostCardNative 
              item={threadPostToFeedItem(thread)}
              onReply={onReply}
              onViewThread={onViewThread}
              showParentPost={false}
              isInThread={true}
              isMainPost={true}
            />
          </div>
        </ErrorBoundary>
      </motion.div>
      
      {/* Descendants (replies) */}
      {thread.replies && thread.replies.length > 0 && (
        <div className="border-t border-gray-800 mt-4">
          <div className="flex items-center gap-2 px-4 py-3 text-gray-400 bg-gray-900/50">
            <MessageCircle size={18} />
            <span className="font-medium">{countAllReplies(thread)} {countAllReplies(thread) === 1 ? 'Reply' : 'Replies'}</span>
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
  _parentAuthor?: string
): React.ReactNode {
  if (!replies || !Array.isArray(replies)) return null
  
  return replies.map((reply, index) => {
    if (reply.$type !== 'app.bsky.feed.defs#threadViewPost') return null
    
    const threadReply = reply as ThreadViewPost
    const hasReplies = threadReply.replies && threadReply.replies.length > 0
    const originalPosterDid = ancestors[0]?.post.author.did
    const isOriginalPoster = threadReply.post.author.did === originalPosterDid
    
    return (
      <div key={`${threadReply.post.uri}-${depth}-${index}`} className="relative">
        
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: Math.min(index * 0.05, 0.5) }}
          className={clsx(
            "relative",
            depth === 0 ? "ml-0" : depth === 1 ? "ml-8" : depth === 2 ? "ml-16" : depth === 3 ? "ml-24" : depth === 4 ? "ml-32" : "ml-40"
          )}
          data-post-uri={threadReply.post.uri}
          data-author-handle={threadReply.post.author.handle}
        >
          <ErrorBoundary
            fallback={(_, reset) => (
              <div className="p-4 bg-red-900/20 border border-red-500/20 rounded-lg m-4">
                <p className="text-red-400 mb-2">Failed to display reply</p>
                <button onClick={reset} className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded transition-colors text-sm">
                  Retry
                </button>
              </div>
            )}
          >
            <PostCardNative 
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
                isThreadChild={true}
                isInThread={true}
              />
          </ErrorBoundary>
        </motion.div>
        
        {/* Render nested replies */}
        {hasReplies && renderThreadReplies(
          threadReply.replies!, 
          depth + 1, 
          onReply, 
          onViewThread, 
          ancestors,
          threadReply.post.author.handle
        )}
      </div>
    )
  })
}