import type { Notification } from "@atproto/api/dist/client/types/app/bsky/notification/listNotifications";
import { debug } from "@bsky/shared";
import { formatDistanceToNow } from "date-fns";
import {
  AtSign,
  ChevronUp,
  Crown,
  Filter,
  Heart,
  Image,
  Loader,
  MessageCircle,
  MoreVertical,
  Quote,
  Repeat2,
  UserPlus,
  Users,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  useFeatureTracking,
  useNotificationTracking,
} from "../hooks/useAnalytics";
import { useFollowing } from "../hooks/useFollowing";
import {
  postHasImages,
  useNotificationPosts,
} from "../hooks/useNotificationPosts";
import {
  useMarkNotificationsRead,
  useNotifications,
  useUnreadCount,
} from "../hooks/useNotifications";
import { proxifyBskyImage } from "../utils/image-proxy";
import { getNotificationUrl } from "../utils/url-helpers";
import {
  AggregatedNotificationItem,
  aggregateNotifications,
} from "./NotificationAggregator";
import { ThreadModal } from "./ThreadModal";
import { TopAccountsView } from "./TopAccountsView";

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

export const NotificationsFeed: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const showTopAccounts = searchParams.get("top") === "1";

  const [filter, setFilter] = useState<NotificationFilter>("all");
  // Removed unread only filter
  // const [showUnreadOnly, setShowUnreadOnly] = useState(false)
  const [expandedAggregations, setExpandedAggregations] = useState<Set<string>>(
    new Set(),
  );
  const [minFollowerCount, setMinFollowerCount] = useState(10000);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [selectedPostUri, setSelectedPostUri] = useState<string | null>(null);
  // Removed isFromCache state - no longer needed without header
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const moreFiltersRef = useRef<HTMLDivElement>(null);

  // Analytics hooks
  const { trackNotificationView } = useNotificationTracking();
  const { trackFeatureAction } = useFeatureTracking("notifications_feed");

  // Wrap setFilter to track analytics
  const handleFilterChange = (newFilter: NotificationFilter) => {
    setFilter(newFilter);
    trackFeatureAction("filter_changed", { filter: newFilter });
  };

  // Reset filter if top accounts is hidden but was selected
  useEffect(() => {
    if (!showTopAccounts && filter === "top-accounts") {
      setFilter("all");
    }
  }, [showTopAccounts, filter]);

  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useNotifications();
  const { data: unreadCount } = useUnreadCount();
  const { mutate: markAsRead } = useMarkNotificationsRead();
  const { data: followingSet, isLoading: isLoadingFollowing } = useFollowing();

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
  }, []); // Only run once on mount

  const notifications = React.useMemo(() => {
    const timestamp = new Date().toLocaleTimeString();
    if (!data?.pages) {
      debug.log(`📊 [${timestamp}] NotificationsFeed: No data pages available`);
      return [];
    }
    const allNotifications = data.pages.flatMap(
      (page: any) => page.notifications,
    );
    debug.log(
      `📊 [${timestamp}] NotificationsFeed: Computed ${allNotifications.length} notifications from ${data.pages.length} pages`,
    );
    return allNotifications;
  }, [data]);

  // Debug effect to track data changes
  useEffect(() => {
    const timestamp = new Date().toLocaleTimeString();
    debug.log(`🔍 [${timestamp}] NotificationsFeed render state:`, {
      isLoading,
      hasData: !!data,
      pagesCount: data?.pages?.length || 0,
      notificationsCount: notifications.length,
      error: error ? error.message : null,
    });

    // Track notification view when data loads
    if (!isLoading && notifications.length > 0) {
      trackNotificationView(
        filter === "all" ? "all" : filter,
        notifications.length,
      );
    }
  }, [
    isLoading,
    data,
    notifications.length,
    error,
    filter,
    trackNotificationView,
  ]);

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
    percentageFetched,
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

    observer.observe(loadMoreRef.current);

    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Removed automatic loading of 3 pages - let intersection observer handle it
  // This was causing the UI to flicker as it loaded 3 times automatically

  const filteredNotifications = React.useMemo(() => {
    if (!notifications) return [];

    let filtered = notifications;

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
  }, [notifications, filter, posts, followingSet]);

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
  }, [notifications, posts, followingSet]);

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
          <Heart
            size={18}
            style={{ color: "var(--bsky-like)" }}
            fill="currentColor"
          />
        );
      case "repost":
        return <Repeat2 size={18} style={{ color: "var(--bsky-repost)" }} />;
      case "follow":
        return <UserPlus size={18} style={{ color: "var(--bsky-follow)" }} />;
      case "mention":
        return <AtSign size={18} style={{ color: "var(--bsky-mention)" }} />;
      case "reply":
        return (
          <MessageCircle size={18} style={{ color: "var(--bsky-reply)" }} />
        );
      case "quote":
        return <Quote size={18} style={{ color: "var(--bsky-quote)" }} />;
      default:
        return null;
    }
  }, []);

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bsky-card bsky-loading h-20 p-4"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div
          className="bsky-card p-4"
          style={{
            borderColor: "var(--bsky-error)",
            backgroundColor: "rgba(239, 68, 68, 0.1)",
          }}
        >
          <p style={{ color: "var(--bsky-error)" }}>
            Failed to load notifications
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bsky-font">
      {/* Filter tabs */}
      <div className="bsky-glass sticky top-0 z-10 border-b border-bsky-border-primary">
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
                  icon={<Heart size={16} />}
                  label="Likes"
                  count={filterCounts["likes"]}
                />
                <FilterTab
                  active={filter === "reposts"}
                  onClick={() => handleFilterChange("reposts")}
                  icon={<Repeat2 size={16} />}
                  label="Reposts"
                  count={filterCounts["reposts"]}
                />
                <FilterTab
                  active={filter === "mentions"}
                  onClick={() => handleFilterChange("mentions")}
                  icon={<AtSign size={16} />}
                  label="Mentions"
                  count={filterCounts["mentions"]}
                />
                {/* Mobile-only additional tabs */}
                <div className="flex gap-1 md:hidden">
                  <FilterTab
                    active={filter === "replies"}
                    onClick={() => handleFilterChange("replies")}
                    icon={<MessageCircle size={16} />}
                    label="Replies"
                    count={filterCounts["replies"]}
                  />
                  <FilterTab
                    active={filter === "follows"}
                    onClick={() => handleFilterChange("follows")}
                    icon={<UserPlus size={16} />}
                    label="Follows"
                    count={filterCounts["follows"]}
                  />
                </div>

                {/* Desktop-only tabs */}
                <div className="hidden gap-1 md:flex">
                  <FilterTab
                    active={filter === "follows"}
                    onClick={() => handleFilterChange("follows")}
                    icon={<UserPlus size={16} />}
                    label="Follows"
                    count={filterCounts["follows"]}
                  />
                  <FilterTab
                    active={filter === "replies"}
                    onClick={() => handleFilterChange("replies")}
                    icon={<MessageCircle size={16} />}
                    label="Replies"
                    count={filterCounts["replies"]}
                  />
                  <FilterTab
                    active={filter === "quotes"}
                    onClick={() => handleFilterChange("quotes")}
                    icon={<Quote size={16} />}
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
              <div className="relative md:hidden" ref={moreFiltersRef}>
                <button
                  onClick={() => setShowMoreFilters(!showMoreFilters)}
                  className={`flex items-center rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200 ${
                    showMoreFilters
                      ? "bg-bsky-primary text-white"
                      : "text-bsky-text-secondary hover:bg-bsky-bg-secondary hover:text-bsky-text-primary"
                  }`}
                  aria-label="More filters"
                >
                  <MoreVertical size={16} />
                </button>

                {showMoreFilters && (
                  <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-lg border border-bsky-border-primary bg-bsky-bg-secondary p-1 shadow-md">
                    <button
                      onClick={() => {
                        handleFilterChange("quotes");
                        setShowMoreFilters(false);
                      }}
                      className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-bsky-bg-hover ${
                        filter === "quotes" ? "text-blue-500" : ""
                      }`}
                    >
                      <Quote size={16} />
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
                      className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-bsky-bg-hover ${
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
                      className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-bsky-bg-hover ${
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
                        className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-bsky-bg-hover ${
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
                  </div>
                )}
              </div>
            </div>

            {/* Mark all as read button */}
            {unreadCount && unreadCount > 0 && (
              <button
                onClick={() => markAsRead()}
                className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium text-bsky-primary transition-all hover:bg-bsky-bg-secondary"
                title="Mark all notifications as read"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="flex-shrink-0"
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

      {/* Post loading progress indicator - only show if we're actually fetching from API */}
      {isFetchingMore &&
        percentageFetched < 100 &&
        fetchedPosts < totalPosts && (
          <div
            className="border-b"
            style={{
              borderColor: "var(--bsky-border-secondary)",
              backgroundColor: "var(--bsky-bg-secondary)",
              fontSize: "0.875rem",
              color: "var(--bsky-text-secondary)",
            }}
          >
            <div className="px-3 py-2 sm:px-6">
              <div className="flex items-center justify-between">
                <span>Loading post content...</span>
                <span>
                  {percentageFetched}% ({fetchedPosts}/{totalPosts} posts)
                </span>
              </div>
              <div
                className="mt-1 h-1 overflow-hidden rounded-full bg-gray-200"
                style={{ backgroundColor: "var(--bsky-border-primary)" }}
              >
                <div
                  className="h-full transition-all duration-300 ease-out"
                  style={{
                    width: `${percentageFetched}%`,
                    backgroundColor: "var(--bsky-primary)",
                  }}
                />
              </div>
            </div>
          </div>
        )}

      {/* Notifications list */}
      <div className="px-3 sm:px-6">
        {filter === "top-accounts" ? (
          <TopAccountsView
            notifications={notifications}
            minFollowerCount={minFollowerCount}
            onConfigClick={() => setShowConfigModal(true)}
          />
        ) : filteredNotifications.length === 0 ? (
          <div
            className="p-6 text-center sm:p-12"
            style={{ color: "var(--bsky-text-tertiary)" }}
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
                      percentageFetched={percentageFetched}
                      markAsRead={markAsRead}
                      onNavigate={(url) => {
                        // Check if this is a thread URL
                        if (url.startsWith("/thread/")) {
                          // Extract the post URI from the URL path
                          // URL format: /thread/handle/postId
                          // For thread URLs, we need to use the correct URI based on notification type
                          const firstNotification = item.notifications[0];
                          const postUri =
                            (item.reason === "repost" ||
                              item.reason === "like") &&
                            firstNotification.reasonSubject
                              ? firstNotification.reasonSubject
                              : firstNotification.uri;
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
                          borderColor: "var(--bsky-border-secondary)",
                          marginLeft: "3rem",
                        }}
                      >
                        {item.notifications.map((notification) => (
                          <NotificationItem
                            key={`${notification.uri}-${notification.indexedAt}`}
                            notification={notification}
                            postMap={postMap}
                            getNotificationIcon={getNotificationIcon}
                            showTypeLabel={filter === "all"}
                            isFetchingMore={isFetchingMore}
                            fetchedPosts={fetchedPosts}
                            totalPosts={totalPosts}
                            percentageFetched={percentageFetched}
                            setSelectedPostUri={setSelectedPostUri}
                            markAsRead={markAsRead}
                          />
                        ))}
                        <button
                          onClick={() => {
                            const newExpanded = new Set(expandedAggregations);
                            newExpanded.delete(aggregationKey);
                            setExpandedAggregations(newExpanded);
                          }}
                          className="flex w-full items-center gap-1 rounded-md px-3 py-2 text-left text-xs hover:bg-bsky-bg-hover"
                          style={{
                            color: "var(--bsky-text-secondary)",
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
                return (
                  <NotificationItem
                    key={`${item.notification.uri}-${item.notification.indexedAt}`}
                    notification={item.notification}
                    postMap={postMap}
                    getNotificationIcon={getNotificationIcon}
                    showTypeLabel={filter === "all"}
                    isFetchingMore={isFetchingMore}
                    fetchedPosts={fetchedPosts}
                    totalPosts={totalPosts}
                    percentageFetched={percentageFetched}
                    setSelectedPostUri={setSelectedPostUri}
                    markAsRead={markAsRead}
                  />
                );
              }
            });
          })()
        ) : (
          // Show regular notifications for mentions, replies, and images tabs (no aggregation)
          filteredNotifications.map((notification: Notification) => (
            <NotificationItem
              key={`${notification.uri}-${notification.indexedAt}`}
              notification={notification}
              postMap={postMap}
              getNotificationIcon={getNotificationIcon}
              showTypeLabel={filter === "all"}
              isFetchingMore={isFetchingMore}
              fetchedPosts={fetchedPosts}
              totalPosts={totalPosts}
              percentageFetched={percentageFetched}
              setSelectedPostUri={setSelectedPostUri}
              markAsRead={markAsRead}
            />
          ))
        )}

        {/* Loading more indicator */}
        {(hasNextPage || isFetchingNextPage) && (
          <div ref={loadMoreRef} className="flex justify-center p-8">
            {isFetchingNextPage ? (
              <div
                className="flex items-center gap-2"
                style={{ color: "var(--bsky-text-secondary)" }}
              >
                <Loader
                  className="animate-spin"
                  size={20}
                  style={{ color: "var(--bsky-primary)" }}
                />
                <span className="text-sm">Loading more...</span>
              </div>
            ) : (
              <div
                className="text-sm"
                style={{ color: "var(--bsky-text-tertiary)" }}
              >
                <div className="animate-pulse">↓ Scroll for more</div>
              </div>
            )}
          </div>
        )}

        {/* End of notifications message */}
        {!hasNextPage && notifications.length > 0 && (
          <div className="p-8 text-center">
            <div className="bsky-badge mb-2">
              {notifications.length >= 1000
                ? `1,000 notifications max`
                : `End of notifications`}
            </div>
            <p
              className="text-xs"
              style={{ color: "var(--bsky-text-tertiary)" }}
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
            <div className="bsky-card w-full max-w-md p-6">
              <h3
                className="mb-4 text-lg font-semibold"
                style={{ color: "var(--bsky-text-primary)" }}
              >
                Top Accounts Settings
              </h3>

              <div className="mb-4">
                <label
                  className="mb-2 block text-sm"
                  style={{ color: "var(--bsky-text-secondary)" }}
                >
                  Minimum Follower Count
                </label>
                <input
                  type="number"
                  value={minFollowerCount}
                  onChange={(e) => setMinFollowerCount(Number(e.target.value))}
                  className="bsky-input w-full rounded px-3 py-2"
                  style={{
                    backgroundColor: "var(--bsky-bg-secondary)",
                    border: "1px solid var(--bsky-border-primary)",
                    color: "var(--bsky-text-primary)",
                  }}
                  min="0"
                  step="1000"
                />
                <p
                  className="mt-1 text-xs"
                  style={{ color: "var(--bsky-text-tertiary)" }}
                >
                  Show accounts with at least this many followers
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowConfigModal(false)}
                  className="bsky-button-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setShowConfigModal(false)}
                  className="bsky-button-primary"
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

interface FilterTabProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
  count?: number;
}

const FilterTab: React.FC<FilterTabProps> = ({
  active,
  onClick,
  icon,
  label,
  disabled,
  count,
}) => {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-0.5 whitespace-nowrap rounded-md px-1.5 py-1 text-xs font-medium transition-all duration-200 sm:gap-1 sm:px-2 sm:py-1.5 sm:text-sm md:px-2.5 ${
        active
          ? "bg-bsky-primary text-white"
          : "text-bsky-text-secondary hover:bg-bsky-bg-secondary hover:text-bsky-text-primary"
      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
      title={`${label}${count !== undefined && count > 0 ? ` (${count})` : ""}`}
      disabled={disabled}
    >
      <span className="flex-shrink-0">{icon}</span>
      <span className="hidden sm:inline">{label}</span>
      {count !== undefined && count > 0 && (
        <span
          className={`text-[10px] font-bold sm:text-xs ${
            active ? "text-white/90" : "text-bsky-text-tertiary"
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
};

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
  percentageFetched?: number;
  setSelectedPostUri: (uri: string | null) => void;
  markAsRead: () => void;
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
    percentageFetched = 100,
    setSelectedPostUri,
    markAsRead,
  }) => {
    const navigate = useNavigate();
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
        default:
          return reason.charAt(0).toUpperCase() + reason.slice(1);
      }
    };

    // Helper to render post content box
    const renderPostContent = () => {
      // For likes, reposts, replies, and quotes - show loading state if post not yet loaded
      if (["like", "repost", "reply", "quote"].includes(notification.reason)) {
        // Show loading indicator if post should exist but isn't loaded yet
        if (!post && postMap.size === 0) {
          return (
            <div
              className="mt-3 rounded-lg p-4"
              style={{
                backgroundColor: "var(--bsky-bg-secondary)",
                border: "1px solid var(--bsky-border-primary)",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
              }}
            >
              <div className="flex items-center gap-2">
                <Loader
                  className="animate-spin"
                  size={16}
                  style={{ color: "var(--bsky-primary)" }}
                />
                <span
                  className="text-sm"
                  style={{ color: "var(--bsky-text-secondary)" }}
                >
                  Loading post content...
                </span>
              </div>
            </div>
          );
        }

        if (!post) {
          // Check if we're still fetching more posts
          if (isFetchingMore && fetchedPosts < totalPosts) {
            return (
              <div
                className="mt-3 rounded-lg p-4"
                style={{
                  backgroundColor: "var(--bsky-bg-secondary)",
                  border: "1px solid var(--bsky-border-primary)",
                  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
                }}
              >
                <div className="flex items-center gap-2">
                  <Loader
                    className="animate-spin"
                    size={16}
                    style={{ color: "var(--bsky-primary)" }}
                  />
                  <span
                    className="text-sm"
                    style={{ color: "var(--bsky-text-secondary)" }}
                  >
                    Loading post content... ({percentageFetched}% loaded)
                  </span>
                </div>
              </div>
            );
          }

          // Post couldn't be loaded or doesn't exist
          return (
            <div
              className="mt-3 rounded-lg p-4"
              style={{
                backgroundColor: "var(--bsky-bg-secondary)",
                border: "1px solid var(--bsky-border-primary)",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
              }}
            >
              <p
                className="text-sm italic"
                style={{ color: "var(--bsky-text-tertiary)" }}
              >
                [Unable to load post content]
              </p>
            </div>
          );
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

        return (
          <div className="mt-2 rounded-md border border-bsky-border-primary bg-bsky-bg-secondary p-2.5">
            <div className="mb-1 flex items-center gap-1.5">
              <span className="text-xs font-medium text-bsky-text-tertiary">
                {notification.reason === "reply"
                  ? "Replying to your post:"
                  : notification.reason === "quote"
                    ? "Quoting your post:"
                    : "Your post:"}
              </span>
              {post.author?.avatar ? (
                <img
                  src={proxifyBskyImage(post.author.avatar)}
                  alt={post.author.handle}
                  className="bsky-avatar h-5 w-5 cursor-pointer transition-opacity hover:opacity-80"
                  onClick={handleAuthorClick}
                />
              ) : (
                <div
                  className="bsky-avatar flex h-5 w-5 cursor-pointer items-center justify-center text-xs transition-opacity hover:opacity-80"
                  style={{ background: "var(--bsky-bg-tertiary)" }}
                  onClick={handleAuthorClick}
                >
                  {post.author?.handle?.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="text-xs font-medium text-bsky-text-secondary">
                {post.author?.displayName || post.author?.handle || "Unknown"}
              </span>
              {hasImages && (
                <span
                  className="flex items-center gap-1 text-xs"
                  style={{ color: "var(--bsky-text-tertiary)" }}
                >
                  · 📷
                </span>
              )}
            </div>

            {post.record?.text ? (
              <p className="text-sm leading-relaxed text-bsky-text-primary">
                {post.record.text}
              </p>
            ) : (
              <p
                className="text-sm italic"
                style={{ color: "var(--bsky-text-tertiary)" }}
              >
                [Post with no text]
              </p>
            )}

            {/* Display images if present */}
            {(() => {
              if (!post.embed) return null;

              let images: Array<{
                thumb: string;
                fullsize: string;
                alt?: string;
              }> = [];

              // Extract images from different embed types
              if (
                post.embed.$type === "app.bsky.embed.images#view" &&
                post.embed.images
              ) {
                images = post.embed.images;
              } else if (
                post.embed.$type === "app.bsky.embed.recordWithMedia#view" &&
                post.embed.media?.$type === "app.bsky.embed.images#view" &&
                post.embed.media.images
              ) {
                images = post.embed.media.images;
              }

              if (images.length === 0) return null;

              return (
                <div className="mt-3">
                  <div
                    className={`grid gap-2 ${images.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}
                  >
                    {images.slice(0, 4).map((img, idx) => (
                      <img
                        key={idx}
                        src={proxifyBskyImage(img.thumb)}
                        alt={img.alt || ""}
                        className="w-full rounded-lg border object-cover"
                        style={{
                          borderColor: "var(--bsky-border-primary)",
                          height: images.length === 1 ? "200px" : "120px",
                        }}
                        loading="lazy"
                      />
                    ))}
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
          <div className="mt-2 rounded-md border border-bsky-border-primary bg-bsky-bg-secondary p-2.5">
            <p className="text-sm leading-relaxed text-bsky-text-primary">
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
          <div className="mt-2 rounded-md border border-bsky-border-primary bg-bsky-bg-secondary p-2.5">
            <p
              className="text-sm"
              style={{ color: "var(--bsky-text-primary)", lineHeight: "1.5" }}
            >
              {(notification.record as { text?: string }).text}
            </p>
          </div>
        );
      }

      return null;
    };

    const handleNotificationClick = (e: React.MouseEvent) => {
      // Prevent default behavior
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

    const handleAuthorClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      navigate(`/profile/${notification.author.handle}`);
    };

    return (
      <div
        className={`bsky-notification cursor-pointer px-3 py-2 ${
          !notification.isRead ? "bsky-notification-unread" : ""
        }`}
        onClick={handleNotificationClick}
      >
        <div className="flex items-start gap-2">
          {/* Icon and Avatar section */}
          <div className="flex flex-shrink-0 items-center gap-2">
            <div className="w-5">
              {getNotificationIcon(notification.reason)}
            </div>
            {notification.author.avatar ? (
              <img
                src={proxifyBskyImage(notification.author.avatar)}
                alt={notification.author.handle}
                className="bsky-avatar h-10 w-10 cursor-pointer transition-opacity hover:opacity-80"
                onClick={handleAuthorClick}
              />
            ) : (
              <div
                className="bsky-avatar flex h-10 w-10 cursor-pointer items-center justify-center transition-opacity hover:opacity-80"
                style={{ background: "var(--bsky-bg-tertiary)" }}
                onClick={handleAuthorClick}
              >
                <span className="text-sm font-semibold">
                  {notification.author?.handle?.charAt(0).toUpperCase() || "U"}
                </span>
              </div>
            )}
          </div>

          {/* User info and timestamp */}
          <div className="min-w-0 flex-1">
            {showTypeLabel && (
              <div className="mb-0.5 flex items-center gap-2">
                <span
                  className="rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{
                    backgroundColor: "var(--bsky-bg-secondary)",
                    color: "var(--bsky-text-secondary)",
                    border: "1px solid var(--bsky-border-primary)",
                  }}
                >
                  {getNotificationTypeLabel(notification.reason)}
                </span>
              </div>
            )}
            <p className="text-sm">
              <span
                className="font-semibold"
                style={{ color: "var(--bsky-text-primary)" }}
              >
                {notification.author.displayName || notification.author.handle}
              </span>{" "}
              <span style={{ color: "var(--bsky-text-secondary)" }}>
                {getNotificationText(notification.reason)}
              </span>
              <span
                className="ml-1 text-xs"
                style={{ color: "var(--bsky-text-tertiary)" }}
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
        {renderPostContent() && (
          <div className="ml-[1.75rem] mt-2">{renderPostContent()}</div>
        )}
      </div>
    );
  },
);
