import { AppBskyFeedDefs } from "@atproto/api";
import {
  BellOff,
  Code,
  ExternalLink,
  EyeOff,
  Flag,
  Link,
  List,
  MoreHorizontal,
  Pin,
  PinOff,
  Share,
  Trash2,
  UserX,
  VolumeX,
} from "lucide-react";
import React, { useEffect, useId, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { useAuth } from "../contexts/AuthContext";
import { useHiddenPosts } from "../contexts/HiddenPostsContext";
import { useModal } from "../contexts/ModalContext";
import { useModeration } from "../contexts/ModerationContext";
import { useToast } from "../contexts/ToastContext";
import { useMenuKeyboardNavigation } from "../hooks/useMenuKeyboardNavigation";
import { usePinnedPosts } from "../hooks/usePinnedPosts";
import { generateShareablePostUrl } from "../hooks/usePostDeepLink";
import { moderationHistoryDB } from "../services/moderation-history-db";
import { isWebShareSupported, sharePost } from "../services/share-service";
import { AddToListModal } from "./AddToListModal";
import { ReportModal } from "./ReportModal";

interface PostMenuProps {
  post: AppBskyFeedDefs.PostView;
  onMute?: () => void;
  onBlock?: () => void;
  onDelete?: () => void;
  onReport?: () => void;
  className?: string;
}

export const PostMenu: React.FC<PostMenuProps> = ({
  post,
  onMute,
  onBlock,
  onDelete,
  onReport,
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showAddToListModal, setShowAddToListModal] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const { session, agent } = useAuth();

  // Keyboard navigation for menu
  useMenuKeyboardNavigation({
    isOpen,
    onClose: () => setIsOpen(false),
    menuRef,
    triggerRef: buttonRef,
  });
  const { hidePost } = useHiddenPosts();
  const { muteUser, muteThread, blockUser } = useModeration();
  const { showDestructiveConfirm } = useModal();
  const { showToast } = useToast();

  const isOwnPost = session?.did === post.author.did;
  const postRecord = post.record as any;
  const isThread = postRecord?.reply !== undefined;

  // Pinned posts functionality (only enabled for own posts)
  const { isPinned, togglePin, canPin, isPinning, isUnpinning, maxPins } =
    usePinnedPosts({
      did: session?.did || "",
      enabled: isOwnPost,
    });

  const postIsPinned = isOwnPost && isPinned(post.uri);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleMute = async () => {
    setIsOpen(false);
    // Add to local muted users immediately for instant UI update
    muteUser(post.author.did);

    if (onMute) {
      onMute();
    } else {
      // Default implementation
      try {
        if (agent) {
          await agent.mute(post.author.did);

          // Record mute to history
          try {
            await moderationHistoryDB.init();
            await moderationHistoryDB.recordMute({
              subjectDid: post.author.did,
              subjectHandle: post.author.handle,
              subjectDisplayName: post.author.displayName,
              subjectAvatar: post.author.avatar,
              createdAt: Date.now(),
            });
          } catch (historyErr) {
            console.warn("Failed to record mute to history:", historyErr);
          }

          showToast(`Muted @${post.author.handle}`, {
            type: "success",
            duration: 3000,
          });
        }
      } catch (error) {
        console.error("Failed to mute user:", error);
        showToast("Failed to mute user", { type: "error" });
      }
    }
  };

  const handleBlock = async () => {
    setIsOpen(false);
    if (onBlock) {
      onBlock();
    } else {
      // Default implementation
      if (agent) {
        await showDestructiveConfirm(
          {
            title: "Block User",
            message: `Are you sure you want to block @${post.author.handle}? They won't be able to see your posts, reply to you, or interact with your content.`,
            confirmButtonLabel: "Block User",
            severity: "danger",
            canUndo: true,
            warningMessage:
              "You can unblock this user later from your settings.",
          },
          async () => {
            try {
              // Add to local blocked users immediately for instant UI update
              blockUser(post.author.did);

              if (!agent.session?.did) {
                throw new Error("No session available");
              }
              const { uri } = await agent.app.bsky.graph.block.create(
                { repo: agent.session.did },
                {
                  subject: post.author.did,
                  createdAt: new Date().toISOString(),
                },
              );

              // Record block to history
              try {
                await moderationHistoryDB.init();
                await moderationHistoryDB.recordBlock({
                  id: uri,
                  subjectDid: post.author.did,
                  subjectHandle: post.author.handle,
                  subjectDisplayName: post.author.displayName,
                  subjectAvatar: post.author.avatar,
                  createdAt: Date.now(),
                });
              } catch (historyErr) {
                console.warn("Failed to record block to history:", historyErr);
              }

              showToast(`Blocked @${post.author.handle}`, {
                type: "success",
                duration: 3000,
              });
            } catch (error) {
              console.error("Failed to block user:", error);
              showToast("Failed to block user", { type: "error" });
            }
          },
        );
      }
    }
  };

  const handleDelete = async () => {
    setIsOpen(false);
    if (onDelete) {
      onDelete();
    } else {
      // Default implementation
      await showDestructiveConfirm(
        {
          title: "Delete Post",
          message:
            "Are you sure you want to delete this post? This will remove it from your profile and timeline.",
          confirmButtonLabel: "Delete Post",
          severity: "danger",
          canUndo: false,
          warningMessage: "This action cannot be undone.",
        },
        async () => {
          try {
            if (agent) {
              await agent.deletePost(post.uri);
              showToast("Post deleted", {
                type: "success",
                duration: 3000,
              });
            }
          } catch (error) {
            console.error("Failed to delete post:", error);
            showToast("Failed to delete post", { type: "error" });
          }
        },
      );
    }
  };

  const handleCopyLink = async () => {
    setIsOpen(false);
    const postId = post.uri.split("/").pop();
    const link = `${window.location.origin}/thread/${post.author.handle}/${postId}`;
    try {
      await navigator.clipboard.writeText(link);
      showToast("Link copied to clipboard", {
        type: "success",
        duration: 2000,
      });
    } catch {
      showToast("Failed to copy link", { type: "error" });
    }
  };

  const handleCopyDeepLink = async () => {
    setIsOpen(false);
    // Generate a link with fragment that scrolls to the post on the current page
    const deepLink = generateShareablePostUrl(window.location.href, post.uri);
    try {
      await navigator.clipboard.writeText(deepLink);
      showToast("Deep link copied (scrolls to post)", {
        type: "success",
        duration: 2000,
      });
    } catch {
      showToast("Failed to copy link", { type: "error" });
    }
  };

  const handleCopyBlueskyLink = async () => {
    setIsOpen(false);
    const postId = post.uri.split("/").pop();
    const link = `https://bsky.app/profile/${post.author.handle}/post/${postId}`;
    try {
      await navigator.clipboard.writeText(link);
      showToast("Bluesky link copied to clipboard", {
        type: "success",
        duration: 2000,
      });
    } catch {
      showToast("Failed to copy link", { type: "error" });
    }
  };

  const handleNativeShare = async () => {
    setIsOpen(false);
    const postId = post.uri.split("/").pop();
    if (!postId) return;

    const postText = (post.record as { text?: string })?.text;
    const result = await sharePost(post.author.handle, postId, postText);

    if (result.success) {
      if (result.method === "clipboard") {
        showToast("Link copied to clipboard", {
          type: "success",
          duration: 2000,
        });
      }
      // Native share doesn't need a toast - the OS handles feedback
    } else if (result.error !== "Share cancelled") {
      showToast("Failed to share", { type: "error" });
    }
  };

  const handleEmbed = async () => {
    setIsOpen(false);
    const postId = post.uri.split("/").pop();
    const embedCode = `<iframe src="https://bsky.app/profile/${post.author.handle}/post/${postId}/embed" width="500" height="350" frameborder="0"></iframe>`;
    try {
      await navigator.clipboard.writeText(embedCode);
      showToast("Embed code copied to clipboard", {
        type: "success",
        duration: 2000,
      });
    } catch {
      showToast("Failed to copy embed code", { type: "error" });
    }
  };

  const handleOpenInBluesky = () => {
    setIsOpen(false);
    const postId = post.uri.split("/").pop();
    const link = `https://bsky.app/profile/${post.author.handle}/post/${postId}`;
    window.open(link, "_blank", "noopener,noreferrer");
  };

  const handleMuteThread = async () => {
    setIsOpen(false);
    // Add to local muted threads immediately for instant UI update
    muteThread(post.uri);

    try {
      if (agent) {
        await agent.api.app.bsky.graph.muteThread({
          root: post.uri,
        });
        showToast("Thread muted", {
          type: "success",
          duration: 3000,
        });
      }
    } catch (error) {
      console.error("Failed to mute thread:", error);
      showToast("Failed to mute thread", { type: "error" });
    }
  };

  const handleHidePost = () => {
    setIsOpen(false);
    hidePost(post.uri);
    showToast("Post hidden", {
      type: "success",
      duration: 3000,
    });
  };

  const handleOpenReportModal = () => {
    setIsOpen(false);
    if (onReport) {
      onReport();
    } else {
      setShowReportModal(true);
    }
  };

  const handleOpenAddToListModal = () => {
    setIsOpen(false);
    setShowAddToListModal(true);
  };

  const handleTogglePin = async () => {
    setIsOpen(false);
    try {
      const wasPinned = postIsPinned;
      await togglePin(post.uri, post.cid);
      showToast(
        wasPinned ? "Post unpinned from profile" : "Post pinned to profile",
        {
          type: "success",
          duration: 2000,
        },
      );
    } catch (error) {
      showToast("Failed to update pin status", { type: "error" });
    }
  };

  return (
    <>
      <div className={`relative ${className}`} ref={menuRef}>
        <button
          ref={buttonRef}
          onClick={(e) => {
            e.stopPropagation();
            if (!isOpen && buttonRef.current) {
              const rect = buttonRef.current.getBoundingClientRect();
              const menuWidth = 224; // 224px = w-56
              const menuHeight = 400; // Approximate max height of menu
              const viewportHeight = window.innerHeight;
              const viewportWidth = window.innerWidth;

              // Calculate horizontal position (prefer right-aligned to button)
              let left = rect.right - menuWidth;
              // Ensure menu doesn't overflow left edge
              if (left < 8) {
                left = 8;
              }
              // Ensure menu doesn't overflow right edge
              if (left + menuWidth > viewportWidth - 8) {
                left = viewportWidth - menuWidth - 8;
              }

              // Calculate vertical position (check if there's space below)
              const spaceBelow = viewportHeight - rect.bottom;
              const spaceAbove = rect.top;

              let top;
              if (spaceBelow >= menuHeight || spaceBelow > spaceAbove) {
                // Position below the button
                top = rect.bottom + 8;
              } else {
                // Position above the button
                top = rect.top - menuHeight - 8;
                // Ensure menu doesn't overflow top edge
                if (top < 8) {
                  top = 8;
                }
              }

              setMenuPosition({
                top,
                left,
              });
            }
            setIsOpen(!isOpen);
          }}
          className="touch-target-sm flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full p-2 transition-opacity hover:opacity-70"
          aria-label="More options"
          aria-haspopup="menu"
          aria-expanded={isOpen}
          aria-controls={isOpen ? menuId : undefined}
        >
          <MoreHorizontal className="h-5 w-5 text-gray-500 dark:text-gray-400" />
        </button>

        {isOpen &&
          menuPosition &&
          ReactDOM.createPortal(
            <div
              ref={menuRef}
              id={menuId}
              role="menu"
              aria-label="Post actions"
              className="fixed z-[9999] max-h-[calc(100vh-16px)] w-56 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900"
              style={{
                top: `${menuPosition.top}px`,
                left: `${menuPosition.left}px`,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="overflow-hidden py-1">
                {/* Native Share (shown on mobile/PWA when supported) */}
                {isWebShareSupported() && (
                  <button
                    role="menuitem"
                    onClick={handleNativeShare}
                    className="flex min-h-[44px] w-full items-center gap-3 px-4 py-3 text-sm text-gray-700 transition-opacity hover:opacity-70 focus-visible:bg-gray-100 focus-visible:outline-none dark:text-gray-300 dark:focus-visible:bg-gray-800"
                  >
                    <Share className="h-4 w-4" aria-hidden="true" />
                    Share post
                  </button>
                )}

                {/* Always visible options */}
                <button
                  role="menuitem"
                  onClick={handleCopyLink}
                  className="flex min-h-[44px] w-full items-center gap-3 px-4 py-3 text-sm text-gray-700 transition-opacity hover:opacity-70 focus-visible:bg-gray-100 focus-visible:outline-none dark:text-gray-300 dark:focus-visible:bg-gray-800"
                >
                  <Link className="h-4 w-4" aria-hidden="true" />
                  Copy link to post
                </button>

                <button
                  role="menuitem"
                  onClick={handleCopyDeepLink}
                  className="flex min-h-[44px] w-full items-center gap-3 px-4 py-3 text-sm text-gray-700 transition-opacity hover:opacity-70 focus-visible:bg-gray-100 focus-visible:outline-none dark:text-gray-300 dark:focus-visible:bg-gray-800"
                  title="Copy link with scroll-to-post fragment"
                >
                  <Link className="h-4 w-4" aria-hidden="true" />
                  Copy link (scroll to post)
                </button>

                <button
                  role="menuitem"
                  onClick={handleCopyBlueskyLink}
                  className="flex min-h-[44px] w-full items-center gap-3 px-4 py-3 text-sm text-gray-700 transition-opacity hover:opacity-70 focus-visible:bg-gray-100 focus-visible:outline-none dark:text-gray-300 dark:focus-visible:bg-gray-800"
                >
                  <Link className="h-4 w-4" aria-hidden="true" />
                  Copy Bluesky link
                </button>

                <button
                  role="menuitem"
                  onClick={handleEmbed}
                  className="flex min-h-[44px] w-full items-center gap-3 px-4 py-3 text-sm text-gray-700 transition-opacity hover:opacity-70 focus-visible:bg-gray-100 focus-visible:outline-none dark:text-gray-300 dark:focus-visible:bg-gray-800"
                >
                  <Code className="h-4 w-4" aria-hidden="true" />
                  Embed post
                </button>

                <button
                  role="menuitem"
                  onClick={handleOpenInBluesky}
                  className="flex min-h-[44px] w-full items-center gap-3 px-4 py-3 text-sm text-gray-700 transition-opacity hover:opacity-70 focus-visible:bg-gray-100 focus-visible:outline-none dark:text-gray-300 dark:focus-visible:bg-gray-800"
                >
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  Open in Bluesky
                </button>

                <div
                  className="my-1 border-t border-gray-200 dark:border-gray-700"
                  role="separator"
                />

                {/* Thread-specific options */}
                {isThread && (
                  <>
                    <button
                      role="menuitem"
                      onClick={handleMuteThread}
                      className="flex min-h-[44px] w-full items-center gap-3 px-4 py-3 text-sm text-gray-700 transition-opacity hover:opacity-70 focus-visible:bg-gray-100 focus-visible:outline-none dark:text-gray-300 dark:focus-visible:bg-gray-800"
                    >
                      <BellOff className="h-4 w-4" aria-hidden="true" />
                      Mute thread
                    </button>
                    <div
                      className="my-1 border-t border-gray-200 dark:border-gray-700"
                      role="separator"
                    />
                  </>
                )}

                {/* Options for posts from others */}
                {!isOwnPost && (
                  <>
                    <button
                      role="menuitem"
                      onClick={handleHidePost}
                      className="flex min-h-[44px] w-full items-center gap-3 px-4 py-3 text-sm text-gray-700 transition-opacity hover:opacity-70 focus-visible:bg-gray-100 focus-visible:outline-none dark:text-gray-300 dark:focus-visible:bg-gray-800"
                    >
                      <EyeOff className="h-4 w-4" aria-hidden="true" />
                      Hide this post
                    </button>

                    <button
                      role="menuitem"
                      onClick={handleOpenAddToListModal}
                      className="flex min-h-[44px] w-full items-center gap-3 px-4 py-3 text-sm text-gray-700 transition-opacity hover:opacity-70 focus-visible:bg-gray-100 focus-visible:outline-none dark:text-gray-300 dark:focus-visible:bg-gray-800"
                      title={`Add @${post.author.handle} to lists`}
                    >
                      <List
                        className="h-4 w-4 flex-shrink-0"
                        aria-hidden="true"
                      />
                      <span className="truncate">Add to Lists</span>
                    </button>

                    <div
                      className="my-1 border-t border-gray-200 dark:border-gray-700"
                      role="separator"
                    />

                    <button
                      role="menuitem"
                      onClick={handleMute}
                      className="flex min-h-[44px] w-full items-center gap-3 px-4 py-3 text-sm text-gray-700 transition-opacity hover:opacity-70 focus-visible:bg-gray-100 focus-visible:outline-none dark:text-gray-300 dark:focus-visible:bg-gray-800"
                      title={`Mute @${post.author.handle}`}
                    >
                      <VolumeX
                        className="h-4 w-4 flex-shrink-0"
                        aria-hidden="true"
                      />
                      <span className="truncate">
                        Mute @{post.author.handle}
                      </span>
                    </button>

                    <button
                      role="menuitem"
                      onClick={handleBlock}
                      className="flex min-h-[44px] w-full items-center gap-3 px-4 py-3 text-sm text-gray-700 transition-opacity hover:opacity-70 focus-visible:bg-gray-100 focus-visible:outline-none dark:text-gray-300 dark:focus-visible:bg-gray-800"
                      title={`Block @${post.author.handle}`}
                    >
                      <UserX
                        className="h-4 w-4 flex-shrink-0"
                        aria-hidden="true"
                      />
                      <span className="truncate">
                        Block @{post.author.handle}
                      </span>
                    </button>

                    <button
                      role="menuitem"
                      onClick={handleOpenReportModal}
                      className="flex min-h-[44px] w-full items-center gap-3 px-4 py-3 text-sm text-gray-700 transition-opacity hover:opacity-70 focus-visible:bg-gray-100 focus-visible:outline-none dark:text-gray-300 dark:focus-visible:bg-gray-800"
                    >
                      <Flag className="h-4 w-4" aria-hidden="true" />
                      Report post
                    </button>
                  </>
                )}

                {/* Options for own posts */}
                {isOwnPost && (
                  <>
                    <button
                      role="menuitem"
                      onClick={handleTogglePin}
                      disabled={
                        isPinning || isUnpinning || (!postIsPinned && !canPin())
                      }
                      aria-disabled={
                        isPinning || isUnpinning || (!postIsPinned && !canPin())
                      }
                      className="flex min-h-[44px] w-full items-center gap-3 px-4 py-3 text-sm text-gray-700 transition-opacity hover:opacity-70 focus-visible:bg-gray-100 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-300 dark:focus-visible:bg-gray-800"
                      title={
                        postIsPinned
                          ? "Unpin from profile"
                          : !canPin()
                            ? `Maximum ${maxPins} pinned posts allowed`
                            : "Pin to profile"
                      }
                    >
                      {postIsPinned ? (
                        <PinOff className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Pin className="h-4 w-4" aria-hidden="true" />
                      )}
                      {isPinning || isUnpinning
                        ? "Updating..."
                        : postIsPinned
                          ? "Unpin from profile"
                          : "Pin to profile"}
                    </button>
                    <div
                      className="my-1 border-t border-gray-200 dark:border-gray-700"
                      role="separator"
                    />
                    <button
                      role="menuitem"
                      onClick={handleDelete}
                      className="flex min-h-[44px] w-full items-center gap-3 px-4 py-3 text-sm text-red-600 transition-colors hover:bg-red-50 focus-visible:bg-red-50 focus-visible:outline-none dark:text-red-400 dark:hover:bg-red-900/20 dark:focus-visible:bg-red-900/20"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      Delete post
                    </button>
                  </>
                )}
              </div>
            </div>,
            document.body,
          )}
      </div>

      <ReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        reportType="post"
        subjectUri={post.uri}
        subjectCid={post.cid}
        subjectDid={post.author.did}
        subjectHandle={post.author.handle}
      />

      {showAddToListModal && (
        <AddToListModal
          user={{
            did: post.author.did,
            handle: post.author.handle,
            displayName: post.author.displayName,
            avatar: post.author.avatar,
          }}
          onClose={() => setShowAddToListModal(false)}
        />
      )}
    </>
  );
};
