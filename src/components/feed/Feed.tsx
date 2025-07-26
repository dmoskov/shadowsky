import React, { useCallback, useRef, useEffect, useState } from 'react'
import { useTimeline } from '../../hooks/useTimeline'
import { ErrorBoundary } from '../core/ErrorBoundary'
import { PostCardBluesky } from '../feed/PostCardBluesky'
import { ComposeModal } from '../modals/ComposeModal'
import { FeedLoading, InlineLoader } from '../ui/SkeletonLoaders'
import { FeedError } from '../ui/ErrorStates'
import { FeedEmpty } from '../ui/EmptyStates'
import { ResponsiveContainer } from '../ui/ResponsiveContainer'
import { FeedLoadingProgress } from '../ui/FeedLoadingProgress'
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
      <ResponsiveContainer>
        <FeedLoading />
      </ResponsiveContainer>
    )
  }

  if (error) {
    return (
      <ResponsiveContainer className="pt-8">
        <FeedError onRetry={() => refresh()} />
      </ResponsiveContainer>
    )
  }

  if (!posts || posts.length === 0) {
    return (
      <ResponsiveContainer className="pt-8">
        <FeedEmpty />
      </ResponsiveContainer>
    )
  }

  return (
    <ResponsiveContainer>
      {/* Loading Progress Indicator */}
      {(isFetching || isFetchingNextPage) && (
        <FeedLoadingProgress 
          postsLoaded={posts.length}
          isInitialLoad={posts.length === 0}
          isFetchingMore={isFetchingNextPage}
        />
      )}
      
      <div className="border-t border-gray-800">
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
      >
        {isFetchingNextPage && (
          <div className="flex flex-col items-center justify-center space-y-2">
            <div className="flex items-center space-x-3 text-gray-400">
              <InlineLoader />
              <span>Loading more posts...</span>
            </div>
            <div className="text-sm text-gray-500">
              {posts.length} posts loaded so far
            </div>
          </div>
        )}
        {!hasNextPage && posts.length > 0 && (
          <div className="text-center py-4">
            <div className="text-gray-500">All caught up!</div>
            <div className="text-sm text-gray-600 mt-1">
              {posts.length} posts loaded in total
            </div>
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
    </ResponsiveContainer>
  )
}