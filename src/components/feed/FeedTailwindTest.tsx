import React, { useState, useCallback } from 'react'
import { useTimeline } from '../../hooks/useTimeline'
import { PostCardTailwind } from './PostCardTailwind'
import { ComposeModal } from '../modals/ComposeModal'
import { SkeletonPost } from '../ui/SkeletonLoaders'
import { EmptyFeed } from '../ui/EmptyStates'
import { FeedError } from '../ui/ErrorStates'
import type { Post } from '../../types/atproto'

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
    return <FeedError onRetry={refresh} />
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
              <div className="spinner spinner-sm" />
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
              <SkeletonPost key={i} />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <EmptyFeed onRefresh={refresh} />
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
                <div className="spinner spinner-md"></div>
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