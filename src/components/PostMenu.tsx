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
  Trash2,
  UserX,
  VolumeX,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { useAuth } from "../contexts/AuthContext";
import { useHiddenPosts } from "../contexts/HiddenPostsContext";
import { useModal } from "../contexts/ModalContext";
import { useModeration } from "../contexts/ModerationContext";
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
  const { session, agent } = useAuth();
  const { hidePost } = useHiddenPosts();
  const { muteUser, muteThread, blockUser } = useModeration();
  const { showConfirm } = useModal();

  const isOwnPost = session?.did === post.author.did;
  const postRecord = post.record as any;
  const isThread = postRecord?.reply !== undefined;

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
          console.log(`Muted user: ${post.author.handle}`);
        }
      } catch (error) {
        console.error("Failed to mute user:", error);
        // Rollback on error
        // Note: would need unmuteUser method for this
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
        await showConfirm(
          `Block @${post.author.handle}? They won't be able to see your posts or interact with you.`,
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
              // Store the block URI if needed for unblocking later
              console.log("Blocked user:", uri);
            } catch (error) {
              console.error("Failed to block user:", error);
              // Rollback on error
              // Note: would need unblockUser method for this
            }
          },
          {
            variant: "warning",
            title: "Block User",
            confirmText: "Block",
            cancelText: "Cancel",
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
      await showConfirm(
        "Delete this post? This action cannot be undone.",
        async () => {
          try {
            if (agent) {
              await agent.deletePost(post.uri);
              // You might want to trigger a refresh or update the UI
            }
          } catch (error) {
            console.error("Failed to delete post:", error);
          }
        },
        {
          variant: "warning",
          title: "Delete Post",
          confirmText: "Delete",
          cancelText: "Cancel",
        },
      );
    }
  };

  const handleCopyLink = () => {
    setIsOpen(false);
    const postId = post.uri.split("/").pop();
    const link = `${window.location.origin}/thread/${post.author.handle}/${postId}`;
    navigator.clipboard.writeText(link);
    // You might want to show a toast notification here
  };

  const handleEmbed = () => {
    setIsOpen(false);
    const postId = post.uri.split("/").pop();
    const embedCode = `<iframe src="https://bsky.app/profile/${post.author.handle}/post/${postId}/embed" width="500" height="350" frameborder="0"></iframe>`;
    navigator.clipboard.writeText(embedCode);
    // You might want to show a toast notification here
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
        console.log(`Muted thread: ${post.uri}`);
      }
    } catch (error) {
      console.error("Failed to mute thread:", error);
      // Rollback on error
      // Note: would need unmuteThread method for this
    }
  };

  const handleHidePost = () => {
    setIsOpen(false);
    hidePost(post.uri);
    // Optional: Show a toast notification
    console.log(`Hidden post: ${post.uri}`);
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

  return (
    <>
      <div className={`relative ${className}`} ref={menuRef}>
        <button
          ref={buttonRef}
          onClick={(e) => {
            e.stopPropagation();
            if (!isOpen && buttonRef.current) {
              const rect = buttonRef.current.getBoundingClientRect();
              setMenuPosition({
                top: rect.bottom + 8,
                left: rect.right - 224, // 224px = w-56
              });
            }
            setIsOpen(!isOpen);
          }}
          className="rounded-full p-2 transition-opacity hover:opacity-70"
          aria-label="More options"
        >
          <MoreHorizontal className="h-5 w-5 text-gray-500 dark:text-gray-400" />
        </button>

      {isOpen &&
        menuPosition &&
        ReactDOM.createPortal(
          <div
            ref={menuRef}
            className="fixed z-[9999] w-56 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900"
            style={{
              top: `${menuPosition.top}px`,
              left: `${menuPosition.left}px`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="overflow-hidden py-1">
              {/* Always visible options */}
              <button
                onClick={handleCopyLink}
                className="flex w-full items-center gap-3 px-4 py-2 text-sm text-gray-700 transition-opacity hover:opacity-70 dark:text-gray-300"
              >
                <Link className="h-4 w-4" />
                Copy link to post
              </button>

              <button
                onClick={handleEmbed}
                className="flex w-full items-center gap-3 px-4 py-2 text-sm text-gray-700 transition-opacity hover:opacity-70 dark:text-gray-300"
              >
                <Code className="h-4 w-4" />
                Embed post
              </button>

              <button
                onClick={handleOpenInBluesky}
                className="flex w-full items-center gap-3 px-4 py-2 text-sm text-gray-700 transition-opacity hover:opacity-70 dark:text-gray-300"
              >
                <ExternalLink className="h-4 w-4" />
                Open in Bluesky
              </button>

              <div className="my-1 border-t border-gray-200 dark:border-gray-700" />

              {/* Thread-specific options */}
              {isThread && (
                <>
                  <button
                    onClick={handleMuteThread}
                    className="flex w-full items-center gap-3 px-4 py-2 text-sm text-gray-700 transition-opacity hover:opacity-70 dark:text-gray-300"
                  >
                    <BellOff className="h-4 w-4" />
                    Mute thread
                  </button>
                  <div className="my-1 border-t border-gray-200 dark:border-gray-700" />
                </>
              )}

              {/* Options for posts from others */}
              {!isOwnPost && (
                <>
                  <button
                    onClick={handleHidePost}
                    className="flex w-full items-center gap-3 px-4 py-2 text-sm text-gray-700 transition-opacity hover:opacity-70 dark:text-gray-300"
                  >
                    <EyeOff className="h-4 w-4" />
                    Hide this post
                  </button>

                  <button
                    onClick={handleOpenAddToListModal}
                    className="flex w-full items-center gap-3 px-4 py-2 text-sm text-gray-700 transition-opacity hover:opacity-70 dark:text-gray-300"
                    title={`Add @${post.author.handle} to lists`}
                  >
                    <List className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate">Add to Lists</span>
                  </button>

                  <div className="my-1 border-t border-gray-200 dark:border-gray-700" />

                  <button
                    onClick={handleMute}
                    className="flex w-full items-center gap-3 px-4 py-2 text-sm text-gray-700 transition-opacity hover:opacity-70 dark:text-gray-300"
                    title={`Mute @${post.author.handle}`}
                  >
                    <VolumeX className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate">Mute @{post.author.handle}</span>
                  </button>

                  <button
                    onClick={handleBlock}
                    className="flex w-full items-center gap-3 px-4 py-2 text-sm text-gray-700 transition-opacity hover:opacity-70 dark:text-gray-300"
                    title={`Block @${post.author.handle}`}
                  >
                    <UserX className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate">
                      Block @{post.author.handle}
                    </span>
                  </button>

                  <button
                    onClick={handleOpenReportModal}
                    className="flex w-full items-center gap-3 px-4 py-2 text-sm text-gray-700 transition-opacity hover:opacity-70 dark:text-gray-300"
                  >
                    <Flag className="h-4 w-4" />
                    Report post
                  </button>
                </>
              )}

              {/* Options for own posts */}
              {isOwnPost && (
                <button
                  onClick={handleDelete}
                  className="flex w-full items-center gap-3 px-4 py-2 text-sm text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete post
                </button>
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
