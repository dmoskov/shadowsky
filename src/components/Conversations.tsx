import type { AppBskyFeedDefs } from "@atproto/api";
import type { Notification } from "@atproto/api/dist/client/types/app/bsky/notification/listNotifications";
import { debug } from "@bsky/shared";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowLeft,
  ChevronDown,
  CornerDownRight,
  ExternalLink,
  Loader2,
  MessageCircle,
  Search,
  Users,
} from "lucide-react";
import React, { useMemo, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNotificationPosts } from "../hooks/useNotificationPosts";
import { usePostsByUris } from "../hooks/usePostsByUris";
import { useReplyNotificationsFromCache } from "../hooks/useReplyNotificationsFromCache";
import { proxifyBskyImage } from "../utils/image-proxy";
import { atUriToBskyUrl, getNotificationUrl } from "../utils/url-helpers";

type Post = AppBskyFeedDefs.PostView;

// Component to render quote post embeds
const QuoteEmbed: React.FC<{ embed: any }> = ({ embed }) => {
  if (!embed || embed.$type !== "app.bsky.embed.record#view") return null;

  const record = embed.record;
  if (record.$type !== "app.bsky.embed.record#viewRecord") {
    // Handle deleted or blocked posts
    return (
      <div
        className="mt-2 rounded-lg p-3"
        style={{
          backgroundColor: "var(--bsky-bg-tertiary)",
          border: "1px solid var(--bsky-border-primary)",
        }}
      >
        <p
          className="text-sm italic"
          style={{ color: "var(--bsky-text-tertiary)" }}
        >
          {record.$type === "app.bsky.embed.record#viewBlocked"
            ? "Blocked post"
            : "Post not found"}
        </p>
      </div>
    );
  }

  const quotedPost = record as any;
  const author = quotedPost.author;
  const postRecord = quotedPost.value;

  return (
    <div
      className="mt-2 cursor-pointer overflow-hidden rounded-lg transition-all hover:bg-blue-500 hover:bg-opacity-5"
      style={{
        backgroundColor: "var(--bsky-bg-tertiary)",
        border: "1px solid var(--bsky-border-primary)",
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (quotedPost.uri && author?.handle) {
          const url = atUriToBskyUrl(quotedPost.uri, author.handle);
          if (url) {
            window.open(url, "_blank", "noopener,noreferrer");
          }
        }
      }}
    >
      <div className="p-3">
        {/* Mini header */}
        <div className="mb-2 flex items-center gap-2">
          {author?.avatar ? (
            <img
              src={proxifyBskyImage(author.avatar)}
              alt={author.handle}
              className="h-4 w-4 rounded-full object-cover"
            />
          ) : (
            <div
              className="flex h-4 w-4 items-center justify-center rounded-full"
              style={{ backgroundColor: "var(--bsky-bg-secondary)" }}
            >
              <span className="text-xs">
                {author?.handle?.charAt(0) || "U"}
              </span>
            </div>
          )}
          <div className="flex min-w-0 items-baseline gap-1 text-xs">
            <span
              className="truncate font-medium"
              style={{ color: "var(--bsky-text-primary)" }}
            >
              {author?.displayName || author?.handle}
            </span>
            <span
              className="truncate"
              style={{ color: "var(--bsky-text-secondary)" }}
            >
              @{author?.handle}
            </span>
          </div>
        </div>

        {/* Quote content */}
        {postRecord?.text && (
          <p
            className="whitespace-pre-wrap break-words text-sm"
            style={{ color: "var(--bsky-text-secondary)", lineHeight: "1.4" }}
          >
            {postRecord.text}
          </p>
        )}
      </div>
    </div>
  );
};

interface ConversationThread {
  rootUri: string;
  rootPost?: Post;
  replies: Notification[];
  participants: Set<string>;
  latestReply: Notification;
  totalReplies: number;
  originalPostTime?: string;
}

interface ThreadNode {
  notification?: Notification;
  post?: Post;
  children: ThreadNode[];
  depth: number;
  isRoot?: boolean;
}

export const Conversations: React.FC = () => {
  useAuth();
  const [selectedConvo, setSelectedConvo] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const threadContainerRef = useRef<HTMLDivElement>(null);

  // Use the cache-aware hook which automatically checks extended notifications cache
  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFromCache,
  } = useReplyNotificationsFromCache();

  // Extract reply notifications from the data
  const replyNotifications = React.useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((page: any) => page.notifications);
  }, [data]);

  // Fetch posts for the reply notifications
  const {
    data: posts,
    isLoading: isLoadingPosts,
    percentageFetched: postsPercentageFetched,
  } = useNotificationPosts(replyNotifications);

  // Create initial map for reply posts
  const replyPostMap = React.useMemo(() => {
    if (!posts || !Array.isArray(posts) || posts.length === 0) return new Map();
    return new Map(posts.map((post: Post) => [post.uri, post]));
  }, [posts]);

  // Collect unique root post URIs that need to be fetched
  const rootPostUris = React.useMemo(() => {
    const rootUris = new Set<string>();

    replyNotifications.forEach((notification: Notification) => {
      // Get the root post URI from the notification
      let rootUri = notification.reasonSubject || notification.uri;

      // If this is a reply, try to find the actual root of the thread
      const post = replyPostMap.get(notification.uri);
      const record = post?.record as any;
      if (record?.reply?.root?.uri) {
        rootUri = record.reply.root.uri;
      }

      // Only add if we don't already have this post
      if (rootUri && !replyPostMap.has(rootUri)) {
        rootUris.add(rootUri);
      }
    });

    return Array.from(rootUris);
  }, [replyNotifications, replyPostMap]);

  // Fetch the root posts that we don't have
  const { data: rootPosts, isLoading: isLoadingRootPosts } =
    usePostsByUris(rootPostUris);

  // Create combined map with all posts (replies + roots)
  const postMap = React.useMemo(() => {
    const map = new Map<string, Post>();

    // Add reply posts
    if (posts && Array.isArray(posts) && posts.length > 0) {
      posts.forEach((post: Post) => {
        if (post && post.uri) {
          map.set(post.uri, post);
        }
      });
    }

    // Add root posts
    if (rootPosts && rootPosts.length > 0) {
      rootPosts.forEach((post) => {
        if (post && post.uri) {
          map.set(post.uri, post);
        }
      });
    }

    return map;
  }, [posts, rootPosts]);

  // Add debug logging
  React.useEffect(() => {
    debug.log("[Conversations] Loading state:", {
      isLoading,
      isLoadingPosts,
      isLoadingRootPosts,
      isFromCache,
      hasData: !!data,
      pageCount: data?.pages?.length,
      notificationCount: replyNotifications.length,
      postCount: Array.isArray(posts) ? posts.length : 0,
      rootPostCount: Array.isArray(rootPosts) ? rootPosts.length : 0,
    });
  }, [
    isLoading,
    isLoadingPosts,
    isLoadingRootPosts,
    isFromCache,
    data,
    replyNotifications.length,
    posts,
    rootPosts,
  ]);

  // Group notifications into conversation threads
  const conversations = useMemo(() => {
    const threadMap = new Map<string, ConversationThread>();

    replyNotifications.forEach((notification: Notification) => {
      // Get the root post URI from the notification
      let rootUri = notification.reasonSubject || notification.uri;

      // If this is a reply, try to find the actual root of the thread
      const post = postMap.get(notification.uri);
      const record = post?.record as any;
      if (record?.reply?.root?.uri) {
        rootUri = record.reply.root.uri;
      }

      if (!threadMap.has(rootUri)) {
        const rootPost = postMap.get(rootUri);
        threadMap.set(rootUri, {
          rootUri,
          rootPost,
          replies: [],
          participants: new Set(),
          latestReply: notification,
          totalReplies: 0,
          originalPostTime:
            rootPost?.indexedAt || (rootPost?.record as any)?.createdAt,
        });
      }

      const thread = threadMap.get(rootUri)!;
      thread.replies.push(notification);
      if (notification.author?.handle) {
        thread.participants.add(notification.author.handle);
      }
      thread.totalReplies++;

      // Update latest reply if this one is newer
      if (
        new Date(notification.indexedAt) >
        new Date(thread.latestReply.indexedAt)
      ) {
        thread.latestReply = notification;
      }
    });

    // Sort conversations by latest activity
    return Array.from(threadMap.values()).sort(
      (a, b) =>
        new Date(b.latestReply.indexedAt).getTime() -
        new Date(a.latestReply.indexedAt).getTime(),
    );
  }, [replyNotifications, postMap]);

  // Filter conversations based on search
  const filteredConversations = useMemo(() => {
    if (!searchQuery) return conversations;

    return conversations.filter((convo) => {
      // Search in participants
      const participantMatch = Array.from(convo.participants).some((handle) =>
        handle.toLowerCase().includes(searchQuery.toLowerCase()),
      );

      // Search in root post text if available
      const rootRecord = convo.rootPost?.record as any;
      const rootPostMatch = rootRecord?.text
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase());

      // Search in reply text
      const replyMatch = convo.replies.some((reply) => {
        const replyPost = postMap.get(reply.uri);
        const replyRecord = replyPost?.record as any;
        return replyRecord?.text
          ?.toLowerCase()
          .includes(searchQuery.toLowerCase());
      });

      return participantMatch || rootPostMatch || replyMatch;
    });
  }, [conversations, searchQuery, postMap]);

  // Get the selected conversation
  const selectedConversation = useMemo(() => {
    return conversations.find((c) => c.rootUri === selectedConvo);
  }, [conversations, selectedConvo]);

  // Build thread tree structure for the selected conversation
  const threadTree = useMemo(() => {
    if (!selectedConversation) return null;

    const nodeMap = new Map<string, ThreadNode>();
    const rootNodes: ThreadNode[] = [];

    // Create root node if we have the root post
    if (selectedConversation.rootPost) {
      const rootNode: ThreadNode = {
        post: selectedConversation.rootPost,
        children: [],
        depth: 0,
        isRoot: true,
      };
      nodeMap.set(selectedConversation.rootUri, rootNode);
      rootNodes.push(rootNode);
    } else {
      // If we don't have the root post yet, create a placeholder
      // This prevents the first reply from being shown as root
      const rootNode: ThreadNode = {
        post: undefined,
        children: [],
        depth: 0,
        isRoot: true,
      };
      nodeMap.set(selectedConversation.rootUri, rootNode);
      rootNodes.push(rootNode);
    }

    // Create nodes for all replies
    selectedConversation.replies.forEach((notification) => {
      const post = postMap.get(notification.uri);
      if (post) {
        const node: ThreadNode = {
          notification,
          post,
          children: [],
          depth: 0,
        };
        nodeMap.set(notification.uri, node);
      }
    });

    // Build parent-child relationships
    selectedConversation.replies.forEach((notification) => {
      const post = postMap.get(notification.uri);
      const childNode = nodeMap.get(notification.uri);
      if (!childNode) return;

      // Get the parent URI from the reply
      const postRecord = post?.record as any;
      const parentUri = postRecord?.reply?.parent?.uri;

      if (parentUri) {
        const parentNode = nodeMap.get(parentUri);

        if (parentNode) {
          // Found parent in our nodes
          parentNode.children.push(childNode);
          childNode.depth = parentNode.depth + 1;
        } else {
          // Parent not in our nodes, check if it should be attached to root
          if (
            parentUri === selectedConversation.rootUri ||
            rootNodes.length > 0
          ) {
            // This is a direct reply to the root post or we have a root node
            rootNodes[0].children.push(childNode);
            childNode.depth = 1;
          }
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

    return rootNodes;
  }, [selectedConversation, postMap]);

  // Load more reply notifications automatically and aggressively (only if not from cache)
  React.useEffect(() => {
    if (!isFromCache && data?.pages && hasNextPage && !isFetchingNextPage) {
      // For conversations, we want to fetch more aggressively to get a good thread view
      const currentNotificationCount = data.pages.reduce(
        (sum, page) => sum + page.notifications.length,
        0,
      );

      // Keep fetching until we have at least 150 reply notifications or no more pages
      // This ensures we get enough data for good conversation threads
      if (currentNotificationCount < 150) {
        fetchNextPage();
      }
    }
  }, [
    isFromCache,
    data?.pages,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  ]);

  // Render thread nodes recursively
  const renderThreadNodes = (
    nodes: ThreadNode[],
    postMap: Map<string, Post>,
  ) => {
    return nodes.map((node) => {
      const post = node.post;
      const notification = node.notification;
      const isUnread = notification && !notification.isRead;
      const author = post?.author || notification?.author;
      const postUrl =
        post?.uri && author?.handle
          ? atUriToBskyUrl(post.uri, author.handle)
          : notification
            ? getNotificationUrl(notification)
            : null;

      // Handle root node without post - since we wait for all posts to load, this is truly unavailable
      if (node.isRoot && !post) {
        return (
          <div
            key={selectedConversation?.rootUri || Math.random()}
            className="mb-4"
          >
            <div
              className="flex-1 rounded-lg p-4"
              style={{
                backgroundColor: "var(--bsky-bg-secondary)",
                border: "1px solid var(--bsky-border-primary)",
              }}
            >
              <div className="mb-2 flex items-center gap-2">
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
              </div>
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <p
                    className="mb-2 text-sm"
                    style={{ color: "var(--bsky-text-secondary)" }}
                  >
                    Original post unavailable
                  </p>
                  <p
                    className="text-xs"
                    style={{ color: "var(--bsky-text-tertiary)" }}
                  >
                    The post may have been deleted or is not accessible
                  </p>
                </div>
              </div>
            </div>
            {/* Render children even if root is unavailable */}
            {node.children.length > 0 && (
              <div>{renderThreadNodes(node.children, postMap)}</div>
            )}
          </div>
        );
      }

      // If root post is missing but we're not loading, just skip rendering it
      if (node.isRoot && !post) {
        // Still render children
        if (node.children.length > 0) {
          return (
            <div key={selectedConversation?.rootUri || Math.random()}>
              {renderThreadNodes(node.children, postMap)}
            </div>
          );
        }
        return null;
      }

      return (
        <div
          key={
            post?.uri ||
            notification?.uri ||
            `node-${node.depth}-${notification?.indexedAt}`
          }
          className="mb-4"
        >
          {/* Thread line connector for nested replies */}
          {node.depth > 0 && (
            <div className="flex">
              <div
                className="flex w-8 flex-shrink-0 justify-center"
                style={{ marginLeft: `${(node.depth - 1) * 48}px` }}
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
            className={`flex ${node.depth > 0 ? "" : ""}`}
            style={{ marginLeft: `${node.depth * 48}px` }}
          >
            {/* Branch indicator */}
            {node.depth > 0 && (
              <div className="flex w-8 flex-shrink-0 items-start justify-center pt-3">
                <CornerDownRight
                  size={16}
                  style={{ color: "var(--bsky-text-tertiary)" }}
                />
              </div>
            )}

            {/* Post card */}
            <div
              className={`flex-1 cursor-pointer rounded-lg p-4 transition-all hover:bg-blue-500 hover:bg-opacity-5 ${
                isUnread ? "ring-2 ring-blue-500 ring-opacity-30" : ""
              } ${
                notification?.uri === selectedConversation?.latestReply.uri
                  ? "ring-2 ring-blue-500 ring-opacity-50"
                  : ""
              }`}
              style={{
                backgroundColor: node.isRoot
                  ? "var(--bsky-bg-secondary)"
                  : notification?.uri === selectedConversation?.latestReply.uri
                    ? "var(--bsky-bg-tertiary)"
                    : isUnread
                      ? "var(--bsky-bg-primary)"
                      : "var(--bsky-bg-secondary)",
                border:
                  notification?.uri === selectedConversation?.latestReply.uri
                    ? "2px solid var(--bsky-primary)"
                    : "1px solid var(--bsky-border-primary)",
              }}
              onClick={() => {
                if (postUrl) {
                  window.open(postUrl, "_blank", "noopener,noreferrer");
                }
              }}
              data-notification-uri={notification?.uri || ""}
            >
              {node.isRoot && (
                <div className="mb-2 flex items-center gap-2">
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
                  {(post || selectedConversation?.originalPostTime) && (
                    <span
                      className="text-xs"
                      style={{ color: "var(--bsky-text-tertiary)" }}
                    >
                      {formatDistanceToNow(
                        new Date(
                          (post?.record as any)?.createdAt ||
                            post?.indexedAt ||
                            selectedConversation?.originalPostTime ||
                            Date.now(),
                        ),
                        { addSuffix: true },
                      )}
                    </span>
                  )}
                </div>
              )}

              {/* Mark the most recent notification */}
              {!node.isRoot &&
                notification?.uri === selectedConversation?.latestReply.uri && (
                  <div className="mb-2 flex items-center gap-2">
                    <span
                      className="animate-pulse rounded-full px-2 py-1 text-xs font-medium"
                      style={{
                        backgroundColor: "var(--bsky-primary)",
                        color: "white",
                      }}
                    >
                      Most Recent Notification
                    </span>
                    <span
                      className="text-xs"
                      style={{ color: "var(--bsky-text-secondary)" }}
                    >
                      triggered{" "}
                      {formatDistanceToNow(
                        new Date(notification?.indexedAt || Date.now()),
                        { addSuffix: true },
                      )}
                    </span>
                  </div>
                )}

              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  {author?.avatar ? (
                    <img
                      src={proxifyBskyImage(author.avatar)}
                      alt={author.handle}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-full"
                      style={{ background: "var(--bsky-bg-tertiary)" }}
                    >
                      <span className="text-sm font-semibold">
                        {author?.handle?.charAt(0).toUpperCase() || "U"}
                      </span>
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center justify-between">
                    <div className="flex min-w-0 items-center gap-1">
                      <span
                        className="truncate text-sm font-semibold"
                        style={{ color: "var(--bsky-text-primary)" }}
                      >
                        {author?.displayName || author?.handle || "Unknown"}
                      </span>
                      <span
                        className="flex-shrink-0 text-xs"
                        style={{ color: "var(--bsky-text-secondary)" }}
                      >
                        @{author?.handle || "unknown"}
                      </span>
                    </div>
                    <div className="flex flex-shrink-0 flex-col items-end gap-0.5">
                      <div className="flex items-center gap-2">
                        <time
                          className="text-xs"
                          style={{ color: "var(--bsky-text-tertiary)" }}
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
                        <ExternalLink
                          size={14}
                          style={{ color: "var(--bsky-text-tertiary)" }}
                        />
                      </div>
                      {notification && !node.isRoot && (
                        <span
                          className="text-xs"
                          style={{ color: "var(--bsky-text-tertiary)" }}
                        >
                          notified{" "}
                          {formatDistanceToNow(
                            new Date(notification.indexedAt),
                            { addSuffix: true },
                          )}
                        </span>
                      )}
                    </div>
                  </div>

                  <p
                    className="break-words text-sm"
                    style={{
                      color: "var(--bsky-text-primary)",
                      lineHeight: "1.5",
                    }}
                  >
                    {(post?.record as any)?.text || "[No text]"}
                  </p>

                  {/* Render quote post if present */}
                  {post?.embed && <QuoteEmbed embed={post.embed} />}

                  {/* Engagement metrics */}
                  {post &&
                    ((post.replyCount ?? 0) > 0 ||
                      (post.repostCount ?? 0) > 0 ||
                      (post.likeCount ?? 0) > 0) && (
                      <div className="mt-2 flex items-center gap-4">
                        {(post.replyCount ?? 0) > 0 && (
                          <span
                            className="flex items-center gap-1 text-xs"
                            style={{ color: "var(--bsky-text-tertiary)" }}
                          >
                            <MessageCircle size={12} />
                            {post.replyCount}
                          </span>
                        )}
                        {(post.repostCount ?? 0) > 0 && (
                          <span
                            className="flex items-center gap-1 text-xs"
                            style={{ color: "var(--bsky-text-tertiary)" }}
                          >
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path d="M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3" />
                            </svg>
                            {post.repostCount}
                          </span>
                        )}
                        {(post.likeCount ?? 0) > 0 && (
                          <span
                            className="flex items-center gap-1 text-xs"
                            style={{ color: "var(--bsky-text-tertiary)" }}
                          >
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                            </svg>
                            {post.likeCount}
                          </span>
                        )}
                      </div>
                    )}

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
            </div>
          </div>

          {/* Render children */}
          {node.children.length > 0 && (
            <div>{renderThreadNodes(node.children, postMap)}</div>
          )}
        </div>
      );
    });
  };

  // Show loading state only on initial load when we have no data at all
  // Also wait for posts to be fully loaded (100% fetched) - but only if we have posts to load
  const actualIsLoading = isFromCache ? false : isLoading;
  const needsPosts = replyNotifications.length > 0;
  const postsStillLoading = needsPosts && postsPercentageFetched < 100;
  const rootPostsStillLoading = rootPostUris.length > 0 && isLoadingRootPosts;

  // Don't show loading if we're from cache and posts are ready or not needed
  const showLoading =
    (actualIsLoading && !data) ||
    (needsPosts && (postsStillLoading || rootPostsStillLoading));

  if (showLoading) {
    return (
      <div
        className="flex h-screen items-center justify-center"
        style={{ background: "var(--bsky-bg-primary)" }}
      >
        <div className="text-center">
          <Loader2
            size={32}
            className="mx-auto mb-4 animate-spin"
            style={{ color: "var(--bsky-primary)" }}
          />
          <p style={{ color: "var(--bsky-text-secondary)" }}>
            {postsStillLoading
              ? `Loading conversation posts... ${postsPercentageFetched}%`
              : rootPostsStillLoading
                ? "Loading original posts..."
                : "Loading conversations..."}
          </p>
        </div>
      </div>
    );
  }

  // Show error or empty state (but not while loading more pages)
  if ((error || conversations.length === 0) && !isFetchingNextPage) {
    return (
      <div
        className="flex h-screen items-center justify-center"
        style={{ background: "var(--bsky-bg-primary)" }}
      >
        <div className="max-w-md text-center">
          <MessageCircle
            size={64}
            className="mx-auto mb-4"
            style={{ color: "var(--bsky-text-tertiary)" }}
          />
          <h2
            className="mb-2 text-xl font-semibold"
            style={{ color: "var(--bsky-text-primary)" }}
          >
            No Conversations Yet
          </h2>
          <p style={{ color: "var(--bsky-text-secondary)" }}>
            {error
              ? "Failed to load conversations."
              : "Reply notifications will appear here as conversations."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative flex h-[calc(100vh-4rem)]"
      style={{ background: "var(--bsky-bg-primary)" }}
    >
      {/* Left Panel - Conversations List */}
      <div
        className={`${selectedConvo ? "hidden md:flex" : "flex"} w-full flex-col md:w-96`}
        style={{ borderRight: "1px solid var(--bsky-border-primary)" }}
      >
        {/* Search Header */}
        <div
          className="p-4"
          style={{ borderBottom: "1px solid var(--bsky-border-primary)" }}
        >
          <div className="relative">
            <Search
              size={20}
              className="absolute left-3 top-1/2 -translate-y-1/2 transform"
              style={{ color: "var(--bsky-text-tertiary)" }}
            />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bsky-input w-full rounded-lg py-2 pl-10 pr-4"
              style={{
                background: "var(--bsky-bg-secondary)",
                border: "1px solid var(--bsky-border-primary)",
                color: "var(--bsky-text-primary)",
              }}
            />
          </div>
          <p
            className="mt-2 text-xs"
            style={{ color: "var(--bsky-text-secondary)" }}
          >
            Showing {filteredConversations.length} conversation
            {filteredConversations.length !== 1 ? "s" : ""} from{" "}
            {replyNotifications.length} reply notifications
            {isFetchingNextPage && !isLoading && " (loading more...)"}
          </p>
          <p
            className="mt-1 flex items-center gap-1 text-xs"
            style={{ color: "var(--bsky-text-tertiary)" }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M3 3v18h18M21 9l-7 7-4-4-5 5" />
            </svg>
            Sorted by most recent notification activity
          </p>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.map((convo) => {
            const isSelected = selectedConvo === convo.rootUri;
            // Always use root post for preview text
            // Never show reply text as the subject - only show the original post
            const rootRecord = convo.rootPost?.record as any;
            const previewText =
              rootRecord?.text || "[Loading original post...]";
            const isGroup = convo.participants.size > 2;
            const unreadCount = convo.replies.filter((r) => !r.isRead).length;

            return (
              <button
                key={convo.rootUri}
                onClick={() => setSelectedConvo(convo.rootUri)}
                className={`w-full p-4 text-left transition-all hover:bg-blue-500 hover:bg-opacity-10 ${
                  isSelected ? "bg-blue-500 bg-opacity-10" : ""
                }`}
                style={{ borderBottom: "1px solid var(--bsky-border-primary)" }}
              >
                <div className="flex items-center gap-3">
                  {/* Clean avatar display */}
                  <div className="relative flex-shrink-0">
                    {isGroup ? (
                      // Group avatar - simple stacked view
                      <div
                        className="flex h-12 w-12 items-center justify-center rounded-full"
                        style={{ background: "var(--bsky-bg-secondary)" }}
                      >
                        <Users
                          size={24}
                          style={{ color: "var(--bsky-text-tertiary)" }}
                        />
                      </div>
                    ) : (
                      // Single avatar - use root post author
                      <>
                        {convo.rootPost?.author?.avatar ||
                        convo.latestReply.author.avatar ? (
                          <img
                            src={proxifyBskyImage(
                              convo.rootPost?.author?.avatar ||
                                convo.latestReply.author.avatar,
                            )}
                            alt=""
                            className="h-12 w-12 rounded-full object-cover"
                          />
                        ) : (
                          <div className="bsky-gradient flex h-12 w-12 items-center justify-center rounded-full font-medium text-white">
                            {convo.rootPost?.author?.displayName?.[0] ||
                              convo.rootPost?.author?.handle?.[0] ||
                              convo.latestReply.author.displayName?.[0] ||
                              convo.latestReply.author.handle?.[0] ||
                              "U"}
                          </div>
                        )}
                      </>
                    )}
                    {/* Unread indicator dot */}
                    {unreadCount > 0 && (
                      <div
                        className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full text-xs font-medium text-white"
                        style={{ background: "var(--bsky-primary)" }}
                      >
                        {unreadCount}
                      </div>
                    )}
                  </div>

                  {/* Simplified content */}
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center justify-between">
                      <h3
                        className="truncate font-medium"
                        style={{ color: "var(--bsky-text-primary)" }}
                      >
                        {convo.rootPost?.author?.displayName ||
                          (isGroup
                            ? `${convo.participants.size} people`
                            : "Thread")}
                      </h3>
                      <span
                        className="text-xs"
                        style={{ color: "var(--bsky-text-secondary)" }}
                      >
                        {formatDistanceToNow(
                          new Date(convo.latestReply.indexedAt),
                          { addSuffix: true },
                        )}
                      </span>
                    </div>

                    {/* Single line preview of original post */}
                    <p
                      className="mb-1 truncate text-sm"
                      style={{ color: "var(--bsky-text-secondary)" }}
                    >
                      {previewText.length > 80
                        ? previewText.substring(0, 80) + "..."
                        : previewText}
                    </p>

                    {/* Simple metadata */}
                    <div
                      className="flex items-center gap-3 text-xs"
                      style={{ color: "var(--bsky-text-tertiary)" }}
                    >
                      <span>
                        {convo.totalReplies} repl
                        {convo.totalReplies === 1 ? "y" : "ies"}
                      </span>
                      {isGroup && (
                        <span>{convo.participants.size} participants</span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right Panel - Conversation View */}
      {selectedConvo && selectedConversation && (
        <div className="flex flex-1 flex-col">
          {/* Conversation Header */}
          <div
            className="flex items-center justify-between p-4"
            style={{ borderBottom: "1px solid var(--bsky-border-primary)" }}
          >
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedConvo(null)}
                className="rounded-lg p-2 transition-all hover:bg-blue-500 hover:bg-opacity-10 md:hidden"
              >
                <ArrowLeft
                  size={20}
                  style={{ color: "var(--bsky-text-secondary)" }}
                />
              </button>

              <div className="flex items-center gap-2">
                <MessageCircle
                  size={20}
                  style={{ color: "var(--bsky-text-secondary)" }}
                />
                <div>
                  <h2
                    className="font-semibold"
                    style={{ color: "var(--bsky-text-primary)" }}
                  >
                    Thread with {selectedConversation.participants.size}{" "}
                    participant
                    {selectedConversation.participants.size !== 1 ? "s" : ""}
                  </h2>
                  <p
                    className="text-sm"
                    style={{ color: "var(--bsky-text-secondary)" }}
                  >
                    {selectedConversation.totalReplies} repl
                    {selectedConversation.totalReplies === 1 ? "y" : "ies"} •
                    <span style={{ color: "var(--bsky-primary)" }}>
                      Most recent:{" "}
                      {formatDistanceToNow(
                        new Date(selectedConversation.latestReply.indexedAt),
                        { addSuffix: true },
                      )}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            <a
              href={getNotificationUrl(selectedConversation.latestReply)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 rounded-lg p-2 transition-all hover:bg-blue-500 hover:bg-opacity-10"
              style={{ color: "var(--bsky-text-secondary)" }}
            >
              <ExternalLink size={20} />
              <span className="text-sm">View on Bluesky</span>
            </a>
          </div>

          {/* Thread View */}
          <div className="flex-1 overflow-y-auto p-4" ref={threadContainerRef}>
            {/* Most Recent Notification Summary Card */}
            {selectedConversation &&
              (() => {
                const latestReplyPost = postMap.get(
                  selectedConversation.latestReply.uri,
                );
                const latestReplyRecord = latestReplyPost?.record as any;
                const latestReplyAuthor =
                  selectedConversation.latestReply.author;
                const latestReplyText =
                  latestReplyRecord?.text || "[Loading reply...]";
                const latestReplyUrl =
                  latestReplyPost?.uri && latestReplyAuthor?.handle
                    ? atUriToBskyUrl(
                        latestReplyPost.uri,
                        latestReplyAuthor.handle,
                      )
                    : (getNotificationUrl(selectedConversation.latestReply) ??
                      undefined);

                return (
                  <div
                    className="mb-4 rounded-lg p-4 shadow-sm"
                    style={{
                      backgroundColor: "var(--bsky-bg-tertiary)",
                      border: "2px solid var(--bsky-primary)",
                    }}
                  >
                    <div className="mb-2 flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="rounded px-2 py-1 text-xs font-bold uppercase tracking-wide"
                          style={{
                            backgroundColor: "var(--bsky-primary)",
                            color: "white",
                          }}
                        >
                          Most Recent Notification
                        </span>
                        <span
                          className="text-xs"
                          style={{ color: "var(--bsky-text-secondary)" }}
                        >
                          {formatDistanceToNow(
                            new Date(
                              selectedConversation.latestReply.indexedAt,
                            ),
                            { addSuffix: true },
                          )}
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          const mostRecentElement = document.querySelector(
                            `[data-notification-uri="${selectedConversation.latestReply.uri}"]`,
                          );
                          if (mostRecentElement) {
                            mostRecentElement.scrollIntoView({
                              behavior: "smooth",
                              block: "center",
                            });
                            // Add highlight effect
                            mostRecentElement.classList.add("animate-highlight-flash", "relative", "z-[5]");
                            setTimeout(() => {
                              mostRecentElement.classList.remove(
                                "animate-highlight-flash", "relative", "z-[5]",
                              );
                            }, 2000);
                          }
                        }}
                        className="flex items-center gap-1 rounded px-2 py-1 text-xs transition-all hover:bg-blue-500 hover:bg-opacity-10"
                        style={{ color: "var(--bsky-primary)" }}
                      >
                        <ChevronDown size={14} />
                        Jump to context
                      </button>
                    </div>

                    <div className="flex items-start gap-3">
                      {/* Avatar */}
                      <div className="flex-shrink-0">
                        {latestReplyAuthor?.avatar ? (
                          <img
                            src={proxifyBskyImage(latestReplyAuthor.avatar)}
                            alt={latestReplyAuthor.handle}
                            className="h-10 w-10 rounded-full object-cover"
                          />
                        ) : (
                          <div
                            className="flex h-10 w-10 items-center justify-center rounded-full"
                            style={{ background: "var(--bsky-bg-secondary)" }}
                          >
                            <span className="text-sm font-semibold">
                              {latestReplyAuthor?.handle
                                ?.charAt(0)
                                .toUpperCase() || "U"}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-baseline gap-1">
                          <span
                            className="text-sm font-semibold"
                            style={{ color: "var(--bsky-text-primary)" }}
                          >
                            {latestReplyAuthor?.displayName ||
                              latestReplyAuthor?.handle ||
                              "Unknown"}
                          </span>
                          <span
                            className="text-xs"
                            style={{ color: "var(--bsky-text-secondary)" }}
                          >
                            @{latestReplyAuthor?.handle || "unknown"}
                          </span>
                          <span
                            className="text-xs"
                            style={{ color: "var(--bsky-text-tertiary)" }}
                          >
                            replied to this thread
                          </span>
                        </div>

                        <p
                          className="mb-2 text-sm"
                          style={{
                            color: "var(--bsky-text-primary)",
                            lineHeight: "1.4",
                          }}
                        >
                          {latestReplyText.length > 200
                            ? latestReplyText.substring(0, 200) + "..."
                            : latestReplyText}
                        </p>

                        {latestReplyUrl && (
                          <a
                            href={latestReplyUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs hover:underline"
                            style={{ color: "var(--bsky-primary)" }}
                          >
                            <ExternalLink size={12} />
                            View on Bluesky
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

            {/* Thread content */}
            {threadTree && renderThreadNodes(threadTree, postMap)}
          </div>

          {/* Info Footer */}
          <div
            className="p-4 text-center"
            style={{ borderTop: "1px solid var(--bsky-border-primary)" }}
          >
            <p
              className="text-sm"
              style={{ color: "var(--bsky-text-secondary)" }}
            >
              This is a read-only view of reply notifications grouped by thread.
            </p>
            <p
              className="mt-1 text-xs"
              style={{ color: "var(--bsky-text-tertiary)" }}
            >
              To reply, click "View on Bluesky" above.
            </p>
          </div>
        </div>
      )}

      {/* Empty state when no conversation selected (desktop only) */}
      {!selectedConvo && (
        <div className="hidden flex-1 items-center justify-center md:flex">
          <div className="text-center">
            <MessageCircle
              size={64}
              className="mx-auto mb-4"
              style={{ color: "var(--bsky-text-tertiary)" }}
            />
            <h2
              className="mb-2 text-xl font-semibold"
              style={{ color: "var(--bsky-text-primary)" }}
            >
              Select a conversation
            </h2>
            <p style={{ color: "var(--bsky-text-secondary)" }}>
              Choose a conversation thread from the left to view replies
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
