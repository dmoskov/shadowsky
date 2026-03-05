import type { Notification } from "@atproto/api/dist/client/types/app/bsky/notification/listNotifications";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  ChevronUp,
  Crown,
  Filter,
  Image,
  Loader,
  MoreVertical,
  RefreshCw,
  Users,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { Link, useLocation } from "react-router";
import { useModeration } from "../contexts/ModerationContext";
import { useFollowing } from "../hooks/useFollowing";
import {
  useBatchedNotificationTransition,
  useNotificationBatching,
} from "../hooks/useNotificationBatching";
import {
  postHasImages,
  useNotificationPosts,
} from "../hooks/useNotificationPosts";
import {
  useMarkNotificationsRead,
  useNotifications,
  useUnreadCount,
} from "../hooks/useNotifications";
import { useMinDuration } from "../hooks/useTiming";
import { useViewTransitionNavigate } from "../hooks/useViewTransitionNavigate";
import { proxifyBskyImage } from "../utils/image-proxy";
import { NotificationCache } from "../utils/notificationCache";
import { getNotificationUrl } from "../utils/url-helpers";
import {
  AtSignIcon,
  FollowIcon,
  HeartIcon,
  QuoteIcon,
  ReplyIcon,
  RepostIcon,
} from "./icons";
import {
  AggregatedNotificationItem,
  aggregateNotifications,
} from "./NotificationAggregator";
import { ThreadModal } from "./ThreadModal";
import { TopAccountsView } from "./TopAccountsView";
import { DomainVerifiedBadgeInline } from "./ui/DomainVerifiedBadge";
import { ProfileHoverCard } from "./ui/ProfileHoverCard";
import { NotificationSkeleton } from "./ui/SkeletonLoader";

type NotificationFilter =
  | "all"
  | "likes"
  | "reposts"
  | "follows"
  | "mentions"
  | "replies"
  | "quotes"
  | "images"
  | "top-accounts"
  | "from-following";

const NotificationsFeedComponent: React.FC = () => {
  const navigate = useViewTransitionNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const showTopAccounts = searchParams.get("top") === "1";
  const queryClient = useQueryClient();
  const { isThreadMuted } = useModeration();

  const [filter, setFilter] = useState<NotificationFilter>("all");
  // Removed unread only filter
  // const [showUnreadOnly, setShowUnreadOnly] = useState(false)
  const [expandedAggregations, setExpandedAggregations] = useState<Set<string>>(
    new Set(),
  );
  const [minFollowerCount, setMinFollowerCount] = useState(10000);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [moreFiltersPosition, setMoreFiltersPosition] = useState<{
    top: number;
    right: number;
  } | null>(null);
  const [selectedPostUri, setSelectedPostUri] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  // Removed isFromCache state - no longer needed without header
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const moreFiltersRef = useRef<HTMLDivElement>(null);
  const moreFiltersButtonRef = useRef<HTMLButtonElement>(null);

  // Handle filter changes
  const handleFilterChange = (newFilter: NotificationFilter) => {
    setFilter(newFilter);
  };

  // Handle refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Clear all notification caches
    NotificationCache.clearAll();
    // Clear any object cache as well
    localStorage.removeItem("notification_object_cache");
    // Invalidate and refetch the notifications query
    await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    await queryClient.refetchQueries({ queryKey: ["notifications"] });
    setIsRefreshing(false);
  };

  // Reset filter if top accounts is hidden but was selected
  useEffect(() => {
    if (!showTopAccounts && filter === "top-accounts") {
      setFilter("all");
    }
  }, [showTopAccounts, filter]);

  const {
    data,
    isLoading: isLoadingRaw,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useNotifications();
  const { data: unreadCount } = useUnreadCount();
  const { mutate: markAsRead } = useMarkNotificationsRead();
  const { data: followingSet, isLoading: isLoadingFollowing } = useFollowing();

  // Apply minimum duration to prevent jarring flash of loading state
  const isLoading = useMinDuration(isLoadingRaw);

  // Clear unread indicator when component mounts (user navigates to notifications)
  useEffect(() => {
    // Only mark as read if we have unread notifications
    if (unreadCount && unreadCount > 0) {
      // Small delay to ensure the user has seen the page
      const timer = setTimeout(() => {
        markAsRead();
      }, 1500); // 1.5 second delay - enough time for page to load

      return () => clearTimeout(timer);
    }
  }, [unreadCount, markAsRead]); // Re-run when unreadCount changes

  const rawNotifications = React.useMemo(() => {
    if (!data?.pages) {
      return [];
    }
    const allNotifications = data.pages.flatMap(
      (page: any) => page.notifications || [],
    );
    return allNotifications;
  }, [data?.pages]);

  // Apply time-window batching to reduce UI jank during high-activity periods
  const { batchedNotifications } = useNotificationBatching(rawNotifications, {
    enabled: true,
    config: {
      batchWindowMs: 5000, // 5-second batching window
      maxBatchSize: 100,
      enableGrouping: true,
    },
  });

  // Apply smooth transitions for batched updates
  const {
    displayNotifications: notifications,
    isTransitioning,
    newNotificationIds,
  } = useBatchedNotificationTransition(batchedNotifications, {
    transitionDuration: 300,
    enableAnimation: true,
  });

  // Cache indicator removed - no longer needed without header

  // Update page title with unread count
  useEffect(() => {
    if (unreadCount !== undefined && unreadCount !== null && unreadCount > 0) {
      document.title = `(${unreadCount}) Bluesky Notifications`;
    } else {
      document.title = "Bluesky Notifications";
    }

    // Cleanup
    return () => {
      document.title = "Bluesky Notifications";
    };
  }, [unreadCount]);

  // Close more filters dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        moreFiltersRef.current &&
        !moreFiltersRef.current.contains(event.target as Node)
      ) {
        setShowMoreFilters(false);
      }
    };

    if (showMoreFilters) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showMoreFilters]);

  // Fetch posts for notifications that might have images
  // We always fetch posts to show images in all views
  const {
    data: posts,
    totalPosts,
    fetchedPosts,
    isFetchingMore,
  } = useNotificationPosts(notifications);

  // Set up intersection observer to load more notifications
  useEffect(() => {
    if (!loadMoreRef.current || !hasNextPage || isFetchingNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 },
    );

    const currentRef = loadMoreRef.current;
    observer.observe(currentRef);

    return () => {
      observer.unobserve(currentRef);
      observer.disconnect();
    };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Removed automatic loading of 3 pages - let intersection observer handle it
  // This was causing the UI to flicker as it loaded 3 times automatically

  const filteredNotifications = React.useMemo(() => {
    if (!notifications || notifications.length === 0) {
      return [];
    }

    let filtered = [...notifications];

    // Filter out notifications from muted threads
    // We check against the fetched posts to determine thread roots
    if (posts && posts.length > 0) {
      const postUriToRoot = new Map<string, string>();
      posts.forEach((post) => {
        const record = post.record as
          | { reply?: { root: { uri: string } } }
          | undefined;
        const rootUri = record?.reply?.root?.uri || post.uri;
        postUriToRoot.set(post.uri, rootUri);
      });

      filtered = filtered.filter((n: Notification) => {
        // Get the post URI for this notification
        let postUri: string | undefined;
        if (n.reason === "repost" || n.reason === "like") {
          postUri = n.reasonSubject;
        } else if (
          n.reason === "reply" ||
          n.reason === "mention" ||
          n.reason === "quote"
        ) {
          postUri = n.uri;
        }

        // If we have the post URI and can determine its root, check if muted
        if (postUri && postUriToRoot.has(postUri)) {
          const rootUri = postUriToRoot.get(postUri)!;
          return !isThreadMuted(rootUri);
        }

        // If we don't have the post data yet, keep the notification
        // (it will be filtered once posts are loaded)
        return true;
      });
    }

    if (filter === "images") {
      // Filter notifications that have posts with images
      if (posts && posts.length > 0) {
        const postsWithImages = new Set(
          posts.filter(postHasImages).map((post) => post.uri),
        );
        filtered = filtered.filter((n: Notification) => {
          if (!["like", "repost", "reply", "quote"].includes(n.reason))
            return false;
          // For reposts and likes, use reasonSubject which contains the original post URI
          const postUri =
            (n.reason === "repost" || n.reason === "like") && n.reasonSubject
              ? n.reasonSubject
              : n.uri;
          return postsWithImages.has(postUri);
        });
      } else {
        // While posts are loading, show empty
        filtered = [];
      }
    } else if (
      filter !== "all" &&
      filter !== "top-accounts" &&
      filter !== "from-following"
    ) {
      const filterMap: Record<
        Exclude<
          NotificationFilter,
          "all" | "images" | "top-accounts" | "from-following"
        >,
        string[]
      > = {
        likes: ["like"],
        reposts: ["repost"],
        follows: ["follow"],
        mentions: ["mention"],
        replies: ["reply"],
        quotes: ["quote"],
      };
      filtered = filtered.filter((n: Notification) =>
        filterMap[
          filter as Exclude<
            NotificationFilter,
            "all" | "images" | "top-accounts" | "from-following"
          >
        ].includes(n.reason),
      );
    }

    // Filter for notifications from people you follow
    if (filter === "from-following" && followingSet) {
      filtered = filtered.filter((n: Notification) =>
        followingSet.has(n.author.did),
      );
    }

    // Removed unread only filter
    // if (showUnreadOnly) {
    //   filtered = filtered.filter((n: Notification) => !n.isRead)
    // }

    return filtered;
  }, [
    notifications?.length,
    notifications,
    filter,
    posts,
    followingSet,
    isThreadMuted,
  ]);

  // Calculate counts for each filter type
  const filterCounts = React.useMemo(() => {
    const counts: Record<NotificationFilter, number> = {
      all: notifications?.length || 0,
      likes: 0,
      reposts: 0,
      follows: 0,
      mentions: 0,
      replies: 0,
      quotes: 0,
      images: 0,
      "top-accounts": 0,
      "from-following": 0,
    };

    // Count notifications by type
    notifications?.forEach((n: Notification) => {
      switch (n.reason) {
        case "like":
          counts.likes++;
          break;
        case "repost":
          counts.reposts++;
          break;
        case "follow":
          counts.follows++;
          break;
        case "mention":
          counts.mentions++;
          break;
        case "reply":
          counts.replies++;
          break;
        case "quote":
          counts.quotes++;
          break;
      }

      // Count notifications from people you follow
      if (followingSet && followingSet.has(n.author.did)) {
        counts["from-following"]++;
      }
    });

    // Count notifications with images
    if (posts && posts.length > 0) {
      const postsWithImages = new Set(
        posts.filter(postHasImages).map((post) => post.uri),
      );
      notifications.forEach((n: Notification) => {
        if (["like", "repost", "reply", "quote"].includes(n.reason)) {
          const postUri =
            (n.reason === "repost" || n.reason === "like") && n.reasonSubject
              ? n.reasonSubject
              : n.uri;
          if (postsWithImages.has(postUri)) {
            counts.images++;
          }
        }
      });
    }

    // For top-accounts, we'd need to implement the logic to count notifications from high-follower accounts
    // This is handled separately in TopAccountsView component

    return counts;
  }, [notifications?.length, notifications, posts, followingSet]);

  // Create a map for quick post lookup
  const postMap = React.useMemo(() => {
    if (!posts) return new Map();
    const map = new Map(posts.map((post) => [post.uri, post]));
    return map;
  }, [posts]); // Remove unnecessary fetchedPosts dependency

  const getNotificationIcon = React.useCallback((reason: string) => {
    switch (reason) {
      case "like":
        return (
          <HeartIcon size={18} filled style={{ color: "var(--asph-like)" }} />
        );
      case "repost":
        return <RepostIcon size={18} style={{ color: "var(--asph-repost)" }} />;
      case "follow":
        return <FollowIcon size={18} style={{ color: "var(--asph-follow)" }} />;
      case "mention":
        return (
          <AtSignIcon size={18} style={{ color: "var(--asph-mention)" }} />
        );
      case "reply":
        return <ReplyIcon size={18} style={{ color: "var(--asph-reply)" }} />;
      case "quote":
        return <QuoteIcon size={18} style={{ color: "var(--asph-quote)" }} />;
      case "starterpack-joined":
        return <FollowIcon size={18} style={{ color: "var(--asph-follow)" }} />;
      default:
        return null;
    }
  }, []);

  if (isLoading) {
    return (
      <div className="skeleton-stagger">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={`notif-skeleton-${i}`}
            className="animate-skeleton-reveal"
            style={
              {
                "--reveal-delay": `${i * 40}ms`,
                "--reveal-duration": "300ms",
              } as React.CSSProperties
            }
          >
            <NotificationSkeleton />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div
          className="asph-card p-4"
          style={{
            borderColor: "var(--asph-error)",
            backgroundColor: "rgba(239, 68, 68, 0.1)",
          }}
        >
          <p style={{ color: "var(--asph-error)" }}>
            Failed to load notifications
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="asph-font" role="main" aria-label="Notifications">
      {/* Filter tabs */}
      <div
        className="asph-glass sticky top-0 z-10 border-b border-asph-border-primary"
        role="toolbar"
        aria-label="Notification filters"
      >
        <div className="overflow-hidden px-3 py-2">
          {/* Filter tabs and actions */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              {/* Primary tabs - always visible */}
              <div className="scrollbar-hide flex min-w-0 flex-1 gap-1 overflow-x-auto overflow-y-hidden">
                <FilterTab
                  active={filter === "all"}
                  onClick={() => handleFilterChange("all")}
                  icon={<Filter size={16} />}
                  label="All"
                  count={filterCounts["all"]}
                />
                <FilterTab
                  active={filter === "likes"}
                  onClick={() => handleFilterChange("likes")}
                  icon={<HeartIcon size={16} />}
                  label="Likes"
                  count={filterCounts["likes"]}
                />
                <FilterTab
                  active={filter === "reposts"}
                  onClick={() => handleFilterChange("reposts")}
                  icon={<RepostIcon size={16} />}
                  label="Reposts"
                  count={filterCounts["reposts"]}
                />
                <FilterTab
                  active={filter === "mentions"}
                  onClick={() => handleFilterChange("mentions")}
                  icon={<AtSignIcon size={16} />}
                  label="Mentions"
                  count={filterCounts["mentions"]}
                />
                {/* Mobile-only additional tabs */}
                <div className="flex gap-1 md:hidden">
                  <FilterTab
                    active={filter === "replies"}
                    onClick={() => handleFilterChange("replies")}
                    icon={<ReplyIcon size={16} />}
                    label="Replies"
                    count={filterCounts["replies"]}
                  />
                  <FilterTab
                    active={filter === "follows"}
                    onClick={() => handleFilterChange("follows")}
                    icon={<FollowIcon size={16} />}
                    label="Follows"
                    count={filterCounts["follows"]}
                  />
                </div>

                {/* Desktop-only tabs */}
                <div className="hidden gap-1 md:flex">
                  <FilterTab
                    active={filter === "follows"}
                    onClick={() => handleFilterChange("follows")}
                    icon={<FollowIcon size={16} />}
                    label="Follows"
                    count={filterCounts["follows"]}
                  />
                  <FilterTab
                    active={filter === "replies"}
                    onClick={() => handleFilterChange("replies")}
                    icon={<ReplyIcon size={16} />}
                    label="Replies"
                    count={filterCounts["replies"]}
                  />
                  <FilterTab
                    active={filter === "quotes"}
                    onClick={() => handleFilterChange("quotes")}
                    icon={<QuoteIcon size={16} />}
                    label="Quotes"
                    count={filterCounts["quotes"]}
                  />
                  <FilterTab
                    active={filter === "images"}
                    onClick={() => handleFilterChange("images")}
                    icon={<Image size={16} />}
                    label="Images"
                    count={filterCounts["images"]}
                  />
                  <FilterTab
                    active={filter === "from-following"}
                    onClick={() => handleFilterChange("from-following")}
                    icon={<Users size={16} />}
                    label="Following"
                    count={filterCounts["from-following"]}
                    disabled={isLoadingFollowing}
                  />
                  {showTopAccounts && (
                    <FilterTab
                      active={filter === "top-accounts"}
                      onClick={() => handleFilterChange("top-accounts")}
                      icon={<Crown size={16} />}
                      label="Top Accounts"
                      count={filterCounts["top-accounts"]}
                    />
                  )}
                </div>
              </div>

              {/* More menu for mobile */}
              <div className="relative md:hidden">
                <button
                  ref={moreFiltersButtonRef}
                  onClick={() => {
                    if (!showMoreFilters && moreFiltersButtonRef.current) {
                      const rect =
                        moreFiltersButtonRef.current.getBoundingClientRect();
                      setMoreFiltersPosition({
                        top: rect.bottom + 4,
                        right: window.innerWidth - rect.right,
                      });
                    }
                    setShowMoreFilters(!showMoreFilters);
                  }}
                  className={`touch-target flex items-center rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200 ${
                    showMoreFilters
                      ? "bg-asph-primary text-white"
                      : "text-asph-text-secondary hover:bg-asph-bg-secondary hover:text-asph-text-primary"
                  }`}
                  aria-label="More filters"
                >
                  <MoreVertical size={16} />
                </button>

                {showMoreFilters &&
                  moreFiltersPosition &&
                  ReactDOM.createPortal(
                    <div
                      ref={moreFiltersRef}
                      className="fixed z-[9999] w-48 rounded-lg border border-asph-border-primary bg-asph-bg-secondary p-1 shadow-md"
                      style={{
                        top: `${moreFiltersPosition.top}px`,
                        right: `${moreFiltersPosition.right}px`,
                      }}
                    >
                      <button
                        onClick={() => {
                          handleFilterChange("quotes");
                          setShowMoreFilters(false);
                        }}
                        className={`touch-target flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-asph-bg-hover ${
                          filter === "quotes" ? "text-blue-500" : ""
                        }`}
                      >
                        <QuoteIcon size={16} />
                        <span>Quotes</span>
                        {filterCounts["quotes"] > 0 && (
                          <span className="ml-auto text-xs">
                            ({filterCounts["quotes"]})
                          </span>
                        )}
                      </button>
                      <button
                        onClick={() => {
                          handleFilterChange("images");
                          setShowMoreFilters(false);
                        }}
                        className={`touch-target flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-asph-bg-hover ${
                          filter === "images" ? "text-blue-500" : ""
                        }`}
                      >
                        <Image size={16} />
                        <span>Images</span>
                        {filterCounts["images"] > 0 && (
                          <span className="ml-auto text-xs">
                            ({filterCounts["images"]})
                          </span>
                        )}
                      </button>
                      <button
                        onClick={() => {
                          handleFilterChange("from-following");
                          setShowMoreFilters(false);
                        }}
                        className={`touch-target flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-asph-bg-hover ${
                          filter === "from-following" ? "text-blue-500" : ""
                        }`}
                        disabled={isLoadingFollowing}
                      >
                        <Users size={16} />
                        <span>Following</span>
                        {filterCounts["from-following"] > 0 && (
                          <span className="ml-auto text-xs">
                            ({filterCounts["from-following"]})
                          </span>
                        )}
                      </button>
                      {showTopAccounts && (
                        <button
                          onClick={() => {
                            handleFilterChange("top-accounts");
                            setShowMoreFilters(false);
                          }}
                          className={`touch-target flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-asph-bg-hover ${
                            filter === "top-accounts" ? "text-blue-500" : ""
                          }`}
                        >
                          <Crown size={16} />
                          <span>Top Accounts</span>
                          {filterCounts["top-accounts"] > 0 && (
                            <span className="ml-auto text-xs">
                              ({filterCounts["top-accounts"]})
                            </span>
                          )}
                        </button>
                      )}
                    </div>,
                    document.body,
                  )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              {/* Refresh button */}
              <button
                onClick={handleRefresh}
                disabled={isRefreshing || isLoading}
                className="touch-target-sm flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium text-asph-text-secondary transition-all hover:bg-asph-bg-secondary hover:text-asph-text-primary disabled:opacity-50"
                aria-label={
                  isRefreshing
                    ? "Refreshing notifications"
                    : "Refresh notifications"
                }
              >
                <RefreshCw
                  size={16}
                  className={isRefreshing ? "animate-spin" : ""}
                  aria-hidden="true"
                />
                <span className="hidden sm:inline">Refresh</span>
              </button>

              {/* Mark all as read button */}
              {unreadCount && unreadCount > 0 && (
                <button
                  onClick={() => markAsRead()}
                  aria-label={`Mark all ${unreadCount} notifications as read`}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="touch-target-sm flex flex-shrink-0 items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium text-asph-primary transition-all hover:bg-asph-bg-secondary"
                    aria-hidden="true"
                  >
                    <polyline points="9 11 12 14 22 4" />
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                  </svg>
                  <span className="hidden sm:inline">Mark all read</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Notifications list */}
      <div
        className="mx-auto max-w-4xl px-3 sm:px-6"
        role="feed"
        aria-label="Notifications feed"
      >
        {filter === "top-accounts" ? (
          <TopAccountsView
            notifications={notifications}
            minFollowerCount={minFollowerCount}
            onConfigClick={() => setShowConfigModal(true)}
          />
        ) : isRefreshing ||
          (filter === "from-following" && isLoadingFollowing) ? (
          <div className="skeleton-stagger">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={`notif-refresh-skeleton-${i}`}
                className="animate-skeleton-reveal"
                style={
                  {
                    "--reveal-delay": `${i * 40}ms`,
                    "--reveal-duration": "300ms",
                  } as React.CSSProperties
                }
              >
                <NotificationSkeleton />
              </div>
            ))}
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div
            className="p-6 text-center sm:p-12"
            style={{ color: "var(--asph-text-tertiary)" }}
          >
            <div className="mb-4 text-5xl opacity-20">📭</div>
            <p className="text-lg">No notifications to show</p>
            <p className="mt-2 text-sm">Check back later for updates</p>
          </div>
        ) : [
            "all",
            "likes",
            "reposts",
            "follows",
            "quotes",
            "from-following",
          ].includes(filter) ? (
          // Show aggregated notifications for tabs that support aggregation
          (() => {
            const processedNotifications = aggregateNotifications(
              filteredNotifications,
            );

            return processedNotifications.map((item, index) => {
              if (item.type === "aggregated") {
                const aggregationKey = `${item.reason}-${item.latestTimestamp}-${index}`;
                const isExpanded = expandedAggregations.has(aggregationKey);

                return (
                  <div key={aggregationKey}>
                    <AggregatedNotificationItem
                      item={item}
                      postMap={postMap}
                      showTypeLabel={filter === "all"}
                      isFetchingMore={isFetchingMore}
                      fetchedPosts={fetchedPosts}
                      totalPosts={totalPosts}
                      markAsRead={markAsRead}
                      isExpanded={isExpanded}
                      onNavigate={(url) => {
                        // Check if this is a thread URL
                        if (url.startsWith("/thread/")) {
                          // Extract the post URI from the URL path
                          // URL format: /thread/handle/postId
                          // For thread URLs, we need to use the correct URI based on notification type
                          // Use targetPostUri if available, otherwise fall back to reasonSubject/uri
                          const postUri =
                            item.targetPostUri ||
                            ((item.reason === "repost" ||
                              item.reason === "like") &&
                            item.notifications[0].reasonSubject
                              ? item.notifications[0].reasonSubject
                              : item.notifications[0].uri);
                          setSelectedPostUri(postUri);
                        } else if (url.startsWith("/profile/")) {
                          // Navigate to profile
                          navigate(url);
                        } else {
                          // Default navigation
                          navigate(url);
                        }
                      }}
                      onExpand={() => {
                        const newExpanded = new Set(expandedAggregations);
                        if (isExpanded) {
                          newExpanded.delete(aggregationKey);
                        } else {
                          newExpanded.add(aggregationKey);
                        }
                        setExpandedAggregations(newExpanded);
                      }}
                    />

                    {/* Show individual notifications when expanded */}
                    {isExpanded && (
                      <div
                        className="border-l-2"
                        style={{
                          borderColor: "var(--asph-border-secondary)",
                          marginLeft: "3rem",
                        }}
                      >
                        {item.notifications.map((notification) => {
                          const notificationKey = `${notification.uri}-${notification.indexedAt}`;
                          return (
                            <NotificationItem
                              key={notificationKey}
                              notification={notification}
                              postMap={postMap}
                              getNotificationIcon={getNotificationIcon}
                              showTypeLabel={filter === "all"}
                              isFetchingMore={isFetchingMore}
                              fetchedPosts={fetchedPosts}
                              totalPosts={totalPosts}
                              setSelectedPostUri={setSelectedPostUri}
                              markAsRead={markAsRead}
                              isNew={
                                isTransitioning &&
                                newNotificationIds.has(notificationKey)
                              }
                            />
                          );
                        })}
                        <button
                          onClick={() => {
                            const newExpanded = new Set(expandedAggregations);
                            newExpanded.delete(aggregationKey);
                            setExpandedAggregations(newExpanded);
                          }}
                          className="touch-target-list-item flex w-full items-center gap-1 rounded-md px-3 py-2 text-left text-xs hover:bg-asph-bg-hover"
                          style={{
                            color: "var(--asph-text-secondary)",
                            paddingLeft: "calc(1rem + 3rem)",
                          }}
                        >
                          <ChevronUp size={14} />
                          Collapse
                        </button>
                      </div>
                    )}
                  </div>
                );
              } else {
                const notificationKey = `${item.notification.uri}-${item.notification.indexedAt}`;
                return (
                  <NotificationItem
                    key={notificationKey}
                    notification={item.notification}
                    postMap={postMap}
                    getNotificationIcon={getNotificationIcon}
                    showTypeLabel={filter === "all"}
                    isFetchingMore={isFetchingMore}
                    fetchedPosts={fetchedPosts}
                    totalPosts={totalPosts}
                    setSelectedPostUri={setSelectedPostUri}
                    markAsRead={markAsRead}
                    isNew={
                      isTransitioning && newNotificationIds.has(notificationKey)
                    }
                  />
                );
              }
            });
          })()
        ) : (
          // Show regular notifications for mentions, replies, and images tabs (no aggregation)
          filteredNotifications.map((notification: Notification, index) => {
            const notificationKey = `${notification.uri}-${notification.indexedAt}`;
            return (
              <NotificationItem
                key={`${notificationKey}-${index}`}
                notification={notification}
                postMap={postMap}
                getNotificationIcon={getNotificationIcon}
                showTypeLabel={filter === "all"}
                isFetchingMore={isFetchingMore}
                fetchedPosts={fetchedPosts}
                totalPosts={totalPosts}
                setSelectedPostUri={setSelectedPostUri}
                markAsRead={markAsRead}
                isNew={
                  isTransitioning && newNotificationIds.has(notificationKey)
                }
              />
            );
          })
        )}

        {/* Loading more indicator */}
        {(hasNextPage || isFetchingNextPage) && (
          <div ref={loadMoreRef} className="flex justify-center p-8">
            {isFetchingNextPage ? (
              <div
                className="flex items-center gap-2"
                style={{ color: "var(--asph-text-secondary)" }}
              >
                <Loader
                  className="animate-spin"
                  size={20}
                  style={{ color: "var(--asph-primary)" }}
                />
                <span className="text-sm">Loading more...</span>
              </div>
            ) : (
              <div
                className="text-sm"
                style={{ color: "var(--asph-text-tertiary)" }}
              >
                <div className="animate-pulse">↓ Scroll for more</div>
              </div>
            )}
          </div>
        )}

        {/* End of notifications message */}
        {!hasNextPage && notifications.length > 0 && (
          <div className="p-8 text-center">
            <div className="asph-badge mb-2">
              {notifications.length >= 1000
                ? `1,000 notifications max`
                : `End of notifications`}
            </div>
            <p
              className="text-xs"
              style={{ color: "var(--asph-text-tertiary)" }}
            >
              {notifications.length >= 1000
                ? "Showing the most recent 1,000 notifications"
                : "No more notifications from the last 14 days"}
            </p>
          </div>
        )}

        {/* Configuration Modal */}
        {showConfigModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="asph-card w-full max-w-md p-6">
              <h3
                className="mb-4 text-lg font-semibold"
                style={{ color: "var(--asph-text-primary)" }}
              >
                Top Accounts Settings
              </h3>

              <div className="mb-4">
                <label
                  className="mb-2 block text-sm"
                  style={{ color: "var(--asph-text-secondary)" }}
                >
                  Minimum Follower Count
                </label>
                <input
                  type="number"
                  value={minFollowerCount}
                  onChange={(e) => setMinFollowerCount(Number(e.target.value))}
                  className="asph-input w-full rounded px-3 py-2"
                  style={{
                    backgroundColor: "var(--asph-bg-secondary)",
                    border: "1px solid var(--asph-border-primary)",
                    color: "var(--asph-text-primary)",
                  }}
                  min="0"
                  step="1000"
                />
                <p
                  className="mt-1 text-xs"
                  style={{ color: "var(--asph-text-tertiary)" }}
                >
                  Show accounts with at least this many followers
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowConfigModal(false)}
                  className="touch-target asph-button-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setShowConfigModal(false)}
                  className="touch-target asph-button-primary"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Thread Modal */}
      {selectedPostUri && (
        <ThreadModal
          postUri={selectedPostUri}
          onClose={() => setSelectedPostUri(null)}
        />
      )}
    </div>
  );
};

/**
 * Memoized NotificationsFeed for optimal rendering performance
 */
export const NotificationsFeed = React.memo(NotificationsFeedComponent);

NotificationsFeed.displayName = "NotificationsFeed";

interface FilterTabProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
  count?: number;
}

const FilterTab: React.FC<FilterTabProps> = React.memo(
  ({ active, onClick, icon, label, disabled, count }) => {
    return (
      <button
        onClick={onClick}
        className={`touch-target flex items-center gap-0.5 whitespace-nowrap rounded-md px-1.5 py-1 text-xs font-medium transition-all duration-200 sm:gap-1 sm:px-2 sm:py-1.5 sm:text-sm md:px-2.5 ${
          active
            ? "bg-asph-primary text-white"
            : "text-asph-text-secondary hover:bg-asph-bg-secondary hover:text-asph-text-primary"
        } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
        aria-label={`Filter by ${label}${count !== undefined && count > 0 ? `, ${count} items` : ""}`}
        aria-pressed={active}
        disabled={disabled}
        role="tab"
        aria-selected={active}
      >
        <span className="flex-shrink-0" aria-hidden="true">
          {icon}
        </span>
        <span className="hidden sm:inline">{label}</span>
        {count !== undefined && count > 0 && (
          <span
            className={`text-[10px] font-bold sm:text-xs ${
              active ? "text-white/90" : "text-asph-text-tertiary"
            }`}
            aria-hidden="true"
          >
            {count}
          </span>
        )}
      </button>
    );
  },
);

FilterTab.displayName = "FilterTab";

function getNotificationText(reason: string): string {
  switch (reason) {
    case "like":
      return "liked your post";
    case "repost":
      return "reposted your post";
    case "follow":
      return "followed you";
    case "mention":
      return "mentioned you";
    case "reply":
      return "replied to your post";
    case "quote":
      return "quoted your post";
    case "starterpack-joined":
      return "joined via your starterpack";
    default:
      return "interacted with your post";
  }
}

interface NotificationItemProps {
  notification: Notification;
  postMap: Map<string, any>;
  getNotificationIcon: (reason: string) => React.ReactNode;
  showTypeLabel?: boolean;
  isFetchingMore?: boolean;
  fetchedPosts?: number;
  totalPosts?: number;
  setSelectedPostUri: (uri: string | null) => void;
  markAsRead: () => void;
  isNew?: boolean;
}

const NotificationItem: React.FC<NotificationItemProps> = React.memo(
  ({
    notification,
    postMap,
    getNotificationIcon,
    showTypeLabel = false,
    isFetchingMore = false,
    fetchedPosts = 0,
    totalPosts = 0,
    setSelectedPostUri,
    markAsRead,
    isNew = false,
  }) => {
    const navigate = useViewTransitionNavigate();
    // Get the post for all notification types that reference posts
    // For reposts and likes, use reasonSubject which contains the original post URI
    const postUri =
      (notification.reason === "repost" || notification.reason === "like") &&
      notification.reasonSubject
        ? notification.reasonSubject
        : notification.uri;

    const post = ["like", "repost", "reply", "quote"].includes(
      notification.reason,
    )
      ? postMap.get(postUri)
      : undefined;
    const postAuthorHandle = post?.author?.handle;

    const notificationUrl = getNotificationUrl(notification, postAuthorHandle);

    // Get notification type label
    const getNotificationTypeLabel = (reason: string): string => {
      switch (reason) {
        case "like":
          return "Like";
        case "repost":
          return "Repost";
        case "follow":
          return "Follow";
        case "mention":
          return "Mention";
        case "reply":
          return "Reply";
        case "quote":
          return "Quote";
        case "starterpack-joined":
          return "Starterpack Join";
        default:
          return reason.charAt(0).toUpperCase() + reason.slice(1);
      }
    };

    // Helper to render post content box
    const renderPostContent = () => {
      // For likes, reposts, replies, and quotes - show loading state if post not yet loaded
      if (["like", "repost", "reply", "quote"].includes(notification.reason)) {
        if (!post) {
          // Don't show loading indicator for individual posts during progressive loading
          // Only show "unable to load" if we've finished fetching and still don't have the post
          if (!isFetchingMore || fetchedPosts >= totalPosts) {
            // Post couldn't be loaded or doesn't exist
            return (
              <div
                className="mt-3 rounded-lg p-4"
                style={{
                  backgroundColor: "var(--asph-bg-secondary)",
                  border: "1px solid var(--asph-border-primary)",
                  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
                }}
              >
                <p
                  className="text-sm italic"
                  style={{ color: "var(--asph-text-tertiary)" }}
                >
                  Post unavailable
                </p>
              </div>
            );
          }
          // Return null during progressive loading to avoid flicker
          return null;
        }
      }

      // For likes, reposts, replies, and quotes - show the referenced post
      if (
        ["like", "repost", "reply", "quote"].includes(notification.reason) &&
        post
      ) {
        const hasImages =
          post.embed?.$type === "app.bsky.embed.images#view" ||
          (post.embed?.$type === "app.bsky.embed.recordWithMedia#view" &&
            post.embed.media?.$type === "app.bsky.embed.images#view");
        const hasVideo =
          post.embed?.$type === "app.bsky.embed.video#view" ||
          (post.embed?.$type === "app.bsky.embed.recordWithMedia#view" &&
            post.embed.media?.$type === "app.bsky.embed.video#view");
        const hasExternal =
          post.embed?.$type === "app.bsky.embed.external#view" ||
          (post.embed?.$type === "app.bsky.embed.recordWithMedia#view" &&
            post.embed.media?.$type === "app.bsky.embed.external#view");
        const hasMedia = hasImages || hasVideo || hasExternal;

        return (
          <div className="mt-2 rounded-md border border-asph-border-primary bg-asph-bg-secondary p-2.5">
            <div className="mb-1 flex items-center gap-1.5">
              <span className="text-xs font-medium text-asph-text-tertiary">
                {notification.reason === "reply"
                  ? "Replying to your post:"
                  : notification.reason === "quote"
                    ? "Quoting your post:"
                    : "Your post:"}
              </span>
              {post.author?.handle && (
                <ProfileHoverCard handle={post.author.handle}>
                  <Link
                    to={`/profile/${post.author.handle}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {post.author?.avatar ? (
                      <img
                        src={proxifyBskyImage(post.author.avatar)}
                        alt={post.author.handle}
                        className="asph-avatar h-5 w-5 transition-opacity hover:opacity-80"
                      />
                    ) : (
                      <div
                        className="asph-avatar flex h-5 w-5 items-center justify-center text-xs transition-opacity hover:opacity-80"
                        style={{ background: "var(--asph-bg-tertiary)" }}
                      >
                        {post.author?.handle?.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </Link>
                </ProfileHoverCard>
              )}
              {post.author?.handle ? (
                <ProfileHoverCard handle={post.author.handle}>
                  <Link
                    to={`/profile/${post.author.handle}`}
                    className="inline-flex items-center text-xs font-medium no-underline hover:underline"
                    style={{ color: "var(--asph-text-secondary)" }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span>
                      {post.author?.displayName ||
                        post.author?.handle ||
                        "Unknown"}
                    </span>
                    <DomainVerifiedBadgeInline handle={post.author.handle} />
                  </Link>
                </ProfileHoverCard>
              ) : (
                <span className="inline-flex items-center text-xs font-medium text-asph-text-secondary">
                  <span>
                    {post.author?.displayName ||
                      post.author?.handle ||
                      "Unknown"}
                  </span>
                </span>
              )}
              {hasMedia && (
                <span
                  className="flex items-center gap-1 text-xs"
                  style={{ color: "var(--asph-text-tertiary)" }}
                >
                  · {hasVideo ? "🎬" : hasExternal ? "🔗" : "📷"}
                </span>
              )}
            </div>

            {post.record?.text && (
              <p className="text-sm leading-relaxed text-asph-text-primary">
                {post.record.text}
              </p>
            )}

            {/* Display media if present */}
            {(() => {
              if (!post.embed) return null;

              const embed = post.embed as any;

              // Handle video embeds
              if (embed.$type === "app.bsky.embed.video#view") {
                return (
                  <div className="mt-2">
                    <div
                      className="relative overflow-hidden rounded-lg border bg-gray-100 dark:bg-gray-800"
                      style={{
                        borderColor: "var(--asph-border-primary)",
                        aspectRatio: "16/9",
                        maxHeight: "200px",
                      }}
                    >
                      {embed.thumbnail ? (
                        <img
                          src={proxifyBskyImage(embed.thumbnail)}
                          alt="Video thumbnail"
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <span style={{ color: "var(--asph-text-tertiary)" }}>
                            Video
                          </span>
                        </div>
                      )}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div
                          className="flex h-12 w-12 items-center justify-center rounded-full"
                          style={{
                            backgroundColor: "rgba(0, 0, 0, 0.6)",
                          }}
                        >
                          <svg
                            className="h-6 w-6 text-white"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              // Handle video in recordWithMedia
              if (
                embed.$type === "app.bsky.embed.recordWithMedia#view" &&
                embed.media?.$type === "app.bsky.embed.video#view"
              ) {
                const video = embed.media;
                return (
                  <div className="mt-2">
                    <div
                      className="relative overflow-hidden rounded-lg border bg-gray-100 dark:bg-gray-800"
                      style={{
                        borderColor: "var(--asph-border-primary)",
                        aspectRatio: "16/9",
                        maxHeight: "200px",
                      }}
                    >
                      {video.thumbnail ? (
                        <img
                          src={proxifyBskyImage(video.thumbnail)}
                          alt="Video thumbnail"
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <span style={{ color: "var(--asph-text-tertiary)" }}>
                            Video
                          </span>
                        </div>
                      )}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div
                          className="flex h-12 w-12 items-center justify-center rounded-full"
                          style={{
                            backgroundColor: "rgba(0, 0, 0, 0.6)",
                          }}
                        >
                          <svg
                            className="h-6 w-6 text-white"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              // Handle external embeds (link cards, GIFs)
              if (embed.$type === "app.bsky.embed.external#view") {
                const external = embed.external;
                if (external?.thumb || external?.uri) {
                  // Check if it's a GIF - use the actual URI for animation
                  const isGif =
                    external.uri?.toLowerCase().includes(".gif") ||
                    external.uri?.includes("tenor.com") ||
                    external.uri?.includes("giphy.com");
                  const imageSrc = isGif
                    ? external.uri
                    : proxifyBskyImage(external.thumb);

                  return (
                    <div className="mt-2">
                      <div
                        className="overflow-hidden rounded-lg border bg-gray-100 dark:bg-gray-800"
                        style={{
                          borderColor: "var(--asph-border-primary)",
                        }}
                      >
                        <img
                          src={imageSrc}
                          alt={external.title || "Link preview"}
                          className="w-full object-contain"
                          style={{ maxHeight: "250px" }}
                          loading="lazy"
                        />
                        {external.title && !isGif && (
                          <div
                            className="p-2 text-xs"
                            style={{ color: "var(--asph-text-secondary)" }}
                          >
                            {external.title}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }
              }

              // Handle external in recordWithMedia
              if (
                embed.$type === "app.bsky.embed.recordWithMedia#view" &&
                embed.media?.$type === "app.bsky.embed.external#view"
              ) {
                const external = embed.media.external;
                if (external?.thumb || external?.uri) {
                  // Check if it's a GIF - use the actual URI for animation
                  const isGif =
                    external.uri?.toLowerCase().includes(".gif") ||
                    external.uri?.includes("tenor.com") ||
                    external.uri?.includes("giphy.com");
                  const imageSrc = isGif
                    ? external.uri
                    : proxifyBskyImage(external.thumb);
                  return (
                    <div className="mt-2">
                      <div
                        className="overflow-hidden rounded-lg border bg-gray-100 dark:bg-gray-800"
                        style={{
                          borderColor: "var(--asph-border-primary)",
                        }}
                      >
                        <img
                          src={imageSrc}
                          alt={external.title || "Link preview"}
                          className="w-full object-contain"
                          style={{ maxHeight: "250px" }}
                          loading="lazy"
                        />
                        {external.title && !isGif && (
                          <div
                            className="p-2 text-xs"
                            style={{ color: "var(--asph-text-secondary)" }}
                          >
                            {external.title}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }
              }

              let images: Array<{
                thumb: string;
                fullsize: string;
                alt?: string;
              }> = [];

              // Extract images from different embed types
              if (
                embed.$type === "app.bsky.embed.images#view" &&
                embed.images
              ) {
                images = embed.images;
              } else if (
                embed.$type === "app.bsky.embed.recordWithMedia#view" &&
                embed.media?.$type === "app.bsky.embed.images#view" &&
                embed.media.images
              ) {
                images = embed.media.images;
              }

              if (images.length === 0) return null;

              return (
                <div className="mt-2">
                  <div
                    className={`grid gap-2 ${images.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}
                  >
                    {images.slice(0, 4).map((img: any, idx) => {
                      const imgAspectRatio = img.aspectRatio
                        ? img.aspectRatio.width / img.aspectRatio.height
                        : images.length === 1
                          ? 16 / 9
                          : 1;
                      return (
                        <div
                          key={`notif-feed-img-${img.thumb}-${idx}`}
                          className="relative overflow-hidden rounded-lg border bg-gray-100 dark:bg-gray-800"
                          style={{
                            borderColor: "var(--asph-border-primary)",
                            aspectRatio: imgAspectRatio,
                            maxHeight: images.length === 1 ? "200px" : "120px",
                          }}
                        >
                          <img
                            src={proxifyBskyImage(img.thumb)}
                            alt={img.alt || ""}
                            className="h-full w-full object-contain"
                            loading="lazy"
                            width={img.aspectRatio?.width}
                            height={img.aspectRatio?.height}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        );
      }

      // For mentions - show the post where you were mentioned
      if (
        notification.reason === "mention" &&
        notification.record &&
        typeof notification.record === "object" &&
        "text" in notification.record
      ) {
        return (
          <div className="mt-2 rounded-md border border-asph-border-primary bg-asph-bg-secondary p-2.5">
            <p className="text-sm leading-relaxed text-asph-text-primary">
              {(notification.record as { text?: string }).text}
            </p>
          </div>
        );
      }

      // For follows - no post to show
      if (notification.reason === "follow") {
        return null;
      }

      // Fallback for any other notification types with record text
      if (
        notification.record &&
        typeof notification.record === "object" &&
        "text" in notification.record
      ) {
        return (
          <div className="mt-2 rounded-md border border-asph-border-primary bg-asph-bg-secondary p-2.5">
            <p
              className="text-sm"
              style={{ color: "var(--asph-text-primary)", lineHeight: "1.5" }}
            >
              {(notification.record as { text?: string }).text}
            </p>
          </div>
        );
      }

      return null;
    };

    const handleNotificationClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      // Let browser handle modified clicks natively (open in new tab)
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0)
        return;
      e.preventDefault();

      // Mark notification as read when clicked
      if (!notification.isRead) {
        markAsRead();
      }

      // For likes, reposts, replies, mentions, and quotes - open thread modal
      if (
        ["like", "repost", "reply", "mention", "quote"].includes(
          notification.reason,
        )
      ) {
        // Use the postUri we calculated above which handles reasonSubject correctly
        setSelectedPostUri(postUri);
      } else if (notification.reason === "follow") {
        // For follows, navigate to the follower's profile
        navigate(`/profile/${notification.author.handle}`);
      } else {
        // Fallback - navigate if we have a URL
        if (notificationUrl.startsWith("/")) {
          navigate(notificationUrl);
        } else {
          window.open(notificationUrl, "_blank");
        }
      }
    };

    const authorProfileUrl = `/profile/${notification.author.handle}`;

    return (
      <Link
        to={notificationUrl}
        className={`asph-notification block cursor-pointer px-3 py-2 no-underline ${
          !notification.isRead ? "asph-notification-unread" : ""
        } ${isNew ? "asph-notification-new" : ""}`}
        style={{ color: "inherit" }}
        onClickCapture={(e: React.MouseEvent) => {
          const target = e.target as HTMLElement;
          if (target.closest('button, [role="button"]')) {
            e.preventDefault();
          }
        }}
        onClick={handleNotificationClick}
      >
        <div className="flex items-start gap-2">
          {/* Icon and Avatar section */}
          <div className="flex flex-shrink-0 items-center gap-2">
            <div className="w-5">
              {getNotificationIcon(notification.reason)}
            </div>
            <ProfileHoverCard handle={notification.author.handle}>
              <Link to={authorProfileUrl} onClick={(e) => e.stopPropagation()}>
                {notification.author.avatar ? (
                  <img
                    src={proxifyBskyImage(notification.author.avatar)}
                    alt={notification.author.handle}
                    className="asph-avatar h-10 w-10 transition-opacity hover:opacity-80"
                  />
                ) : (
                  <div
                    className="asph-avatar flex h-10 w-10 items-center justify-center transition-opacity hover:opacity-80"
                    style={{ background: "var(--asph-bg-tertiary)" }}
                  >
                    <span className="text-sm font-semibold">
                      {notification.author?.handle?.charAt(0).toUpperCase() ||
                        "U"}
                    </span>
                  </div>
                )}
              </Link>
            </ProfileHoverCard>
          </div>

          {/* User info and timestamp */}
          <div className="min-w-0 flex-1">
            {showTypeLabel && (
              <div className="mb-0.5 flex items-center gap-2">
                <span
                  className="rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{
                    backgroundColor: "var(--asph-bg-secondary)",
                    color: "var(--asph-text-secondary)",
                    border: "1px solid var(--asph-border-primary)",
                  }}
                >
                  {getNotificationTypeLabel(notification.reason)}
                </span>
              </div>
            )}
            <p className="text-sm">
              <ProfileHoverCard handle={notification.author.handle}>
                <Link
                  to={authorProfileUrl}
                  className="inline-flex items-center no-underline hover:underline"
                  style={{ color: "var(--asph-text-primary)" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="font-semibold">
                    {notification.author.displayName ||
                      notification.author.handle}
                  </span>
                  <DomainVerifiedBadgeInline
                    handle={notification.author.handle}
                  />
                </Link>
              </ProfileHoverCard>{" "}
              <span style={{ color: "var(--asph-text-secondary)" }}>
                {getNotificationText(notification.reason)}
              </span>
              <span
                className="ml-1 text-xs"
                style={{ color: "var(--asph-text-tertiary)" }}
              >
                ·{" "}
                {formatDistanceToNow(new Date(notification.indexedAt), {
                  addSuffix: true,
                })}
              </span>
            </p>
          </div>
        </div>

        {/* Show the referenced post content below, with left margin to align with profile picture */}
        {(() => {
          const postContent = renderPostContent();
          return postContent ? (
            <div className="ml-[1.75rem] mt-2">{postContent}</div>
          ) : null;
        })()}
      </Link>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison for performance
    // Only re-render if notification data changes or post data is loaded/updated
    return (
      prevProps.notification.uri === nextProps.notification.uri &&
      prevProps.notification.isRead === nextProps.notification.isRead &&
      prevProps.notification.indexedAt === nextProps.notification.indexedAt &&
      prevProps.showTypeLabel === nextProps.showTypeLabel &&
      prevProps.isFetchingMore === nextProps.isFetchingMore &&
      prevProps.isNew === nextProps.isNew &&
      // Check if post in map has changed (for this notification's post)
      prevProps.postMap.get(
        (prevProps.notification.reason === "repost" ||
          prevProps.notification.reason === "like") &&
          prevProps.notification.reasonSubject
          ? prevProps.notification.reasonSubject
          : prevProps.notification.uri,
      ) ===
        nextProps.postMap.get(
          (nextProps.notification.reason === "repost" ||
            nextProps.notification.reason === "like") &&
            nextProps.notification.reasonSubject
            ? nextProps.notification.reasonSubject
            : nextProps.notification.uri,
        )
    );
  },
);

NotificationItem.displayName = "NotificationItem";
