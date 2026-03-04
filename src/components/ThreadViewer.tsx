import type { AppBskyFeedDefs } from "@atproto/api";
import type { Notification } from "@atproto/api/dist/client/types/app/bsky/notification/listNotifications";
import { formatDistanceToNow } from "date-fns";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CornerDownRight,
  ExternalLink,
  GitBranch,
  Layers,
  Loader2,
  MessageSquare,
  Minus,
  Plus,
  Trash2,
  User,
} from "lucide-react";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "../contexts/AuthContext";
import { ThreadProvider, type ThreadNode } from "../contexts/ThreadContext";
import { useOptimisticPosts } from "../hooks/useOptimisticPosts";
import { useResponsiveCollapseThresholds } from "../hooks/useResponsiveCollapseThresholds";
import { useScrollPersistence } from "../hooks/useScrollPersistence";
import { useThreadCollapse } from "../hooks/useThreadCollapse";
import { useThreadKeyboardNav } from "../hooks/useThreadKeyboardNav";
import { useThreadTree } from "../hooks/useThreadTree";
import { useViewTransitionNavigate } from "../hooks/useViewTransitionNavigate";
import { countNodeDescendants } from "../utils/thread-helpers";
import { EmbedRenderer } from "./EmbedRenderer";
import { ImageGallery } from "./ImageGallery";
import { PostActionBar } from "./PostActionBar";
import { GateIndicator } from "./ReplyControls";
import { EmptyState } from "./ui/EmptyState";
import { LabelBadge } from "./ui/LabelBadge";
import { ProfileHoverCard } from "./ui/ProfileHoverCard";
import { RichText } from "./ui/RichText";
import { ThrottledAvatar } from "./ui/ThrottledAvatar";
import { type VirtualizedThreadListHandle } from "./VirtualizedThreadList";
export {
  useThread,
  useThreadCollapseState,
  useThreadComplexity,
  useThreadData,
  useThreadNav,
  useThreadNavigation,
  useThreadUserPosts,
} from "../contexts/ThreadContext";
export { clearPersistedScrollPosition } from "../utils/thread-helpers";

type Post = AppBskyFeedDefs.PostView;

export interface ThreadViewerProps {
  posts: Post[];
  notifications?: Notification[];
  rootUri?: string;
  highlightUri?: string;
  onPostClick?: (post: Post, action?: "reply" | "quote") => void;
  showUnreadIndicators?: boolean;
  className?: string;
  // New props for enhanced features
  maxInitialReplies?: number;
  enableKeyboardNavigation?: boolean;
  // Thread management props
  currentUserDid?: string;
  onDeletePost?: (post: Post) => void;
  onContinueThread?: () => void;
  // Hero root post props
  rootPostObject?: Post;
  threadSummary?: React.ReactNode;
  // Ref for sticky context bar sentinel element
  contextBarSentinelRef?: React.RefObject<HTMLDivElement | null>;
  // Controlled focus index for external navigation (e.g., minimap)
  focusedIndex?: number;
  onFocusedIndexChange?: (index: number) => void;
  // Scroll container ref for scroll position tracking (passed from parent modal)
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
  // Callback to restore initial focused index from persisted state
  onRestoreScrollPosition?: (focusedIndex: number) => void;
  // Ancestor state - indicates if there are more posts above
  hasMoreAbove?: boolean;
  isLoadingMoreAbove?: boolean;
  onLoadMoreAbove?: () => void;
}

export const ThreadViewer: React.FC<ThreadViewerProps> = ({
  posts,
  notifications = [],
  rootUri,
  highlightUri,
  onPostClick,
  showUnreadIndicators = true,
  className = "",
  maxInitialReplies = 5,
  enableKeyboardNavigation = true,
  currentUserDid: propCurrentUserDid,
  onDeletePost,
  onContinueThread,
  rootPostObject,
  threadSummary,
  contextBarSentinelRef,
  focusedIndex: controlledFocusedIndex,
  onFocusedIndexChange,
  scrollContainerRef,
  onRestoreScrollPosition,
  hasMoreAbove = false,
  isLoadingMoreAbove = false,
  onLoadMoreAbove,
}) => {
  const navigate = useViewTransitionNavigate();
  const { session } = useAuth();
  const currentUserDid = propCurrentUserDid || session?.did;

  // Gallery state (can't extract - needs to be local for image click handling)
  const [galleryImages, setGalleryImages] = useState<Array<{
    thumb: string;
    fullsize: string;
    alt?: string;
  }> | null>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);

  // Highlight tracking state
  const [hasShownInitialHighlight, setHasShownInitialHighlight] =
    useState(false);
  const [hasScrolledToHighlight, setHasScrolledToHighlight] = useState(false);

  // State for showing replies section (progressive reveal) - start expanded
  const [showReplies, setShowReplies] = useState(true);

  // Thread ID for localStorage persistence (use rootUri or first post uri)
  const threadId = useMemo(() => {
    return rootUri || posts[0]?.uri || "";
  }, [rootUri, posts]);

  // Get depth-based color functions for visual thread hierarchy
  const { getBranchBorderColor, getBranchBackgroundColor } =
    useResponsiveCollapseThresholds();

  // === EXTRACTED HOOKS ===

  // Build thread tree and calculate metrics
  const { threadTree, flatNodeList, maxThreadDepth, complexityScore } =
    useThreadTree({
      posts,
      notifications,
      rootUri,
    });

  // Manage collapse/expand state with persistence
  const {
    expandedBranches,
    animatingNodes,
    isCollapsed: isBranchCollapsed,
    toggleCollapse: toggleCollapseBranch,
    toggleExpand: toggleBranch,
  } = useThreadCollapse({
    threadId,
  });

  // Refs for navigation and scroll management
  const postRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  const virtualListRef = useRef<VirtualizedThreadListHandle>(null);

  // Clean up postRefs when flatNodeList changes to prevent unbounded growth.
  // Also applies LRU-style pruning: when the map exceeds MAX_POST_REFS_SIZE,
  // entries far from the current visible range are evicted.
  const MAX_POST_REFS_SIZE = 200;
  useEffect(() => {
    const currentRefs = postRefs.current;

    // Remove entries for indices that no longer exist in the list
    for (const key of currentRefs.keys()) {
      if (key >= flatNodeList.length) {
        currentRefs.delete(key);
      }
    }

    // LRU-style pruning: if map is still too large, keep only entries
    // closest to the current focused/visible area
    if (currentRefs.size > MAX_POST_REFS_SIZE) {
      const anchor =
        controlledFocusedIndex !== undefined && controlledFocusedIndex >= 0
          ? controlledFocusedIndex
          : 0;
      const half = Math.floor(MAX_POST_REFS_SIZE / 2);
      const keepMin = Math.max(0, anchor - half);
      const keepMax = keepMin + MAX_POST_REFS_SIZE;

      for (const key of currentRefs.keys()) {
        if (key < keepMin || key > keepMax) {
          currentRefs.delete(key);
        }
      }
    }
  }, [flatNodeList, controlledFocusedIndex]);

  // Manage keyboard navigation
  const {
    focusedIndex: focusedPostIndex,
    setFocusedIndex: setFocusedPostIndex,
    userParticipationStats,
  } = useThreadKeyboardNav({
    flatNodeList,
    currentUserDid,
    enabled: enableKeyboardNavigation,
    onPostClick,
    virtualListRef,
    postRefs,
    controlledFocusedIndex,
    onFocusedIndexChange,
  });

  // Manage scroll position persistence
  useScrollPersistence({
    threadId,
    scrollContainerRef,
    focusedIndex: focusedPostIndex,
    highlightUri,
    onRestoreScrollPosition,
  });

  // Get optimistic post mutations
  const { likeMutation, unlikeMutation, repostMutation, unrepostMutation } =
    useOptimisticPosts();

  // Handle like action
  const handleLike = useCallback(
    async (post: Post) => {
      try {
        if (post.viewer?.like) {
          await unlikeMutation.mutateAsync({
            likeUri: post.viewer.like,
            postUri: post.uri,
          });
        } else {
          await likeMutation.mutateAsync({
            uri: post.uri,
            cid: post.cid,
          });
        }
      } catch (error) {
        console.error("Failed to like/unlike post:", error);
      }
    },
    [likeMutation, unlikeMutation],
  );

  // Handle repost action
  const handleRepost = useCallback(
    async (post: Post) => {
      try {
        if (post.viewer?.repost) {
          await unrepostMutation.mutateAsync({
            repostUri: post.viewer.repost,
            postUri: post.uri,
          });
        } else {
          await repostMutation.mutateAsync({
            uri: post.uri,
            cid: post.cid,
          });
        }
      } catch (error) {
        console.error("Failed to repost/unrepost:", error);
      }
    },
    [repostMutation, unrepostMutation],
  );

  // Get the CSS custom property name based on thread depth
  // This allows CSS clamp() to handle responsive scaling automatically
  const getIndentCssVar = useCallback((depth: number): string => {
    if (depth <= 3) return "var(--thread-indent-shallow)";
    if (depth <= 7) return "var(--thread-indent-medium)";
    if (depth <= 12) return "var(--thread-indent-deep)";
    return "var(--thread-indent-minimal)";
  }, []);

  // Get the CSS variable name for the current thread depth
  const indentCssVar = useMemo(
    () => getIndentCssVar(maxThreadDepth),
    [maxThreadDepth, getIndentCssVar],
  );

  // Ref for the highlighted post
  const highlightRef = useRef<HTMLDivElement>(null);

  // Scroll to highlighted post only on initial render
  useEffect(() => {
    if (highlightUri && highlightRef.current && !hasScrolledToHighlight) {
      // Check if the highlighted post is the root post
      const isRootPost = highlightUri === rootUri;

      setTimeout(() => {
        if (isRootPost) {
          // For root posts, scroll to the top of the container
          highlightRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        } else {
          // For other posts, center them in view
          highlightRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }
        setHasScrolledToHighlight(true);
      }, 100); // Small delay to ensure DOM is ready
    }
  }, [highlightUri, rootUri, posts, hasScrolledToHighlight]);

  // Clear the initial highlight after 2 seconds
  useEffect(() => {
    if (highlightUri && !hasShownInitialHighlight) {
      const timer = setTimeout(() => {
        setHasShownInitialHighlight(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [highlightUri, hasShownInitialHighlight]);

  // Scroll to post when controlled focus index changes (e.g., from minimap navigation)
  useEffect(() => {
    if (controlledFocusedIndex !== undefined && controlledFocusedIndex >= 0) {
      const postElement = postRefs.current.get(controlledFocusedIndex);
      if (postElement) {
        postElement.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }
  }, [controlledFocusedIndex]);

  // Handle image click for gallery
  const handleImageClick = useCallback(
    (
      images: Array<{ thumb: string; fullsize: string; alt?: string }>,
      index: number,
    ) => {
      setGalleryImages(images);
      setGalleryIndex(index);
    },
    [],
  );

  // Render embeds using the extracted EmbedRenderer component
  const renderEmbed = useCallback(
    (embed: any, postUri?: string) => {
      return (
        <EmbedRenderer
          embed={embed}
          postUri={postUri}
          onImageClick={handleImageClick}
        />
      );
    },
    [handleImageClick],
  );

  // Render thread nodes recursively
  const renderThreadNodes = useCallback(
    (nodes: ThreadNode[]): JSX.Element[] => {
      return nodes.map((node) => {
        const post = node.post;
        const notification = node.notification;
        const isUnread =
          showUnreadIndicators && notification && !notification.isRead;
        const isHighlighted = highlightUri && post?.uri === highlightUri;
        const author = post?.author || notification?.author;
        const isCurrentUser = currentUserDid && author?.did === currentUserDid;
        const isFocused = node.flatIndex === focusedPostIndex;
        const nodeUri = post?.uri || notification?.uri || `node-${node.depth}`;

        // Check if this branch is user-collapsed
        const hasChildren = node.children.length > 0;
        const isCollapsed = isBranchCollapsed(nodeUri);
        const isAnimating = animatingNodes.has(nodeUri);
        const descendantCount = hasChildren ? countNodeDescendants(node) : 0;

        // Calculate if this branch should show "load more" (old behavior)
        // Use complexity-based threshold or fallback to maxInitialReplies
        const effectiveMaxReplies = Math.min(
          maxInitialReplies,
          complexityScore.revealBatchSize,
        );
        const hasMultipleChildren = node.children.length > effectiveMaxReplies;
        const isExpanded = expandedBranches.has(nodeUri);
        const visibleChildren = isCollapsed
          ? [] // Show nothing when collapsed
          : hasMultipleChildren && !isExpanded
            ? node.children.slice(0, effectiveMaxReplies)
            : node.children;
        const hiddenCount = hasMultipleChildren
          ? node.children.length - effectiveMaxReplies
          : 0;

        // Count branches at this level
        const hasBranches = node.children.length > 1;

        // Get depth-based colors for visual hierarchy
        const depthBorderColor = getBranchBorderColor(node.depth);
        const depthBgColor = getBranchBackgroundColor(node.depth);

        // Generate external bsky.app URL for the external link button
        const postUrl =
          post?.uri && author?.handle
            ? (() => {
                const postId = post.uri.split("/").pop();
                return `https://bsky.app/profile/${author.handle}/post/${postId}`;
              })()
            : null;

        return (
          <div
            key={nodeUri}
            className="mb-4"
            data-post-index={node.flatIndex}
            data-post-uri={nodeUri}
            ref={(el) => {
              if (isHighlighted && highlightRef) {
                (
                  highlightRef as React.MutableRefObject<HTMLDivElement | null>
                ).current = el;
              }
              if (node.flatIndex !== undefined && el) {
                postRefs.current.set(node.flatIndex, el);
              }
            }}
          >
            {/* Thread line connector for nested replies - with depth-based colors */}
            {node.depth > 0 && (
              <div className="flex">
                <div
                  className="flex w-8 flex-shrink-0 justify-center"
                  style={{
                    marginLeft: `calc(${node.depth - 1} * ${indentCssVar})`,
                  }}
                >
                  <div
                    className="-mt-6 h-6 w-0.5 transition-colors"
                    style={{
                      backgroundColor: depthBorderColor,
                      borderRadius: "1px",
                    }}
                  />
                </div>
                <div className="flex-1" />
              </div>
            )}

            {/* Post content */}
            <div
              className="flex"
              style={{ marginLeft: `calc(${node.depth} * ${indentCssVar})` }}
            >
              {/* Collapse/Expand button for branches with children */}
              {hasChildren && node.depth > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleCollapseBranch(nodeUri);
                  }}
                  className="mr-1 flex flex-shrink-0 items-center justify-center rounded transition-all hover:scale-110"
                  style={{
                    width: "20px",
                    height: "20px",
                    marginTop: "12px",
                    backgroundColor: depthBorderColor,
                    color: "white",
                    opacity: 0.9,
                  }}
                  aria-label={isCollapsed ? "Expand branch" : "Collapse branch"}
                  aria-expanded={!isCollapsed}
                >
                  {isCollapsed ? (
                    <ChevronRight size={12} />
                  ) : (
                    <Minus size={12} />
                  )}
                </button>
              )}

              {/* Branch indicator - only show if no collapse button or no children */}
              {node.depth > 0 &&
                !hasChildren &&
                (maxThreadDepth <= 15 || node.depth < 10) && (
                  <div
                    className="flex flex-shrink-0 items-start justify-center pt-3"
                    style={{
                      width:
                        maxThreadDepth > 10
                          ? "16px"
                          : maxThreadDepth > 7
                            ? "24px"
                            : "32px",
                      marginRight: maxThreadDepth > 10 ? "4px" : "0",
                    }}
                  >
                    <CornerDownRight
                      size={
                        maxThreadDepth > 10 ? 10 : maxThreadDepth > 7 ? 12 : 16
                      }
                      style={{
                        color: depthBorderColor,
                        opacity: 0.8,
                      }}
                    />
                  </div>
                )}

              {/* Post card */}
              <div
                className={`min-w-0 flex-1 ${maxThreadDepth > 15 ? "p-2" : maxThreadDepth > 10 ? "p-3" : "p-4"} cursor-pointer rounded-lg transition-all hover:bg-blue-50 dark:hover:bg-blue-900/10 ${
                  isUnread ? "ring-2 ring-blue-500 ring-opacity-30" : ""
                } ${isHighlighted && !hasShownInitialHighlight ? "ring-2 ring-orange-500 ring-opacity-50" : ""} ${
                  isFocused ? "ring-2 ring-blue-400 ring-opacity-70" : ""
                }`}
                style={{
                  backgroundColor: isCurrentUser
                    ? "rgba(34, 197, 94, 0.08)" // Green tint for user's posts
                    : isHighlighted && !hasShownInitialHighlight
                      ? "rgba(251, 146, 60, 0.1)" // Orange highlight background (only initially)
                      : node.isRoot
                        ? "var(--asph-bg-secondary)"
                        : isUnread
                          ? "var(--asph-bg-primary)"
                          : node.depth > 0
                            ? depthBgColor // Subtle depth-based background
                            : "var(--asph-bg-secondary)",
                  borderColor: isCurrentUser
                    ? "var(--asph-success-light)" // Green left border for user's posts
                    : undefined,
                  border:
                    isHighlighted && !hasShownInitialHighlight
                      ? "2px solid var(--asph-orange-light)"
                      : isCurrentUser
                        ? undefined
                        : "1px solid var(--asph-border-primary)",
                  // Depth-colored left border for visual hierarchy
                  borderLeft: isCurrentUser
                    ? "4px solid var(--asph-success-light)"
                    : node.depth > 0 && !node.isRoot
                      ? `3px solid ${depthBorderColor}`
                      : undefined,
                  borderTop: isCurrentUser
                    ? "1px solid var(--asph-border-primary)"
                    : undefined,
                  borderRight: isCurrentUser
                    ? "1px solid var(--asph-border-primary)"
                    : undefined,
                  borderBottom: isCurrentUser
                    ? "1px solid var(--asph-border-primary)"
                    : undefined,
                  overflow: "hidden",
                  fontSize:
                    maxThreadDepth > 15
                      ? "0.75rem"
                      : maxThreadDepth > 10
                        ? "0.875rem"
                        : "1rem",
                  outline: isFocused
                    ? "2px solid var(--asph-info-light)"
                    : undefined,
                  outlineOffset: isFocused ? "2px" : undefined,
                }}
                onClick={(e) => {
                  // Set focus to this post when clicked
                  if (node.flatIndex !== undefined) {
                    setFocusedPostIndex(node.flatIndex);
                  }
                  e.stopPropagation();
                }}
                onKeyDown={(e) => {
                  // Prevent Enter key from triggering the click handler
                  if (e.key === "Enter") {
                    e.stopPropagation();
                  }
                }}
                tabIndex={0}
                role="article"
                aria-label={`Post by ${author?.handle || "unknown"}`}
              >
                {(node.isRoot ||
                  node.depth > 5 ||
                  isCurrentUser ||
                  hasBranches ||
                  (isHighlighted && hasShownInitialHighlight)) && (
                  <div className="mb-2 flex items-center gap-2">
                    {node.isRoot && (
                      <span
                        className="rounded-full px-2 py-1 text-xs font-medium"
                        style={{
                          backgroundColor: "var(--asph-bg-primary)",
                          color: "var(--asph-text-secondary)",
                          border: "1px solid var(--asph-border-primary)",
                        }}
                      >
                        Original Post
                      </span>
                    )}
                    {isCurrentUser && !node.isRoot && (
                      <span className="border-asph-success/30 bg-asph-success/15 flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium text-asph-success">
                        <User size={10} />
                        Your reply
                      </span>
                    )}
                    {hasBranches && (
                      <span className="border-asph-quote/20 bg-asph-quote/10 flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium text-asph-quote">
                        <GitBranch size={10} />
                        {node.children.length} branches
                      </span>
                    )}
                    {node.depth > 5 && !node.isRoot && (
                      <span
                        className="rounded px-2 py-0.5 text-xs font-medium"
                        style={{
                          backgroundColor: "var(--asph-bg-tertiary)",
                          color: "var(--asph-text-tertiary)",
                          opacity: 0.8,
                        }}
                      >
                        Depth: {node.depth}
                      </span>
                    )}
                    {isHighlighted &&
                      hasShownInitialHighlight &&
                      !node.isRoot && (
                        <span className="border-asph-orange/30 bg-asph-orange/10 text-asph-orange flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium">
                          <ExternalLink size={10} />
                          Opened here
                        </span>
                      )}
                    {post && node.isRoot && (
                      <span
                        className="text-xs"
                        style={{
                          color: "var(--asph-text-secondary)",
                        }}
                      >
                        {formatDistanceToNow(
                          new Date(
                            (post.record as any)?.createdAt || post.indexedAt,
                          ),
                          { addSuffix: true },
                        )}
                      </span>
                    )}
                  </div>
                )}

                <div
                  className={`flex items-start ${maxThreadDepth > 15 ? "gap-2" : "gap-3"}`}
                >
                  <div className="flex-shrink-0">
                    <ThrottledAvatar
                      src={author?.avatar}
                      alt={author?.handle || "User"}
                      className={`${maxThreadDepth > 15 ? "h-6 w-6" : maxThreadDepth > 10 ? "h-8 w-8" : "h-10 w-10"} cursor-pointer object-cover transition-opacity hover:opacity-80`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (author?.handle) {
                          navigate(`/profile/${author.handle}`);
                        }
                      }}
                      fallbackInitial={
                        author?.handle?.charAt(0).toUpperCase() || "U"
                      }
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center justify-between">
                      <div className="flex min-w-0 items-center gap-1">
                        {author?.handle ? (
                          <ProfileHoverCard handle={author.handle}>
                            <span
                              className="cursor-pointer truncate text-sm font-semibold hover:underline"
                              style={{ color: "var(--asph-text-primary)" }}
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/profile/${author.handle}`);
                              }}
                            >
                              {author?.displayName ||
                                author?.handle ||
                                "Unknown"}
                            </span>
                          </ProfileHoverCard>
                        ) : (
                          <span
                            className="truncate text-sm font-semibold"
                            style={{ color: "var(--asph-text-primary)" }}
                          >
                            {author?.displayName || author?.handle || "Unknown"}
                          </span>
                        )}
                        {author?.handle ? (
                          <ProfileHoverCard handle={author.handle}>
                            <span
                              className="flex-shrink-0 cursor-pointer text-xs hover:underline"
                              style={{ color: "var(--asph-text-secondary)" }}
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/profile/${author.handle}`);
                              }}
                            >
                              @{author?.handle || "unknown"}
                            </span>
                          </ProfileHoverCard>
                        ) : (
                          <span
                            className="flex-shrink-0 text-xs"
                            style={{ color: "var(--asph-text-secondary)" }}
                          >
                            @{author?.handle || "unknown"}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <time
                          className="text-xs"
                          style={{
                            color: "var(--asph-text-secondary)",
                          }}
                        >
                          {formatDistanceToNow(
                            new Date(
                              (post?.record as any)?.createdAt ||
                                post?.indexedAt ||
                                Date.now(),
                            ),
                            { addSuffix: true },
                          )}
                        </time>
                        {postUrl && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(
                                postUrl,
                                "_blank",
                                "noopener,noreferrer",
                              );
                            }}
                            className="transition-opacity hover:opacity-70"
                            aria-label="Open in Bluesky"
                          >
                            <ExternalLink
                              size={14}
                              style={{ color: "var(--asph-text-tertiary)" }}
                            />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Show labels if present */}
                    {post &&
                      (post as any).labels &&
                      (post as any).labels.length > 0 && (
                        <div className="mb-2">
                          <LabelBadge
                            labels={(post as any).labels}
                            maxDisplay={2}
                            size="sm"
                          />
                        </div>
                      )}

                    <p
                      className="overflow-wrap-anywhere break-words text-sm"
                      style={{
                        color: "var(--asph-text-primary)",
                        lineHeight: "1.5",
                        wordBreak: "break-word",
                        overflowWrap: "anywhere",
                      }}
                    >
                      {post ? (
                        <RichText
                          text={(post.record as any)?.text || "[No text]"}
                          facets={(post.record as any)?.facets}
                        />
                      ) : (
                        <span style={{ color: "var(--asph-text-secondary)" }}>
                          <Loader2
                            size={14}
                            className="mr-1 inline animate-spin"
                          />
                          Loading post content...
                        </span>
                      )}
                    </p>

                    {post?.embed && renderEmbed(post.embed, post.uri)}

                    {isUnread && (
                      <span
                        className="mt-2 inline-block rounded-full px-2 py-0.5 text-xs"
                        style={{
                          backgroundColor: "var(--asph-primary)",
                          color: "white",
                        }}
                      >
                        New
                      </span>
                    )}
                  </div>
                </div>

                {/* Post Action Bar */}
                {post && (
                  <div className="flex items-center justify-between">
                    <PostActionBar
                      post={post}
                      onReply={() => {
                        // Pass the post being replied to up to the ThreadModal
                        onPostClick?.(post, "reply");
                      }}
                      onRepost={() => handleRepost(post)}
                      onQuote={() => {
                        // Pass the post being quoted to up to the ThreadModal
                        onPostClick?.(post, "quote");
                      }}
                      onLike={() => handleLike(post)}
                      showCounts={true}
                      size={maxThreadDepth > 10 ? "small" : "medium"}
                      isReplying={false}
                    />
                    {/* Delete button for user's own posts */}
                    {isCurrentUser && onDeletePost && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeletePost(post);
                        }}
                        className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-all hover:bg-red-500 hover:bg-opacity-10"
                        style={{
                          color: "var(--asph-error, #ef4444)",
                        }}
                        title="Delete this post"
                      >
                        <Trash2 size={14} />
                        <span className="hidden sm:inline">Delete</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Collapsed branch badge - shows when a branch with children is collapsed */}
            {isCollapsed && hasChildren && (
              <div
                className="flex"
                style={{
                  marginLeft: `calc(${node.depth + 1} * ${indentCssVar})`,
                  marginTop: "8px",
                }}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleCollapseBranch(nodeUri);
                  }}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all hover:scale-105"
                  style={{
                    backgroundColor: depthBorderColor,
                    color: "white",
                    boxShadow: `0 2px 8px ${depthBorderColor}40`,
                  }}
                >
                  <MessageSquare size={14} />
                  {descendantCount} hidden{" "}
                  {descendantCount === 1 ? "reply" : "replies"}
                  <ChevronRight size={14} />
                </button>
              </div>
            )}

            {/* Render children with smooth animation wrapper */}
            {!isCollapsed && visibleChildren.length > 0 && (
              <div
                className="overflow-hidden transition-all duration-300 ease-in-out"
                style={{
                  maxHeight: isAnimating ? "0" : "none",
                  opacity: isAnimating ? 0 : 1,
                }}
              >
                {renderThreadNodes(visibleChildren)}
              </div>
            )}

            {/* Load more replies button */}
            {!isCollapsed &&
              hasMultipleChildren &&
              !isExpanded &&
              hiddenCount > 0 && (
                <div
                  className="flex"
                  style={{
                    marginLeft: `calc(${node.depth + 1} * ${indentCssVar})`,
                    marginTop: "8px",
                  }}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      // Store scroll position before expanding
                      const scrollContainer =
                        containerRef.current?.closest(".asph-scrollbar");
                      const scrollTop = scrollContainer?.scrollTop || 0;

                      toggleBranch(nodeUri);

                      // Restore scroll position after expansion
                      requestAnimationFrame(() => {
                        if (scrollContainer) {
                          scrollContainer.scrollTop = scrollTop;
                        }
                      });
                    }}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all hover:bg-blue-100 dark:hover:bg-blue-900/20"
                    style={{
                      backgroundColor: "var(--asph-bg-tertiary)",
                      color: "var(--asph-primary)",
                      border: "1px solid var(--asph-border-primary)",
                    }}
                  >
                    <ChevronDown size={16} />
                    Load {hiddenCount} more{" "}
                    {hiddenCount === 1 ? "reply" : "replies"}
                  </button>
                </div>
              )}

            {/* Collapse button when expanded (legacy load-more behavior) */}
            {!isCollapsed &&
              hasMultipleChildren &&
              isExpanded &&
              hiddenCount > 0 && (
                <div
                  className="flex"
                  style={{
                    marginLeft: `calc(${node.depth + 1} * ${indentCssVar})`,
                    marginTop: "8px",
                  }}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleBranch(nodeUri);

                      // Scroll back to a reasonable position after collapse
                      requestAnimationFrame(() => {
                        const postEl = postRefs.current.get(
                          node.flatIndex || 0,
                        );
                        if (postEl) {
                          postEl.scrollIntoView({
                            behavior: "smooth",
                            block: "center",
                          });
                        }
                      });
                    }}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all hover:bg-blue-100 dark:hover:bg-blue-900/20"
                    style={{
                      backgroundColor: "var(--asph-bg-tertiary)",
                      color: "var(--asph-text-secondary)",
                      border: "1px solid var(--asph-border-primary)",
                    }}
                  >
                    <ChevronUp size={16} />
                    Collapse {hiddenCount}{" "}
                    {hiddenCount === 1 ? "reply" : "replies"}
                  </button>
                </div>
              )}
          </div>
        );
      });
    },
    [
      showUnreadIndicators,
      highlightUri,
      highlightRef,
      hasShownInitialHighlight,
      indentCssVar,
      maxThreadDepth,
      navigate,
      onPostClick,
      renderEmbed,
      handleLike,
      handleRepost,
      currentUserDid,
      focusedPostIndex,
      expandedBranches,
      maxInitialReplies,
      complexityScore,
      toggleBranch,
      setFocusedPostIndex,
      onDeletePost,
      // New collapse functionality
      isBranchCollapsed,
      toggleCollapseBranch,
      animatingNodes,
      getBranchBorderColor,
      getBranchBackgroundColor,
    ],
  );

  // Calculate reply count (excluding root)
  const replyCount = posts.length - 1;

  return (
    <>
      <div ref={containerRef} className={`thread-viewer ${className}`}>
        {/* Load More Above indicator - shown when thread is truncated */}
        {hasMoreAbove && onLoadMoreAbove && (
          <div className="mb-4">
            <button
              onClick={onLoadMoreAbove}
              disabled={isLoadingMoreAbove}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-3 transition-colors hover:border-solid disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                borderColor: "var(--asph-border-primary)",
                backgroundColor: "var(--asph-bg-secondary)",
                color: "var(--asph-text-secondary)",
              }}
            >
              {isLoadingMoreAbove ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span className="text-sm font-medium">
                    Loading earlier posts...
                  </span>
                </>
              ) : (
                <>
                  <ChevronUp size={16} />
                  <span className="text-sm font-medium">
                    Load earlier posts in thread
                  </span>
                  <ChevronUp size={16} />
                </>
              )}
            </button>
            <div
              className="mt-2 text-center text-xs"
              style={{ color: "var(--asph-text-tertiary)" }}
            >
              This thread continues above
            </div>
          </div>
        )}

        {/* Hero Root Post */}
        {rootPostObject && (
          <div className="mb-6">
            {/* Author header */}
            <div className="mb-4 flex items-center gap-3">
              <ThrottledAvatar
                src={rootPostObject.author?.avatar}
                alt={rootPostObject.author?.handle || "User"}
                className="h-12 w-12 cursor-pointer object-cover transition-opacity hover:opacity-80"
                onClick={() =>
                  navigate(`/profile/${rootPostObject.author?.handle}`)
                }
                fallbackInitial={
                  rootPostObject.author?.handle?.charAt(0).toUpperCase() || "U"
                }
                priority
              />
              <div className="min-w-0 flex-1">
                <ProfileHoverCard handle={rootPostObject.author?.handle || ""}>
                  <div
                    className="cursor-pointer truncate font-semibold hover:underline"
                    style={{ color: "var(--asph-text-primary)" }}
                    onClick={() =>
                      navigate(`/profile/${rootPostObject.author?.handle}`)
                    }
                  >
                    {rootPostObject.author?.displayName ||
                      rootPostObject.author?.handle}
                  </div>
                </ProfileHoverCard>
                <div
                  className="text-sm"
                  style={{ color: "var(--asph-text-secondary)" }}
                >
                  @{rootPostObject.author?.handle} ·{" "}
                  {formatDistanceToNow(
                    new Date(
                      (rootPostObject.record as { createdAt?: string })
                        ?.createdAt || rootPostObject.indexedAt,
                    ),
                    { addSuffix: true },
                  )}
                </div>
              </div>
            </div>

            {/* Post content - large typography */}
            <div
              className="mb-4 text-lg leading-relaxed"
              style={{ color: "var(--asph-text-primary)" }}
            >
              <RichText
                text={
                  (rootPostObject.record as { text?: string })?.text ||
                  "[No text]"
                }
                facets={
                  (
                    rootPostObject.record as {
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

            {/* Embeds */}
            {rootPostObject.embed &&
              renderEmbed(rootPostObject.embed, rootPostObject.uri)}

            {/* Gate indicators */}
            <GateIndicator
              replyDisabled={rootPostObject.viewer?.replyDisabled}
              embeddingDisabled={rootPostObject.viewer?.embeddingDisabled}
              threadgate={rootPostObject.threadgate}
              className="mt-3"
            />

            {/* Action bar */}
            <div className="mt-4">
              <PostActionBar
                post={rootPostObject}
                onReply={() => onPostClick?.(rootPostObject, "reply")}
                onRepost={() => handleRepost(rootPostObject)}
                onQuote={() => onPostClick?.(rootPostObject, "quote")}
                onLike={() => handleLike(rootPostObject)}
                showCounts={true}
                size="medium"
                isReplying={false}
              />
            </div>

            {/* Thread summary */}
            {threadSummary && replyCount > 0 && (
              <div className="mt-4">{threadSummary}</div>
            )}

            {/* Sentinel element for sticky context bar intersection observer */}
            {contextBarSentinelRef && (
              <div
                ref={contextBarSentinelRef as React.RefObject<HTMLDivElement>}
                className="pointer-events-none h-0"
                aria-hidden="true"
              />
            )}

            {/* Replies toggle with complexity indicator */}
            {replyCount > 0 && (
              <button
                onClick={() => setShowReplies(!showReplies)}
                className="mt-4 flex w-full items-center justify-between rounded-lg px-4 py-3 transition-colors hover:bg-blue-50 dark:hover:bg-blue-900/10"
                style={{
                  backgroundColor: "var(--asph-bg-secondary)",
                  border: "1px solid var(--asph-border-primary)",
                }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="text-sm font-medium"
                    style={{ color: "var(--asph-text-primary)" }}
                  >
                    {replyCount} {replyCount === 1 ? "reply" : "replies"}
                    {userParticipationStats.count > 0 && (
                      <span className="ml-2 text-green-500 dark:text-green-400">
                        · {userParticipationStats.count} from you
                      </span>
                    )}
                  </span>
                  {/* Complexity badge for complex threads */}
                  {(complexityScore.level === "high" ||
                    complexityScore.level === "extreme") && (
                    <span
                      className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                        complexityScore.level === "extreme"
                          ? "border-asph-error/20 bg-asph-error/10 border text-asph-error"
                          : "border-asph-orange/20 bg-asph-orange/10 text-asph-orange border"
                      }`}
                      title={`Complexity score: ${complexityScore.score}/100`}
                    >
                      <Layers size={10} />
                      {complexityScore.level === "extreme"
                        ? "Very Complex"
                        : "Complex"}
                    </span>
                  )}
                </div>
                {showReplies ? (
                  <ChevronUp
                    size={20}
                    style={{ color: "var(--asph-text-secondary)" }}
                  />
                ) : (
                  <ChevronDown
                    size={20}
                    style={{ color: "var(--asph-text-secondary)" }}
                  />
                )}
              </button>
            )}
          </div>
        )}

        {/* Replies section - progressive reveal */}
        {(showReplies || !rootPostObject) && threadTree.length > 0 && (
          <div
            className={rootPostObject ? "border-t pt-4" : ""}
            style={{ borderColor: "var(--asph-border-primary)" }}
          >
            {/* Render non-root nodes only when we have a hero root */}
            {rootPostObject
              ? renderThreadNodes(threadTree[0]?.children || [])
              : renderThreadNodes(threadTree)}
          </div>
        )}

        {/* No posts fallback */}
        {!rootPostObject && threadTree.length === 0 && (
          <EmptyState variant="thread" compact />
        )}

        {/* Continue Thread button - shown when user has posts in the thread */}
        {showReplies &&
          onContinueThread &&
          userParticipationStats.count > 0 && (
            <div className="mt-6 flex justify-center">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onContinueThread();
                }}
                className="flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium transition-all hover:scale-105"
                style={{
                  backgroundColor: "var(--asph-primary)",
                  color: "white",
                  boxShadow: "0 4px 12px rgba(59, 130, 246, 0.3)",
                }}
              >
                <Plus size={18} />
                Continue Thread
              </button>
            </div>
          )}

        {/* Join conversation button */}
        {showReplies &&
          onContinueThread &&
          userParticipationStats.count === 0 &&
          posts.length > 0 && (
            <div className="mt-6 flex justify-center">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const lastPost = posts[posts.length - 1];
                  if (lastPost) {
                    onPostClick?.(lastPost, "reply");
                  }
                }}
                className="flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-all hover:scale-105"
                style={{
                  backgroundColor: "var(--asph-bg-secondary)",
                  borderColor: "var(--asph-border-primary)",
                  color: "var(--asph-text-primary)",
                }}
              >
                <Plus size={18} />
                Join Conversation
              </button>
            </div>
          )}
      </div>

      {galleryImages && (
        <ImageGallery
          images={galleryImages}
          initialIndex={galleryIndex}
          onClose={() => {
            setGalleryImages(null);
            setGalleryIndex(0);
          }}
        />
      )}
    </>
  );
};

/**
 * ThreadViewerWithContext - Wrapper that provides ThreadContext
 *
 * Use this component when you need access to shared thread state across multiple components.
 * The ThreadViewer component can be used directly for simple cases where context sharing
 * is not needed.
 */
export const ThreadViewerWithContext: React.FC<ThreadViewerProps> = (props) => {
  return (
    <ThreadProvider
      posts={props.posts}
      notifications={props.notifications}
      rootUri={props.rootUri}
      initialHighlightUri={props.highlightUri}
    >
      <ThreadViewer {...props} />
    </ThreadProvider>
  );
};

// Hooks re-exported at top of file from "../contexts/ThreadContext"
