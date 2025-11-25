import type { Notification } from "@atproto/api/dist/client/types/app/bsky/notification/listNotifications";
import { formatDistanceToNow } from "date-fns";
import { MessageCircle } from "lucide-react";
import React from "react";
import { useNotifications } from "../hooks/useNotifications";
import { proxifyBskyImage } from "../utils/image-proxy";

interface Comment {
  uri: string;
  author: {
    did: string;
    handle: string;
    displayName?: string;
    avatar?: string;
  };
  text: string;
  indexedAt: Date;
  postUri?: string;
}

export const RecentCommentsTable: React.FC = () => {
  const { data, isLoading } = useNotifications();

  // Extract recent reply notifications and transform them into comments
  const recentComments: Comment[] = React.useMemo(() => {
    if (!data || isLoading) return [];

    // Flatten all pages of notifications
    const allNotifications = data.pages.flatMap((page) => page.notifications);

    // Filter for reply notifications from the last 24 hours
    const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const comments = allNotifications
      .filter((notif: Notification) => {
        return (
          notif.reason === "reply" &&
          new Date(notif.indexedAt) > cutoffDate &&
          (notif.record as any)?.text
        );
      })
      .map((notif: Notification) => ({
        uri: notif.uri,
        author: {
          did: notif.author.did,
          handle: notif.author.handle,
          displayName: notif.author.displayName,
          avatar: notif.author.avatar,
        },
        text: (notif.record as any)?.text || "",
        indexedAt: new Date(notif.indexedAt),
        postUri: notif.reasonSubject,
      }))
      .sort(
        (a: Comment, b: Comment) =>
          b.indexedAt.getTime() - a.indexedAt.getTime(),
      )
      .slice(0, 20); // Limit to 20 most recent

    return comments;
  }, [data, isLoading]);

  if (recentComments.length === 0) {
    return (
      <div
        className="rounded-lg border p-6 text-center"
        style={{
          backgroundColor: "var(--bsky-bg-secondary)",
          borderColor: "var(--bsky-border-primary)",
          color: "var(--bsky-text-tertiary)",
        }}
      >
        <MessageCircle size={24} className="mx-auto mb-2 opacity-50" />
        <p>No recent comments in the last 24 hours</p>
      </div>
    );
  }

  const handleInternalNavigation = (e: React.MouseEvent, href: string) => {
    e.preventDefault();
    window.dispatchEvent(new CustomEvent("navigate", { detail: { href } }));
  };

  const getProfileUrl = (handle: string) => `/profile/${handle}`;
  const getThreadUrl = (uri: string) => `/thread/${encodeURIComponent(uri)}`;

  return (
    <div
      className="overflow-hidden rounded-lg border"
      style={{
        backgroundColor: "var(--bsky-bg-secondary)",
        borderColor: "var(--bsky-border-primary)",
      }}
    >
      <div
        className="flex items-center gap-2 px-4 py-3 font-medium"
        style={{
          backgroundColor: "var(--bsky-bg-tertiary)",
          borderBottom: "1px solid var(--bsky-border-primary)",
        }}
      >
        <MessageCircle size={18} style={{ color: "var(--bsky-primary)" }} />
        <h3 style={{ color: "var(--bsky-text-primary)" }}>
          Recent Comments (24h)
        </h3>
      </div>

      <div
        className="divide-y"
        style={{ borderColor: "var(--bsky-border-primary)" }}
      >
        {recentComments.map((comment) => (
          <div
            key={comment.uri}
            className="flex gap-3 p-4 transition-colors hover:bg-opacity-50"
            style={{
              backgroundColor: "var(--bsky-bg-primary)",
            }}
          >
            {/* Author column */}
            <div className="flex-shrink-0">
              <div
                onClick={(e) =>
                  handleInternalNavigation(
                    e,
                    getProfileUrl(comment.author.handle),
                  )
                }
                className="cursor-pointer"
              >
                <img
                  src={proxifyBskyImage(comment.author.avatar)}
                  alt={comment.author.handle}
                  className="h-10 w-10 rounded-full transition-opacity hover:opacity-80"
                  style={{
                    border: "1px solid var(--bsky-border-primary)",
                  }}
                />
              </div>
            </div>

            {/* Content column */}
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <div className="flex min-w-0 items-baseline gap-2">
                  <span
                    onClick={(e) =>
                      handleInternalNavigation(
                        e,
                        getProfileUrl(comment.author.handle),
                      )
                    }
                    className="cursor-pointer truncate font-medium hover:underline"
                    style={{ color: "var(--bsky-text-primary)" }}
                  >
                    {comment.author.displayName || comment.author.handle}
                  </span>
                  <span
                    onClick={(e) =>
                      handleInternalNavigation(
                        e,
                        getProfileUrl(comment.author.handle),
                      )
                    }
                    className="cursor-pointer truncate text-xs hover:underline"
                    style={{ color: "var(--bsky-text-tertiary)" }}
                  >
                    @{comment.author.handle}
                  </span>
                </div>
                <span
                  className="flex-shrink-0 text-xs"
                  style={{ color: "var(--bsky-text-tertiary)" }}
                >
                  {formatDistanceToNow(comment.indexedAt, { addSuffix: true })}
                </span>
              </div>

              <p
                onClick={(e) => {
                  if (comment.postUri) {
                    handleInternalNavigation(e, getThreadUrl(comment.postUri));
                  }
                }}
                className={`line-clamp-2 text-sm ${comment.postUri ? "cursor-pointer hover:opacity-80" : ""}`}
                style={{ color: "var(--bsky-text-primary)" }}
              >
                {comment.text}
              </p>
            </div>
          </div>
        ))}
      </div>

      {recentComments.length === 20 && (
        <div
          className="px-4 py-3 text-center text-sm"
          style={{
            backgroundColor: "var(--bsky-bg-tertiary)",
            borderTop: "1px solid var(--bsky-border-primary)",
            color: "var(--bsky-text-tertiary)",
          }}
        >
          Showing 20 most recent comments
        </div>
      )}
    </div>
  );
};
