import React, { useCallback, useRef, useEffect, useState } from 'react'
import { useTimeline } from '../../hooks/useTimeline'
import { ErrorBoundary } from '../core/ErrorBoundary'
import { PostCard } from '../feed/PostCard'
import { ComposeModal } from '../modals/ComposeModal'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import { performanceTracker, useRenderTracking } from '@bsky/shared'
import type { Post } from '@bsky/shared'

interface FeedProps {
  onViewThread?: (uri: string) => void
}

export const Feed: React.FC<FeedProps> = ({ onViewThread }) => {
  useRenderTracking('Feed')
  
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

  // Track feed loading performance
  useEffect(() => {
    if (!isLoading && posts.length > 0) {
      performanceTracker.trackCustomMetric('feed-posts-loaded', posts.length, {
        action: 'initial-load'
      })
    }
  }, [isLoading, posts.length])

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
        <div className="flex justify-center items-center py-8">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="feed-container">
        <div className="feed-header">
          <h2 className="feed-title">Your Timeline</h2>
        </div>
        <div className="bg-red-900/20 border border-red-500/20 rounded-lg p-8 text-center">
          <h2 className="text-xl font-semibold text-red-400 mb-2">Failed to load feed</h2>
          <p className="text-gray-400 mb-4">Something went wrong. Please try again.</p>
          <button
            onClick={() => refresh()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!posts || posts.length === 0) {
    return (
      <div className="feed-container">
        <div className="feed-header">
          <h2 className="feed-title">Your Timeline</h2>
        </div>
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-gray-300 mb-2">No posts yet</h3>
          <p className="text-gray-500">Your feed is empty. Follow some people to see their posts!</p>
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
          {isFetching ? <LoadingSpinner size="sm" /> : null}
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
              key={item.post.uri}
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
            <LoadingSpinner size="md" />
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