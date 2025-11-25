import { AppBskyFeedDefs } from "@atproto/api";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { List, ListImperativeAPI, useDynamicRowHeight } from "react-window";
import { PostCard } from "./PostCard";

export interface VirtualizedPostItem {
  post: AppBskyFeedDefs.PostView;
  reason?: AppBskyFeedDefs.FeedViewPost["reason"];
  key: string;
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
  cacheKey?: string;
  emptyState?: React.ReactNode;
  renderItem?: (
    item: VirtualizedPostItem,
    index: number,
  ) => React.ReactNode;
  overscanCount?: number;
  defaultRowHeight?: number;
}

const scrollPositions = new Map<string, number>();

export const VirtualizedPostList: React.FC<VirtualizedPostListProps> = ({
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
  cacheKey = "default",
  emptyState,
  renderItem,
  overscanCount = 5,
  defaultRowHeight = 200,
}) => {
  const listRef = useRef<ListImperativeAPI>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(600);
  const [shouldRestoreScroll, setShouldRestoreScroll] = useState(false);

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

  // Restore scroll position when items are loaded
  useEffect(() => {
    if (
      shouldRestoreScroll &&
      cacheKey &&
      items.length > 0 &&
      scrollPositions.has(cacheKey) &&
      listRef.current
    ) {
      const savedPosition = scrollPositions.get(cacheKey)!;
      setTimeout(() => {
        if (listRef.current) {
          listRef.current.scrollToRow({
            index: 0,
            behavior: "auto",
          });
          const element = listRef.current.element;
          if (element) {
            element.scrollTop = savedPosition;
          }
        }
      }, 0);
      setShouldRestoreScroll(false);
    }
  }, [cacheKey, items.length, shouldRestoreScroll]);

  // Mark that we should restore scroll on mount
  useEffect(() => {
    if (cacheKey && scrollPositions.has(cacheKey)) {
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
      }
    };
  }, [cacheKey]);

  // Handle scroll for infinite loading
  const handleRowsRendered = useCallback(
    (
      visibleRows: { startIndex: number; stopIndex: number },
      _allRows: { startIndex: number; stopIndex: number },
    ) => {
      if (!hasMore || isLoading || items.length === 0 || !onLoadMore) return;

      // Trigger load at 80% scroll position
      const scrollPercentage = visibleRows.stopIndex / items.length;
      if (scrollPercentage >= 0.8) {
        onLoadMore();
      }
    },
    [hasMore, isLoading, items.length, onLoadMore],
  );

  if (items.length === 0 && !isLoading) {
    return (
      <div ref={containerRef} className="flex-1 overflow-hidden">
        {emptyState || (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <p style={{ color: "var(--bsky-text-secondary)" }}>
              No posts to display
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-hidden">
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
            return (
              <div style={style}>
                {renderItem ? (
                  renderItem(item, index)
                ) : (
                  <PostCard
                    post={item.post}
                    reason={item.reason}
                    onClick={() => onPostClick(item.post)}
                    onLike={onLike ? () => onLike(item.post) : undefined}
                    onRepost={onRepost ? () => onRepost(item.post) : undefined}
                    onReply={onReply ? () => onReply(item.post) : undefined}
                    onQuote={onQuote ? () => onQuote(item.post) : undefined}
                    onBookmark={onBookmark ? () => onBookmark(item.post) : undefined}
                    onQuoteClick={onQuoteClick}
                  />
                )}
              </div>
            );
          }}
          rowProps={{}}
        />
      ) : isLoading ? (
        <div className="flex justify-center p-4">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: "var(--bsky-primary)" }} />
        </div>
      ) : null}
      {items.length > 0 && isLoading && (
        <div className="flex justify-center p-4">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: "var(--bsky-primary)" }} />
        </div>
      )}
    </div>
  );
};
