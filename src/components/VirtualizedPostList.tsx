import { AppBskyFeedDefs } from "@atproto/api";
import React, {
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { List, ListImperativeAPI, useDynamicRowHeight } from "react-window";
import { PostCard } from "./PostCard";
import { EmptyState } from "./ui/EmptyState";

/**
 * Memoized PostRow component to prevent re-renders when scrolling
 * Uses stable callback references via refs pattern
 */
interface PostRowProps {
  index: number;
  style: React.CSSProperties;
  item: VirtualizedPostItem;
  isFocused: boolean;
  onQuoteClick?: (uri: string) => void;
  getClickHandler: (index: number) => () => void;
  getLikeHandler: (index: number) => (() => void) | undefined;
  getRepostHandler: (index: number) => (() => void) | undefined;
  getReplyHandler: (index: number) => (() => void) | undefined;
  getQuoteHandler: (index: number) => (() => void) | undefined;
  getBookmarkHandler: (index: number) => (() => void) | undefined;
}

const PostRow = memo(
  ({
    index,
    style,
    item,
    isFocused,
    onQuoteClick,
    getClickHandler,
    getLikeHandler,
    getRepostHandler,
    getReplyHandler,
    getQuoteHandler,
    getBookmarkHandler,
  }: PostRowProps) => {
    // Get stable handlers using the factories
    const onClick = useMemo(
      () => getClickHandler(index),
      [getClickHandler, index],
    );
    const onLike = useMemo(
      () => getLikeHandler(index),
      [getLikeHandler, index],
    );
    const onRepost = useMemo(
      () => getRepostHandler(index),
      [getRepostHandler, index],
    );
    const onReply = useMemo(
      () => getReplyHandler(index),
      [getReplyHandler, index],
    );
    const onQuote = useMemo(
      () => getQuoteHandler(index),
      [getQuoteHandler, index],
    );
    const onBookmark = useMemo(
      () => getBookmarkHandler(index),
      [getBookmarkHandler, index],
    );

    return (
      <div
        id={`post-item-${index}`}
        style={style}
        className={isFocused ? "keyboard-focus-indicator" : undefined}
        aria-selected={isFocused}
        role="article"
      >
        <PostCard
          post={item.post}
          reason={item.reason}
          replyParent={item.replyParent}
          onClick={onClick}
          onLike={onLike}
          onRepost={onRepost}
          onReply={onReply}
          onQuote={onQuote}
          onBookmark={onBookmark}
          onQuoteClick={onQuoteClick}
        />
      </div>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison to prevent unnecessary re-renders
    // Only re-render if actual data changes, not callback references
    return (
      prevProps.index === nextProps.index &&
      prevProps.isFocused === nextProps.isFocused &&
      prevProps.item.post.uri === nextProps.item.post.uri &&
      prevProps.item.post.cid === nextProps.item.post.cid &&
      prevProps.item.post.likeCount === nextProps.item.post.likeCount &&
      prevProps.item.post.repostCount === nextProps.item.post.repostCount &&
      prevProps.item.post.replyCount === nextProps.item.post.replyCount &&
      prevProps.item.post.viewer?.like === nextProps.item.post.viewer?.like &&
      prevProps.item.post.viewer?.repost ===
        nextProps.item.post.viewer?.repost &&
      prevProps.item.reason?.$type === nextProps.item.reason?.$type &&
      prevProps.item.replyParent?.uri === nextProps.item.replyParent?.uri
    );
  },
);

PostRow.displayName = "PostRow";

export interface VirtualizedPostItem {
  post: AppBskyFeedDefs.PostView;
  reason?: AppBskyFeedDefs.FeedViewPost["reason"];
  /** Parent post view from feed data, used to show rich reply context */
  replyParent?: AppBskyFeedDefs.PostView;
  key: string;
}

export interface ScrollAnchor {
  itemKey: string;
  itemIndex: number;
  offsetWithinItem: number;
  scrollTop: number;
}

export interface VirtualizedPostListHandle {
  focusItem: (index: number) => void;
  getFocusedIndex: () => number;
}

interface VirtualizedPostListProps {
  items: VirtualizedPostItem[];
  onPostClick: (post: AppBskyFeedDefs.PostView) => void;
  onLike?: (post: AppBskyFeedDefs.PostView) => void;
  onRepost?: (post: AppBskyFeedDefs.PostView) => void;
  onReply?: (post: AppBskyFeedDefs.PostView) => void;
  onQuote?: (post: AppBskyFeedDefs.PostView) => void;
  onBookmark?: (post: AppBskyFeedDefs.PostView) => void;
  onQuoteClick?: (uri: string) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoading?: boolean;
  isRefreshing?: boolean;
  cacheKey?: string;
  emptyState?: React.ReactNode;
  renderItem?: (
    item: VirtualizedPostItem,
    index: number,
    isFocused: boolean,
  ) => React.ReactNode;
  overscanCount?: number;
  defaultRowHeight?: number;
  newPostsCount?: number;
  onNewPostsClick?: () => void;
  preserveScrollOnRefresh?: boolean;
  /** Enable keyboard navigation (default: true) */
  enableKeyboardNavigation?: boolean;
  /** Callback when focused item changes via keyboard */
  onFocusedItemChange?: (index: number, item: VirtualizedPostItem) => void;
}

/**
 * LRU Cache with a maximum size limit to prevent memory leaks.
 * When the cache exceeds the max size, the least recently used entries are evicted.
 */
class LRUCache<K, V> {
  private cache = new Map<K, V>();
  private maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    if (!this.cache.has(key)) {
      return undefined;
    }
    // Move to end (most recently used)
    const value = this.cache.get(key)!;
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key: K, value: V): void {
    // If key exists, delete it first to update position
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    // Evict oldest entries if at capacity
    while (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }
    this.cache.set(key, value);
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

// Maximum number of scroll positions to cache (prevents memory leaks in long sessions)
const MAX_SCROLL_CACHE_SIZE = 50;

// Store both simple scroll position and anchor-based position for robust restoration
// Using LRU caches to prevent unbounded memory growth
const scrollPositions = new LRUCache<string, number>(MAX_SCROLL_CACHE_SIZE);
const scrollAnchors = new LRUCache<string, ScrollAnchor>(MAX_SCROLL_CACHE_SIZE);

// Export for testing purposes
export const _testExports = {
  scrollPositions,
  scrollAnchors,
  LRUCache,
  MAX_SCROLL_CACHE_SIZE,
};

export const VirtualizedPostList = React.forwardRef<
  VirtualizedPostListHandle,
  VirtualizedPostListProps
>(
  (
    {
      items,
      onPostClick,
      onLike,
      onRepost,
      onReply,
      onQuote,
      onBookmark,
      onQuoteClick,
      onLoadMore,
      hasMore = false,
      isLoading = false,
      isRefreshing = false,
      cacheKey = "default",
      emptyState,
      renderItem,
      overscanCount = 5,
      defaultRowHeight = 200,
      newPostsCount = 0,
      onNewPostsClick,
      preserveScrollOnRefresh = true,
      enableKeyboardNavigation = true,
      onFocusedItemChange,
    },
    ref,
  ) => {
    const listRef = useRef<ListImperativeAPI>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerHeight, setContainerHeight] = useState(600);
    const [shouldRestoreScroll, setShouldRestoreScroll] = useState(false);
    const [visibleRange, setVisibleRange] = useState({
      startIndex: 0,
      stopIndex: 0,
    });
    const previousItemsRef = useRef<VirtualizedPostItem[]>([]);
    const wasRefreshingRef = useRef(false);
    const pendingScrollRestorationRef = useRef<ScrollAnchor | null>(null);

    // Keyboard navigation state
    const [focusedIndex, setFocusedIndex] = useState(-1);
    const isKeyboardNavigatingRef = useRef(false);

    // Keep refs to latest items and callbacks for stable callback factories
    const itemsRef = useRef(items);
    const callbacksRef = useRef({
      onPostClick,
      onLike,
      onRepost,
      onReply,
      onQuote,
      onBookmark,
    });

    // Update refs when values change (doesn't cause re-renders)
    useEffect(() => {
      itemsRef.current = items;
    }, [items]);

    useEffect(() => {
      callbacksRef.current = {
        onPostClick,
        onLike,
        onRepost,
        onReply,
        onQuote,
        onBookmark,
      };
    }, [onPostClick, onLike, onRepost, onReply, onQuote, onBookmark]);

    // Stable callback factories - these don't change reference when items/callbacks change
    const createClickHandler = useCallback(
      (index: number) => () => {
        const item = itemsRef.current[index];
        if (item) {
          callbacksRef.current.onPostClick(item.post);
        }
      },
      [],
    );

    const createLikeHandler = useCallback((index: number) => {
      if (!callbacksRef.current.onLike) return undefined;
      return () => {
        const item = itemsRef.current[index];
        if (item) {
          callbacksRef.current.onLike?.(item.post);
        }
      };
    }, []);

    const createRepostHandler = useCallback((index: number) => {
      if (!callbacksRef.current.onRepost) return undefined;
      return () => {
        const item = itemsRef.current[index];
        if (item) {
          callbacksRef.current.onRepost?.(item.post);
        }
      };
    }, []);

    const createReplyHandler = useCallback((index: number) => {
      if (!callbacksRef.current.onReply) return undefined;
      return () => {
        const item = itemsRef.current[index];
        if (item) {
          callbacksRef.current.onReply?.(item.post);
        }
      };
    }, []);

    const createQuoteHandler = useCallback((index: number) => {
      if (!callbacksRef.current.onQuote) return undefined;
      return () => {
        const item = itemsRef.current[index];
        if (item) {
          callbacksRef.current.onQuote?.(item.post);
        }
      };
    }, []);

    const createBookmarkHandler = useCallback((index: number) => {
      if (!callbacksRef.current.onBookmark) return undefined;
      return () => {
        const item = itemsRef.current[index];
        if (item) {
          callbacksRef.current.onBookmark?.(item.post);
        }
      };
    }, []);

    const dynamicRowHeight = useDynamicRowHeight({
      defaultRowHeight,
      key: cacheKey,
    });

    // Measure container height for virtual list
    useEffect(() => {
      if (!containerRef.current) return;

      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setContainerHeight(entry.contentRect.height);
        }
      });

      resizeObserver.observe(containerRef.current);
      return () => resizeObserver.disconnect();
    }, []);

    // Helper: Get row height for an index
    const getRowHeightForIndex = useCallback(
      (index: number): number => {
        const height = dynamicRowHeight.getRowHeight(index);
        return height ?? defaultRowHeight;
      },
      [dynamicRowHeight, defaultRowHeight],
    );

    // Focus item and scroll it into view
    const focusItem = useCallback(
      (index: number) => {
        if (index < 0 || index >= items.length) return;

        setFocusedIndex(index);

        // Scroll to make the focused item visible
        if (listRef.current) {
          listRef.current.scrollToRow({
            index,
            behavior: "smooth",
            align: "smart",
          });
        }

        // Notify parent of focus change
        if (onFocusedItemChange && items[index]) {
          onFocusedItemChange(index, items[index]);
        }
      },
      [items, onFocusedItemChange],
    );

    // Expose imperative handle
    useImperativeHandle(
      ref,
      () => ({
        focusItem,
        getFocusedIndex: () => focusedIndex,
      }),
      [focusItem, focusedIndex],
    );

    // Keyboard navigation handler
    const handleKeyDown = useCallback(
      (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (!enableKeyboardNavigation || items.length === 0) return;

        const { key } = event;
        let newIndex = focusedIndex;
        let handled = false;

        switch (key) {
          case "ArrowDown":
          case "j": // vim-style navigation
            event.preventDefault();
            newIndex =
              focusedIndex < items.length - 1 ? focusedIndex + 1 : focusedIndex;
            if (focusedIndex === -1) newIndex = 0;
            handled = true;
            break;

          case "ArrowUp":
          case "k": // vim-style navigation
            event.preventDefault();
            newIndex = focusedIndex > 0 ? focusedIndex - 1 : 0;
            handled = true;
            break;

          case "Home":
            event.preventDefault();
            newIndex = 0;
            handled = true;
            break;

          case "End":
            event.preventDefault();
            newIndex = items.length - 1;
            handled = true;
            break;

          case "PageDown":
            event.preventDefault();
            // Move down by approximately one viewport worth of items
            newIndex = Math.min(focusedIndex + 5, items.length - 1);
            if (focusedIndex === -1) newIndex = 0;
            handled = true;
            break;

          case "PageUp":
            event.preventDefault();
            // Move up by approximately one viewport worth of items
            newIndex = Math.max(focusedIndex - 5, 0);
            handled = true;
            break;

          case "Enter":
          case " ": // Space
            if (focusedIndex >= 0 && focusedIndex < items.length) {
              event.preventDefault();
              onPostClick(items[focusedIndex].post);
              handled = true;
            }
            break;

          default:
            break;
        }

        if (handled && newIndex !== focusedIndex && newIndex >= 0) {
          isKeyboardNavigatingRef.current = true;
          focusItem(newIndex);
        }
      },
      [enableKeyboardNavigation, items, focusedIndex, focusItem, onPostClick],
    );

    // Reset focus when items change significantly (e.g., new feed loaded)
    useEffect(() => {
      if (items.length === 0) {
        setFocusedIndex(-1);
      } else if (focusedIndex >= items.length) {
        setFocusedIndex(items.length - 1);
      }
    }, [items.length, focusedIndex]);

    // Handle container focus - start at first item if not already focused
    const handleContainerFocus = useCallback(() => {
      if (focusedIndex === -1 && items.length > 0) {
        setFocusedIndex(0);
      }
    }, [focusedIndex, items.length]);

    // Helper: Get the current scroll anchor based on first visible item
    const getCurrentScrollAnchor = useCallback((): ScrollAnchor | null => {
      if (!listRef.current || items.length === 0) return null;

      const element = listRef.current.element;
      if (!element) return null;

      const scrollTop = element.scrollTop;
      const firstVisibleIndex = visibleRange.startIndex;

      if (firstVisibleIndex >= 0 && firstVisibleIndex < items.length) {
        const item = items[firstVisibleIndex];
        // Calculate offset within the first visible item
        let accumulatedHeight = 0;
        for (let i = 0; i < firstVisibleIndex; i++) {
          accumulatedHeight += getRowHeightForIndex(i);
        }
        const offsetWithinItem = scrollTop - accumulatedHeight;

        return {
          itemKey: item.key,
          itemIndex: firstVisibleIndex,
          offsetWithinItem: Math.max(0, offsetWithinItem),
          scrollTop,
        };
      }

      return null;
    }, [items, visibleRange.startIndex, getRowHeightForIndex]);

    // Helper: Restore scroll position based on anchor
    const restoreScrollFromAnchor = useCallback(
      (anchor: ScrollAnchor) => {
        if (!listRef.current || items.length === 0) return false;

        // Find the item by key in the new items array
        const newIndex = items.findIndex((item) => item.key === anchor.itemKey);

        if (newIndex >= 0) {
          // Calculate the new scroll position
          let newScrollTop = 0;
          for (let i = 0; i < newIndex; i++) {
            newScrollTop += getRowHeightForIndex(i);
          }
          newScrollTop += anchor.offsetWithinItem;

          const element = listRef.current.element;
          if (element) {
            element.scrollTop = newScrollTop;
            return true;
          }
        }

        return false;
      },
      [items, getRowHeightForIndex],
    );

    // Track refresh state and save anchor before refresh starts
    useEffect(() => {
      if (
        isRefreshing &&
        !wasRefreshingRef.current &&
        preserveScrollOnRefresh
      ) {
        // Refresh is starting - save anchor
        const anchor = getCurrentScrollAnchor();
        if (anchor) {
          pendingScrollRestorationRef.current = anchor;
          if (cacheKey) {
            scrollAnchors.set(cacheKey, anchor);
          }
        }
      }
      wasRefreshingRef.current = isRefreshing;
    }, [
      isRefreshing,
      preserveScrollOnRefresh,
      getCurrentScrollAnchor,
      cacheKey,
    ]);

    // Handle items update - restore position after refresh completes
    useEffect(() => {
      // Check if items changed (new reference)
      const itemsChanged = previousItemsRef.current !== items;
      const hadPendingRestoration =
        pendingScrollRestorationRef.current !== null;

      if (itemsChanged && items.length > 0) {
        // Store current items for next comparison
        previousItemsRef.current = items;

        // If we have a pending restoration (refresh just completed)
        if (hadPendingRestoration && !isRefreshing) {
          const anchor = pendingScrollRestorationRef.current!;
          pendingScrollRestorationRef.current = null;

          // Use setTimeout to ensure DOM has updated
          setTimeout(() => {
            restoreScrollFromAnchor(anchor);
          }, 0);
        }
      }
    }, [items, isRefreshing, restoreScrollFromAnchor]);

    // Restore scroll position when component mounts with cached items
    useEffect(() => {
      if (
        shouldRestoreScroll &&
        cacheKey &&
        items.length > 0 &&
        listRef.current
      ) {
        // First try anchor-based restoration
        const anchor = scrollAnchors.get(cacheKey);
        if (anchor) {
          setTimeout(() => {
            if (!restoreScrollFromAnchor(anchor)) {
              // Fallback to pixel-based restoration
              const savedPosition = scrollPositions.get(cacheKey);
              if (savedPosition !== undefined && listRef.current) {
                const element = listRef.current.element;
                if (element) {
                  element.scrollTop = savedPosition;
                }
              }
            }
          }, 0);
        } else if (scrollPositions.has(cacheKey)) {
          // Only pixel-based position available
          const savedPosition = scrollPositions.get(cacheKey)!;
          setTimeout(() => {
            if (listRef.current) {
              const element = listRef.current.element;
              if (element) {
                element.scrollTop = savedPosition;
              }
            }
          }, 0);
        }
        setShouldRestoreScroll(false);
      }
    }, [cacheKey, items.length, shouldRestoreScroll, restoreScrollFromAnchor]);

    // Mark that we should restore scroll on mount
    useEffect(() => {
      if (
        cacheKey &&
        (scrollPositions.has(cacheKey) || scrollAnchors.has(cacheKey))
      ) {
        setShouldRestoreScroll(true);
      }
    }, [cacheKey]);

    // Save scroll position when unmounting
    useEffect(() => {
      return () => {
        if (cacheKey && listRef.current) {
          const element = listRef.current.element;
          if (element) {
            scrollPositions.set(cacheKey, element.scrollTop);
          }
          // Also save anchor
          const anchor = getCurrentScrollAnchor();
          if (anchor) {
            scrollAnchors.set(cacheKey, anchor);
          }
        }
      };
    }, [cacheKey, getCurrentScrollAnchor]);

    // Handle scroll for infinite loading and tracking visible range
    const handleRowsRendered = useCallback(
      (
        visibleRows: { startIndex: number; stopIndex: number },
        _allRows: { startIndex: number; stopIndex: number },
      ) => {
        // Track visible range for scroll anchor calculation
        setVisibleRange(visibleRows);

        if (!hasMore || isLoading || items.length === 0 || !onLoadMore) return;

        // Trigger load at 80% scroll position
        const scrollPercentage = visibleRows.stopIndex / items.length;
        if (scrollPercentage >= 0.8) {
          onLoadMore();
        }
      },
      [hasMore, isLoading, items.length, onLoadMore],
    );

    // Handle clicking the "new posts" indicator to scroll to top
    const handleNewPostsClick = useCallback(() => {
      if (onNewPostsClick) {
        onNewPostsClick();
      }
      // Scroll to top
      if (listRef.current) {
        listRef.current.scrollToRow({
          index: 0,
          behavior: "smooth",
        });
      }
    }, [onNewPostsClick]);

    if (items.length === 0 && !isLoading) {
      return (
        <div ref={containerRef} className="flex-1 overflow-hidden">
          {emptyState || <EmptyState variant="posts" compact />}
        </div>
      );
    }

    // Determine if we should show the new posts indicator
    const showNewPostsIndicator =
      newPostsCount > 0 && visibleRange.startIndex > 0;

    return (
      <div
        ref={containerRef}
        className="relative flex-1 overflow-hidden outline-none"
        tabIndex={enableKeyboardNavigation ? 0 : undefined}
        onKeyDown={handleKeyDown}
        onFocus={handleContainerFocus}
        role="feed"
        aria-label="Post feed"
        aria-activedescendant={
          focusedIndex >= 0 && items[focusedIndex]
            ? `post-item-${focusedIndex}`
            : undefined
        }
      >
        {/* New posts indicator */}
        {showNewPostsIndicator && (
          <button
            onClick={handleNewPostsClick}
            className="absolute left-1/2 top-4 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full px-4 py-2 shadow-lg transition-all duration-200 hover:scale-105"
            style={{
              backgroundColor: "var(--asph-primary)",
              color: "white",
            }}
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 10l7-7m0 0l7 7m-7-7v18"
              />
            </svg>
            <span className="text-sm font-medium">
              {newPostsCount} new {newPostsCount === 1 ? "post" : "posts"}
            </span>
          </button>
        )}

        {/* Refreshing indicator */}
        {isRefreshing && (
          <div className="absolute left-0 right-0 top-0 z-10 flex justify-center p-2">
            <div
              className="h-4 w-4 animate-spin rounded-full border-2 border-t-transparent"
              style={{ borderColor: "var(--asph-primary)" }}
            />
          </div>
        )}

        {items.length > 0 ? (
          <List
            listRef={listRef}
            rowCount={items.length}
            rowHeight={dynamicRowHeight}
            defaultHeight={containerHeight}
            onRowsRendered={handleRowsRendered}
            overscanCount={overscanCount}
            rowComponent={({ index, style }) => {
              const item = items[index];
              const isFocused = index === focusedIndex;

              // If custom renderItem is provided, use it
              if (renderItem) {
                return (
                  <div
                    id={`post-item-${index}`}
                    style={style}
                    className={
                      isFocused ? "keyboard-focus-indicator" : undefined
                    }
                    aria-selected={isFocused}
                    role="article"
                  >
                    {renderItem(item, index, isFocused)}
                  </div>
                );
              }

              // Use memoized PostRow with stable callback factories
              return (
                <PostRow
                  index={index}
                  style={style}
                  item={item}
                  isFocused={isFocused}
                  onQuoteClick={onQuoteClick}
                  getClickHandler={createClickHandler}
                  getLikeHandler={createLikeHandler}
                  getRepostHandler={createRepostHandler}
                  getReplyHandler={createReplyHandler}
                  getQuoteHandler={createQuoteHandler}
                  getBookmarkHandler={createBookmarkHandler}
                />
              );
            }}
            rowProps={{}}
          />
        ) : isLoading ? (
          <div className="flex justify-center p-4">
            <div
              className="h-6 w-6 animate-spin rounded-full border-2 border-t-transparent"
              style={{ borderColor: "var(--asph-primary)" }}
            />
          </div>
        ) : null}
        {items.length > 0 && isLoading && !isRefreshing && (
          <div className="flex justify-center p-4">
            <div
              className="h-6 w-6 animate-spin rounded-full border-2 border-t-transparent"
              style={{ borderColor: "var(--asph-primary)" }}
            />
          </div>
        )}
      </div>
    );
  },
);

VirtualizedPostList.displayName = "VirtualizedPostList";
