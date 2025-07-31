import React, { useState, useRef, useEffect } from 'react'
import { Heart, Repeat2, MessageCircle, Image, Loader, MoreVertical, TrendingUp, Users, Clock, Hash } from 'lucide-react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { useAuth } from '../contexts/AuthContext'
import { proxifyBskyImage, proxifyBskyVideo } from '../utils/image-proxy'
import { debug } from '@bsky/shared'
import { useFeatureTracking, useInteractionTracking } from '../hooks/useAnalytics'
import { VideoPlayer } from './VideoPlayer'

type FeedType = 'following' | 'whats-hot' | 'popular-with-friends' | 'recent'

interface Post {
  uri: string
  cid: string
  author: {
    did: string
    handle: string
    displayName?: string
    avatar?: string
  }
  record: {
    text: string
    createdAt: string
    embed?: any
  }
  embed?: any
  replyCount: number
  repostCount: number
  likeCount: number
  viewer?: {
    like?: string
    repost?: string
  }
  reason?: {
    $type: string
    by: {
      did: string
      handle: string
      displayName?: string
    }
  }
}

export const Home: React.FC = () => {
  const { agent } = useAuth()
  const [hoveredPost, setHoveredPost] = useState<string | null>(null)
  const [selectedFeed, setSelectedFeed] = useState<FeedType>('following')
  const loadMoreRef = useRef<HTMLDivElement>(null)
  
  const { trackFeatureAction } = useFeatureTracking('home_feed')
  const { trackClick } = useInteractionTracking()
  
  const feedOptions = [
    { type: 'following' as FeedType, label: 'Following', icon: Users },
    { type: 'whats-hot' as FeedType, label: "What's Hot", icon: TrendingUp },
    { type: 'popular-with-friends' as FeedType, label: 'Popular w/ Friends', icon: Heart },
    { type: 'recent' as FeedType, label: 'Recent', icon: Clock }
  ]
  
  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useInfiniteQuery({
    queryKey: ['timeline', selectedFeed],
    queryFn: async ({ pageParam }) => {
      if (!agent) throw new Error('Not authenticated')
      
      let response
      
      switch (selectedFeed) {
        case 'following':
          response = await agent.getTimeline({
            cursor: pageParam,
            limit: 30
          })
          break
        
        case 'whats-hot':
          // Use the What's Hot algorithm feed
          try {
            response = await agent.app.bsky.feed.getFeed({
              feed: 'at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/whats-hot',
              cursor: pageParam,
              limit: 30
            })
          } catch (error) {
            debug.error('Failed to fetch whats-hot feed, falling back to timeline:', error)
            response = await agent.getTimeline({
              cursor: pageParam,
              limit: 30
            })
          }
          break
        
        case 'popular-with-friends':
          // Use the Popular With Friends feed
          try {
            response = await agent.app.bsky.feed.getFeed({
              feed: 'at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/with-friends',
              cursor: pageParam,
              limit: 30
            })
          } catch (error) {
            debug.error('Failed to fetch popular-with-friends feed, falling back to timeline:', error)
            response = await agent.getTimeline({
              cursor: pageParam,
              limit: 30
            })
          }
          break
        
        case 'recent':
          // For recent/chronological, we can use timeline with specific params
          // or implement a reverse chronological sort
          response = await agent.getTimeline({
            cursor: pageParam,
            limit: 30
          })
          break
        
        default:
          response = await agent.getTimeline({
            cursor: pageParam,
            limit: 30
          })
      }
      
      debug.log(`${selectedFeed} feed response:`, response)
      return response.data
    },
    getNextPageParam: (lastPage) => lastPage.cursor,
    enabled: !!agent,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000
  })
  
  const posts = React.useMemo(() => {
    if (!data?.pages) return []
    return data.pages.flatMap(page => page.feed)
  }, [data])
  
  // Intersection observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      { threshold: 0.1 }
    )
    
    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current)
    }
    
    return () => observer.disconnect()
  }, [fetchNextPage, hasNextPage, isFetchingNextPage])
  
  const handlePostClick = (post: Post) => {
    trackClick('post', { postUri: post.uri })
    const postUrl = `https://bsky.app/profile/${post.author.handle}/post/${post.uri.split('/').pop()}`
    window.open(postUrl, '_blank')
  }
  
  const handleLike = async (post: Post) => {
    trackFeatureAction('like_post', { postUri: post.uri })
    // Like functionality would go here
  }
  
  const handleRepost = async (post: Post) => {
    trackFeatureAction('repost_post', { postUri: post.uri })
    // Repost functionality would go here
  }
  
  const renderEmbed = (embed: any) => {
    if (!embed) return null
    
    if (embed.$type === 'app.bsky.embed.images#view') {
      return (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {embed.images.map((img: any, idx: number) => (
            <img
              key={idx}
              src={proxifyBskyImage(img.thumb)}
              alt={img.alt || ''}
              className="rounded-lg w-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
              onClick={(e) => {
                e.stopPropagation()
                window.open(img.fullsize, '_blank')
              }}
            />
          ))}
        </div>
      )
    }
    
    if (embed.$type === 'app.bsky.embed.external#view') {
      return (
        <div className="mt-3 border rounded-lg p-3 hover:bg-opacity-5 hover:bg-blue-500 transition-colors cursor-pointer"
             style={{ borderColor: 'var(--bsky-border-primary)' }}
             onClick={(e) => {
               e.stopPropagation()
               window.open(embed.external.uri, '_blank')
             }}>
          {embed.external.thumb && (
            <img
              src={proxifyBskyImage(embed.external.thumb)}
              alt=""
              className="w-full h-48 object-cover rounded-lg mb-2"
            />
          )}
          <div className="text-sm font-semibold" style={{ color: 'var(--bsky-text-primary)' }}>
            {embed.external.title}
          </div>
          <div className="text-xs mt-1" style={{ color: 'var(--bsky-text-secondary)' }}>
            {embed.external.description}
          </div>
        </div>
      )
    }
    
    if (embed.$type === 'app.bsky.embed.video#view') {
      return (
        <div className="mt-3" onClick={(e) => e.stopPropagation()}>
          <VideoPlayer
            src={proxifyBskyVideo(embed.playlist)}
            thumbnail={embed.thumbnail ? proxifyBskyVideo(embed.thumbnail) : undefined}
            aspectRatio={embed.aspectRatio}
            alt={embed.alt}
          />
        </div>
      )
    }
    
    return null
  }
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="animate-spin" size={32} style={{ color: 'var(--bsky-primary)' }} />
      </div>
    )
  }
  
  if (error) {
    return (
      <div className="text-center p-8">
        <p style={{ color: 'var(--bsky-text-secondary)' }}>Failed to load feed</p>
        <p className="text-sm mt-2" style={{ color: 'var(--bsky-text-tertiary)' }}>
          {error.message}
        </p>
      </div>
    )
  }
  
  const handleFeedChange = (feed: FeedType) => {
    setSelectedFeed(feed)
    trackFeatureAction('feed_changed', { feed })
  }
  
  return (
    <div className="max-w-2xl mx-auto px-3 sm:px-4">
      <div className="sticky top-0 z-10 bsky-glass border-b" style={{ borderColor: 'var(--bsky-border-primary)' }}>
        <div className="flex items-center justify-between gap-1 p-2 overflow-x-auto">
          {feedOptions.map((option) => (
            <button
              key={option.type}
              onClick={() => handleFeedChange(option.type)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all flex-1 min-w-0 ${
                selectedFeed === option.type
                  ? 'text-white shadow-md'
                  : 'hover:bg-opacity-10 hover:bg-blue-500'
              }`}
              style={{
                backgroundColor: selectedFeed === option.type ? 'var(--bsky-primary)' : 'transparent',
                color: selectedFeed === option.type ? 'white' : 'var(--bsky-text-secondary)'
              }}
            >
              <option.icon size={16} className="flex-shrink-0" />
              <span className="font-medium text-sm truncate">{option.label}</span>
            </button>
          ))}
        </div>
      </div>
      
      <div className="divide-y" style={{ borderColor: 'var(--bsky-border-primary)' }}>
        {posts.map((item: any, index: number) => {
          const post = item.post
          return (
            <div
              key={`${post.uri}-${index}`}
              className="p-4 hover:bg-opacity-5 hover:bg-blue-500 transition-colors cursor-pointer relative"
              onClick={() => handlePostClick(post)}
              onMouseEnter={() => setHoveredPost(post.uri)}
              onMouseLeave={() => setHoveredPost(null)}
            >
              {item.reason && (
                <div className="flex items-center gap-2 mb-2 text-sm" style={{ color: 'var(--bsky-text-secondary)' }}>
                  <Repeat2 size={14} />
                  <span>{item.reason.by.displayName || item.reason.by.handle} reposted</span>
                </div>
              )}
              
              <div className="flex gap-3">
                <img
                  src={proxifyBskyImage(post.author.avatar) || '/default-avatar.png'}
                  alt={post.author.handle}
                  className="w-12 h-12 rounded-full"
                />
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold" style={{ color: 'var(--bsky-text-primary)' }}>
                        {post.author.displayName || post.author.handle}
                      </div>
                      <div className="text-sm" style={{ color: 'var(--bsky-text-secondary)' }}>
                        @{post.author.handle} · {formatDistanceToNow(new Date(post.record.createdAt), { addSuffix: true })}
                      </div>
                    </div>
                    
                    {hoveredPost === post.uri && (
                      <button
                        className="p-1 rounded-full hover:bg-opacity-10 hover:bg-gray-500 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVertical size={16} style={{ color: 'var(--bsky-text-secondary)' }} />
                      </button>
                    )}
                  </div>
                  
                  <div className="mt-2 whitespace-pre-wrap" style={{ color: 'var(--bsky-text-primary)' }}>
                    {post.record.text}
                  </div>
                  
                  {renderEmbed(post.embed)}
                  
                  <div className="flex items-center gap-6 mt-3">
                    <button
                      className="flex items-center gap-1 hover:text-blue-500 transition-colors"
                      style={{ color: 'var(--bsky-text-secondary)' }}
                      onClick={(e) => {
                        e.stopPropagation()
                        // Reply functionality would go here
                      }}
                    >
                      <MessageCircle size={16} />
                      <span className="text-sm">{post.replyCount || 0}</span>
                    </button>
                    
                    <button
                      className={`flex items-center gap-1 hover:text-green-500 transition-colors ${
                        post.viewer?.repost ? 'text-green-500' : ''
                      }`}
                      style={{ color: post.viewer?.repost ? undefined : 'var(--bsky-text-secondary)' }}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRepost(post)
                      }}
                    >
                      <Repeat2 size={16} />
                      <span className="text-sm">{post.repostCount || 0}</span>
                    </button>
                    
                    <button
                      className={`flex items-center gap-1 hover:text-red-500 transition-colors ${
                        post.viewer?.like ? 'text-red-500' : ''
                      }`}
                      style={{ color: post.viewer?.like ? undefined : 'var(--bsky-text-secondary)' }}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleLike(post)
                      }}
                    >
                      <Heart size={16} fill={post.viewer?.like ? 'currentColor' : 'none'} />
                      <span className="text-sm">{post.likeCount || 0}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      
      {isFetchingNextPage && (
        <div className="flex items-center justify-center p-8">
          <Loader className="animate-spin" size={24} style={{ color: 'var(--bsky-primary)' }} />
        </div>
      )}
      
      <div ref={loadMoreRef} className="h-20" />
    </div>
  )
}