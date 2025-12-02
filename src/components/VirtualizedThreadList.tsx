import { useVirtualizer, type VirtualItem } from "@tanstack/react-virtual";
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { ThreadNode } from "./ThreadViewer";

/**
 * Configuration for virtual scrolling behavior
 */
export interface VirtualScrollConfig {
  /** Enable virtualization (disable for small threads) */
  enabled: boolean;
  /** Minimum number of posts before virtualization kicks in */
  threshold: number;
  /** Estimated height for unmeasured items */
  estimatedItemHeight: number;
  /** Number of items to render outside the visible area */
  overscan: number;
}

export const DEFAULT_VIRTUAL_SCROLL_CONFIG: VirtualScrollConfig = {
  enabled: true,
  threshold: 20, // Only virtualize threads with 20+ posts
  estimatedItemHeight: 180, // Average post height in pixels
  overscan: 5, // Render 5 extra items above/below viewport
};

/**
 * Props for VirtualizedThreadList component
 */
export interface VirtualizedThreadListProps {
  /** Flattened list of thread nodes */
  nodes: ThreadNode[];
  /** Currently focused post index for keyboard navigation */
  focusedIndex: number;
  /** Callback when focused index changes */
  onFocusedIndexChange: (index: number) => void;
  /** Render function for each thread node */
  renderNode: (
    node: ThreadNode,
    index: number,
    virtualItem: VirtualItem,
  ) => React.ReactNode;
  /** Virtual scroll configuration */
  config?: VirtualScrollConfig;
  /** Class name for the container */
  className?: string;
  /** Callback when a node becomes visible */
  onNodeVisible?: (index: number) => void;
}

/**
 * Imperative handle for controlling the virtualized list
 */
export interface VirtualizedThreadListHandle {
  /** Scroll to a specific index */
  scrollToIndex: (index: number, options?: { align?: "start" | "center" | "end"; behavior?: "auto" | "smooth" }) => void;
  /** Get the current scroll offset */
  getScrollOffset: () => number;
  /** Measure a specific item (trigger re-measurement) */
  measureItem: (index: number) => void;
  /** Get the virtualizer instance for advanced control */
  getVirtualizer: () => ReturnType<typeof useVirtualizer<HTMLDivElement, Element>> | null;
}

/**
 * Height estimation based on thread node content
 */
function estimateNodeHeight(node: ThreadNode): number {
  // Base height includes avatar, author info, timestamp, action bar
  let height = 100;

  const post = node.post;
  if (!post) return height;

  const record = post.record as { text?: string };
  const text = record?.text || "";

  // Estimate text height (roughly 20px per line, ~50 chars per line)
  const estimatedLines = Math.ceil(text.length / 50);
  height += Math.min(estimatedLines, 15) * 20;

  // Add height for embeds
  const embed = post.embed as { $type?: string; images?: unknown[] };
  if (embed) {
    if (embed.$type === "app.bsky.embed.images#view") {
      // Images add significant height
      height += 200;
    } else if (embed.$type === "app.bsky.embed.video#view") {
      height += 300;
    } else if (embed.$type === "app.bsky.embed.external#view") {
      height += 120;
    } else if (embed.$type === "app.bsky.embed.record#view") {
      // Quote posts
      height += 80;
    } else if (embed.$type === "app.bsky.embed.recordWithMedia#view") {
      height += 280;
    }
  }

  // Add indentation padding for nested replies
  if (node.depth > 0) {
    height += 16; // Thread connector height
  }

  // Add extra height for posts with many children (branch indicators)
  if (node.children.length > 1) {
    height += 20;
  }

  return height;
}

/**
 * VirtualizedThreadList - Windowed rendering for large thread views
 *
 * Uses @tanstack/react-virtual for efficient rendering of threads with 100+ posts.
 * Maintains keyboard navigation compatibility and scroll position during updates.
 */
export const VirtualizedThreadList = forwardRef<
  VirtualizedThreadListHandle,
  VirtualizedThreadListProps
>(function VirtualizedThreadList(
  {
    nodes,
    focusedIndex,
    onFocusedIndexChange,
    renderNode,
    config = DEFAULT_VIRTUAL_SCROLL_CONFIG,
    className = "",
    onNodeVisible,
  },
  ref,
) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [measuredHeights, setMeasuredHeights] = useState<Map<string, number>>(
    new Map(),
  );

  // Determine if virtualization should be active
  const shouldVirtualize = config.enabled && nodes.length >= config.threshold;

  // Get estimated size for an item (use measured if available)
  const getItemSize = useCallback(
    (index: number): number => {
      const node = nodes[index];
      if (!node) return config.estimatedItemHeight;

      const key = node.post?.uri || `node-${index}`;
      const measured = measuredHeights.get(key);
      if (measured) return measured;

      return estimateNodeHeight(node);
    },
    [nodes, measuredHeights, config.estimatedItemHeight],
  );

  // Initialize virtualizer
  const virtualizer = useVirtualizer({
    count: nodes.length,
    getScrollElement: () => parentRef.current,
    estimateSize: getItemSize,
    overscan: config.overscan,
    // Measure items dynamically as they render
    measureElement: (element) => {
      const height = element.getBoundingClientRect().height;
      return height || config.estimatedItemHeight;
    },
  });

  // Update measured heights when items are measured
  const handleMeasure = useCallback(
    (index: number, height: number) => {
      const node = nodes[index];
      if (!node) return;

      const key = node.post?.uri || `node-${index}`;
      setMeasuredHeights((prev) => {
        if (prev.get(key) === height) return prev;
        const next = new Map(prev);
        next.set(key, height);
        return next;
      });
    },
    [nodes],
  );

  // Expose imperative methods
  useImperativeHandle(
    ref,
    () => ({
      scrollToIndex: (
        index: number,
        options?: { align?: "start" | "center" | "end"; behavior?: "auto" | "smooth" },
      ) => {
        if (shouldVirtualize) {
          virtualizer.scrollToIndex(index, {
            align: options?.align || "center",
            behavior: options?.behavior || "smooth",
          });
        } else {
          // For non-virtualized mode, find the element and scroll to it
          const element = parentRef.current?.querySelector(
            `[data-index="${index}"]`,
          );
          if (element) {
            element.scrollIntoView({
              behavior: options?.behavior || "smooth",
              block: options?.align || "center",
            });
          }
        }
      },
      getScrollOffset: () => {
        return shouldVirtualize
          ? virtualizer.scrollOffset ?? 0
          : parentRef.current?.scrollTop ?? 0;
      },
      measureItem: (index: number) => {
        if (shouldVirtualize) {
          virtualizer.measureElement(
            parentRef.current?.querySelector(`[data-index="${index}"]`) as Element,
          );
        }
      },
      getVirtualizer: () => (shouldVirtualize ? virtualizer : null),
    }),
    [shouldVirtualize, virtualizer],
  );

  // Track visible items for callbacks
  useEffect(() => {
    if (!onNodeVisible || !shouldVirtualize) return;

    const visibleItems = virtualizer.getVirtualItems();
    visibleItems.forEach((item) => {
      onNodeVisible(item.index);
    });
  }, [virtualizer, onNodeVisible, shouldVirtualize]);

  // Scroll focused item into view when it changes
  useEffect(() => {
    if (focusedIndex < 0 || focusedIndex >= nodes.length) return;

    if (shouldVirtualize) {
      // Check if focused item is visible
      const visibleRange = virtualizer.range;
      if (
        visibleRange &&
        (focusedIndex < visibleRange.startIndex ||
          focusedIndex > visibleRange.endIndex)
      ) {
        virtualizer.scrollToIndex(focusedIndex, {
          align: "center",
          behavior: "smooth",
        });
      }
    }
  }, [focusedIndex, nodes.length, shouldVirtualize, virtualizer]);

  // Non-virtualized rendering for small threads
  if (!shouldVirtualize) {
    return (
      <div ref={parentRef} className={`thread-list ${className}`}>
        {nodes.map((node, index) => (
          <div
            key={node.post?.uri || `node-${index}`}
            data-index={index}
            className="thread-item"
          >
            {renderNode(node, index, {
              index,
              start: 0,
              size: 0,
              key: index,
              lane: 0,
            } as VirtualItem)}
          </div>
        ))}
      </div>
    );
  }

  // Virtualized rendering for large threads
  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      className={`thread-list-virtual overflow-y-auto ${className}`}
      style={{
        // Container needs fixed height for virtualization
        height: "100%",
        contain: "strict",
      }}
    >
      {/* Spacer div for total content height */}
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {/* Render only visible items */}
        {virtualItems.map((virtualItem) => {
          const node = nodes[virtualItem.index];
          if (!node) return null;

          return (
            <div
              key={virtualItem.key}
              data-index={virtualItem.index}
              ref={(el) => {
                if (el) {
                  virtualizer.measureElement(el);
                  // Update measured height
                  const height = el.getBoundingClientRect().height;
                  if (height > 0) {
                    handleMeasure(virtualItem.index, height);
                  }
                }
              }}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualItem.start}px)`,
              }}
              className={`thread-item ${virtualItem.index === focusedIndex ? "thread-item-focused" : ""}`}
            >
              {renderNode(node, virtualItem.index, virtualItem)}
            </div>
          );
        })}
      </div>
    </div>
  );
});

/**
 * Hook to manage scroll position preservation during updates
 */
export function useScrollPositionPreservation(
  listRef: React.RefObject<VirtualizedThreadListHandle>,
  nodes: ThreadNode[],
) {
  const [preservedPosition, setPreservedPosition] = useState<{
    nodeUri: string;
    offset: number;
  } | null>(null);

  // Preserve current scroll position before nodes change
  const preservePosition = useCallback(
    (focusedIndex: number) => {
      if (!listRef.current || focusedIndex < 0) return;

      const node = nodes[focusedIndex];
      if (!node?.post?.uri) return;

      const offset = listRef.current.getScrollOffset();
      setPreservedPosition({
        nodeUri: node.post.uri,
        offset,
      });
    },
    [listRef, nodes],
  );

  // Restore scroll position after nodes change
  const restorePosition = useCallback(
    (newNodes: ThreadNode[]) => {
      if (!listRef.current || !preservedPosition) return;

      // Find the same node in the new list
      const newIndex = newNodes.findIndex(
        (n) => n.post?.uri === preservedPosition.nodeUri,
      );

      if (newIndex >= 0) {
        // Scroll to the same node with a slight delay to allow render
        requestAnimationFrame(() => {
          listRef.current?.scrollToIndex(newIndex, {
            align: "center",
            behavior: "auto",
          });
        });
      }

      setPreservedPosition(null);
    },
    [listRef, preservedPosition],
  );

  return {
    preservePosition,
    restorePosition,
    preservedPosition,
  };
}

export default VirtualizedThreadList;
