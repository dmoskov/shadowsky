/**
 * Thread Viewer Utility Functions
 *
 * Pure utility functions for thread state persistence and calculations.
 * Extracted from ThreadViewer component for better testability and reusability.
 */

import type { ThreadNode } from "../contexts/ThreadContext";
import { createLogger } from "./logger";

const logger = createLogger("ThreadHelpers");

// Storage key prefixes
const COLLAPSE_STATE_PREFIX = "thread-collapse-state-";
const SCROLL_POSITION_PREFIX = "thread-scroll-position-";

/**
 * Scroll position data structure for persistence
 */
export interface ScrollPositionData {
  scrollTop: number;
  focusedIndex: number;
  timestamp: number;
}

// ============================================================================
// Collapse State Persistence
// ============================================================================

/**
 * Get persisted collapse state from localStorage
 * @param threadId - Unique identifier for the thread
 * @returns Set of collapsed node URIs
 */
export function getPersistedCollapseState(threadId: string): Set<string> {
  try {
    const stored = localStorage.getItem(`${COLLAPSE_STATE_PREFIX}${threadId}`);
    if (stored) {
      const parsed = JSON.parse(stored);
      return new Set(parsed);
    }
  } catch (e) {
    logger.error("Error reading collapse state from localStorage:", e);
  }
  return new Set();
}

/**
 * Save collapse state to localStorage
 * @param threadId - Unique identifier for the thread
 * @param state - Set of collapsed node URIs
 */
export function setPersistedCollapseState(
  threadId: string,
  state: Set<string>,
): void {
  try {
    localStorage.setItem(
      `${COLLAPSE_STATE_PREFIX}${threadId}`,
      JSON.stringify([...state]),
    );
  } catch (e) {
    logger.error("Error saving collapse state to localStorage:", e);
  }
}

// ============================================================================
// Scroll Position Persistence
// ============================================================================

/**
 * Get persisted scroll position from sessionStorage
 * @param threadId - Unique identifier for the thread
 * @returns Scroll position data if valid, null otherwise
 */
export function getPersistedScrollPosition(
  threadId: string,
): ScrollPositionData | null {
  try {
    const stored = sessionStorage.getItem(
      `${SCROLL_POSITION_PREFIX}${threadId}`,
    );
    if (stored) {
      const parsed = JSON.parse(stored) as ScrollPositionData;
      // Expire positions older than 30 minutes to prevent stale data
      const thirtyMinutes = 30 * 60 * 1000;
      if (Date.now() - parsed.timestamp < thirtyMinutes) {
        return parsed;
      }
      // Clear expired position
      sessionStorage.removeItem(`${SCROLL_POSITION_PREFIX}${threadId}`);
    }
  } catch (e) {
    logger.error("Error reading scroll position from sessionStorage:", e);
  }
  return null;
}

/**
 * Save scroll position to sessionStorage
 * @param threadId - Unique identifier for the thread
 * @param data - Scroll position data to save
 */
export function setPersistedScrollPosition(
  threadId: string,
  data: ScrollPositionData,
): void {
  try {
    sessionStorage.setItem(
      `${SCROLL_POSITION_PREFIX}${threadId}`,
      JSON.stringify(data),
    );
  } catch (e) {
    logger.error("Error saving scroll position to sessionStorage:", e);
  }
}

/**
 * Clear persisted scroll position from sessionStorage
 * @param threadId - Unique identifier for the thread
 */
export function clearPersistedScrollPosition(threadId: string): void {
  try {
    sessionStorage.removeItem(`${SCROLL_POSITION_PREFIX}${threadId}`);
  } catch (e) {
    logger.error("Error clearing scroll position from sessionStorage:", e);
  }
}

// ============================================================================
// Thread Tree Calculations
// ============================================================================

/**
 * Count total descendants of a thread node (recursive)
 * @param node - Thread node to count from
 * @returns Total number of descendant nodes
 */
export function countNodeDescendants(node: ThreadNode): number {
  return node.children.reduce(
    (sum, child) => sum + 1 + countNodeDescendants(child),
    0,
  );
}

/**
 * Find maximum depth in a thread tree
 * @param nodes - Root nodes of the thread tree
 * @returns Maximum depth found
 */
export function findMaxThreadDepth(nodes: ThreadNode[]): number {
  let maxDepth = 0;

  const traverse = (node: ThreadNode) => {
    maxDepth = Math.max(maxDepth, node.depth);
    node.children.forEach(traverse);
  };

  nodes.forEach(traverse);
  return maxDepth;
}

/**
 * Count branch points in a thread tree
 * @param nodes - Root nodes of the thread tree
 * @returns Number of nodes with multiple children
 */
export function countBranchPoints(nodes: ThreadNode[]): number {
  let count = 0;

  const countBranches = (node: ThreadNode) => {
    if (node.children.length > 1) count++;
    node.children.forEach(countBranches);
  };

  nodes.forEach(countBranches);
  return count;
}

/**
 * Create a flat list of nodes for keyboard navigation (depth-first order)
 * @param nodes - Root nodes of the thread tree
 * @returns Flat array of nodes with flatIndex assigned
 */
export function flattenThreadTree(nodes: ThreadNode[]): ThreadNode[] {
  const flat: ThreadNode[] = [];
  let index = 0;

  const traverse = (node: ThreadNode) => {
    node.flatIndex = index++;
    flat.push(node);
    node.children.forEach(traverse);
  };

  nodes.forEach(traverse);
  return flat;
}
