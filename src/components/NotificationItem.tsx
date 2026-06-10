/**
 * NotificationItem — a single (non-aggregated) notification row. Extracted from
 * NotificationsFeed to keep that component focused on the list/filters.
 */

import type { AppBskyNotificationListNotifications } from "@atproto/api";
import { formatDistanceToNow } from "date-fns";
import React from "react";
import { Link } from "react-router";
import { useRoutePrefetch } from "../hooks/useRoutePrefetch";
import { useViewTransitionNavigate } from "../hooks/useViewTransitionNavigate";
import { proxifyBskyImage } from "../utils/image-proxy";
import { getNotificationUrl } from "../utils/url-helpers";
import { ImageGrid } from "./ImageGrid";
import { DomainVerifiedBadgeInline } from "./ui/DomainVerifiedBadge";
import { ProfileHoverCard } from "./ui/ProfileHoverCard";

function getNotificationText(reason: string): string {
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
    case "starterpack-joined":
      return "joined via your starterpack";
    default:
      return "interacted with your post";
  }
}

interface NotificationItemProps {
  notification: AppBskyNotificationListNotifications.Notification;
  postMap: Map<string, any>;
  getNotificationIcon: (reason: string) => React.ReactNode;
  showTypeLabel?: boolean;
  isFetchingMore?: boolean;
  fetchedPosts?: number;
  totalPosts?: number;
  setSelectedPostUri: (uri: string | null) => void;
  markAsRead: () => void;
  isNew?: boolean;
}

export const NotificationItem: React.FC<NotificationItemProps> = React.memo(
  ({
    notification,
    postMap,
    getNotificationIcon,
    showTypeLabel = false,
    isFetchingMore = false,
    fetchedPosts = 0,
    totalPosts = 0,
    setSelectedPostUri,
    markAsRead,
    isNew = false,
  }) => {
    const navigate = useViewTransitionNavigate();
    const { getThreadPrefetchHandlers, getProfilePrefetchHandlers } =
      useRoutePrefetch();
    // Get the post for all notification types that reference posts
    // For reposts and likes, use reasonSubject which contains the original post URI
    const postUri =
      (notification.reason === "repost" || notification.reason === "like") &&
      notification.reasonSubject
        ? notification.reasonSubject
        : notification.uri;

    const post = ["like", "repost", "reply", "quote"].includes(
      notification.reason,
    )
      ? postMap.get(postUri)
      : undefined;
    const postAuthorHandle = post?.author?.handle;

    const notificationUrl = getNotificationUrl(notification, postAuthorHandle);

    // Get notification type label
    const getNotificationTypeLabel = (reason: string): string => {
      switch (reason) {
        case "like":
          return "Like";
        case "repost":
          return "Repost";
        case "follow":
          return "Follow";
        case "mention":
          return "Mention";
        case "reply":
          return "Reply";
        case "quote":
          return "Quote";
        case "starterpack-joined":
          return "Starterpack Join";
        default:
          return reason.charAt(0).toUpperCase() + reason.slice(1);
      }
    };

    // Helper to render post content box
    const renderPostContent = () => {
      // For likes, reposts, replies, and quotes - show loading state if post not yet loaded
      if (["like", "repost", "reply", "quote"].includes(notification.reason)) {
        if (!post) {
          // Don't show loading indicator for individual posts during progressive loading
          // Only show "unable to load" if we've finished fetching and still don't have the post
          if (!isFetchingMore || fetchedPosts >= totalPosts) {
            // Post couldn't be loaded or doesn't exist
            return (
              <div
                className="mt-3 rounded-lg p-4"
                style={{
                  backgroundColor: "var(--asph-bg-secondary)",
                  border: "1px solid var(--asph-border-primary)",
                  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
                }}
              >
                <p
                  className="text-sm italic"
                  style={{ color: "var(--asph-text-tertiary)" }}
                >
                  Post unavailable
                </p>
              </div>
            );
          }
          // Return null during progressive loading to avoid flicker
          return null;
        }
      }

      // For likes, reposts, replies, and quotes - show the referenced post
      if (
        ["like", "repost", "reply", "quote"].includes(notification.reason) &&
        post
      ) {
        const hasImages =
          post.embed?.$type === "app.bsky.embed.images#view" ||
          (post.embed?.$type === "app.bsky.embed.recordWithMedia#view" &&
            post.embed.media?.$type === "app.bsky.embed.images#view");
        const hasVideo =
          post.embed?.$type === "app.bsky.embed.video#view" ||
          (post.embed?.$type === "app.bsky.embed.recordWithMedia#view" &&
            post.embed.media?.$type === "app.bsky.embed.video#view");
        const hasExternal =
          post.embed?.$type === "app.bsky.embed.external#view" ||
          (post.embed?.$type === "app.bsky.embed.recordWithMedia#view" &&
            post.embed.media?.$type === "app.bsky.embed.external#view");
        const hasMedia = hasImages || hasVideo || hasExternal;

        return (
          <div className="mt-2 rounded-md border border-asph-border-primary bg-asph-bg-secondary p-2.5">
            <div className="mb-1 flex items-center gap-1.5">
              <span className="text-xs font-medium text-asph-text-tertiary">
                {notification.reason === "reply"
                  ? "Replying to your post:"
                  : notification.reason === "quote"
                    ? "Quoting your post:"
                    : "Your post:"}
              </span>
              {post.author?.handle && (
                <ProfileHoverCard handle={post.author.handle}>
                  <Link
                    to={`/profile/${post.author.handle}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {post.author?.avatar ? (
                      <img
                        src={proxifyBskyImage(post.author.avatar)}
                        alt={post.author.handle}
                        className="asph-avatar h-5 w-5 transition-opacity hover:opacity-80"
                      />
                    ) : (
                      <div
                        className="asph-avatar flex h-5 w-5 items-center justify-center text-xs transition-opacity hover:opacity-80"
                        style={{ background: "var(--asph-bg-tertiary)" }}
                      >
                        {post.author?.handle?.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </Link>
                </ProfileHoverCard>
              )}
              {post.author?.handle ? (
                <ProfileHoverCard handle={post.author.handle}>
                  <Link
                    to={`/profile/${post.author.handle}`}
                    className="inline-flex items-center text-xs font-medium no-underline hover:underline"
                    style={{ color: "var(--asph-text-secondary)" }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span>
                      {post.author?.displayName ||
                        post.author?.handle ||
                        "Unknown"}
                    </span>
                    <DomainVerifiedBadgeInline handle={post.author.handle} />
                  </Link>
                </ProfileHoverCard>
              ) : (
                <span className="inline-flex items-center text-xs font-medium text-asph-text-secondary">
                  <span>
                    {post.author?.displayName ||
                      post.author?.handle ||
                      "Unknown"}
                  </span>
                </span>
              )}
              {hasMedia && (
                <span
                  className="flex items-center gap-1 text-xs"
                  style={{ color: "var(--asph-text-tertiary)" }}
                >
                  · {hasVideo ? "🎬" : hasExternal ? "🔗" : "📷"}
                </span>
              )}
            </div>

            {post.record?.text && (
              <p className="text-sm leading-relaxed text-asph-text-primary">
                {post.record.text}
              </p>
            )}

            {/* Display media if present */}
            {(() => {
              if (!post.embed) return null;

              const embed = post.embed as any;

              // Handle video embeds
              if (embed.$type === "app.bsky.embed.video#view") {
                return (
                  <div className="mt-2">
                    <div
                      className="relative overflow-hidden rounded-lg border bg-asph-bg-tertiary"
                      style={{
                        borderColor: "var(--asph-border-primary)",
                        aspectRatio: "16/9",
                        maxHeight: "200px",
                      }}
                    >
                      {embed.thumbnail ? (
                        <img
                          src={proxifyBskyImage(embed.thumbnail)}
                          alt="Video thumbnail"
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <span style={{ color: "var(--asph-text-tertiary)" }}>
                            Video
                          </span>
                        </div>
                      )}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div
                          className="flex h-12 w-12 items-center justify-center rounded-full"
                          style={{
                            backgroundColor: "rgba(0, 0, 0, 0.6)",
                          }}
                        >
                          <svg
                            className="h-6 w-6 text-white"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              // Handle video in recordWithMedia
              if (
                embed.$type === "app.bsky.embed.recordWithMedia#view" &&
                embed.media?.$type === "app.bsky.embed.video#view"
              ) {
                const video = embed.media;
                return (
                  <div className="mt-2">
                    <div
                      className="relative overflow-hidden rounded-lg border bg-asph-bg-tertiary"
                      style={{
                        borderColor: "var(--asph-border-primary)",
                        aspectRatio: "16/9",
                        maxHeight: "200px",
                      }}
                    >
                      {video.thumbnail ? (
                        <img
                          src={proxifyBskyImage(video.thumbnail)}
                          alt="Video thumbnail"
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <span style={{ color: "var(--asph-text-tertiary)" }}>
                            Video
                          </span>
                        </div>
                      )}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div
                          className="flex h-12 w-12 items-center justify-center rounded-full"
                          style={{
                            backgroundColor: "rgba(0, 0, 0, 0.6)",
                          }}
                        >
                          <svg
                            className="h-6 w-6 text-white"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              // Handle external embeds (link cards, GIFs)
              if (embed.$type === "app.bsky.embed.external#view") {
                const external = embed.external;
                if (external?.thumb || external?.uri) {
                  // Check if it's a GIF - use the actual URI for animation
                  const isGif =
                    external.uri?.toLowerCase().includes(".gif") ||
                    external.uri?.includes("tenor.com") ||
                    external.uri?.includes("giphy.com");
                  const imageSrc = isGif
                    ? external.uri
                    : proxifyBskyImage(external.thumb);

                  return (
                    <div className="mt-2">
                      <div
                        className="overflow-hidden rounded-lg border bg-asph-bg-tertiary"
                        style={{
                          borderColor: "var(--asph-border-primary)",
                        }}
                      >
                        <img
                          src={imageSrc}
                          alt={external.title || "Link preview"}
                          className="w-full object-contain"
                          style={{ maxHeight: "250px" }}
                          loading="lazy"
                        />
                        {external.title && !isGif && (
                          <div
                            className="p-2 text-xs"
                            style={{ color: "var(--asph-text-secondary)" }}
                          >
                            {external.title}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }
              }

              // Handle external in recordWithMedia
              if (
                embed.$type === "app.bsky.embed.recordWithMedia#view" &&
                embed.media?.$type === "app.bsky.embed.external#view"
              ) {
                const external = embed.media.external;
                if (external?.thumb || external?.uri) {
                  // Check if it's a GIF - use the actual URI for animation
                  const isGif =
                    external.uri?.toLowerCase().includes(".gif") ||
                    external.uri?.includes("tenor.com") ||
                    external.uri?.includes("giphy.com");
                  const imageSrc = isGif
                    ? external.uri
                    : proxifyBskyImage(external.thumb);
                  return (
                    <div className="mt-2">
                      <div
                        className="overflow-hidden rounded-lg border bg-asph-bg-tertiary"
                        style={{
                          borderColor: "var(--asph-border-primary)",
                        }}
                      >
                        <img
                          src={imageSrc}
                          alt={external.title || "Link preview"}
                          className="w-full object-contain"
                          style={{ maxHeight: "250px" }}
                          loading="lazy"
                        />
                        {external.title && !isGif && (
                          <div
                            className="p-2 text-xs"
                            style={{ color: "var(--asph-text-secondary)" }}
                          >
                            {external.title}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }
              }

              let images: Array<{
                thumb: string;
                fullsize: string;
                alt?: string;
              }> = [];

              // Extract images from different embed types
              if (
                embed.$type === "app.bsky.embed.images#view" &&
                embed.images
              ) {
                images = embed.images;
              } else if (
                embed.$type === "app.bsky.embed.recordWithMedia#view" &&
                embed.media?.$type === "app.bsky.embed.images#view" &&
                embed.media.images
              ) {
                images = embed.media.images;
              }

              if (images.length === 0) return null;

              return (
                <ImageGrid
                  images={images.map((img) => ({
                    thumb: img.thumb,
                    fullsize: img.fullsize,
                    alt: img.alt,
                  }))}
                  className="mt-3"
                />
              );
            })()}
          </div>
        );
      }

      // For mentions - show the post where you were mentioned
      if (
        notification.reason === "mention" &&
        notification.record &&
        typeof notification.record === "object" &&
        "text" in notification.record
      ) {
        return (
          <div className="mt-2 rounded-md border border-asph-border-primary bg-asph-bg-secondary p-2.5">
            <p className="text-sm leading-relaxed text-asph-text-primary">
              {(notification.record as { text?: string }).text}
            </p>
          </div>
        );
      }

      // For follows - no post to show
      if (notification.reason === "follow") {
        return null;
      }

      // Fallback for any other notification types with record text
      if (
        notification.record &&
        typeof notification.record === "object" &&
        "text" in notification.record
      ) {
        return (
          <div className="mt-2 rounded-md border border-asph-border-primary bg-asph-bg-secondary p-2.5">
            <p
              className="text-sm"
              style={{ color: "var(--asph-text-primary)", lineHeight: "1.5" }}
            >
              {(notification.record as { text?: string }).text}
            </p>
          </div>
        );
      }

      return null;
    };

    const handleNotificationClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      // Let browser handle modified clicks natively (open in new tab)
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0)
        return;
      e.preventDefault();

      // Mark notification as read when clicked
      if (!notification.isRead) {
        markAsRead();
      }

      // For likes, reposts, replies, mentions, and quotes - open thread modal
      if (
        ["like", "repost", "reply", "mention", "quote"].includes(
          notification.reason,
        )
      ) {
        // Use the postUri we calculated above which handles reasonSubject correctly
        setSelectedPostUri(postUri);
      } else if (notification.reason === "follow") {
        // For follows, navigate to the follower's profile
        navigate(`/profile/${notification.author.handle}`);
      } else {
        // Fallback - navigate if we have a URL
        if (notificationUrl.startsWith("/")) {
          navigate(notificationUrl);
        } else {
          window.open(notificationUrl, "_blank");
        }
      }
    };

    const authorProfileUrl = `/profile/${notification.author.handle}`;

    // Prefetch handlers for this notification
    const threadHandlers = postUri
      ? getThreadPrefetchHandlers(postUri)
      : undefined;
    const authorProfileHandlers = getProfilePrefetchHandlers(
      notification.author.handle,
    );

    return (
      <Link
        to={notificationUrl}
        className={`asph-notification block cursor-pointer px-3 py-2 no-underline ${
          !notification.isRead ? "asph-notification-unread" : ""
        } ${isNew ? "asph-notification-new" : ""}`}
        style={{ color: "inherit" }}
        onClickCapture={(e: React.MouseEvent) => {
          const target = e.target as HTMLElement;
          if (target.closest('button, [role="button"]')) {
            e.preventDefault();
          }
        }}
        onMouseEnter={() => {
          // Prefetch thread data for post-related notifications
          if (threadHandlers) threadHandlers.onMouseEnter();
          // Also prefetch the author's profile
          authorProfileHandlers.onMouseEnter();
        }}
        onMouseLeave={() => {
          if (threadHandlers) threadHandlers.onMouseLeave();
          authorProfileHandlers.onMouseLeave();
        }}
        onClick={handleNotificationClick}
      >
        <div className="flex items-start gap-2">
          {/* Icon and Avatar section */}
          <div className="flex flex-shrink-0 items-center gap-2">
            <div className="w-5">
              {getNotificationIcon(notification.reason)}
            </div>
            <ProfileHoverCard handle={notification.author.handle}>
              <Link
                to={authorProfileUrl}
                onClick={(e) => e.stopPropagation()}
                {...authorProfileHandlers}
              >
                {notification.author.avatar ? (
                  <img
                    src={proxifyBskyImage(notification.author.avatar)}
                    alt={notification.author.handle}
                    className="asph-avatar h-10 w-10 transition-opacity hover:opacity-80"
                  />
                ) : (
                  <div
                    className="asph-avatar flex h-10 w-10 items-center justify-center transition-opacity hover:opacity-80"
                    style={{ background: "var(--asph-bg-tertiary)" }}
                  >
                    <span className="text-sm font-semibold">
                      {notification.author?.handle?.charAt(0).toUpperCase() ||
                        "U"}
                    </span>
                  </div>
                )}
              </Link>
            </ProfileHoverCard>
          </div>

          {/* User info and timestamp */}
          <div className="min-w-0 flex-1">
            {showTypeLabel && (
              <div className="mb-0.5 flex items-center gap-2">
                <span
                  className="rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{
                    backgroundColor: "var(--asph-bg-secondary)",
                    color: "var(--asph-text-secondary)",
                    border: "1px solid var(--asph-border-primary)",
                  }}
                >
                  {getNotificationTypeLabel(notification.reason)}
                </span>
              </div>
            )}
            <p className="text-sm">
              <ProfileHoverCard handle={notification.author.handle}>
                <Link
                  to={authorProfileUrl}
                  className="inline-flex items-center no-underline hover:underline"
                  style={{ color: "var(--asph-text-primary)" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="font-semibold">
                    {notification.author.displayName ||
                      notification.author.handle}
                  </span>
                  <DomainVerifiedBadgeInline
                    handle={notification.author.handle}
                  />
                </Link>
              </ProfileHoverCard>{" "}
              <span style={{ color: "var(--asph-text-secondary)" }}>
                {getNotificationText(notification.reason)}
              </span>
              <span
                className="ml-1 text-xs"
                style={{ color: "var(--asph-text-tertiary)" }}
              >
                ·{" "}
                {formatDistanceToNow(new Date(notification.indexedAt), {
                  addSuffix: true,
                })}
              </span>
            </p>
          </div>
        </div>

        {/* Show the referenced post content below, with left margin to align with profile picture */}
        {(() => {
          const postContent = renderPostContent();
          return postContent ? (
            <div className="ml-[1.75rem] mt-2">{postContent}</div>
          ) : null;
        })()}
      </Link>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison for performance
    // Only re-render if notification data changes or post data is loaded/updated
    return (
      prevProps.notification.uri === nextProps.notification.uri &&
      prevProps.notification.isRead === nextProps.notification.isRead &&
      prevProps.notification.indexedAt === nextProps.notification.indexedAt &&
      prevProps.showTypeLabel === nextProps.showTypeLabel &&
      prevProps.isFetchingMore === nextProps.isFetchingMore &&
      prevProps.isNew === nextProps.isNew &&
      // Check if post in map has changed (for this notification's post)
      prevProps.postMap.get(
        (prevProps.notification.reason === "repost" ||
          prevProps.notification.reason === "like") &&
          prevProps.notification.reasonSubject
          ? prevProps.notification.reasonSubject
          : prevProps.notification.uri,
      ) ===
        nextProps.postMap.get(
          (nextProps.notification.reason === "repost" ||
            nextProps.notification.reason === "like") &&
            nextProps.notification.reasonSubject
            ? nextProps.notification.reasonSubject
            : nextProps.notification.uri,
        )
    );
  },
);

NotificationItem.displayName = "NotificationItem";
