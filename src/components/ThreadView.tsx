import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Loader2, MessageCircle, BookOpen, X } from 'lucide-react'
import clsx from 'clsx'
import { useQuery } from '@tanstack/react-query'
import { threadService } from '../services/atproto/thread'
import { PostCard } from './PostCard'
import { ComposeModal } from './ComposeModal'
import { ErrorBoundary } from './ErrorBoundary'
import { useErrorHandler } from '../hooks/useErrorHandler'
import type { Post, FeedItem } from '../types/atproto'
import type { ThreadViewPost } from '../services/atproto/thread'

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
    queryFn: () => threadService.getThread(postUri),
    retry: 2,
    onError: handleError
  })
  
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
  
  // Get ancestors and descendants
  const ancestors = threadService.getAncestors(thread)
  const descendants = threadService.getDescendants(thread)
  
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
                fallback={(error, reset) => (
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
              fallback={(error, reset) => (
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
              />
            </ErrorBoundary>
          </motion.div>
          
          {/* Descendants (replies) */}
          {descendants.length > 0 && (
            <div className="thread-replies">
              <div className="thread-replies-header">
                <MessageCircle size={18} />
                <span>{descendants.length} {descendants.length === 1 ? 'Reply' : 'Replies'}</span>
              </div>
              
              {descendants.map((descendant, index) => (
                <motion.div
                  key={descendant.post.uri}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: (ancestors.length + 1 + index) * 0.05 }}
                  className={`thread-reply depth-${getReplyDepth(descendant, thread)}`}
                >
                  <ErrorBoundary
                    fallback={(error, reset) => (
                      <div className="post-error card">
                        <p className="error-text">Failed to display reply</p>
                        <button onClick={reset} className="btn btn-secondary btn-sm">
                          Retry
                        </button>
                      </div>
                    )}
                  >
                    <PostCard 
                      item={threadPostToFeedItem(descendant)}
                      onReply={handleReply}
                    />
                  </ErrorBoundary>
                </motion.div>
              ))}
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

// Helper function to determine reply depth for styling
function getReplyDepth(reply: ThreadViewPost, mainPost: ThreadViewPost): number {
  let depth = 0
  let current = reply.parent
  
  while (current && current !== mainPost && depth < 5) {
    depth++
    if (current.$type === 'app.bsky.feed.defs#threadViewPost') {
      current = (current as ThreadViewPost).parent
    } else {
      break
    }
  }
  
  return Math.min(depth, 5) // Cap at 5 for styling
}