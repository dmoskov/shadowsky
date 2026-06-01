/**
 * useThreadTree Hook
 *
 * Builds and manages the thread tree structure from posts and notifications.
 * Calculates complexity metrics and provides navigation helpers.
 */

import type {
  AppBskyFeedDefs,
  AppBskyNotificationListNotifications,
} from "@atproto/api";
import { useMemo } from "react";
import type { ThreadNode } from "../contexts/ThreadContext";
import { calculateComplexityFromPosts } from "../services/thread-complexity-scorer";
import {
  countBranchPoints,
  findMaxThreadDepth,
  flattenThreadTree,
} from "../utils/thread-helpers";

type Post = AppBskyFeedDefs.PostView;

export interface UseThreadTreeOptions {
  posts: Post[];
  notifications?: AppBskyNotificationListNotifications.Notification[];
  rootUri?: string;
}

export interface UseThreadTreeReturn {
  threadTree: ThreadNode[];
  flatNodeList: ThreadNode[];
  maxThreadDepth: number;
  branchCount: number;
  complexityScore: ReturnType<typeof calculateComplexityFromPosts>;
  notificationMap: Map<
    string,
    AppBskyNotificationListNotifications.Notification
  >;
}

/**
 * Hook to build and manage thread tree structure
 *
 * @param options - Configuration options
 * @returns Thread tree data and metrics
 */
export function useThreadTree({
  posts,
  notifications = [],
  rootUri,
}: UseThreadTreeOptions): UseThreadTreeReturn {
  // Create a map of notifications by URI
  const notificationMap = useMemo(() => {
    const map = new Map<
      string,
      AppBskyNotificationListNotifications.Notification
    >();
    notifications.forEach((notification) => {
      if (notification?.uri) {
        map.set(notification.uri, notification);
      }
    });
    return map;
  }, [notifications]);

  // Build thread tree structure
  const threadTree = useMemo(() => {
    const nodeMap = new Map<string, ThreadNode>();
    const rootNodes: ThreadNode[] = [];

    // First, create all nodes
    posts.forEach((post) => {
      const node: ThreadNode = {
        post,
        notification: notificationMap.get(post.uri),
        children: [],
        depth: 0,
      };
      nodeMap.set(post.uri, node);
    });

    // Determine the root URI if not provided
    const actualRootUri =
      rootUri ||
      (() => {
        // Find posts that are not replies to any other post in our set
        const childUris = new Set<string>();
        posts.forEach((post) => {
          const record = post.record as
            | { reply?: { parent?: { uri: string } } }
            | undefined;
          if (record?.reply?.parent?.uri) {
            childUris.add(post.uri);
          }
        });

        // Find posts that aren't children
        const roots = posts.filter((post) => !childUris.has(post.uri));
        return roots[0]?.uri;
      })();

    // Mark root node
    if (actualRootUri && nodeMap.has(actualRootUri)) {
      const rootNode = nodeMap.get(actualRootUri)!;
      rootNode.isRoot = true;
      rootNodes.push(rootNode);
    }

    // Build parent-child relationships
    nodeMap.forEach((childNode) => {
      if (childNode.isRoot) return;

      const post = childNode.post;
      const postRecord = post?.record as
        | { reply?: { parent?: { uri: string } } }
        | undefined;
      const parentUri = postRecord?.reply?.parent?.uri;

      if (parentUri) {
        const parentNode = nodeMap.get(parentUri);

        if (parentNode) {
          parentNode.children.push(childNode);
          childNode.depth = parentNode.depth + 1;
        } else if (actualRootUri && rootNodes.length > 0) {
          // Parent not found, attach to root
          rootNodes[0].children.push(childNode);
          childNode.depth = 1;
        }
      }
    });

    // Sort children by timestamp
    const sortChildren = (node: ThreadNode) => {
      node.children.sort((a, b) => {
        const aTime = a.notification?.indexedAt || a.post?.indexedAt || "";
        const bTime = b.notification?.indexedAt || b.post?.indexedAt || "";
        return new Date(aTime).getTime() - new Date(bTime).getTime();
      });
      node.children.forEach(sortChildren);
    };

    rootNodes.forEach(sortChildren);

    // If no root was found, return all orphan nodes
    if (rootNodes.length === 0) {
      nodeMap.forEach((node) => {
        if (
          !node.children.length &&
          !Array.from(nodeMap.values()).some((n) => n.children.includes(node))
        ) {
          rootNodes.push(node);
        }
      });
    }

    return rootNodes;
  }, [posts, notificationMap, rootUri]);

  // Calculate maximum depth in the thread
  const maxThreadDepth = useMemo(
    () => findMaxThreadDepth(threadTree),
    [threadTree],
  );

  // Count branch points in the thread
  const branchCount = useMemo(
    () => countBranchPoints(threadTree),
    [threadTree],
  );

  // Calculate thread complexity score
  const complexityScore = useMemo(
    () => calculateComplexityFromPosts(posts, maxThreadDepth, branchCount),
    [posts, maxThreadDepth, branchCount],
  );

  // Create flat list of nodes for keyboard navigation
  const flatNodeList = useMemo(
    () => flattenThreadTree(threadTree),
    [threadTree],
  );

  return {
    threadTree,
    flatNodeList,
    maxThreadDepth,
    branchCount,
    complexityScore,
    notificationMap,
  };
}
