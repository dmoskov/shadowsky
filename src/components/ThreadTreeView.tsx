import type { AppBskyFeedDefs } from "@atproto/api";
import { formatDistanceToNow } from "date-fns";
import {
  ChevronDown,
  ChevronRight,
  CornerDownRight,
  Eye,
  GitBranch,
  Heart,
  MessageCircle,
  Repeat2,
} from "lucide-react";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../contexts/AuthContext";
import { ThreadProvider } from "../contexts/ThreadContext";
import { proxifyBskyImage } from "../utils/image-proxy";
import { ProfileHoverCard } from "./ui/ProfileHoverCard";
import { RichText } from "./ui/RichText";
export {
  useCollapsedNodes,
  useThread,
  useThreadComplexity,
  useThreadNavigation,
} from "../contexts/ThreadContext";

type Post = AppBskyFeedDefs.PostView;

/**
 * @deprecated Use ThreadNode from ThreadContext instead
 * Kept for backwards compatibility
 */
export interface ThreadNode {
  post: Post;
  children: ThreadNode[];
  depth: number;
  isRoot?: boolean;
  flatIndex?: number;
  parentNode?: ThreadNode;
  siblingIndex?: number;
  totalSiblings?: number;
}

/**
 * @deprecated Use ThreadMetrics from ThreadContext instead
 * Kept for backwards compatibility
 */
export interface ThreadStats {
  totalPosts: number;
  totalReplies: number;
  totalLikes: number;
  totalReposts: number;
  uniqueAuthors: number;
  maxDepth: number;
  branchCount: number;
}

interface ThreadTreeViewProps {
  posts: Post[];
  rootUri?: string;
  highlightUri?: string;
  onPostClick?: (post: Post, action?: "reply" | "quote" | "view") => void;
  currentUserDid?: string;
  enableKeyboardNav?: boolean;
  showEngagementStats?: boolean;
  initialFoldDepth?: number;
  className?: string;
}

export const ThreadTreeView: React.FC<ThreadTreeViewProps> = ({
  posts,
  rootUri,
  highlightUri,
  onPostClick,
  currentUserDid: propCurrentUserDid,
  enableKeyboardNav = true,
  showEngagementStats = true,
  initialFoldDepth = 3,
  className = "",
}) => {
  const navigate = useNavigate();
  const { session } = useAuth();
  const currentUserDid = propCurrentUserDid || session?.did;

  // State for collapsed branches
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());
  // State for focused node (keyboard nav)
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  // State for hover preview
  const [hoveredNodeUri, setHoveredNodeUri] = useState<string | null>(null);
  // Ref for node elements
  const nodeRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Build thread tree structure with enhanced metadata
  const { threadTree, flatList, stats } = useMemo(() => {
    const nodeMap = new Map<string, ThreadNode>();
    const rootNodes: ThreadNode[] = [];

    // Create all nodes
    posts.forEach((post) => {
      const node: ThreadNode = {
        post,
        children: [],
        depth: 0,
      };
      nodeMap.set(post.uri, node);
    });

    // Determine root URI
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

    // Mark root and build relationships
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
          rootNodes[0].children.push(childNode);
          childNode.depth = 1;
          childNode.parentNode = rootNodes[0];
        }
      }
    });

    // Sort children by timestamp and add sibling info
    const sortAndIndexChildren = (node: ThreadNode) => {
      node.children.sort((a, b) => {
        const aTime = a.post?.indexedAt || "";
        const bTime = b.post?.indexedAt || "";
        return new Date(aTime).getTime() - new Date(bTime).getTime();
      });
      node.children.forEach((child, idx) => {
        child.siblingIndex = idx;
        child.totalSiblings = node.children.length;
        sortAndIndexChildren(child);
      });
    };
    rootNodes.forEach(sortAndIndexChildren);

    // Create flat list (depth-first)
    const flat: ThreadNode[] = [];
    let index = 0;
    let maxDepth = 0;
    let branchCount = 0;

    const traverse = (node: ThreadNode) => {
      node.flatIndex = index++;
      flat.push(node);
      maxDepth = Math.max(maxDepth, node.depth);
      if (node.children.length > 1) branchCount++;
      node.children.forEach(traverse);
    };
    rootNodes.forEach(traverse);

    // Calculate stats
    const uniqueAuthors = new Set(posts.map((p) => p.author.did)).size;
    const totalLikes = posts.reduce((sum, p) => sum + (p.likeCount || 0), 0);
    const totalReposts = posts.reduce(
      (sum, p) => sum + (p.repostCount || 0),
      0,
    );
    const totalReplies = posts.reduce((sum, p) => sum + (p.replyCount || 0), 0);

    const stats: ThreadStats = {
      totalPosts: posts.length,
      totalReplies,
      totalLikes,
      totalReposts,
      uniqueAuthors,
      maxDepth,
      branchCount,
    };

    return { threadTree: rootNodes, flatList: flat, stats };
  }, [posts, rootUri]);

  // Auto-fold deep branches on initial render
  useEffect(() => {
    if (initialFoldDepth > 0) {
      const nodesToCollapse = new Set<string>();
      flatList.forEach((node) => {
        if (node.depth >= initialFoldDepth && node.children.length > 0) {
          nodesToCollapse.add(node.post.uri);
        }
      });
      setCollapsedNodes(nodesToCollapse);
    }
  }, [flatList, initialFoldDepth]);

  // Toggle node collapse
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

  // Collapse/expand all
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

  // Navigation helpers
  const jumpToRoot = useCallback(() => {
    if (flatList.length > 0) {
      setFocusedIndex(0);
      nodeRefs.current
        .get(0)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [flatList]);

  const jumpToParent = useCallback(() => {
    if (focusedIndex >= 0) {
      const currentNode = flatList[focusedIndex];
      if (currentNode?.parentNode?.flatIndex !== undefined) {
        setFocusedIndex(currentNode.parentNode.flatIndex);
        nodeRefs.current
          .get(currentNode.parentNode.flatIndex)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [focusedIndex, flatList]);

  const jumpToNextSibling = useCallback(() => {
    if (focusedIndex >= 0) {
      const currentNode = flatList[focusedIndex];
      const parent = currentNode?.parentNode;
      if (parent && currentNode.siblingIndex !== undefined) {
        const nextSiblingIdx = currentNode.siblingIndex + 1;
        if (nextSiblingIdx < parent.children.length) {
          const nextSibling = parent.children[nextSiblingIdx];
          if (nextSibling.flatIndex !== undefined) {
            setFocusedIndex(nextSibling.flatIndex);
            nodeRefs.current
              .get(nextSibling.flatIndex)
              ?.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }
      }
    }
  }, [focusedIndex, flatList]);

  const jumpToPrevSibling = useCallback(() => {
    if (focusedIndex >= 0) {
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
          nodeRefs.current
            .get(prevSibling.flatIndex)
            ?.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
    }
  }, [focusedIndex, flatList]);

  // Keyboard navigation handler
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enableKeyboardNav) return;

      const activeEl = document.activeElement;
      if (
        activeEl?.tagName === "INPUT" ||
        activeEl?.tagName === "TEXTAREA" ||
        (activeEl as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      let handled = false;
      let newIndex = focusedIndex;

      switch (e.key) {
        case "ArrowDown":
        case "j":
          newIndex = Math.min(focusedIndex + 1, flatList.length - 1);
          if (focusedIndex === -1) newIndex = 0;
          handled = true;
          break;
        case "ArrowUp":
        case "k":
          newIndex = Math.max(focusedIndex - 1, 0);
          if (focusedIndex === -1) newIndex = 0;
          handled = true;
          break;
        case "ArrowRight":
        case "l":
          jumpToNextSibling();
          handled = true;
          break;
        case "ArrowLeft":
        case "h":
          jumpToPrevSibling();
          handled = true;
          break;
        case "r":
          jumpToRoot();
          handled = true;
          break;
        case "p":
          jumpToParent();
          handled = true;
          break;
        case "c":
          if (focusedIndex >= 0) {
            const node = flatList[focusedIndex];
            if (node?.children.length > 0) {
              toggleCollapse(node.post.uri);
            }
          }
          handled = true;
          break;
        case "Enter":
          if (focusedIndex >= 0) {
            const node = flatList[focusedIndex];
            if (node?.post) {
              onPostClick?.(node.post, "reply");
            }
          }
          handled = true;
          break;
        case " ":
          if (focusedIndex >= 0) {
            const node = flatList[focusedIndex];
            if (node?.post) {
              onPostClick?.(node.post, "view");
            }
          }
          handled = true;
          break;
        case "Home":
          newIndex = 0;
          handled = true;
          break;
        case "End":
          newIndex = flatList.length - 1;
          handled = true;
          break;
      }

      if (handled) {
        e.preventDefault();
        if (newIndex !== focusedIndex) {
          setFocusedIndex(newIndex);
          nodeRefs.current
            .get(newIndex)
            ?.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
    },
    [
      enableKeyboardNav,
      focusedIndex,
      flatList,
      jumpToRoot,
      jumpToParent,
      jumpToNextSibling,
      jumpToPrevSibling,
      toggleCollapse,
      onPostClick,
    ],
  );

  useEffect(() => {
    if (enableKeyboardNav) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [enableKeyboardNav, handleKeyDown]);

  // Get the CSS custom property name based on thread depth
  // This allows CSS clamp() to handle responsive scaling automatically
  const getIndentCssVar = useCallback((depth: number): string => {
    if (depth <= 3) return "var(--thread-indent-shallow)";
    if (depth <= 7) return "var(--thread-indent-medium)";
    if (depth <= 10) return "var(--thread-indent-deep)";
    return "var(--thread-indent-minimal)";
  }, []);

  // Get the CSS variable name for the current thread depth
  const indentCssVar = useMemo(
    () => getIndentCssVar(stats.maxDepth),
    [stats.maxDepth, getIndentCssVar],
  );

  // Render a single node
  const renderNode = useCallback(
    (node: ThreadNode, isLastChild: boolean = false): JSX.Element | null => {
      const isCollapsed = collapsedNodes.has(node.post.uri);
      const isFocused = node.flatIndex === focusedIndex;
      const isHighlighted = node.post.uri === highlightUri;
      const isHovered = node.post.uri === hoveredNodeUri;
      const isCurrentUser = node.post.author.did === currentUserDid;
      const hasChildren = node.children.length > 0;
      const postRecord = node.post.record as { text?: string };

      // Calculate hidden descendants count
      const countDescendants = (n: ThreadNode): number => {
        return n.children.reduce(
          (sum, child) => sum + 1 + countDescendants(child),
          0,
        );
      };
      const hiddenCount = isCollapsed ? countDescendants(node) : 0;

      return (
        <div key={node.post.uri} className="relative">
          {/* Branch visualization line */}
          {node.depth > 0 && (
            <div
              className="absolute left-0 top-0 h-full"
              style={{
                marginLeft: `calc(${node.depth - 1} * ${indentCssVar} + ${indentCssVar} / 2)`,
                width: "2px",
                backgroundColor: isLastChild
                  ? "transparent"
                  : "var(--bsky-border-primary)",
                height: isLastChild ? "24px" : "100%",
              }}
            />
          )}

          {/* Horizontal connector */}
          {node.depth > 0 && (
            <div
              className="absolute"
              style={{
                left: `calc(${node.depth - 1} * ${indentCssVar} + ${indentCssVar} / 2)`,
                top: "24px",
                width: `calc(${indentCssVar} / 2)`,
                height: "2px",
                backgroundColor: "var(--bsky-border-primary)",
              }}
            />
          )}

          {/* Node content */}
          <div
            ref={(el) => {
              if (node.flatIndex !== undefined && el) {
                nodeRefs.current.set(node.flatIndex, el);
              }
            }}
            className={`relative cursor-pointer rounded-lg p-3 transition-all ${
              isFocused ? "ring-2 ring-blue-400" : ""
            } ${isHighlighted ? "ring-2 ring-orange-400" : ""} ${
              isHovered ? "bg-blue-500 bg-opacity-5" : ""
            } ${isCurrentUser ? "border-l-4 border-l-green-500" : ""}`}
            style={{
              marginLeft: `calc(${node.depth} * ${indentCssVar})`,
              backgroundColor: node.isRoot
                ? "var(--bsky-bg-secondary)"
                : isCurrentUser
                  ? "rgba(34, 197, 94, 0.05)"
                  : "transparent",
              border: node.isRoot
                ? "1px solid var(--bsky-border-primary)"
                : "none",
            }}
            onClick={() => onPostClick?.(node.post, "view")}
            onMouseEnter={() => setHoveredNodeUri(node.post.uri)}
            onMouseLeave={() => setHoveredNodeUri(null)}
            tabIndex={0}
            role="treeitem"
            aria-expanded={hasChildren ? !isCollapsed : undefined}
            aria-level={node.depth + 1}
          >
            {/* Header row with badges */}
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {node.isRoot && (
                <span
                  className="rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{
                    backgroundColor: "var(--bsky-primary)",
                    color: "white",
                  }}
                >
                  Root
                </span>
              )}
              {node.depth > 0 && !node.isRoot && (
                <span
                  className="flex items-center gap-1 text-xs"
                  style={{ color: "var(--bsky-text-tertiary)" }}
                >
                  <CornerDownRight size={12} />
                  Depth {node.depth}
                </span>
              )}
              {(node.totalSiblings ?? 0) > 1 && (
                <span
                  className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs"
                  style={{
                    backgroundColor: "rgba(147, 51, 234, 0.1)",
                    color: "rgb(147, 51, 234)",
                  }}
                >
                  <GitBranch size={10} />
                  {(node.siblingIndex ?? 0) + 1}/{node.totalSiblings}
                </span>
              )}
              {hasChildren && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleCollapse(node.post.uri);
                  }}
                  className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
                  style={{ color: "var(--bsky-text-secondary)" }}
                  aria-label={isCollapsed ? "Expand" : "Collapse"}
                >
                  {isCollapsed ? (
                    <ChevronRight size={12} />
                  ) : (
                    <ChevronDown size={12} />
                  )}
                  {node.children.length}{" "}
                  {node.children.length === 1 ? "reply" : "replies"}
                  {isCollapsed && hiddenCount > 0 && (
                    <span className="ml-1 opacity-60">
                      ({hiddenCount} hidden)
                    </span>
                  )}
                </button>
              )}
            </div>

            {/* Author row */}
            <div className="flex items-center gap-2">
              <ProfileHoverCard handle={node.post.author.handle}>
                <img
                  src={
                    proxifyBskyImage(node.post.author.avatar) ||
                    "/default-avatar.svg"
                  }
                  alt={node.post.author.handle}
                  className="h-8 w-8 cursor-pointer rounded-full object-cover transition-opacity hover:opacity-80"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/profile/${node.post.author.handle}`);
                  }}
                />
              </ProfileHoverCard>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <ProfileHoverCard handle={node.post.author.handle}>
                    <span
                      className="cursor-pointer truncate text-sm font-semibold hover:underline"
                      style={{ color: "var(--bsky-text-primary)" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/profile/${node.post.author.handle}`);
                      }}
                    >
                      {node.post.author.displayName || node.post.author.handle}
                    </span>
                  </ProfileHoverCard>
                  <span
                    className="text-xs"
                    style={{ color: "var(--bsky-text-tertiary)" }}
                  >
                    @{node.post.author.handle}
                  </span>
                  <span
                    className="text-xs"
                    style={{ color: "var(--bsky-text-tertiary)" }}
                  >
                    &middot;
                  </span>
                  <time
                    className="text-xs"
                    style={{ color: "var(--bsky-text-tertiary)" }}
                    dateTime={node.post.indexedAt}
                  >
                    {formatDistanceToNow(new Date(node.post.indexedAt), {
                      addSuffix: true,
                    })}
                  </time>
                </div>
              </div>
            </div>

            {/* Post content */}
            <div
              className="mt-2 text-sm"
              style={{ color: "var(--bsky-text-primary)", lineHeight: 1.5 }}
            >
              <RichText
                text={postRecord?.text || "[No text]"}
                facets={
                  (
                    node.post.record as {
                      facets?: {
                        index: { byteStart: number; byteEnd: number };
                        features: Array<{
                          $type: string;
                          did?: string;
                          uri?: string;
                          tag?: string;
                        }>;
                      }[];
                    }
                  )?.facets
                }
              />
            </div>

            {/* Engagement stats row */}
            {showEngagementStats && (
              <div
                className="mt-3 flex items-center gap-4 text-xs"
                style={{ color: "var(--bsky-text-tertiary)" }}
              >
                <span className="flex items-center gap-1">
                  <MessageCircle size={12} />
                  {node.post.replyCount || 0}
                </span>
                <span className="flex items-center gap-1">
                  <Repeat2 size={12} />
                  {node.post.repostCount || 0}
                </span>
                <span className="flex items-center gap-1">
                  <Heart size={12} />
                  {node.post.likeCount || 0}
                </span>
                {node.post.viewer?.like && (
                  <span className="flex items-center gap-1 text-red-500">
                    <Heart size={12} fill="currentColor" />
                    Liked
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Render children if not collapsed */}
          {!isCollapsed &&
            node.children.map((child, idx) =>
              renderNode(child, idx === node.children.length - 1),
            )}
        </div>
      );
    },
    [
      collapsedNodes,
      focusedIndex,
      highlightUri,
      hoveredNodeUri,
      currentUserDid,
      indentCssVar,
      showEngagementStats,
      navigate,
      onPostClick,
      toggleCollapse,
    ],
  );

  return (
    <div
      className={`thread-tree-view ${className}`}
      role="tree"
      aria-label="Thread conversation"
    >
      {/* Thread stats header */}
      <div
        className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg px-4 py-3"
        style={{
          backgroundColor: "var(--bsky-bg-tertiary)",
          border: "1px solid var(--bsky-border-primary)",
        }}
      >
        <div className="flex flex-wrap items-center gap-3">
          <span
            className="flex items-center gap-1.5 text-sm font-medium"
            style={{ color: "var(--bsky-text-primary)" }}
          >
            <MessageCircle size={16} />
            {stats.totalPosts} posts
          </span>
          <span
            className="text-sm"
            style={{ color: "var(--bsky-text-secondary)" }}
          >
            {stats.uniqueAuthors} participant
            {stats.uniqueAuthors !== 1 ? "s" : ""}
          </span>
          {stats.branchCount > 0 && (
            <span
              className="flex items-center gap-1 text-sm"
              style={{ color: "var(--bsky-text-secondary)" }}
            >
              <GitBranch size={14} />
              {stats.branchCount} branch{stats.branchCount !== 1 ? "es" : ""}
            </span>
          )}
          <span
            className="text-sm"
            style={{ color: "var(--bsky-text-tertiary)" }}
          >
            Depth: {stats.maxDepth}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={expandAll}
            className="rounded px-2 py-1 text-xs transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
            style={{ color: "var(--bsky-text-secondary)" }}
          >
            Expand all
          </button>
          <button
            onClick={collapseAll}
            className="rounded px-2 py-1 text-xs transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
            style={{ color: "var(--bsky-text-secondary)" }}
          >
            Collapse all
          </button>
        </div>
      </div>

      {/* Keyboard shortcuts hint */}
      {enableKeyboardNav && (
        <div
          className="mb-4 flex flex-wrap items-center gap-3 rounded-lg px-3 py-2 text-xs"
          style={{
            backgroundColor: "var(--bsky-bg-secondary)",
            color: "var(--bsky-text-tertiary)",
            border: "1px solid var(--bsky-border-primary)",
          }}
        >
          <span className="flex items-center gap-1">
            <kbd className="rounded bg-gray-200 px-1.5 py-0.5 font-mono dark:bg-gray-700">
              j/k
            </kbd>
            Navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded bg-gray-200 px-1.5 py-0.5 font-mono dark:bg-gray-700">
              h/l
            </kbd>
            Siblings
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded bg-gray-200 px-1.5 py-0.5 font-mono dark:bg-gray-700">
              r
            </kbd>
            Root
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded bg-gray-200 px-1.5 py-0.5 font-mono dark:bg-gray-700">
              p
            </kbd>
            Parent
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded bg-gray-200 px-1.5 py-0.5 font-mono dark:bg-gray-700">
              c
            </kbd>
            Collapse
          </span>
        </div>
      )}

      {/* Thread engagement summary */}
      {showEngagementStats && (
        <div
          className="mb-4 flex items-center justify-around rounded-lg px-4 py-3"
          style={{
            backgroundColor: "var(--bsky-bg-secondary)",
            border: "1px solid var(--bsky-border-primary)",
          }}
        >
          <div className="flex flex-col items-center">
            <span
              className="flex items-center gap-1.5 text-lg font-semibold"
              style={{ color: "var(--bsky-text-primary)" }}
            >
              <Eye size={18} style={{ color: "var(--bsky-text-secondary)" }} />
              {stats.totalReplies}
            </span>
            <span
              className="text-xs"
              style={{ color: "var(--bsky-text-tertiary)" }}
            >
              Total replies
            </span>
          </div>
          <div className="flex flex-col items-center">
            <span
              className="flex items-center gap-1.5 text-lg font-semibold"
              style={{ color: "var(--bsky-text-primary)" }}
            >
              <Heart size={18} style={{ color: "rgb(239, 68, 68)" }} />
              {stats.totalLikes}
            </span>
            <span
              className="text-xs"
              style={{ color: "var(--bsky-text-tertiary)" }}
            >
              Total likes
            </span>
          </div>
          <div className="flex flex-col items-center">
            <span
              className="flex items-center gap-1.5 text-lg font-semibold"
              style={{ color: "var(--bsky-text-primary)" }}
            >
              <Repeat2 size={18} style={{ color: "rgb(34, 197, 94)" }} />
              {stats.totalReposts}
            </span>
            <span
              className="text-xs"
              style={{ color: "var(--bsky-text-tertiary)" }}
            >
              Total reposts
            </span>
          </div>
        </div>
      )}

      {/* Thread tree */}
      <div className="space-y-1">
        {threadTree.length > 0 ? (
          threadTree.map((rootNode) => renderNode(rootNode, true))
        ) : (
          <div className="flex items-center justify-center py-8">
            <p style={{ color: "var(--bsky-text-secondary)" }}>
              No posts to display
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * ThreadTreeViewWithContext - Wrapper that provides ThreadContext
 *
 * Use this component when you need access to shared thread state across multiple components.
 * The ThreadTreeView component can be used directly for simple cases where context sharing
 * is not needed.
 */
export const ThreadTreeViewWithContext: React.FC<ThreadTreeViewProps> = (
  props,
) => {
  return (
    <ThreadProvider
      posts={props.posts}
      rootUri={props.rootUri}
      initialHighlightUri={props.highlightUri}
      initialFoldDepth={props.initialFoldDepth}
    >
      <ThreadTreeView {...props} />
    </ThreadProvider>
  );
};
