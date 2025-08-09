import type { AppBskyFeedDefs } from "@atproto/api";
import type { Notification } from "@atproto/api/dist/client/types/app/bsky/notification/listNotifications";
import { debug } from "@bsky/shared";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ExternalLink, Loader2, MessageCircle, X } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { atProtoClient, getThreadService } from "../services/atproto";
import { getNotificationUrl } from "../utils/url-helpers";
import { ThreadViewer } from "./ThreadViewer";

type Post = AppBskyFeedDefs.PostView;

interface ConversationModalProps {
  rootUri: string;
  conversation: {
    rootUri: string;
    rootPost?: Post;
    replies: Notification[];
    participants: Set<string>;
    latestReply: Notification;
    totalReplies: number;
    originalPostTime?: string;
  };
  allPostsMap: Map<string, Post>;
  onClose: () => void;
}

export function ConversationModal({
  rootUri,
  conversation,
  allPostsMap,
  onClose,
}: ConversationModalProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    document.body.style.overflow = "hidden";
    document.body.classList.add("conversation-modal-open");

    return () => {
      window.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
      document.body.classList.remove("conversation-modal-open");
    };
  }, [onClose]);

  // Fetch complete thread
  const { data: completeThread, isLoading } = useQuery({
    queryKey: ["thread", rootUri],
    queryFn: async () => {
      if (!rootUri) return null;

      debug.log("[ConversationModal] Fetching complete thread for:", rootUri);

      try {
        const threadService = getThreadService(atProtoClient.agent!);
        const thread = await threadService.getThread(rootUri, 100);
        debug.log("[ConversationModal] Thread fetched successfully:", {
          uri: rootUri,
          hasThread: !!thread?.thread,
          threadRootUri:
            thread?.thread && "post" in thread.thread
              ? thread.thread.post?.uri
              : undefined,
        });
        return thread;
      } catch (error) {
        debug.error(
          "[ConversationModal] Failed to fetch complete thread:",
          error,
        );
        return null;
      }
    },
    enabled: !!rootUri,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });

  // Helper function to extract all posts from thread data
  const extractPostsFromThread = (thread: any): Post[] => {
    const posts: Post[] = [];

    const processNode = (node: any) => {
      if (
        node &&
        node.$type === "app.bsky.feed.defs#threadViewPost" &&
        node.post &&
        node.post.uri
      ) {
        posts.push(node.post as Post);
      }

      // Process replies
      if (node?.replies && Array.isArray(node.replies)) {
        node.replies.forEach((reply: any) => processNode(reply));
      }
    };

    if (thread?.thread) {
      processNode(thread.thread);
    }

    return posts;
  };

  // Prepare posts for ThreadViewer
  const threadPosts = useMemo(() => {
    const posts: Post[] = [];
    const postUris = new Set<string>();

    // Add posts from complete thread if available
    if (completeThread) {
      const threadPosts = extractPostsFromThread(completeThread);
      threadPosts.forEach((post) => {
        if (!postUris.has(post.uri)) {
          posts.push(post);
          postUris.add(post.uri);
        }
      });
    }

    // Add the root post if available and not already included
    if (conversation.rootPost && !postUris.has(conversation.rootPost.uri)) {
      posts.push(conversation.rootPost);
      postUris.add(conversation.rootPost.uri);
    }

    // Add posts from the conversation's replies
    conversation.replies.forEach((notification) => {
      const post = allPostsMap.get(notification.uri);
      if (post && !postUris.has(post.uri)) {
        posts.push(post);
        postUris.add(post.uri);
      }

      // Also add the reasonSubject post if available
      if (notification.reasonSubject) {
        const parentPost = allPostsMap.get(notification.reasonSubject);
        if (parentPost && !postUris.has(parentPost.uri)) {
          posts.push(parentPost);
          postUris.add(parentPost.uri);
        }
      }
    });

    debug.log("[ConversationModal] Prepared thread posts:", {
      postCount: posts.length,
      hasCompleteThread: !!completeThread,
      conversationRootUri: conversation.rootUri,
    });

    return posts;
  }, [conversation, allPostsMap, completeThread]);

  // Get the notification to highlight
  const highlightNotificationUri = useMemo(() => {
    // Find the most recent unread notification
    const unreadNotifications = conversation.replies.filter((r) => !r.isRead);
    if (unreadNotifications.length > 0) {
      const mostRecentUnread = unreadNotifications.sort(
        (a, b) =>
          new Date(b.indexedAt).getTime() - new Date(a.indexedAt).getTime(),
      )[0];
      return mostRecentUnread.uri;
    }

    // If all are read, highlight the latest reply
    return conversation.latestReply.uri;
  }, [conversation]);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />

      <div
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-3xl flex-col overflow-hidden shadow-xl"
        style={{ backgroundColor: "var(--bsky-bg-primary)" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-4"
          style={{ borderBottom: "1px solid var(--bsky-border-primary)" }}
        >
          <div className="flex items-center gap-3">
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
                  Thread with {conversation.participants.size} participant
                  {conversation.participants.size !== 1 ? "s" : ""}
                </h2>
                <p
                  className="text-sm"
                  style={{ color: "var(--bsky-text-secondary)" }}
                >
                  {conversation.totalReplies} repl
                  {conversation.totalReplies === 1 ? "y" : "ies"} •
                  <span style={{ color: "var(--bsky-primary)" }}>
                    Most recent:{" "}
                    {formatDistanceToNow(
                      new Date(conversation.latestReply.indexedAt),
                      { addSuffix: true },
                    )}
                  </span>
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={getNotificationUrl(conversation.latestReply)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 rounded-lg p-2 transition-all hover:bg-blue-500 hover:bg-opacity-10"
              style={{ color: "var(--bsky-text-secondary)" }}
            >
              <ExternalLink size={20} />
              <span className="hidden text-sm sm:inline">View on Bluesky</span>
            </a>

            <button
              onClick={onClose}
              className="rounded-full p-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
              style={{ color: "var(--bsky-text-secondary)" }}
              aria-label="Close"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Thread Content */}
        <div
          className="bsky-scrollbar flex-1 overflow-y-auto p-4"
          ref={scrollContainerRef}
        >
          {isLoading && threadPosts.length === 0 && (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <Loader2
                  className="mx-auto mb-4 animate-spin"
                  size={32}
                  style={{ color: "var(--bsky-primary)" }}
                />
                <p style={{ color: "var(--bsky-text-secondary)" }}>
                  Loading complete thread...
                </p>
              </div>
            </div>
          )}

          {threadPosts.length > 0 && (
            <ThreadViewer
              posts={threadPosts}
              notifications={conversation.replies}
              rootUri={rootUri}
              showUnreadIndicators={true}
              highlightUri={highlightNotificationUri}
            />
          )}
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
    </>
  );
}
