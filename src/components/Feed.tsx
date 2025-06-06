import React, { useCallback, useRef, useEffect } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { useTimeline } from '../hooks/useTimeline'
import { ErrorBoundary } from './ErrorBoundary'
import type { FeedItem, Post } from '../types/atproto'

export const Feed: React.FC = () => {
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

  // Helper function to extract text from post
  const getPostText = (post: Post): string => {
    // The Bluesky API returns the text in post.record.value.text
    if (post.record && post.record.value && typeof post.record.value === 'object' && 'text' in post.record.value) {
      return post.record.value.text || ''
    }
    return ''
  }

  // Helper function to get created date
  const getPostDate = (post: Post): string => {
    // Try record.value.createdAt first
    if (post.record && post.record.value && typeof post.record.value === 'object' && 'createdAt' in post.record.value) {
      return post.record.value.createdAt
    }
    // Fall back to indexedAt which is when the post was indexed by the service
    if (post.indexedAt) return post.indexedAt
    return new Date().toISOString()
  }

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
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
        <h2>Your Timeline</h2>
        {/* Skeleton loader */}
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              padding: '15px',
              marginBottom: '15px',
              backgroundColor: 'white'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  backgroundColor: '#f0f0f0',
                  marginRight: '10px',
                  animation: 'pulse 1.5s ease-in-out infinite'
                }}
              />
              <div>
                <div
                  style={{
                    width: '150px',
                    height: '16px',
                    backgroundColor: '#f0f0f0',
                    borderRadius: '4px',
                    marginBottom: '8px',
                    animation: 'pulse 1.5s ease-in-out infinite'
                  }}
                />
                <div
                  style={{
                    width: '100px',
                    height: '14px',
                    backgroundColor: '#f0f0f0',
                    borderRadius: '4px',
                    animation: 'pulse 1.5s ease-in-out infinite'
                  }}
                />
              </div>
            </div>
            <div
              style={{
                width: '100%',
                height: '60px',
                backgroundColor: '#f0f0f0',
                borderRadius: '4px',
                marginBottom: '10px',
                animation: 'pulse 1.5s ease-in-out infinite'
              }}
            />
          </div>
        ))}
        <style>{`
          @keyframes pulse {
            0% {
              opacity: 1;
            }
            50% {
              opacity: 0.5;
            }
            100% {
              opacity: 1;
            }
          }
        `}</style>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ 
        maxWidth: '600px', 
        margin: '50px auto', 
        padding: '20px',
        textAlign: 'center'
      }}>
        <div style={{ 
          color: '#ff4444',
          marginBottom: '20px',
          fontSize: '16px'
        }}>
          {error instanceof Error ? error.message : 'Failed to load feed'}
        </div>
        <button
          onClick={() => refresh()}
          style={{
            padding: '10px 20px',
            backgroundColor: '#0085ff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Try Again
        </button>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
      <h2>Your Timeline</h2>
      <button
        onClick={() => refresh()}
        disabled={isFetching}
        style={{
          marginBottom: '20px',
          padding: '10px 20px',
          backgroundColor: '#0085ff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        {isFetching ? 'Refreshing...' : 'Refresh Feed'}
      </button>
      
      {posts.map((item) => {
        const post = item.post
        return (
        <ErrorBoundary 
          key={post.uri}
          fallback={(error, reset) => (
            <div
              style={{
                border: '1px solid #ffe6e6',
                borderRadius: '8px',
                padding: '15px',
                marginBottom: '15px',
                backgroundColor: '#fff5f5',
                textAlign: 'center'
              }}
            >
              <p style={{ color: '#ff4444', marginBottom: '10px' }}>
                Failed to display this post
              </p>
              <button
                onClick={reset}
                style={{
                  padding: '5px 10px',
                  backgroundColor: 'transparent',
                  color: '#0085ff',
                  border: '1px solid #0085ff',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                Retry
              </button>
            </div>
          )}
        >
          <div
            style={{
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              padding: '15px',
              marginBottom: '15px',
              backgroundColor: 'white'
            }}
          >
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
            {post.author.avatar && (
              <img
                src={post.author.avatar}
                alt={post.author.handle}
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  marginRight: '10px'
                }}
              />
            )}
            <div>
              <div style={{ fontWeight: 'bold' }}>
                {post.author.displayName || post.author.handle}
              </div>
              <div style={{ color: '#666', fontSize: '14px' }}>
                @{post.author.handle}
              </div>
            </div>
            <div style={{ marginLeft: 'auto', color: '#666', fontSize: '14px' }}>
              {formatDistanceToNow(new Date(getPostDate(post)), { addSuffix: true })}
            </div>
          </div>
          
          <div style={{ marginBottom: '10px', whiteSpace: 'pre-wrap' }}>
            {getPostText(post)}
          </div>
          
          {/* Handle quoted posts/reposts */}
          {post.embed && post.embed.record && (
            <div style={{
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              padding: '10px',
              marginBottom: '10px',
              backgroundColor: '#f9f9f9'
            }}>
              <div style={{ fontSize: '14px', marginBottom: '8px' }}>
                <strong>{post.embed.record.author?.displayName || post.embed.record.author?.handle}</strong>
                <span style={{ color: '#666', marginLeft: '8px' }}>
                  @{post.embed.record.author?.handle}
                </span>
              </div>
              <div style={{ fontSize: '14px' }}>
                {post.embed.record.value?.text || ''}
              </div>
            </div>
          )}

          {/* Handle image embeds */}
          {post.embed && post.embed.images && (
            <div style={{ marginBottom: '10px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {post.embed.images.map((image: any, index: number) => (
                <img
                  key={index}
                  src={image.thumb || image.fullsize}
                  alt={image.alt || ''}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '300px',
                    borderRadius: '8px',
                    objectFit: 'cover'
                  }}
                />
              ))}
            </div>
          )}
          
          {/* Handle external embeds */}
          {post.embed && post.embed.external && (
            <div style={{
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              padding: '10px',
              marginBottom: '10px',
              cursor: 'pointer'
            }}
            onClick={() => window.open(post.embed.external.uri, '_blank')}
            >
              {post.embed.external.thumb && (
                <img
                  src={post.embed.external.thumb}
                  alt=""
                  style={{
                    width: '100%',
                    maxHeight: '200px',
                    objectFit: 'cover',
                    borderRadius: '4px',
                    marginBottom: '8px'
                  }}
                />
              )}
              <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                {post.embed.external.title}
              </div>
              <div style={{ color: '#666', fontSize: '14px' }}>
                {post.embed.external.description}
              </div>
              <div style={{ color: '#0085ff', fontSize: '12px', marginTop: '4px' }}>
                {new URL(post.embed.external.uri).hostname}
              </div>
            </div>
          )}
          
          <div style={{ display: 'flex', gap: '20px', color: '#666', fontSize: '14px' }}>
            <span>💬 {post.replyCount || 0}</span>
            <span>🔁 {post.repostCount || 0}</span>
            <span>❤️ {post.likeCount || 0}</span>
          </div>
        </div>
        </ErrorBoundary>
        )
      })}
      
      {/* Infinite scroll trigger */}
      <div 
        ref={loadMoreRef}
        style={{ 
          height: '20px',
          marginTop: '20px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}
      >
        {isFetchingNextPage && (
          <div style={{ 
            padding: '20px',
            textAlign: 'center',
            color: '#666'
          }}>
            Loading more posts...
          </div>
        )}
        {!hasNextPage && posts.length > 0 && (
          <div style={{ 
            padding: '20px',
            textAlign: 'center',
            color: '#666',
            fontSize: '14px'
          }}>
            No more posts to load
          </div>
        )}
      </div>
      
      {/* Manual load more button as fallback */}
      {hasNextPage && !isFetchingNextPage && (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <button
            onClick={handleLoadMore}
            style={{
              padding: '10px 20px',
              backgroundColor: 'transparent',
              color: '#0085ff',
              border: '1px solid #0085ff',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Load more manually
          </button>
        </div>
      )}
    </div>
  )
}