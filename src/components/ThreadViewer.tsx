import type { AppBskyFeedDefs } from "@atproto/api";
import type { Notification } from "@atproto/api/dist/client/types/app/bsky/notification/listNotifications";
import type { VirtualItem } from "@tanstack/react-virtual";
import { formatDistanceToNow } from "date-fns";
import {
  ChevronDown,
  ChevronUp,
  CornerDownRight,
  ExternalLink,
  GitBranch,
  Loader2,
  Plus,
  Sparkles,
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
import { useNavigate } from "react-router";
import { useAuth } from "../contexts/AuthContext";
import { ThreadProvider } from "../contexts/ThreadContext";
import { useOptimisticPosts } from "../hooks/useOptimisticPosts";
import { proxifyBskyImage, proxifyBskyVideo } from "../utils/image-proxy";
import { createLogger } from "../utils/logger";
import { ImageGallery } from "./ImageGallery";
import { PostActionBar } from "./PostActionBar";
import { ProfileHoverCard } from "./ui/ProfileHoverCard";
import { RichText } from "./ui/RichText";
import { VideoPlayer } from "./VideoPlayer";
import {
  DEFAULT_VIRTUAL_SCROLL_CONFIG,
  VirtualizedThreadList,
  type VirtualizedThreadListHandle,
  type VirtualScrollConfig,
} from "./VirtualizedThreadList";
export {
  useThread,
  useThreadComplexity,
  useThreadNavigation,
  useThreadUserPosts,
} from "../contexts/ThreadContext";

const logger = createLogger("ThreadViewer");

async function loadAnthropicService() {
  return await import("../services/anthropic");
}

type Post = AppBskyFeedDefs.PostView;

/**
 * @deprecated Use ThreadNode from ThreadContext instead
 * Kept for backwards compatibility
 */
export interface ThreadNode {
  notification?: Notification;
  post?: Post;
  children: ThreadNode[];
  depth: number;
  isRoot?: boolean;
  flatIndex?: number;
}

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
  // Virtual scrolling props for performance with large threads
  enableVirtualization?: boolean;
  virtualScrollConfig?: Partial<VirtualScrollConfig>;
  // Hero root post props
  rootPostObject?: Post;
  threadSummary?: React.ReactNode;
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
  enableVirtualization = true,
  virtualScrollConfig,
  rootPostObject,
  threadSummary,
}) => {
  const navigate = useNavigate();
  const { session } = useAuth();
  const currentUserDid = propCurrentUserDid || session?.did;
  const [galleryImages, setGalleryImages] = useState<Array<{
    thumb: string;
    fullsize: string;
    alt?: string;
  }> | null>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [hasShownInitialHighlight, setHasShownInitialHighlight] =
    useState(false);
  const [hasScrolledToHighlight, setHasScrolledToHighlight] = useState(false);
  const [generatedAltTexts, setGeneratedAltTexts] = useState<
    Record<string, Record<number, string>>
  >({});
  const [generatingAltText, setGeneratingAltText] = useState<
    Record<string, Record<number, boolean>>
  >({});
  const [showAltText, setShowAltText] = useState<
    Record<string, Record<number, boolean>>
  >({});

  // State for collapsible reply branches - tracks which nodes have expanded children
  const [expandedBranches, setExpandedBranches] = useState<Set<string>>(
    new Set(),
  );
  // State for showing replies section (progressive reveal)
  const [showReplies, setShowReplies] = useState(false);
  // State for keyboard navigation - tracks currently focused post index
  const [focusedPostIndex, setFocusedPostIndex] = useState<number>(-1);
  // Ref to track post elements for keyboard navigation
  const postRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  // Container ref for scroll management
  const containerRef = useRef<HTMLDivElement>(null);
  // Ref for virtualized thread list
  const virtualListRef = useRef<VirtualizedThreadListHandle>(null);

  // Merged virtual scroll configuration
  const mergedVirtualConfig = useMemo<VirtualScrollConfig>(
    () => ({
      ...DEFAULT_VIRTUAL_SCROLL_CONFIG,
      ...virtualScrollConfig,
    }),
    [virtualScrollConfig],
  );

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

  // Create a map of notifications by URI
  const notificationMap = useMemo(() => {
    const map = new Map<string, Notification>();
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
          const record = post.record as any;
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
      const postRecord = post?.record as any;
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

  // Find the maximum depth in the thread
  const maxThreadDepth = useMemo(() => {
    let maxDepth = 0;

    const traverse = (node: ThreadNode) => {
      maxDepth = Math.max(maxDepth, node.depth);
      node.children.forEach(traverse);
    };

    threadTree.forEach(traverse);
    return maxDepth;
  }, [threadTree]);

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

  // Create flat list of nodes for keyboard navigation (depth-first order)
  const flatNodeList = useMemo(() => {
    const flat: ThreadNode[] = [];
    let index = 0;

    const traverse = (node: ThreadNode) => {
      node.flatIndex = index++;
      flat.push(node);
      node.children.forEach(traverse);
    };

    threadTree.forEach(traverse);
    return flat;
  }, [threadTree]);

  // Count total user participation in thread
  const userParticipationStats = useMemo(() => {
    if (!currentUserDid) return { count: 0, nodeIndices: [] as number[] };

    const nodeIndices: number[] = [];
    flatNodeList.forEach((node, idx) => {
      if (node.post?.author?.did === currentUserDid) {
        nodeIndices.push(idx);
      }
    });

    return { count: nodeIndices.length, nodeIndices };
  }, [flatNodeList, currentUserDid]);

  // Determine if virtualization should be active
  const shouldVirtualize = useMemo(() => {
    return (
      enableVirtualization &&
      mergedVirtualConfig.enabled &&
      flatNodeList.length >= mergedVirtualConfig.threshold
    );
  }, [enableVirtualization, mergedVirtualConfig, flatNodeList.length]);

  // Toggle branch expansion
  const toggleBranch = useCallback((nodeUri: string) => {
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

  // Keyboard navigation handler
  const handleKeyboardNavigation = useCallback(
    (e: KeyboardEvent) => {
      if (!enableKeyboardNavigation) return;

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

      let newIndex = focusedPostIndex;
      let handled = false;

      switch (e.key) {
        case "ArrowDown":
        case "j": // Vim-style navigation
          newIndex = Math.min(focusedPostIndex + 1, totalNodes - 1);
          if (focusedPostIndex === -1) newIndex = 0;
          handled = true;
          break;
        case "ArrowUp":
        case "k": // Vim-style navigation
          newIndex = Math.max(focusedPostIndex - 1, 0);
          if (focusedPostIndex === -1) newIndex = 0;
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
              (idx) => idx > focusedPostIndex,
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
              .find((idx) => idx < focusedPostIndex);
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
          if (focusedPostIndex >= 0) {
            const node = flatNodeList[focusedPostIndex];
            if (node?.post) {
              onPostClick?.(node.post, e.key === " " ? "quote" : "reply");
              handled = true;
            }
          }
          break;
      }

      if (handled) {
        e.preventDefault();
        if (newIndex !== focusedPostIndex) {
          setFocusedPostIndex(newIndex);
          // Use virtualized list scrolling if available, otherwise fall back to DOM
          if (virtualListRef.current) {
            virtualListRef.current.scrollToIndex(newIndex, {
              align: "center",
              behavior: "smooth",
            });
          } else {
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
      enableKeyboardNavigation,
      flatNodeList,
      focusedPostIndex,
      userParticipationStats.nodeIndices,
      onPostClick,
    ],
  );

  // Set up keyboard event listener
  useEffect(() => {
    if (enableKeyboardNavigation) {
      window.addEventListener("keydown", handleKeyboardNavigation);
      return () => {
        window.removeEventListener("keydown", handleKeyboardNavigation);
      };
    }
  }, [enableKeyboardNavigation, handleKeyboardNavigation]);

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

  const handleGenerateAltText = useCallback(
    async (imageUrl: string, postUri: string, index: number) => {
      const postKey = postUri;
      setGeneratingAltText((prev) => ({
        ...prev,
        [postKey]: { ...prev[postKey], [index]: true },
      }));
      try {
        // Pass the URL directly to the backend which will handle fetching
        const anthropicService = await loadAnthropicService();
        const altText = await anthropicService.generateAltText(imageUrl);

        setGeneratedAltTexts((prev) => ({
          ...prev,
          [postKey]: { ...prev[postKey], [index]: altText },
        }));
        setShowAltText((prev) => ({
          ...prev,
          [postKey]: { ...prev[postKey], [index]: true },
        }));
      } catch (error) {
        // Show user-friendly error message
        logger.error("Error generating alt text:", error);
        alert(
          error instanceof Error
            ? error.message
            : "Failed to generate alt text",
        );
      } finally {
        setGeneratingAltText((prev) => ({
          ...prev,
          [postKey]: { ...prev[postKey], [index]: false },
        }));
      }
    },
    [],
  );

  // Render embeds (images, videos, quotes, etc)
  const renderEmbed = useCallback(
    (embed: any, postUri?: string) => {
      if (!embed) return null;

      if (embed.$type === "app.bsky.embed.images#view") {
        const handleImageClick = (e: React.MouseEvent, index: number) => {
          e.stopPropagation();
          const images = embed.images.map((img: any) => ({
            thumb: proxifyBskyImage(img.thumb),
            fullsize: proxifyBskyImage(img.fullsize),
            alt: img.alt,
          }));
          setGalleryImages(images);
          setGalleryIndex(index);
        };

        return (
          <div
            className={`mt-2 grid gap-1 ${embed.images.length === 1 ? "max-w-2xl grid-cols-1" : embed.images.length === 2 ? "max-w-3xl grid-cols-2" : embed.images.length === 3 ? "max-w-3xl grid-cols-2" : "max-w-3xl grid-cols-2"}`}
          >
            {embed.images.map((img: any, idx: number) => {
              const postKey = postUri || "";
              const currentAltText =
                generatedAltTexts[postKey]?.[idx] || img.alt;
              const hasAltText = currentAltText && currentAltText.length > 0;
              const isGenerating = generatingAltText[postKey]?.[idx];
              const shouldShowAlt = showAltText[postKey]?.[idx];

              return (
                <div
                  key={idx}
                  className={`group relative cursor-pointer overflow-hidden rounded-lg transition-opacity hover:opacity-90 ${
                    embed.images.length === 3 && idx === 0 ? "col-span-2" : ""
                  }`}
                  onClick={(e) => handleImageClick(e, idx)}
                >
                  <img
                    src={proxifyBskyImage(img.thumb)}
                    alt={currentAltText || ""}
                    className="mx-auto h-auto w-full rounded-lg object-contain"
                    style={{
                      maxHeight: embed.images.length === 1 ? "400px" : "300px",
                      maxWidth: embed.images.length === 1 ? "600px" : "100%",
                      backgroundColor: "var(--bsky-bg-tertiary)",
                    }}
                  />

                  {/* Alt text overlay */}
                  {hasAltText && shouldShowAlt && (
                    <div className="absolute bottom-0 left-0 right-0 rounded-b-lg bg-black bg-opacity-70 p-2 text-xs text-white">
                      {currentAltText}
                    </div>
                  )}

                  {/* Alt text generation button */}
                  {postUri && (
                    <button
                      className="absolute right-2 top-2 z-10 rounded-full bg-black bg-opacity-60 p-1.5 text-white opacity-0 transition-all hover:bg-opacity-80 group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (hasAltText && !generatedAltTexts[postKey]?.[idx]) {
                          // Toggle showing existing alt text
                          setShowAltText((prev) => ({
                            ...prev,
                            [postKey]: {
                              ...prev[postKey],
                              [idx]: !shouldShowAlt,
                            },
                          }));
                        } else if (!hasAltText) {
                          // Generate new alt text
                          handleGenerateAltText(
                            proxifyBskyImage(img.fullsize) ||
                              proxifyBskyImage(img.thumb) ||
                              "",
                            postUri,
                            idx,
                          );
                        }
                      }}
                      disabled={isGenerating}
                      title={
                        hasAltText ? "Toggle alt text" : "Generate alt text"
                      }
                    >
                      {isGenerating ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      ) : (
                        <Sparkles size={16} />
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        );
      }

      if (embed.$type === "app.bsky.embed.external#view") {
        return (
          <div
            className="mt-2 cursor-pointer rounded-lg border p-2 text-xs transition-colors hover:bg-blue-500 hover:bg-opacity-5"
            style={{ borderColor: "var(--bsky-border-primary)" }}
            onClick={(e) => {
              e.stopPropagation();
              if (embed.external.uri) {
                window.open(
                  embed.external.uri,
                  "_blank",
                  "noopener,noreferrer",
                );
              }
            }}
          >
            {embed.external.thumb && (
              <img
                src={proxifyBskyImage(embed.external.thumb)}
                alt=""
                className="mb-1 h-auto w-full rounded object-contain"
                style={{
                  maxHeight: "200px",
                  backgroundColor: "var(--bsky-bg-tertiary)",
                }}
              />
            )}
            <div
              className="font-semibold"
              style={{ color: "var(--bsky-text-primary)" }}
            >
              {embed.external.title}
            </div>
            <div
              className="mt-0.5 opacity-80"
              style={{ color: "var(--bsky-text-secondary)" }}
            >
              {embed.external.description}
            </div>
          </div>
        );
      }

      if (embed.$type === "app.bsky.embed.video#view") {
        return (
          <div className="mt-2" onClick={(e) => e.stopPropagation()}>
            <VideoPlayer
              src={proxifyBskyVideo(embed.playlist) || ""}
              thumbnail={
                embed.thumbnail ? proxifyBskyVideo(embed.thumbnail) : undefined
              }
              aspectRatio={embed.aspectRatio}
              alt={embed.alt}
            />
          </div>
        );
      }

      // Handle quote posts
      if (embed.$type === "app.bsky.embed.record#view") {
        const quotedPost = embed.record;
        if (quotedPost?.$type === "app.bsky.embed.record#viewRecord") {
          return (
            <div
              className="mt-2 rounded-lg border p-2 text-xs"
              style={{ borderColor: "var(--bsky-border-primary)" }}
            >
              <div className="mb-1 flex items-center gap-1">
                {quotedPost.author?.handle ? (
                  <ProfileHoverCard handle={quotedPost.author.handle}>
                    <img
                      src={
                        proxifyBskyImage(quotedPost.author.avatar) ||
                        "/default-avatar.svg"
                      }
                      alt={quotedPost.author?.handle || "unknown"}
                      className="h-4 w-4 cursor-pointer rounded-full transition-opacity hover:opacity-80"
                    />
                  </ProfileHoverCard>
                ) : (
                  <img
                    src={
                      proxifyBskyImage(quotedPost.author?.avatar) ||
                      "/default-avatar.svg"
                    }
                    alt={quotedPost.author?.handle || "unknown"}
                    className="h-4 w-4 rounded-full"
                  />
                )}
                {quotedPost.author?.handle ? (
                  <ProfileHoverCard handle={quotedPost.author.handle}>
                    <span
                      className="cursor-pointer font-semibold hover:underline"
                      style={{ color: "var(--bsky-text-primary)" }}
                    >
                      {quotedPost.author?.displayName ||
                        quotedPost.author?.handle ||
                        "Unknown"}
                    </span>
                  </ProfileHoverCard>
                ) : (
                  <span
                    className="font-semibold"
                    style={{ color: "var(--bsky-text-primary)" }}
                  >
                    {quotedPost.author?.displayName ||
                      quotedPost.author?.handle ||
                      "Unknown"}
                  </span>
                )}
                {quotedPost.author?.handle ? (
                  <ProfileHoverCard handle={quotedPost.author.handle}>
                    <span
                      className="cursor-pointer hover:underline"
                      style={{ color: "var(--bsky-text-secondary)" }}
                    >
                      @{quotedPost.author?.handle || "unknown"}
                    </span>
                  </ProfileHoverCard>
                ) : (
                  <span style={{ color: "var(--bsky-text-secondary)" }}>
                    @{quotedPost.author?.handle || "unknown"}
                  </span>
                )}
              </div>
              <div style={{ color: "var(--bsky-text-primary)" }}>
                <RichText
                  text={quotedPost.value?.text || ""}
                  facets={quotedPost.value?.facets}
                />
              </div>
            </div>
          );
        }
      }

      // Handle record with media
      if (embed.$type === "app.bsky.embed.recordWithMedia#view") {
        return (
          <div className="mt-2">
            {embed.media && renderEmbed(embed.media, postUri)}
            {embed.record && renderEmbed(embed.record, postUri)}
          </div>
        );
      }

      return null;
    },
    [
      generatedAltTexts,
      generatingAltText,
      showAltText,
      handleGenerateAltText,
      setGalleryImages,
      setGalleryIndex,
      setShowAltText,
    ],
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

        // Calculate if this branch should be collapsed
        const hasMultipleChildren = node.children.length > maxInitialReplies;
        const isExpanded = expandedBranches.has(nodeUri);
        const visibleChildren =
          hasMultipleChildren && !isExpanded
            ? node.children.slice(0, maxInitialReplies)
            : node.children;
        const hiddenCount = hasMultipleChildren
          ? node.children.length - maxInitialReplies
          : 0;

        // Count branches at this level
        const hasBranches = node.children.length > 1;

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
            {/* Thread line connector for nested replies */}
            {node.depth > 0 && (
              <div className="flex">
                <div
                  className="flex w-8 flex-shrink-0 justify-center"
                  style={{
                    marginLeft: `calc(${node.depth - 1} * ${indentCssVar})`,
                  }}
                >
                  <div
                    className="-mt-6 h-6 w-0.5"
                    style={{ backgroundColor: "var(--bsky-border-primary)" }}
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
              {/* Branch indicator */}
              {node.depth > 0 && (maxThreadDepth <= 15 || node.depth < 10) && (
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
                      color: "var(--bsky-text-tertiary)",
                      opacity:
                        maxThreadDepth > 15
                          ? 0.3
                          : maxThreadDepth > 10
                            ? 0.5
                            : 0.7,
                    }}
                  />
                </div>
              )}

              {/* Post card */}
              <div
                className={`min-w-0 flex-1 ${maxThreadDepth > 15 ? "p-2" : maxThreadDepth > 10 ? "p-3" : "p-4"} cursor-pointer rounded-lg transition-all hover:bg-blue-500 hover:bg-opacity-5 ${
                  isUnread ? "ring-2 ring-blue-500 ring-opacity-30" : ""
                } ${isHighlighted && !hasShownInitialHighlight ? "ring-2 ring-orange-500 ring-opacity-50" : ""} ${
                  isFocused ? "ring-2 ring-blue-400 ring-opacity-70" : ""
                } ${isCurrentUser ? "border-l-4" : ""}`}
                style={{
                  backgroundColor: isCurrentUser
                    ? "rgba(34, 197, 94, 0.08)" // Green tint for user's posts
                    : isHighlighted && !hasShownInitialHighlight
                      ? "rgba(251, 146, 60, 0.1)" // Orange highlight background (only initially)
                      : node.isRoot
                        ? "var(--bsky-bg-secondary)"
                        : isUnread
                          ? "var(--bsky-bg-primary)"
                          : "var(--bsky-bg-secondary)",
                  borderColor: isCurrentUser
                    ? "rgb(34, 197, 94)" // Green left border for user's posts
                    : undefined,
                  border:
                    isHighlighted && !hasShownInitialHighlight
                      ? "2px solid rgba(251, 146, 60, 0.5)"
                      : isCurrentUser
                        ? undefined
                        : "1px solid var(--bsky-border-primary)",
                  borderLeft: isCurrentUser
                    ? "4px solid rgb(34, 197, 94)"
                    : undefined,
                  borderTop: isCurrentUser
                    ? "1px solid var(--bsky-border-primary)"
                    : undefined,
                  borderRight: isCurrentUser
                    ? "1px solid var(--bsky-border-primary)"
                    : undefined,
                  borderBottom: isCurrentUser
                    ? "1px solid var(--bsky-border-primary)"
                    : undefined,
                  overflow: "hidden",
                  fontSize:
                    maxThreadDepth > 15
                      ? "0.75rem"
                      : maxThreadDepth > 10
                        ? "0.875rem"
                        : "1rem",
                  outline: isFocused
                    ? "2px solid rgb(96, 165, 250)"
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
                          backgroundColor: "var(--bsky-bg-primary)",
                          color: "var(--bsky-text-secondary)",
                          border: "1px solid var(--bsky-border-primary)",
                        }}
                      >
                        Original Post
                      </span>
                    )}
                    {isCurrentUser && !node.isRoot && (
                      <span
                        className="flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium"
                        style={{
                          backgroundColor: "rgba(34, 197, 94, 0.15)",
                          color: "rgb(34, 197, 94)",
                          border: "1px solid rgba(34, 197, 94, 0.3)",
                        }}
                      >
                        <User size={10} />
                        Your reply
                      </span>
                    )}
                    {hasBranches && (
                      <span
                        className="flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium"
                        style={{
                          backgroundColor: "rgba(147, 51, 234, 0.1)",
                          color: "rgb(147, 51, 234)",
                          border: "1px solid rgba(147, 51, 234, 0.2)",
                        }}
                      >
                        <GitBranch size={10} />
                        {node.children.length} branches
                      </span>
                    )}
                    {node.depth > 5 && !node.isRoot && (
                      <span
                        className="rounded px-2 py-0.5 text-xs font-medium"
                        style={{
                          backgroundColor: "var(--bsky-bg-tertiary)",
                          color: "var(--bsky-text-tertiary)",
                          opacity: 0.8,
                        }}
                      >
                        Depth: {node.depth}
                      </span>
                    )}
                    {isHighlighted &&
                      hasShownInitialHighlight &&
                      !node.isRoot && (
                        <span
                          className="flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium"
                          style={{
                            backgroundColor: "rgba(251, 146, 60, 0.1)",
                            color: "rgb(251, 146, 60)",
                            border: "1px solid rgba(251, 146, 60, 0.3)",
                          }}
                        >
                          <ExternalLink size={10} />
                          Opened here
                        </span>
                      )}
                    {post && node.isRoot && (
                      <span
                        className="rounded px-2 py-1 text-xs"
                        style={{
                          color: "var(--bsky-text-tertiary)",
                          backgroundColor: "var(--bsky-bg-primary)",
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
                    {author?.avatar ? (
                      <img
                        src={proxifyBskyImage(author.avatar)}
                        alt={author.handle}
                        className={`${maxThreadDepth > 15 ? "h-6 w-6" : maxThreadDepth > 10 ? "h-8 w-8" : "h-10 w-10"} cursor-pointer rounded-full object-cover transition-opacity hover:opacity-80`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (author.handle) {
                            navigate(`/profile/${author.handle}`);
                          }
                        }}
                      />
                    ) : (
                      <div
                        className={`${maxThreadDepth > 15 ? "h-6 w-6" : maxThreadDepth > 10 ? "h-8 w-8" : "h-10 w-10"} flex cursor-pointer items-center justify-center rounded-full transition-opacity hover:opacity-80`}
                        style={{ background: "var(--bsky-bg-tertiary)" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (author?.handle) {
                            navigate(`/profile/${author.handle}`);
                          }
                        }}
                      >
                        <span
                          className={`${maxThreadDepth > 15 ? "text-xs" : "text-sm"} font-semibold`}
                        >
                          {author?.handle?.charAt(0).toUpperCase() || "U"}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center justify-between">
                      <div className="flex min-w-0 items-center gap-1">
                        {author?.handle ? (
                          <ProfileHoverCard handle={author.handle}>
                            <span
                              className="cursor-pointer truncate text-sm font-semibold hover:underline"
                              style={{ color: "var(--bsky-text-primary)" }}
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
                            style={{ color: "var(--bsky-text-primary)" }}
                          >
                            {author?.displayName || author?.handle || "Unknown"}
                          </span>
                        )}
                        {author?.handle ? (
                          <ProfileHoverCard handle={author.handle}>
                            <span
                              className="flex-shrink-0 cursor-pointer text-xs hover:underline"
                              style={{ color: "var(--bsky-text-secondary)" }}
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
                            style={{ color: "var(--bsky-text-secondary)" }}
                          >
                            @{author?.handle || "unknown"}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <time
                          className="rounded px-2 py-1 text-xs"
                          style={{
                            color: "var(--bsky-text-tertiary)",
                            backgroundColor: "var(--bsky-bg-primary)",
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
                              style={{ color: "var(--bsky-text-tertiary)" }}
                            />
                          </button>
                        )}
                      </div>
                    </div>

                    <p
                      className="overflow-wrap-anywhere break-words text-sm"
                      style={{
                        color: "var(--bsky-text-primary)",
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
                        <span style={{ color: "var(--bsky-text-secondary)" }}>
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
                          backgroundColor: "var(--bsky-primary)",
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
                          color: "var(--bsky-error, #ef4444)",
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

            {/* Render children */}
            {visibleChildren.length > 0 && (
              <div>{renderThreadNodes(visibleChildren)}</div>
            )}

            {/* Load more replies button */}
            {hasMultipleChildren && !isExpanded && hiddenCount > 0 && (
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
                      containerRef.current?.closest(".bsky-scrollbar");
                    const scrollTop = scrollContainer?.scrollTop || 0;

                    toggleBranch(nodeUri);

                    // Restore scroll position after expansion
                    requestAnimationFrame(() => {
                      if (scrollContainer) {
                        scrollContainer.scrollTop = scrollTop;
                      }
                    });
                  }}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all hover:bg-blue-500 hover:bg-opacity-10"
                  style={{
                    backgroundColor: "var(--bsky-bg-tertiary)",
                    color: "var(--bsky-primary)",
                    border: "1px solid var(--bsky-border-primary)",
                  }}
                >
                  <ChevronDown size={16} />
                  Load {hiddenCount} more{" "}
                  {hiddenCount === 1 ? "reply" : "replies"}
                </button>
              </div>
            )}

            {/* Collapse button when expanded */}
            {hasMultipleChildren && isExpanded && hiddenCount > 0 && (
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
                      const postEl = postRefs.current.get(node.flatIndex || 0);
                      if (postEl) {
                        postEl.scrollIntoView({
                          behavior: "smooth",
                          block: "center",
                        });
                      }
                    });
                  }}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all hover:bg-blue-500 hover:bg-opacity-10"
                  style={{
                    backgroundColor: "var(--bsky-bg-tertiary)",
                    color: "var(--bsky-text-secondary)",
                    border: "1px solid var(--bsky-border-primary)",
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
      toggleBranch,
      setFocusedPostIndex,
      onDeletePost,
    ],
  );

  // Render a single node for virtualized list (no recursive children rendering)
  const renderSingleNode = useCallback(
    (
      node: ThreadNode,
      index: number,
      _virtualItem: VirtualItem,
    ): React.ReactNode => {
      const post = node.post;
      const notification = node.notification;
      const isUnread =
        showUnreadIndicators && notification && !notification.isRead;
      const isHighlighted = highlightUri && post?.uri === highlightUri;
      const author = post?.author || notification?.author;
      const isCurrentUser = currentUserDid && author?.did === currentUserDid;
      const isFocused = index === focusedPostIndex;
      const hasBranches = node.children.length > 1;

      // Generate external bsky.app URL
      const postUrl =
        post?.uri && author?.handle
          ? (() => {
              const postId = post.uri.split("/").pop();
              return `https://bsky.app/profile/${author.handle}/post/${postId}`;
            })()
          : null;

      return (
        <div
          className="mb-2"
          ref={(el) => {
            if (isHighlighted && highlightRef) {
              (
                highlightRef as React.MutableRefObject<HTMLDivElement | null>
              ).current = el;
            }
            if (index !== undefined && el) {
              postRefs.current.set(index, el);
            }
          }}
        >
          {/* Thread line connector for nested replies */}
          {node.depth > 0 && (
            <div className="flex">
              <div
                className="flex w-8 flex-shrink-0 justify-center"
                style={{
                  marginLeft: `calc(${node.depth - 1} * ${indentCssVar})`,
                }}
              >
                <div
                  className="-mt-4 h-4 w-0.5"
                  style={{ backgroundColor: "var(--bsky-border-primary)" }}
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
            {/* Branch indicator */}
            {node.depth > 0 && (maxThreadDepth <= 15 || node.depth < 10) && (
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
                  size={maxThreadDepth > 10 ? 10 : maxThreadDepth > 7 ? 12 : 16}
                  style={{
                    color: "var(--bsky-text-tertiary)",
                    opacity:
                      maxThreadDepth > 15
                        ? 0.3
                        : maxThreadDepth > 10
                          ? 0.5
                          : 0.7,
                  }}
                />
              </div>
            )}

            {/* Post card */}
            <div
              className={`min-w-0 flex-1 ${maxThreadDepth > 15 ? "p-2" : maxThreadDepth > 10 ? "p-3" : "p-4"} cursor-pointer rounded-lg transition-all hover:bg-blue-500 hover:bg-opacity-5 ${
                isUnread ? "ring-2 ring-blue-500 ring-opacity-30" : ""
              } ${isHighlighted && !hasShownInitialHighlight ? "ring-2 ring-orange-500 ring-opacity-50" : ""} ${
                isFocused ? "ring-2 ring-blue-400 ring-opacity-70" : ""
              } ${isCurrentUser ? "border-l-4" : ""}`}
              style={{
                backgroundColor: isCurrentUser
                  ? "rgba(34, 197, 94, 0.08)"
                  : isHighlighted && !hasShownInitialHighlight
                    ? "rgba(251, 146, 60, 0.1)"
                    : node.isRoot
                      ? "var(--bsky-bg-secondary)"
                      : isUnread
                        ? "var(--bsky-bg-primary)"
                        : "var(--bsky-bg-secondary)",
                borderColor: isCurrentUser ? "rgb(34, 197, 94)" : undefined,
                border:
                  isHighlighted && !hasShownInitialHighlight
                    ? "2px solid rgba(251, 146, 60, 0.5)"
                    : isCurrentUser
                      ? undefined
                      : "1px solid var(--bsky-border-primary)",
                borderLeft: isCurrentUser
                  ? "4px solid rgb(34, 197, 94)"
                  : undefined,
                borderTop: isCurrentUser
                  ? "1px solid var(--bsky-border-primary)"
                  : undefined,
                borderRight: isCurrentUser
                  ? "1px solid var(--bsky-border-primary)"
                  : undefined,
                borderBottom: isCurrentUser
                  ? "1px solid var(--bsky-border-primary)"
                  : undefined,
                overflow: "hidden",
                fontSize:
                  maxThreadDepth > 15
                    ? "0.75rem"
                    : maxThreadDepth > 10
                      ? "0.875rem"
                      : "1rem",
                outline: isFocused ? "2px solid rgb(96, 165, 250)" : undefined,
                outlineOffset: isFocused ? "2px" : undefined,
              }}
              onClick={(e) => {
                if (index !== undefined) {
                  setFocusedPostIndex(index);
                }
                e.stopPropagation();
              }}
              onKeyDown={(e) => {
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
                        backgroundColor: "var(--bsky-bg-primary)",
                        color: "var(--bsky-text-secondary)",
                        border: "1px solid var(--bsky-border-primary)",
                      }}
                    >
                      Original Post
                    </span>
                  )}
                  {isCurrentUser && !node.isRoot && (
                    <span
                      className="flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium"
                      style={{
                        backgroundColor: "rgba(34, 197, 94, 0.15)",
                        color: "rgb(34, 197, 94)",
                        border: "1px solid rgba(34, 197, 94, 0.3)",
                      }}
                    >
                      <User size={10} />
                      Your reply
                    </span>
                  )}
                  {hasBranches && (
                    <span
                      className="flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium"
                      style={{
                        backgroundColor: "rgba(147, 51, 234, 0.1)",
                        color: "rgb(147, 51, 234)",
                        border: "1px solid rgba(147, 51, 234, 0.2)",
                      }}
                    >
                      <GitBranch size={10} />
                      {node.children.length} branches
                    </span>
                  )}
                  {node.depth > 5 && !node.isRoot && (
                    <span
                      className="rounded px-2 py-0.5 text-xs font-medium"
                      style={{
                        backgroundColor: "var(--bsky-bg-tertiary)",
                        color: "var(--bsky-text-tertiary)",
                        opacity: 0.8,
                      }}
                    >
                      Depth: {node.depth}
                    </span>
                  )}
                  {isHighlighted &&
                    hasShownInitialHighlight &&
                    !node.isRoot && (
                      <span
                        className="flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium"
                        style={{
                          backgroundColor: "rgba(251, 146, 60, 0.1)",
                          color: "rgb(251, 146, 60)",
                          border: "1px solid rgba(251, 146, 60, 0.3)",
                        }}
                      >
                        <ExternalLink size={10} />
                        Opened here
                      </span>
                    )}
                  {post && node.isRoot && (
                    <span
                      className="rounded px-2 py-1 text-xs"
                      style={{
                        color: "var(--bsky-text-tertiary)",
                        backgroundColor: "var(--bsky-bg-primary)",
                      }}
                    >
                      {formatDistanceToNow(
                        new Date(
                          (post.record as { createdAt?: string })?.createdAt ||
                            post.indexedAt,
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
                  {author?.avatar ? (
                    <img
                      src={proxifyBskyImage(author.avatar)}
                      alt={author.handle}
                      className={`${maxThreadDepth > 15 ? "h-6 w-6" : maxThreadDepth > 10 ? "h-8 w-8" : "h-10 w-10"} cursor-pointer rounded-full object-cover transition-opacity hover:opacity-80`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (author.handle) {
                          navigate(`/profile/${author.handle}`);
                        }
                      }}
                    />
                  ) : (
                    <div
                      className={`${maxThreadDepth > 15 ? "h-6 w-6" : maxThreadDepth > 10 ? "h-8 w-8" : "h-10 w-10"} flex cursor-pointer items-center justify-center rounded-full transition-opacity hover:opacity-80`}
                      style={{ background: "var(--bsky-bg-tertiary)" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (author?.handle) {
                          navigate(`/profile/${author.handle}`);
                        }
                      }}
                    >
                      <span
                        className={`${maxThreadDepth > 15 ? "text-xs" : "text-sm"} font-semibold`}
                      >
                        {author?.handle?.charAt(0).toUpperCase() || "U"}
                      </span>
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center justify-between">
                    <div className="flex min-w-0 items-center gap-1">
                      {author?.handle ? (
                        <ProfileHoverCard handle={author.handle}>
                          <span
                            className="cursor-pointer truncate text-sm font-semibold hover:underline"
                            style={{ color: "var(--bsky-text-primary)" }}
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/profile/${author.handle}`);
                            }}
                          >
                            {author?.displayName || author?.handle || "Unknown"}
                          </span>
                        </ProfileHoverCard>
                      ) : (
                        <span
                          className="truncate text-sm font-semibold"
                          style={{ color: "var(--bsky-text-primary)" }}
                        >
                          {author?.displayName || author?.handle || "Unknown"}
                        </span>
                      )}
                      {author?.handle ? (
                        <ProfileHoverCard handle={author.handle}>
                          <span
                            className="flex-shrink-0 cursor-pointer text-xs hover:underline"
                            style={{ color: "var(--bsky-text-secondary)" }}
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
                          style={{ color: "var(--bsky-text-secondary)" }}
                        >
                          @{author?.handle || "unknown"}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <time
                        className="rounded px-2 py-1 text-xs"
                        style={{
                          color: "var(--bsky-text-tertiary)",
                          backgroundColor: "var(--bsky-bg-primary)",
                        }}
                      >
                        {formatDistanceToNow(
                          new Date(
                            (post?.record as { createdAt?: string })
                              ?.createdAt ||
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
                            style={{ color: "var(--bsky-text-tertiary)" }}
                          />
                        </button>
                      )}
                    </div>
                  </div>

                  <p
                    className="overflow-wrap-anywhere break-words text-sm"
                    style={{
                      color: "var(--bsky-text-primary)",
                      lineHeight: "1.5",
                      wordBreak: "break-word",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {post ? (
                      <RichText
                        text={
                          (post.record as { text?: string })?.text ||
                          "[No text]"
                        }
                        facets={
                          (
                            post.record as {
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
                    ) : (
                      <span style={{ color: "var(--bsky-text-secondary)" }}>
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
                        backgroundColor: "var(--bsky-primary)",
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
                      onPostClick?.(post, "reply");
                    }}
                    onRepost={() => handleRepost(post)}
                    onQuote={() => {
                      onPostClick?.(post, "quote");
                    }}
                    onLike={() => handleLike(post)}
                    showCounts={true}
                    size={maxThreadDepth > 10 ? "small" : "medium"}
                    isReplying={false}
                  />
                  {isCurrentUser && onDeletePost && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeletePost(post);
                      }}
                      className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-all hover:bg-red-500 hover:bg-opacity-10"
                      style={{
                        color: "var(--bsky-error, #ef4444)",
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
        </div>
      );
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
      setFocusedPostIndex,
      onDeletePost,
    ],
  );

  return (
    <>
      <div ref={containerRef} className={`thread-viewer ${className}`}>
        {/* Keyboard navigation hint and thread stats */}
        {enableKeyboardNavigation && flatNodeList.length > 1 && (
          <div
            className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs"
            style={{
              backgroundColor: "var(--bsky-bg-tertiary)",
              color: "var(--bsky-text-secondary)",
              border: "1px solid var(--bsky-border-primary)",
            }}
          >
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-1">
                <kbd className="rounded bg-gray-200 px-1.5 py-0.5 font-mono text-xs dark:bg-gray-700">
                  ↑↓
                </kbd>
                <span>Navigate</span>
              </span>
              {userParticipationStats.count > 0 && (
                <span className="flex items-center gap-1">
                  <kbd className="rounded bg-gray-200 px-1.5 py-0.5 font-mono text-xs dark:bg-gray-700">
                    n/p
                  </kbd>
                  <span>Jump to your posts</span>
                </span>
              )}
              <span className="flex items-center gap-1">
                <kbd className="rounded bg-gray-200 px-1.5 py-0.5 font-mono text-xs dark:bg-gray-700">
                  Enter
                </kbd>
                <span>Reply</span>
              </span>
            </div>
            <div className="flex items-center gap-3">
              {userParticipationStats.count > 0 && (
                <span
                  className="flex items-center gap-1 rounded-full px-2 py-0.5"
                  style={{
                    backgroundColor: "rgba(34, 197, 94, 0.15)",
                    color: "rgb(34, 197, 94)",
                  }}
                >
                  <User size={12} />
                  {userParticipationStats.count} of your{" "}
                  {userParticipationStats.count === 1 ? "post" : "posts"}
                </span>
              )}
              <span>{flatNodeList.length} posts in thread</span>
            </div>
          </div>
        )}

        {threadTree.length > 0 ? (
          shouldVirtualize ? (
            <VirtualizedThreadList
              ref={virtualListRef}
              nodes={flatNodeList}
              focusedIndex={focusedPostIndex}
              onFocusedIndexChange={setFocusedPostIndex}
              renderNode={renderSingleNode}
              config={mergedVirtualConfig}
              className="thread-list-virtualized"
            />
          ) : (
            renderThreadNodes(threadTree)
          )
        ) : (
          <div className="p-8 text-center">
            <p style={{ color: "var(--bsky-text-secondary)" }}>
              No posts to display
            </p>
          </div>
        )}

        {/* Continue Thread button - shown when user has posts in the thread */}
        {onContinueThread && userParticipationStats.count > 0 && (
          <div className="mt-6 flex justify-center">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onContinueThread();
              }}
              className="flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium transition-all hover:scale-105"
              style={{
                backgroundColor: "var(--bsky-primary)",
                color: "white",
                boxShadow: "0 4px 12px rgba(59, 130, 246, 0.3)",
              }}
            >
              <Plus size={18} />
              Continue Thread
            </button>
          </div>
        )}

        {/* Alternative: Add reply button when user doesn't have posts yet */}
        {onContinueThread &&
          userParticipationStats.count === 0 &&
          posts.length > 0 && (
            <div className="mt-6 flex justify-center">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  // For non-participants, clicking this will reply to the last post
                  const lastPost = posts[posts.length - 1];
                  if (lastPost) {
                    onPostClick?.(lastPost, "reply");
                  }
                }}
                className="flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-all hover:scale-105"
                style={{
                  backgroundColor: "var(--bsky-bg-secondary)",
                  borderColor: "var(--bsky-border-primary)",
                  color: "var(--bsky-text-primary)",
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
