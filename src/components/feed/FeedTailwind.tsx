import React, { useCallback, useRef, useEffect, useState } from 'react'
import { useTimeline } from '../../hooks/useTimeline'
import { ErrorBoundary } from '../core/ErrorBoundary'
import { PostCard } from '../feed/PostCard'
import { ComposeModal } from '../modals/ComposeModal'
import { FeedLoading, InlineLoader } from '../ui/SkeletonLoaders'
import { FeedError } from '../ui/ErrorStates'
import { FeedEmpty } from '../ui/EmptyStates'
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
      <div className="max-w-2xl mx-auto px-4 pt-4">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-800">
          <h2 className="text-2xl font-bold text-gray-100">Your Timeline</h2>
        </div>
        <FeedLoading />
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-4 pt-4">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-800">
          <h2 className="text-2xl font-bold text-gray-100">Your Timeline</h2>
        </div>
        <FeedError onRetry={() => refresh()} />
      </div>
    )
  }

  if (!posts || posts.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 pt-4">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-800">
          <h2 className="text-2xl font-bold text-gray-100">Your Timeline</h2>
        </div>
        <FeedEmpty />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 pt-4">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-800">
        <h2 className="text-2xl font-bold text-gray-100">Your Timeline</h2>
        <button
          onClick={() => refresh()}
          disabled={isFetching}
          className={`
            px-4 py-2 text-sm font-medium rounded-full
            bg-blue-600 text-white
            hover:bg-blue-700 disabled:opacity-60
            transition-all duration-200
            flex items-center space-x-2
          `}
        >
          {isFetching ? <InlineLoader size="sm" /> : null}
          <span>{isFetching ? 'Refreshing...' : 'Refresh Feed'}</span>
        </button>
      </div>
      
      <div className="space-y-2">
        {posts.map((item) => (
          <ErrorBoundary 
            key={item.post.uri}
            fallback={(_, reset) => (
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                <p className="text-red-400 mb-3">
                  Failed to display this post
                </p>
                <button
                  onClick={reset}
                  className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 
                           rounded transition-colors duration-200"
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
        className="py-8"
      >
        {isFetchingNextPage && (
          <div className="flex items-center justify-center space-x-3 text-gray-400">
            <InlineLoader />
            <span>Loading more posts...</span>
          </div>
        )}
        {!hasNextPage && posts.length > 0 && (
          <div className="text-center text-gray-500 py-4">
            No more posts to load
          </div>
        )}
      </div>
      
      {/* Manual load more button as fallback */}
      {hasNextPage && !isFetchingNextPage && (
        <div className="flex justify-center py-4">
          <button
            onClick={handleLoadMore}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 
                     text-gray-200 rounded-full transition-colors duration-200"
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