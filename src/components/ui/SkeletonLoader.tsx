import React from "react";

/**
 * Skeleton Loader Design System
 *
 * Unified skeleton loading components with consistent animation timing.
 *
 * Animation Tokens (from LoadingState):
 * - Pulse: 2s duration, cubic-bezier(0.4, 0, 0.6, 1)
 * - Shimmer: 2s duration, linear, left-to-right
 *
 * All skeletons use the bsky theme colors for consistent appearance
 * across light and dark modes.
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
  /** Accessibility label */
  "aria-label"?: string;
}

export const PostSkeleton: React.FC<PostSkeletonProps> = ({
  showImage = false,
  "aria-label": ariaLabel = "Loading post",
}) => {
  return (
    <div
      className="border-b border-bsky-border-primary px-4 py-4"
      role="status"
      aria-label={ariaLabel}
    >
      <div className="flex gap-3">
        <SkeletonLoader
          variant="circular"
          width={48}
          height={48}
          aria-label="Loading avatar"
        />
        <div className="flex-1">
          <div className="mb-2 flex items-center gap-2">
            <SkeletonLoader width={120} height={16} aria-label="Loading name" />
            <SkeletonLoader
              width={80}
              height={16}
              aria-label="Loading handle"
            />
          </div>
          <div className="space-y-2">
            <SkeletonLoader width="100%" height={16} />
            <SkeletonLoader width="90%" height={16} />
            <SkeletonLoader width="70%" height={16} />
          </div>
          {showImage && (
            <SkeletonLoader
              variant="rounded"
              width="100%"
              height={200}
              className="mt-3"
              aria-label="Loading image"
            />
          )}
          <div className="mt-3 flex gap-4">
            <SkeletonLoader width={50} height={20} variant="rounded" />
            <SkeletonLoader width={50} height={20} variant="rounded" />
            <SkeletonLoader width={50} height={20} variant="rounded" />
          </div>
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
  /** Accessibility label */
  "aria-label"?: string;
}

export const ProfileSkeleton: React.FC<ProfileSkeletonProps> = ({
  showBanner = true,
  "aria-label": ariaLabel = "Loading profile",
}) => {
  return (
    <div className="p-4" role="status" aria-label={ariaLabel}>
      {showBanner && (
        <SkeletonLoader
          variant="rectangular"
          height={200}
          className="mb-4 rounded-lg"
          aria-label="Loading banner"
        />
      )}
      <div className={`relative ${showBanner ? "-mt-16" : ""} mb-4`}>
        <SkeletonLoader
          variant="circular"
          width={128}
          height={128}
          className="border-4 border-bsky-bg-primary"
          aria-label="Loading avatar"
        />
      </div>
      <div className="space-y-2">
        <SkeletonLoader width={200} height={24} aria-label="Loading name" />
        <SkeletonLoader width={150} height={16} aria-label="Loading handle" />
        <SkeletonLoader width="100%" height={16} aria-label="Loading bio" />
        <SkeletonLoader width="80%" height={16} />
      </div>
      <div className="mt-4 flex gap-4">
        <SkeletonLoader
          width={100}
          height={36}
          variant="rounded"
          aria-label="Loading button"
        />
        <SkeletonLoader width={100} height={36} variant="rounded" />
      </div>
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
  /** Accessibility label */
  "aria-label"?: string;
}

export const ThreadSkeleton: React.FC<ThreadSkeletonProps> = ({
  replyCount = 3,
  "aria-label": ariaLabel = "Loading thread",
}) => {
  return (
    <div className="space-y-4" role="status" aria-label={ariaLabel}>
      {/* Root post skeleton - larger hero style */}
      <div className="rounded-lg border border-bsky-border-primary p-4">
        <div className="mb-4 flex items-center gap-3">
          <SkeletonLoader
            variant="circular"
            width={48}
            height={48}
            aria-label="Loading avatar"
          />
          <div className="flex-1">
            <SkeletonLoader width={150} height={18} className="mb-1" />
            <SkeletonLoader width={100} height={14} />
          </div>
        </div>
        <div className="space-y-2">
          <SkeletonLoader width="100%" height={20} />
          <SkeletonLoader width="95%" height={20} />
          <SkeletonLoader width="80%" height={20} />
        </div>
        <div className="mt-4 flex gap-4">
          <SkeletonLoader width={60} height={24} variant="rounded" />
          <SkeletonLoader width={60} height={24} variant="rounded" />
          <SkeletonLoader width={60} height={24} variant="rounded" />
        </div>
      </div>

      {/* Reply skeletons - smaller, nested style */}
      {Array.from({ length: replyCount }).map((_, i) => (
        <div
          key={i}
          className="ml-4 rounded-lg border border-bsky-border-primary p-3"
          style={{ marginLeft: `${(i % 3) * 16 + 16}px` }}
        >
          <div className="flex items-start gap-3">
            <SkeletonLoader
              variant="circular"
              width={36}
              height={36}
              aria-label={`Loading reply ${i + 1} avatar`}
            />
            <div className="flex-1">
              <div className="mb-2 flex items-center gap-2">
                <SkeletonLoader width={100} height={14} />
                <SkeletonLoader width={60} height={14} />
              </div>
              <div className="space-y-1">
                <SkeletonLoader width="90%" height={14} />
                <SkeletonLoader width="70%" height={14} />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

interface ConversationListSkeletonProps {
  /** Number of conversation skeletons to show */
  count?: number;
  /** Accessibility label */
  "aria-label"?: string;
}

export const ConversationListSkeleton: React.FC<
  ConversationListSkeletonProps
> = ({ count = 5, "aria-label": ariaLabel = "Loading conversations" }) => {
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
            width={40}
            height={40}
            aria-label={`Loading conversation ${i + 1}`}
          />
          <div className="min-w-0 flex-1">
            <SkeletonLoader width="60%" height={16} className="mb-1" />
            <SkeletonLoader width="40%" height={14} className="mb-1" />
            <SkeletonLoader width="80%" height={14} />
          </div>
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

export const MessageListSkeleton: React.FC<MessageListSkeletonProps> = ({
  count = 5,
  "aria-label": ariaLabel = "Loading messages",
}) => {
  return (
    <div className="space-y-4 p-4" role="status" aria-label={ariaLabel}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}
        >
          <div
            className={`max-w-[70%] ${i % 2 === 0 ? "" : "text-right"}`}
            style={{ width: `${Math.random() * 30 + 40}%` }}
          >
            <SkeletonLoader
              variant="rounded"
              height={48}
              aria-label={`Loading message ${i + 1}`}
            />
          </div>
        </div>
      ))}
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
