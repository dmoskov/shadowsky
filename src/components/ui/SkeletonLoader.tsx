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

export const PostSkeleton: React.FC = () => {
  return (
    <div className="border-b border-gray-200 px-4 py-4 dark:border-gray-800">
      <div className="flex gap-3">
        <SkeletonLoader variant="circular" width={48} height={48} />
        <div className="flex-1">
          <div className="mb-2 flex items-center gap-2">
            <SkeletonLoader width={120} height={16} />
            <SkeletonLoader width={80} height={16} />
          </div>
          <div className="space-y-2">
            <SkeletonLoader width="100%" height={16} />
            <SkeletonLoader width="90%" height={16} />
            <SkeletonLoader width="70%" height={16} />
          </div>
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

export const FeedSkeleton: React.FC<{ count?: number }> = ({ count = 5 }) => {
  return (
    <div className="divide-y divide-gray-200 dark:divide-gray-800">
      {Array.from({ length: count }).map((_, i) => (
        <PostSkeleton key={i} />
      ))}
    </div>
  );
};

export const ProfileSkeleton: React.FC = () => {
  return (
    <div className="p-4">
      <SkeletonLoader variant="rectangular" height={200} className="mb-4" />
      <div className="relative -mt-16 mb-4">
        <SkeletonLoader
          variant="circular"
          width={128}
          height={128}
          className="border-4 border-white dark:border-gray-900"
        />
      </div>
      <div className="space-y-2">
        <SkeletonLoader width={200} height={24} />
        <SkeletonLoader width={150} height={16} />
        <SkeletonLoader width="100%" height={16} />
        <SkeletonLoader width="80%" height={16} />
      </div>
      <div className="mt-4 flex gap-4">
        <SkeletonLoader width={100} height={36} variant="rounded" />
        <SkeletonLoader width={100} height={36} variant="rounded" />
      </div>
    </div>
  );
};

export const NotificationSkeleton: React.FC = () => {
  return (
    <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-800">
      <div className="flex items-start gap-3">
        <SkeletonLoader variant="circular" width={40} height={40} />
        <div className="flex-1">
          <SkeletonLoader width="60%" height={16} className="mb-1" />
          <SkeletonLoader width="100%" height={14} />
        </div>
      </div>
    </div>
  );
};
