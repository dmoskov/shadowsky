/**
 * useThreadCollapse Hook
 *
 * Manages collapse/expand state for thread branches with localStorage persistence.
 * Handles animations and provides utilities to check/toggle collapse state.
 */

import { useCallback, useState } from "react";
import {
  getPersistedCollapseState,
  setPersistedCollapseState,
} from "../utils/thread-helpers";

export interface UseThreadCollapseOptions {
  threadId: string;
  animationDuration?: number;
}

export interface UseThreadCollapseReturn {
  collapsedBranches: Set<string>;
  expandedBranches: Set<string>;
  animatingNodes: Set<string>;
  isCollapsed: (nodeUri: string) => boolean;
  isExpanded: (nodeUri: string) => boolean;
  toggleCollapse: (nodeUri: string) => void;
  toggleExpand: (nodeUri: string) => void;
}

/**
 * Hook to manage thread branch collapse/expand state
 *
 * @param options - Configuration options
 * @returns Collapse state and control functions
 */
export function useThreadCollapse({
  threadId,
  animationDuration = 300,
}: UseThreadCollapseOptions): UseThreadCollapseReturn {
  // State for collapsible reply branches - tracks which nodes are COLLAPSED
  // Initialize from localStorage if available
  const [collapsedBranches, setCollapsedBranches] = useState<Set<string>>(
    () => {
      if (threadId) {
        return getPersistedCollapseState(threadId);
      }
      return new Set();
    },
  );

  // Legacy compatibility - expandedBranches for the old "load more" behavior
  const [expandedBranches, setExpandedBranches] = useState<Set<string>>(
    new Set(),
  );

  // Track nodes currently animating (for smooth height transitions)
  const [animatingNodes, setAnimatingNodes] = useState<Set<string>>(new Set());

  /**
   * Check if a branch is collapsed
   */
  const isCollapsed = useCallback(
    (nodeUri: string) => collapsedBranches.has(nodeUri),
    [collapsedBranches],
  );

  /**
   * Check if a branch is expanded (legacy "load more" behavior)
   */
  const isExpanded = useCallback(
    (nodeUri: string) => expandedBranches.has(nodeUri),
    [expandedBranches],
  );

  /**
   * Toggle branch collapse state (for per-node collapse/expand button)
   */
  const toggleCollapse = useCallback(
    (nodeUri: string) => {
      // Start animation
      setAnimatingNodes((prev) => new Set(prev).add(nodeUri));

      setCollapsedBranches((prev) => {
        const next = new Set(prev);
        if (next.has(nodeUri)) {
          next.delete(nodeUri);
        } else {
          next.add(nodeUri);
        }
        // Persist to localStorage
        if (threadId) {
          setPersistedCollapseState(threadId, next);
        }
        return next;
      });

      // End animation after transition completes
      setTimeout(() => {
        setAnimatingNodes((prev) => {
          const next = new Set(prev);
          next.delete(nodeUri);
          return next;
        });
      }, animationDuration);
    },
    [threadId, animationDuration],
  );

  /**
   * Toggle branch expansion (for "load more" behavior at bottom)
   */
  const toggleExpand = useCallback((nodeUri: string) => {
    setExpandedBranches((prev) => {
      const next = new Set(prev);
      if (next.has(nodeUri)) {
        next.delete(nodeUri);
      } else {
        next.add(nodeUri);
      }
      return next;
    });
  }, []);

  return {
    collapsedBranches,
    expandedBranches,
    animatingNodes,
    isCollapsed,
    isExpanded,
    toggleCollapse,
    toggleExpand,
  };
}
