import React, { useCallback, useRef, useEffect, useState } from 'react'
import { useTimeline } from '../../hooks/useTimeline'
import { ErrorBoundary } from '../core/ErrorBoundary'
import { PostCardBluesky } from '../feed/PostCardBluesky'
import { ComposeModal } from '../modals/ComposeModal'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import { useLoading } from '../../contexts/LoadingContext'
import { performanceTracker, useRenderTracking } from '@bsky/shared'
import { useAnnouncement, useLoadingAnnouncement } from '../../hooks/useAnnouncement'
import type { Post } from '@bsky/shared'

interface FeedProps {
  onViewThread?: (uri: string) => void
}

export const Feed: React.FC<FeedProps> = ({ onViewThread }) => {
  useRenderTracking('Feed')
  
  const [replyTo, setReplyTo] = useState<{ post: Post; root?: Post } | undefined>()
  const { setLoading } = useLoading()
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

  // Track feed loading performance and update global loading state
  useEffect(() => {
    setLoading('feed', isLoading || isFetching)
    
    if (!isLoading && posts.length > 0) {
      performanceTracker.trackCustomMetric('feed-posts-loaded', posts.length, {
        action: 'initial-load'
      })
    }
  }, [isLoading, isFetching, posts.length, setLoading])

  // Announce loading states for screen readers
  useLoadingAnnouncement(
    isLoading,
    'Loading your timeline',
    `Timeline loaded with ${posts.length} posts`
  )
  
  // Announce new posts when fetching more
  useAnnouncement(
    isFetchingNextPage ? 'Loading more posts' : null,
    'polite'
  )

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
      <div className="container mx-auto px-4">
        <div className="flex justify-center items-center py-8">
          <LoadingSpinner />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 pt-8">
        <div className="text-center">
          <p className="text-red-400 mb-4">Failed to load feed</p>
          <button
            onClick={() => refresh()}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!posts || posts.length === 0) {
    return (
      <div className="container mx-auto px-4 pt-8">
        <div className="text-center text-gray-400">
          <p>No posts to display</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4">
      {/* Loading Progress Indicator */}
      {(isFetching || isFetchingNextPage) && (
        <div className="fixed top-0 left-0 right-0 h-1 bg-blue-500 z-50" style={{ width: '100%' }} />
      )}
      
      <div className="border-t border-gray-800" role="feed" aria-busy={isFetching} aria-label="Timeline">
        {posts.map((item, index) => (
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
            <PostCardBluesky 
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
        aria-live="polite"
        aria-atomic="true"
      >
        {isFetchingNextPage && (
          <div className="flex flex-col items-center justify-center space-y-2">
            <div className="flex items-center space-x-3 text-gray-400">
              <LoadingSpinner />
              <span aria-label="Loading more posts">Loading more posts...</span>
            </div>
            <div className="text-sm text-gray-500">
              {posts.length} posts loaded so far
            </div>
          </div>
        )}
        {/* End of content indicator */}
        {!hasNextPage && posts.length > 0 && (
          <div className="text-center text-gray-500 py-4">
            <p>You've reached the end • {posts.length} posts loaded</p>
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