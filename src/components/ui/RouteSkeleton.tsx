import React from "react";
import {
  ConversationListSkeleton,
  FeedSkeleton,
  NotificationFeedSkeleton,
  SearchResultSkeleton,
  SkeletonLoader,
  ThreadSkeleton as ThreadSkeletonBase,
} from "./SkeletonLoader";

/**
 * Route-specific skeleton components for Suspense fallbacks.
 * These provide contextual loading states instead of generic spinners.
 */

/**
 * Skeleton for home/SkyDeck view with multiple columns
 */
export const HomeSkeleton: React.FC = () => {
  return (
    <div
      className="flex h-full gap-3 overflow-hidden p-4"
      role="status"
      aria-label="Loading home feed"
    >
      {/* Single column on mobile, multiple on desktop */}
      <div className="flex-1 lg:max-w-[400px]">
        <ColumnSkeleton />
      </div>
      <div className="hidden flex-1 lg:block lg:max-w-[400px]">
        <ColumnSkeleton />
      </div>
      <div className="hidden flex-1 xl:block xl:max-w-[400px]">
        <ColumnSkeleton />
      </div>
    </div>
  );
};

/**
 * Skeleton for a single column (used in SkyDeck)
 */
export const ColumnSkeleton: React.FC = () => {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-bsky-border-primary bg-bsky-bg-secondary">
      {/* Column header */}
      <div className="flex items-center justify-between border-b border-bsky-border-primary p-3">
        <div className="flex items-center gap-2">
          <SkeletonLoader variant="circular" width={24} height={24} />
          <SkeletonLoader width={100} height={18} variant="rounded" />
        </div>
        <div className="flex gap-2">
          <SkeletonLoader width={28} height={28} variant="rounded" />
          <SkeletonLoader width={28} height={28} variant="rounded" />
        </div>
      </div>
      {/* Column content */}
      <div className="flex-1 overflow-hidden">
        <FeedSkeleton count={4} />
      </div>
    </div>
  );
};

/**
 * Skeleton for thread/post view
 * Re-exports the enhanced ThreadSkeleton from SkeletonLoader
 */
export const ThreadSkeleton: React.FC = () => {
  return <ThreadSkeletonBase replyCount={4} />;
};

/**
 * Skeleton for notifications page
 */
export const NotificationsSkeleton: React.FC = () => {
  return (
    <div
      className="mx-auto max-w-2xl"
      role="status"
      aria-label="Loading notifications"
    >
      {/* Filter tabs */}
      <div className="flex gap-2 border-b border-bsky-border-primary p-3">
        <SkeletonLoader width={60} height={32} variant="rounded" />
        <SkeletonLoader width={80} height={32} variant="rounded" />
        <SkeletonLoader width={70} height={32} variant="rounded" />
      </div>
      <NotificationFeedSkeleton count={6} />
    </div>
  );
};

/**
 * Skeleton for search page
 */
export const SearchSkeleton: React.FC = () => {
  return (
    <div
      className="mx-auto max-w-2xl"
      role="status"
      aria-label="Loading search"
    >
      {/* Search input */}
      <div className="border-b border-bsky-border-primary p-4">
        <SkeletonLoader width="100%" height={40} variant="rounded" />
      </div>
      {/* Tab bar */}
      <div className="flex gap-4 border-b border-bsky-border-primary px-4 py-2">
        <SkeletonLoader width={60} height={28} variant="rounded" />
        <SkeletonLoader width={60} height={28} variant="rounded" />
        <SkeletonLoader width={60} height={28} variant="rounded" />
      </div>
      {/* Results */}
      <div className="divide-y divide-bsky-border-primary">
        {Array.from({ length: 5 }).map((_, i) => (
          <SearchResultSkeleton key={i} />
        ))}
      </div>
    </div>
  );
};

/**
 * Skeleton for bookmarks page
 */
export const BookmarksSkeleton: React.FC = () => {
  return (
    <div
      className="mx-auto max-w-2xl"
      role="status"
      aria-label="Loading bookmarks"
    >
      {/* Header with filter */}
      <div className="flex items-center justify-between border-b border-bsky-border-primary p-4">
        <SkeletonLoader width={100} height={24} variant="rounded" />
        <SkeletonLoader width={120} height={36} variant="rounded" />
      </div>
      <FeedSkeleton count={5} />
    </div>
  );
};

/**
 * Skeleton for messages/DM page
 * Uses the enhanced ConversationListSkeleton for conversation list view
 */
export const MessagesSkeleton: React.FC = () => {
  return (
    <div
      className="mx-auto max-w-2xl"
      role="status"
      aria-label="Loading messages"
    >
      <ConversationListSkeleton count={6} />
    </div>
  );
};

/**
 * Skeleton for lists page
 */
export const ListsSkeleton: React.FC = () => {
  return (
    <div className="mx-auto max-w-2xl" role="status" aria-label="Loading lists">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-bsky-border-primary p-4">
        <SkeletonLoader width={80} height={24} />
        <SkeletonLoader width={100} height={36} variant="rounded" />
      </div>
      {/* List items */}
      <div className="divide-y divide-bsky-border-primary">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-4">
            <SkeletonLoader variant="circular" width={44} height={44} />
            <div className="flex-1">
              <SkeletonLoader width="50%" height={18} className="mb-1" />
              <SkeletonLoader width="70%" height={14} />
            </div>
            <SkeletonLoader width={24} height={24} variant="rounded" />
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Skeleton for settings page
 */
export const SettingsSkeleton: React.FC = () => {
  return (
    <div
      className="mx-auto max-w-4xl p-4"
      role="status"
      aria-label="Loading settings"
    >
      <div className="flex gap-6">
        {/* Sidebar nav */}
        <div className="hidden w-48 space-y-2 lg:block">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonLoader
              key={i}
              width="100%"
              height={36}
              variant="rounded"
            />
          ))}
        </div>
        {/* Main content */}
        <div className="flex-1 space-y-6">
          <SkeletonLoader width={200} height={28} />
          <div className="space-y-4 rounded-lg border border-bsky-border-primary p-4">
            <SkeletonLoader width="60%" height={20} />
            <SkeletonLoader width="100%" height={16} />
            <SkeletonLoader width="90%" height={16} />
            <div className="flex gap-3 pt-2">
              <SkeletonLoader width={100} height={36} variant="rounded" />
              <SkeletonLoader width={80} height={36} variant="rounded" />
            </div>
          </div>
          <div className="space-y-4 rounded-lg border border-bsky-border-primary p-4">
            <SkeletonLoader width="50%" height={20} />
            <SkeletonLoader width="100%" height={16} />
            <SkeletonLoader width="80%" height={16} />
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Skeleton for composer page
 */
export const ComposerSkeleton: React.FC = () => {
  return (
    <div
      className="mx-auto max-w-2xl p-4"
      role="status"
      aria-label="Loading composer"
    >
      <div className="rounded-lg border border-bsky-border-primary bg-bsky-bg-secondary p-4">
        <div className="flex gap-3">
          <SkeletonLoader variant="circular" width={48} height={48} />
          <div className="flex-1">
            <SkeletonLoader
              width="100%"
              height={120}
              variant="rounded"
              className="mb-4"
            />
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <SkeletonLoader width={32} height={32} variant="rounded" />
                <SkeletonLoader width={32} height={32} variant="rounded" />
                <SkeletonLoader width={32} height={32} variant="rounded" />
              </div>
              <SkeletonLoader width={80} height={36} variant="rounded" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Skeleton for analytics page
 */
export const AnalyticsSkeleton: React.FC = () => {
  return (
    <div
      className="mx-auto max-w-4xl p-4"
      role="status"
      aria-label="Loading analytics"
    >
      {/* Stats cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-bsky-border-primary p-4"
          >
            <SkeletonLoader width={60} height={14} className="mb-2" />
            <SkeletonLoader width={80} height={28} />
          </div>
        ))}
      </div>
      {/* Chart placeholder */}
      <div className="rounded-lg border border-bsky-border-primary p-4">
        <SkeletonLoader width={150} height={20} className="mb-4" />
        <SkeletonLoader width="100%" height={200} variant="rounded" />
      </div>
    </div>
  );
};

/**
 * Re-export skeleton components from SkeletonLoader for consistency
 */
export {
  ConversationListSkeleton,
  DMSkeleton,
  ProfileSkeleton,
} from "./SkeletonLoader";
