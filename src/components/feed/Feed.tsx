import React, { useCallback, useRef, useEffect, useState } from 'react'
import { useTimeline } from '../../hooks/useTimeline'
import { ErrorBoundary } from '../core/ErrorBoundary'
import { PostCard } from '../feed/PostCard'
import { ComposeModal } from '../modals/ComposeModal'
import { FeedLoading } from '../ui/SkeletonLoaders'
import type { Post } from '../../types/atproto'

interface FeedProps {
  onViewThread?: (uri: string) => void
}

export const Feed: React.FC<FeedProps> = ({ onViewThread }) => {
  const [replyTo, setReplyTo] = useState<{ post: Post; root?: Post } | undefined>()
  const { 
    posts, 
    isLoading, 
    isFetching,
    isFetchingNextPage,
    error, 
    hasNextPage, 
    loadMore, 
    refresh 
  } = useTimeline()

  const handleLoadMore = useCallback(() => {
    if (!isFetchingNextPage && hasNextPage) {
      loadMore()
    }
  }, [isFetchingNextPage, hasNextPage, loadMore])

  // Infinite scroll implementation
  const observerRef = useRef<IntersectionObserver | null>(null)
  const loadMoreRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const options = {
      root: null,
      rootMargin: '100px',
      threshold: 0.1
    }

    observerRef.current = new IntersectionObserver((entries) => {
      const [entry] = entries
      if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
        handleLoadMore()
      }
    }, options)

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current)
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [hasNextPage, isFetchingNextPage, handleLoadMore])

  if (isLoading) {
    return (
      <div className="feed-container">
        <div className="feed-header">
          <h2 className="feed-title">Your Timeline</h2>
        </div>
        <FeedLoading />
      </div>
    )
  }

  if (error) {
    return (
      <div className="feed-container">
        <div className="error-state">
          <div className="error-message">
            {error instanceof Error ? error.message : 'Failed to load feed'}
          </div>
          <button
            onClick={() => refresh()}
            className="btn btn-primary"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="feed-container">
      <div className="feed-header">
        <h2 className="feed-title">Your Timeline</h2>
        <button
          onClick={() => refresh()}
          disabled={isFetching}
          className="btn btn-primary"
        >
          {isFetching ? 'Refreshing...' : 'Refresh Feed'}
        </button>
      </div>
      
      <div className="feed-posts">
        {posts.map((item) => (
          <ErrorBoundary 
            key={item.post.uri}
            fallback={(_, reset) => (
              <div className="post-error card">
                <p className="error-text">
                  Failed to display this post
                </p>
                <button
                  onClick={reset}
                  className="btn btn-secondary btn-sm"
                >
                  Retry
                </button>
              </div>
            )}
          >
            <PostCard 
              item={item} 
              onReply={(post) => setReplyTo({ 
                post, 
                root: item.reply?.root 
              })}
              onViewThread={onViewThread}
            />
          </ErrorBoundary>
        ))}
      </div>
      
      {/* Infinite scroll trigger */}
      <div 
        ref={loadMoreRef}
        className="load-more-trigger"
      >
        {isFetchingNextPage && (
          <div className="loading-more">
            <div className="spinner"></div>
            <span>Loading more posts...</span>
          </div>
        )}
        {!hasNextPage && posts.length > 0 && (
          <div className="no-more-posts">
            No more posts to load
          </div>
        )}
      </div>
      
      {/* Manual load more button as fallback */}
      {hasNextPage && !isFetchingNextPage && (
        <div className="load-more-manual">
          <button
            onClick={handleLoadMore}
            className="btn btn-secondary"
          >
            Load more manually
          </button>
        </div>
      )}
      
      {/* Reply Modal */}
      <ComposeModal 
        isOpen={!!replyTo}
        onClose={() => setReplyTo(undefined)}
        replyTo={replyTo}
      />
    </div>
  )
}