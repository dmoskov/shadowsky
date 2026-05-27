import type { AppBskyFeedDefs } from "@atproto/api";
import { debug } from "@bsky/shared";
import { useQueryClient } from "@tanstack/react-query";
import React, { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useBookmarks } from "../../hooks/useBookmarks";
import { useIntersectionLoader } from "../../hooks/useIntersectionLoader";
import {
  useFeedCacheWarmup,
  useVisibilityRefresh,
} from "../../hooks/useOfflineFeed";
import { useOptimisticPosts } from "../../hooks/useOptimisticPosts";
import { usePostDeepLink } from "../../hooks/usePostDeepLink";
import { useRoutePrefetch } from "../../hooks/useRoutePrefetch";
import { columnService } from "../../services/column-service";
import { lazyWithRetry } from "../../utils/lazyWithRetry";
import { NetworkWeatherLayer } from "../NetworkWeatherLayer";
import { Spinner } from "../ui/LoadingState";
import { FeedSkeleton, PostSkeleton } from "../ui/SkeletonLoader";
import { OPEN_THREAD_KEY } from "./constants";
import { PostItem } from "./PostItem";
import type { FeedType, HomeProps, Post } from "./types";
import { useFeedOptions } from "./useFeedOptions";
import { useFeedQuery } from "./useFeedQuery";
import { useHomeKeyboard } from "./useHomeKeyboard";

const FeedDiscovery = lazyWithRetry(() =>
  import("../FeedDiscovery").then((m) => ({ default: m.FeedDiscovery })),
);
const ImageGallery = lazyWithRetry(() =>
  import("../ImageGallery").then((m) => ({ default: m.ImageGallery })),
);
const ThreadModal = lazyWithRetry(() =>
  import("../ThreadModal").then((m) => ({ default: m.ThreadModal })),
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
    const queryClient = useQueryClient();
    const { likeMutation, repostMutation, undoableUnlike, undoableUnrepost } =
      useOptimisticPosts();
    const { toggleBookmark } = useBookmarks();
    const { getThreadPrefetchHandlers } = useRoutePrefetch();

    usePostDeepLink({ enabled: isFocused });

    const [selectedFeed, setSelectedFeed] = React.useState<FeedType>(() => {
      return (initialFeedUri as FeedType) || "following";
    });

    React.useEffect(() => {
      if (initialFeedUri && initialFeedUri !== selectedFeed) {
        setSelectedFeed(initialFeedUri as FeedType);
        if (columnId) {
          columnService.updateColumnFeedPreference(columnId, initialFeedUri);
        }
      }
    }, [initialFeedUri, columnId]);

    const isStandardTimelineFeed =
      selectedFeed === "following" || selectedFeed === "recent";
    useFeedCacheWarmup(
      ["timeline", selectedFeed],
      "timeline",
      isStandardTimelineFeed,
    );

    useVisibilityRefresh(["timeline", selectedFeed], {
      enabled: isFocused,
      minHiddenDuration: 60000,
    });

    const [internalShowFeedDiscovery, setInternalShowFeedDiscovery] =
      useState(false);
    const showFeedDiscovery =
      externalShowFeedDiscovery !== undefined
        ? externalShowFeedDiscovery
        : internalShowFeedDiscovery;

    const [galleryImages, setGalleryImages] = useState<Array<{
      thumb: string;
      fullsize: string;
      alt?: string;
    }> | null>(null);
    const [galleryIndex, setGalleryIndex] = useState(0);

    const [selectedPost, setSelectedPost] = useState<Post | null>(() => {
      try {
        const stored = sessionStorage.getItem(OPEN_THREAD_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.timestamp && Date.now() - parsed.timestamp < 30000) {
            return parsed.post;
          }
          sessionStorage.removeItem(OPEN_THREAD_KEY);
        }
      } catch {
        // Ignore parse errors
      }
      return null;
    });
    const [showThread, setShowThread] = useState(() => {
      try {
        const stored = sessionStorage.getItem(OPEN_THREAD_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.timestamp && Date.now() - parsed.timestamp < 30000) {
            return true;
          }
        }
      } catch {
        // Ignore parse errors
      }
      return false;
    });
    const [openThreadToReply, setOpenThreadToReply] = useState(false);
    const [openThreadToQuote, setOpenThreadToQuote] = useState(false);
    const [focusedPostIndex, setFocusedPostIndex] = useState<number>(-1);

    const postsContainerRef = useRef<HTMLDivElement>(null);
    const loadMoreRef = useRef<HTMLDivElement>(null);
    const scrollPositionRef = useRef<{ [key: string]: number }>({});
    const containerRef = useRef<HTMLDivElement>(null);
    const postRefs = useRef<{ [key: string]: HTMLDivElement }>({});

    // Feed options
    const { feedOptions } = useFeedOptions({ agent });

    const currentFeedOption = feedOptions.find(
      (opt) => opt.type === selectedFeed,
    );

    useEffect(() => {
      if (onFeedChange && currentFeedOption) {
        onFeedChange(selectedFeed, currentFeedOption.label, feedOptions);
      }
    }, [selectedFeed, currentFeedOption, feedOptions, onFeedChange]);

    useEffect(() => {
      if (onRefreshRequest && onRefreshRequest > 0) {
        queryClient.invalidateQueries({ queryKey: ["timeline", selectedFeed] });
      }
    }, [onRefreshRequest, queryClient, selectedFeed]);

    useEffect(() => {
      if (showThread && selectedPost) {
        sessionStorage.setItem(
          OPEN_THREAD_KEY,
          JSON.stringify({
            post: selectedPost,
            timestamp: Date.now(),
          }),
        );
      } else {
        sessionStorage.removeItem(OPEN_THREAD_KEY);
      }
    }, [showThread, selectedPost]);

    // Feed query
    const {
      posts,
      isLoading,
      error,
      fetchNextPage,
      hasNextPage,
      isFetchingNextPage,
    } = useFeedQuery({ agent, selectedFeed });

    const {
      visibleItems,
      loadMoreRef: progressiveLoadRef,
      hasMore,
    } = useIntersectionLoader(posts, {
      initialLoad: window.innerWidth < 768 ? 25 : 40,
      increment: window.innerWidth < 768 ? 15 : 25,
    });

    // Clean up stale post refs
    React.useEffect(() => {
      const currentPostUris = new Set(posts.map((p) => p.post.uri));

      let hasStaleRefs = false;
      for (const key in postRefs.current) {
        const uri = key.split("-").slice(0, -1).join("-");
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

    // Infinite scroll observer
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
        if (currentFeed) {
          scrollPositions[currentFeed] = window.scrollY;
        }
      };
    }, [selectedFeed]);

    // Handler functions
    const handlePostClick = useCallback((post: Post) => {
      setSelectedPost(post);
      setOpenThreadToReply(false);
      setShowThread(true);
    }, []);

    const handleLike = useCallback(
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

    const handleRepost = useCallback(
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

    const handleBookmark = useCallback(
      async (post: Post, e?: React.MouseEvent) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        if (!agent) return;

        try {
          const postView = {
            ...post,
            indexedAt: new Date().toISOString(),
          } as unknown as AppBskyFeedDefs.PostView;

          toggleBookmark(postView);
        } catch (error) {
          debug.error("Failed to bookmark post:", error);
        }
      },
      [agent, toggleBookmark],
    );

    const handleReply = useCallback((post: Post) => {
      setSelectedPost(post);
      setOpenThreadToReply(true);
      setOpenThreadToQuote(false);
      setShowThread(true);
    }, []);

    const handleQuote = useCallback((post: Post) => {
      setSelectedPost(post);
      setOpenThreadToReply(false);
      setOpenThreadToQuote(true);
      setShowThread(true);
    }, []);

    const handleImageGalleryOpen = useCallback(
      (
        images: Array<{ thumb: string; fullsize: string; alt?: string }>,
        index: number,
      ) => {
        setGalleryImages(images);
        setGalleryIndex(index);
      },
      [],
    );

    const handleQuotePostClick = useCallback((post: Post) => {
      setSelectedPost(post);
      setOpenThreadToReply(false);
      setShowThread(true);
    }, []);

    const handlePostRef = useCallback(
      (el: HTMLDivElement | null, key: string) => {
        if (el) postRefs.current[key] = el;
      },
      [],
    );

    // Keyboard navigation
    const { isKeyboardNavigationRef } = useHomeKeyboard({
      posts,
      focusedPostIndex,
      setFocusedPostIndex,
      isFocused,
      columnId,
      handlePostClick,
      handleReply,
      postRefs,
      containerRef,
    });

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
                  <PostItem
                    item={item}
                    index={index}
                    isFocused={focusedPostIndex === index}
                    onPostClick={handlePostClick}
                    onReply={handleReply}
                    onRepost={handleRepost}
                    onQuote={handleQuote}
                    onLike={handleLike}
                    onBookmark={handleBookmark}
                    onFocusChange={setFocusedPostIndex}
                    postRef={handlePostRef}
                    getThreadPrefetchHandlers={getThreadPrefetchHandlers}
                    isKeyboardNavigationRef={isKeyboardNavigationRef}
                    onImageGalleryOpen={handleImageGalleryOpen}
                    onQuotePostClick={handleQuotePostClick}
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

            {hasMore && (
              <div ref={progressiveLoadRef}>
                <PostSkeleton compact aria-label="Loading more posts" />
              </div>
            )}

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
              onClose={() => {
                setShowThread(false);
                setSelectedPost(null);
                setOpenThreadToReply(false);
                setOpenThreadToQuote(false);
              }}
            />
          </Suspense>
        )}
      </div>
    );
  },
);
