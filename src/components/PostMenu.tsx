import { AppBskyFeedDefs } from "@atproto/api";
import { MoreHorizontal } from "lucide-react";
import React, { useEffect, useId, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { useMenuKeyboardNavigation } from "../hooks/useMenuKeyboardNavigation";
import { useMenuPositioning } from "../hooks/useMenuPositioning";
import { usePostMenuActions } from "../hooks/usePostMenuActions";
import { AddToListModal } from "./AddToListModal";
import { PostMenuItems } from "./PostMenuItems";
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
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  // Use extracted hooks for positioning and actions
  const { menuPosition, calculatePosition, clearPosition } =
    useMenuPositioning();

  const actions = usePostMenuActions({
    post,
    onMute,
    onBlock,
    onDelete,
    onClose: () => setIsOpen(false),
  });

  // Keyboard navigation for menu
  useMenuKeyboardNavigation({
    isOpen,
    onClose: () => setIsOpen(false),
    menuRef,
    triggerRef: buttonRef,
  });

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
              calculatePosition(buttonRef.current);
              setIsOpen(true);
            } else {
              setIsOpen(false);
              clearPosition();
            }
          }}
          className="touch-target-sm flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full p-2 transition-opacity hover:opacity-70"
          aria-label="More options"
          aria-haspopup="menu"
          aria-expanded={isOpen}
          aria-controls={isOpen ? menuId : undefined}
        >
          <MoreHorizontal className="h-5 w-5 text-asph-text-tertiary" />
        </button>

        {isOpen &&
          menuPosition &&
          ReactDOM.createPortal(
            <div
              ref={menuRef}
              id={menuId}
              role="menu"
              aria-label="Post actions"
              className="asph-scrollbar fixed z-[9999] max-h-[calc(100vh-16px)] w-56 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900"
              style={{
                top: `${menuPosition.top}px`,
                left: `${menuPosition.left}px`,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <PostMenuItems
                post={post}
                isOwnPost={actions.isOwnPost}
                isThread={actions.isThread}
                isThreadMuted={actions.isThreadCurrentlyMuted}
                isWebShareSupported={actions.isWebShareSupported()}
                isPinned={actions.isCurrentlyPinned}
                onNativeShare={actions.handleNativeShare}
                onCopyLink={actions.handleCopyLink}
                onCopyDeepLink={actions.handleCopyDeepLink}
                onCopyBlueskyLink={actions.handleCopyBlueskyLink}
                onEmbed={actions.handleEmbed}
                onOpenInBluesky={actions.handleOpenInBluesky}
                onMuteThread={actions.handleMuteThread}
                onUnmuteThread={actions.handleUnmuteThread}
                onHidePost={actions.handleHidePost}
                onOpenAddToListModal={handleOpenAddToListModal}
                onMute={actions.handleMute}
                onBlock={actions.handleBlock}
                onOpenReportModal={handleOpenReportModal}
                onDelete={actions.handleDelete}
                onPinToProfile={actions.handlePinToProfile}
                onUnpinFromProfile={actions.handleUnpinFromProfile}
              />
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
