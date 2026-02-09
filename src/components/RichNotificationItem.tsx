/**
 * Rich Notification Item Component
 *
 * Displays notifications with rich content including:
 * - Media previews (images, video thumbnails)
 * - Inline action buttons
 * - Aggregated user displays
 * - Post content previews
 */

import type { AppBskyFeedDefs } from "@atproto/api";
import { formatDistanceToNow } from "date-fns";
import {
  AtSign,
  ExternalLink,
  Heart,
  Loader,
  MessageCircle,
  MoreHorizontal,
  Play,
  Quote,
  Repeat2,
  UserPlus,
} from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { fetchLinkMetadata, type LinkMetadata } from "../services/anthropic";
import type {
  GroupedNotification,
  NotificationUser,
  PostPreview,
} from "../services/notification-grouping-service";
import { proxifyBskyImage } from "../utils/image-proxy";
import { parseBskyUrl } from "../utils/url-helpers";
import { extractFirstBskyPostUrl, extractFirstLinkUrl } from "./composer/utils";
import { ProfileHoverCard } from "./ui/ProfileHoverCard";

interface RichNotificationItemProps {
  notification: GroupedNotification;
  onView?: (uri: string) => void;
  onReply?: (uri: string) => void;
  onUserClick?: (handle: string) => void;
  onMarkAsRead?: (id: string) => void;
  onDismiss?: (id: string) => void;
  showActions?: boolean;
  compact?: boolean;
}

/**
 * Rich Notification Item with media preview and inline actions
 */
export const RichNotificationItem: React.FC<RichNotificationItemProps> =
  React.memo(
    ({
      notification,
      onView,
      onReply,
      onUserClick,
      onMarkAsRead,
      onDismiss,
      showActions = true,
      compact = false,
    }) => {
      const [showAllUsers, setShowAllUsers] = useState(false);
      const [actionsOpen, setActionsOpen] = useState(false);

      const handleClick = useCallback(() => {
        if (!notification.isRead && onMarkAsRead) {
          onMarkAsRead(notification.id);
        }
        if (onView && notification.postUri) {
          onView(notification.postUri);
        }
      }, [notification, onView, onMarkAsRead]);

      const handleReply = useCallback(
        (e: React.MouseEvent) => {
          e.stopPropagation();
          if (onReply && notification.postUri) {
            onReply(notification.postUri);
          }
        },
        [notification.postUri, onReply],
      );

      const handleUserClick = useCallback(
        (e: React.MouseEvent, handle: string) => {
          e.stopPropagation();
          if (onUserClick) {
            onUserClick(handle);
          }
        },
        [onUserClick],
      );

      const handleDismiss = useCallback(
        (e: React.MouseEvent) => {
          e.stopPropagation();
          if (onDismiss) {
            onDismiss(notification.id);
          }
          setActionsOpen(false);
        },
        [notification.id, onDismiss],
      );

      return (
        <div
          className={`bsky-notification cursor-pointer ${
            !notification.isRead ? "bsky-notification-unread" : ""
          } ${compact ? "px-2 py-2" : "px-3 py-3"}`}
          onClick={handleClick}
        >
          <div className="flex items-start gap-2">
            {/* Icon */}
            <div className="flex-shrink-0">
              <NotificationIcon reason={notification.reason} />
            </div>

            {/* User avatars */}
            <div className="flex-shrink-0">
              <UserAvatarStack
                users={notification.users}
                maxDisplay={compact ? 2 : 3}
                showAll={showAllUsers}
                onToggle={() => setShowAllUsers(!showAllUsers)}
                onUserClick={handleUserClick}
                size={compact ? "sm" : "md"}
              />
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1">
              {/* Summary text */}
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm">
                  <NotificationSummary notification={notification} />
                  <span
                    className="ml-1 text-xs"
                    style={{ color: "var(--bsky-text-tertiary)" }}
                  >
                    ·{" "}
                    {formatDistanceToNow(
                      new Date(notification.latestTimestamp),
                      {
                        addSuffix: true,
                      },
                    )}
                  </span>
                </p>

                {/* Actions menu */}
                {showActions && (
                  <div className="relative flex-shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActionsOpen(!actionsOpen);
                      }}
                      className="rounded p-1 transition-colors hover:bg-bsky-bg-secondary"
                      style={{ color: "var(--bsky-text-tertiary)" }}
                      aria-label="More actions"
                    >
                      <MoreHorizontal size={16} />
                    </button>

                    {actionsOpen && (
                      <ActionsMenu
                        notification={notification}
                        onView={
                          onView && notification.postUri
                            ? () => {
                                onView(notification.postUri!);
                                setActionsOpen(false);
                              }
                            : undefined
                        }
                        onReply={
                          onReply && notification.postUri
                            ? () => {
                                onReply(notification.postUri!);
                                setActionsOpen(false);
                              }
                            : undefined
                        }
                        onDismiss={handleDismiss}
                        onClose={() => setActionsOpen(false)}
                      />
                    )}
                  </div>
                )}
              </div>

              {/* Post preview (if available) */}
              {notification.postPreview && !compact && (
                <PostPreviewCard preview={notification.postPreview} />
              )}

              {/* Inline actions */}
              {showActions && !compact && (
                <InlineActions
                  notification={notification}
                  onView={onView}
                  onReply={handleReply}
                />
              )}

              {/* Unread indicator */}
              {!notification.isRead && (
                <div
                  className="mt-1 h-2 w-2 animate-pulse rounded-full"
                  style={{ backgroundColor: "var(--bsky-primary)" }}
                />
              )}
            </div>
          </div>
        </div>
      );
    },
    (prevProps, nextProps) => {
      // Custom comparison for memoization
      return (
        prevProps.notification.id === nextProps.notification.id &&
        prevProps.notification.isRead === nextProps.notification.isRead &&
        prevProps.notification.latestTimestamp ===
          nextProps.notification.latestTimestamp &&
        prevProps.showActions === nextProps.showActions &&
        prevProps.compact === nextProps.compact
      );
    },
  );

RichNotificationItem.displayName = "RichNotificationItem";

/**
 * Notification icon based on reason
 */
const NotificationIcon: React.FC<{ reason: string }> = React.memo(
  ({ reason }) => {
    const iconProps = { size: 18 };

    switch (reason) {
      case "like":
        return (
          <Heart
            {...iconProps}
            style={{ color: "var(--bsky-like)" }}
            fill="currentColor"
          />
        );
      case "repost":
        return (
          <Repeat2 {...iconProps} style={{ color: "var(--bsky-repost)" }} />
        );
      case "follow":
        return (
          <UserPlus {...iconProps} style={{ color: "var(--bsky-follow)" }} />
        );
      case "mention":
        return (
          <AtSign {...iconProps} style={{ color: "var(--bsky-mention)" }} />
        );
      case "reply":
        return (
          <MessageCircle
            {...iconProps}
            style={{ color: "var(--bsky-reply)" }}
          />
        );
      case "quote":
        return <Quote {...iconProps} style={{ color: "var(--bsky-quote)" }} />;
      default:
        return null;
    }
  },
);

NotificationIcon.displayName = "NotificationIcon";

/**
 * User avatar stack for aggregated notifications
 */
const UserAvatarStack: React.FC<{
  users: NotificationUser[];
  maxDisplay: number;
  showAll: boolean;
  onToggle: () => void;
  onUserClick: (e: React.MouseEvent, handle: string) => void;
  size: "sm" | "md";
}> = React.memo(
  ({ users, maxDisplay, showAll, onToggle, onUserClick, size }) => {
    const displayUsers = showAll ? users : users.slice(0, maxDisplay);
    const remainingCount = users.length - displayUsers.length;
    const avatarSize = size === "sm" ? "h-6 w-6" : "h-8 w-8";
    const stackOffset = size === "sm" ? "-space-x-1.5" : "-space-x-2";

    return (
      <div className={`flex ${stackOffset}`}>
        {displayUsers.map((user, idx) => (
          <div
            key={user.did}
            style={{ zIndex: displayUsers.length - idx }}
            className="cursor-pointer transition-opacity hover:opacity-80"
            onClick={(e) => onUserClick(e, user.handle)}
            title={user.displayName || user.handle}
          >
            {user.avatar ? (
              <img
                src={proxifyBskyImage(user.avatar)}
                alt={user.handle}
                className={`bsky-avatar border-2 ${avatarSize}`}
                style={{ borderColor: "var(--bsky-bg-primary)" }}
              />
            ) : (
              <div
                className={`bsky-avatar flex items-center justify-center border-2 ${avatarSize}`}
                style={{
                  background: "var(--bsky-bg-tertiary)",
                  borderColor: "var(--bsky-bg-primary)",
                }}
              >
                <span className="text-xs font-semibold">
                  {user.handle?.charAt(0).toUpperCase() || "U"}
                </span>
              </div>
            )}
          </div>
        ))}

        {remainingCount > 0 && !showAll && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            className={`bsky-avatar flex items-center justify-center border-2 ${avatarSize}`}
            style={{
              background: "var(--bsky-bg-secondary)",
              borderColor: "var(--bsky-bg-primary)",
              zIndex: 0,
            }}
            title={`+${remainingCount} more`}
          >
            <span className="text-xs font-semibold">+{remainingCount}</span>
          </button>
        )}
      </div>
    );
  },
);

UserAvatarStack.displayName = "UserAvatarStack";

/**
 * Notification summary text
 */
const NotificationSummary: React.FC<{ notification: GroupedNotification }> =
  React.memo(({ notification }) => {
    const { users, count, reason } = notification;

    const formatUserNames = () => {
      if (count === 1 && users.length === 1) {
        return (
          <span
            className="inline-block max-w-[150px] truncate align-bottom font-semibold"
            style={{ color: "var(--bsky-text-primary)" }}
          >
            {users[0].displayName || users[0].handle}
          </span>
        );
      }

      if (users.length === 1) {
        return (
          <>
            <span
              className="inline-block max-w-[150px] truncate align-bottom font-semibold"
              style={{ color: "var(--bsky-text-primary)" }}
            >
              {users[0].displayName || users[0].handle}
            </span>
            <span style={{ color: "var(--bsky-text-secondary)" }}>
              {" "}
              and {count - 1} others
            </span>
          </>
        );
      }

      if (users.length === 2 && count === 2) {
        return (
          <>
            <span
              className="inline-block max-w-[120px] truncate align-bottom font-semibold"
              style={{ color: "var(--bsky-text-primary)" }}
            >
              {users[0].displayName || users[0].handle}
            </span>
            <span style={{ color: "var(--bsky-text-secondary)" }}> and </span>
            <span
              className="inline-block max-w-[120px] truncate align-bottom font-semibold"
              style={{ color: "var(--bsky-text-primary)" }}
            >
              {users[1].displayName || users[1].handle}
            </span>
          </>
        );
      }

      return (
        <>
          <span
            className="font-semibold"
            style={{ color: "var(--bsky-text-primary)" }}
          >
            {count} people
          </span>
        </>
      );
    };

    const getActionText = () => {
      switch (reason) {
        case "like":
          return "liked your post";
        case "repost":
          return "reposted your post";
        case "follow":
          return "followed you";
        case "mention":
          return "mentioned you";
        case "reply":
          return "replied to your post";
        case "quote":
          return "quoted your post";
        default:
          return "interacted with your post";
      }
    };

    return (
      <>
        {formatUserNames()}{" "}
        <span style={{ color: "var(--bsky-text-secondary)" }}>
          {getActionText()}
        </span>
      </>
    );
  });

NotificationSummary.displayName = "NotificationSummary";

/**
 * Post preview card with media support
 */
const PostPreviewCard: React.FC<{ preview: PostPreview }> = React.memo(
  ({ preview }) => {
    return (
      <div
        className="mt-2 rounded-lg p-3"
        style={{
          backgroundColor: "var(--bsky-bg-secondary)",
          border: "1px solid var(--bsky-border-primary)",
        }}
      >
        {/* Author info */}
        <div className="mb-2 flex items-center gap-2">
          {preview.authorAvatar && (
            <img
              src={proxifyBskyImage(preview.authorAvatar)}
              alt={preview.authorHandle}
              className="bsky-avatar h-5 w-5"
            />
          )}
          <span
            className="max-w-[200px] truncate text-xs font-medium"
            style={{ color: "var(--bsky-text-secondary)" }}
          >
            {preview.authorDisplayName || preview.authorHandle}
          </span>
        </div>

        {/* Text content */}
        {preview.text && (
          <p
            className="line-clamp-3 text-sm"
            style={{ color: "var(--bsky-text-primary)" }}
          >
            {preview.text}
          </p>
        )}

        {/* Link preview (if text has URL) */}
        {preview.text && <NotificationLinkPreview postText={preview.text} />}

        {/* Quote post preview (if text has Bluesky URL) */}
        {preview.text && <NotificationQuotePreview postText={preview.text} />}

        {/* Media preview */}
        {preview.hasImages && preview.imageThumbnails.length > 0 && (
          <MediaThumbnails thumbnails={preview.imageThumbnails} />
        )}

        {/* Video indicator */}
        {preview.hasVideo && (
          <div
            className="mt-2 flex items-center gap-1 text-xs"
            style={{ color: "var(--bsky-text-tertiary)" }}
          >
            <Play size={14} />
            <span>Video</span>
          </div>
        )}
      </div>
    );
  },
);

PostPreviewCard.displayName = "PostPreviewCard";

/**
 * Media thumbnails grid
 */
const MediaThumbnails: React.FC<{ thumbnails: string[] }> = React.memo(
  ({ thumbnails }) => {
    const gridCols =
      thumbnails.length === 1
        ? "grid-cols-1"
        : thumbnails.length === 2
          ? "grid-cols-2"
          : "grid-cols-2";

    return (
      <div className={`mt-2 grid gap-1 ${gridCols}`}>
        {thumbnails.slice(0, 4).map((url, idx) => (
          <div
            key={`notif-thumb-${url}-${idx}`}
            className="relative overflow-hidden rounded"
            style={{
              aspectRatio: thumbnails.length === 1 ? "16/9" : "1",
              maxHeight: thumbnails.length === 1 ? "120px" : "80px",
            }}
          >
            <img
              src={proxifyBskyImage(url)}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
            {idx === 3 && thumbnails.length > 4 && (
              <div
                className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50"
                style={{ color: "white" }}
              >
                <span className="text-sm font-semibold">
                  +{thumbnails.length - 4}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  },
);

MediaThumbnails.displayName = "MediaThumbnails";

/**
 * Inline action buttons
 */
const InlineActions: React.FC<{
  notification: GroupedNotification;
  onView?: (uri: string) => void;
  onReply?: (e: React.MouseEvent) => void;
}> = React.memo(({ notification, onView, onReply }) => {
  const showReply = ["mention", "reply", "quote"].includes(notification.reason);
  const showView = notification.postUri != null;

  if (!showReply && !showView) return null;

  return (
    <div className="mt-2 flex items-center gap-2">
      {showView && onView && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (notification.postUri) onView(notification.postUri);
          }}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors hover:bg-bsky-bg-secondary"
          style={{ color: "var(--bsky-text-secondary)" }}
        >
          <ExternalLink size={12} />
          View
        </button>
      )}

      {showReply && onReply && (
        <button
          onClick={onReply}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors hover:bg-bsky-bg-secondary"
          style={{ color: "var(--bsky-primary)" }}
        >
          <MessageCircle size={12} />
          Reply
        </button>
      )}
    </div>
  );
});

InlineActions.displayName = "InlineActions";

/**
 * Actions dropdown menu
 */
const ActionsMenu: React.FC<{
  notification: GroupedNotification;
  onView?: () => void;
  onReply?: () => void;
  onDismiss?: (e: React.MouseEvent) => void;
  onClose: () => void;
}> = React.memo(({ onView, onReply, onDismiss, onClose }) => {
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      />

      {/* Menu */}
      <div
        className="absolute right-0 top-full z-50 mt-1 w-40 rounded-lg border shadow-lg"
        style={{
          backgroundColor: "var(--bsky-bg-secondary)",
          borderColor: "var(--bsky-border-primary)",
        }}
      >
        {onView && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onView();
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-bsky-bg-hover"
            style={{ color: "var(--bsky-text-primary)" }}
          >
            <ExternalLink size={14} />
            View Post
          </button>
        )}

        {onReply && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onReply();
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-bsky-bg-hover"
            style={{ color: "var(--bsky-text-primary)" }}
          >
            <MessageCircle size={14} />
            Reply
          </button>
        )}

        {onDismiss && (
          <button
            onClick={onDismiss}
            className="flex w-full items-center gap-2 border-t px-3 py-2 text-left text-sm hover:bg-bsky-bg-hover"
            style={{
              color: "var(--bsky-text-secondary)",
              borderColor: "var(--bsky-border-primary)",
            }}
          >
            Dismiss
          </button>
        )}
      </div>
    </>
  );
});

ActionsMenu.displayName = "ActionsMenu";

/**
 * Link preview component for notification post cards
 */
const NotificationLinkPreview: React.FC<{ postText: string }> = React.memo(
  ({ postText }) => {
    const [metadata, setMetadata] = useState<LinkMetadata | null>(null);
    const [loading, setLoading] = useState(false);

    const url = extractFirstLinkUrl(postText);

    useEffect(() => {
      if (!url) {
        setMetadata(null);
        return;
      }

      let cancelled = false;
      const fetchMetadataAsync = async () => {
        setLoading(true);
        try {
          const data = await fetchLinkMetadata(url);
          if (!cancelled) {
            setMetadata(data);
          }
        } catch {
          // Silently fail
        } finally {
          if (!cancelled) {
            setLoading(false);
          }
        }
      };

      const timer = setTimeout(fetchMetadataAsync, 300);
      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    }, [url]);

    if (!url) return null;

    if (loading) {
      return (
        <div
          className="mt-2 flex items-center gap-2 rounded border p-2 text-xs"
          style={{
            borderColor: "var(--bsky-border-primary)",
            color: "var(--bsky-text-secondary)",
          }}
        >
          <Loader size={12} className="animate-spin" />
          <span>Loading preview...</span>
        </div>
      );
    }

    if (!metadata) return null;

    let domain = "";
    try {
      domain = new URL(metadata.url).hostname.replace("www.", "");
    } catch {
      domain = metadata.url;
    }

    return (
      <div
        className="mt-2 overflow-hidden rounded border"
        style={{ borderColor: "var(--bsky-border-primary)" }}
      >
        {metadata.imageUrl && (
          <div
            className="h-24 w-full bg-cover bg-center"
            style={{ backgroundImage: `url(${metadata.imageUrl})` }}
          />
        )}
        <div className="p-2">
          <div
            className="mb-0.5 text-xs"
            style={{ color: "var(--bsky-text-tertiary)" }}
          >
            {domain}
          </div>
          <div
            className="line-clamp-1 text-xs font-medium"
            style={{ color: "var(--bsky-text-primary)" }}
          >
            {metadata.title}
          </div>
          {metadata.description && (
            <div
              className="mt-0.5 line-clamp-1 text-xs"
              style={{ color: "var(--bsky-text-secondary)" }}
            >
              {metadata.description}
            </div>
          )}
        </div>
      </div>
    );
  },
);

NotificationLinkPreview.displayName = "NotificationLinkPreview";

/**
 * Quote post preview component for notification post cards
 */
const NotificationQuotePreview: React.FC<{ postText: string }> = React.memo(
  ({ postText }) => {
    const { agent } = useAuth();
    const [quotedPost, setQuotedPost] =
      useState<AppBskyFeedDefs.PostView | null>(null);
    const [loading, setLoading] = useState(false);

    const bskyUrl = extractFirstBskyPostUrl(postText);

    useEffect(() => {
      if (!bskyUrl) {
        setQuotedPost(null);
        return;
      }

      let cancelled = false;
      const fetchQuotedPost = async () => {
        const parsed = parseBskyUrl(bskyUrl);
        if (!parsed || !parsed.postId) return;

        if (!agent) return;

        setLoading(true);
        try {
          let did = parsed.did;
          if (!did && parsed.handle) {
            try {
              const profileResponse = await agent.getProfile({
                actor: parsed.handle,
              });
              did = profileResponse.data.did;
            } catch {
              return;
            }
          }

          if (!did) return;

          const uri = `at://${did}/app.bsky.feed.post/${parsed.postId}`;
          const response = await agent.app.bsky.feed.getPosts({ uris: [uri] });

          if (!cancelled && response.data.posts.length > 0) {
            setQuotedPost(response.data.posts[0]);
          }
        } catch {
          // Silently fail
        } finally {
          if (!cancelled) {
            setLoading(false);
          }
        }
      };

      const timer = setTimeout(fetchQuotedPost, 300);
      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    }, [bskyUrl, agent]);

    if (!bskyUrl) return null;

    if (loading) {
      return (
        <div
          className="mt-2 flex items-center gap-2 rounded border p-2 text-xs"
          style={{
            borderColor: "var(--bsky-border-primary)",
            color: "var(--bsky-text-secondary)",
          }}
        >
          <Loader size={12} className="animate-spin" />
          <span>Loading quoted post...</span>
        </div>
      );
    }

    if (!quotedPost) return null;

    const record = quotedPost.record as { text?: string };
    return (
      <div
        className="mt-2 overflow-hidden rounded border"
        style={{ borderColor: "var(--bsky-border-primary)" }}
      >
        <div
          className="flex items-center gap-1.5 px-2 py-1 text-xs"
          style={{
            backgroundColor: "var(--bsky-bg-tertiary)",
            borderBottom: "1px solid var(--bsky-border-primary)",
            color: "var(--bsky-text-secondary)",
          }}
        >
          <MessageCircle size={10} />
          <span>Quoted post</span>
        </div>
        <div className="p-2">
          <div className="mb-1 flex items-center gap-1.5">
            <ProfileHoverCard handle={quotedPost.author.handle}>
              <img
                src={quotedPost.author.avatar || "/default-avatar.svg"}
                alt=""
                className="h-4 w-4 cursor-pointer rounded-full"
              />
            </ProfileHoverCard>
            <ProfileHoverCard handle={quotedPost.author.handle}>
              <span
                className="max-w-[150px] cursor-pointer truncate text-xs font-medium hover:underline"
                style={{ color: "var(--bsky-text-primary)" }}
              >
                {quotedPost.author.displayName || quotedPost.author.handle}
              </span>
            </ProfileHoverCard>
          </div>
          <p
            className="line-clamp-2 text-xs"
            style={{ color: "var(--bsky-text-primary)" }}
          >
            {record?.text || ""}
          </p>
        </div>
      </div>
    );
  },
);

NotificationQuotePreview.displayName = "NotificationQuotePreview";

export default RichNotificationItem;
