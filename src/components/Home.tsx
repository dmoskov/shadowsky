import React, { useState, useRef, useEffect } from 'react'
import { Heart, Repeat2, MessageCircle, Loader, MoreVertical, TrendingUp, Users, Clock, Hash, Star, Plus, X, ChevronDown, Reply } from 'lucide-react'
import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { useAuth } from '../contexts/AuthContext'
import { proxifyBskyImage, proxifyBskyVideo } from '../utils/image-proxy'
import { debug } from '@bsky/shared'
import { useFeatureTracking, useInteractionTracking } from '../hooks/useAnalytics'
import { VideoPlayer } from './VideoPlayer'
import { FeedDiscovery } from './FeedDiscovery'
import { ImageGallery } from './ImageGallery'
import { ThreadModal } from './ThreadModal'
import '../styles/feed-context.css'

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

interface HomeProps {
  initialFeedUri?: string;
  isFocused?: boolean;
}

export const Home: React.FC<HomeProps> = ({ initialFeedUri, isFocused = true }) => {
  const { agent } = useAuth()
  const queryClient = useQueryClient()
  // Removed hoveredPost state to prevent re-renders - using CSS hover instead
  const [selectedFeed, setSelectedFeed] = useState<FeedType>(() => {
    // Use initialFeedUri if provided, otherwise restore from localStorage
    if (initialFeedUri) {
      return initialFeedUri as FeedType
    }
    const savedFeed = localStorage.getItem('selectedFeed')
    return (savedFeed as FeedType) || 'following'
  })
  const [showFeedDiscovery, setShowFeedDiscovery] = useState(false)
  const [galleryImages, setGalleryImages] = useState<Array<{ thumb: string; fullsize: string; alt?: string }> | null>(null)
  const [galleryIndex, setGalleryIndex] = useState(0)
  const [selectedPost, setSelectedPost] = useState<Post | null>(null)
  const [showThread, setShowThread] = useState(false)
  const [focusedPostIndex, setFocusedPostIndex] = useState<number>(-1)
  const postsContainerRef = useRef<HTMLDivElement>(null)
  const [feedOrder, setFeedOrder] = useState<string[]>([])
  const [draggedTab, setDraggedTab] = useState<string | null>(null)
  const [dragOverTab, setDragOverTab] = useState<string | null>(null)
  const [showFeedDropdown, setShowFeedDropdown] = useState(false)
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const scrollPositionRef = useRef<{ [key: string]: number }>({})
  const containerRef = useRef<HTMLDivElement>(null)
  const postRefs = useRef<{ [key: string]: HTMLDivElement }>({})
  const dropdownRef = useRef<HTMLDivElement>(null)
  
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
    staleTime: 5 * 60 * 1000,
    refetchOnMount: 'always', // Always fetch fresh data on mount
    refetchInterval: 60 * 1000, // Poll every 60 seconds after initial load
  })
  
  // Fetch feed generator details for saved feeds
  const { data: feedGenerators } = useQuery({
    queryKey: ['feedGenerators', userPrefs?.savedFeeds],
    queryFn: async () => {
      if (!agent || !userPrefs?.savedFeeds?.length) return []
      
      const feedUris = userPrefs.savedFeeds
        .filter((feed: SavedFeed): boolean => feed.type === 'feed')
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
      { type: 'following' as FeedType, label: 'Following', icon: Users, uri: 'following', isDefault: true },
      { type: 'whats-hot' as FeedType, label: "What's Hot", icon: TrendingUp, uri: 'at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/whats-hot', isDefault: true },
      { type: 'popular-with-friends' as FeedType, label: 'Popular w/ Friends', icon: Heart, uri: 'at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/with-friends', isDefault: true },
      { type: 'recent' as FeedType, label: 'Recent', icon: Clock, uri: 'recent', isDefault: true }
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
            generator,
            isDefault: false
          })
        }
      }
      
      pinnedFeeds.forEach(addFeedOption)
      unpinnedFeeds.forEach(addFeedOption)
    }
    
    const allFeeds = [...defaultFeeds, ...savedFeeds]
    
    // Initialize feed order if not set
    if (feedOrder.length === 0) {
      const savedOrder = localStorage.getItem('feedOrder')
      if (savedOrder) {
        const parsedOrder = JSON.parse(savedOrder)
        // Validate saved order includes all current feeds
        const currentTypes = allFeeds.map(f => f.type)
        const validOrder = parsedOrder.filter((type: string) => currentTypes.includes(type))
        const missingTypes = currentTypes.filter(type => !validOrder.includes(type))
        setFeedOrder([...validOrder, ...missingTypes])
      } else {
        setFeedOrder(allFeeds.map(f => f.type))
      }
    }
    
    // Sort feeds by the saved order
    return allFeeds.sort((a, b) => {
      const aIndex = feedOrder.indexOf(a.type)
      const bIndex = feedOrder.indexOf(b.type)
      if (aIndex === -1 && bIndex === -1) return 0
      if (aIndex === -1) return 1
      if (bIndex === -1) return -1
      return aIndex - bIndex
    })
  }, [userPrefs, feedGenerators, feedOrder])
  
  const currentFeedOption = feedOptions.find(opt => opt.type === selectedFeed)
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowFeedDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])
  
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
    gcTime: 30 * 60 * 1000,
    refetchOnMount: 'always', // Always fetch fresh data on mount
    refetchInterval: 60 * 1000, // Poll every 60 seconds after initial load
  })
  
  const posts = React.useMemo(() => {
    if (!data?.pages) return []
    return data.pages.flatMap(page => page.feed)
  }, [data])
  
  // Memoize post rendering to prevent unnecessary re-renders
  const PostItem = React.memo(({ item, index }: { item: any; index: number }) => {
    const post = item.post
    const isFocused = focusedPostIndex === index
    
    return (
      <div
        key={`${post.uri}-${index}`}
        ref={el => {
          if (el) postRefs.current[`${post.uri}-${index}`] = el
        }}
        className={`post-item px-4 py-3 relative ${
          (item.reply?.parent || post.record?.reply?.parent) ? 'post-is-reply' : ''
        } ${isFocused ? 'post-focused' : ''}`}
        data-post-uri={post.uri}
        tabIndex={isFocused ? 0 : -1}
        aria-selected={isFocused}
        role="article"
        onClick={() => {
          // Update focused index on click
          setFocusedPostIndex(index)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            handlePostClick(post)
          }
        }}
      >
        {item.reason && (
          <div className="flex items-center gap-2 mb-1.5 text-xs" style={{ color: 'var(--bsky-text-secondary)' }}>
            <Repeat2 size={12} />
            <span>{item.reason.by.displayName || item.reason.by.handle} reposted</span>
          </div>
        )}
        
        {/* Show reply context from feed item */}
        {item.reply?.parent && (
          <div className="relative">
            {/* Reply indicator with background */}
            <div className="reply-indicator flex items-center gap-2 mb-3 px-3 py-2 rounded-lg">
              <div className="flex items-center">
                <div className="w-12 flex justify-center">
                  <div className="w-0.5 h-6" style={{ backgroundColor: 'rgb(29, 155, 240)' }}></div>
                </div>
                <Reply size={16} className="mr-2" style={{ color: 'rgb(29, 155, 240)' }} />
              </div>
              <div className="flex-1">
                <span className="text-sm font-medium" style={{ color: 'var(--bsky-text-primary)' }}>
                  Replying to{' '}
                  <button
                    className="hover:underline font-semibold"
                    style={{ color: 'rgb(29, 155, 240)' }}
                    onClick={(e) => {
                      e.stopPropagation()
                      // Navigate to parent post
                      const parentPost = item.reply.parent
                      if (parentPost) {
                        handlePostClick(parentPost)
                      }
                    }}
                  >
                    @{item.reply.parent.author?.handle || 'unknown'}
                  </button>
                </span>
                {item.reply.parent.record?.text && (
                  <div className="text-xs mt-0.5 line-clamp-1" style={{ color: 'var(--bsky-text-secondary)' }}>
                    "{item.reply.parent.record.text}"
                  </div>
                )}
              </div>
            </div>
            {/* Connecting line from reply indicator to avatar */}
            <div className="absolute left-6 top-full h-3 w-0.5" 
                 style={{ backgroundColor: 'rgba(29, 155, 240, 0.3)' }}></div>
          </div>
        )}
        
        {/* Show reply context from post record if not in feed item */}
        {!item.reply?.parent && post.record?.reply?.parent && (
          <div className="relative">
            {/* Reply indicator with background */}
            <div className="reply-indicator flex items-center gap-2 mb-3 px-3 py-2 rounded-lg">
              <div className="flex items-center">
                <div className="w-12 flex justify-center">
                  <div className="w-0.5 h-6" style={{ backgroundColor: 'rgb(29, 155, 240)' }}></div>
                </div>
                <Reply size={16} className="mr-2" style={{ color: 'rgb(29, 155, 240)' }} />
              </div>
              <span className="text-sm font-medium" style={{ color: 'var(--bsky-text-primary)' }}>
                This is a reply
              </span>
            </div>
            {/* Connecting line from reply indicator to avatar */}
            <div className="absolute left-6 top-full h-3 w-0.5" 
                 style={{ backgroundColor: 'rgba(29, 155, 240, 0.3)' }}></div>
          </div>
        )}
        
        <div className="flex gap-3">
          <img
            src={proxifyBskyImage(post.author.avatar) || '/default-avatar.svg'}
            alt={post.author.handle}
            className="w-12 h-12 rounded-full"
          />
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div 
                className="cursor-pointer"
                onClick={() => handlePostClick(post)}
              >
                <div className="flex items-center gap-2">
                  <span className="font-semibold" style={{ color: 'var(--bsky-text-primary)' }}>
                    {post.author.displayName || post.author.handle}
                  </span>
                  {(item.reply?.parent || post.record?.reply?.parent) && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ 
                            backgroundColor: 'rgb(29, 155, 240)',
                            color: 'white'
                          }}>
                      REPLY
                    </span>
                  )}
                </div>
                <div className="text-sm" style={{ color: 'var(--bsky-text-secondary)' }}>
                  @{post.author.handle} · {formatDistanceToNow(new Date(post.record.createdAt), { addSuffix: true })}
                </div>
              </div>
              
              <div 
                className="relative"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  className="post-menu-button p-2 -m-1 rounded-full transition-all hover:bg-gray-200 dark:hover:bg-gray-800"
                  onClick={(e) => {
                    e.stopPropagation()
                    e.preventDefault()
                    // Post menu functionality would go here
                    console.log('Menu clicked for post:', post.uri)
                  }}
                  aria-label="More options"
                >
                  <MoreVertical 
                    size={16} 
                    className="post-menu-icon"
                    style={{ color: 'var(--bsky-text-secondary)' }}
                  />
                </button>
              </div>
            </div>
            
            <div 
              className="mt-1 whitespace-pre-wrap cursor-pointer" 
              style={{ color: 'var(--bsky-text-primary)' }}
              onClick={() => handlePostClick(post)}
            >
              {post.record.text}
            </div>
            
            {renderEmbed(post.embed)}
            
            {/* Floating action bar on hover - desktop only */}
            <div className="post-action-bar hidden sm:flex items-center gap-3 absolute bottom-2 right-2 px-3 py-1.5 rounded-full transition-all duration-200" style={{ backgroundColor: 'var(--bsky-bg-secondary)', backdropFilter: 'blur(10px)' }}>
              <button
                className="flex items-center gap-1 hover:text-blue-500 transition-colors cursor-pointer select-none"
                style={{ color: 'var(--bsky-text-secondary)' }}
                onClick={(e) => {
                  e.stopPropagation()
                  // Reply functionality would go here
                }}
                type="button"
              >
                <MessageCircle size={14} />
                <span className="text-xs">{post.replyCount || 0}</span>
              </button>
              
              <button
                className={`flex items-center gap-1 hover:text-green-500 transition-colors cursor-pointer select-none ${
                  post.viewer?.repost ? 'text-green-500' : ''
                } ${repostMutation.isPending || unrepostMutation.isPending ? 'opacity-50 cursor-wait' : ''}`}
                style={{ 
                  color: post.viewer?.repost ? undefined : 'var(--bsky-text-secondary)'
                }}
                onClick={(e) => handleRepost(post, e)}
                disabled={repostMutation.isPending || unrepostMutation.isPending}
                type="button"
              >
                <Repeat2 size={14} />
                <span className="text-xs">{post.repostCount || 0}</span>
              </button>
              
              <button
                className={`flex items-center gap-1 hover:text-red-500 transition-colors cursor-pointer select-none ${
                  post.viewer?.like ? 'text-red-500' : ''
                } ${likeMutation.isPending || unlikeMutation.isPending ? 'opacity-50 cursor-wait' : ''}`}
                style={{ 
                  color: post.viewer?.like ? undefined : 'var(--bsky-text-secondary)'
                }}
                onClick={(e) => handleLike(post, e)}
                disabled={likeMutation.isPending || unlikeMutation.isPending}
                type="button"
              >
                <Heart size={14} fill={post.viewer?.like ? 'currentColor' : 'none'} />
                <span className="text-xs">{post.likeCount || 0}</span>
              </button>
              
            </div>
            
            {/* Mobile action bar - always visible */}
            <div className="flex sm:hidden items-center gap-6 mt-2">
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
  })

  
  // Intersection observer for infinite scroll with optimistic pre-fetching
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          debug.log('Pre-fetching next page of feed')
          fetchNextPage()
        }
      },
      { 
        threshold: 0.1,
        // Pre-fetch when user is within 3 viewport heights of the bottom
        rootMargin: '300% 0px 300% 0px'
      }
    )
    
    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current)
    }
    
    return () => observer.disconnect()
  }, [fetchNextPage, hasNextPage, isFetchingNextPage])
  
  // Save scroll position on unmount
  useEffect(() => {
    return () => {
      // Save current scroll position when component unmounts
      if (selectedFeed) {
        scrollPositionRef.current[selectedFeed] = window.scrollY
      }
    }
  }, [selectedFeed])
  
  // Handler functions (must be defined before keyboard navigation useEffect)
  const handlePostClick = (post: Post) => {
    trackClick('post', { postUri: post.uri })
    setSelectedPost(post)
    setShowThread(true)
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
    if (!agent) return
    
    trackFeatureAction('like_post', { postUri: post.uri })
    
    try {
      if (post.viewer?.like) {
        await unlikeMutation.mutateAsync(post.viewer.like)
      } else {
        await likeMutation.mutateAsync({
          uri: post.uri,
          cid: post.cid
        })
      }
    } catch (error) {
      debug.error('Failed to like/unlike post:', error)
    }
  }
  
  
  const handleRepost = async (post: Post, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!agent) return
    
    trackFeatureAction('repost_post', { postUri: post.uri })
    
    try {
      if (post.viewer?.repost) {
        await unrepostMutation.mutateAsync(post.viewer.repost)
      } else {
        await repostMutation.mutateAsync({
          uri: post.uri,
          cid: post.cid
        })
      }
    } catch (error) {
      debug.error('Failed to repost:', error)
    }
  }
  
  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Only handle if this column is focused (for SkyDeck compatibility)
      if (!isFocused) return
      
      // Don't handle shortcuts if user is typing in an input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }
      
      let handled = false
      const currentIndex = focusedPostIndex
      
      switch (e.key) {
        case 'ArrowDown':
        case 'j': // vim-style down
          e.preventDefault()
          handled = true
          if (currentIndex < posts.length - 1) {
            setFocusedPostIndex(currentIndex + 1)
          } else if (currentIndex === -1 && posts.length > 0) {
            // If nothing selected, select first item
            setFocusedPostIndex(0)
          }
          break
          
        case 'ArrowUp':
        case 'k': // vim-style up
          e.preventDefault()
          handled = true
          if (currentIndex > 0) {
            setFocusedPostIndex(currentIndex - 1)
          } else if (currentIndex === -1 && posts.length > 0) {
            // If nothing selected, select last item when going up
            setFocusedPostIndex(posts.length - 1)
          }
          break
          
        case 'Enter':
          e.preventDefault()
          handled = true
          if (currentIndex >= 0 && currentIndex < posts.length) {
            const post = posts[currentIndex]?.post
            if (post) {
              handlePostClick(post)
            }
          }
          break
          
          
        case 'Home':
          e.preventDefault()
          handled = true
          if (posts.length > 0) {
            setFocusedPostIndex(0)
          }
          break
          
        case 'End':
          e.preventDefault()
          handled = true
          if (posts.length > 0) {
            setFocusedPostIndex(posts.length - 1)
          }
          break
          
        case 'PageUp':
          e.preventDefault()
          handled = true
          // Jump up by 5 items
          setFocusedPostIndex(Math.max(0, currentIndex - 5))
          break
          
        case 'PageDown':
          e.preventDefault()
          handled = true
          // Jump down by 5 items
          setFocusedPostIndex(Math.min(posts.length - 1, currentIndex + 5))
          break
          
        case 'Escape':
          // Clear selection
          setFocusedPostIndex(-1)
          handled = true
          break
          
        case ' ': // Space for page scroll
          if (!e.shiftKey) {
            e.preventDefault()
            window.scrollBy({ top: window.innerHeight * 0.8, behavior: 'smooth' })
            handled = true
          }
          break
      }
      
      // Prevent default browser scrolling if we handled the key
      if (handled) {
        e.stopPropagation()
      }
    }
    
    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [posts, focusedPostIndex, isFocused, handlePostClick])
  
  // Scroll focused post into view
  useEffect(() => {
    if (focusedPostIndex >= 0 && focusedPostIndex < posts.length) {
      const post = posts[focusedPostIndex]?.post
      if (post) {
        const postKey = `${post.uri}-${focusedPostIndex}`
        const postEl = postRefs.current[postKey]
        if (postEl) {
          postEl.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
          })
          postEl.focus()
        }
      }
    }
  }, [focusedPostIndex, posts])
  
  // Make container focusable for keyboard navigation
  useEffect(() => {
    if (containerRef.current && isFocused) {
      // Focus container when column becomes focused
      // This ensures keyboard events are captured
      containerRef.current.focus()
    }
  }, [isFocused])
  
  const renderEmbed = (embed: any) => {
    if (!embed) return null
    
    if (embed.$type === 'app.bsky.embed.images#view') {
      const handleImageClick = (e: React.MouseEvent, index: number) => {
        e.stopPropagation()
        const images = embed.images.map((img: any) => ({
          thumb: proxifyBskyImage(img.thumb),
          fullsize: proxifyBskyImage(img.fullsize),
          alt: img.alt
        }))
        setGalleryImages(images)
        setGalleryIndex(index)
        trackFeatureAction('image_gallery_opened', { imageCount: images.length })
      }

      // Determine grid layout based on image count
      const gridClass = embed.images.length === 1 
        ? 'grid-cols-1' 
        : embed.images.length === 2 
        ? 'grid-cols-2' 
        : embed.images.length === 3
        ? 'grid-cols-3'
        : 'grid-cols-2'

      return (
        <div className={`mt-2 grid gap-1 ${gridClass}`}>
          {embed.images.map((img: any, idx: number) => {
            // Special layout for 3 images: first image takes 2/3, others 1/3 each
            const isThreeImageLayout = embed.images.length === 3
            const colSpan = isThreeImageLayout && idx === 0 ? 'col-span-2 row-span-2' : ''
            
            return (
              <div
                key={idx}
                className={`relative rounded-lg overflow-hidden cursor-pointer hover:opacity-95 transition-opacity ${colSpan}`}
                onClick={(e) => handleImageClick(e, idx)}
                style={{ backgroundColor: 'var(--bsky-bg-tertiary)' }}
              >
                {/* Aspect ratio container */}
                <div className="relative w-full" style={{ paddingBottom: isThreeImageLayout && idx === 0 ? '100%' : '75%' }}>
                  <img
                    src={proxifyBskyImage(img.thumb)}
                    alt={img.alt || ''}
                    className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300"
                    loading="lazy"
                    onLoad={(e) => {
                      // Fade in on load
                      const img = e.target as HTMLImageElement
                      img.style.opacity = '1'
                    }}
                    style={{ opacity: 0 }}
                  />
                  {/* Loading state placeholder with blur effect */}
                  <div className="absolute inset-0 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 animate-pulse" style={{ zIndex: -1, filter: 'blur(20px)' }} />
                </div>
                {img.alt && (
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1.5 opacity-0 hover:opacity-100 transition-opacity">
                    ALT
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )
    }
    
    if (embed.$type === 'app.bsky.embed.external#view') {
      return (
        <div className="mt-2 border rounded-lg p-2.5 hover:bg-opacity-5 hover:bg-blue-500 transition-colors cursor-pointer"
             style={{ borderColor: 'var(--bsky-border-primary)' }}
             onClick={(e) => {
               e.stopPropagation()
               window.open(embed.external.uri, '_blank')
             }}>
          {embed.external.thumb && (
            <img
              src={proxifyBskyImage(embed.external.thumb)}
              alt=""
              className="w-full h-auto object-cover rounded mb-2"
              style={{ maxHeight: '200px', backgroundColor: 'var(--bsky-bg-tertiary)' }}
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
        <div className="mt-2 rounded-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
          <VideoPlayer
            src={proxifyBskyVideo(embed.playlist)}
            thumbnail={embed.thumbnail ? proxifyBskyVideo(embed.thumbnail) : undefined}
            aspectRatio={embed.aspectRatio}
            alt={embed.alt}
          />
        </div>
      )
    }
    
    // Handle quote posts
    if (embed.$type === 'app.bsky.embed.record#view') {
      const quotedPost = embed.record
      if (quotedPost?.$type === 'app.bsky.embed.record#viewRecord') {
        return (
          <div className="mt-2 border rounded-lg overflow-hidden transition-all hover:border-opacity-80"
               style={{ borderColor: 'var(--bsky-border-primary)' }}>
            {/* Quote post header */}
            <div className="px-3 py-1.5 flex items-center gap-2 text-xs"
                 style={{ 
                   backgroundColor: 'var(--bsky-bg-tertiary)',
                   borderBottom: `1px solid var(--bsky-border-primary)`,
                   color: 'var(--bsky-text-secondary)'
                 }}>
              <MessageCircle size={12} />
              <span>Quoted post</span>
            </div>
            
            {/* Quote post content */}
            <div className="p-3 cursor-pointer hover:bg-opacity-5 hover:bg-blue-500 transition-colors"
                 onClick={(e) => {
                   e.stopPropagation()
                   handlePostClick({ uri: quotedPost.uri, cid: quotedPost.cid })
                 }}>
              <div className="flex items-center gap-2 mb-2">
                <img
                  src={proxifyBskyImage(quotedPost.author.avatar) || '/default-avatar.svg'}
                  alt={quotedPost.author?.handle || 'unknown'}
                  className="w-5 h-5 rounded-full"
                />
                <div className="flex items-center gap-1 text-sm">
                  <span className="font-semibold" style={{ color: 'var(--bsky-text-primary)' }}>
                    {quotedPost.author?.displayName || quotedPost.author?.handle || 'Unknown'}
                  </span>
                  <span style={{ color: 'var(--bsky-text-secondary)' }}>
                    @{quotedPost.author?.handle || 'unknown'}
                  </span>
                </div>
              </div>
              <div className="text-sm" style={{ color: 'var(--bsky-text-primary)' }}>
                {quotedPost.value.text}
              </div>
              {quotedPost.embeds?.[0] && renderEmbed(quotedPost.embeds[0])}
            </div>
          </div>
        )
      }
      // Handle deleted or blocked quotes
      if (quotedPost?.$type === 'app.bsky.embed.record#viewNotFound') {
        return (
          <div className="mt-2 border rounded-lg overflow-hidden"
               style={{ borderColor: 'var(--bsky-border-primary)' }}>
            <div className="px-3 py-1.5 flex items-center gap-2 text-xs"
                 style={{ 
                   backgroundColor: 'var(--bsky-bg-tertiary)',
                   borderBottom: `1px solid var(--bsky-border-primary)`,
                   color: 'var(--bsky-text-secondary)'
                 }}>
              <MessageCircle size={12} />
              <span>Quoted post</span>
            </div>
            <div className="p-3">
              <div className="text-sm italic" style={{ color: 'var(--bsky-text-secondary)' }}>
                Post not found or deleted
              </div>
            </div>
          </div>
        )
      }
      if (quotedPost?.$type === 'app.bsky.embed.record#viewBlocked') {
        return (
          <div className="mt-2 border rounded-lg overflow-hidden"
               style={{ borderColor: 'var(--bsky-border-primary)' }}>
            <div className="px-3 py-1.5 flex items-center gap-2 text-xs"
                 style={{ 
                   backgroundColor: 'var(--bsky-bg-tertiary)',
                   borderBottom: `1px solid var(--bsky-border-primary)`,
                   color: 'var(--bsky-text-secondary)'
                 }}>
              <MessageCircle size={12} />
              <span>Quoted post</span>
            </div>
            <div className="p-3">
              <div className="text-sm italic" style={{ color: 'var(--bsky-text-secondary)' }}>
                Post from blocked user
              </div>
            </div>
          </div>
        )
      }
    }
    
    // Handle record with media (quote post + media)
    if (embed.$type === 'app.bsky.embed.recordWithMedia#view') {
      return (
        <div className="mt-3">
          {embed.media && renderEmbed(embed.media)}
          {embed.record && renderEmbed(embed.record)}
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
    
    // Save current scroll position for the current feed
    if (containerRef.current) {
      scrollPositionRef.current[selectedFeed] = window.scrollY
      debug.log(`Saved scroll position for ${selectedFeed}:`, window.scrollY)
    }
    
    setSelectedFeed(feed)
    // Only save to localStorage if this is the main home column
    if (!initialFeedUri) {
      localStorage.setItem('selectedFeed', feed)
    }
    trackFeatureAction('feed_changed', { feed })
    
    // Restore scroll position for the new feed after a short delay to allow content to render
    setTimeout(() => {
      const savedPosition = scrollPositionRef.current[feed]
      if (savedPosition !== undefined) {
        debug.log(`Restoring scroll position for ${feed}:`, savedPosition)
        window.scrollTo(0, savedPosition)
      } else {
        // Scroll to top for new feeds
        window.scrollTo(0, 0)
      }
    }, 100)
  }
  
  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, feedType: string) => {
    setDraggedTab(feedType)
    e.dataTransfer.effectAllowed = 'move'
  }
  
  const handleDragOver = (e: React.DragEvent, feedType: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverTab(feedType)
  }
  
  const handleDragLeave = () => {
    setDragOverTab(null)
  }
  
  const handleDrop = (e: React.DragEvent, targetFeedType: string) => {
    e.preventDefault()
    setDragOverTab(null)
    
    if (!draggedTab || draggedTab === targetFeedType) {
      setDraggedTab(null)
      return
    }
    
    const newOrder = [...feedOrder]
    const draggedIndex = newOrder.indexOf(draggedTab)
    const targetIndex = newOrder.indexOf(targetFeedType)
    
    if (draggedIndex !== -1 && targetIndex !== -1) {
      // Remove dragged item and insert at new position
      newOrder.splice(draggedIndex, 1)
      newOrder.splice(targetIndex, 0, draggedTab)
      
      setFeedOrder(newOrder)
      localStorage.setItem('feedOrder', JSON.stringify(newOrder))
    }
    
    setDraggedTab(null)
  }
  
  const handleDragEnd = () => {
    setDraggedTab(null)
    setDragOverTab(null)
  }
  
  return (
    <div className="w-full" ref={containerRef} tabIndex={-1} style={{ outline: 'none' }}>
      <div className="sticky top-0 z-10 bsky-glass border-b" style={{ borderColor: 'var(--bsky-border-primary)' }}>
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {currentFeedOption && <currentFeedOption.icon size={20} style={{ color: 'var(--bsky-primary)' }} />}
            <h2 className="text-lg font-semibold" style={{ color: 'var(--bsky-text-primary)' }}>
              {currentFeedOption?.label || 'Feed'}
            </h2>
            {focusedPostIndex === -1 ? (
              <span className="text-xs ml-2" style={{ color: 'var(--bsky-text-secondary)' }}>
                Press ↓/j to navigate
              </span>
            ) : (
              <span className="text-xs ml-2 hidden sm:inline" style={{ color: 'var(--bsky-text-secondary)' }}>
                ↑↓/jk: navigate • Enter: open
              </span>
            )}
          </div>
          
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowFeedDropdown(!showFeedDropdown)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-opacity-10 hover:bg-gray-500 transition-all"
              style={{ color: 'var(--bsky-text-secondary)' }}
            >
              <span className="text-sm">Change</span>
              <ChevronDown size={16} className={`transition-transform ${showFeedDropdown ? 'rotate-180' : ''}`} />
            </button>
            
            {showFeedDropdown && (
              <div className="absolute right-0 mt-2 w-64 rounded-lg shadow-lg overflow-hidden"
                style={{ 
                  backgroundColor: 'var(--bsky-bg-secondary)',
                  border: '1px solid var(--bsky-border-primary)'
                }}>
                <div className="max-h-96 overflow-y-auto">
                  {feedOptions.map((option) => (
                    <button
                      key={option.type}
                      onClick={() => {
                        handleFeedChange(option.type)
                        setShowFeedDropdown(false)
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-opacity-5 hover:bg-blue-500 transition-colors text-left ${
                        selectedFeed === option.type ? 'bg-opacity-10 bg-blue-500' : ''
                      }`}
                    >
                      <option.icon size={18} style={{ 
                        color: selectedFeed === option.type ? 'var(--bsky-primary)' : 'var(--bsky-text-secondary)' 
                      }} />
                      <div className="flex-1">
                        <div className="font-medium text-sm" style={{ color: 'var(--bsky-text-primary)' }}>
                          {option.label}
                        </div>
                        {option.generator?.description && (
                          <div className="text-xs mt-0.5" style={{ color: 'var(--bsky-text-tertiary)' }}>
                            {option.generator.description}
                          </div>
                        )}
                      </div>
                      {option.pinned && <Star size={14} className="text-yellow-500" />}
                      {selectedFeed === option.type && (
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--bsky-primary)' }} />
                      )}
                    </button>
                  ))}
                </div>
                
                <div className="border-t" style={{ borderColor: 'var(--bsky-border-secondary)' }}>
                  <button
                    onClick={() => {
                      setShowFeedDiscovery(true)
                      setShowFeedDropdown(false)
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-opacity-5 hover:bg-blue-500 transition-colors"
                  >
                    <Plus size={18} style={{ color: 'var(--bsky-text-secondary)' }} />
                    <span className="text-sm font-medium" style={{ color: 'var(--bsky-text-primary)' }}>
                      Discover Feeds
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div className="max-w-2xl mx-auto px-3 sm:px-4" ref={postsContainerRef}>
        <div className="divide-y" style={{ borderColor: 'var(--bsky-border-primary)' }} role="feed" aria-label="Posts">
        {posts.map((item: any, index: number) => (
          <PostItem key={`${item.post.uri}-${index}`} item={item} index={index} />
        ))}
        </div>
        
        {isFetchingNextPage && (
          <div className="flex items-center justify-center p-8">
            <Loader className="animate-spin" size={24} style={{ color: 'var(--bsky-primary)' }} />
          </div>
        )}
        
        <div ref={loadMoreRef} className="h-20" />
      </div>
      
      <FeedDiscovery 
        isOpen={showFeedDiscovery} 
        onClose={() => setShowFeedDiscovery(false)} 
      />
      
      {galleryImages && (
        <ImageGallery
          images={galleryImages}
          initialIndex={galleryIndex}
          onClose={() => {
            setGalleryImages(null)
            setGalleryIndex(0)
          }}
        />
      )}
      
      {showThread && selectedPost && (
        <ThreadModal
          postUri={selectedPost.uri}
          onClose={() => {
            setShowThread(false)
            setSelectedPost(null)
          }}
        />
      )}
    </div>
  )
}