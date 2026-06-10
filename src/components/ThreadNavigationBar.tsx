import type { AppBskyFeedDefs } from "@atproto/api";
import {
  ArrowUpToLine,
  Bookmark,
  BookmarkCheck,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  GitBranch,
  Home,
  Share2,
} from "lucide-react";
import React, { useCallback, useState } from "react";
import { useBookmarks } from "../hooks/useBookmarks";

type Post = AppBskyFeedDefs.PostView;

interface ThreadNavigationBarProps {
  rootPost?: Post;
  currentPost?: Post;
  parentPost?: Post;
  siblingPosts?: { prev?: Post; next?: Post; current: number; total: number };
  totalPosts: number;
  currentIndex: number;
  onJumpToRoot?: () => void;
  onJumpToParent?: () => void;
  onJumpToPrevSibling?: () => void;
  onJumpToNextSibling?: () => void;
  className?: string;
}

export const ThreadNavigationBar: React.FC<ThreadNavigationBarProps> = ({
  rootPost,
  currentPost: _currentPost,
  parentPost,
  siblingPosts,
  totalPosts,
  currentIndex,
  onJumpToRoot,
  onJumpToParent,
  onJumpToPrevSibling,
  onJumpToNextSibling,
  className = "",
}) => {
  const { isBookmarked, toggleBookmark } = useBookmarks();
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const isRootBookmarked = rootPost ? isBookmarked(rootPost.uri) : false;

  // Generate share URL for the thread
  const getThreadUrl = useCallback(() => {
    if (!rootPost) return "";
    const postId = rootPost.uri.split("/").pop();
    return `${window.location.origin}/thread/${rootPost.author.handle}/${postId}`;
  }, [rootPost]);

  const getBskyUrl = useCallback(() => {
    if (!rootPost) return "";
    const postId = rootPost.uri.split("/").pop();
    return `https://bsky.app/profile/${rootPost.author.handle}/post/${postId}`;
  }, [rootPost]);

  // Copy thread link
  const handleCopyLink = useCallback(async () => {
    const url = getThreadUrl();
    try {
      await navigator.clipboard.writeText(url);
      setCopyFeedback("Copied!");
      setTimeout(() => setCopyFeedback(null), 2000);
    } catch {
      setCopyFeedback("Failed to copy");
      setTimeout(() => setCopyFeedback(null), 2000);
    }
    setShowShareMenu(false);
  }, [getThreadUrl]);

  // Open in Bluesky
  const handleOpenInBluesky = useCallback(() => {
    const url = getBskyUrl();
    window.open(url, "_blank", "noopener,noreferrer");
    setShowShareMenu(false);
  }, [getBskyUrl]);

  // Native share
  const handleNativeShare = useCallback(async () => {
    const url = getThreadUrl();
    const title = rootPost ? `Thread by @${rootPost.author.handle}` : "Thread";

    if (navigator.share) {
      try {
        await navigator.share({
          title,
          url,
        });
      } catch {
        // User cancelled or share failed
      }
    } else {
      handleCopyLink();
    }
    setShowShareMenu(false);
  }, [getThreadUrl, rootPost, handleCopyLink]);

  // Toggle bookmark for thread root
  const handleToggleBookmark = useCallback(() => {
    if (rootPost) {
      toggleBookmark(rootPost);
    }
  }, [rootPost, toggleBookmark]);

  const hasParent = !!parentPost;
  const hasSiblings = siblingPosts && siblingPosts.total > 1;
  const hasPrevSibling = siblingPosts?.prev !== undefined;
  const hasNextSibling = siblingPosts?.next !== undefined;

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2 ${className}`}
      style={{
        backgroundColor: "var(--asph-bg-secondary)",
        border: "1px solid var(--asph-border-primary)",
      }}
    >
      {/* Navigation controls */}
      <div className="flex items-center gap-1">
        {/* Jump to root */}
        <button
          onClick={onJumpToRoot}
          disabled={!rootPost || currentIndex === 0}
          className="touch-target-sm flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm transition-all hover:bg-asph-bg-active disabled:cursor-not-allowed disabled:opacity-40"
          style={{ color: "var(--asph-text-secondary)" }}
          title="Jump to thread root (r)"
        >
          <Home size={16} />
          <span className="hidden sm:inline">Root</span>
        </button>

        {/* Divider */}
        <div
          className="mx-1 h-5 w-px"
          style={{ backgroundColor: "var(--asph-border-primary)" }}
        />

        {/* Jump to parent */}
        <button
          onClick={onJumpToParent}
          disabled={!hasParent}
          className="touch-target-sm flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm transition-all hover:bg-asph-bg-active disabled:cursor-not-allowed disabled:opacity-40"
          style={{ color: "var(--asph-text-secondary)" }}
          title="Jump to parent post (p)"
        >
          <ArrowUpToLine size={16} />
          <span className="hidden sm:inline">Parent</span>
        </button>

        {/* Sibling navigation */}
        {hasSiblings && (
          <>
            <div
              className="mx-1 h-5 w-px"
              style={{ backgroundColor: "var(--asph-border-primary)" }}
            />

            <div className="flex items-center gap-1">
              <button
                onClick={onJumpToPrevSibling}
                disabled={!hasPrevSibling}
                className="touch-target-icon rounded-lg p-1.5 transition-all hover:bg-asph-bg-active disabled:cursor-not-allowed disabled:opacity-40"
                style={{ color: "var(--asph-text-secondary)" }}
                title="Previous sibling (h)"
              >
                <ChevronLeft size={16} />
              </button>

              <span
                className="flex items-center gap-1 text-xs font-medium"
                style={{ color: "var(--asph-text-tertiary)" }}
              >
                <GitBranch size={12} />
                {siblingPosts.current + 1}/{siblingPosts.total}
              </span>

              <button
                onClick={onJumpToNextSibling}
                disabled={!hasNextSibling}
                className="touch-target-icon rounded-lg p-1.5 transition-all hover:bg-asph-bg-active disabled:cursor-not-allowed disabled:opacity-40"
                style={{ color: "var(--asph-text-secondary)" }}
                title="Next sibling (l)"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Position indicator */}
      <div
        className="hidden text-xs sm:block"
        style={{ color: "var(--asph-text-tertiary)" }}
      >
        Post {currentIndex + 1} of {totalPosts}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        {/* Bookmark thread */}
        <button
          onClick={handleToggleBookmark}
          disabled={!rootPost}
          className={`touch-target flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm transition-all hover:bg-asph-bg-active disabled:cursor-not-allowed disabled:opacity-40 ${
            isRootBookmarked ? "text-amber-500" : ""
          }`}
          style={{
            color: isRootBookmarked ? undefined : "var(--asph-text-secondary)",
          }}
          title={
            isRootBookmarked ? "Remove thread bookmark" : "Bookmark thread"
          }
        >
          {isRootBookmarked ? (
            <BookmarkCheck size={16} fill="currentColor" />
          ) : (
            <Bookmark size={16} />
          )}
          <span className="hidden sm:inline">
            {isRootBookmarked ? "Saved" : "Save"}
          </span>
        </button>

        {/* Share menu */}
        <div className="relative">
          <button
            onClick={() => setShowShareMenu(!showShareMenu)}
            className="touch-target-sm flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm transition-all hover:bg-asph-bg-active"
            style={{ color: "var(--asph-text-secondary)" }}
            title="Share thread"
          >
            <Share2 size={16} />
            <span className="hidden sm:inline">Share</span>
          </button>

          {showShareMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowShareMenu(false)}
              />
              <div
                className="absolute right-0 top-full z-50 mt-1 w-48 rounded-lg border shadow-lg"
                style={{
                  backgroundColor: "var(--asph-bg-primary)",
                  borderColor: "var(--asph-border-primary)",
                }}
              >
                <button
                  onClick={handleCopyLink}
                  className="touch-target-sm flex w-full items-center gap-2 rounded-t-lg px-3 py-2 text-sm transition-colors hover:bg-asph-bg-hover"
                  style={{ color: "var(--asph-text-primary)" }}
                >
                  <Copy size={14} />
                  {copyFeedback || "Copy link"}
                </button>

                {"share" in navigator && (
                  <button
                    onClick={handleNativeShare}
                    className="touch-target-sm flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-asph-bg-hover"
                    style={{ color: "var(--asph-text-primary)" }}
                  >
                    <Share2 size={14} />
                    Share...
                  </button>
                )}

                <button
                  onClick={handleOpenInBluesky}
                  className="touch-target-sm flex w-full items-center gap-2 rounded-b-lg px-3 py-2 text-sm transition-colors hover:bg-asph-bg-hover"
                  style={{ color: "var(--asph-text-primary)" }}
                >
                  <ExternalLink size={14} />
                  Open in Bluesky
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
