import {
  ConversationListSkeleton,
  FeedSkeleton,
  NotificationFeedSkeleton,
  ProfileSkeleton,
  SearchResultSkeleton,
  ThreadSkeleton,
  UserListSkeleton,
} from "./SkeletonLoader";

/**
 * A single entry point for content-shaped loading states. Prefer this over
 * ad-hoc spinners (`animate-spin`) so loading UIs stay consistent and polished.
 * Each variant dispatches to the matching skeleton in SkeletonLoader.
 */
export type LoadingSkeletonVariant =
  | "feed"
  | "profile"
  | "notifications"
  | "search"
  | "thread"
  | "conversations"
  | "userList";

interface LoadingSkeletonProps {
  variant: LoadingSkeletonVariant;
  /** Number of rows for list-style variants (feed/notifications/conversations/userList/thread). */
  count?: number;
  "aria-label"?: string;
}

export function LoadingSkeleton({
  variant,
  count,
  "aria-label": ariaLabel,
}: LoadingSkeletonProps) {
  switch (variant) {
    case "feed":
      return <FeedSkeleton count={count} aria-label={ariaLabel} />;
    case "profile":
      return <ProfileSkeleton aria-label={ariaLabel} />;
    case "notifications":
      return <NotificationFeedSkeleton count={count} aria-label={ariaLabel} />;
    case "search":
      return <SearchResultSkeleton aria-label={ariaLabel} />;
    case "thread":
      return <ThreadSkeleton replyCount={count} aria-label={ariaLabel} />;
    case "conversations":
      return <ConversationListSkeleton count={count} aria-label={ariaLabel} />;
    case "userList":
      return <UserListSkeleton count={count} aria-label={ariaLabel} />;
    default:
      return <FeedSkeleton count={count} aria-label={ariaLabel} />;
  }
}
