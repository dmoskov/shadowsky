/**
 * useThreadKeyboardNav Hook
 *
 * Manages keyboard navigation for threads including:
 * - Arrow keys / vim-style navigation (j/k)
 * - Jumping to user's own posts (n/p)
 * - Home/End navigation
 * - Enter/Space for actions
 */

import type { AppBskyFeedDefs } from "@atproto/api";
import { useCallback, useEffect, useState } from "react";
import type { VirtualizedThreadListHandle } from "../components/VirtualizedThreadList";
import type { ThreadNode } from "../contexts/ThreadContext";

type Post = AppBskyFeedDefs.PostView;

export interface UseThreadKeyboardNavOptions {
  flatNodeList: ThreadNode[];
  currentUserDid?: string;
  enabled?: boolean;
  onPostClick?: (post: Post, action?: "reply" | "quote") => void;
  virtualListRef?: React.RefObject<VirtualizedThreadListHandle>;
  postRefs?: React.MutableRefObject<Map<number, HTMLDivElement>>;
  controlledFocusedIndex?: number;
  onFocusedIndexChange?: (index: number) => void;
}

export interface UseThreadKeyboardNavReturn {
  focusedIndex: number;
  setFocusedIndex: (index: number) => void;
  userParticipationStats: {
    count: number;
    nodeIndices: number[];
  };
}

/**
 * Hook to manage keyboard navigation in thread viewer
 *
 * @param options - Configuration options
 * @returns Navigation state and controls
 */
export function useThreadKeyboardNav({
  flatNodeList,
  currentUserDid,
  enabled = true,
  onPostClick,
  virtualListRef,
  postRefs,
  controlledFocusedIndex,
  onFocusedIndexChange,
}: UseThreadKeyboardNavOptions): UseThreadKeyboardNavReturn {
  // Use controlled value if provided, otherwise use internal state
  const [internalFocusedIndex, setInternalFocusedIndex] = useState<number>(-1);
  const focusedIndex = controlledFocusedIndex ?? internalFocusedIndex;

  const setFocusedIndex = useCallback(
    (index: number) => {
      setInternalFocusedIndex(index);
      onFocusedIndexChange?.(index);
    },
    [onFocusedIndexChange],
  );

  // Count total user participation in thread
  const userParticipationStats = useCallback(() => {
    if (!currentUserDid) return { count: 0, nodeIndices: [] as number[] };

    const nodeIndices: number[] = [];
    flatNodeList.forEach((node, idx) => {
      if (node.post?.author?.did === currentUserDid) {
        nodeIndices.push(idx);
      }
    });

    return { count: nodeIndices.length, nodeIndices };
  }, [flatNodeList, currentUserDid])();

  // Keyboard navigation handler
  const handleKeyboardNavigation = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      // Check if user is typing in an input
      const activeElement = document.activeElement;
      if (
        activeElement?.tagName === "INPUT" ||
        activeElement?.tagName === "TEXTAREA" ||
        (activeElement as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      const totalNodes = flatNodeList.length;
      if (totalNodes === 0) return;

      let newIndex = focusedIndex;
      let handled = false;

      switch (e.key) {
        case "ArrowDown":
        case "j": // Vim-style navigation
          newIndex = Math.min(focusedIndex + 1, totalNodes - 1);
          if (focusedIndex === -1) newIndex = 0;
          handled = true;
          break;
        case "ArrowUp":
        case "k": // Vim-style navigation
          newIndex = Math.max(focusedIndex - 1, 0);
          if (focusedIndex === -1) newIndex = 0;
          handled = true;
          break;
        case "Home":
          newIndex = 0;
          handled = true;
          break;
        case "End":
          newIndex = totalNodes - 1;
          handled = true;
          break;
        case "n": // Jump to next user post
          if (userParticipationStats.nodeIndices.length > 0) {
            const nextUserIndex = userParticipationStats.nodeIndices.find(
              (idx) => idx > focusedIndex,
            );
            if (nextUserIndex !== undefined) {
              newIndex = nextUserIndex;
              handled = true;
            } else {
              // Wrap to first user post
              newIndex = userParticipationStats.nodeIndices[0];
              handled = true;
            }
          }
          break;
        case "p": // Jump to previous user post
          if (userParticipationStats.nodeIndices.length > 0) {
            const prevUserIndex = [...userParticipationStats.nodeIndices]
              .reverse()
              .find((idx) => idx < focusedIndex);
            if (prevUserIndex !== undefined) {
              newIndex = prevUserIndex;
              handled = true;
            } else {
              // Wrap to last user post
              newIndex =
                userParticipationStats.nodeIndices[
                  userParticipationStats.nodeIndices.length - 1
                ];
              handled = true;
            }
          }
          break;
        case "Enter":
        case " ":
          // Trigger reply on current post
          if (focusedIndex >= 0) {
            const node = flatNodeList[focusedIndex];
            if (node?.post) {
              onPostClick?.(node.post, e.key === " " ? "quote" : "reply");
              handled = true;
            }
          }
          break;
      }

      if (handled) {
        e.preventDefault();
        if (newIndex !== focusedIndex) {
          setFocusedIndex(newIndex);
          // Use virtualized list scrolling if available, otherwise fall back to DOM
          if (virtualListRef?.current) {
            virtualListRef.current.scrollToIndex(newIndex, {
              align: "center",
              behavior: "smooth",
            });
          } else if (postRefs) {
            // Scroll the focused post into view while preserving scroll position
            const postElement = postRefs.current.get(newIndex);
            if (postElement) {
              postElement.scrollIntoView({
                behavior: "smooth",
                block: "center",
              });
            }
          }
        }
      }
    },
    [
      enabled,
      flatNodeList,
      focusedIndex,
      userParticipationStats.nodeIndices,
      onPostClick,
      setFocusedIndex,
      virtualListRef,
      postRefs,
    ],
  );

  // Set up keyboard event listener
  useEffect(() => {
    if (enabled) {
      window.addEventListener("keydown", handleKeyboardNavigation);
      return () => {
        window.removeEventListener("keydown", handleKeyboardNavigation);
      };
    }
  }, [enabled, handleKeyboardNavigation]);

  return {
    focusedIndex,
    setFocusedIndex,
    userParticipationStats,
  };
}
