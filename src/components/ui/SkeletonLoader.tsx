import React from "react";

interface SkeletonLoaderProps {
  className?: string;
  height?: string | number;
  width?: string | number;
  variant?: "text" | "circular" | "rectangular" | "rounded";
  animation?: "pulse" | "wave";
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  className = "",
  height = "auto",
  width = "100%",
  variant = "text",
  animation = "pulse",
}) => {
  const baseClasses = "bg-gray-200 dark:bg-gray-700";
  
  const animationClasses = {
    pulse: "animate-pulse",
    wave: "animate-skeleton-wave",
  };
  
  const variantClasses = {
    text: "h-4 rounded",
    circular: "rounded-full",
    rectangular: "",
    rounded: "rounded-lg",
  };
  
  const style = {
    height: typeof height === "number" ? `${height}px` : height,
    width: typeof width === "number" ? `${width}px` : width,
  };
  
  return (
    <div
      className={`${baseClasses} ${animationClasses[animation]} ${variantClasses[variant]} ${className}`}
      style={style}
    />
  );
};

export const PostSkeleton: React.FC = () => {
  return (
    <div className="px-4 py-4 border-b border-gray-200 dark:border-gray-800">
      <div className="flex gap-3">
        <SkeletonLoader variant="circular" width={48} height={48} />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <SkeletonLoader width={120} height={16} />
            <SkeletonLoader width={80} height={16} />
          </div>
          <div className="space-y-2">
            <SkeletonLoader width="100%" height={16} />
            <SkeletonLoader width="90%" height={16} />
            <SkeletonLoader width="70%" height={16} />
          </div>
          <div className="flex gap-4 mt-3">
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
        <SkeletonLoader variant="circular" width={128} height={128} className="border-4 border-white dark:border-gray-900" />
      </div>
      <div className="space-y-2">
        <SkeletonLoader width={200} height={24} />
        <SkeletonLoader width={150} height={16} />
        <SkeletonLoader width="100%" height={16} />
        <SkeletonLoader width="80%" height={16} />
      </div>
      <div className="flex gap-4 mt-4">
        <SkeletonLoader width={100} height={36} variant="rounded" />
        <SkeletonLoader width={100} height={36} variant="rounded" />
      </div>
    </div>
  );
};

export const NotificationSkeleton: React.FC = () => {
  return (
    <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
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