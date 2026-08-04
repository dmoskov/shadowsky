import type { AppBskyFeedDefs } from "@atproto/api";
import { debug } from "@bsky/shared";
import { useQueryClient } from "@tanstack/react-query";
import React, { Suspense, useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useHiddenPosts } from "../contexts/HiddenPostsContext";
import { useKeyboardShortcutsActions } from "../contexts/KeyboardShortcutsContext";
import { useModeration } from "../contexts/ModerationContext";
import { useBookmarks } from "../hooks/useBookmarks";
import { useIntersectionLoader } from "../hooks/useIntersectionLoader";
import { useFeedCacheWarmup } from "../hooks/useOfflineFeed";
import { useOptimisticPosts } from "../hooks/useOptimisticPosts";
import { usePostDeepLink } from "../hooks/usePostDeepLink";
import { useRoutePrefetch } from "../hooks/useRoutePrefetch";
import { useMinDuration } from "../hooks/useTiming";
import { lazyWithRetry } from "../utils/lazyWithRetry";
import { NetworkWeatherLayer } from "./NetworkWeatherLayer";
import { Spinner } from "./ui/LoadingState";

import { FeedSkeleton, PostSkeleton } from "./ui/SkeletonLoader";
import {
  type FeedPageItem,
  type FeedQueryData,
  type HomeProps,
  MOBILE_CONFIG,
  type Post,
} from "./Home.types";
import { type GalleryImage } from "./HomeFeedEmbed";
import { PostItem } from "./HomePostItem";
import { NewPostsPill } from "./NewPostsPill";
import { useFeedFreshness } from "./useFeedFreshness";
import { useHomeFeedQuery } from "./useHomeFeedQuery";
import { useThreadModalState } from "./useThreadModalState";

// Code-split heavy components to improve initial load time
const ImageGallery = lazyWithRetry(() =>
  import("./ImageGallery").then((m) => ({ default: m.ImageGallery })),
);
const ThreadModal = lazyWithRetry(() =>
  import("./ThreadModal").then((m) => ({ default: m.ThreadModal })),
);

export const Home: React.FC<HomeProps> = React.memo(
  ({
    feedUri,
    isFocused = true,
    isVisible = true,
    columnId,
    onRefreshRequest,
  }) => {
    const { agent } = useAuth();
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
    // Which feed this column shows is fixed by the deck (derived from the
    // user's saved feeds), so there is no in-column feed switching.
    const selectedFeed = feedUri;

    // Refresh requested by the column header
    useEffect(() => {
      if (onRefreshRequest && onRefreshRequest > 0) {
        queryClient.invalidateQueries({ queryKey: ["timeline", selectedFeed] });
      }
    }, [onRefreshRequest, queryClient, selectedFeed]);

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

    // New-content detection (peek polling, visibility checks, Jetstream
    // events) lives in useFeedFreshness below — it signals via a "New posts"
    // pill instead of refetching underneath the reader.

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

    // Keyboard shortcuts actions for L/R/B/S/C shortcuts.
    // Uses the stable actions context (not the focused-post state context)
    // so Home does not re-render every time focus moves in another column.
    const { setFocusedPost, registerPostActions, unregisterPostActions } =
      useKeyboardShortcutsActions();

    // Dropdown is now handled by the parent component

    const feedQuery = useHomeFeedQuery(selectedFeed, isVisible);

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

    // Peek for new content and surface a "New posts" pill (official-client
    // pattern) rather than refetching the feed in place.
    const { hasNewPosts, refreshFeed } = useFeedFreshness({
      feed: selectedFeed,
      topPostUri: data?.pages?.[0]?.feed?.[0]?.post?.uri,
      isReady: !isLoadingRaw && !error && !!data,
    });

    // Pill tap: jump back to the top and pull the fresh feed in
    const handleLoadNewPosts = React.useCallback(() => {
      containerRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      void refreshFeed();
    }, [refreshFeed]);

    const posts = React.useMemo(() => {
      if (!data?.pages) return [];
      // Identity-based keys (post URI + repost attribution) keep React from
      // remounting post DOM when positions shift across refetches. Dedupe is
      // required because overlapping pages can repeat the same post.
      const seen = new Set<string>();
      const result: FeedPageItem[] = [];
      for (const page of data.pages) {
        for (const item of page.feed as FeedPageItem[]) {
          const post = item.post;
          // Filter out hidden posts
          if (isPostHidden(post.uri)) continue;
          // Filter out posts from muted users
          if (isUserMuted(post.author.did)) continue;
          // Filter out posts from blocked users
          if (isUserBlocked(post.author.did)) continue;
          // Filter out muted threads
          if (isThreadMuted(post.uri)) continue;
          const feedKey = item.reason?.by?.did
            ? `${post.uri}::rt::${item.reason.by.did}`
            : post.uri;
          if (seen.has(feedKey)) continue;
          seen.add(feedKey);
          result.push({ ...item, _feedKey: feedKey });
        }
      }
      return result;
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

    // Track post DOM nodes for keyboard-navigation scrolling. Stable identity
    // so memoized PostItems don't re-render when Home re-renders.
    const registerPostRef = React.useCallback(
      (key: string, el: HTMLDivElement | null) => {
        if (el) {
          postRefs.current[key] = el;
        } else {
          delete postRefs.current[key];
        }
      },
      [],
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

    // Click on a post card: focus it (mouse, not keyboard) and open its thread
    const handleActivatePost = React.useCallback(
      (post: Post, index: number) => {
        isKeyboardNavigationRef.current = false;
        setFocusedPostIndex(index);
        handlePostClick(post);
      },
      [handlePostClick],
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
            {hasNewPosts && <NewPostsPill onClick={handleLoadNewPosts} />}
            <div
              className="divide-y divide-asph-border-primary"
              role="feed"
              aria-label="Posts"
            >
              {visibleItems.map((item, index) => (
                <div
                  key={item._feedKey}
                  className="content-enter"
                  style={
                    {
                      animationDelay: `${Math.min(index * 30, 300)}ms`,
                    } as React.CSSProperties
                  }
                >
                  <PostItem
                    item={item}
                    index={index}
                    isFocused={focusedPostIndex === index}
                    registerRef={registerPostRef}
                    onActivate={handleActivatePost}
                    onOpenThread={handlePostClick}
                    onOpenGallery={openGallery}
                    onOpenQuotedPost={openThreadByUri}
                    onReply={openThreadToReplyTo}
                    onQuote={openThreadToQuotePost}
                    onRepost={handleRepost}
                    onLike={handleLike}
                    onBookmark={handleBookmark}
                    getThreadPrefetchHandlers={getThreadPrefetchHandlers}
                  />
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
