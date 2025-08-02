import React, { useState, useEffect, useRef } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { Heart, Repeat2, MessageCircle, Loader } from 'lucide-react';
import { proxifyBskyImage } from '../utils/image-proxy';
import { ThreadModal } from './ThreadModal';

interface SkyColumnFeedProps {
  feedUri?: string;
  isFocused?: boolean;
}

interface Post {
  uri: string;
  cid: string;
  author: {
    did: string;
    handle: string;
    displayName?: string;
    avatar?: string;
  };
  record: {
    text: string;
    createdAt: string;
    embed?: any;
  };
  embed?: any;
  replyCount: number;
  repostCount: number;
  likeCount: number;
  viewer?: {
    like?: string;
    repost?: string;
  };
  reason?: {
    $type: string;
    by: {
      did: string;
      handle: string;
      displayName?: string;
    };
  };
}

export default function SkyColumnFeed({ feedUri, isFocused = false }: SkyColumnFeedProps) {
  const { agent } = useAuth();
  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [showThread, setShowThread] = useState(false);
  // Use a ref to store the focused post URI to persist across renders
  const focusedPostUriRef = useRef<string | null>(null);
  const [focusedPostIndex, setFocusedPostIndex] = useState(0);
  const [focusedPostUri, setFocusedPostUri] = useState<string | null>(null);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState(Date.now());
  
  // Helper to update both state and ref
  const updateFocusedPost = (uri: string | null, index: number) => {
    focusedPostUriRef.current = uri;
    setFocusedPostUri(uri);
    setFocusedPostIndex(index);
    setHasUserInteracted(true);
  };
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef<number>(0);
  const isRestoringScrollRef = useRef(false);
  const previousPostsRef = useRef<any[]>([]);

  // Fetch feed posts
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError
  } = useInfiniteQuery({
    queryKey: ['columnFeed', feedUri],
    queryFn: async ({ pageParam = undefined }) => {
      if (!agent) throw new Error('Not authenticated');
      
      let response;
      
      if (!feedUri || feedUri === 'following') {
        // Following feed
        response = await agent.getTimeline({
          cursor: pageParam,
          limit: 30
        });
      } else {
        // Custom feed
        try {
          response = await agent.app.bsky.feed.getFeed({
            feed: feedUri,
            cursor: pageParam,
            limit: 30
          });
        } catch (error) {
          console.error(`Failed to fetch feed ${feedUri}:`, error);
          throw error;
        }
      }
      
      return {
        posts: response.data.feed,
        cursor: response.data.cursor
      };
    },
    getNextPageParam: (lastPage) => lastPage.cursor,
    enabled: !!agent,
    staleTime: 30 * 60 * 1000, // 30 minutes - feeds don't need frequent updates
    gcTime: 5 * 60 * 1000,
    refetchOnMount: 'always', // Always fetch fresh data on mount
    refetchInterval: 60 * 1000, // Poll every 60 seconds after initial load
    // Keep previous data while fetching
    keepPreviousData: true,
  });

  const allPosts = data?.pages.flatMap(page => page.posts) || [];

  // Save scroll position when scrolling
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (!isRestoringScrollRef.current) {
        scrollPositionRef.current = container.scrollTop;
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Maintain focused post index when data updates
  useEffect(() => {
    if (!hasUserInteracted || !focusedPostUriRef.current || allPosts.length === 0) return;
    
    // Find the focused post in the new data
    const newIndex = allPosts.findIndex(feedPost => {
      const post = feedPost.post || feedPost;
      return post.uri === focusedPostUriRef.current;
    });
    
    if (newIndex !== -1 && newIndex !== focusedPostIndex) {
      // Update the index to match the new position
      setFocusedPostIndex(newIndex);
    }
  }, [allPosts]); // Only depend on allPosts changing

  // Restore scroll position after data changes
  useEffect(() => {
    const container = containerRef.current;
    if (!container || scrollPositionRef.current === 0) return;

    // Restore scroll position
    isRestoringScrollRef.current = true;
    requestAnimationFrame(() => {
      if (container) {
        container.scrollTop = scrollPositionRef.current;
      }
      requestAnimationFrame(() => {
        isRestoringScrollRef.current = false;
      });
    });
  }, [data?.pages]); // Trigger when pages update

  // Handle j/k navigation when column is focused
  useEffect(() => {
    if (!isFocused) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't interfere with input fields
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        const newIndex = Math.min(allPosts.length - 1, focusedPostIndex + 1);
        const post = allPosts[newIndex]?.post || allPosts[newIndex];
        if (post) {
          updateFocusedPost(post.uri, newIndex);
        }
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        const newIndex = Math.max(0, focusedPostIndex - 1);
        const post = allPosts[newIndex]?.post || allPosts[newIndex];
        if (post) {
          updateFocusedPost(post.uri, newIndex);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFocused, focusedPostIndex, allPosts]);

  // Scroll focused post into view when navigating with keyboard
  useEffect(() => {
    if (containerRef.current && focusedPostUri && hasUserInteracted) {
      // Find the element by data-uri attribute for reliability
      const focusedElement = containerRef.current.querySelector(`[data-uri="${focusedPostUri}"]`) as HTMLElement;
      
      if (focusedElement && !isRestoringScrollRef.current) {
        const container = containerRef.current;
        const containerRect = container.getBoundingClientRect();
        const elementRect = focusedElement.getBoundingClientRect();
        
        // Only scroll if element is not fully visible
        if (elementRect.top < containerRect.top || elementRect.bottom > containerRect.bottom) {
          focusedElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }
  }, [focusedPostIndex, focusedPostUri, hasUserInteracted]);

  // Render post component
  const renderPost = (feedPost: any, index: number) => {
    // The actual post might be nested in feedPost.post
    const post = feedPost.post || feedPost;
    
    if (!post || !post.author) {
      return null;
    }
    
    const isRepost = feedPost.reason?.$type === 'app.bsky.feed.defs#reasonRepost';
    // Check if this post is focused - use the ref for stability across renders
    const isFocusedPost = hasUserInteracted && focusedPostUriRef.current === post.uri;
    
    const handlePostClick = () => {
      setSelectedPost(post);
      setShowThread(true);
      // Update focused post when clicking
      updateFocusedPost(post.uri, index);
    };
    
    return (
      <div 
        key={post.uri} 
        className={`post-item border-b dark:border-gray-800 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors ${
          isFocusedPost ? 'bg-blue-50 dark:bg-gray-900/50 border-l-4 border-l-blue-500 pl-3' : ''
        }`}
        onClick={handlePostClick}
        data-uri={post.uri}
      >
        {isRepost && feedPost.reason?.by && (
          <div className="flex items-center gap-2 px-4 pt-2 text-sm text-gray-600 dark:text-gray-400">
            <Repeat2 size={14} />
            <span>{feedPost.reason.by.displayName || feedPost.reason.by.handle} reposted</span>
          </div>
        )}
        
        <div className="p-4">
          <div className="flex items-start gap-3">
            {post.author?.avatar && (
              <img
                src={proxifyBskyImage(post.author.avatar)}
                alt={post.author.handle || ''}
                className="w-10 h-10 rounded-full"
              />
            )}
            
            <div className="flex-1 min-w-0">
              <div className="text-sm">
                <div className="flex items-baseline gap-2">
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {post.author?.displayName || post.author?.handle || 'Unknown'}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-500">
                    {post.record?.createdAt ? formatDistanceToNow(new Date(post.record.createdAt), { addSuffix: true }) : 'some time ago'}
                  </span>
                </div>
                <div className="text-gray-500 dark:text-gray-300">
                  @{post.author?.handle || 'unknown'}
                </div>
              </div>
              
              <div className="mt-2 text-gray-900 dark:text-white whitespace-pre-wrap break-words">
                {post.record?.text || ''}
              </div>
              
              {/* Simplified embed rendering */}
              {post.embed?.images && Array.isArray(post.embed.images) && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {post.embed.images.map((image: any, idx: number) => (
                    <img
                      key={idx}
                      src={proxifyBskyImage(image.thumb || image.fullsize || '')}
                      alt={image.alt || ''}
                      className="rounded-lg w-full h-auto"
                    />
                  ))}
                </div>
              )}
              
              <div className="mt-3 flex items-center gap-6 text-sm text-gray-600 dark:text-gray-400">
                <button 
                  className="flex items-center gap-1 hover:text-blue-500 transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MessageCircle size={16} />
                  <span>{post.replyCount || 0}</span>
                </button>
                
                <button 
                  className={`flex items-center gap-1 hover:text-green-500 transition-colors ${
                    post.viewer?.repost ? 'text-green-500' : ''
                  }`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Repeat2 size={16} />
                  <span>{post.repostCount || 0}</span>
                </button>
                
                <button 
                  className={`flex items-center gap-1 hover:text-red-500 transition-colors ${
                    post.viewer?.like ? 'text-red-500' : ''
                  }`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Heart size={16} fill={post.viewer?.like ? 'currentColor' : 'none'} />
                  <span>{post.likeCount || 0}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <p className="text-red-500 dark:text-red-400 text-center">
          Failed to load feed. Please try again.
        </p>
      </div>
    );
  }

  // Don't memoize the posts - let them re-render with new data
  // but keep the focused state stable

  return (
    <>
      <div ref={containerRef} className="h-full overflow-y-auto dark:bg-gray-950 skydeck-scrollbar">
        {allPosts.map((post, index) => {
          const postUri = (post?.post || post)?.uri;
          return (
            <React.Fragment key={postUri || `post-${index}`}>
              {renderPost(post, index)}
            </React.Fragment>
          );
        })}
        
        {hasNextPage && (
          <div className="p-4 flex justify-center">
            <button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
            >
              {isFetchingNextPage ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                'Load more'
              )}
            </button>
          </div>
        )}
      </div>
      
      {showThread && selectedPost && (
        <ThreadModal
          postUri={selectedPost.uri}
          onClose={() => {
            setShowThread(false);
            setSelectedPost(null);
          }}
        />
      )}
    </>
  );
}