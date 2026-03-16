import type { AppBskyFeedDefs } from "@atproto/api";
import { debug } from "@bsky/shared";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  Clock,
  Hash,
  Heart,
  List,
  type LucideIcon,
  MessageCircle,
  Repeat2,
  Reply,
  Rss,
  Shield,
  Star,
  TrendingUp,
  Users,
} from "lucide-react";
import React, { Suspense, useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useHiddenPosts } from "../contexts/HiddenPostsContext";
import { useKeyboardShortcutsContext } from "../contexts/KeyboardShortcutsContext";
import { useModeration } from "../contexts/ModerationContext";
import { useBookmarks } from "../hooks/useBookmarks";
import { useIntersectionLoader } from "../hooks/useIntersectionLoader";
import {
  useFeedCacheWarmup,
  useFeedCaching,
  useOfflineFeedStatus,
  useVisibilityRefresh,
} from "../hooks/useOfflineFeed";
import { useOptimisticPosts } from "../hooks/useOptimisticPosts";
import { usePostDeepLink } from "../hooks/usePostDeepLink";
import { useRoutePrefetch } from "../hooks/useRoutePrefetch";
import { useMinDuration } from "../hooks/useTiming";
import { useViewTransitionNavigate } from "../hooks/useViewTransitionNavigate";
import { columnService } from "../services/column-service";
import { offlineStorageDB } from "../services/offline-storage-db";
import { rateLimitedFeedFetch } from "../services/rate-limiter";
import { proxifyBskyImage, proxifyBskyVideo } from "../utils/image-proxy";
import { lazyWithRetry } from "../utils/lazyWithRetry";
import { createLogger } from "../utils/logger";
import { ImageGrid } from "./ImageGrid";
import { NetworkWeatherLayer } from "./NetworkWeatherLayer";
import { PostActionBar } from "./PostActionBar";
import { Spinner } from "./ui/LoadingState";
import { ProfileHoverCard } from "./ui/ProfileHoverCard";

import { RichText } from "./ui/RichText";
import { FeedSkeleton, PostSkeleton } from "./ui/SkeletonLoader";

// Code-split heavy components to improve initial load time
const FeedDiscovery = lazyWithRetry(() =>
  import("./FeedDiscovery").then((m) => ({ default: m.FeedDiscovery })),
);
const ImageGallery = lazyWithRetry(() =>
  import("./ImageGallery").then((m) => ({ default: m.ImageGallery })),
);
const ThreadModal = lazyWithRetry(() =>
  import("./ThreadModal").then((m) => ({ default: m.ThreadModal })),
);
const VideoPlayer = lazyWithRetry(() =>
  import("./VideoPlayer").then((m) => ({ default: m.VideoPlayer })),
);

const logger = createLogger("Home");

async function loadAnthropicService() {
  return await import("../services/anthropic");
}

type FeedType =
  | "following"
  | "whats-hot"
  | "popular-with-friends"
  | "recent"
  | string; // Allow custom feed URIs

interface PostRecord {
  text: string;
  createdAt: string;
  embed?: unknown;
  facets?: unknown[];
  reply?: {
    root: { uri: string; cid: string };
    parent: { uri: string; cid: string };
  };
}

interface Post {
  uri: string;
  cid: string;
  indexedAt?: string;
  author: {
    did: string;
    handle: string;
    displayName?: string;
    avatar?: string;
  };
  record: PostRecord;
  embed?: Embed;
  replyCount?: number;
  repostCount?: number;
  likeCount?: number;
  viewer?: {
    like?: string;
    repost?: string;
  };
  reason?: {
    $type: string;
    by: {
      did: string;
      handle: string;
      displayName?: string;
    };
  };
}

interface FeedGenerator {
  uri: string;
  cid: string;
  did: string;
  creator: {
    did: string;
    handle: string;
    displayName?: string;
    avatar?: string;
  };
  displayName: string;
  description?: string;
  avatar?: string;
  likeCount?: number;
  viewer?: {
    like?: string;
  };
}

interface FeedOption {
  type: FeedType;
  label: string;
  icon: LucideIcon;
  uri: string;
  isDefault?: boolean;
  pinned?: boolean;
  generator?: FeedGenerator;
}

interface SavedFeed {
  value: string;
  pinned?: boolean;
  type: string;
}

type FeedPageItem = any;

interface FeedPage {
  feed: FeedPageItem[];
  cursor?: string;
}

interface FeedQueryData {
  pages: FeedPage[];
  pageParams: (string | undefined)[];
}

interface EmbedImage {
  thumb: string;
  fullsize?: string;
  alt?: string;
}

interface EmbedExternal {
  uri?: string;
  thumb?: string;
  title?: string;
  description?: string;
}

interface EmbedRecord {
  $type?: string;
  uri?: string;
  cid?: string;
  author?: {
    did: string;
    handle: string;
    displayName?: string;
    avatar?: string;
  };
  value?: {
    text?: string;
    createdAt?: string;
    facets?: unknown[];
  };
  embeds?: Embed[];
  indexedAt?: string;
}

interface Embed {
  $type?: string;
  images?: EmbedImage[];
  external?: EmbedExternal;
  record?: EmbedRecord;
  media?: Embed;
  playlist?: string;
  thumbnail?: string;
  aspectRatio?: { width: number; height: number };
  alt?: string;
  cid?: string;
}

interface ApiError {
  message?: string;
  status?: number;
  headers?: Record<string, string>;
}

interface HomeProps {
  initialFeedUri?: string;
  isFocused?: boolean;
  columnId?: string;
  onClose?: () => void;
  onFeedChange?: (
    feed: string,
    label: string,
    feedOptions: FeedOption[],
  ) => void;
  onRefreshRequest?: number;
  showFeedDiscovery?: boolean;
  onCloseFeedDiscovery?: () => void;
}

// Session storage key for persisting open thread across view mode changes
const OPEN_THREAD_KEY = "shadowsky:open-thread";

// Mobile performance configuration
const MOBILE_CONFIG = {
  // Reduce page size for mobile to improve memory usage
  PAGE_SIZE: window.innerWidth < 768 ? 20 : 30,
  // More aggressive GC for mobile
  STALE_TIME: window.innerWidth < 768 ? 15 * 60 * 1000 : 30 * 60 * 1000,
  GC_TIME: window.innerWidth < 768 ? 30 * 60 * 1000 : 60 * 60 * 1000,
  // Limit total pages in memory
  MAX_PAGES: window.innerWidth < 768 ? 5 : 10,
  // Virtual overscan for smooth scrolling
  VIRTUAL_OVERSCAN: window.innerWidth < 768 ? 3 : 5,
};

export const Home: React.FC<HomeProps> = React.memo(
  ({
    initialFeedUri,
    isFocused = true,
    columnId,
    onFeedChange,
    onRefreshRequest,
    showFeedDiscovery: externalShowFeedDiscovery,
    onCloseFeedDiscovery,
  }) => {
    const { agent } = useAuth();
    const navigate = useViewTransitionNavigate();
    const queryClient = useQueryClient();
    const { likeMutation, repostMutation, undoableUnlike, undoableUnrepost } =
      useOptimisticPosts();
    const { toggleBookmark } = useBookmarks();
    const { isPostHidden } = useHiddenPosts();
    const { isUserMuted, isUserBlocked, isThreadMuted } = useModeration();
    const { getThreadPrefetchHandlers } = useRoutePrefetch();
    // Offline feed support - caching and status tracking
    const offlineStatus = useOfflineFeedStatus();
    const { cacheFeedItems } = useFeedCaching("timeline");
    const [isServingCachedFeed, setIsServingCachedFeed] = useState(false);
    // Deep link support for direct navigation to posts via URL fragments
    // The hook automatically scrolls to the post via DOM id/data attributes
    usePostDeepLink({
      enabled: isFocused,
    });
    // Removed hoveredPost state to prevent re-renders - using CSS hover instead
    // Use initialFeedUri if provided, otherwise get from column preferences
    const [selectedFeed, setSelectedFeed] = React.useState<FeedType>(() => {
      // Use the feed from the column data or default to following
      return (initialFeedUri as FeedType) || "following";
    });

    // Update selectedFeed when initialFeedUri changes from parent
    React.useEffect(() => {
      if (initialFeedUri && initialFeedUri !== selectedFeed) {
        setSelectedFeed(initialFeedUri as FeedType);
        // Also save to column preferences
        if (columnId) {
          columnService.updateColumnFeedPreference(columnId, initialFeedUri);
        }
      }
    }, [initialFeedUri, columnId]);

    // Stability-focused caching: warm up cache for instant first load
    // Pre-populates React Query cache with IndexedDB data before component fetches
    // Only enable for standard timeline feeds - custom feeds (AT URIs) aren't cached in offline storage
    const isStandardTimelineFeed =
      selectedFeed === "following" || selectedFeed === "recent";
    useFeedCacheWarmup(
      ["timeline", selectedFeed],
      "timeline",
      isStandardTimelineFeed,
    );

    // Auto-refresh feed when tab becomes visible after being hidden for 1+ minute
    useVisibilityRefresh(["timeline", selectedFeed], {
      enabled: isFocused,
      minHiddenDuration: 60000, // 1 minute
    });

    const [internalShowFeedDiscovery, setInternalShowFeedDiscovery] =
      useState(false);
    const showFeedDiscovery =
      externalShowFeedDiscovery !== undefined
        ? externalShowFeedDiscovery
        : internalShowFeedDiscovery;
    const [galleryImages, setGalleryImages] = useState<Array<{
      thumb: string;
      fullsize: string;
      alt?: string;
    }> | null>(null);
    const [galleryIndex, setGalleryIndex] = useState(0);
    // Restore open thread state from sessionStorage (persists across view mode changes)
    const [selectedPost, setSelectedPost] = useState<Post | null>(() => {
      try {
        const stored = sessionStorage.getItem(OPEN_THREAD_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          // Only restore if it was stored recently (within 30 seconds)
          // This prevents restoring stale thread state on page refresh
          if (parsed.timestamp && Date.now() - parsed.timestamp < 30000) {
            return parsed.post;
          }
          // Clean up stale data
          sessionStorage.removeItem(OPEN_THREAD_KEY);
        }
      } catch {
        // Ignore parse errors
      }
      return null;
    });
    const [showThread, setShowThread] = useState(() => {
      try {
        const stored = sessionStorage.getItem(OPEN_THREAD_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.timestamp && Date.now() - parsed.timestamp < 30000) {
            return true;
          }
        }
      } catch {
        // Ignore parse errors
      }
      return false;
    });
    const [openThreadToReply, setOpenThreadToReply] = useState(false);
    const [openThreadToQuote, setOpenThreadToQuote] = useState(false);
    const [focusedPostIndex, setFocusedPostIndex] = useState<number>(-1);
    const [generatedAltTexts, setGeneratedAltTexts] = useState<
      Record<string, Record<number, string>>
    >({});
    const [generatingAltText, setGeneratingAltText] = useState<
      Record<string, Record<number, boolean>>
    >({});
    const [showAltText, setShowAltText] = useState<
      Record<string, Record<number, boolean>>
    >({});
    const postsContainerRef = useRef<HTMLDivElement>(null);
    const [feedOrder, setFeedOrder] = useState<string[]>([]);
    // Removed showFeedDropdown - now handled by parent component
    const loadMoreRef = useRef<HTMLDivElement>(null);
    const scrollPositionRef = useRef<{ [key: string]: number }>({});
    const containerRef = useRef<HTMLDivElement>(null);
    const postRefs = useRef<{ [key: string]: HTMLDivElement }>({});
    // Removed dropdownRef - now handled by parent component
    const isKeyboardNavigationRef = useRef(false);

    // Keyboard shortcuts context for L/R/B/S/C shortcuts
    const { setFocusedPost, registerPostActions, unregisterPostActions } =
      useKeyboardShortcutsContext();

    // Fetch user's saved/pinned feeds
    const { data: userPrefs } = useQuery({
      queryKey: ["userPreferences"],
      queryFn: async () => {
        if (!agent) throw new Error("Not authenticated");
        const prefs = await agent.getPreferences();
        debug.log("User preferences:", prefs);
        return prefs;
      },
      enabled: !!agent,
      staleTime: 30 * 60 * 1000, // 30 minutes
      refetchOnMount: false,
    });

    // Fetch feed generator details for saved feeds
    const { data: feedGenerators } = useQuery({
      queryKey: ["feedGenerators", userPrefs?.savedFeeds],
      queryFn: async () => {
        if (!agent || !userPrefs?.savedFeeds?.length) return [];

        const feedUris = userPrefs.savedFeeds
          .filter((feed) => feed.type === "feed")
          .map((feed) => feed.value);

        if (feedUris.length === 0) return [];

        try {
          const response = await agent.app.bsky.feed.getFeedGenerators({
            feeds: feedUris,
          });
          debug.log("Feed generators:", response.data);
          return response.data.feeds;
        } catch (error) {
          debug.error("Failed to fetch feed generators:", error);
          return [];
        }
      },
      enabled: !!agent && !!userPrefs?.savedFeeds,
    });

    // Build feed options including user's saved feeds
    const feedOptions = React.useMemo(() => {
      const defaultFeeds = [
        {
          type: "following" as FeedType,
          label: "Following",
          icon: Users,
          uri: "following",
          isDefault: true,
        },
        {
          type: "whats-hot" as FeedType,
          label: "What's Hot",
          icon: TrendingUp,
          uri: "at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/whats-hot",
          isDefault: true,
        },
        {
          type: "popular-with-friends" as FeedType,
          label: "Popular w/ Friends",
          icon: Heart,
          uri: "at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/with-friends",
          isDefault: true,
        },
        {
          type: "recent" as FeedType,
          label: "Recent",
          icon: Clock,
          uri: "recent",
          isDefault: true,
        },
      ];

      // Add pinned feeds first, then other saved feeds
      const savedFeeds: FeedOption[] = [];
      if (userPrefs?.savedFeeds && feedGenerators) {
        const pinnedFeeds = userPrefs.savedFeeds.filter(
          (feed) => feed.pinned && feed.type === "feed",
        );
        const unpinnedFeeds = userPrefs.savedFeeds.filter(
          (feed) => !feed.pinned && feed.type === "feed",
        );

        const addFeedOption = (savedFeed: SavedFeed) => {
          const generator = feedGenerators.find(
            (g: FeedGenerator) => g.uri === savedFeed.value,
          );
          if (generator) {
            savedFeeds.push({
              type: savedFeed.value,
              label: generator.displayName,
              icon: savedFeed.pinned ? Star : Hash,
              uri: savedFeed.value,
              pinned: savedFeed.pinned,
              generator,
              isDefault: false,
            });
          }
        };

        pinnedFeeds.forEach((feed) => addFeedOption(feed));
        unpinnedFeeds.forEach((feed) => addFeedOption(feed));
      }

      const allFeeds = [...defaultFeeds, ...savedFeeds];

      // Initialize feed order if not set
      if (feedOrder.length === 0) {
        const savedOrder = localStorage.getItem("feedOrder");
        if (savedOrder) {
          const parsedOrder = JSON.parse(savedOrder);
          // Validate saved order includes all current feeds
          const currentTypes = allFeeds.map((f) => f.type);
          const validOrder = parsedOrder.filter((type: string) =>
            currentTypes.includes(type),
          );
          const missingTypes = currentTypes.filter(
            (type) => !validOrder.includes(type),
          );
          setFeedOrder([...validOrder, ...missingTypes]);
        } else {
          setFeedOrder(allFeeds.map((f) => f.type));
        }
      }

      // Sort feeds by the saved order
      return allFeeds.sort((a, b) => {
        const aIndex = feedOrder.indexOf(a.type);
        const bIndex = feedOrder.indexOf(b.type);
        if (aIndex === -1 && bIndex === -1) return 0;
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      });
    }, [userPrefs, feedGenerators, feedOrder]);

    const currentFeedOption = feedOptions.find(
      (opt) => opt.type === selectedFeed,
    );

    // Notify parent of current feed on mount and feed change
    useEffect(() => {
      if (onFeedChange && currentFeedOption) {
        onFeedChange(selectedFeed, currentFeedOption.label, feedOptions);
      }
    }, [selectedFeed, currentFeedOption, feedOptions, onFeedChange]);

    // Handle refresh request from parent
    useEffect(() => {
      if (onRefreshRequest && onRefreshRequest > 0) {
        queryClient.invalidateQueries({ queryKey: ["timeline", selectedFeed] });
      }
    }, [onRefreshRequest, queryClient, selectedFeed]);

    // Persist open thread state to sessionStorage for view mode transitions
    useEffect(() => {
      if (showThread && selectedPost) {
        sessionStorage.setItem(
          OPEN_THREAD_KEY,
          JSON.stringify({
            post: selectedPost,
            timestamp: Date.now(),
          }),
        );
      } else {
        sessionStorage.removeItem(OPEN_THREAD_KEY);
      }
    }, [showThread, selectedPost]);

    // Dropdown is now handled by the parent component

    const feedQuery = useInfiniteQuery({
      queryKey: ["timeline", selectedFeed],
      queryFn: async ({ pageParam }: { pageParam?: string }) => {
        if (!agent) throw new Error("Not authenticated");

        // If offline and this is the first page, try to serve from cache
        if (!navigator.onLine && !pageParam) {
          logger.info("Offline - attempting to serve cached feed");
          setIsServingCachedFeed(true);

          try {
            await offlineStorageDB.init();
            const cachedItems = await offlineStorageDB.getFeedItems(
              100,
              "timeline",
            );

            if (cachedItems.length > 0) {
              logger.info(`Serving ${cachedItems.length} cached items`);
              // Transform cached items back to feed format
              const transformedFeed = cachedItems.map((item) => ({
                post: {
                  uri: item.uri,
                  cid: item.cid,
                  indexedAt: item.indexedAt,
                  author: item.author,
                  record: item.record,
                  replyCount: item.replyCount,
                  repostCount: item.repostCount,
                  likeCount: item.likeCount,
                  viewer: {}, // Viewer state not persisted offline
                },
                _fromOfflineCache: true,
                _cachedAt: item._offlineCachedAt,
              }));

              return {
                feed: transformedFeed,
                cursor: undefined,
                _fromCache: true,
              };
            }
          } catch (cacheError) {
            logger.error("Failed to get cached feed:", cacheError);
          }

          throw new Error(
            "You are offline and no cached content is available. Connect to the internet to view your feed.",
          );
        }

        setIsServingCachedFeed(false);
        let response;

        try {
          // Wrap all feed API calls in rate limiter to prevent 429s
          // when multiple columns load simultaneously
          response = await rateLimitedFeedFetch(async () => {
            switch (selectedFeed) {
              case "following":
              case "recent":
                return agent.getTimeline({
                  cursor: pageParam,
                  limit: MOBILE_CONFIG.PAGE_SIZE,
                });

              default:
                // Handle custom feed URIs
                if (selectedFeed.startsWith("at://")) {
                  // Check if it's a list feed or a regular feed
                  if (selectedFeed.includes("/app.bsky.graph.list/")) {
                    // It's a list feed
                    return agent.app.bsky.feed.getListFeed({
                      list: selectedFeed,
                      cursor: pageParam,
                      limit: MOBILE_CONFIG.PAGE_SIZE,
                    });
                  } else {
                    // It's a regular feed
                    return agent.app.bsky.feed.getFeed({
                      feed: selectedFeed,
                      cursor: pageParam,
                      limit: MOBILE_CONFIG.PAGE_SIZE,
                    });
                  }
                } else {
                  // Handle known feed types
                  switch (selectedFeed) {
                    case "whats-hot":
                      return agent.app.bsky.feed.getFeed({
                        feed: "at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/whats-hot",
                        cursor: pageParam,
                        limit: MOBILE_CONFIG.PAGE_SIZE,
                      });

                    case "popular-with-friends":
                      return agent.app.bsky.feed.getFeed({
                        feed: "at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/with-friends",
                        cursor: pageParam,
                        limit: MOBILE_CONFIG.PAGE_SIZE,
                      });

                    default:
                      throw new Error(`Unknown feed type: ${selectedFeed}`);
                  }
                }
            }
          });

          // Cache timeline feed items for offline access (only first page)
          if (
            response?.data?.feed &&
            !pageParam &&
            (selectedFeed === "following" || selectedFeed === "recent")
          ) {
            cacheFeedItems(response.data.feed);
          }
        } catch (err: unknown) {
          const error = err as ApiError;
          debug.error(`Failed to fetch feed ${selectedFeed}:`, error);

          // If fetch failed and we're possibly offline, try cache
          if (!navigator.onLine && !pageParam) {
            try {
              await offlineStorageDB.init();
              const cachedItems = await offlineStorageDB.getFeedItems(
                100,
                "timeline",
              );

              if (cachedItems.length > 0) {
                logger.info(
                  `Network error - serving ${cachedItems.length} cached items`,
                );
                setIsServingCachedFeed(true);
                const transformedFeed = cachedItems.map((item) => ({
                  post: {
                    uri: item.uri,
                    cid: item.cid,
                    indexedAt: item.indexedAt,
                    author: item.author,
                    record: item.record,
                    replyCount: item.replyCount,
                    repostCount: item.repostCount,
                    likeCount: item.likeCount,
                    viewer: {},
                  },
                  _fromOfflineCache: true,
                  _cachedAt: item._offlineCachedAt,
                }));

                return {
                  feed: transformedFeed,
                  cursor: undefined,
                  _fromCache: true,
                };
              }
            } catch {
              // Fall through to error handling
            }
          }

          // Provide more user-friendly error messages
          if (error?.message?.includes("List not found")) {
            throw new Error(
              "This list could not be found. It may have been deleted or you may not have access to it.",
            );
          } else if (error?.message?.includes("Feed not found")) {
            throw new Error(
              "This feed could not be found. It may have been removed or you may not have access to it.",
            );
          } else if (error?.message?.includes("must be a valid at-uri")) {
            throw new Error(
              "Invalid feed URL. Please check the URL and try again.",
            );
          } else if (error?.status === 400) {
            throw new Error("Invalid feed request. Please check the feed URL.");
          } else if (error?.status === 403) {
            throw new Error("You do not have permission to view this feed.");
          } else if (error?.status === 404) {
            throw new Error("Feed not found. It may have been deleted.");
          } else if (error?.status === 429) {
            // Preserve the original error so retry logic can read status/headers
            throw err;
          } else if (error?.status && error.status >= 500) {
            throw new Error("Server error. Please try again later.");
          } else {
            throw new Error(
              error?.message || "Failed to load feed. Please try again.",
            );
          }
        }

        debug.log(`${selectedFeed} feed response:`, response);
        return response.data;
      },
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (lastPage) => lastPage.cursor,
      maxPages: 10,
      enabled: !!agent,
      staleTime: MOBILE_CONFIG.STALE_TIME,
      gcTime: MOBILE_CONFIG.GC_TIME,
      refetchOnMount: false, // Don't automatically refetch
      retry: (failureCount, error) => {
        // Don't retry if offline
        if (!navigator.onLine) return false;
        const status = (error as ApiError)?.status;
        // Retry 429s up to 3 times (retryDelay handles backoff)
        if (status === 429) return failureCount < 3;
        // Don't retry client errors (except 429)
        if (status && status >= 400 && status < 500) return false;
        // Retry server errors and network errors up to 3 times
        return failureCount < 3;
      },
      retryDelay: (attemptIndex, error) => {
        const apiError = error as ApiError;
        if (apiError?.status === 429) {
          // Respect Retry-After header if present
          const retryAfter =
            apiError?.headers?.["retry-after"] ||
            apiError?.headers?.["Retry-After"];
          if (retryAfter) {
            const seconds = parseInt(retryAfter, 10);
            if (!isNaN(seconds)) return seconds * 1000;
          }
          // Default: aggressive backoff for 429 (2s, 4s, 8s)
          return Math.min(2000 * Math.pow(2, attemptIndex), 10000);
        }
        // Standard exponential backoff for other errors
        return Math.min(1000 * Math.pow(2, attemptIndex), 8000);
      },
    });

    const {
      data,
      isLoading: isLoadingRaw,
      error,
      fetchNextPage,
      hasNextPage,
      isFetchingNextPage,
    } = feedQuery;

    // Apply minimum duration to prevent jarring flash of loading state
    const isLoading = useMinDuration(isLoadingRaw);

    // Refresh feed when coming back online from cached data
    useEffect(() => {
      if (offlineStatus.isOnline && isServingCachedFeed) {
        logger.info("Back online - refreshing feed");
        queryClient.invalidateQueries({ queryKey: ["timeline", selectedFeed] });
      }
    }, [
      offlineStatus.isOnline,
      isServingCachedFeed,
      queryClient,
      selectedFeed,
    ]);

    const posts = React.useMemo(() => {
      if (!data?.pages) return [];
      return data.pages.flatMap((page, pageIndex) =>
        page.feed
          .filter((item) => {
            const post = item.post;
            // Filter out hidden posts
            if (isPostHidden(post.uri)) return false;
            // Filter out posts from muted users
            if (isUserMuted(post.author.did)) return false;
            // Filter out posts from blocked users
            if (isUserBlocked(post.author.did)) return false;
            // Filter out muted threads
            if (isThreadMuted(post.uri)) return false;
            return true;
          })
          .map((item, itemIndex) => ({
            ...item,
            _pageIndex: pageIndex,
            _itemIndex: itemIndex,
          })),
      );
    }, [data, isPostHidden, isUserMuted, isUserBlocked, isThreadMuted]);

    // Use progressive loading instead of full virtualization
    const {
      visibleItems,
      loadMoreRef: progressiveLoadRef,
      hasMore,
    } = useIntersectionLoader(posts, {
      initialLoad: window.innerWidth < 768 ? 25 : 40,
      increment: window.innerWidth < 768 ? 15 : 25,
    });

    // Clean up old pages when we hit the limit for memory management
    // Only trim when user is near the bottom (not scrolled into old content)
    React.useEffect(() => {
      if (data?.pages && data.pages.length > MOBILE_CONFIG.MAX_PAGES) {
        const scrollRatio =
          window.scrollY /
          (document.documentElement.scrollHeight - window.innerHeight || 1);
        // Only trim old pages if user is in the bottom half of content
        // This prevents scroll jumps when reading older posts
        if (scrollRatio > 0.5) {
          queryClient.setQueryData(
            ["timeline", selectedFeed],
            (oldData: FeedQueryData | undefined) => {
              if (!oldData) return oldData;
              return {
                ...oldData,
                pages: oldData.pages.slice(-MOBILE_CONFIG.MAX_PAGES),
                pageParams: oldData.pageParams.slice(-MOBILE_CONFIG.MAX_PAGES),
              };
            },
          );
        }
      }
    }, [data?.pages, queryClient, selectedFeed]);

    // Clean up alt text states and postRefs for posts that are no longer in the feed
    // This prevents unbounded memory growth as users scroll through feeds
    // Only prunes state when entries actually need removal to avoid unnecessary re-renders
    React.useEffect(() => {
      const currentPostUris = new Set(posts.map((p) => p.post.uri));

      // Helper: returns prev unchanged if nothing was pruned, otherwise returns filtered copy
      function pruneRecord<T>(
        prev: Record<string, T>,
        validKeys: Set<string>,
      ): Record<string, T> {
        const staleKeys = Object.keys(prev).filter(
          (key) => !validKeys.has(key),
        );
        if (staleKeys.length === 0) return prev;
        const filtered: Record<string, T> = {};
        for (const key of Object.keys(prev)) {
          if (validKeys.has(key)) {
            filtered[key] = prev[key];
          }
        }
        return filtered;
      }

      // Clean up alt text states for removed posts (no-op if nothing stale)
      setGeneratedAltTexts((prev) => pruneRecord(prev, currentPostUris));
      setGeneratingAltText((prev) => pruneRecord(prev, currentPostUris));
      setShowAltText((prev) => pruneRecord(prev, currentPostUris));

      // Clean up postRefs for removed posts
      let hasStaleRefs = false;
      for (const key in postRefs.current) {
        const uri = key.split("-").slice(0, -1).join("-"); // Remove index suffix
        if (!currentPostUris.has(uri)) {
          hasStaleRefs = true;
          break;
        }
      }
      if (hasStaleRefs) {
        const newPostRefs: { [key: string]: HTMLDivElement } = {};
        for (const key in postRefs.current) {
          const uri = key.split("-").slice(0, -1).join("-");
          if (currentPostUris.has(uri)) {
            newPostRefs[key] = postRefs.current[key];
          }
        }
        postRefs.current = newPostRefs;
      }
    }, [posts]);

    // Memoize post rendering to prevent unnecessary re-renders
    const PostItem = React.memo(
      ({ item, index }: { item: any; index: number }) => {
        const post = item.post;
        const isFocused = focusedPostIndex === index;

        return (
          <div
            key={`${post.uri}-${index}`}
            ref={(el) => {
              if (el) postRefs.current[`${post.uri}-${index}`] = el;
            }}
            className={`relative cursor-pointer px-3 py-2.5 transition-colors hover:bg-gray-50 dark:hover:bg-gray-900 ${
              item.reply?.parent || post.record?.reply?.parent
                ? "from-blue-500/3 border-l-4 border-blue-500 bg-gradient-to-r to-transparent"
                : ""
            } ${isFocused ? "bg-blue-500/3 outline outline-2 outline-offset-[-2px] outline-blue-500" : ""}`}
            id={`post-${post.uri.split("/").pop()}`}
            data-post-id={post.uri.split("/").pop()}
            data-post-uri={post.uri}
            tabIndex={isFocused ? 0 : -1}
            aria-selected={isFocused}
            role="article"
            {...getThreadPrefetchHandlers(post.uri)}
            onClick={(e) => {
              // Only handle click if not on interactive elements
              const target = e.target as HTMLElement;
              const clickedOnInteractive =
                target.closest('[role="button"]') ||
                target.closest("button") ||
                target.closest("a") ||
                target.closest("[data-clickable]") ||
                target.tagName === "BUTTON" ||
                target.tagName === "A";

              if (!clickedOnInteractive) {
                // Update focused index on click (not keyboard navigation)
                isKeyboardNavigationRef.current = false;
                setFocusedPostIndex(index);
                // Open thread view when clicking anywhere on the card
                handlePostClick(post);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handlePostClick(post);
              }
            }}
          >
            {item.reason && (
              <div
                className="mb-1.5 flex items-center gap-2 text-xs"
                style={{ color: "var(--asph-text-secondary)" }}
              >
                <Repeat2 size={12} />
                <span>
                  <ProfileHoverCard handle={item.reason.by.handle}>
                    <span
                      className="cursor-pointer hover:underline"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/profile/${item.reason?.by.handle}`);
                      }}
                    >
                      {item.reason?.by.displayName || item.reason?.by.handle}
                    </span>
                  </ProfileHoverCard>{" "}
                  reposted
                </span>
              </div>
            )}

            {/* Show reply context from feed item */}
            {item.reply?.parent && (
              <div className="relative">
                {/* Reply indicator with background */}
                <div className="border-asph-primary/20 from-asph-primary/10 to-asph-primary/5 mb-3 flex items-center gap-2 rounded-lg border bg-gradient-to-br px-3 py-2 backdrop-blur-sm">
                  <div className="flex items-center">
                    <div className="flex w-12 justify-center">
                      <div className="h-6 w-0.5 bg-asph-primary"></div>
                    </div>
                    <Reply size={16} className="mr-2 text-asph-primary" />
                  </div>
                  <div className="flex-1">
                    <span
                      className="text-sm font-medium"
                      style={{ color: "var(--asph-text-primary)" }}
                    >
                      Replying to{" "}
                      <ProfileHoverCard
                        handle={item.reply.parent.author?.handle || "unknown"}
                      >
                        <button
                          className="touch-target-sm font-semibold text-asph-primary hover:underline"
                          onClick={(e) => {
                            e.stopPropagation();
                            // Navigate to parent post
                            const parentPost = item.reply?.parent;
                            if (parentPost) {
                              handlePostClick(parentPost);
                            }
                          }}
                        >
                          @{item.reply?.parent.author?.handle || "unknown"}
                        </button>
                      </ProfileHoverCard>
                    </span>
                    {item.reply.parent.record?.text && (
                      <div
                        className="mt-0.5 line-clamp-2 text-xs"
                        style={{ color: "var(--asph-text-secondary)" }}
                      >
                        "{item.reply.parent.record.text}"
                      </div>
                    )}
                  </div>
                </div>
                {/* Connecting line from reply indicator to avatar */}
                <div className="bg-asph-primary/30 absolute left-6 top-full h-3 w-0.5"></div>
              </div>
            )}

            {/* Show reply context from post record if not in feed item */}
            {!item.reply?.parent && post.record?.reply?.parent && (
              <div className="relative">
                {/* Reply indicator with background */}
                <div className="border-asph-primary/20 from-asph-primary/10 to-asph-primary/5 mb-3 flex items-center gap-2 rounded-lg border bg-gradient-to-br px-3 py-2 backdrop-blur-sm">
                  <div className="flex items-center">
                    <div className="flex w-12 justify-center">
                      <div className="h-6 w-0.5 bg-asph-primary"></div>
                    </div>
                    <Reply size={16} className="mr-2 text-asph-primary" />
                  </div>
                  <span
                    className="text-sm font-medium"
                    style={{ color: "var(--asph-text-primary)" }}
                  >
                    This is a reply
                  </span>
                </div>
                {/* Connecting line from reply indicator to avatar */}
                <div className="bg-asph-primary/30 absolute left-6 top-full h-3 w-0.5"></div>
              </div>
            )}

            <div>
              {/* Avatar and user info row */}
              <div className="flex items-start gap-3">
                <ProfileHoverCard handle={post.author.handle}>
                  <img
                    src={
                      proxifyBskyImage(post.author.avatar) ||
                      "/default-avatar.svg"
                    }
                    alt={post.author.handle}
                    className="h-12 w-12 cursor-pointer rounded-full transition-opacity hover:opacity-80"
                    data-clickable="profile"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/profile/${post.author.handle}`);
                    }}
                  />
                </ProfileHoverCard>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <ProfileHoverCard handle={post.author.handle}>
                      <span
                        className="cursor-pointer font-semibold hover:underline inline-flex items-center min-h-[44px]"
                        style={{ color: "var(--asph-text-primary)" }}
                        data-clickable="profile"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/profile/${post.author.handle}`);
                        }}
                      >
                        {post.author.displayName || post.author.handle}
                      </span>
                    </ProfileHoverCard>
                    {(item.reply?.parent || post.record?.reply?.parent) && (
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{
                          backgroundColor: "var(--asph-primary)",
                          color: "white",
                        }}
                      >
                        REPLY
                      </span>
                    )}
                  </div>
                  <div
                    className="text-sm"
                    style={{ color: "var(--asph-text-secondary)" }}
                  >
                    <ProfileHoverCard handle={post.author.handle}>
                      <span
                        className="cursor-pointer hover:underline"
                        data-clickable="profile"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/profile/${post.author.handle}`);
                        }}
                      >
                        @{post.author.handle}
                      </span>
                    </ProfileHoverCard>{" "}
                    ·{" "}
                    <span
                      className="cursor-pointer hover:underline"
                      data-clickable="thread"
                      onClick={(e) => {
                        e.stopPropagation();
                        const postId = post.uri.split("/").pop();
                        navigate(`/thread/${post.author.handle}/${postId}`);
                      }}
                    >
                      {formatDistanceToNow(new Date(post.record.createdAt), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Post content below, aligned with avatar */}
              <div className="mt-2">
                <div
                  className="whitespace-pre-wrap"
                  style={{ color: "var(--asph-text-primary)" }}
                >
                  <RichText
                    text={post.record.text}
                    facets={
                      post.record.facets as Parameters<
                        typeof RichText
                      >[0]["facets"]
                    }
                  />
                </div>

                {renderEmbed(post.embed, post.uri, index)}

                {/* Post Action Bar */}
                <PostActionBar
                  post={post as unknown as AppBskyFeedDefs.PostView}
                  onReply={() => {
                    // Open thread modal with reply focus
                    setSelectedPost(post);
                    setOpenThreadToReply(true);
                    setOpenThreadToQuote(false);
                    setShowThread(true);
                  }}
                  onRepost={() => handleRepost(post)}
                  onQuote={() => {
                    // Open thread modal with quote focus
                    setSelectedPost(post);
                    setOpenThreadToReply(false);
                    setOpenThreadToQuote(true);
                    setShowThread(true);
                  }}
                  onLike={() => handleLike(post)}
                  onBookmark={() => handleBookmark(post)}
                  showCounts={true}
                  size="medium"
                />
              </div>
            </div>
          </div>
        );
      },
      // Custom comparison function to prevent re-renders when only index changes
      (prevProps, nextProps) => {
        // Only re-render if the post data actually changes
        return (
          prevProps.item.post.uri === nextProps.item.post.uri &&
          prevProps.item.post.viewer?.like ===
            nextProps.item.post.viewer?.like &&
          prevProps.item.post.viewer?.repost ===
            nextProps.item.post.viewer?.repost &&
          prevProps.item.post.likeCount === nextProps.item.post.likeCount &&
          prevProps.item.post.repostCount === nextProps.item.post.repostCount &&
          prevProps.item.post.replyCount === nextProps.item.post.replyCount &&
          prevProps.index === nextProps.index
        );
      },
    );

    // Intersection observer for infinite scroll with optimistic pre-fetching
    useEffect(() => {
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
            debug.log("Pre-fetching next page of feed");
            fetchNextPage();
          }
        },
        {
          threshold: 0.1,
          // Pre-fetch when user is within 3 viewport heights of the bottom
          rootMargin: "300% 0px 300% 0px",
        },
      );

      const currentRef = loadMoreRef.current;
      if (currentRef) {
        observer.observe(currentRef);
      }

      return () => {
        if (currentRef) {
          observer.unobserve(currentRef);
        }
        observer.disconnect();
      };
    }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

    // Save scroll position on unmount
    useEffect(() => {
      const currentFeed = selectedFeed;
      const scrollPositions = scrollPositionRef.current;
      return () => {
        // Save current scroll position when component unmounts
        if (currentFeed) {
          scrollPositions[currentFeed] = window.scrollY;
        }
      };
    }, [selectedFeed]);

    // Handler functions (must be defined before keyboard navigation useEffect)
    const handlePostClick = React.useCallback((post: Post) => {
      setSelectedPost(post);
      setOpenThreadToReply(false); // Reset when clicking on post normally
      setShowThread(true);
    }, []);

    // Mutations are handled by useOptimisticPosts hook

    const handleLike = React.useCallback(
      async (post: Post, e?: React.MouseEvent) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        if (!agent) return;

        try {
          if (post.viewer?.like) {
            undoableUnlike(post.uri, post.viewer.like);
          } else {
            await likeMutation.mutateAsync({
              uri: post.uri,
              cid: post.cid,
            });
          }
        } catch (error) {
          debug.error("Failed to like/unlike post:", error);
        }
      },
      [agent, likeMutation, undoableUnlike],
    );

    const handleRepost = React.useCallback(
      async (post: Post, e?: React.MouseEvent) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        if (!agent) return;

        try {
          if (post.viewer?.repost) {
            undoableUnrepost(post.uri, post.viewer.repost);
          } else {
            await repostMutation.mutateAsync({
              uri: post.uri,
              cid: post.cid,
            });
          }
        } catch (error) {
          debug.error("Failed to repost:", error);
        }
      },
      [agent, repostMutation, undoableUnrepost],
    );

    const handleBookmark = React.useCallback(
      async (post: Post, e?: React.MouseEvent) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        if (!agent) return;

        try {
          // Cast to PostView type - add indexedAt field
          const postView = {
            ...post,
            indexedAt: new Date().toISOString(),
          } as unknown as AppBskyFeedDefs.PostView;

          // Use the hook's toggleBookmark which updates the BookmarkStore
          toggleBookmark(postView);
        } catch (error) {
          debug.error("Failed to bookmark post:", error);
        }
      },
      [agent, toggleBookmark],
    );

    // Keyboard navigation
    useEffect(() => {
      const handleKeyPress = (e: KeyboardEvent) => {
        // Only handle if this column is focused (for SkyDeck compatibility)
        if (!isFocused) return;

        // Don't handle shortcuts if user is typing in an input/textarea or modals are open
        if (
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement ||
          document.body.classList.contains("thread-modal-open") ||
          document.body.classList.contains("conversation-modal-open")
        ) {
          return;
        }

        let handled = false;
        const currentIndex = focusedPostIndex;

        switch (e.key) {
          case "ArrowDown":
          case "j": // vim-style down
            e.preventDefault();
            handled = true;
            isKeyboardNavigationRef.current = true;
            if (currentIndex < posts.length - 1) {
              setFocusedPostIndex(currentIndex + 1);
            } else if (currentIndex === -1 && posts.length > 0) {
              // If nothing selected, select first item
              setFocusedPostIndex(0);
            }
            break;

          case "ArrowUp":
          case "k": // vim-style up
            e.preventDefault();
            handled = true;
            isKeyboardNavigationRef.current = true;
            if (currentIndex > 0) {
              setFocusedPostIndex(currentIndex - 1);
            } else if (currentIndex === -1 && posts.length > 0) {
              // If nothing selected, select last item when going up
              setFocusedPostIndex(posts.length - 1);
            }
            break;

          case "Enter":
            e.preventDefault();
            handled = true;
            if (currentIndex >= 0 && currentIndex < posts.length) {
              const feedItem = posts[currentIndex];
              if (
                feedItem?.post &&
                "author" in feedItem.post &&
                "record" in feedItem.post
              ) {
                handlePostClick(feedItem.post as unknown as Post);
              }
            }
            break;

          case "Home":
            e.preventDefault();
            handled = true;
            isKeyboardNavigationRef.current = true;
            if (posts.length > 0) {
              setFocusedPostIndex(0);
            }
            break;

          case "End":
            e.preventDefault();
            handled = true;
            isKeyboardNavigationRef.current = true;
            if (posts.length > 0) {
              setFocusedPostIndex(posts.length - 1);
            }
            break;

          case "PageUp":
            e.preventDefault();
            handled = true;
            isKeyboardNavigationRef.current = true;
            // Jump up by 5 items
            setFocusedPostIndex(Math.max(0, currentIndex - 5));
            break;

          case "PageDown":
            e.preventDefault();
            handled = true;
            isKeyboardNavigationRef.current = true;
            // Jump down by 5 items
            setFocusedPostIndex(Math.min(posts.length - 1, currentIndex + 5));
            break;

          case "Escape":
            // Clear selection
            setFocusedPostIndex(-1);
            handled = true;
            break;

          case " ": // Space for page scroll
            if (!e.shiftKey) {
              e.preventDefault();
              window.scrollBy({
                top: window.innerHeight * 0.8,
                behavior: "smooth",
              });
              handled = true;
            }
            break;
        }

        // Prevent default browser scrolling if we handled the key
        if (handled) {
          e.stopPropagation();
        }
      };

      window.addEventListener("keydown", handleKeyPress);
      return () => window.removeEventListener("keydown", handleKeyPress);
    }, [posts, focusedPostIndex, isFocused, handlePostClick]);

    // Scroll focused post into view only for keyboard navigation
    useEffect(() => {
      if (
        focusedPostIndex >= 0 &&
        focusedPostIndex < posts.length &&
        isKeyboardNavigationRef.current
      ) {
        const post = posts[focusedPostIndex]?.post;
        if (post) {
          const postKey = `${post.uri}-${focusedPostIndex}`;
          const postEl = postRefs.current[postKey];
          if (postEl) {
            postEl.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });
            postEl.focus();
          }
        }
        // Reset the flag after scrolling
        isKeyboardNavigationRef.current = false;
      }
    }, [focusedPostIndex, posts]);

    // Make container focusable for keyboard navigation
    useEffect(() => {
      if (containerRef.current && isFocused) {
        // Focus container when column becomes focused
        // This ensures keyboard events are captured
        containerRef.current.focus();
      }
    }, [isFocused]);

    // Clear focused post when column loses focus
    useEffect(() => {
      if (!isFocused) {
        setFocusedPostIndex(-1);
      }
    }, [isFocused]);

    // Report focused post to keyboard shortcuts context
    useEffect(() => {
      if (focusedPostIndex >= 0 && focusedPostIndex < posts.length) {
        const feedItem = posts[focusedPostIndex];
        if (feedItem?.post) {
          setFocusedPost({
            post: feedItem.post,
            index: focusedPostIndex,
            columnId: columnId || "home",
          });
        }
      } else {
        setFocusedPost(null);
      }
    }, [focusedPostIndex, posts, columnId, setFocusedPost]);

    // Register post actions for keyboard shortcuts (L, R, B, S, C/R)
    useEffect(() => {
      const effectiveColumnId = columnId || "home";
      registerPostActions(effectiveColumnId, {
        onLike: (post) => {
          if (post.viewer?.like) {
            undoableUnlike(post.uri, post.viewer.like);
          } else {
            likeMutation.mutate({ uri: post.uri, cid: post.cid });
          }
        },
        onRepost: (post) => {
          if (post.viewer?.repost) {
            undoableUnrepost(post.uri, post.viewer.repost);
          } else {
            repostMutation.mutate({ uri: post.uri, cid: post.cid });
          }
        },
        onReply: (post) => {
          setSelectedPost(post as unknown as Post);
          setOpenThreadToReply(true);
          setShowThread(true);
        },
        onBookmark: (post) => {
          toggleBookmark(post);
        },
        onShare: async (post) => {
          const shareUrl = `https://bsky.app/profile/${post.author.handle}/post/${post.uri.split("/").pop()}`;
          if (navigator.share) {
            try {
              await navigator.share({
                title: "Share post",
                url: shareUrl,
              });
            } catch {
              // User cancelled or share failed, fall back to clipboard
              await navigator.clipboard.writeText(shareUrl);
            }
          } else {
            await navigator.clipboard.writeText(shareUrl);
          }
        },
        onOpen: (post) => {
          handlePostClick(post as unknown as Post);
        },
        onMoreMenu: (post) => {
          // Find the focused post element and click its more menu button
          const postEl = document.querySelector(
            `[data-post-uri="${post.uri}"][aria-selected="true"]`,
          );
          if (postEl) {
            const moreBtn = postEl.querySelector(
              '[aria-label="More options"]',
            ) as HTMLButtonElement | null;
            moreBtn?.click();
          }
        },
        onNavigateNext: () => {
          if (focusedPostIndex < posts.length - 1) {
            isKeyboardNavigationRef.current = true;
            setFocusedPostIndex((prev) => prev + 1);
          } else if (focusedPostIndex === -1 && posts.length > 0) {
            isKeyboardNavigationRef.current = true;
            setFocusedPostIndex(0);
          }
        },
        onNavigatePrev: () => {
          if (focusedPostIndex > 0) {
            isKeyboardNavigationRef.current = true;
            setFocusedPostIndex((prev) => prev - 1);
          } else if (focusedPostIndex === -1 && posts.length > 0) {
            isKeyboardNavigationRef.current = true;
            setFocusedPostIndex(posts.length - 1);
          }
        },
      });

      return () => unregisterPostActions(effectiveColumnId);
    }, [
      columnId,
      registerPostActions,
      unregisterPostActions,
      likeMutation,
      undoableUnlike,
      repostMutation,
      undoableUnrepost,
      toggleBookmark,
      focusedPostIndex,
      posts,
      handlePostClick,
    ]);

    const handleGenerateAltText = React.useCallback(
      async (imageUrl: string, postUri: string, index: number) => {
        const postKey = postUri;
        setGeneratingAltText((prev) => ({
          ...prev,
          [postKey]: { ...prev[postKey], [index]: true },
        }));
        try {
          // Pass the URL directly to the backend which will handle fetching
          const anthropicService = await loadAnthropicService();
          const altText = await anthropicService.generateAltText(imageUrl);

          setGeneratedAltTexts((prev) => ({
            ...prev,
            [postKey]: { ...prev[postKey], [index]: altText },
          }));
          setShowAltText((prev) => ({
            ...prev,
            [postKey]: { ...prev[postKey], [index]: true },
          }));
        } catch (error) {
          // Show user-friendly error message
          logger.error("Error generating alt text:", error);
          alert(
            error instanceof Error
              ? error.message
              : "Failed to generate alt text",
          );
        } finally {
          setGeneratingAltText((prev) => ({
            ...prev,
            [postKey]: { ...prev[postKey], [index]: false },
          }));
        }
      },
      [],
    );

    // Memoize renderEmbed to prevent re-creation on every render
    const renderEmbed = React.useCallback(
      (
        embed: Embed | null | undefined,
        postUri?: string,
        postIndex?: number,
      ) => {
        if (!embed) return null;

        if (embed.$type === "app.bsky.embed.images#view") {
          return (
            <ImageGrid
              images={(embed.images || []).map((img: EmbedImage) => ({
                thumb: img.thumb,
                fullsize: img.fullsize || img.thumb,
                alt: img.alt,
              }))}
              onImageClick={(index) => {
                const images = (embed.images || []).map((img: EmbedImage) => ({
                  thumb: proxifyBskyImage(img.thumb) || "",
                  fullsize: proxifyBskyImage(img.fullsize || img.thumb) || "",
                  alt: img.alt || "",
                }));
                setGalleryImages(images);
                setGalleryIndex(index);
              }}
            />
          );
        }

        if (embed.$type === "app.bsky.embed.external#view") {
          const external = embed.external;
          if (!external) return null;

          const isGif =
            external.uri?.toLowerCase().includes(".gif") ||
            external.uri?.includes("tenor.com") ||
            external.uri?.includes("giphy.com") ||
            external.uri?.includes("t.gifs.bsky.app");

          const handleClick = (e: React.MouseEvent) => {
            e.stopPropagation();
            if (external.uri) {
              window.open(external.uri, "_blank", "noopener,noreferrer");
            }
          };

          if (isGif) {
            return (
              <div
                className="relative mt-2 cursor-pointer overflow-hidden rounded-lg"
                onClick={handleClick}
              >
                <img
                  src={external.uri}
                  alt={external.title || "GIF"}
                  className="w-full object-contain"
                  style={{ maxHeight: "400px" }}
                  loading="lazy"
                />
                <div className="absolute bottom-2 left-2 rounded bg-black/70 px-2 py-0.5 text-xs font-bold text-white">
                  GIF
                </div>
              </div>
            );
          }

          return (
            <div
              className="mt-2 cursor-pointer rounded-lg border p-2.5 transition-opacity hover:opacity-90"
              style={{ borderColor: "var(--asph-border-primary)" }}
              onClick={handleClick}
            >
              {external.thumb && (
                <img
                  src={proxifyBskyImage(external.thumb)}
                  alt=""
                  className="mb-2 h-auto w-full rounded object-cover"
                  style={{
                    maxHeight: "200px",
                    backgroundColor: "var(--asph-bg-tertiary)",
                  }}
                />
              )}
              <div
                className="text-sm font-semibold"
                style={{ color: "var(--asph-text-primary)" }}
              >
                {external.title}
              </div>
              <div
                className="mt-1 text-xs"
                style={{ color: "var(--asph-text-secondary)" }}
              >
                {external.description}
              </div>
            </div>
          );
        }

        if (embed.$type === "app.bsky.embed.video#view") {
          return (
            <div
              className="mt-2 overflow-hidden rounded-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <Suspense
                fallback={
                  <div
                    className="flex items-center justify-center bg-asph-bg-tertiary"
                    style={{
                      aspectRatio: embed.aspectRatio
                        ? `${embed.aspectRatio.width}/${embed.aspectRatio.height}`
                        : "16/9",
                    }}
                  >
                    <Spinner size="md" aria-label="Loading video" />
                  </div>
                }
              >
                <VideoPlayer
                  src={proxifyBskyVideo(embed.playlist) || ""}
                  thumbnail={
                    embed.thumbnail
                      ? proxifyBskyVideo(embed.thumbnail)
                      : undefined
                  }
                  aspectRatio={embed.aspectRatio}
                  alt={embed.alt}
                />
              </Suspense>
            </div>
          );
        }

        // Handle record embeds (quoted posts, starter packs, feeds, lists, labelers)
        if (embed.$type === "app.bsky.embed.record#view") {
          const recordData = embed.record;

          // Handle deleted, blocked, or detached
          if (
            recordData?.$type === "app.bsky.embed.record#viewNotFound" ||
            recordData?.$type === "app.bsky.embed.record#viewDetached"
          ) {
            return (
              <div
                className="mt-2 overflow-hidden rounded-lg border"
                style={{ borderColor: "var(--asph-border-primary)" }}
              >
                <div
                  className="flex items-center gap-2 px-3 py-1.5 text-xs"
                  style={{
                    backgroundColor: "var(--asph-bg-tertiary)",
                    borderBottom: `1px solid var(--asph-border-primary)`,
                    color: "var(--asph-text-secondary)",
                  }}
                >
                  <MessageCircle size={12} />
                  <span>Quoted post</span>
                </div>
                <div className="p-3">
                  <div
                    className="text-sm italic"
                    style={{ color: "var(--asph-text-secondary)" }}
                  >
                    Post not found or deleted
                  </div>
                </div>
              </div>
            );
          }
          if (recordData?.$type === "app.bsky.embed.record#viewBlocked") {
            return (
              <div
                className="mt-2 overflow-hidden rounded-lg border"
                style={{ borderColor: "var(--asph-border-primary)" }}
              >
                <div
                  className="flex items-center gap-2 px-3 py-1.5 text-xs"
                  style={{
                    backgroundColor: "var(--asph-bg-tertiary)",
                    borderBottom: `1px solid var(--asph-border-primary)`,
                    color: "var(--asph-text-secondary)",
                  }}
                >
                  <MessageCircle size={12} />
                  <span>Quoted post</span>
                </div>
                <div className="p-3">
                  <div
                    className="text-sm italic"
                    style={{ color: "var(--asph-text-secondary)" }}
                  >
                    Post from blocked user
                  </div>
                </div>
              </div>
            );
          }

          // Starter pack embed
          if (
            recordData?.$type === "app.bsky.graph.defs#starterPackViewBasic"
          ) {
            const starterPack = recordData as any;
            const packRecord = starterPack.record as any;
            const packName = packRecord?.name || "Starter Pack";
            const packDescription = packRecord?.description || "";
            return (
              <div
                className="mt-2 cursor-pointer overflow-hidden rounded-lg border transition-all hover:border-opacity-80"
                style={{ borderColor: "var(--asph-border-primary)" }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (starterPack.creator?.handle) {
                    const rkey = starterPack.uri?.split("/").pop();
                    if (rkey) {
                      window.open(
                        `https://bsky.app/starter-pack/${starterPack.creator.handle}/${rkey}`,
                        "_blank",
                        "noopener,noreferrer",
                      );
                    }
                  }
                }}
              >
                <div
                  className="flex items-center gap-2 px-3 py-1.5 text-xs"
                  style={{
                    backgroundColor: "var(--asph-bg-tertiary)",
                    borderBottom: `1px solid var(--asph-border-primary)`,
                    color: "var(--asph-text-secondary)",
                  }}
                >
                  <Users size={12} />
                  <span>Starter Pack</span>
                </div>
                <div className="p-3">
                  <div className="mb-1 flex items-center gap-2">
                    {starterPack.creator?.avatar && (
                      <img
                        src={
                          proxifyBskyImage(starterPack.creator.avatar) ||
                          "/default-avatar.svg"
                        }
                        alt=""
                        className="h-5 w-5 rounded-full"
                      />
                    )}
                    <span
                      className="text-sm font-semibold"
                      style={{ color: "var(--asph-text-primary)" }}
                    >
                      {packName}
                    </span>
                  </div>
                  {packDescription && (
                    <p
                      className="mt-1 line-clamp-2 text-sm"
                      style={{ color: "var(--asph-text-secondary)" }}
                    >
                      {packDescription}
                    </p>
                  )}
                  <div
                    className="mt-2 flex items-center gap-3 text-xs"
                    style={{ color: "var(--asph-text-tertiary)" }}
                  >
                    {starterPack.creator?.handle && (
                      <span>by @{starterPack.creator.handle}</span>
                    )}
                    {starterPack.listItemCount != null && (
                      <span>{starterPack.listItemCount} members</span>
                    )}
                    {starterPack.joinedAllTimeCount != null && (
                      <span>{starterPack.joinedAllTimeCount} joined</span>
                    )}
                  </div>
                </div>
              </div>
            );
          }

          // Feed generator embed
          if (recordData?.$type === "app.bsky.feed.defs#generatorView") {
            const feedGen = recordData as any;
            return (
              <div
                className="mt-2 cursor-pointer overflow-hidden rounded-lg border transition-all hover:border-opacity-80"
                style={{ borderColor: "var(--asph-border-primary)" }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (feedGen.creator?.handle) {
                    const rkey = feedGen.uri?.split("/").pop();
                    if (rkey) {
                      window.open(
                        `https://bsky.app/profile/${feedGen.creator.handle}/feed/${rkey}`,
                        "_blank",
                        "noopener,noreferrer",
                      );
                    }
                  }
                }}
              >
                <div
                  className="flex items-center gap-2 px-3 py-1.5 text-xs"
                  style={{
                    backgroundColor: "var(--asph-bg-tertiary)",
                    borderBottom: `1px solid var(--asph-border-primary)`,
                    color: "var(--asph-text-secondary)",
                  }}
                >
                  <Rss size={12} />
                  <span>Feed</span>
                </div>
                <div className="p-3">
                  <div className="flex items-center gap-2">
                    {feedGen.avatar && (
                      <img
                        src={proxifyBskyImage(feedGen.avatar)}
                        alt=""
                        className="h-8 w-8 rounded-lg"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <span
                        className="text-sm font-semibold"
                        style={{ color: "var(--asph-text-primary)" }}
                      >
                        {feedGen.displayName}
                      </span>
                      {feedGen.creator?.handle && (
                        <div
                          className="text-xs"
                          style={{ color: "var(--asph-text-tertiary)" }}
                        >
                          by @{feedGen.creator.handle}
                        </div>
                      )}
                    </div>
                  </div>
                  {feedGen.description && (
                    <p
                      className="mt-2 line-clamp-2 text-sm"
                      style={{ color: "var(--asph-text-secondary)" }}
                    >
                      {feedGen.description}
                    </p>
                  )}
                  {feedGen.likeCount != null && feedGen.likeCount > 0 && (
                    <div
                      className="mt-2 flex items-center gap-1 text-xs"
                      style={{ color: "var(--asph-text-tertiary)" }}
                    >
                      <Heart size={11} />
                      <span>{feedGen.likeCount}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          }

          // List embed
          if (recordData?.$type === "app.bsky.graph.defs#listView") {
            const listView = recordData as any;
            const purposeLabel =
              listView.purpose === "app.bsky.graph.defs#modlist"
                ? "Moderation List"
                : listView.purpose === "app.bsky.graph.defs#curatelist"
                  ? "User List"
                  : "List";
            return (
              <div
                className="mt-2 cursor-pointer overflow-hidden rounded-lg border transition-all hover:border-opacity-80"
                style={{ borderColor: "var(--asph-border-primary)" }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (listView.creator?.handle) {
                    const rkey = listView.uri?.split("/").pop();
                    if (rkey) {
                      window.open(
                        `https://bsky.app/profile/${listView.creator.handle}/lists/${rkey}`,
                        "_blank",
                        "noopener,noreferrer",
                      );
                    }
                  }
                }}
              >
                <div
                  className="flex items-center gap-2 px-3 py-1.5 text-xs"
                  style={{
                    backgroundColor: "var(--asph-bg-tertiary)",
                    borderBottom: `1px solid var(--asph-border-primary)`,
                    color: "var(--asph-text-secondary)",
                  }}
                >
                  <List size={12} />
                  <span>{purposeLabel}</span>
                </div>
                <div className="p-3">
                  <div className="flex items-center gap-2">
                    {listView.avatar && (
                      <img
                        src={proxifyBskyImage(listView.avatar)}
                        alt=""
                        className="h-8 w-8 rounded-lg"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <span
                        className="text-sm font-semibold"
                        style={{ color: "var(--asph-text-primary)" }}
                      >
                        {listView.name}
                      </span>
                      {listView.creator?.handle && (
                        <div
                          className="text-xs"
                          style={{ color: "var(--asph-text-tertiary)" }}
                        >
                          by @{listView.creator.handle}
                        </div>
                      )}
                    </div>
                  </div>
                  {listView.description && (
                    <p
                      className="mt-2 line-clamp-2 text-sm"
                      style={{ color: "var(--asph-text-secondary)" }}
                    >
                      {listView.description}
                    </p>
                  )}
                  {listView.listItemCount != null && (
                    <div
                      className="mt-2 text-xs"
                      style={{ color: "var(--asph-text-tertiary)" }}
                    >
                      {listView.listItemCount} members
                    </div>
                  )}
                </div>
              </div>
            );
          }

          // Labeler service embed
          if (recordData?.$type === "app.bsky.labeler.defs#labelerView") {
            const labeler = recordData as any;
            return (
              <div
                className="mt-2 cursor-pointer overflow-hidden rounded-lg border transition-all hover:border-opacity-80"
                style={{ borderColor: "var(--asph-border-primary)" }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (labeler.creator?.handle) {
                    window.open(
                      `https://bsky.app/profile/${labeler.creator.handle}`,
                      "_blank",
                      "noopener,noreferrer",
                    );
                  }
                }}
              >
                <div
                  className="flex items-center gap-2 px-3 py-1.5 text-xs"
                  style={{
                    backgroundColor: "var(--asph-bg-tertiary)",
                    borderBottom: `1px solid var(--asph-border-primary)`,
                    color: "var(--asph-text-secondary)",
                  }}
                >
                  <Shield size={12} />
                  <span>Labeler</span>
                </div>
                <div className="p-3">
                  <div className="flex items-center gap-2">
                    {labeler.creator?.avatar && (
                      <img
                        src={
                          proxifyBskyImage(labeler.creator.avatar) ||
                          "/default-avatar.svg"
                        }
                        alt=""
                        className="h-8 w-8 rounded-full"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <span
                        className="text-sm font-semibold"
                        style={{ color: "var(--asph-text-primary)" }}
                      >
                        {labeler.creator?.displayName ||
                          labeler.creator?.handle}
                      </span>
                      {labeler.creator?.handle && (
                        <div
                          className="text-xs"
                          style={{ color: "var(--asph-text-tertiary)" }}
                        >
                          @{labeler.creator.handle}
                        </div>
                      )}
                    </div>
                  </div>
                  {labeler.likeCount != null && labeler.likeCount > 0 && (
                    <div
                      className="mt-2 flex items-center gap-1 text-xs"
                      style={{ color: "var(--asph-text-tertiary)" }}
                    >
                      <Heart size={11} />
                      <span>{labeler.likeCount}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          }

          // Normal quoted post
          if (recordData?.$type === "app.bsky.embed.record#viewRecord") {
            const quotedPost = recordData;
            return (
              <div
                className="mt-2 overflow-hidden rounded-lg border transition-all hover:border-opacity-80"
                style={{ borderColor: "var(--asph-border-primary)" }}
              >
                {/* Quote post header */}
                <div
                  className="flex items-center gap-2 px-3 py-1.5 text-xs"
                  style={{
                    backgroundColor: "var(--asph-bg-tertiary)",
                    borderBottom: `1px solid var(--asph-border-primary)`,
                    color: "var(--asph-text-secondary)",
                  }}
                >
                  <MessageCircle size={12} />
                  <span>Quoted post</span>
                </div>

                {/* Quote post content */}
                <div
                  className="cursor-pointer p-3"
                  data-clickable="quote"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (quotedPost.uri && quotedPost.author) {
                      // Open the quoted post in thread modal
                      setSelectedPost({ uri: quotedPost.uri } as Post);
                      setOpenThreadToReply(false);
                      setShowThread(true);
                    }
                  }}
                >
                  <div className="mb-2 flex items-center gap-2">
                    {quotedPost.author?.handle && (
                      <ProfileHoverCard handle={quotedPost.author.handle}>
                        <img
                          src={
                            proxifyBskyImage(quotedPost.author.avatar) ||
                            "/default-avatar.svg"
                          }
                          alt={quotedPost.author?.handle || "unknown"}
                          className="h-5 w-5 cursor-pointer rounded-full transition-opacity hover:opacity-80"
                        />
                      </ProfileHoverCard>
                    )}
                    <div className="flex items-center gap-1 text-sm">
                      {quotedPost.author?.handle ? (
                        <ProfileHoverCard handle={quotedPost.author.handle}>
                          <span
                            className="cursor-pointer font-semibold hover:underline"
                            style={{ color: "var(--asph-text-primary)" }}
                          >
                            {quotedPost.author?.displayName ||
                              quotedPost.author?.handle}
                          </span>
                        </ProfileHoverCard>
                      ) : (
                        <span
                          className="font-semibold"
                          style={{ color: "var(--asph-text-primary)" }}
                        >
                          Unknown
                        </span>
                      )}
                      {quotedPost.author?.handle ? (
                        <ProfileHoverCard handle={quotedPost.author.handle}>
                          <span
                            className="cursor-pointer hover:underline"
                            style={{ color: "var(--asph-text-secondary)" }}
                          >
                            @{quotedPost.author?.handle || "unknown"}
                          </span>
                        </ProfileHoverCard>
                      ) : (
                        <span style={{ color: "var(--asph-text-secondary)" }}>
                          @{quotedPost.author?.handle || "unknown"}
                        </span>
                      )}
                    </div>
                  </div>
                  <div
                    className="text-sm"
                    style={{ color: "var(--asph-text-primary)" }}
                  >
                    <RichText
                      text={quotedPost.value?.text || ""}
                      facets={
                        quotedPost.value?.facets as Parameters<
                          typeof RichText
                        >[0]["facets"]
                      }
                    />
                  </div>
                  {quotedPost.embeds?.[0] &&
                    renderEmbed(quotedPost.embeds[0], postUri, postIndex)}
                </div>
              </div>
            );
          }
        }

        // Handle record with media (quote post + media)
        if (embed.$type === "app.bsky.embed.recordWithMedia#view") {
          return (
            <div className="mt-3">
              {embed.media && renderEmbed(embed.media, postUri, postIndex)}
              {embed.record && renderEmbed(embed.record, postUri, postIndex)}
            </div>
          );
        }

        return null;
      },
      [
        generatedAltTexts,
        generatingAltText,
        showAltText,
        handleGenerateAltText,
      ],
    );

    if (isLoading) {
      return (
        <div className="skeleton-stagger mx-auto max-w-2xl px-3 sm:px-4">
          <FeedSkeleton count={5} />
        </div>
      );
    }

    if (error) {
      return (
        <div className="p-8 text-center">
          <p style={{ color: "var(--asph-text-secondary)" }}>
            Failed to load feed
          </p>
          <p
            className="mt-2 text-sm"
            style={{ color: "var(--asph-text-tertiary)" }}
          >
            {error.message}
          </p>
        </div>
      );
    }

    // Feed change is now handled by parent component

    return (
      <div
        className="home-container relative w-full"
        ref={(el) => {
          if (el) {
            (
              containerRef as React.MutableRefObject<HTMLDivElement | null>
            ).current = el;
          }
        }}
        tabIndex={-1}
        style={{ outline: "none" }}
      >
        <NetworkWeatherLayer>
          <div
            className="mx-auto max-w-2xl px-3 sm:px-4"
            ref={postsContainerRef}
            style={{
              // Performance optimizations for mobile
              contain: "layout style paint",
            }}
          >
            <div
              className="divide-y divide-gray-100 dark:divide-gray-950"
              role="feed"
              aria-label="Posts"
            >
              {visibleItems.map((item, index) => (
                <div
                  key={`${item.post.uri}-page${item._pageIndex}-item${item._itemIndex}`}
                  className="content-enter"
                  style={
                    {
                      animationDelay: `${Math.min(index * 30, 300)}ms`,
                    } as React.CSSProperties
                  }
                >
                  <PostItem item={item} index={index} />
                </div>
              ))}
            </div>

            {isFetchingNextPage && (
              <div>
                <PostSkeleton compact aria-label="Loading more posts" />
                <PostSkeleton compact aria-label="Loading more posts" />
              </div>
            )}

            {/* Progressive loader sentinel */}
            {hasMore && (
              <div ref={progressiveLoadRef}>
                <PostSkeleton compact aria-label="Loading more posts" />
              </div>
            )}

            {/* Infinite scroll sentinel */}
            <div ref={loadMoreRef} className="h-20" />
          </div>
        </NetworkWeatherLayer>

        <Suspense fallback={null}>
          <FeedDiscovery
            isOpen={showFeedDiscovery}
            onClose={() => {
              if (onCloseFeedDiscovery) {
                onCloseFeedDiscovery();
              } else {
                setInternalShowFeedDiscovery(false);
              }
            }}
          />
        </Suspense>

        {galleryImages && (
          <Suspense
            fallback={
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
                <Spinner size="lg" aria-label="Loading gallery" />
              </div>
            }
          >
            <ImageGallery
              images={galleryImages}
              initialIndex={galleryIndex}
              onClose={() => {
                setGalleryImages(null);
                setGalleryIndex(0);
              }}
            />
          </Suspense>
        )}

        {showThread && selectedPost && (
          <Suspense
            fallback={
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                <div className="flex flex-col items-center gap-3 rounded-lg bg-asph-bg-secondary p-6 shadow-asph-lg">
                  <Spinner size="lg" aria-label="Loading thread" />
                  <p className="text-sm text-asph-text-secondary">
                    Loading thread...
                  </p>
                </div>
              </div>
            }
          >
            <ThreadModal
              postUri={selectedPost.uri}
              openToReply={openThreadToReply}
              openToQuote={openThreadToQuote}
              onClose={() => {
                setShowThread(false);
                setSelectedPost(null);
                setOpenThreadToReply(false);
                setOpenThreadToQuote(false);
              }}
            />
          </Suspense>
        )}
      </div>
    );
  },
);
