import type { AppBskyFeedDefs } from "@atproto/api";
import {
  Bookmark,
  Heart,
  MessageCircle,
  Quote,
  Repeat2,
  Share,
} from "lucide-react";
import React, { memo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { useBookmarks } from "../hooks/useBookmarks";
import { PostMenu } from "./PostMenu";

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

export const PostActionBar: React.FC<PostActionBarProps> = memo(
  ({
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
    const { isBookmarked, toggleBookmark } = useBookmarks();
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

    const handleAction = (e: React.MouseEvent, action?: () => void) => {
      e.preventDefault();
      e.stopPropagation();
      action?.();
    };

    const handleBookmark = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (onBookmark) {
        onBookmark();
      } else {
        toggleBookmark(post);
      }
    };

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
          className={`touch-target-sm flex cursor-pointer items-center gap-1.5 rounded-md border-none bg-transparent p-2 text-bsky-text-secondary transition-all duration-150 hover:scale-110 hover:text-blue-600 ${
            isReplying ? "text-blue-500" : ""
          }`}
          onClick={(e) => handleAction(e, onReply)}
          aria-label="Reply"
        >
          <MessageCircle
            size={iconSize}
            fill={isReplying ? "currentColor" : "none"}
          />
          {showCounts && (
            <span className="min-w-[1rem] text-left text-xs font-medium">
              {post.replyCount || 0}
            </span>
          )}
        </button>

        {/* Repost/Quote */}
        <div className="relative">
          <button
            ref={repostButtonRef}
            className={`touch-target-sm flex cursor-pointer items-center gap-1.5 rounded-md border-none bg-transparent p-2 text-bsky-text-secondary transition-all duration-150 hover:scale-110 hover:text-green-600 ${
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
            aria-label="Repost or Quote"
          >
            <Repeat2 size={iconSize} />
            {showCounts && (
              <span className="min-w-[1rem] text-left text-xs font-medium">
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
                />
                <div
                  className="fixed z-[9999] w-40 rounded-lg border shadow-lg"
                  style={{
                    backgroundColor: "var(--bsky-bg-secondary)",
                    borderColor: "var(--bsky-border-primary)",
                    boxShadow: "var(--bsky-shadow-lg)",
                    top: `${menuPosition.top}px`,
                    left: `${menuPosition.left}px`,
                  }}
                >
                  <button
                    className="flex w-full items-center gap-3 rounded-t-lg px-4 py-3 text-left text-sm transition-all"
                    style={{ color: "var(--bsky-text-primary)" }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.backgroundColor =
                        "var(--bsky-bg-hover)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.backgroundColor = "transparent")
                    }
                    onClick={(e) => {
                      handleAction(e, onRepost);
                      setShowRepostMenu(false);
                    }}
                  >
                    <Repeat2 size={16} />
                    <span>Repost</span>
                  </button>
                  <button
                    className="flex w-full items-center gap-3 rounded-b-lg px-4 py-3 text-left text-sm transition-all"
                    style={{ color: "var(--bsky-text-primary)" }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.backgroundColor =
                        "var(--bsky-bg-hover)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.backgroundColor = "transparent")
                    }
                    onClick={(e) => {
                      handleAction(e, onQuote);
                      setShowRepostMenu(false);
                    }}
                  >
                    <Quote size={16} />
                    <span>Quote</span>
                  </button>
                </div>
              </>,
              document.body,
            )}
        </div>

        {/* Like */}
        <button
          className={`touch-target-sm flex cursor-pointer items-center gap-1.5 rounded-md border-none bg-transparent p-2 text-bsky-text-secondary transition-all duration-150 hover:scale-110 hover:text-red-600 ${
            isLiked ? "text-red-500" : ""
          }`}
          onClick={(e) => handleAction(e, onLike)}
          aria-label="Like"
        >
          <Heart size={iconSize} fill={isLiked ? "currentColor" : "none"} />
          {showCounts && (
            <span className="min-w-[1rem] text-left text-xs font-medium">
              {post.likeCount || 0}
            </span>
          )}
        </button>

        {/* Bookmark */}
        <button
          className={`touch-target-sm flex cursor-pointer items-center gap-1.5 rounded-md border-none bg-transparent p-2 text-bsky-text-secondary transition-all duration-150 hover:scale-110 hover:text-amber-600 ${
            bookmarked ? "text-amber-500" : ""
          }`}
          onClick={handleBookmark}
          aria-label="Bookmark"
        >
          <Bookmark
            size={iconSize}
            fill={bookmarked ? "currentColor" : "none"}
            className={`transition-all duration-200 ease-out ${bookmarked ? "animate-bookmark-fill" : ""}`}
          />
        </button>

        {/* Share */}
        {onShare && (
          <button
            className="touch-target-sm flex cursor-pointer items-center gap-1.5 rounded-md border-none bg-transparent p-2 text-bsky-text-secondary transition-all duration-150 hover:scale-110 hover:text-blue-600"
            onClick={(e) => handleAction(e, onShare)}
            aria-label="Share"
          >
            <Share size={iconSize} />
          </button>
        )}

        {/* More Options Menu */}
        <PostMenu post={post} className="ml-2" />
      </div>
    );
  },
);
