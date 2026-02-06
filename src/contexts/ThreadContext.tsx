/**
 * ThreadContext - Unified state management for thread visualization
 *
 * Split into three focused sub-contexts to minimize re-renders:
 * - ThreadDataContext: tree structure, metrics, complexity
 * - ThreadNavigationContext: navigation state and helpers
 * - ThreadCollapseContext: collapse state and adaptive collapse
 *
 * useThread() merges all three for backward compatibility.
 */

import type { AppBskyFeedDefs } from "@atproto/api";
import type { Notification } from "@atproto/api/dist/client/types/app/bsky/notification/listNotifications";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  countDescendants,
  useResponsiveCollapseThresholds,
  type CollapseThresholds,
  type ScreenSize,
} from "../hooks/useResponsiveCollapseThresholds";
import {
  calculateComplexityFromPosts,
  type ThreadComplexityScore,
} from "../services/thread-complexity-scorer";

// ============================================================================
// Types
// ============================================================================

type Post = AppBskyFeedDefs.PostView;

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

export enum ThreadComplexityLevel {
  Simple = "Simple",
  Medium = "Medium",
  Complex = "Complex",
  VeryComplex = "VeryComplex",
}

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

export interface ThreadNavigationState {
  focusedIndex: number;
  highlightUri: string | null;
  scrollPosition: number;
}

// ============================================================================
// Sub-context value types
// ============================================================================

export interface ThreadDataContextValue {
  threadTree: ThreadNode[];
  flatList: ThreadNode[];
  nodeMap: Map<string, ThreadNode>;
  metrics: ThreadMetrics;
  complexityScore: ThreadComplexityScore;
  descendantCountMap: Map<string, number>;
  getNodeByUri: (uri: string) => ThreadNode | undefined;
  getNodeByIndex: (index: number) => ThreadNode | undefined;
  getDescendantCount: (node: ThreadNode) => number;
  getUserPosts: (userDid: string) => ThreadNode[];
}

export interface ThreadNavigationContextValue {
  navigationState: ThreadNavigationState;
  setFocusedIndex: (index: number) => void;
  setHighlightUri: (uri: string | null) => void;
  setScrollPosition: (position: number) => void;
  jumpToRoot: () => void;
  jumpToParent: () => void;
  jumpToNextSibling: () => void;
  jumpToPrevSibling: () => void;
  jumpToNode: (uri: string) => void;
}

export interface ThreadCollapseContextValue {
  collapsedNodes: Set<string>;
  toggleCollapse: (uri: string) => void;
  collapseAll: () => void;
  expandAll: () => void;
  isCollapsed: (uri: string) => boolean;
  collapseThresholds: CollapseThresholds;
  screenSize: ScreenSize;
  getBranchBorderColor: (depth: number) => string;
  getBranchBackgroundColor: (depth: number) => string;
  collapseBranch: (uri: string) => void;
  expandBranch: (uri: string) => void;
}

export interface ThreadContextValue
  extends
    ThreadDataContextValue,
    ThreadNavigationContextValue,
    ThreadCollapseContextValue {}

export interface ThreadProviderProps {
  posts: Post[];
  notifications?: Notification[];
  rootUri?: string;
  initialHighlightUri?: string;
  initialFoldDepth?: number;
  children: React.ReactNode;
}

// ============================================================================
// Contexts
// ============================================================================

const ThreadDataCtx = createContext<ThreadDataContextValue | null>(null);
const ThreadNavigationCtx = createContext<ThreadNavigationContextValue | null>(
  null,
);
const ThreadCollapseCtx = createContext<ThreadCollapseContextValue | null>(
  null,
);

const ThreadContext = createContext<ThreadContextValue | null>(null);

// ============================================================================
// Utility Functions
// ============================================================================

function calculateComplexityLevel(
  totalPosts: number,
  maxDepth: number,
  branchCount: number,
): ThreadComplexityLevel {
  if (totalPosts > 50 || maxDepth > 10 || branchCount > 20) {
    return ThreadComplexityLevel.VeryComplex;
  }
  if (totalPosts > 15 || maxDepth > 5 || branchCount > 10) {
    return ThreadComplexityLevel.Complex;
  }
  if (totalPosts > 5 || maxDepth > 2 || branchCount > 3) {
    return ThreadComplexityLevel.Medium;
  }
  return ThreadComplexityLevel.Simple;
}

function buildThreadTree(
  posts: Post[],
  notifications: Notification[],
  rootUri?: string,
): {
  threadTree: ThreadNode[];
  flatList: ThreadNode[];
  nodeMap: Map<string, ThreadNode>;
  metrics: ThreadMetrics;
  descendantCountMap: Map<string, number>;
} {
  const nodeMap = new Map<string, ThreadNode>();
  const rootNodes: ThreadNode[] = [];

  const notificationMap = new Map<string, Notification>();
  notifications.forEach((notification) => {
    if (notification?.uri) {
      notificationMap.set(notification.uri, notification);
    }
  });

  posts.forEach((post) => {
    const node: ThreadNode = {
      post,
      notification: notificationMap.get(post.uri),
      children: [],
      depth: 0,
    };
    nodeMap.set(post.uri, node);
  });

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

  if (actualRootUri && nodeMap.has(actualRootUri)) {
    const rootNode = nodeMap.get(actualRootUri)!;
    rootNode.isRoot = true;
    rootNodes.push(rootNode);
  }

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
        rootNodes[0].children.push(childNode);
        childNode.depth = 1;
        childNode.parentNode = rootNodes[0];
      }
    }
  });

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

  const descendantCountMap = new Map<string, number>();
  for (let i = flatList.length - 1; i >= 0; i--) {
    const node = flatList[i];
    let count = 0;
    for (const child of node.children) {
      count += 1 + (descendantCountMap.get(child.post.uri) || 0);
    }
    descendantCountMap.set(node.post.uri, count);
  }

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

  return {
    threadTree: rootNodes,
    flatList,
    nodeMap,
    metrics,
    descendantCountMap,
  };
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
  const {
    thresholds: collapseThresholds,
    screenSize,
    shouldAutoCollapse,
    getBranchBorderColor,
    getBranchBackgroundColor,
  } = useResponsiveCollapseThresholds();

  const { threadTree, flatList, nodeMap, metrics, descendantCountMap } =
    useMemo(
      () => buildThreadTree(posts, notifications, rootUri),
      [posts, notifications, rootUri],
    );

  const complexityScore = useMemo(
    () =>
      calculateComplexityFromPosts(
        posts,
        metrics.maxDepth,
        metrics.branchCount,
      ),
    [posts, metrics.maxDepth, metrics.branchCount],
  );

  // ========================================================================
  // Collapse state
  // ========================================================================

  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());

  useEffect(() => {
    const initial = new Set<string>();
    flatList.forEach((node) => {
      if (node.children.length > 0) {
        const branchPostCount = countDescendants(node);
        const shouldCollapseAdaptive = shouldAutoCollapse(
          node.depth,
          branchPostCount,
          true,
        );
        const shouldCollapseLegacy =
          initialFoldDepth > 0 && node.depth >= initialFoldDepth;

        if (shouldCollapseAdaptive || shouldCollapseLegacy) {
          initial.add(node.post.uri);
        }
      }
    });
    setCollapsedNodes(initial);
  }, [flatList, shouldAutoCollapse, initialFoldDepth]);

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

  const collapseBranch = useCallback((uri: string) => {
    setCollapsedNodes((prev) => {
      const next = new Set(prev);
      next.add(uri);
      return next;
    });
  }, []);

  const expandBranch = useCallback((uri: string) => {
    setCollapsedNodes((prev) => {
      const next = new Set(prev);
      next.delete(uri);
      return next;
    });
  }, []);

  // ========================================================================
  // Navigation state
  // ========================================================================

  const [navigationState, setNavigationState] = useState<ThreadNavigationState>(
    {
      focusedIndex: -1,
      highlightUri: initialHighlightUri,
      scrollPosition: 0,
    },
  );

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

  const getDescendantCount = useCallback(
    (node: ThreadNode): number => {
      return descendantCountMap.get(node.post.uri) || 0;
    },
    [descendantCountMap],
  );

  const getUserPosts = useCallback(
    (userDid: string) => {
      return flatList.filter((node) => node.post.author.did === userDid);
    },
    [flatList],
  );

  // ========================================================================
  // Sub-context values (each with own useMemo)
  // ========================================================================

  const dataValue: ThreadDataContextValue = useMemo(
    () => ({
      threadTree,
      flatList,
      nodeMap,
      metrics,
      complexityScore,
      descendantCountMap,
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
      complexityScore,
      descendantCountMap,
      getNodeByUri,
      getNodeByIndex,
      getDescendantCount,
      getUserPosts,
    ],
  );

  const navigationValue: ThreadNavigationContextValue = useMemo(
    () => ({
      navigationState,
      setFocusedIndex,
      setHighlightUri,
      setScrollPosition,
      jumpToRoot,
      jumpToParent,
      jumpToNextSibling,
      jumpToPrevSibling,
      jumpToNode,
    }),
    [
      navigationState,
      setFocusedIndex,
      setHighlightUri,
      setScrollPosition,
      jumpToRoot,
      jumpToParent,
      jumpToNextSibling,
      jumpToPrevSibling,
      jumpToNode,
    ],
  );

  const collapseValue: ThreadCollapseContextValue = useMemo(
    () => ({
      collapsedNodes,
      toggleCollapse,
      collapseAll,
      expandAll,
      isCollapsed,
      collapseThresholds,
      screenSize,
      getBranchBorderColor,
      getBranchBackgroundColor,
      collapseBranch,
      expandBranch,
    }),
    [
      collapsedNodes,
      toggleCollapse,
      collapseAll,
      expandAll,
      isCollapsed,
      collapseThresholds,
      screenSize,
      getBranchBorderColor,
      getBranchBackgroundColor,
      collapseBranch,
      expandBranch,
    ],
  );

  const combinedValue: ThreadContextValue = useMemo(
    () => ({
      ...dataValue,
      ...navigationValue,
      ...collapseValue,
    }),
    [dataValue, navigationValue, collapseValue],
  );

  return (
    <ThreadDataCtx.Provider value={dataValue}>
      <ThreadNavigationCtx.Provider value={navigationValue}>
        <ThreadCollapseCtx.Provider value={collapseValue}>
          <ThreadContext.Provider value={combinedValue}>
            {children}
          </ThreadContext.Provider>
        </ThreadCollapseCtx.Provider>
      </ThreadNavigationCtx.Provider>
    </ThreadDataCtx.Provider>
  );
};

// ============================================================================
// Focused sub-context hooks
// ============================================================================

export function useThreadData(): ThreadDataContextValue {
  const context = useContext(ThreadDataCtx);
  if (!context) {
    throw new Error("useThreadData must be used within a ThreadProvider");
  }
  return context;
}

export function useThreadNav(): ThreadNavigationContextValue {
  const context = useContext(ThreadNavigationCtx);
  if (!context) {
    throw new Error("useThreadNav must be used within a ThreadProvider");
  }
  return context;
}

export function useThreadCollapseState(): ThreadCollapseContextValue {
  const context = useContext(ThreadCollapseCtx);
  if (!context) {
    throw new Error(
      "useThreadCollapseState must be used within a ThreadProvider",
    );
  }
  return context;
}

// ============================================================================
// Backward-compatible combined hook
// ============================================================================

export function useThread(): ThreadContextValue {
  const context = useContext(ThreadContext);
  if (!context) {
    throw new Error("useThread must be used within a ThreadProvider");
  }
  return context;
}

// ============================================================================
// Derived hooks (preserved for backward compatibility)
// ============================================================================

export function useThreadTree() {
  const { threadTree, flatList, nodeMap, getNodeByUri, getNodeByIndex } =
    useThreadData();

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

export function useThreadComplexity() {
  const { metrics, complexityScore } = useThreadData();

  return useMemo(
    () => ({
      ...metrics,
      isSimple: metrics.complexityLevel === ThreadComplexityLevel.Simple,
      isMedium: metrics.complexityLevel === ThreadComplexityLevel.Medium,
      isComplex: metrics.complexityLevel === ThreadComplexityLevel.Complex,
      isVeryComplex:
        metrics.complexityLevel === ThreadComplexityLevel.VeryComplex,
      complexityScore,
      shouldUseSimplifiedRendering: complexityScore.useSimplifiedRendering,
      initialRevealCount: complexityScore.initialRevealCount,
      revealBatchSize: complexityScore.revealBatchSize,
    }),
    [metrics, complexityScore],
  );
}

export function useCollapsedNodes() {
  const collapseCtx = useThreadCollapseState();
  const { getDescendantCount } = useThreadData();

  return useMemo(
    () => ({
      ...collapseCtx,
      getDescendantCount,
    }),
    [collapseCtx, getDescendantCount],
  );
}

export function useThreadNavigation() {
  const navCtx = useThreadNav();
  const { flatList } = useThreadData();

  const { navigationState, setFocusedIndex } = navCtx;

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
      setFocusedIndex: navCtx.setFocusedIndex,
      setHighlightUri: navCtx.setHighlightUri,
      setScrollPosition: navCtx.setScrollPosition,
      navigateUp,
      navigateDown,
      navigateToStart,
      navigateToEnd,
      jumpToRoot: navCtx.jumpToRoot,
      jumpToParent: navCtx.jumpToParent,
      jumpToNextSibling: navCtx.jumpToNextSibling,
      jumpToPrevSibling: navCtx.jumpToPrevSibling,
      jumpToNode: navCtx.jumpToNode,
    }),
    [
      navigationState,
      flatList.length,
      navCtx,
      navigateUp,
      navigateDown,
      navigateToStart,
      navigateToEnd,
    ],
  );
}

export function useThreadUserPosts(userDid: string | undefined) {
  const { getUserPosts } = useThreadData();
  const { navigationState, setFocusedIndex } = useThreadNav();

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
export type { ThreadComplexityScore } from "../services/thread-complexity-scorer";
export type { Post };
