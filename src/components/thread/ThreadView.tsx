import React, { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Loader2, MessageCircle, BookOpen, X, Map, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { useQuery } from '@tanstack/react-query'
import { getThreadService, ThreadService } from '../../services/atproto/thread'
import { PostCard } from '../feed/PostCard'
import { CompactPostCard } from '../feed/CompactPostCard'
import { ComposeModal } from '../modals/ComposeModal'
import { ErrorBoundary } from '../core/ErrorBoundary'
import { ThreadLine } from './ThreadLine'
import { ThreadNavigation } from './ThreadNavigation'
import { useErrorHandler } from '../../hooks/useErrorHandler'
// import { ThreadOverviewMap, THREAD_MAP_ENABLED } from './ThreadOverviewMap'
// import { ThreadParticipants, THREAD_PARTICIPANTS_ENABLED } from './ThreadParticipants'

import type { Post, FeedItem } from '../../types/atproto'
import type { ThreadViewPost } from '../../services/atproto/thread'
import type { AppBskyFeedDefs } from '@atproto/api'

const THREAD_MAP_ENABLED = false
const THREAD_PARTICIPANTS_ENABLED = false

interface ThreadViewProps {
  postUri: string
  onBack: () => void
}

export const ThreadView: React.FC<ThreadViewProps> = ({ postUri, onBack }) => {
  console.log('ThreadView rendered with postUri:', postUri);
  const { handleError } = useErrorHandler()
  const navigate = useNavigate()
  const [replyTo, setReplyTo] = useState<{ post: Post; root?: Post } | undefined>()
  const [isReaderMode, setIsReaderMode] = useState(false)
  const [isCompactMode, setIsCompactMode] = useState(false)
  const [currentPostUri, setCurrentPostUri] = useState<string | undefined>()
  // const [showMap, setShowMap] = useState(false)
  // const [mapExpanded, setMapExpanded] = useState(false)
  const threadContainerRef = useRef<HTMLDivElement>(null)
  
  const { data: thread, isLoading, error } = useQuery({
    queryKey: ['thread', postUri],
    queryFn: async () => {
      const { atProtoClient } = await import('../../services/atproto')
      const agent = atProtoClient.agent
      if (!agent) throw new Error('Not authenticated')
      const threadService = getThreadService(agent)
      return threadService.getThread(postUri)
    },
    retry: 2
  })
  
  // Handle errors
  useEffect(() => {
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
  
  const handleViewThread = (uri: string) => {
    console.log('ThreadView handleViewThread called with:', uri);
    const newPath = `/thread/${encodeURIComponent(uri)}`;
    console.log('Navigating from:', window.location.pathname);
    console.log('Navigating to:', newPath);
    // Navigate to the new thread using React Router
    navigate(newPath);
  }
  
  const handleThreadNavigate = (uri: string) => {
    // Find the post element and scroll to it
    const postElement = threadContainerRef.current?.querySelector(`[data-post-uri="${uri}"]`)
    if (postElement) {
      postElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setCurrentPostUri(uri)
      // Highlight the post briefly
      postElement.classList.add('highlighted')
      setTimeout(() => postElement.classList.remove('highlighted'), 2000)
    }
  }
  
  // const handleMapNavigate = (uri: string) => {
  //   // Find the post element and scroll to it
  //   const postElement = threadContainerRef.current?.querySelector(`[data-post-uri="${uri}"]`)
  //   if (postElement) {
  //     postElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
  //     setCurrentPostUri(uri)
  //     // Highlight the post briefly
  //     postElement.classList.add('highlighted')
  //     setTimeout(() => postElement.classList.remove('highlighted'), 2000)
  //   }
  // }
  
  // Update current post on scroll
  // useEffect(() => {
  //   if (!showMap || !threadContainerRef.current) return
    
  //   const observer = new IntersectionObserver(
  //     (entries) => {
  //       entries.forEach((entry) => {
  //         if (entry.isIntersecting) {
  //           const uri = entry.target.getAttribute('data-post-uri')
  //           if (uri) setCurrentPostUri(uri)
  //         }
  //       })
  //     },
  //     { threshold: 0.5 }
  //   )
    
  //   const posts = threadContainerRef.current.querySelectorAll('[data-post-uri]')
  //   posts.forEach(post => observer.observe(post))
    
  //   return () => observer.disconnect()
  // }, [showMap])
  
  return (
    <>
      <div className={clsx("thread-container", { "thread-reader-mode": isReaderMode })} ref={threadContainerRef}>
        <div className="thread-header">
          <button onClick={onBack} className="btn btn-icon btn-ghost">
            <ArrowLeft size={20} />
          </button>
          <h2 className="thread-title">Thread</h2>
          <div className="thread-header-controls">
            <button 
              onClick={() => setIsCompactMode(!isCompactMode)}
              className={clsx("btn btn-sm", isCompactMode ? "btn-primary" : "btn-ghost")}
              title="Toggle compact mode"
            >
              Compact
            </button>
            <button 
              onClick={() => setIsReaderMode(!isReaderMode)}
              className="btn btn-icon btn-ghost"
              title={isReaderMode ? "Exit reader mode" : "Enter reader mode"}
            >
              {isReaderMode ? <X size={20} /> : <BookOpen size={20} />}
            </button>
          </div>
        </div>
        
        <div className="thread-posts">
          {/* Thread Participants */}
          {/* {THREAD_PARTICIPANTS_ENABLED && thread && (
            <ThreadParticipants thread={thread} variant="compact" />
          )} */}
          
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
                  onReply={handleReply}
                  onViewThread={handleViewThread}
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
              
              {renderThreadReplies(thread.replies, 0, handleReply, handleViewThread, ancestors, thread.post.author.handle)}
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
      
      {/* Thread Navigation */}
      {thread && !isReaderMode && (
        <ThreadNavigation
          thread={thread}
          currentPostUri={currentPostUri}
          onNavigate={handleThreadNavigate}
        />
      )}
      
      {/* Thread Overview Map */}
      {/* {THREAD_MAP_ENABLED && showMap && thread && (
        <ThreadOverviewMap
          thread={thread}
          currentPostUri={currentPostUri}
          onNavigate={handleMapNavigate}
          isExpanded={mapExpanded}
          onToggleExpand={() => setMapExpanded(!mapExpanded)}
          onClose={() => setShowMap(false)}
        />
      )} */}
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