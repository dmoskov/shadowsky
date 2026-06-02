import type { AppBskyNotificationListNotifications } from "@atproto/api";
import { useQueryClient } from "@tanstack/react-query";
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
import { useLocation } from "react-router";
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
import { NotificationCache } from "../utils/notificationCache";
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
import { NotificationItem } from "./NotificationItem";
import {
  filterNotifications,
  type NotificationFilter,
} from "./notifications-filter";
import { ThreadModal } from "./ThreadModal";
import { TopAccountsView } from "./TopAccountsView";
import { NotificationSkeleton } from "./ui/SkeletonLoader";

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

  const filteredNotifications = React.useMemo(
    () =>
      filterNotifications(
        notifications,
        posts,
        filter,
        followingSet,
        isThreadMuted,
      ),
    [notifications, filter, posts, followingSet, isThreadMuted],
  );

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
    notifications?.forEach(
      (n: AppBskyNotificationListNotifications.Notification) => {
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
      },
    );

    // Count notifications with images
    if (posts && posts.length > 0) {
      const postsWithImages = new Set(
        posts.filter(postHasImages).map((post) => post.uri),
      );
      notifications.forEach(
        (n: AppBskyNotificationListNotifications.Notification) => {
          if (["like", "repost", "reply", "quote"].includes(n.reason)) {
            const postUri =
              (n.reason === "repost" || n.reason === "like") && n.reasonSubject
                ? n.reasonSubject
                : n.uri;
            if (postsWithImages.has(postUri)) {
              counts.images++;
            }
          }
        },
      );
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
          filteredNotifications.map(
            (
              notification: AppBskyNotificationListNotifications.Notification,
              index,
            ) => {
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
            },
          )
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
