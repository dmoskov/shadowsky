import React, { useState, useCallback } from 'react'
import { useTimeline } from '../../hooks/useTimeline'
import { PostCardTailwind } from './PostCardTailwind'
import { ComposeModal } from '../modals/ComposeModal'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import type { Post } from '@bsky/shared'

interface FeedProps {
  onViewThread?: (uri: string) => void
}

export const FeedTailwindTest: React.FC<FeedProps> = ({ onViewThread }) => {
  const { 
    posts, 
    isLoading, 
    isLoadingMore,
    error, 
    hasNextPage, 
    loadMore,
    refresh,
    isRefreshing
  } = useTimeline()
  const [replyTo, setReplyTo] = useState<Post | null>(null)

  const handleReply = useCallback((post: Post) => {
    setReplyTo(post)
  }, [])

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const element = e.currentTarget
    const threshold = 300
    
    if (
      element.scrollHeight - element.scrollTop <= element.clientHeight + threshold &&
      hasNextPage &&
      !isLoadingMore
    ) {
      loadMore()
    }
  }, [hasNextPage, isLoadingMore, loadMore])

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-4">
        <div className="bg-red-900/20 border border-red-500/20 rounded-lg p-8 text-center">
          <h2 className="text-xl font-semibold text-red-400 mb-2">Failed to load feed</h2>
          <p className="text-gray-400 mb-4">Something went wrong. Please try again.</p>
          <button
            onClick={refresh}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div 
        className="tw-feed-container" 
        onScroll={handleScroll}
      >
        <div className="tw-feed-header">
          <h1 className="tw-feed-title">Home (Tailwind Test)</h1>
          <button 
            className="tw-btn-ghost"
            onClick={refresh}
            disabled={isRefreshing}
            aria-label="Refresh feed"
          >
            {isRefreshing ? (
              <LoadingSpinner size="sm" />
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
              </svg>
            )}
          </button>
        </div>

        {isLoading && posts.length === 0 ? (
          <div className="twspace-y-4 twp-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-gray-800 rounded-lg p-4 animate-pulse">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-gray-700 rounded-full"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-700 rounded w-1/4 mb-2"></div>
                    <div className="h-4 bg-gray-700 rounded w-3/4 mb-2"></div>
                    <div className="h-4 bg-gray-700 rounded w-1/2"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-12">
            <h3 className="text-lg font-medium text-gray-300 mb-2">No posts yet</h3>
            <p className="text-gray-500 mb-4">Your feed is empty. Follow some people to see their posts!</p>
            <button
              onClick={refresh}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Refresh Feed
            </button>
          </div>
        ) : (
          <>
            {posts.map((item) => (
              <PostCardTailwind
                key={item.post.cid}
                item={item}
                onReply={handleReply}
                onViewThread={onViewThread}
                showParentPost={true}
              />
            ))}
            
            {isLoadingMore && (
              <div className="twflex twjustify-center twp-8">
                <LoadingSpinner size="md" />
              </div>
            )}

            {!hasNextPage && posts.length > 0 && (
              <div className="twtext-center twp-8">
                <p className="twtext-text-secondary">You've reached the end of your feed</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Reply Modal */}
      {replyTo && (
        <ComposeModal
          isOpen={!!replyTo}
          onClose={() => setReplyTo(null)}
          replyTo={replyTo}
        />
      )}
    </>
  )
}