import React, { useState, useEffect, useRef } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { Repeat2, Loader, Hash, RefreshCw } from 'lucide-react';
import { proxifyBskyImage } from '../utils/image-proxy';
import { ThreadModal } from './ThreadModal';
import { PostActionBar } from './PostActionBar';
import { useOptimisticPosts } from '../hooks/useOptimisticPosts';

interface SkyColumnFeedProps {
  feedUri?: string;
  isFocused?: boolean;
}

export default function SkyColumnFeed({ feedUri, isFocused = false }: SkyColumnFeedProps) {
  const { agent } = useAuth();
  const queryClient = useQueryClient();
  const { likeMutation, unlikeMutation, repostMutation, unrepostMutation } = useOptimisticPosts();
  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [showThread, setShowThread] = useState(false);
  // Use a ref to store the focused post URI to persist across renders
  const focusedPostUriRef = useRef<string | null>(null);
  const [focusedPostIndex, setFocusedPostIndex] = useState(0);
  const [focusedPostUri, setFocusedPostUri] = useState<string | null>(null);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  
  // Fetch feed generator info
  const { data: feedInfo } = useQuery({
    queryKey: ['feedGenerator', feedUri],
    queryFn: async () => {
      if (!agent || !feedUri || feedUri === 'following') return null;
      
      try {
        const response = await agent.app.bsky.feed.getFeedGenerator({
          feed: feedUri
        });
        return response.data.view;
      } catch (error) {
        console.error('Failed to fetch feed info:', error);
        return null;
      }
    },
    enabled: !!agent && !!feedUri && feedUri !== 'following',
    staleTime: 5 * 60 * 1000,
  });
  
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

  // Fetch feed posts
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError
  } = useInfiniteQuery<{posts: any[], cursor?: string}, Error>({
    queryKey: ['columnFeed', feedUri],
    queryFn: async ({ pageParam }) => {
      const cursor = pageParam as string | undefined;
      if (!agent) throw new Error('Not authenticated');
      
      let response;
      
      if (!feedUri || feedUri === 'following') {
        // Following feed
        response = await agent.getTimeline({
          cursor: cursor,
          limit: 30
        });
      } else {
        // Custom feed
        try {
          response = await agent.app.bsky.feed.getFeed({
            feed: feedUri,
            cursor: cursor,
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
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.cursor,
    enabled: !!agent,
    staleTime: 30 * 60 * 1000, // 30 minutes - feeds don't need frequent updates
    gcTime: 60 * 60 * 1000, // 1 hour
    refetchOnMount: false // Don't automatically refetch
  });

  const allPosts = React.useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((page: any, pageIndex: number) => 
      page.posts.map((post: any, postIndex: number) => ({
        ...post,
        _pageIndex: pageIndex,
        _postIndex: postIndex
      }))
    );
  }, [data]);


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
    const newIndex = allPosts.findIndex((feedPost: any) => {
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

  // Handle like action
  const handleLike = async (post: any) => {
    if (!agent) return;
    
    try {
      if (post.viewer?.like) {
        await unlikeMutation.mutateAsync({ likeUri: post.viewer.like, postUri: post.uri });
      } else {
        await likeMutation.mutateAsync({
          uri: post.uri,
          cid: post.cid
        });
      }
    } catch (error) {
      console.error('Failed to like/unlike post:', error);
    }
  };
  
  // Handle repost action
  const handleRepost = async (post: any) => {
    if (!agent) return;
    
    try {
      if (post.viewer?.repost) {
        await unrepostMutation.mutateAsync({ repostUri: post.viewer.repost, postUri: post.uri });
      } else {
        await repostMutation.mutateAsync({
          uri: post.uri,
          cid: post.cid
        });
      }
    } catch (error) {
      console.error('Failed to repost:', error);
    }
  };

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
        className={`post-item border-b cursor-pointer hover:bg-opacity-5 hover:bg-blue-500 transition-colors ${
          isFocusedPost ? 'bg-opacity-10 bg-blue-500 border-l-4 border-l-blue-500 pl-3' : ''
        }`}
        style={{ borderColor: 'var(--bsky-border-primary)' }}
        onClick={handlePostClick}
        data-uri={post.uri}
      >
        {isRepost && feedPost.reason?.by && (
          <div className="flex items-center gap-2 px-4 pt-2 text-sm" style={{ color: 'var(--bsky-text-secondary)' }}>
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
              
              {/* Post Action Bar */}
              <PostActionBar
                post={post}
                onReply={() => {
                  // Reply functionality
                  console.log('Reply to:', post.uri)
                }}
                onLike={() => handleLike(post)}
                onRepost={() => handleRepost(post)}
                showCounts={true}
                size="medium"
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader className="w-6 h-6 animate-spin" style={{ color: 'var(--bsky-primary)' }} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <p className="text-center" style={{ color: 'var(--bsky-error)' }}>
          Failed to load feed. Please try again.
        </p>
      </div>
    );
  }

  // Memoize post component to prevent unnecessary re-renders
  const PostComponent = React.memo(({ feedPost, index }: { feedPost: any; index: number }) => {
    return renderPost(feedPost, index);
  });

  return (
    <>
      {/* Header */}
      <div className="sticky top-0 z-20 bsky-glass border-b" style={{ borderColor: 'var(--bsky-border-primary)' }}>
        <div className="px-4 py-3 pr-12 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Hash size={20} style={{ color: 'var(--bsky-primary)' }} />
            <h2 className="text-lg font-semibold" style={{ color: 'var(--bsky-text-primary)' }}>
              {feedInfo?.displayName || (feedUri === 'following' ? 'Following' : 'Feed')}
            </h2>
          </div>
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['columnFeed', feedUri] })}
            className="p-2 rounded-lg hover:bg-opacity-10 hover:bg-gray-500 transition-all"
            style={{ color: 'var(--bsky-text-secondary)' }}
            aria-label="Refresh feed"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>
      
      <div ref={containerRef} className="h-full overflow-y-auto skydeck-scrollbar">
        {allPosts.map((post: any, index: number) => {
          const actualPost = post?.post || post;
          const postUri = actualPost?.uri;
          const uniqueKey = `${postUri}-page${post._pageIndex}-post${post._postIndex}`;
          return (
            <PostComponent key={uniqueKey} feedPost={post} index={index} />
          );
        })}
        
        {hasNextPage && (
          <div className="p-4 flex justify-center">
            <button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="px-4 py-2 rounded-lg disabled:opacity-50 transition-colors"
              style={{ 
                backgroundColor: 'var(--bsky-primary)',
                color: 'white'
              }}
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