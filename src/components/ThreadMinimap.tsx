/**
 * ThreadMinimap - Visual minimap for thread navigation
 *
 * Provides a visual overview of the thread structure similar to code editor minimaps.
 * Shows dots/lines for reply chains and branching, enables click-to-jump navigation,
 * and highlights current position, user's posts, and the root post.
 *
 * Visibility conditions:
 * - Only shown on threads with >10 posts OR depth >3
 */

import type { AppBskyFeedDefs } from "@atproto/api";
import { ChevronDown, ChevronUp, Map, X } from "lucide-react";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type Post = AppBskyFeedDefs.PostView;

interface MinimapNode {
  post: Post;
  depth: number;
  index: number;
  children: MinimapNode[];
  parentIndex: number | null;
  isRoot: boolean;
  hasMultipleReplies: boolean;
}

interface ThreadMinimapProps {
  posts: Post[];
  currentIndex: number;
  currentUserDid?: string;
  onNavigate: (index: number) => void;
  className?: string;
  rootUri?: string;
}

// Calculate whether minimap should be visible based on thread complexity
function shouldShowMinimap(
  posts: Post[],
  maxDepth: number,
): { show: boolean; reason: string } {
  if (posts.length > 10) {
    return { show: true, reason: `${posts.length} posts` };
  }
  if (maxDepth > 3) {
    return { show: true, reason: `${maxDepth} levels deep` };
  }
  return { show: false, reason: "" };
}

// Build tree structure from flat posts array
function buildMinimapTree(
  posts: Post[],
  rootUri?: string,
): {
  nodes: MinimapNode[];
  maxDepth: number;
} {
  const nodeMap: Record<string, MinimapNode> = {};
  const rootNodes: MinimapNode[] = [];

  // Create all nodes
  posts.forEach((post, index) => {
    const node: MinimapNode = {
      post,
      depth: 0,
      index,
      children: [],
      parentIndex: null,
      isRoot: false,
      hasMultipleReplies: false,
    };
    nodeMap[post.uri] = node;
  });

  // Determine root URI
  const actualRootUri =
    rootUri ||
    (() => {
      const childUris = new Set<string>();
      posts.forEach((post) => {
        const record = post.record as { reply?: { parent?: { uri: string } } };
        if (record?.reply?.parent?.uri) {
          childUris.add(post.uri);
        }
      });
      const roots = posts.filter((post) => !childUris.has(post.uri));
      return roots[0]?.uri;
    })();

  // Mark root node
  if (actualRootUri && nodeMap[actualRootUri]) {
    const rootNode = nodeMap[actualRootUri];
    rootNode.isRoot = true;
    rootNodes.push(rootNode);
  }

  // Build parent-child relationships
  Object.values(nodeMap).forEach((childNode: MinimapNode) => {
    if (childNode.isRoot) return;

    const postRecord = childNode.post?.record as {
      reply?: { parent?: { uri: string } };
    };
    const parentUri = postRecord?.reply?.parent?.uri;

    if (parentUri) {
      const parentNode = nodeMap[parentUri];
      if (parentNode) {
        parentNode.children.push(childNode);
        childNode.depth = parentNode.depth + 1;
        childNode.parentIndex = parentNode.index;
      } else if (rootNodes.length > 0) {
        rootNodes[0].children.push(childNode);
        childNode.depth = 1;
        childNode.parentIndex = rootNodes[0].index;
      }
    }
  });

  // Calculate max depth and mark branch points
  let maxDepth = 0;

  const traverse = (node: MinimapNode) => {
    maxDepth = Math.max(maxDepth, node.depth);
    if (node.children.length > 1) {
      node.hasMultipleReplies = true;
    }
    // Sort children by timestamp
    node.children.sort((a, b) => {
      const aTime = a.post?.indexedAt || "";
      const bTime = b.post?.indexedAt || "";
      return new Date(aTime).getTime() - new Date(bTime).getTime();
    });
    node.children.forEach(traverse);
  };

  rootNodes.forEach(traverse);

  // Handle orphan nodes
  if (rootNodes.length === 0) {
    const allNodes = Object.values(nodeMap) as MinimapNode[];
    allNodes.forEach((node: MinimapNode) => {
      const hasParent = allNodes.some((n: MinimapNode) =>
        n.children.includes(node),
      );
      if (!hasParent) {
        rootNodes.push(node);
      }
    });
  }

  return { nodes: rootNodes, maxDepth };
}

// Create flat list in depth-first order for rendering
function flattenTree(nodes: MinimapNode[]): MinimapNode[] {
  const flat: MinimapNode[] = [];

  const traverse = (node: MinimapNode) => {
    flat.push(node);
    node.children.forEach(traverse);
  };

  nodes.forEach(traverse);
  return flat;
}

export const ThreadMinimap: React.FC<ThreadMinimapProps> = ({
  posts,
  currentIndex,
  currentUserDid,
  onNavigate,
  className = "",
  rootUri,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Build tree structure
  const { nodes, maxDepth } = useMemo(
    () => buildMinimapTree(posts, rootUri),
    [posts, rootUri],
  );

  // Flatten for rendering
  const flatNodes = useMemo(() => flattenTree(nodes), [nodes]);

  // Check if minimap should be shown
  const { show, reason } = useMemo(
    () => shouldShowMinimap(posts, maxDepth),
    [posts, maxDepth],
  );

  // Get user's post indices for highlighting
  const userPostIndices = useMemo(() => {
    if (!currentUserDid) return new Set<number>();
    return new Set(
      posts
        .map((post, idx) => (post.author?.did === currentUserDid ? idx : -1))
        .filter((idx) => idx >= 0),
    );
  }, [posts, currentUserDid]);

  // SVG dimensions and scaling
  const nodeSize = 8;
  const nodeSpacing = 14;
  const depthSpacing = 16;
  const padding = 12;

  const svgWidth = useMemo(
    () => padding * 2 + (maxDepth + 1) * depthSpacing + nodeSize,
    [maxDepth],
  );

  const svgHeight = useMemo(
    () => padding * 2 + flatNodes.length * nodeSpacing,
    [flatNodes.length],
  );

  // Auto-scroll to keep current node visible
  useEffect(() => {
    if (!containerRef.current || isCollapsed) return;

    const currentY = padding + currentIndex * nodeSpacing;
    const containerHeight = containerRef.current.clientHeight;
    const scrollTop = containerRef.current.scrollTop;

    if (currentY < scrollTop + 20) {
      containerRef.current.scrollTo({
        top: Math.max(0, currentY - 40),
        behavior: "smooth",
      });
    } else if (currentY > scrollTop + containerHeight - 40) {
      containerRef.current.scrollTo({
        top: currentY - containerHeight + 60,
        behavior: "smooth",
      });
    }
  }, [currentIndex, isCollapsed]);

  // Handle node click
  const handleNodeClick = useCallback(
    (index: number, e: React.MouseEvent) => {
      e.stopPropagation();
      onNavigate(index);
    },
    [onNavigate],
  );

  // Get node color based on state
  const getNodeColor = useCallback(
    (node: MinimapNode, idx: number): string => {
      // Current position - bright blue
      if (idx === currentIndex) {
        return "var(--bsky-primary)";
      }
      // Root post - gold/amber
      if (node.isRoot) {
        return "var(--bsky-warning)";
      }
      // User's posts - green
      if (userPostIndices.has(idx)) {
        return "var(--bsky-success)";
      }
      // Branch points - purple
      if (node.hasMultipleReplies) {
        return "var(--bsky-accent)";
      }
      // Default - muted
      return "var(--bsky-text-tertiary)";
    },
    [currentIndex, userPostIndices],
  );

  // Get node opacity
  const getNodeOpacity = useCallback(
    (idx: number): number => {
      if (idx === currentIndex) return 1;
      // Fade nodes further from current
      const distance = Math.abs(idx - currentIndex);
      return Math.max(0.3, 1 - distance * 0.03);
    },
    [currentIndex],
  );

  // Don't render if thread doesn't meet complexity threshold
  if (!show || !isVisible) {
    return null;
  }

  return (
    <div
      className={`thread-minimap fixed right-4 top-1/2 z-50 -translate-y-1/2 transition-all duration-200 ${className}`}
      style={{
        maxHeight: "70vh",
      }}
    >
      {/* Minimap container */}
      <div
        className="relative rounded-xl shadow-lg transition-all duration-200"
        style={{
          backgroundColor: "var(--bsky-bg-secondary)",
          border: "1px solid var(--bsky-border-primary)",
          width: isCollapsed ? "40px" : `${Math.min(svgWidth + 8, 120)}px`,
        }}
      >
        {/* Header */}
        <div
          className="flex cursor-pointer items-center justify-between rounded-t-xl px-2 py-1.5"
          style={{
            backgroundColor: "var(--bsky-bg-tertiary)",
            borderBottom: isCollapsed
              ? "none"
              : "1px solid var(--bsky-border-primary)",
          }}
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          {!isCollapsed && (
            <div className="flex items-center gap-1">
              <Map size={12} style={{ color: "var(--bsky-text-secondary)" }} />
              <span
                className="text-xs font-medium"
                style={{ color: "var(--bsky-text-secondary)" }}
              >
                Map
              </span>
            </div>
          )}
          <div className="flex items-center gap-0.5">
            {isCollapsed ? (
              <ChevronDown
                size={14}
                style={{ color: "var(--bsky-text-secondary)" }}
              />
            ) : (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsVisible(false);
                  }}
                  className="rounded p-0.5 transition-colors hover:bg-black/10 dark:hover:bg-white/10"
                  title="Close minimap"
                >
                  <X size={12} style={{ color: "var(--bsky-text-tertiary)" }} />
                </button>
                <ChevronUp
                  size={14}
                  style={{ color: "var(--bsky-text-secondary)" }}
                />
              </>
            )}
          </div>
        </div>

        {/* SVG Content */}
        {!isCollapsed && (
          <>
            <div
              ref={containerRef}
              className="bsky-scrollbar overflow-y-auto overflow-x-hidden"
              style={{
                maxHeight: "calc(70vh - 60px)",
              }}
            >
              <svg
                ref={svgRef}
                width={svgWidth}
                height={svgHeight}
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                className="block"
              >
                {/* Connection lines */}
                {flatNodes.map((node, idx) => {
                  if (node.parentIndex === null) return null;

                  const parentNode = flatNodes.find(
                    (_, i) => posts[i]?.uri === posts[node.parentIndex!]?.uri,
                  );
                  if (!parentNode) return null;

                  const parentIdx = flatNodes.indexOf(parentNode);
                  const x1 =
                    padding + parentNode.depth * depthSpacing + nodeSize / 2;
                  const y1 = padding + parentIdx * nodeSpacing + nodeSize / 2;
                  const x2 = padding + node.depth * depthSpacing + nodeSize / 2;
                  const y2 = padding + idx * nodeSpacing + nodeSize / 2;

                  // Use L-shaped path for visual hierarchy
                  const midY = y2;
                  const pathD = `M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY}`;

                  return (
                    <path
                      key={`line-${idx}`}
                      d={pathD}
                      fill="none"
                      stroke="var(--bsky-border-secondary)"
                      strokeWidth={1}
                      strokeOpacity={getNodeOpacity(idx) * 0.6}
                    />
                  );
                })}

                {/* Nodes */}
                {flatNodes.map((node, idx) => {
                  const x = padding + node.depth * depthSpacing;
                  const y = padding + idx * nodeSpacing;
                  const isCurrentNode = idx === currentIndex;
                  const isUserPost = userPostIndices.has(idx);
                  const color = getNodeColor(node, idx);
                  const opacity = getNodeOpacity(idx);

                  return (
                    <g
                      key={`node-${idx}`}
                      onClick={(e) => handleNodeClick(idx, e)}
                      style={{ cursor: "pointer" }}
                    >
                      {/* Highlight ring for current node */}
                      {isCurrentNode && (
                        <circle
                          cx={x + nodeSize / 2}
                          cy={y + nodeSize / 2}
                          r={nodeSize / 2 + 3}
                          fill="none"
                          stroke={color}
                          strokeWidth={2}
                          opacity={0.5}
                        >
                          <animate
                            attributeName="r"
                            values={`${nodeSize / 2 + 2};${nodeSize / 2 + 4};${nodeSize / 2 + 2}`}
                            dur="1.5s"
                            repeatCount="indefinite"
                          />
                          <animate
                            attributeName="opacity"
                            values="0.5;0.3;0.5"
                            dur="1.5s"
                            repeatCount="indefinite"
                          />
                        </circle>
                      )}

                      {/* Main node */}
                      <circle
                        cx={x + nodeSize / 2}
                        cy={y + nodeSize / 2}
                        r={
                          isCurrentNode
                            ? nodeSize / 2 + 1
                            : node.isRoot
                              ? nodeSize / 2 + 0.5
                              : node.hasMultipleReplies
                                ? nodeSize / 2
                                : nodeSize / 2 - 1
                        }
                        fill={color}
                        opacity={opacity}
                      />

                      {/* Inner highlight for root/user posts */}
                      {(node.isRoot || isUserPost) && !isCurrentNode && (
                        <circle
                          cx={x + nodeSize / 2}
                          cy={y + nodeSize / 2}
                          r={nodeSize / 4}
                          fill="white"
                          opacity={opacity * 0.4}
                        />
                      )}

                      {/* Hover area (larger for easier clicking) */}
                      <circle
                        cx={x + nodeSize / 2}
                        cy={y + nodeSize / 2}
                        r={nodeSize}
                        fill="transparent"
                        className="hover:fill-current"
                        style={{ fillOpacity: 0.1 }}
                      />
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Footer with legend */}
            <div
              className="flex flex-wrap items-center justify-center gap-2 rounded-b-xl px-2 py-1.5"
              style={{
                backgroundColor: "var(--bsky-bg-tertiary)",
                borderTop: "1px solid var(--bsky-border-primary)",
              }}
            >
              <span
                className="text-center text-[10px]"
                style={{ color: "var(--bsky-text-tertiary)" }}
              >
                {reason}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Legend tooltip (shown on hover) */}
      {!isCollapsed && (
        <div
          className="mt-2 rounded-lg px-2 py-1.5 text-[10px] opacity-0 transition-opacity duration-200 hover:opacity-100"
          style={{
            backgroundColor: "var(--bsky-bg-secondary)",
            border: "1px solid var(--bsky-border-primary)",
            color: "var(--bsky-text-tertiary)",
          }}
        >
          <div className="flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: "var(--bsky-primary)" }}
            />
            Current
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: "var(--bsky-warning)" }}
            />
            Root
          </div>
          {currentUserDid && (
            <div className="flex items-center gap-1.5">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: "var(--bsky-success)" }}
              />
              You
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: "var(--bsky-accent)" }}
            />
            Branch
          </div>
        </div>
      )}
    </div>
  );
};

export default ThreadMinimap;
