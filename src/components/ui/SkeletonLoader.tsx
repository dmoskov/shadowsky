import React from "react";

// Re-export skeleton transition components for easy access
export {
  ContentReveal,
  SkeletonTransition,
  SkeletonTransitionList,
  useSkeletonTransition,
} from "./SkeletonTransition";

/**
 * Skeleton Loader Design System
 *
 * Content-specific skeleton components that match actual content dimensions
 * to prevent Cumulative Layout Shift (CLS).
 *
 * Animation Tokens (from LoadingState):
 * - Pulse: 2s duration, cubic-bezier(0.4, 0, 0.6, 1)
 * - Shimmer: 2s duration, linear, left-to-right
 *
 * Key Dimensions (matching actual components):
 * - Post avatar: 48x48px (h-12 w-12)
 * - Profile banner: 192px (h-48)
 * - Profile avatar: 144x144px (h-36 w-36)
 * - DM avatar: 40x40px (h-10 w-10)
 * - Notification avatar: 40x40px (h-10 w-10)
 * - Action icons: 18px
 *
 * All skeletons use the bsky theme colors for consistent appearance
 * across light and dark modes.
 *
 * Note on key={index} Usage:
 * This file uses index keys in Array.map() calls (7 instances). This is
 * intentional and acceptable because:
 * 1. Skeleton items are static placeholders with no internal state
 * 2. Arrays are generated from fixed lengths and never reorder
 * 3. Items are temporary and replaced by real content after loading
 * 4. All skeleton items are identical - no unique data to track
 * This is a legitimate use case where index keys are appropriate and efficient.
 */

interface SkeletonLoaderProps {
  /** Additional CSS classes */
  className?: string;
  /** Height in pixels or CSS value */
  height?: string | number;
  /** Width in pixels or CSS value */
  width?: string | number;
  /** Shape variant */
  variant?: "text" | "circular" | "rectangular" | "rounded";
  /** Animation type */
  animation?: "pulse" | "wave" | "shimmer" | "none";
  /** Accessibility label */
  "aria-label"?: string;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  className = "",
  height = "auto",
  width = "100%",
  variant = "text",
  animation = "pulse",
  "aria-label": ariaLabel,
}) => {
  // Use theme-aware colors instead of hardcoded gray
  const baseClasses = "bg-bsky-bg-tertiary";

  const animationClasses: Record<string, string> = {
    pulse: "animate-pulse",
    wave: "animate-skeleton-wave",
    shimmer: "animate-shimmer bg-shimmer-gradient bg-[length:1000px_100%]",
    none: "",
  };

  const variantClasses: Record<string, string> = {
    text: "h-4 rounded",
    circular: "rounded-full",
    rectangular: "",
    rounded: "rounded-lg",
  };

  const style: React.CSSProperties = {
    height: typeof height === "number" ? `${height}px` : height,
    width: typeof width === "number" ? `${width}px` : width,
  };

  return (
    <div
      className={`${baseClasses} ${animationClasses[animation] || ""} ${variantClasses[variant]} ${className}`}
      style={style}
      role="status"
      aria-label={ariaLabel || "Loading"}
      aria-busy="true"
    />
  );
};

interface PostSkeletonProps {
  /** Show image placeholder */
  showImage?: boolean;
  /** Show repost context indicator */
  showRepost?: boolean;
  /** Compact mode for smaller posts */
  compact?: boolean;
  /** Accessibility label */
  "aria-label"?: string;
}

/**
 * PostSkeleton - Matches exact dimensions from PostRenderer.tsx
 * Avatar: h-12 w-12 (48x48px) - line 923
 * Gap: gap-3 (12px) - line 915
 * Padding: p-4 (16px) - line 873
 * Action icons: 18px - lines 1023, 1043, 1063
 */
export const PostSkeleton: React.FC<PostSkeletonProps> = ({
  showImage = false,
  showRepost = false,
  compact = false,
  "aria-label": ariaLabel = "Loading post",
}) => {
  // Match post-renderer padding: p-4
  return (
    <div
      className="border-b border-bsky-border-primary p-4"
      role="status"
      aria-label={ariaLabel}
      aria-busy="true"
    >
      {/* Repost context - matches mb-2 from PostRenderer line 880 */}
      {showRepost && (
        <div className="mb-2 flex items-center gap-2">
          <SkeletonLoader variant="circular" width={16} height={16} />
          <SkeletonLoader width={120} height={14} />
        </div>
      )}

      {/* Main content - flex gap-3 matches PostRenderer line 915 */}
      <div className="flex gap-3">
        {/* Avatar: h-12 w-12 (48x48px) matches PostRenderer line 923 */}
        <SkeletonLoader
          variant="circular"
          width={48}
          height={48}
          className="flex-shrink-0"
          aria-label="Loading avatar"
        />

        {/* Content area - min-w-0 flex-1 matches PostRenderer line 929 */}
        <div className="min-w-0 flex-1">
          {/* Author info row - flex items-start matches line 931 */}
          <div className="mb-1 flex flex-wrap items-center gap-1">
            {/* Display name */}
            <SkeletonLoader
              width={100}
              height={16}
              variant="rounded"
              aria-label="Loading name"
            />
            {/* Handle */}
            <SkeletonLoader
              width={80}
              height={14}
              variant="rounded"
              aria-label="Loading handle"
            />
            {/* Separator dot */}
            <SkeletonLoader variant="circular" width={4} height={4} />
            {/* Timestamp */}
            <SkeletonLoader width={50} height={14} variant="rounded" />
          </div>

          {/* Post text - mt-1 matches PostRenderer line 987 */}
          <div className="mt-1 space-y-1.5">
            <SkeletonLoader width="100%" height={16} variant="rounded" />
            <SkeletonLoader width="95%" height={16} variant="rounded" />
            {!compact && (
              <SkeletonLoader width="75%" height={16} variant="rounded" />
            )}
          </div>

          {/* Image embed - mt-2 matches renderEmbed in PostRenderer */}
          {showImage && (
            <SkeletonLoader
              variant="rounded"
              width="100%"
              height={200}
              className="mt-3"
              aria-label="Loading media"
            />
          )}

          {/* Action buttons - mt-3 flex gap-4 matches PostRenderer line 1010 */}
          {!compact && (
            <div className="mt-3 flex items-center gap-4">
              {/* Reply button - matches icon size 18px */}
              <div className="flex items-center gap-1">
                <SkeletonLoader variant="circular" width={18} height={18} />
                <SkeletonLoader width={20} height={14} variant="rounded" />
              </div>
              {/* Repost button */}
              <div className="flex items-center gap-1">
                <SkeletonLoader variant="circular" width={18} height={18} />
                <SkeletonLoader width={20} height={14} variant="rounded" />
              </div>
              {/* Like button */}
              <div className="flex items-center gap-1">
                <SkeletonLoader variant="circular" width={18} height={18} />
                <SkeletonLoader width={20} height={14} variant="rounded" />
              </div>
              {/* Bookmark button */}
              <SkeletonLoader variant="circular" width={18} height={18} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface FeedSkeletonProps {
  /** Number of post skeletons to show */
  count?: number;
  /** Show image placeholders */
  showImages?: boolean;
  /** Accessibility label */
  "aria-label"?: string;
}

export const FeedSkeleton: React.FC<FeedSkeletonProps> = ({
  count = 5,
  showImages = false,
  "aria-label": ariaLabel = "Loading feed",
}) => {
  return (
    <div
      className="divide-y divide-bsky-border-primary"
      role="status"
      aria-label={ariaLabel}
    >
      {Array.from({ length: count }).map((_, i) => (
        <PostSkeleton
          key={i}
          showImage={showImages && i % 2 === 0}
          aria-label={`Loading post ${i + 1}`}
        />
      ))}
    </div>
  );
};

interface ProfileSkeletonProps {
  /** Show banner image placeholder */
  showBanner?: boolean;
  /** Show tabs below profile */
  showTabs?: boolean;
  /** Accessibility label */
  "aria-label"?: string;
}

/**
 * ProfileSkeleton - Matches exact dimensions from ProfilePage.tsx
 * Banner: h-48 (192px) - line 668
 * Avatar: h-36 w-36 (144x144px) with border-4 - line 693
 * Container: max-w-4xl - line 663
 */
export const ProfileSkeleton: React.FC<ProfileSkeletonProps> = ({
  showBanner = true,
  showTabs = true,
  "aria-label": ariaLabel = "Loading profile",
}) => {
  return (
    <div
      className="mx-auto w-full max-w-4xl"
      role="status"
      aria-label={ariaLabel}
      aria-busy="true"
    >
      {/* Banner - h-48 (192px) matches ProfilePage line 668 */}
      {showBanner && (
        <div className="relative">
          <SkeletonLoader
            variant="rectangular"
            height={192}
            className="bg-gradient-to-br"
            aria-label="Loading banner"
          />
        </div>
      )}

      {/* Profile info section */}
      <div className="px-4 pb-4">
        {/* Avatar overlapping banner - h-36 w-36 (144x144px) matches line 693 */}
        <div className={`relative ${showBanner ? "-mt-16" : "mt-4"} mb-4`}>
          <SkeletonLoader
            variant="circular"
            width={144}
            height={144}
            className="border-4 border-bsky-bg-primary shadow-lg"
            aria-label="Loading avatar"
          />
        </div>

        {/* Name and handle section */}
        <div className="mb-4 flex items-start justify-between">
          <div className="flex-1">
            {/* Display name */}
            <SkeletonLoader
              width={200}
              height={28}
              variant="rounded"
              className="mb-2"
              aria-label="Loading name"
            />
            {/* Handle */}
            <SkeletonLoader
              width={150}
              height={18}
              variant="rounded"
              aria-label="Loading handle"
            />
          </div>
          {/* Action buttons */}
          <div className="flex gap-2">
            <SkeletonLoader width={100} height={40} variant="rounded" />
            <SkeletonLoader width={40} height={40} variant="rounded" />
          </div>
        </div>

        {/* Bio section */}
        <div className="mb-4 space-y-2">
          <SkeletonLoader
            width="100%"
            height={16}
            variant="rounded"
            aria-label="Loading bio"
          />
          <SkeletonLoader width="85%" height={16} variant="rounded" />
          <SkeletonLoader width="60%" height={16} variant="rounded" />
        </div>

        {/* Stats row - followers/following/posts counts */}
        <div className="flex gap-6">
          <div className="flex items-center gap-1">
            <SkeletonLoader width={40} height={18} variant="rounded" />
            <SkeletonLoader width={60} height={14} variant="rounded" />
          </div>
          <div className="flex items-center gap-1">
            <SkeletonLoader width={40} height={18} variant="rounded" />
            <SkeletonLoader width={60} height={14} variant="rounded" />
          </div>
          <div className="flex items-center gap-1">
            <SkeletonLoader width={40} height={18} variant="rounded" />
            <SkeletonLoader width={50} height={14} variant="rounded" />
          </div>
        </div>
      </div>

      {/* Profile tabs - matches ProfilePage tab section */}
      {showTabs && (
        <div className="border-b border-bsky-border-primary">
          <div className="flex gap-1 px-4">
            <SkeletonLoader
              width={60}
              height={40}
              variant="rounded"
              className="flex-shrink-0"
            />
            <SkeletonLoader
              width={70}
              height={40}
              variant="rounded"
              className="flex-shrink-0"
            />
            <SkeletonLoader
              width={60}
              height={40}
              variant="rounded"
              className="flex-shrink-0"
            />
            <SkeletonLoader
              width={50}
              height={40}
              variant="rounded"
              className="flex-shrink-0"
            />
          </div>
        </div>
      )}
    </div>
  );
};

interface NotificationSkeletonProps {
  /** Accessibility label */
  "aria-label"?: string;
}

export const NotificationSkeleton: React.FC<NotificationSkeletonProps> = ({
  "aria-label": ariaLabel = "Loading notification",
}) => {
  return (
    <div
      className="border-b border-bsky-border-primary px-4 py-3"
      role="status"
      aria-label={ariaLabel}
    >
      <div className="flex items-start gap-3">
        <SkeletonLoader
          variant="circular"
          width={40}
          height={40}
          aria-label="Loading avatar"
        />
        <div className="flex-1">
          <SkeletonLoader width="60%" height={16} className="mb-1" />
          <SkeletonLoader width="100%" height={14} />
        </div>
      </div>
    </div>
  );
};

interface NotificationFeedSkeletonProps {
  /** Number of notification skeletons to show */
  count?: number;
  /** Accessibility label */
  "aria-label"?: string;
}

export const NotificationFeedSkeleton: React.FC<
  NotificationFeedSkeletonProps
> = ({ count = 5, "aria-label": ariaLabel = "Loading notifications" }) => {
  return (
    <div
      className="divide-y divide-bsky-border-primary"
      role="status"
      aria-label={ariaLabel}
    >
      {Array.from({ length: count }).map((_, i) => (
        <NotificationSkeleton
          key={i}
          aria-label={`Loading notification ${i + 1}`}
        />
      ))}
    </div>
  );
};

interface SearchResultSkeletonProps {
  /** Accessibility label */
  "aria-label"?: string;
}

export const SearchResultSkeleton: React.FC<SearchResultSkeletonProps> = ({
  "aria-label": ariaLabel = "Loading search result",
}) => {
  return (
    <div
      className="border-b border-bsky-border-primary px-4 py-3"
      role="status"
      aria-label={ariaLabel}
    >
      <div className="flex items-center gap-3">
        <SkeletonLoader variant="circular" width={44} height={44} />
        <div className="flex-1">
          <SkeletonLoader width="40%" height={16} className="mb-1" />
          <SkeletonLoader width="30%" height={14} />
        </div>
        <SkeletonLoader width={80} height={32} variant="rounded" />
      </div>
    </div>
  );
};

interface ColumnHeaderSkeletonProps {
  /** Accessibility label */
  "aria-label"?: string;
  /** Additional CSS classes */
  className?: string;
}

export const ColumnHeaderSkeleton: React.FC<ColumnHeaderSkeletonProps> = ({
  "aria-label": ariaLabel = "Loading column header",
  className = "",
}) => {
  return (
    <div
      className={`animate-pulse p-4 ${className}`}
      role="status"
      aria-label={ariaLabel}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <SkeletonLoader variant="circular" width={24} height={24} />
          <SkeletonLoader width={128} height={20} variant="rounded" />
        </div>
        <div className="flex items-center gap-2">
          <SkeletonLoader width={32} height={32} variant="rounded" />
          <SkeletonLoader width={32} height={32} variant="rounded" />
        </div>
      </div>
    </div>
  );
};

interface ThreadSkeletonProps {
  /** Number of reply skeletons to show */
  replyCount?: number;
  /** Show parent context */
  showParent?: boolean;
  /** Accessibility label */
  "aria-label"?: string;
}

/**
 * ThreadSkeleton - Matches ThreadModal and ThreadViewer layout
 * Hero post uses larger avatar and text
 * Replies are nested with thread lines
 */
export const ThreadSkeleton: React.FC<ThreadSkeletonProps> = ({
  replyCount = 3,
  showParent = false,
  "aria-label": ariaLabel = "Loading thread",
}) => {
  return (
    <div
      className="mx-auto max-w-2xl p-4"
      role="status"
      aria-label={ariaLabel}
      aria-busy="true"
    >
      {/* Parent post context (if replying to something) */}
      {showParent && (
        <div className="mb-4 border-l-2 border-bsky-border-primary pl-4">
          <div className="flex gap-3 opacity-60">
            <SkeletonLoader variant="circular" width={40} height={40} />
            <div className="flex-1">
              <SkeletonLoader width={120} height={14} className="mb-1" />
              <SkeletonLoader width="80%" height={14} />
            </div>
          </div>
        </div>
      )}

      {/* Hero/Root post - larger styling */}
      <div className="mb-6 rounded-lg border border-bsky-border-primary bg-bsky-bg-secondary p-4">
        {/* Author row */}
        <div className="mb-4 flex items-center gap-3">
          <SkeletonLoader
            variant="circular"
            width={48}
            height={48}
            className="flex-shrink-0"
            aria-label="Loading avatar"
          />
          <div className="flex-1">
            <SkeletonLoader
              width={150}
              height={18}
              variant="rounded"
              className="mb-1"
            />
            <SkeletonLoader width={100} height={14} variant="rounded" />
          </div>
          <SkeletonLoader width={24} height={24} variant="rounded" />
        </div>

        {/* Post content - larger text for hero */}
        <div className="space-y-2">
          <SkeletonLoader width="100%" height={20} variant="rounded" />
          <SkeletonLoader width="95%" height={20} variant="rounded" />
          <SkeletonLoader width="75%" height={20} variant="rounded" />
        </div>

        {/* Timestamp */}
        <div className="mb-4 mt-4 border-t border-bsky-border-primary pt-4">
          <SkeletonLoader width={140} height={14} variant="rounded" />
        </div>

        {/* Engagement stats */}
        <div className="mb-4 flex gap-4 border-b border-bsky-border-primary pb-4">
          <SkeletonLoader width={80} height={16} variant="rounded" />
          <SkeletonLoader width={80} height={16} variant="rounded" />
          <SkeletonLoader width={60} height={16} variant="rounded" />
        </div>

        {/* Action buttons */}
        <div className="flex justify-around">
          <SkeletonLoader variant="circular" width={20} height={20} />
          <SkeletonLoader variant="circular" width={20} height={20} />
          <SkeletonLoader variant="circular" width={20} height={20} />
          <SkeletonLoader variant="circular" width={20} height={20} />
        </div>
      </div>

      {/* Replies section header */}
      <div className="mb-4 border-b border-bsky-border-primary pb-3">
        <SkeletonLoader width={80} height={16} variant="rounded" />
      </div>

      {/* Reply skeletons with thread line styling */}
      <div className="space-y-0">
        {Array.from({ length: replyCount }).map((_, i) => (
          <div key={i} className="relative">
            {/* Thread line connecting replies */}
            {i < replyCount - 1 && (
              <div className="absolute bottom-0 left-6 top-12 w-0.5 bg-bsky-border-primary" />
            )}

            <div className="border-b border-bsky-border-primary p-4">
              <div className="flex gap-3">
                <SkeletonLoader
                  variant="circular"
                  width={40}
                  height={40}
                  className="flex-shrink-0"
                  aria-label={`Loading reply ${i + 1} avatar`}
                />
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <SkeletonLoader width={100} height={14} variant="rounded" />
                    <SkeletonLoader width={70} height={14} variant="rounded" />
                    <SkeletonLoader width={50} height={14} variant="rounded" />
                  </div>
                  <div className="space-y-1.5">
                    <SkeletonLoader width="95%" height={14} variant="rounded" />
                    <SkeletonLoader width="70%" height={14} variant="rounded" />
                  </div>
                  {/* Reply actions */}
                  <div className="mt-2 flex gap-4">
                    <SkeletonLoader variant="circular" width={16} height={16} />
                    <SkeletonLoader variant="circular" width={16} height={16} />
                    <SkeletonLoader variant="circular" width={16} height={16} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

interface ConversationListSkeletonProps {
  /** Number of conversation skeletons to show */
  count?: number;
  /** Accessibility label */
  "aria-label"?: string;
}

/**
 * ConversationListSkeleton - Matches DirectMessages.tsx conversation list
 * Avatar: h-10 w-10 (40x40px) - line 430
 * Padding: p-4
 */
export const ConversationListSkeleton: React.FC<
  ConversationListSkeletonProps
> = ({ count = 5, "aria-label": ariaLabel = "Loading conversations" }) => {
  return (
    <div
      className="divide-y divide-bsky-border-primary"
      role="status"
      aria-label={ariaLabel}
      aria-busy="true"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex cursor-pointer items-center gap-3 p-4 transition-colors"
        >
          {/* Avatar - h-10 w-10 (40x40px) matches DirectMessages line 430 */}
          <SkeletonLoader
            variant="circular"
            width={40}
            height={40}
            className="flex-shrink-0"
            aria-label={`Loading conversation ${i + 1}`}
          />
          <div className="min-w-0 flex-1">
            {/* Display name */}
            <SkeletonLoader
              width="50%"
              height={16}
              variant="rounded"
              className="mb-1"
            />
            {/* Handle */}
            <SkeletonLoader
              width="35%"
              height={14}
              variant="rounded"
              className="mb-1.5"
            />
            {/* Last message preview */}
            <SkeletonLoader width="80%" height={14} variant="rounded" />
          </div>
          {/* Timestamp */}
          <SkeletonLoader
            width={50}
            height={12}
            variant="rounded"
            className="flex-shrink-0"
          />
        </div>
      ))}
    </div>
  );
};

interface MessageListSkeletonProps {
  /** Number of message skeletons to show */
  count?: number;
  /** Accessibility label */
  "aria-label"?: string;
}

// Deterministic widths to prevent layout shift
const MESSAGE_WIDTHS = [65, 45, 80, 55, 70, 40, 75, 50, 60, 85];

/**
 * MessageListSkeleton - Matches DirectMessages.tsx message bubbles
 * Alternating left/right alignment for realistic appearance
 * Uses deterministic widths to prevent CLS
 */
export const MessageListSkeleton: React.FC<MessageListSkeletonProps> = ({
  count = 6,
  "aria-label": ariaLabel = "Loading messages",
}) => {
  return (
    <div
      className="flex flex-col gap-3 p-4"
      role="status"
      aria-label={ariaLabel}
      aria-busy="true"
    >
      {Array.from({ length: count }).map((_, i) => {
        const isOutgoing = i % 2 === 1;
        const width = MESSAGE_WIDTHS[i % MESSAGE_WIDTHS.length];

        return (
          <div
            key={i}
            className={`flex ${isOutgoing ? "justify-end" : "justify-start"}`}
          >
            <div className="max-w-[70%]" style={{ width: `${width}%` }}>
              <SkeletonLoader
                variant="rounded"
                height={i % 3 === 0 ? 64 : 44}
                className={isOutgoing ? "rounded-br-none" : "rounded-bl-none"}
                aria-label={`Loading message ${i + 1}`}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

/**
 * DMSkeleton - Complete DM view skeleton with conversation list and messages
 * Matches DirectMessages.tsx full layout
 */
interface DMSkeletonProps {
  /** Show the conversation list (left panel) */
  showConversationList?: boolean;
  /** Show message view (right panel) */
  showMessages?: boolean;
  /** Accessibility label */
  "aria-label"?: string;
}

export const DMSkeleton: React.FC<DMSkeletonProps> = ({
  showConversationList = true,
  showMessages = false,
  "aria-label": ariaLabel = "Loading direct messages",
}) => {
  return (
    <div
      className="flex h-[calc(100vh-8rem)] w-full overflow-hidden bg-bsky-bg-primary lg:h-[calc(100vh-4rem)]"
      role="status"
      aria-label={ariaLabel}
      aria-busy="true"
    >
      {/* Conversation list panel */}
      {showConversationList && (
        <div className="w-full border-r border-bsky-border-primary lg:w-80">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-bsky-border-primary p-4">
            <SkeletonLoader width={100} height={24} variant="rounded" />
            <SkeletonLoader variant="circular" width={24} height={24} />
          </div>
          {/* Conversation list */}
          <ConversationListSkeleton count={6} />
        </div>
      )}

      {/* Message view panel */}
      {showMessages && (
        <div className="hidden flex-1 flex-col lg:flex">
          {/* Message header */}
          <div className="flex items-center gap-3 border-b border-bsky-border-primary p-4">
            <SkeletonLoader variant="circular" width={40} height={40} />
            <div className="flex-1">
              <SkeletonLoader width={120} height={18} variant="rounded" />
            </div>
            <SkeletonLoader variant="circular" width={24} height={24} />
          </div>
          {/* Messages area */}
          <div className="flex-1 overflow-y-auto">
            <MessageListSkeleton count={8} />
          </div>
          {/* Message input */}
          <div className="border-t border-bsky-border-primary p-4">
            <div className="flex items-center gap-3">
              <SkeletonLoader
                width="100%"
                height={44}
                variant="rounded"
                className="flex-1"
              />
              <SkeletonLoader variant="circular" width={40} height={40} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface UserListSkeletonProps {
  /** Number of user skeletons to show */
  count?: number;
  /** Accessibility label */
  "aria-label"?: string;
}

export const UserListSkeleton: React.FC<UserListSkeletonProps> = ({
  count = 5,
  "aria-label": ariaLabel = "Loading users",
}) => {
  return (
    <div
      className="divide-y divide-bsky-border-primary"
      role="status"
      aria-label={ariaLabel}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-4">
          <SkeletonLoader
            variant="circular"
            width={48}
            height={48}
            aria-label={`Loading user ${i + 1}`}
          />
          <div className="flex-1">
            <SkeletonLoader width="40%" height={16} className="mb-1" />
            <SkeletonLoader width="30%" height={14} className="mb-1" />
            <SkeletonLoader width="80%" height={14} />
          </div>
        </div>
      ))}
    </div>
  );
};

interface ListItemSkeletonProps {
  /** Number of list item skeletons to show */
  count?: number;
  /** Accessibility label */
  "aria-label"?: string;
}

export const ListItemSkeleton: React.FC<ListItemSkeletonProps> = ({
  count = 3,
  "aria-label": ariaLabel = "Loading lists",
}) => {
  return (
    <div className="space-y-2 p-4" role="status" aria-label={ariaLabel}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-between rounded-lg border border-bsky-border-primary p-3"
        >
          <div className="flex-1">
            <SkeletonLoader
              width="50%"
              height={16}
              className="mb-1"
              aria-label={`Loading list ${i + 1}`}
            />
            <SkeletonLoader width="30%" height={14} />
          </div>
          <SkeletonLoader variant="circular" width={24} height={24} />
        </div>
      ))}
    </div>
  );
};
