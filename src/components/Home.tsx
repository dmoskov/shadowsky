import React, { useState, useRef, useEffect } from 'react'
import { Heart, Repeat2, MessageCircle, Image, Loader, MoreVertical, TrendingUp, Users, Clock, Hash, Star, Plus } from 'lucide-react'
import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { useAuth } from '../contexts/AuthContext'
import { proxifyBskyImage, proxifyBskyVideo } from '../utils/image-proxy'
import { debug } from '@bsky/shared'
import { useFeatureTracking, useInteractionTracking } from '../hooks/useAnalytics'
import { VideoPlayer } from './VideoPlayer'
import { FeedDiscovery } from './FeedDiscovery'

type FeedType = 'following' | 'whats-hot' | 'popular-with-friends' | 'recent' | string // Allow custom feed URIs

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

interface SavedFeed {
  id: string
  type: 'feed' | 'list' | 'timeline'
  value: string
  pinned: boolean
}

interface FeedGenerator {
  uri: string
  cid: string
  did: string
  creator: {
    did: string
    handle: string
    displayName?: string
    avatar?: string
  }
  displayName: string
  description?: string
  avatar?: string
  likeCount?: number
  viewer?: {
    like?: string
  }
}

export const Home: React.FC = () => {
  const { agent } = useAuth()
  const queryClient = useQueryClient()
  const [hoveredPost, setHoveredPost] = useState<string | null>(null)
  const [selectedFeed, setSelectedFeed] = useState<FeedType>('following')
  const [showFeedDiscovery, setShowFeedDiscovery] = useState(false)
  const loadMoreRef = useRef<HTMLDivElement>(null)
  
  const { trackFeatureAction } = useFeatureTracking('home_feed')
  const { trackClick } = useInteractionTracking()
  
  // Fetch user's saved/pinned feeds
  const { data: userPrefs } = useQuery({
    queryKey: ['userPreferences'],
    queryFn: async () => {
      if (!agent) throw new Error('Not authenticated')
      const prefs = await agent.getPreferences()
      debug.log('User preferences:', prefs)
      return prefs
    },
    enabled: !!agent,
    staleTime: 5 * 60 * 1000
  })
  
  // Fetch feed generator details for saved feeds
  const { data: feedGenerators } = useQuery({
    queryKey: ['feedGenerators', userPrefs?.savedFeeds],
    queryFn: async () => {
      if (!agent || !userPrefs?.savedFeeds?.length) return []
      
      const feedUris = userPrefs.savedFeeds
        .filter((feed: SavedFeed) => feed.type === 'feed')
        .map((feed: SavedFeed) => feed.value)
      
      if (feedUris.length === 0) return []
      
      try {
        const response = await agent.app.bsky.feed.getFeedGenerators({
          feeds: feedUris
        })
        debug.log('Feed generators:', response.data)
        return response.data.feeds
      } catch (error) {
        debug.error('Failed to fetch feed generators:', error)
        return []
      }
    },
    enabled: !!agent && !!userPrefs?.savedFeeds
  })
  
  // Build feed options including user's saved feeds
  const feedOptions = React.useMemo(() => {
    const defaultFeeds = [
      { type: 'following' as FeedType, label: 'Following', icon: Users, uri: 'following' },
      { type: 'whats-hot' as FeedType, label: "What's Hot", icon: TrendingUp, uri: 'at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/whats-hot' },
      { type: 'popular-with-friends' as FeedType, label: 'Popular w/ Friends', icon: Heart, uri: 'at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/with-friends' },
      { type: 'recent' as FeedType, label: 'Recent', icon: Clock, uri: 'recent' }
    ]
    
    // Add pinned feeds first, then other saved feeds
    const savedFeeds: any[] = []
    if (userPrefs?.savedFeeds && feedGenerators) {
      const pinnedFeeds = userPrefs.savedFeeds.filter((feed: SavedFeed) => feed.pinned && feed.type === 'feed')
      const unpinnedFeeds = userPrefs.savedFeeds.filter((feed: SavedFeed) => !feed.pinned && feed.type === 'feed')
      
      const addFeedOption = (savedFeed: SavedFeed) => {
        const generator = feedGenerators.find((g: FeedGenerator) => g.uri === savedFeed.value)
        if (generator) {
          savedFeeds.push({
            type: savedFeed.value,
            label: generator.displayName,
            icon: savedFeed.pinned ? Star : Hash,
            uri: savedFeed.value,
            pinned: savedFeed.pinned,
            generator
          })
        }
      }
      
      pinnedFeeds.forEach(addFeedOption)
      unpinnedFeeds.forEach(addFeedOption)
    }
    
    return [...defaultFeeds, ...savedFeeds]
  }, [userPrefs, feedGenerators])
  
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
        case 'recent':
          response = await agent.getTimeline({
            cursor: pageParam,
            limit: 30
          })
          break
        
        default:
          // Handle custom feed URIs
          if (selectedFeed.startsWith('at://')) {
            try {
              response = await agent.app.bsky.feed.getFeed({
                feed: selectedFeed,
                cursor: pageParam,
                limit: 30
              })
            } catch (error) {
              debug.error(`Failed to fetch feed ${selectedFeed}, falling back to timeline:`, error)
              response = await agent.getTimeline({
                cursor: pageParam,
                limit: 30
              })
            }
          } else {
            // Handle known feed types
            switch (selectedFeed) {
              case 'whats-hot':
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
              
              default:
                response = await agent.getTimeline({
                  cursor: pageParam,
                  limit: 30
                })
            }
          }
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
  
  const likeMutation = useMutation({
    mutationFn: async ({ uri, cid }: { uri: string; cid: string }) => {
      if (!agent) throw new Error('Not authenticated')
      return await agent.like(uri, cid)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeline'] })
    }
  })
  
  const unlikeMutation = useMutation({
    mutationFn: async (likeUri: string) => {
      if (!agent) throw new Error('Not authenticated')
      return await agent.deleteLike(likeUri)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeline'] })
    }
  })
  
  const repostMutation = useMutation({
    mutationFn: async ({ uri, cid }: { uri: string; cid: string }) => {
      if (!agent) throw new Error('Not authenticated')
      return await agent.repost(uri, cid)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeline'] })
    }
  })
  
  const unrepostMutation = useMutation({
    mutationFn: async (repostUri: string) => {
      if (!agent) throw new Error('Not authenticated')
      return await agent.deleteRepost(repostUri)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeline'] })
    }
  })
  
  const handleLike = async (post: Post, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    trackFeatureAction('like_post', { postUri: post.uri })
    
    try {
      if (post.viewer?.like) {
        await unlikeMutation.mutateAsync(post.viewer.like)
      } else {
        await likeMutation.mutateAsync({ uri: post.uri, cid: post.cid })
      }
    } catch (error) {
      debug.error('Failed to like/unlike post:', error)
    }
  }
  
  const handleRepost = async (post: Post, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    trackFeatureAction('repost_post', { postUri: post.uri })
    
    try {
      if (post.viewer?.repost) {
        await unrepostMutation.mutateAsync(post.viewer.repost)
      } else {
        await repostMutation.mutateAsync({ uri: post.uri, cid: post.cid })
      }
    } catch (error) {
      debug.error('Failed to repost/unrepost post:', error)
    }
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
    debug.log('Feed change clicked:', feed)
    setSelectedFeed(feed)
    trackFeatureAction('feed_changed', { feed })
  }
  
  return (
    <div className="max-w-2xl mx-auto px-3 sm:px-4">
      <div className="sticky top-0 z-10 bsky-glass border-b" style={{ borderColor: 'var(--bsky-border-primary)' }}>
        <div className="flex items-center gap-1 p-2">
          <div className="flex-1 flex gap-1 overflow-x-auto scrollbar-hide">
            {feedOptions.map((option) => (
              <button
                key={option.type}
                onClick={() => handleFeedChange(option.type)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all whitespace-nowrap cursor-pointer select-none ${
                  selectedFeed === option.type
                    ? 'text-white shadow-md'
                    : 'hover:bg-opacity-10 hover:bg-blue-500'
                }`}
                style={{
                  backgroundColor: selectedFeed === option.type ? 'var(--bsky-primary)' : 'transparent',
                  color: selectedFeed === option.type ? 'white' : 'var(--bsky-text-secondary)',
                  WebkitTapHighlightColor: 'transparent',
                  touchAction: 'manipulation'
                }}
                type="button"
              >
                <option.icon size={16} className="flex-shrink-0" />
                <span className="font-medium text-sm">{option.label}</span>
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowFeedDiscovery(true)}
            className="p-2 rounded-xl hover:bg-opacity-10 hover:bg-blue-500 transition-colors"
            style={{ color: 'var(--bsky-text-secondary)' }}
            title="Discover more feeds"
          >
            <Plus size={16} />
          </button>
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
                      className="flex items-center gap-1 hover:text-blue-500 transition-colors cursor-pointer select-none p-1 -m-1"
                      style={{ color: 'var(--bsky-text-secondary)', WebkitTapHighlightColor: 'transparent' }}
                      onClick={(e) => {
                        e.stopPropagation()
                        // Reply functionality would go here
                      }}
                      type="button"
                    >
                      <MessageCircle size={16} />
                      <span className="text-sm">{post.replyCount || 0}</span>
                    </button>
                    
                    <button
                      className={`flex items-center gap-1 hover:text-green-500 transition-colors cursor-pointer select-none p-1 -m-1 ${
                        post.viewer?.repost ? 'text-green-500' : ''
                      } ${repostMutation.isPending || unrepostMutation.isPending ? 'opacity-50 cursor-wait' : ''}`}
                      style={{ 
                        color: post.viewer?.repost ? undefined : 'var(--bsky-text-secondary)',
                        WebkitTapHighlightColor: 'transparent'
                      }}
                      onClick={(e) => handleRepost(post, e)}
                      disabled={repostMutation.isPending || unrepostMutation.isPending}
                      type="button"
                    >
                      <Repeat2 size={16} />
                      <span className="text-sm">{post.repostCount || 0}</span>
                    </button>
                    
                    <button
                      className={`flex items-center gap-1 hover:text-red-500 transition-colors cursor-pointer select-none p-1 -m-1 ${
                        post.viewer?.like ? 'text-red-500' : ''
                      } ${likeMutation.isPending || unlikeMutation.isPending ? 'opacity-50 cursor-wait' : ''}`}
                      style={{ 
                        color: post.viewer?.like ? undefined : 'var(--bsky-text-secondary)',
                        WebkitTapHighlightColor: 'transparent'
                      }}
                      onClick={(e) => handleLike(post, e)}
                      disabled={likeMutation.isPending || unlikeMutation.isPending}
                      type="button"
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
      
      <FeedDiscovery 
        isOpen={showFeedDiscovery} 
        onClose={() => setShowFeedDiscovery(false)} 
      />
    </div>
  )
}