import type { AppBskyFeedDefs } from "@atproto/api";
import { Share } from "lucide-react";
import React, { memo, useCallback, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { useActionSyncOptional } from "../contexts/ActionSyncContext";
import { useBookmarks } from "../hooks/useBookmarks";
import {
  BookmarkIcon,
  HeartIcon,
  QuoteIcon,
  ReplyIcon,
  RepostIcon,
} from "./icons";
import { PostMenu } from "./PostMenu";
import { SyncStatusBadge } from "./SyncStatusBadge";

// Extracted constant styles to avoid creating new objects on every render
const repostMenuStyle: React.CSSProperties = {
  backgroundColor: "var(--bsky-bg-secondary)",
  borderColor: "var(--bsky-border-primary)",
  boxShadow: "var(--bsky-shadow-lg)",
};

interface PostActionBarProps {
  post: AppBskyFeedDefs.PostView;
  onReply?: () => void;
  onRepost?: () => void;
  onQuote?: () => void;
  onLike?: () => void;
  onBookmark?: () => void;
  onShare?: () => void;
  showCounts?: boolean;
  size?: "small" | "medium" | "large";
  isReplying?: boolean;
}

/**
 * Custom comparison function for PostActionBar memoization
 * Prevents unnecessary re-renders by comparing only relevant props
 */
function arePostActionBarPropsEqual(
  prevProps: PostActionBarProps,
  nextProps: PostActionBarProps,
): boolean {
  // Compare post identity and engagement stats
  if (prevProps.post.uri !== nextProps.post.uri) return false;
  if (prevProps.post.likeCount !== nextProps.post.likeCount) return false;
  if (prevProps.post.repostCount !== nextProps.post.repostCount) return false;
  if (prevProps.post.replyCount !== nextProps.post.replyCount) return false;

  // Compare viewer state
  if (prevProps.post.viewer?.like !== nextProps.post.viewer?.like) return false;
  if (prevProps.post.viewer?.repost !== nextProps.post.viewer?.repost)
    return false;

  // Compare UI props
  if (prevProps.showCounts !== nextProps.showCounts) return false;
  if (prevProps.size !== nextProps.size) return false;
  if (prevProps.isReplying !== nextProps.isReplying) return false;

  // Callbacks are expected to be stable (using useCallback in parent)
  return true;
}

const PostActionBarComponent: React.FC<PostActionBarProps> = ({
  post,
  onReply,
  onRepost,
  onQuote,
  onLike,
  onBookmark,
  onShare,
  showCounts = true,
  size = "medium",
  isReplying = false,
}) => {
  const { isBookmarked, toggleBookmark, getSyncStatus, getRetryFn } =
    useBookmarks();
  const actionSync = useActionSyncOptional();
  const [showRepostMenu, setShowRepostMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const repostButtonRef = useRef<HTMLButtonElement>(null);

  const iconSize = size === "small" ? 14 : size === "medium" ? 16 : 18;
  const isLiked = !!post.viewer?.like;
  const isReposted = !!post.viewer?.repost;
  const bookmarked = isBookmarked(post.uri);

  // Get sync statuses for each action
  const likeStatus = actionSync?.getActionStatus("like", post.uri) ?? "idle";
  const repostStatus =
    actionSync?.getActionStatus("repost", post.uri) ?? "idle";
  const bookmarkStatus = getSyncStatus?.(post.uri) ?? "idle";

  // Get retry functions
  const likeRetryFn = actionSync?.getRetryFn("like", post.uri);
  const repostRetryFn = actionSync?.getRetryFn("repost", post.uri);
  const bookmarkRetryFn = getRetryFn?.(post.uri);

  const handleAction = useCallback(
    (e: React.MouseEvent, action?: () => void) => {
      e.preventDefault();
      e.stopPropagation();
      action?.();
    },
    [],
  );

  const handleBookmark = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (onBookmark) {
        onBookmark();
      } else {
        toggleBookmark(post);
      }
    },
    [onBookmark, toggleBookmark, post],
  );

  return (
    <div
      className={`relative z-10 flex w-full select-none items-center justify-between ${
        size === "small"
          ? "mt-2 px-2 py-1.5"
          : size === "large"
            ? "mt-3 px-3 py-2.5"
            : "mt-2.5 px-2.5 py-2"
      }`}
      onClick={(e) => e.stopPropagation()}
      data-post-uri={post.uri}
    >
      {/* Reply */}
      <button
        className={`touch-target-sm flex cursor-pointer items-center gap-1.5 rounded-md border-none bg-transparent p-2 text-bsky-text-secondary spring-icon hover:text-blue-600 ${
          isReplying ? "text-blue-500" : ""
        }`}
        onClick={(e) => handleAction(e, onReply)}
        aria-label={`Reply to post${post.replyCount ? `, ${post.replyCount} replies` : ""}`}
        aria-pressed={isReplying}
      >
        <ReplyIcon size={iconSize} filled={isReplying} aria-hidden="true" />
        {showCounts && (
          <span
            className="min-w-[1rem] text-left text-xs font-medium"
            aria-hidden="true"
          >
            {post.replyCount || 0}
          </span>
        )}
      </button>

      {/* Repost/Quote */}
      <div className="relative">
        <button
          ref={repostButtonRef}
          className={`touch-target-sm relative flex cursor-pointer items-center gap-1.5 rounded-md border-none bg-transparent p-2 text-bsky-text-secondary spring-icon hover:text-green-600 ${
            isReposted ? "text-green-500" : ""
          }`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!showRepostMenu && repostButtonRef.current) {
              const rect = repostButtonRef.current.getBoundingClientRect();
              setMenuPosition({
                top: rect.top - 100, // Position above the button (100px = approximate menu height)
                left: rect.left,
              });
            }
            setShowRepostMenu(!showRepostMenu);
          }}
          aria-label={`Repost or quote post${post.repostCount ? `, ${post.repostCount} reposts` : ""}`}
          aria-expanded={showRepostMenu}
          aria-haspopup="menu"
        >
          <span className="relative">
            <RepostIcon size={iconSize} aria-hidden="true" />
            <SyncStatusBadge
              status={repostStatus}
              onRetry={repostRetryFn}
              size={size === "small" ? "small" : "small"}
            />
          </span>
          {showCounts && (
            <span
              className="min-w-[1rem] text-left text-xs font-medium"
              aria-hidden="true"
            >
              {post.repostCount || 0}
            </span>
          )}
        </button>

        {/* Repost menu dropdown */}
        {showRepostMenu &&
          menuPosition &&
          ReactDOM.createPortal(
            <>
              <div
                className="fixed inset-0 z-[9998]"
                onClick={() => setShowRepostMenu(false)}
                aria-hidden="true"
              />
              <div
                role="menu"
                aria-label="Repost options"
                className="fixed z-[9999] w-40 rounded-lg border shadow-lg"
                style={{
                  ...repostMenuStyle,
                  top: `${menuPosition.top}px`,
                  left: `${menuPosition.left}px`,
                }}
              >
                <button
                  role="menuitem"
                  className="flex min-h-[44px] w-full items-center gap-3 rounded-t-lg bg-transparent px-4 py-3 text-left text-sm text-bsky-text-primary transition-all hover:bg-bsky-bg-hover"
                  onClick={(e) => {
                    handleAction(e, onRepost);
                    setShowRepostMenu(false);
                  }}
                >
                  <RepostIcon size={16} aria-hidden="true" />
                  <span>Repost</span>
                </button>
                <button
                  role="menuitem"
                  className="flex min-h-[44px] w-full items-center gap-3 rounded-b-lg bg-transparent px-4 py-3 text-left text-sm text-bsky-text-primary transition-all hover:bg-bsky-bg-hover"
                  onClick={(e) => {
                    handleAction(e, onQuote);
                    setShowRepostMenu(false);
                  }}
                >
                  <QuoteIcon size={16} aria-hidden="true" />
                  <span>Quote</span>
                </button>
              </div>
            </>,
            document.body,
          )}
      </div>

      {/* Like */}
      <button
        className={`touch-target-sm relative flex cursor-pointer items-center gap-1.5 rounded-md border-none bg-transparent p-2 text-bsky-text-secondary spring-icon hover:text-red-600 ${
          isLiked ? "text-red-500" : ""
        }`}
        onClick={(e) => handleAction(e, onLike)}
        aria-label={`${isLiked ? "Unlike" : "Like"} post${post.likeCount ? `, ${post.likeCount} likes` : ""}`}
        aria-pressed={isLiked}
      >
        <span className="relative">
          <HeartIcon size={iconSize} filled={isLiked} aria-hidden="true" />
          <SyncStatusBadge
            status={likeStatus}
            onRetry={likeRetryFn}
            size={size === "small" ? "small" : "small"}
          />
        </span>
        {showCounts && (
          <span
            className="min-w-[1rem] text-left text-xs font-medium"
            aria-hidden="true"
          >
            {post.likeCount || 0}
          </span>
        )}
      </button>

      {/* Bookmark */}
      <button
        className={`touch-target-sm relative flex cursor-pointer items-center gap-1.5 rounded-md border-none bg-transparent p-2 text-bsky-text-secondary spring-icon hover:text-amber-600 ${
          bookmarked ? "text-amber-500" : ""
        }`}
        onClick={handleBookmark}
        aria-label={bookmarked ? "Remove bookmark" : "Bookmark post"}
        aria-pressed={bookmarked}
      >
        <span className="relative">
          <BookmarkIcon
            size={iconSize}
            filled={bookmarked}
            className={`transition-all duration-200 ease-out ${bookmarked ? "animate-bookmark-fill" : ""}`}
            aria-hidden="true"
          />
          <SyncStatusBadge
            status={bookmarkStatus}
            onRetry={bookmarkRetryFn}
            size={size === "small" ? "small" : "small"}
          />
        </span>
      </button>

      {/* Share */}
      {onShare && (
        <button
          className="touch-target-sm flex cursor-pointer items-center gap-1.5 rounded-md border-none bg-transparent p-2 text-bsky-text-secondary spring-icon hover:text-blue-600"
          onClick={(e) => handleAction(e, onShare)}
          aria-label="Share post"
        >
          <Share size={iconSize} aria-hidden="true" />
        </button>
      )}

      {/* More Options Menu */}
      <PostMenu post={post} className="ml-2" />
    </div>
  );
};

/**
 * Memoized PostActionBar for optimal feed scroll performance
 * Uses custom comparator to prevent cascading re-renders
 */
export const PostActionBar = memo(
  PostActionBarComponent,
  arePostActionBarPropsEqual,
);
