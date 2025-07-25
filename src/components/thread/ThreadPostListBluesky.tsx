import React from 'react'
import { motion } from 'framer-motion'
import { MessageCircle } from 'lucide-react'
import { PostCardBluesky } from '../feed/PostCardBluesky'
import { ErrorBoundary } from '../core/ErrorBoundary'
import type { Post, FeedItem } from '@bsky/shared/types/atproto'
import type { ThreadViewPost } from '../../services/atproto/thread'
import type { AppBskyFeedDefs } from '@atproto/api'

interface ThreadPostListProps {
  thread: ThreadViewPost
  onReply: (post: Post) => void
  onViewThread: (uri: string) => void
  isCompactMode?: boolean
  currentPostUri?: string
  targetPostUri?: string  // The originally clicked post to highlight
}

// Helper to convert ThreadViewPost to FeedItem
function threadPostToFeedItem(thread: ThreadViewPost, parent?: ThreadViewPost, root?: Post): FeedItem {
  return {
    post: thread.post,
    reply: parent ? {
      root: root || thread.post,
      parent: parent.post
    } : undefined
  }
}

export const ThreadPostListBluesky: React.FC<ThreadPostListProps> = ({
  thread,
  onReply,
  onViewThread,
  isCompactMode = false,
  currentPostUri,
  targetPostUri
}) => {
  // Get all ancestor posts (parents)
  const ancestors: ThreadViewPost[] = []
  let current = thread.parent
  while (current && current.$type === 'app.bsky.feed.defs#threadViewPost') {
    ancestors.unshift(current as ThreadViewPost)
    current = (current as ThreadViewPost).parent
  }

  // Check if this thread has replies
  const hasReplies = thread.replies && thread.replies.length > 0
  const replyCount = countAllReplies(thread)

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="max-w-[600px] mx-auto">
      {/* Parent posts (ancestors) */}
      {ancestors.length > 0 && (
        <div className="border-t border-gray-800">
          {ancestors.map((ancestor, index) => {
            const hasMoreBelow = index < ancestors.length - 1 || true // Always has main post below
            return (
              <motion.div
                key={ancestor.post.uri}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.05 }}
              >
                <ErrorBoundary
                  fallback={(_, reset) => (
                    <div className="p-4 bg-red-900/20 border border-red-500/20">
                      <p className="text-red-400 mb-2">Failed to display parent post</p>
                      <button onClick={reset} className="text-sm text-gray-400 hover:text-gray-200">
                        Retry
                      </button>
                    </div>
                  )}
                >
                  <PostCardBluesky 
                    item={threadPostToFeedItem(ancestor, ancestors[index - 1], ancestors[0]?.post)}
                    onReply={onReply}
                    onViewThread={onViewThread}
                    isInThread={true}
                    isParentPost={true}
                    hasMoreReplies={hasMoreBelow}
                    isMainPost={ancestor.post.uri === targetPostUri}  // Highlight if this is the target
                  />
                </ErrorBoundary>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Main post */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: ancestors.length * 0.05 }}
        className="relative border-t border-b border-gray-800"
      >
        <ErrorBoundary
          fallback={(_, reset) => (
            <div className="p-4 bg-red-900/20 border border-red-500/20">
              <p className="text-red-400 mb-2">Failed to display main post</p>
              <button onClick={reset} className="text-sm text-gray-400 hover:text-gray-200">
                Retry
              </button>
            </div>
          )}
        >
          <PostCardBluesky 
            item={threadPostToFeedItem(thread, ancestors[ancestors.length - 1], ancestors[0]?.post || thread.post)}
            onReply={onReply}
            onViewThread={onViewThread}
            isInThread={true}
            isMainPost={thread.post.uri === targetPostUri || !targetPostUri}  // Highlight if target or root
            hasMoreReplies={hasReplies}
          />
        </ErrorBoundary>
      </motion.div>

      {/* Reply separator */}
      {hasReplies && (
        <div className="border-t border-gray-800" />
      )}

      {/* Replies */}
      {hasReplies && (
        <div className="bg-gray-900">
          {renderThreadReplies(
            thread.replies, 
            0, 
            onReply, 
            onViewThread, 
            ancestors.concat(thread),
            thread,
            targetPostUri
          )}
        </div>
      )}
      </div>
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
  parentPost?: ThreadViewPost,
  targetPostUri?: string
): React.ReactNode {
  if (!replies || !Array.isArray(replies)) return null
  
  return replies.map((reply, index) => {
    if (reply.$type !== 'app.bsky.feed.defs#threadViewPost') return null
    
    const threadReply = reply as ThreadViewPost
    const hasMoreReplies = threadReply.replies && threadReply.replies.length > 0
    const isLastInGroup = index === replies.length - 1
    const originalPosterDid = ancestors[0]?.post.author.did
    const isOriginalPoster = threadReply.post.author.did === originalPosterDid
    
    return (
      <motion.div
        key={threadReply.post.uri}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: index * 0.02 }}
        className="border-b border-gray-800"
      >
        <ErrorBoundary
          fallback={(_, reset) => (
            <div className="p-4 bg-red-900/20 border border-red-500/20 ml-4">
              <p className="text-red-400 mb-2">Failed to display reply</p>
              <button onClick={reset} className="text-sm text-gray-400 hover:text-gray-200">
                Retry
              </button>
            </div>
          )}
        >
          <PostCardBluesky 
            item={threadPostToFeedItem(threadReply, parentPost || ancestors[ancestors.length - 1], ancestors[0]?.post)}
            onReply={onReply}
            onViewThread={onViewThread}
            isInThread={true}
            hasMoreReplies={hasMoreReplies || !isLastInGroup}
            isLastReply={isLastInGroup && !hasMoreReplies}
            depth={depth}
            isMainPost={threadReply.post.uri === targetPostUri}  // Highlight if this is the target
          />
        </ErrorBoundary>
        
        {/* Nested replies */}
        {hasMoreReplies && renderThreadReplies(
          threadReply.replies,
          depth + 1,
          onReply,
          onViewThread,
          ancestors,
          threadReply,
          targetPostUri
        )}
      </motion.div>
    )
  })
}