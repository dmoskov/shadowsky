/**
 * ThreadContext - Unified state management for thread visualization
 *
 * This context provides:
 * - Thread tree structure (parent-child relationships, depth tracking)
 * - Complexity metrics (totalPosts, maxDepth, branchCount, uniqueAuthors)
 * - Complexity level enum (Simple/Medium/Complex/VeryComplex)
 * - Collapse state synchronization across views
 * - Navigation state (focused post, scroll position)
 * - Memoized calculations to prevent re-renders
 */

import type { AppBskyFeedDefs } from "@atproto/api";
import type { Notification } from "@atproto/api/dist/client/types/app/bsky/notification/listNotifications";
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

// ============================================================================
// Types
// ============================================================================

type Post = AppBskyFeedDefs.PostView;

/**
 * Represents a node in the thread tree
 */
export interface ThreadNode {
  post: Post;
  notification?: Notification;
  children: ThreadNode[];
  depth: number;
  isRoot?: boolean;
  flatIndex?: number;
  parentNode?: ThreadNode;
  siblingIndex?: number;
  totalSiblings?: number;
}

/**
 * Complexity level enum for thread classification
 */
export enum ThreadComplexityLevel {
  Simple = "Simple", // < 5 posts, depth <= 2
  Medium = "Medium", // 5-15 posts, depth <= 5
  Complex = "Complex", // 15-50 posts OR depth 6-10
  VeryComplex = "VeryComplex", // > 50 posts OR depth > 10
}

/**
 * Thread statistics and metrics
 */
export interface ThreadMetrics {
  totalPosts: number;
  totalReplies: number;
  totalLikes: number;
  totalReposts: number;
  uniqueAuthors: number;
  maxDepth: number;
  branchCount: number;
  complexityLevel: ThreadComplexityLevel;
}

/**
 * Navigation state for tracking focused post
 */
export interface ThreadNavigationState {
  focusedIndex: number;
  highlightUri: string | null;
  scrollPosition: number;
}

/**
 * Thread context value exposed to consumers
 */
export interface ThreadContextValue {
  // Tree structure
  threadTree: ThreadNode[];
  flatList: ThreadNode[];
  nodeMap: Map<string, ThreadNode>;

  // Metrics
  metrics: ThreadMetrics;

  // Collapse state
  collapsedNodes: Set<string>;
  toggleCollapse: (uri: string) => void;
  collapseAll: () => void;
  expandAll: () => void;
  isCollapsed: (uri: string) => boolean;

  // Navigation state
  navigationState: ThreadNavigationState;
  setFocusedIndex: (index: number) => void;
  setHighlightUri: (uri: string | null) => void;
  setScrollPosition: (position: number) => void;

  // Navigation helpers
  jumpToRoot: () => void;
  jumpToParent: () => void;
  jumpToNextSibling: () => void;
  jumpToPrevSibling: () => void;
  jumpToNode: (uri: string) => void;

  // Utility
  getNodeByUri: (uri: string) => ThreadNode | undefined;
  getNodeByIndex: (index: number) => ThreadNode | undefined;
  getDescendantCount: (node: ThreadNode) => number;
  getUserPosts: (userDid: string) => ThreadNode[];
}

/**
 * Props for ThreadProvider
 */
export interface ThreadProviderProps {
  posts: Post[];
  notifications?: Notification[];
  rootUri?: string;
  initialHighlightUri?: string;
  initialFoldDepth?: number;
  children: React.ReactNode;
}

// ============================================================================
// Context
// ============================================================================

const ThreadContext = createContext<ThreadContextValue | null>(null);

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculates complexity level based on metrics
 */
function calculateComplexityLevel(
  totalPosts: number,
  maxDepth: number,
  branchCount: number,
): ThreadComplexityLevel {
  // VeryComplex: > 50 posts OR depth > 10 OR > 20 branches
  if (totalPosts > 50 || maxDepth > 10 || branchCount > 20) {
    return ThreadComplexityLevel.VeryComplex;
  }
  // Complex: 15-50 posts OR depth 6-10 OR 10-20 branches
  if (totalPosts > 15 || maxDepth > 5 || branchCount > 10) {
    return ThreadComplexityLevel.Complex;
  }
  // Medium: 5-15 posts OR depth 3-5 OR 3-10 branches
  if (totalPosts > 5 || maxDepth > 2 || branchCount > 3) {
    return ThreadComplexityLevel.Medium;
  }
  // Simple: < 5 posts, depth <= 2, <= 3 branches
  return ThreadComplexityLevel.Simple;
}

/**
 * Builds thread tree from flat post array
 */
function buildThreadTree(
  posts: Post[],
  notifications: Notification[],
  rootUri?: string,
): {
  threadTree: ThreadNode[];
  flatList: ThreadNode[];
  nodeMap: Map<string, ThreadNode>;
  metrics: ThreadMetrics;
} {
  const nodeMap = new Map<string, ThreadNode>();
  const rootNodes: ThreadNode[] = [];

  // Create notification map for quick lookup
  const notificationMap = new Map<string, Notification>();
  notifications.forEach((notification) => {
    if (notification?.uri) {
      notificationMap.set(notification.uri, notification);
    }
  });

  // Create all nodes
  posts.forEach((post) => {
    const node: ThreadNode = {
      post,
      notification: notificationMap.get(post.uri),
      children: [],
      depth: 0,
    };
    nodeMap.set(post.uri, node);
  });

  // Determine actual root URI
  const actualRootUri =
    rootUri ||
    (() => {
      const childUris = new Set<string>();
      posts.forEach((post) => {
        const record = post.record as {
          reply?: { parent?: { uri: string } };
        };
        if (record?.reply?.parent?.uri) {
          childUris.add(post.uri);
        }
      });
      const roots = posts.filter((post) => !childUris.has(post.uri));
      return roots[0]?.uri;
    })();

  // Mark root and add to roots array
  if (actualRootUri && nodeMap.has(actualRootUri)) {
    const rootNode = nodeMap.get(actualRootUri)!;
    rootNode.isRoot = true;
    rootNodes.push(rootNode);
  }

  // Build parent-child relationships
  nodeMap.forEach((childNode) => {
    if (childNode.isRoot) return;

    const postRecord = childNode.post?.record as {
      reply?: { parent?: { uri: string } };
    };
    const parentUri = postRecord?.reply?.parent?.uri;

    if (parentUri) {
      const parentNode = nodeMap.get(parentUri);
      if (parentNode) {
        parentNode.children.push(childNode);
        childNode.depth = parentNode.depth + 1;
        childNode.parentNode = parentNode;
      } else if (rootNodes.length > 0) {
        // Parent not found, attach to root
        rootNodes[0].children.push(childNode);
        childNode.depth = 1;
        childNode.parentNode = rootNodes[0];
      }
    }
  });

  // Sort children by timestamp and add sibling info
  const sortAndIndexChildren = (node: ThreadNode) => {
    node.children.sort((a, b) => {
      const aTime = a.notification?.indexedAt || a.post?.indexedAt || "";
      const bTime = b.notification?.indexedAt || b.post?.indexedAt || "";
      return new Date(aTime).getTime() - new Date(bTime).getTime();
    });
    node.children.forEach((child, idx) => {
      child.siblingIndex = idx;
      child.totalSiblings = node.children.length;
      sortAndIndexChildren(child);
    });
  };
  rootNodes.forEach(sortAndIndexChildren);

  // Create flat list (depth-first) and calculate metrics
  const flatList: ThreadNode[] = [];
  let index = 0;
  let maxDepth = 0;
  let branchCount = 0;

  const traverse = (node: ThreadNode) => {
    node.flatIndex = index++;
    flatList.push(node);
    maxDepth = Math.max(maxDepth, node.depth);
    if (node.children.length > 1) branchCount++;
    node.children.forEach(traverse);
  };
  rootNodes.forEach(traverse);

  // Handle orphan nodes (if no root found)
  if (rootNodes.length === 0) {
    nodeMap.forEach((node) => {
      const hasParent = Array.from(nodeMap.values()).some((n) =>
        n.children.includes(node),
      );
      if (!hasParent) {
        node.flatIndex = index++;
        flatList.push(node);
        rootNodes.push(node);
      }
    });
  }

  // Calculate aggregate stats
  const uniqueAuthors = new Set(posts.map((p) => p.author.did)).size;
  const totalLikes = posts.reduce((sum, p) => sum + (p.likeCount || 0), 0);
  const totalReposts = posts.reduce((sum, p) => sum + (p.repostCount || 0), 0);
  const totalReplies = posts.reduce((sum, p) => sum + (p.replyCount || 0), 0);
  const complexityLevel = calculateComplexityLevel(
    posts.length,
    maxDepth,
    branchCount,
  );

  const metrics: ThreadMetrics = {
    totalPosts: posts.length,
    totalReplies,
    totalLikes,
    totalReposts,
    uniqueAuthors,
    maxDepth,
    branchCount,
    complexityLevel,
  };

  return { threadTree: rootNodes, flatList, nodeMap, metrics };
}

// ============================================================================
// Provider Component
// ============================================================================

export const ThreadProvider: React.FC<ThreadProviderProps> = ({
  posts,
  notifications = [],
  rootUri,
  initialHighlightUri = null,
  initialFoldDepth = 3,
  children,
}) => {
  // Build thread tree structure (memoized)
  const { threadTree, flatList, nodeMap, metrics } = useMemo(
    () => buildThreadTree(posts, notifications, rootUri),
    [posts, notifications, rootUri],
  );

  // Collapse state - initialize with nodes at or beyond fold depth
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    if (initialFoldDepth > 0) {
      flatList.forEach((node) => {
        if (node.depth >= initialFoldDepth && node.children.length > 0) {
          initial.add(node.post.uri);
        }
      });
    }
    return initial;
  });

  // Navigation state
  const [navigationState, setNavigationState] = useState<ThreadNavigationState>(
    {
      focusedIndex: -1,
      highlightUri: initialHighlightUri,
      scrollPosition: 0,
    },
  );

  // ========================================================================
  // Collapse state handlers
  // ========================================================================

  const toggleCollapse = useCallback((uri: string) => {
    setCollapsedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(uri)) {
        next.delete(uri);
      } else {
        next.add(uri);
      }
      return next;
    });
  }, []);

  const collapseAll = useCallback(() => {
    const all = new Set<string>();
    flatList.forEach((node) => {
      if (node.children.length > 0) {
        all.add(node.post.uri);
      }
    });
    setCollapsedNodes(all);
  }, [flatList]);

  const expandAll = useCallback(() => {
    setCollapsedNodes(new Set());
  }, []);

  const isCollapsed = useCallback(
    (uri: string) => collapsedNodes.has(uri),
    [collapsedNodes],
  );

  // ========================================================================
  // Navigation state handlers
  // ========================================================================

  const setFocusedIndex = useCallback((index: number) => {
    setNavigationState((prev) => ({
      ...prev,
      focusedIndex: index,
    }));
  }, []);

  const setHighlightUri = useCallback((uri: string | null) => {
    setNavigationState((prev) => ({
      ...prev,
      highlightUri: uri,
    }));
  }, []);

  const setScrollPosition = useCallback((position: number) => {
    setNavigationState((prev) => ({
      ...prev,
      scrollPosition: position,
    }));
  }, []);

  // ========================================================================
  // Navigation helpers
  // ========================================================================

  const jumpToRoot = useCallback(() => {
    if (flatList.length > 0) {
      setFocusedIndex(0);
    }
  }, [flatList, setFocusedIndex]);

  const jumpToParent = useCallback(() => {
    const { focusedIndex } = navigationState;
    if (focusedIndex >= 0 && focusedIndex < flatList.length) {
      const currentNode = flatList[focusedIndex];
      if (currentNode?.parentNode?.flatIndex !== undefined) {
        setFocusedIndex(currentNode.parentNode.flatIndex);
      }
    }
  }, [navigationState, flatList, setFocusedIndex]);

  const jumpToNextSibling = useCallback(() => {
    const { focusedIndex } = navigationState;
    if (focusedIndex >= 0 && focusedIndex < flatList.length) {
      const currentNode = flatList[focusedIndex];
      const parent = currentNode?.parentNode;
      if (parent && currentNode.siblingIndex !== undefined) {
        const nextSiblingIdx = currentNode.siblingIndex + 1;
        if (nextSiblingIdx < parent.children.length) {
          const nextSibling = parent.children[nextSiblingIdx];
          if (nextSibling.flatIndex !== undefined) {
            setFocusedIndex(nextSibling.flatIndex);
          }
        }
      }
    }
  }, [navigationState, flatList, setFocusedIndex]);

  const jumpToPrevSibling = useCallback(() => {
    const { focusedIndex } = navigationState;
    if (focusedIndex >= 0 && focusedIndex < flatList.length) {
      const currentNode = flatList[focusedIndex];
      const parent = currentNode?.parentNode;
      if (
        parent &&
        currentNode.siblingIndex !== undefined &&
        currentNode.siblingIndex > 0
      ) {
        const prevSibling = parent.children[currentNode.siblingIndex - 1];
        if (prevSibling.flatIndex !== undefined) {
          setFocusedIndex(prevSibling.flatIndex);
        }
      }
    }
  }, [navigationState, flatList, setFocusedIndex]);

  const jumpToNode = useCallback(
    (uri: string) => {
      const node = nodeMap.get(uri);
      if (node?.flatIndex !== undefined) {
        setFocusedIndex(node.flatIndex);
      }
    },
    [nodeMap, setFocusedIndex],
  );

  // ========================================================================
  // Utility functions
  // ========================================================================

  const getNodeByUri = useCallback(
    (uri: string) => nodeMap.get(uri),
    [nodeMap],
  );

  const getNodeByIndex = useCallback(
    (index: number) => flatList[index],
    [flatList],
  );

  const getDescendantCount = useCallback((node: ThreadNode): number => {
    return node.children.reduce(
      (sum, child) => sum + 1 + getDescendantCount(child),
      0,
    );
  }, []);

  const getUserPosts = useCallback(
    (userDid: string) => {
      return flatList.filter((node) => node.post.author.did === userDid);
    },
    [flatList],
  );

  // ========================================================================
  // Context value
  // ========================================================================

  const contextValue: ThreadContextValue = useMemo(
    () => ({
      // Tree structure
      threadTree,
      flatList,
      nodeMap,

      // Metrics
      metrics,

      // Collapse state
      collapsedNodes,
      toggleCollapse,
      collapseAll,
      expandAll,
      isCollapsed,

      // Navigation state
      navigationState,
      setFocusedIndex,
      setHighlightUri,
      setScrollPosition,

      // Navigation helpers
      jumpToRoot,
      jumpToParent,
      jumpToNextSibling,
      jumpToPrevSibling,
      jumpToNode,

      // Utility
      getNodeByUri,
      getNodeByIndex,
      getDescendantCount,
      getUserPosts,
    }),
    [
      threadTree,
      flatList,
      nodeMap,
      metrics,
      collapsedNodes,
      toggleCollapse,
      collapseAll,
      expandAll,
      isCollapsed,
      navigationState,
      setFocusedIndex,
      setHighlightUri,
      setScrollPosition,
      jumpToRoot,
      jumpToParent,
      jumpToNextSibling,
      jumpToPrevSibling,
      jumpToNode,
      getNodeByUri,
      getNodeByIndex,
      getDescendantCount,
      getUserPosts,
    ],
  );

  return (
    <ThreadContext.Provider value={contextValue}>
      {children}
    </ThreadContext.Provider>
  );
};

// ============================================================================
// Hooks
// ============================================================================

/**
 * Main hook to access thread context
 * @throws Error if used outside ThreadProvider
 */
export function useThread(): ThreadContextValue {
  const context = useContext(ThreadContext);
  if (!context) {
    throw new Error("useThread must be used within a ThreadProvider");
  }
  return context;
}

/**
 * Hook specifically for thread tree structure
 * Returns only tree-related data for components that only need structure
 */
export function useThreadTree() {
  const { threadTree, flatList, nodeMap, getNodeByUri, getNodeByIndex } =
    useThread();

  return useMemo(
    () => ({
      threadTree,
      flatList,
      nodeMap,
      getNodeByUri,
      getNodeByIndex,
    }),
    [threadTree, flatList, nodeMap, getNodeByUri, getNodeByIndex],
  );
}

/**
 * Hook specifically for thread complexity/metrics
 * Returns metrics and complexity level for UI decisions
 */
export function useThreadComplexity() {
  const { metrics } = useThread();

  return useMemo(
    () => ({
      ...metrics,
      isSimple: metrics.complexityLevel === ThreadComplexityLevel.Simple,
      isMedium: metrics.complexityLevel === ThreadComplexityLevel.Medium,
      isComplex: metrics.complexityLevel === ThreadComplexityLevel.Complex,
      isVeryComplex:
        metrics.complexityLevel === ThreadComplexityLevel.VeryComplex,
    }),
    [metrics],
  );
}

/**
 * Hook specifically for collapse state management
 * Returns collapse state and handlers for tree view components
 */
export function useCollapsedNodes() {
  const {
    collapsedNodes,
    toggleCollapse,
    collapseAll,
    expandAll,
    isCollapsed,
    getDescendantCount,
  } = useThread();

  return useMemo(
    () => ({
      collapsedNodes,
      toggleCollapse,
      collapseAll,
      expandAll,
      isCollapsed,
      getDescendantCount,
    }),
    [
      collapsedNodes,
      toggleCollapse,
      collapseAll,
      expandAll,
      isCollapsed,
      getDescendantCount,
    ],
  );
}

/**
 * Hook for navigation state
 * Returns navigation state and handlers for keyboard navigation
 */
export function useThreadNavigation() {
  const {
    navigationState,
    flatList,
    setFocusedIndex,
    setHighlightUri,
    setScrollPosition,
    jumpToRoot,
    jumpToParent,
    jumpToNextSibling,
    jumpToPrevSibling,
    jumpToNode,
  } = useThread();

  const navigateUp = useCallback(() => {
    const newIndex = Math.max(navigationState.focusedIndex - 1, 0);
    if (navigationState.focusedIndex === -1) {
      setFocusedIndex(0);
    } else {
      setFocusedIndex(newIndex);
    }
  }, [navigationState.focusedIndex, setFocusedIndex]);

  const navigateDown = useCallback(() => {
    const newIndex = Math.min(
      navigationState.focusedIndex + 1,
      flatList.length - 1,
    );
    if (navigationState.focusedIndex === -1) {
      setFocusedIndex(0);
    } else {
      setFocusedIndex(newIndex);
    }
  }, [navigationState.focusedIndex, flatList.length, setFocusedIndex]);

  const navigateToStart = useCallback(() => {
    setFocusedIndex(0);
  }, [setFocusedIndex]);

  const navigateToEnd = useCallback(() => {
    setFocusedIndex(flatList.length - 1);
  }, [flatList.length, setFocusedIndex]);

  return useMemo(
    () => ({
      focusedIndex: navigationState.focusedIndex,
      highlightUri: navigationState.highlightUri,
      scrollPosition: navigationState.scrollPosition,
      totalNodes: flatList.length,
      setFocusedIndex,
      setHighlightUri,
      setScrollPosition,
      navigateUp,
      navigateDown,
      navigateToStart,
      navigateToEnd,
      jumpToRoot,
      jumpToParent,
      jumpToNextSibling,
      jumpToPrevSibling,
      jumpToNode,
    }),
    [
      navigationState,
      flatList.length,
      setFocusedIndex,
      setHighlightUri,
      setScrollPosition,
      navigateUp,
      navigateDown,
      navigateToStart,
      navigateToEnd,
      jumpToRoot,
      jumpToParent,
      jumpToNextSibling,
      jumpToPrevSibling,
      jumpToNode,
    ],
  );
}

/**
 * Hook for user participation tracking
 * Returns user's posts within the thread and navigation helpers
 */
export function useThreadUserPosts(userDid: string | undefined) {
  const {
    getUserPosts,
    setFocusedIndex,
    navigationState,
    flatList: _,
  } = useThread();

  const userPosts = useMemo(
    () => (userDid ? getUserPosts(userDid) : []),
    [userDid, getUserPosts],
  );

  const userPostIndices = useMemo(
    () =>
      userPosts
        .map((node) => node.flatIndex)
        .filter((idx): idx is number => idx !== undefined),
    [userPosts],
  );

  const jumpToNextUserPost = useCallback(() => {
    if (userPostIndices.length === 0) return;
    const nextIndex = userPostIndices.find(
      (idx) => idx > navigationState.focusedIndex,
    );
    if (nextIndex !== undefined) {
      setFocusedIndex(nextIndex);
    } else {
      // Wrap to first user post
      setFocusedIndex(userPostIndices[0]);
    }
  }, [userPostIndices, navigationState.focusedIndex, setFocusedIndex]);

  const jumpToPrevUserPost = useCallback(() => {
    if (userPostIndices.length === 0) return;
    const prevIndex = [...userPostIndices]
      .reverse()
      .find((idx) => idx < navigationState.focusedIndex);
    if (prevIndex !== undefined) {
      setFocusedIndex(prevIndex);
    } else {
      // Wrap to last user post
      setFocusedIndex(userPostIndices[userPostIndices.length - 1]);
    }
  }, [userPostIndices, navigationState.focusedIndex, setFocusedIndex]);

  return useMemo(
    () => ({
      userPosts,
      userPostCount: userPosts.length,
      userPostIndices,
      jumpToNextUserPost,
      jumpToPrevUserPost,
      hasUserPosts: userPosts.length > 0,
    }),
    [userPosts, userPostIndices, jumpToNextUserPost, jumpToPrevUserPost],
  );
}

// Re-export types for convenience
export type { Post };
