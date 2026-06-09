import type { AppBskyFeedDefs } from "@atproto/api";
import { debug } from "@bsky/shared";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Repeat2, Reply } from "lucide-react";
import React, { Suspense, useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useHiddenPosts } from "../contexts/HiddenPostsContext";
import { useKeyboardShortcutsContext } from "../contexts/KeyboardShortcutsContext";
import { useModeration } from "../contexts/ModerationContext";
import { useBookmarks } from "../hooks/useBookmarks";
import { useIntersectionLoader } from "../hooks/useIntersectionLoader";
import {
  useFeedCacheWarmup,
  useVisibilityRefresh,
} from "../hooks/useOfflineFeed";
import { useOptimisticPosts } from "../hooks/useOptimisticPosts";
import { usePostDeepLink } from "../hooks/usePostDeepLink";
import { useRoutePrefetch } from "../hooks/useRoutePrefetch";
import { useMinDuration } from "../hooks/useTiming";
import { useViewTransitionNavigate } from "../hooks/useViewTransitionNavigate";
import { proxifyBskyImage } from "../utils/image-proxy";
import { lazyWithRetry } from "../utils/lazyWithRetry";
import { NetworkWeatherLayer } from "./NetworkWeatherLayer";
import { PostActionBar } from "./PostActionBar";
import { Spinner } from "./ui/LoadingState";
import { ProfileHoverCard } from "./ui/ProfileHoverCard";

import { RichText } from "./ui/RichText";
import { FeedSkeleton, PostSkeleton } from "./ui/SkeletonLoader";
import {
  type FeedQueryData,
  type HomeProps,
  MOBILE_CONFIG,
  type Post,
} from "./Home.types";
import { FeedEmbed, type GalleryImage } from "./HomeFeedEmbed";
import { useFeedSelection } from "./useFeedSelection";
import { useHomeFeedQuery } from "./useHomeFeedQuery";
import { useThreadModalState } from "./useThreadModalState";

// Code-split heavy components to improve initial load time
const FeedDiscovery = lazyWithRetry(() =>
  import("./FeedDiscovery").then((m) => ({ default: m.FeedDiscovery })),
);
const ImageGallery = lazyWithRetry(() =>
  import("./ImageGallery").then((m) => ({ default: m.ImageGallery })),
);
const ThreadModal = lazyWithRetry(() =>
  import("./ThreadModal").then((m) => ({ default: m.ThreadModal })),
);

export const Home: React.FC<HomeProps> = React.memo(
  ({
    initialFeedUri,
    isFocused = true,
    columnId,
    onFeedChange,
    onRefreshRequest,
    showFeedDiscovery: externalShowFeedDiscovery,
    onCloseFeedDiscovery,
  }) => {
    const { agent } = useAuth();
    const navigate = useViewTransitionNavigate();
    const queryClient = useQueryClient();
    const { likeMutation, repostMutation, undoableUnlike, undoableUnrepost } =
      useOptimisticPosts();
    const { toggleBookmark } = useBookmarks();
    const { isPostHidden } = useHiddenPosts();
    const { isUserMuted, isUserBlocked, isThreadMuted } = useModeration();
    const { getThreadPrefetchHandlers } = useRoutePrefetch();
    // Deep link support for direct navigation to posts via URL fragments
    // The hook automatically scrolls to the post via DOM id/data attributes
    usePostDeepLink({
      enabled: isFocused,
    });
    // Removed hoveredPost state to prevent re-renders - using CSS hover instead
    // Feed selection (selected feed, available feed options, parent sync)
    const { selectedFeed } = useFeedSelection({
      initialFeedUri,
      columnId,
      onFeedChange,
      onRefreshRequest,
    });

    // Stability-focused caching: warm up cache for instant first load
    // Pre-populates React Query cache with IndexedDB data before component fetches
    // Only enable for standard timeline feeds - custom feeds (AT URIs) aren't cached in offline storage
    const isStandardTimelineFeed =
      selectedFeed === "following" || selectedFeed === "recent";
    useFeedCacheWarmup(
      ["timeline", selectedFeed],
      "timeline",
      isStandardTimelineFeed,
    );

    // Auto-refresh feed when tab becomes visible after being hidden for 1+ minute
    useVisibilityRefresh(["timeline", selectedFeed], {
      enabled: isFocused,
      minHiddenDuration: 60000, // 1 minute
    });

    const [internalShowFeedDiscovery, setInternalShowFeedDiscovery] =
      useState(false);
    const showFeedDiscovery =
      externalShowFeedDiscovery !== undefined
        ? externalShowFeedDiscovery
        : internalShowFeedDiscovery;
    const [galleryImages, setGalleryImages] = useState<GalleryImage[] | null>(
      null,
    );
    const [galleryIndex, setGalleryIndex] = useState(0);
    // Thread modal state (open post, reply/quote focus, session persistence)
    const {
      selectedPost,
      showThread,
      openThreadToReply,
      openThreadToQuote,
      openThread: handlePostClick,
      openThreadToReplyTo,
      openThreadToQuotePost,
      openThreadByUri,
      closeThread,
    } = useThreadModalState();
    const [focusedPostIndex, setFocusedPostIndex] = useState<number>(-1);
    const postsContainerRef = useRef<HTMLDivElement>(null);
    // Removed showFeedDropdown - now handled by parent component
    const loadMoreRef = useRef<HTMLDivElement>(null);
    const scrollPositionRef = useRef<{ [key: string]: number }>({});
    const containerRef = useRef<HTMLDivElement>(null);
    const postRefs = useRef<{ [key: string]: HTMLDivElement }>({});
    // Removed dropdownRef - now handled by parent component
    const isKeyboardNavigationRef = useRef(false);

    // Keyboard shortcuts context for L/R/B/S/C shortcuts
    const { setFocusedPost, registerPostActions, unregisterPostActions } =
      useKeyboardShortcutsContext();

    // Dropdown is now handled by the parent component

    const feedQuery = useHomeFeedQuery(selectedFeed);

    const {
      data,
      isLoading: isLoadingRaw,
      error,
      fetchNextPage,
      hasNextPage,
      isFetchingNextPage,
    } = feedQuery;

    // Apply minimum duration to prevent jarring flash of loading state
    const isLoading = useMinDuration(isLoadingRaw);

    const posts = React.useMemo(() => {
      if (!data?.pages) return [];
      return data.pages.flatMap((page, pageIndex) =>
        page.feed
          .filter((item) => {
            const post = item.post;
            // Filter out hidden posts
            if (isPostHidden(post.uri)) return false;
            // Filter out posts from muted users
            if (isUserMuted(post.author.did)) return false;
            // Filter out posts from blocked users
            if (isUserBlocked(post.author.did)) return false;
            // Filter out muted threads
            if (isThreadMuted(post.uri)) return false;
            return true;
          })
          .map((item, itemIndex) => ({
            ...item,
            _pageIndex: pageIndex,
            _itemIndex: itemIndex,
          })),
      );
    }, [data, isPostHidden, isUserMuted, isUserBlocked, isThreadMuted]);

    // Use progressive loading instead of full virtualization
    const {
      visibleItems,
      loadMoreRef: progressiveLoadRef,
      hasMore,
    } = useIntersectionLoader(posts, {
      initialLoad: window.innerWidth < 768 ? 25 : 40,
      increment: window.innerWidth < 768 ? 15 : 25,
    });

    // Clean up old pages when we hit the limit for memory management
    // Only trim when user is near the bottom (not scrolled into old content)
    React.useEffect(() => {
      if (data?.pages && data.pages.length > MOBILE_CONFIG.MAX_PAGES) {
        const scrollRatio =
          window.scrollY /
          (document.documentElement.scrollHeight - window.innerHeight || 1);
        // Only trim old pages if user is in the bottom half of content
        // This prevents scroll jumps when reading older posts
        if (scrollRatio > 0.5) {
          queryClient.setQueryData(
            ["timeline", selectedFeed],
            (oldData: FeedQueryData | undefined) => {
              if (!oldData) return oldData;
              return {
                ...oldData,
                pages: oldData.pages.slice(-MOBILE_CONFIG.MAX_PAGES),
                pageParams: oldData.pageParams.slice(-MOBILE_CONFIG.MAX_PAGES),
              };
            },
          );
        }
      }
    }, [data?.pages, queryClient, selectedFeed]);

    // Clean up postRefs for posts that are no longer in the feed
    // This prevents unbounded memory growth as users scroll through feeds
    React.useEffect(() => {
      const currentPostUris = new Set(posts.map((p) => p.post.uri));

      // Clean up postRefs for removed posts
      let hasStaleRefs = false;
      for (const key in postRefs.current) {
        const uri = key.split("-").slice(0, -1).join("-"); // Remove index suffix
        if (!currentPostUris.has(uri)) {
          hasStaleRefs = true;
          break;
        }
      }
      if (hasStaleRefs) {
        const newPostRefs: { [key: string]: HTMLDivElement } = {};
        for (const key in postRefs.current) {
          const uri = key.split("-").slice(0, -1).join("-");
          if (currentPostUris.has(uri)) {
            newPostRefs[key] = postRefs.current[key];
          }
        }
        postRefs.current = newPostRefs;
      }
    }, [posts]);

    // Memoize post rendering to prevent unnecessary re-renders
    const PostItem = React.memo(
      ({ item, index }: { item: any; index: number }) => {
        const post = item.post;
        const isFocused = focusedPostIndex === index;

        return (
          <div
            key={`${post.uri}-${index}`}
            ref={(el) => {
              if (el) postRefs.current[`${post.uri}-${index}`] = el;
            }}
            className={`relative cursor-pointer px-3 py-2.5 transition-colors hover:bg-gray-50 dark:hover:bg-gray-900 ${
              item.reply?.parent || post.record?.reply?.parent
                ? "from-blue-500/3 border-l-4 border-blue-500 bg-gradient-to-r to-transparent"
                : ""
            } ${isFocused ? "bg-blue-500/3 outline outline-2 outline-offset-[-2px] outline-blue-500" : ""}`}
            id={`post-${post.uri.split("/").pop()}`}
            data-post-id={post.uri.split("/").pop()}
            data-post-uri={post.uri}
            tabIndex={isFocused ? 0 : -1}
            aria-selected={isFocused}
            role="article"
            {...getThreadPrefetchHandlers(post.uri)}
            onClick={(e) => {
              // Only handle click if not on interactive elements
              const target = e.target as HTMLElement;
              const clickedOnInteractive =
                target.closest('[role="button"]') ||
                target.closest("button") ||
                target.closest("a") ||
                target.closest("[data-clickable]") ||
                target.tagName === "BUTTON" ||
                target.tagName === "A";

              if (!clickedOnInteractive) {
                // Update focused index on click (not keyboard navigation)
                isKeyboardNavigationRef.current = false;
                setFocusedPostIndex(index);
                // Open thread view when clicking anywhere on the card
                handlePostClick(post);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handlePostClick(post);
              }
            }}
          >
            {item.reason && (
              <div
                className="mb-1.5 flex items-center gap-2 text-xs"
                style={{ color: "var(--asph-text-secondary)" }}
              >
                <Repeat2 size={12} />
                <span>
                  <ProfileHoverCard handle={item.reason.by.handle}>
                    <span
                      className="cursor-pointer hover:underline"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/profile/${item.reason?.by.handle}`);
                      }}
                    >
                      {item.reason?.by.displayName || item.reason?.by.handle}
                    </span>
                  </ProfileHoverCard>{" "}
                  reposted
                </span>
              </div>
            )}

            {/* Show reply context from feed item */}
            {item.reply?.parent && (
              <div className="relative">
                {/* Reply indicator with background */}
                <div className="border-asph-primary/20 from-asph-primary/10 to-asph-primary/5 mb-3 flex items-center gap-2 rounded-lg border bg-gradient-to-br px-3 py-2 backdrop-blur-sm">
                  <div className="flex items-center">
                    <div className="flex w-12 justify-center">
                      <div className="h-6 w-0.5 bg-asph-primary"></div>
                    </div>
                    <Reply size={16} className="mr-2 text-asph-primary" />
                  </div>
                  <div className="flex-1">
                    <span
                      className="text-sm font-medium"
                      style={{ color: "var(--asph-text-primary)" }}
                    >
                      Replying to{" "}
                      <ProfileHoverCard
                        handle={item.reply.parent.author?.handle || "unknown"}
                      >
                        <button
                          className="touch-target-sm font-semibold text-asph-primary hover:underline"
                          onClick={(e) => {
                            e.stopPropagation();
                            // Navigate to parent post
                            const parentPost = item.reply?.parent;
                            if (parentPost) {
                              handlePostClick(parentPost);
                            }
                          }}
                        >
                          @{item.reply?.parent.author?.handle || "unknown"}
                        </button>
                      </ProfileHoverCard>
                    </span>
                    {item.reply.parent.record?.text && (
                      <div
                        className="mt-0.5 line-clamp-2 text-xs"
                        style={{ color: "var(--asph-text-secondary)" }}
                      >
                        "{item.reply.parent.record.text}"
                      </div>
                    )}
                  </div>
                </div>
                {/* Connecting line from reply indicator to avatar */}
                <div className="bg-asph-primary/30 absolute left-6 top-full h-3 w-0.5"></div>
              </div>
            )}

            {/* Show reply context from post record if not in feed item */}
            {!item.reply?.parent && post.record?.reply?.parent && (
              <div className="relative">
                {/* Reply indicator with background */}
                <div className="border-asph-primary/20 from-asph-primary/10 to-asph-primary/5 mb-3 flex items-center gap-2 rounded-lg border bg-gradient-to-br px-3 py-2 backdrop-blur-sm">
                  <div className="flex items-center">
                    <div className="flex w-12 justify-center">
                      <div className="h-6 w-0.5 bg-asph-primary"></div>
                    </div>
                    <Reply size={16} className="mr-2 text-asph-primary" />
                  </div>
                  <span
                    className="text-sm font-medium"
                    style={{ color: "var(--asph-text-primary)" }}
                  >
                    This is a reply
                  </span>
                </div>
                {/* Connecting line from reply indicator to avatar */}
                <div className="bg-asph-primary/30 absolute left-6 top-full h-3 w-0.5"></div>
              </div>
            )}

            <div>
              {/* Avatar and user info row */}
              <div className="flex items-start gap-3">
                <ProfileHoverCard handle={post.author.handle}>
                  <img
                    src={
                      proxifyBskyImage(post.author.avatar) ||
                      "/default-avatar.svg"
                    }
                    alt={post.author.handle}
                    className="h-12 w-12 cursor-pointer rounded-full transition-opacity hover:opacity-80"
                    data-clickable="profile"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/profile/${post.author.handle}`);
                    }}
                  />
                </ProfileHoverCard>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <ProfileHoverCard handle={post.author.handle}>
                      <span
                        className="cursor-pointer font-semibold hover:underline inline-flex items-center min-h-[44px]"
                        style={{ color: "var(--asph-text-primary)" }}
                        data-clickable="profile"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/profile/${post.author.handle}`);
                        }}
                      >
                        {post.author.displayName || post.author.handle}
                      </span>
                    </ProfileHoverCard>
                    {(item.reply?.parent || post.record?.reply?.parent) && (
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{
                          backgroundColor: "var(--asph-primary)",
                          color: "white",
                        }}
                      >
                        REPLY
                      </span>
                    )}
                  </div>
                  <div
                    className="text-sm"
                    style={{ color: "var(--asph-text-secondary)" }}
                  >
                    <ProfileHoverCard handle={post.author.handle}>
                      <span
                        className="cursor-pointer hover:underline"
                        data-clickable="profile"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/profile/${post.author.handle}`);
                        }}
                      >
                        @{post.author.handle}
                      </span>
                    </ProfileHoverCard>{" "}
                    ·{" "}
                    <span
                      className="cursor-pointer hover:underline"
                      data-clickable="thread"
                      onClick={(e) => {
                        e.stopPropagation();
                        const postId = post.uri.split("/").pop();
                        navigate(`/thread/${post.author.handle}/${postId}`);
                      }}
                    >
                      {formatDistanceToNow(new Date(post.record.createdAt), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Post content below, aligned with avatar */}
              <div className="mt-2">
                <div
                  className="whitespace-pre-wrap"
                  style={{ color: "var(--asph-text-primary)" }}
                >
                  <RichText
                    text={post.record.text}
                    facets={
                      post.record.facets as Parameters<
                        typeof RichText
                      >[0]["facets"]
                    }
                  />
                </div>

                <FeedEmbed
                  embed={post.embed}
                  onOpenGallery={openGallery}
                  onOpenQuotedPost={openThreadByUri}
                />

                {/* Post Action Bar */}
                <PostActionBar
                  post={post as unknown as AppBskyFeedDefs.PostView}
                  onReply={() => openThreadToReplyTo(post)}
                  onRepost={() => handleRepost(post)}
                  onQuote={() => openThreadToQuotePost(post)}
                  onLike={() => handleLike(post)}
                  onBookmark={() => handleBookmark(post)}
                  showCounts={true}
                  size="medium"
                />
              </div>
            </div>
          </div>
        );
      },
      // Custom comparison function to prevent re-renders when only index changes
      (prevProps, nextProps) => {
        // Only re-render if the post data actually changes
        return (
          prevProps.item.post.uri === nextProps.item.post.uri &&
          prevProps.item.post.viewer?.like ===
            nextProps.item.post.viewer?.like &&
          prevProps.item.post.viewer?.repost ===
            nextProps.item.post.viewer?.repost &&
          prevProps.item.post.likeCount === nextProps.item.post.likeCount &&
          prevProps.item.post.repostCount === nextProps.item.post.repostCount &&
          prevProps.item.post.replyCount === nextProps.item.post.replyCount &&
          prevProps.index === nextProps.index
        );
      },
    );

    // Intersection observer for infinite scroll with optimistic pre-fetching
    useEffect(() => {
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
            debug.log("Pre-fetching next page of feed");
            fetchNextPage();
          }
        },
        {
          threshold: 0.1,
          // Pre-fetch when user is within 3 viewport heights of the bottom
          rootMargin: "300% 0px 300% 0px",
        },
      );

      const currentRef = loadMoreRef.current;
      if (currentRef) {
        observer.observe(currentRef);
      }

      return () => {
        if (currentRef) {
          observer.unobserve(currentRef);
        }
        observer.disconnect();
      };
    }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

    // Save scroll position on unmount
    useEffect(() => {
      const currentFeed = selectedFeed;
      const scrollPositions = scrollPositionRef.current;
      return () => {
        // Save current scroll position when component unmounts
        if (currentFeed) {
          scrollPositions[currentFeed] = window.scrollY;
        }
      };
    }, [selectedFeed]);

    // Open the lightbox gallery (used by FeedEmbed for image grids)
    const openGallery = React.useCallback(
      (images: GalleryImage[], index: number) => {
        setGalleryImages(images);
        setGalleryIndex(index);
      },
      [],
    );

    // Mutations are handled by useOptimisticPosts hook

    const handleLike = React.useCallback(
      async (post: Post, e?: React.MouseEvent) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        if (!agent) return;

        try {
          if (post.viewer?.like) {
            undoableUnlike(post.uri, post.viewer.like);
          } else {
            await likeMutation.mutateAsync({
              uri: post.uri,
              cid: post.cid,
            });
          }
        } catch (error) {
          debug.error("Failed to like/unlike post:", error);
        }
      },
      [agent, likeMutation, undoableUnlike],
    );

    const handleRepost = React.useCallback(
      async (post: Post, e?: React.MouseEvent) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        if (!agent) return;

        try {
          if (post.viewer?.repost) {
            undoableUnrepost(post.uri, post.viewer.repost);
          } else {
            await repostMutation.mutateAsync({
              uri: post.uri,
              cid: post.cid,
            });
          }
        } catch (error) {
          debug.error("Failed to repost:", error);
        }
      },
      [agent, repostMutation, undoableUnrepost],
    );

    const handleBookmark = React.useCallback(
      async (post: Post, e?: React.MouseEvent) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        if (!agent) return;

        try {
          // Cast to PostView type - add indexedAt field
          const postView = {
            ...post,
            indexedAt: new Date().toISOString(),
          } as unknown as AppBskyFeedDefs.PostView;

          // Use the hook's toggleBookmark which updates the BookmarkStore
          toggleBookmark(postView);
        } catch (error) {
          debug.error("Failed to bookmark post:", error);
        }
      },
      [agent, toggleBookmark],
    );

    // Keyboard navigation
    useEffect(() => {
      const handleKeyPress = (e: KeyboardEvent) => {
        // Only handle if this column is focused (for SkyDeck compatibility)
        if (!isFocused) return;

        // Don't handle shortcuts if user is typing in an input/textarea or modals are open
        if (
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement ||
          document.body.classList.contains("thread-modal-open") ||
          document.body.classList.contains("conversation-modal-open")
        ) {
          return;
        }

        let handled = false;
        const currentIndex = focusedPostIndex;

        switch (e.key) {
          case "ArrowDown":
          case "j": // vim-style down
            e.preventDefault();
            handled = true;
            isKeyboardNavigationRef.current = true;
            if (currentIndex < posts.length - 1) {
              setFocusedPostIndex(currentIndex + 1);
            } else if (currentIndex === -1 && posts.length > 0) {
              // If nothing selected, select first item
              setFocusedPostIndex(0);
            }
            break;

          case "ArrowUp":
          case "k": // vim-style up
            e.preventDefault();
            handled = true;
            isKeyboardNavigationRef.current = true;
            if (currentIndex > 0) {
              setFocusedPostIndex(currentIndex - 1);
            } else if (currentIndex === -1 && posts.length > 0) {
              // If nothing selected, select last item when going up
              setFocusedPostIndex(posts.length - 1);
            }
            break;

          case "Enter":
            e.preventDefault();
            handled = true;
            if (currentIndex >= 0 && currentIndex < posts.length) {
              const feedItem = posts[currentIndex];
              if (
                feedItem?.post &&
                "author" in feedItem.post &&
                "record" in feedItem.post
              ) {
                handlePostClick(feedItem.post as unknown as Post);
              }
            }
            break;

          case "Home":
            e.preventDefault();
            handled = true;
            isKeyboardNavigationRef.current = true;
            if (posts.length > 0) {
              setFocusedPostIndex(0);
            }
            break;

          case "End":
            e.preventDefault();
            handled = true;
            isKeyboardNavigationRef.current = true;
            if (posts.length > 0) {
              setFocusedPostIndex(posts.length - 1);
            }
            break;

          case "PageUp":
            e.preventDefault();
            handled = true;
            isKeyboardNavigationRef.current = true;
            // Jump up by 5 items
            setFocusedPostIndex(Math.max(0, currentIndex - 5));
            break;

          case "PageDown":
            e.preventDefault();
            handled = true;
            isKeyboardNavigationRef.current = true;
            // Jump down by 5 items
            setFocusedPostIndex(Math.min(posts.length - 1, currentIndex + 5));
            break;

          case "Escape":
            // Clear selection
            setFocusedPostIndex(-1);
            handled = true;
            break;

          case " ": // Space for page scroll
            if (!e.shiftKey) {
              e.preventDefault();
              window.scrollBy({
                top: window.innerHeight * 0.8,
                behavior: "smooth",
              });
              handled = true;
            }
            break;
        }

        // Prevent default browser scrolling if we handled the key
        if (handled) {
          e.stopPropagation();
        }
      };

      window.addEventListener("keydown", handleKeyPress);
      return () => window.removeEventListener("keydown", handleKeyPress);
    }, [posts, focusedPostIndex, isFocused, handlePostClick]);

    // Scroll focused post into view only for keyboard navigation
    useEffect(() => {
      if (
        focusedPostIndex >= 0 &&
        focusedPostIndex < posts.length &&
        isKeyboardNavigationRef.current
      ) {
        const post = posts[focusedPostIndex]?.post;
        if (post) {
          const postKey = `${post.uri}-${focusedPostIndex}`;
          const postEl = postRefs.current[postKey];
          if (postEl) {
            postEl.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });
            postEl.focus();
          }
        }
        // Reset the flag after scrolling
        isKeyboardNavigationRef.current = false;
      }
    }, [focusedPostIndex, posts]);

    // Make container focusable for keyboard navigation
    useEffect(() => {
      if (containerRef.current && isFocused) {
        // Focus container when column becomes focused
        // This ensures keyboard events are captured
        containerRef.current.focus();
      }
    }, [isFocused]);

    // Clear focused post when column loses focus
    useEffect(() => {
      if (!isFocused) {
        setFocusedPostIndex(-1);
      }
    }, [isFocused]);

    // Report focused post to keyboard shortcuts context
    useEffect(() => {
      if (focusedPostIndex >= 0 && focusedPostIndex < posts.length) {
        const feedItem = posts[focusedPostIndex];
        if (feedItem?.post) {
          setFocusedPost({
            post: feedItem.post,
            index: focusedPostIndex,
            columnId: columnId || "home",
          });
        }
      } else {
        setFocusedPost(null);
      }
    }, [focusedPostIndex, posts, columnId, setFocusedPost]);

    // Register post actions for keyboard shortcuts (L, R, B, S, C/R)
    useEffect(() => {
      const effectiveColumnId = columnId || "home";
      registerPostActions(effectiveColumnId, {
        onLike: (post) => {
          if (post.viewer?.like) {
            undoableUnlike(post.uri, post.viewer.like);
          } else {
            likeMutation.mutate({ uri: post.uri, cid: post.cid });
          }
        },
        onRepost: (post) => {
          if (post.viewer?.repost) {
            undoableUnrepost(post.uri, post.viewer.repost);
          } else {
            repostMutation.mutate({ uri: post.uri, cid: post.cid });
          }
        },
        onReply: (post) => {
          openThreadToReplyTo(post as unknown as Post);
        },
        onBookmark: (post) => {
          toggleBookmark(post);
        },
        onShare: async (post) => {
          const shareUrl = `https://bsky.app/profile/${post.author.handle}/post/${post.uri.split("/").pop()}`;
          if (navigator.share) {
            try {
              await navigator.share({
                title: "Share post",
                url: shareUrl,
              });
            } catch {
              // User cancelled or share failed, fall back to clipboard
              await navigator.clipboard.writeText(shareUrl);
            }
          } else {
            await navigator.clipboard.writeText(shareUrl);
          }
        },
        onOpen: (post) => {
          handlePostClick(post as unknown as Post);
        },
        onMoreMenu: (post) => {
          // Find the focused post element and click its more menu button
          const postEl = document.querySelector(
            `[data-post-uri="${post.uri}"][aria-selected="true"]`,
          );
          if (postEl) {
            const moreBtn = postEl.querySelector(
              '[aria-label="More options"]',
            ) as HTMLButtonElement | null;
            moreBtn?.click();
          }
        },
        onNavigateNext: () => {
          if (focusedPostIndex < posts.length - 1) {
            isKeyboardNavigationRef.current = true;
            setFocusedPostIndex((prev) => prev + 1);
          } else if (focusedPostIndex === -1 && posts.length > 0) {
            isKeyboardNavigationRef.current = true;
            setFocusedPostIndex(0);
          }
        },
        onNavigatePrev: () => {
          if (focusedPostIndex > 0) {
            isKeyboardNavigationRef.current = true;
            setFocusedPostIndex((prev) => prev - 1);
          } else if (focusedPostIndex === -1 && posts.length > 0) {
            isKeyboardNavigationRef.current = true;
            setFocusedPostIndex(posts.length - 1);
          }
        },
      });

      return () => unregisterPostActions(effectiveColumnId);
    }, [
      columnId,
      registerPostActions,
      unregisterPostActions,
      likeMutation,
      undoableUnlike,
      repostMutation,
      undoableUnrepost,
      toggleBookmark,
      focusedPostIndex,
      posts,
      handlePostClick,
      openThreadToReplyTo,
    ]);

    if (isLoading) {
      return (
        <div className="skeleton-stagger mx-auto max-w-2xl px-3 sm:px-4">
          <FeedSkeleton count={5} />
        </div>
      );
    }

    if (error) {
      return (
        <div className="p-8 text-center">
          <p style={{ color: "var(--asph-text-secondary)" }}>
            Failed to load feed
          </p>
          <p
            className="mt-2 text-sm"
            style={{ color: "var(--asph-text-tertiary)" }}
          >
            {error.message}
          </p>
        </div>
      );
    }

    // Feed change is now handled by parent component

    return (
      <div
        className="home-container relative w-full"
        ref={(el) => {
          if (el) {
            (
              containerRef as React.MutableRefObject<HTMLDivElement | null>
            ).current = el;
          }
        }}
        tabIndex={-1}
        style={{ outline: "none" }}
      >
        <NetworkWeatherLayer>
          <div
            className="mx-auto max-w-2xl px-3 sm:px-4"
            ref={postsContainerRef}
            style={{
              // Performance optimizations for mobile
              contain: "layout style paint",
            }}
          >
            <div
              className="divide-y divide-gray-100 dark:divide-gray-950"
              role="feed"
              aria-label="Posts"
            >
              {visibleItems.map((item, index) => (
                <div
                  key={`${item.post.uri}-page${item._pageIndex}-item${item._itemIndex}`}
                  className="content-enter"
                  style={
                    {
                      animationDelay: `${Math.min(index * 30, 300)}ms`,
                    } as React.CSSProperties
                  }
                >
                  <PostItem item={item} index={index} />
                </div>
              ))}
            </div>

            {isFetchingNextPage && (
              <div>
                <PostSkeleton compact aria-label="Loading more posts" />
                <PostSkeleton compact aria-label="Loading more posts" />
              </div>
            )}

            {/* Progressive loader sentinel */}
            {hasMore && (
              <div ref={progressiveLoadRef}>
                <PostSkeleton compact aria-label="Loading more posts" />
              </div>
            )}

            {/* Infinite scroll sentinel */}
            <div ref={loadMoreRef} className="h-20" />
          </div>
        </NetworkWeatherLayer>

        <Suspense fallback={null}>
          <FeedDiscovery
            isOpen={showFeedDiscovery}
            onClose={() => {
              if (onCloseFeedDiscovery) {
                onCloseFeedDiscovery();
              } else {
                setInternalShowFeedDiscovery(false);
              }
            }}
          />
        </Suspense>

        {galleryImages && (
          <Suspense
            fallback={
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
                <Spinner size="lg" aria-label="Loading gallery" />
              </div>
            }
          >
            <ImageGallery
              images={galleryImages}
              initialIndex={galleryIndex}
              onClose={() => {
                setGalleryImages(null);
                setGalleryIndex(0);
              }}
            />
          </Suspense>
        )}

        {showThread && selectedPost && (
          <Suspense
            fallback={
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                <div className="flex flex-col items-center gap-3 rounded-lg bg-asph-bg-secondary p-6 shadow-asph-lg">
                  <Spinner size="lg" aria-label="Loading thread" />
                  <p className="text-sm text-asph-text-secondary">
                    Loading thread...
                  </p>
                </div>
              </div>
            }
          >
            <ThreadModal
              postUri={selectedPost.uri}
              openToReply={openThreadToReply}
              openToQuote={openThreadToQuote}
              onClose={closeThread}
            />
          </Suspense>
        )}
      </div>
    );
  },
);
