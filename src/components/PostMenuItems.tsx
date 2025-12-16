import { AppBskyFeedDefs } from "@atproto/api";
import {
  BellOff,
  Code,
  ExternalLink,
  EyeOff,
  Flag,
  Link,
  List,
  Share,
  Trash2,
  UserX,
  VolumeX,
} from "lucide-react";
import React from "react";

interface PostMenuItemsProps {
  post: AppBskyFeedDefs.PostView;
  isOwnPost: boolean;
  isThread: boolean;
  isWebShareSupported: boolean;
  onNativeShare: () => void;
  onCopyLink: () => void;
  onCopyDeepLink: () => void;
  onCopyBlueskyLink: () => void;
  onEmbed: () => void;
  onOpenInBluesky: () => void;
  onMuteThread: () => void;
  onHidePost: () => void;
  onOpenAddToListModal: () => void;
  onMute: () => void;
  onBlock: () => void;
  onOpenReportModal: () => void;
  onDelete: () => void;
}

/**
 * Renders the menu items for the post menu.
 * Separated from PostMenu to isolate rendering logic and reduce coupling.
 */
export const PostMenuItems: React.FC<PostMenuItemsProps> = ({
  post,
  isOwnPost,
  isThread,
  isWebShareSupported,
  onNativeShare,
  onCopyLink,
  onCopyDeepLink,
  onCopyBlueskyLink,
  onEmbed,
  onOpenInBluesky,
  onMuteThread,
  onHidePost,
  onOpenAddToListModal,
  onMute,
  onBlock,
  onOpenReportModal,
  onDelete,
}) => {
  return (
    <div className="overflow-hidden py-1">
      {/* Native Share (shown on mobile/PWA when supported) */}
      {isWebShareSupported && (
        <button
          role="menuitem"
          onClick={onNativeShare}
          className="flex min-h-[44px] w-full items-center gap-3 px-4 py-3 text-sm text-gray-700 transition-opacity hover:opacity-70 focus-visible:bg-gray-100 focus-visible:outline-none dark:text-gray-300 dark:focus-visible:bg-gray-800"
        >
          <Share className="h-4 w-4" aria-hidden="true" />
          Share post
        </button>
      )}

      {/* Always visible options */}
      <button
        role="menuitem"
        onClick={onCopyLink}
        className="flex min-h-[44px] w-full items-center gap-3 px-4 py-3 text-sm text-gray-700 transition-opacity hover:opacity-70 focus-visible:bg-gray-100 focus-visible:outline-none dark:text-gray-300 dark:focus-visible:bg-gray-800"
      >
        <Link className="h-4 w-4" aria-hidden="true" />
        Copy link to post
      </button>

      <button
        role="menuitem"
        onClick={onCopyDeepLink}
        className="flex min-h-[44px] w-full items-center gap-3 px-4 py-3 text-sm text-gray-700 transition-opacity hover:opacity-70 focus-visible:bg-gray-100 focus-visible:outline-none dark:text-gray-300 dark:focus-visible:bg-gray-800"
        title="Copy link with scroll-to-post fragment"
      >
        <Link className="h-4 w-4" aria-hidden="true" />
        Copy link (scroll to post)
      </button>

      <button
        role="menuitem"
        onClick={onCopyBlueskyLink}
        className="flex min-h-[44px] w-full items-center gap-3 px-4 py-3 text-sm text-gray-700 transition-opacity hover:opacity-70 focus-visible:bg-gray-100 focus-visible:outline-none dark:text-gray-300 dark:focus-visible:bg-gray-800"
      >
        <Link className="h-4 w-4" aria-hidden="true" />
        Copy Bluesky link
      </button>

      <button
        role="menuitem"
        onClick={onEmbed}
        className="flex min-h-[44px] w-full items-center gap-3 px-4 py-3 text-sm text-gray-700 transition-opacity hover:opacity-70 focus-visible:bg-gray-100 focus-visible:outline-none dark:text-gray-300 dark:focus-visible:bg-gray-800"
      >
        <Code className="h-4 w-4" aria-hidden="true" />
        Embed post
      </button>

      <button
        role="menuitem"
        onClick={onOpenInBluesky}
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
            onClick={onMuteThread}
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
            onClick={onHidePost}
            className="flex min-h-[44px] w-full items-center gap-3 px-4 py-3 text-sm text-gray-700 transition-opacity hover:opacity-70 focus-visible:bg-gray-100 focus-visible:outline-none dark:text-gray-300 dark:focus-visible:bg-gray-800"
          >
            <EyeOff className="h-4 w-4" aria-hidden="true" />
            Hide this post
          </button>

          <button
            role="menuitem"
            onClick={onOpenAddToListModal}
            className="flex min-h-[44px] w-full items-center gap-3 px-4 py-3 text-sm text-gray-700 transition-opacity hover:opacity-70 focus-visible:bg-gray-100 focus-visible:outline-none dark:text-gray-300 dark:focus-visible:bg-gray-800"
            title={`Add @${post.author.handle} to lists`}
          >
            <List className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
            <span className="truncate">Add to Lists</span>
          </button>

          <div
            className="my-1 border-t border-gray-200 dark:border-gray-700"
            role="separator"
          />

          <button
            role="menuitem"
            onClick={onMute}
            className="flex min-h-[44px] w-full items-center gap-3 px-4 py-3 text-sm text-gray-700 transition-opacity hover:opacity-70 focus-visible:bg-gray-100 focus-visible:outline-none dark:text-gray-300 dark:focus-visible:bg-gray-800"
            title={`Mute @${post.author.handle}`}
          >
            <VolumeX className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
            <span className="truncate">Mute @{post.author.handle}</span>
          </button>

          <button
            role="menuitem"
            onClick={onBlock}
            className="flex min-h-[44px] w-full items-center gap-3 px-4 py-3 text-sm text-gray-700 transition-opacity hover:opacity-70 focus-visible:bg-gray-100 focus-visible:outline-none dark:text-gray-300 dark:focus-visible:bg-gray-800"
            title={`Block @${post.author.handle}`}
          >
            <UserX className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
            <span className="truncate">Block @{post.author.handle}</span>
          </button>

          <button
            role="menuitem"
            onClick={onOpenReportModal}
            className="flex min-h-[44px] w-full items-center gap-3 px-4 py-3 text-sm text-gray-700 transition-opacity hover:opacity-70 focus-visible:bg-gray-100 focus-visible:outline-none dark:text-gray-300 dark:focus-visible:bg-gray-800"
          >
            <Flag className="h-4 w-4" aria-hidden="true" />
            Report post
          </button>
        </>
      )}

      {/* Options for own posts */}
      {isOwnPost && (
        <button
          role="menuitem"
          onClick={onDelete}
          className="flex min-h-[44px] w-full items-center gap-3 px-4 py-3 text-sm text-red-600 transition-colors hover:bg-red-50 focus-visible:bg-red-50 focus-visible:outline-none dark:text-red-400 dark:hover:bg-red-900/20 dark:focus-visible:bg-red-900/20"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Delete post
        </button>
      )}
    </div>
  );
};
