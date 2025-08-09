import type { AppBskyFeedDefs } from "@atproto/api";
import { Bookmark, Heart, MessageCircle, Repeat2, Share } from "lucide-react";
import React, { memo } from "react";
import { useBookmarks } from "../hooks/useBookmarks";

interface PostActionBarProps {
  post: AppBskyFeedDefs.PostView;
  onReply?: () => void;
  onRepost?: () => void;
  onLike?: () => void;
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
    onLike,
    onShare,
    showCounts = true,
    size = "medium",
    isReplying = false,
  }) => {
    const { isBookmarked, toggleBookmark } = useBookmarks();

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
      toggleBookmark(post);
    };

    return (
      <div
        className={`flex items-center justify-between w-full relative z-10 select-none rounded-lg bg-bsky-bg-secondary ${
          size === "small" ? "py-1.5 mt-2 px-2" : size === "large" ? "py-2.5 mt-3 px-3" : "py-2 mt-2.5 px-2.5"
        }`}
        onClick={(e) => e.stopPropagation()}
        data-post-uri={post.uri}
      >
        {/* Reply */}
        <button
          className={`flex items-center gap-1.5 p-2 rounded-md border-none bg-transparent cursor-pointer text-bsky-text-secondary transition-all duration-200 ease-out hover:bg-blue-500/10 hover:text-blue-500 active:scale-95 ${
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
            <span className="text-xs font-medium min-w-[1rem] text-left">{post.replyCount || 0}</span>
          )}
        </button>

        {/* Repost */}
        <button
          className={`flex items-center gap-1.5 p-2 rounded-md border-none bg-transparent cursor-pointer text-bsky-text-secondary transition-all duration-200 ease-out hover:bg-green-500/10 hover:text-green-500 active:scale-95 ${
            isReposted ? "text-green-500" : ""
          }`}
          onClick={(e) => handleAction(e, onRepost)}
          aria-label="Repost"
        >
          <Repeat2 size={iconSize} />
          {showCounts && (
            <span className="text-xs font-medium min-w-[1rem] text-left">{post.repostCount || 0}</span>
          )}
        </button>

        {/* Like */}
        <button
          className={`flex items-center gap-1.5 p-2 rounded-md border-none bg-transparent cursor-pointer text-bsky-text-secondary transition-all duration-200 ease-out hover:bg-red-500/10 hover:text-red-500 active:scale-95 ${
            isLiked ? "text-red-500" : ""
          }`}
          onClick={(e) => handleAction(e, onLike)}
          aria-label="Like"
        >
          <Heart size={iconSize} fill={isLiked ? "currentColor" : "none"} />
          {showCounts && (
            <span className="text-xs font-medium min-w-[1rem] text-left">{post.likeCount || 0}</span>
          )}
        </button>

        {/* Bookmark */}
        <button
          className={`flex items-center gap-1.5 p-2 rounded-md border-none bg-transparent cursor-pointer text-bsky-text-secondary transition-all duration-200 ease-out hover:bg-amber-500/10 hover:text-amber-500 active:scale-95 ${
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
            className="flex items-center gap-1.5 p-2 rounded-md border-none bg-transparent cursor-pointer text-bsky-text-secondary transition-all duration-200 ease-out hover:bg-blue-500/10 hover:text-blue-500 active:scale-95"
            onClick={(e) => handleAction(e, onShare)}
            aria-label="Share"
          >
            <Share size={iconSize} />
          </button>
        )}
      </div>
    );
  },
);