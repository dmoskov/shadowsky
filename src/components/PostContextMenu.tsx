import { AppBskyFeedDefs } from "@atproto/api";
import {
  Bookmark,
  BookmarkCheck,
  ClipboardCopy,
  ExternalLink,
  Link,
  Share,
} from "lucide-react";
import React, { useCallback, useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import { useToast } from "../contexts/ToastContext";
import { useBookmarks } from "../hooks/useBookmarks";
import { extractPostId } from "../hooks/usePostDeepLink";
import { isWebShareSupported, sharePost } from "../services/share-service";

interface PostContextMenuProps {
  post: AppBskyFeedDefs.PostView;
  position: { x: number; y: number };
  onClose: () => void;
}

const MENU_ITEM_CLASS =
  "flex w-full items-center gap-3 px-4 py-2.5 text-sm text-asph-text-secondary transition-opacity hover:bg-asph-bg-hover focus-visible:bg-asph-bg-hover focus-visible:outline-none";

export const PostContextMenu: React.FC<PostContextMenuProps> = ({
  post,
  position,
  onClose,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();
  const { isBookmarked, toggleBookmark } = useBookmarks();
  const bookmarked = isBookmarked(post.uri);

  const postId = extractPostId(post.uri);
  const postUrl = `${window.location.origin}/thread/${post.author.handle}/${postId}`;
  const postText = (post.record as { text?: string })?.text || "";

  // Close on outside click
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Close on scroll. Passive + capture so it never blocks scrolling; it fires
  // once and then unmounts the menu (removing this listener).
  useEffect(() => {
    const handleScroll = () => onClose();
    window.addEventListener("scroll", handleScroll, {
      capture: true,
      passive: true,
    });
    return () =>
      window.removeEventListener("scroll", handleScroll, { capture: true });
  }, [onClose]);

  // Adjust position to keep menu within viewport
  const getAdjustedPosition = useCallback(() => {
    const menuWidth = 224; // w-56
    const menuHeight = 240; // approximate
    const padding = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let x = position.x;
    let y = position.y;

    if (x + menuWidth > vw - padding) {
      x = vw - menuWidth - padding;
    }
    if (x < padding) {
      x = padding;
    }
    if (y + menuHeight > vh - padding) {
      y = vh - menuHeight - padding;
    }
    if (y < padding) {
      y = padding;
    }

    return { x, y };
  }, [position]);

  const adjusted = getAdjustedPosition();

  const handleOpenInNewTab = () => {
    onClose();
    window.open(postUrl, "_blank", "noopener,noreferrer");
  };

  const handleCopyLink = async () => {
    onClose();
    try {
      await navigator.clipboard.writeText(postUrl);
      showToast("Link copied to clipboard", {
        type: "success",
        duration: 2000,
      });
    } catch {
      showToast("Failed to copy link", { type: "error" });
    }
  };

  const handleCopyText = async () => {
    onClose();
    if (!postText) {
      showToast("No text to copy", { type: "error" });
      return;
    }
    try {
      await navigator.clipboard.writeText(postText);
      showToast("Post text copied to clipboard", {
        type: "success",
        duration: 2000,
      });
    } catch {
      showToast("Failed to copy text", { type: "error" });
    }
  };

  const handleBookmark = () => {
    onClose();
    toggleBookmark(post);
  };

  const handleShare = async () => {
    onClose();
    if (isWebShareSupported()) {
      const result = await sharePost(post.author.handle, postId, postText);
      if (result.success && result.method === "clipboard") {
        showToast("Link copied to clipboard", {
          type: "success",
          duration: 2000,
        });
      } else if (!result.success && result.error !== "Share cancelled") {
        showToast("Failed to share", { type: "error" });
      }
    } else {
      // Fallback to copy link
      try {
        await navigator.clipboard.writeText(postUrl);
        showToast("Link copied to clipboard", {
          type: "success",
          duration: 2000,
        });
      } catch {
        showToast("Failed to copy link", { type: "error" });
      }
    }
  };

  return ReactDOM.createPortal(
    <>
      {/* Invisible backdrop to capture clicks */}
      <div
        className="fixed inset-0 z-[9998]"
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
        aria-hidden="true"
      />
      <div
        ref={menuRef}
        role="menu"
        aria-label="Post context menu"
        className="fixed z-[9999] w-56 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900"
        style={{
          top: `${adjusted.y}px`,
          left: `${adjusted.x}px`,
        }}
      >
        <button
          role="menuitem"
          onClick={handleOpenInNewTab}
          className={MENU_ITEM_CLASS}
        >
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
          Open in New Tab
        </button>

        <button
          role="menuitem"
          onClick={handleCopyLink}
          className={MENU_ITEM_CLASS}
        >
          <Link className="h-4 w-4" aria-hidden="true" />
          Copy Link to Post
        </button>

        {postText && (
          <button
            role="menuitem"
            onClick={handleCopyText}
            className={MENU_ITEM_CLASS}
          >
            <ClipboardCopy className="h-4 w-4" aria-hidden="true" />
            Copy Post Text
          </button>
        )}

        <div
          className="my-1 border-t border-gray-200 dark:border-gray-700"
          role="separator"
        />

        <button
          role="menuitem"
          onClick={handleBookmark}
          className={MENU_ITEM_CLASS}
        >
          {bookmarked ? (
            <BookmarkCheck
              className="h-4 w-4 text-amber-500"
              aria-hidden="true"
            />
          ) : (
            <Bookmark className="h-4 w-4" aria-hidden="true" />
          )}
          {bookmarked ? "Remove Bookmark" : "Bookmark"}
        </button>

        <button
          role="menuitem"
          onClick={handleShare}
          className={MENU_ITEM_CLASS}
        >
          <Share className="h-4 w-4" aria-hidden="true" />
          Share
        </button>
      </div>
    </>,
    document.body,
  );
};
