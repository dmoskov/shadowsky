import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Loader2, MessageCircle, BookOpen, X } from 'lucide-react'
import clsx from 'clsx'
import { useQuery } from '@tanstack/react-query'
import { getThreadService, ThreadService } from '../services/atproto/thread'
import { PostCard } from './PostCard'
import { ComposeModal } from './ComposeModal'
import { ErrorBoundary } from './ErrorBoundary'
import { useErrorHandler } from '../hooks/useErrorHandler'
import type { Post, FeedItem } from '../types/atproto'
import type { ThreadViewPost } from '../services/atproto/thread'
import type { AppBskyFeedDefs } from '@atproto/api'

interface ThreadViewProps {
  postUri: string
  onBack: () => void
}

export const ThreadView: React.FC<ThreadViewProps> = ({ postUri, onBack }) => {
  const { handleError } = useErrorHandler()
  const [replyTo, setReplyTo] = useState<{ post: Post; root?: Post } | undefined>()
  const [isReaderMode, setIsReaderMode] = useState(false)
  
  const { data: thread, isLoading, error } = useQuery({
    queryKey: ['thread', postUri],
    queryFn: async () => {
      const { atProtoClient } = await import('../services/atproto')
      const agent = atProtoClient.agent
      if (!agent) throw new Error('Not authenticated')
      const threadService = getThreadService(agent)
      return threadService.getThread(postUri)
    },
    retry: 2
  })
  
  // Handle errors
  React.useEffect(() => {
    if (error) {
      handleError(error)
    }
  }, [error, handleError])
  
  if (isLoading) {
    return (
      <div className="thread-container">
        <div className="thread-header">
          <button onClick={onBack} className="btn btn-icon btn-ghost">
            <ArrowLeft size={20} />
          </button>
          <h2 className="thread-title">Thread</h2>
        </div>
        <div className="thread-loading">
          <Loader2 size={32} className="animate-spin" />
          <p>Loading thread...</p>
        </div>
      </div>
    )
  }
  
  if (error || !thread) {
    return (
      <div className="thread-container">
        <div className="thread-header">
          <button onClick={onBack} className="btn btn-icon btn-ghost">
            <ArrowLeft size={20} />
          </button>
          <h2 className="thread-title">Thread</h2>
        </div>
        <div className="error-state">
          <p className="error-message">
            {error instanceof Error ? error.message : 'Failed to load thread'}
          </p>
          <button onClick={onBack} className="btn btn-secondary">
            Go Back
          </button>
        </div>
      </div>
    )
  }
  
  // Get ancestors
  const ancestors = thread ? ThreadService.getAncestors(thread) : []
  
  // Convert ThreadViewPost to FeedItem for PostCard
  const threadPostToFeedItem = (post: ThreadViewPost): FeedItem => ({
    post: post.post,
    reply: post.parent ? {
      root: ancestors[0]?.post || post.post,
      parent: (post.parent as ThreadViewPost).post
    } : undefined
  })
  
  const handleReply = (post: Post) => {
    setReplyTo({
      post,
      root: ancestors[0]?.post || thread.post
    })
  }
  
  return (
    <>
      <div className={clsx("thread-container", { "thread-reader-mode": isReaderMode })}>
        <div className="thread-header">
          <button onClick={onBack} className="btn btn-icon btn-ghost">
            <ArrowLeft size={20} />
          </button>
          <h2 className="thread-title">Thread</h2>
          <button 
            onClick={() => setIsReaderMode(!isReaderMode)}
            className="btn btn-icon btn-ghost ml-auto"
            title={isReaderMode ? "Exit reader mode" : "Enter reader mode"}
          >
            {isReaderMode ? <X size={20} /> : <BookOpen size={20} />}
          </button>
        </div>
        
        <div className="thread-posts">
          {/* Ancestors (parent posts) */}
          {ancestors.map((ancestor, index) => (
            <motion.div
              key={ancestor.post.uri}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="thread-ancestor"
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
                  onReply={handleReply}
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
                item={threadPostToFeedItem(thread)}
                onReply={handleReply}
                showParentPost={false}
              />
            </ErrorBoundary>
          </motion.div>
          
          {/* Descendants (replies) */}
          {thread.replies && thread.replies.length > 0 && (
            <div className="thread-replies">
              <div className="thread-replies-header">
                <MessageCircle size={18} />
                <span>{countAllReplies(thread)} {countAllReplies(thread) === 1 ? 'Reply' : 'Replies'}</span>
              </div>
              
              {renderThreadReplies(thread.replies, 0, handleReply, ancestors)}
            </div>
          )}
        </div>
      </div>
      
      {/* Thread Reader Mode Toggle (floating) */}
      {!isReaderMode && (
        <button 
          className="thread-reader-toggle"
          onClick={() => setIsReaderMode(true)}
          title="Enter reader mode"
        >
          <BookOpen size={20} />
        </button>
      )}
      
      {/* Reply Modal */}
      <ComposeModal 
        isOpen={!!replyTo}
        onClose={() => setReplyTo(undefined)}
        replyTo={replyTo}
      />
    </>
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
  ancestors: ThreadViewPost[]
): React.ReactNode {
  if (!replies || !Array.isArray(replies)) return null
  
  return replies.map((reply, index) => {
    if (reply.$type !== 'app.bsky.feed.defs#threadViewPost') return null
    
    const threadReply = reply as ThreadViewPost
    const hasReplies = threadReply.replies && threadReply.replies.length > 0
    
    return (
      <div key={`${threadReply.post.uri}-${depth}-${index}`} className="thread-branch">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.05 }}
          className={`thread-reply depth-${Math.min(depth, 5)}`}
        >
          {/* Connection line to parent */}
          {depth > 0 && <div className="thread-connector" />}
          
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
            <div className={clsx("thread-post-wrapper", { "has-replies": hasReplies })}>
              <PostCard 
                item={{
                  post: threadReply.post,
                  reply: threadReply.parent && threadReply.parent.$type === 'app.bsky.feed.defs#threadViewPost' ? {
                    root: ancestors[0]?.post || threadReply.post,
                    parent: (threadReply.parent as ThreadViewPost).post
                  } : undefined
                }}
                onReply={onReply}
                showParentPost={false}
              />
            </div>
          </ErrorBoundary>
        </motion.div>
        
        {/* Render nested replies */}
        {hasReplies && (
          <div className="thread-children">
            {renderThreadReplies(threadReply.replies!, depth + 1, onReply, ancestors)}
          </div>
        )}
      </div>
    )
  })
}