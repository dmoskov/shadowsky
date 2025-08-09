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
  Loader,
  MessageCircle,
  Repeat2,
  Reply,
  Star,
  TrendingUp,
  Users,
} from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  useFeatureTracking,
  useInteractionTracking,
} from "../hooks/useAnalytics";
import { useOptimisticPosts } from "../hooks/useOptimisticPosts";
import { columnFeedPrefs } from "../utils/cookies";
import { proxifyBskyImage, proxifyBskyVideo } from "../utils/image-proxy";
import { FeedDiscovery } from "./FeedDiscovery";
import { ImageGallery } from "./ImageGallery";
import { PostActionBar } from "./PostActionBar";
import { ThreadModal } from "./ThreadModal";
import { VideoPlayer } from "./VideoPlayer";

type FeedType =
  | "following"
  | "whats-hot"
  | "popular-with-friends"
  | "recent"
  | string; // Allow custom feed URIs

interface Post {
  uri: string;
  cid: string;
  author: {
    did: string;
    handle: string;
    displayName?: string;
    avatar?: string;
  };
  record: {
    text: string;
    createdAt: string;
    embed?: any;
  };
  embed?: any;
  replyCount: number;
  repostCount: number;
  likeCount: number;
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

interface HomeProps {
  initialFeedUri?: string;
  isFocused?: boolean;
  columnId?: string;
  onClose?: () => void;
  onFeedChange?: (feed: string, label: string, feedOptions: any[]) => void;
  onRefreshRequest?: number;
  showFeedDiscovery?: boolean;
  onCloseFeedDiscovery?: () => void;
}

export const Home: React.FC<HomeProps> = ({
  initialFeedUri,
  isFocused = true,
  columnId,
  onFeedChange,
  onRefreshRequest,
  showFeedDiscovery: externalShowFeedDiscovery,
  onCloseFeedDiscovery,
}) => {
  const { agent } = useAuth();
  const queryClient = useQueryClient();
  const { likeMutation, unlikeMutation, repostMutation, unrepostMutation } =
    useOptimisticPosts();
  // Removed hoveredPost state to prevent re-renders - using CSS hover instead
  // Use initialFeedUri if provided, otherwise get from column preferences
  const [selectedFeed, setSelectedFeed] = React.useState<FeedType>(() => {
    if (initialFeedUri) {
      return initialFeedUri as FeedType;
    }
    // Check cookie for this column
    if (columnId) {
      const savedFeed = columnFeedPrefs.getFeedForColumn(columnId);
      if (savedFeed) {
        return savedFeed as FeedType;
      }
    }
    // Default to following feed
    return "following";
  });

  // Update selectedFeed when initialFeedUri changes from parent
  React.useEffect(() => {
    if (initialFeedUri && initialFeedUri !== selectedFeed) {
      setSelectedFeed(initialFeedUri as FeedType);
      // Also save to column preferences
      if (columnId) {
        columnFeedPrefs.setFeedForColumn(columnId, initialFeedUri);
      }
    }
  }, [initialFeedUri, columnId]);
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
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [showThread, setShowThread] = useState(false);
  const [openThreadToReply, setOpenThreadToReply] = useState(false);
  const [focusedPostIndex, setFocusedPostIndex] = useState<number>(-1);
  const postsContainerRef = useRef<HTMLDivElement>(null);
  const [feedOrder, setFeedOrder] = useState<string[]>([]);
  // Removed showFeedDropdown - now handled by parent component
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef<{ [key: string]: number }>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const postRefs = useRef<{ [key: string]: HTMLDivElement }>({});
  // Removed dropdownRef - now handled by parent component
  const isKeyboardNavigationRef = useRef(false);

  const { trackFeatureAction } = useFeatureTracking("home_feed");
  const { trackClick } = useInteractionTracking();

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
    const savedFeeds: any[] = [];
    if (userPrefs?.savedFeeds && feedGenerators) {
      const pinnedFeeds = userPrefs.savedFeeds.filter(
        (feed) => feed.pinned && feed.type === "feed",
      );
      const unpinnedFeeds = userPrefs.savedFeeds.filter(
        (feed) => !feed.pinned && feed.type === "feed",
      );

      const addFeedOption = (savedFeed: any) => {
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

  // Dropdown is now handled by the parent component

  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["timeline", selectedFeed],
    queryFn: async ({ pageParam }: { pageParam?: string }) => {
      if (!agent) throw new Error("Not authenticated");

      let response;

      try {
        switch (selectedFeed) {
          case "following":
          case "recent":
            response = await agent.getTimeline({
              cursor: pageParam,
              limit: 30,
            });
            break;

          default:
            // Handle custom feed URIs
            if (selectedFeed.startsWith("at://")) {
              // Check if it's a list feed or a regular feed
              if (selectedFeed.includes("/app.bsky.graph.list/")) {
                // It's a list feed
                response = await agent.app.bsky.feed.getListFeed({
                  list: selectedFeed,
                  cursor: pageParam,
                  limit: 30,
                });
              } else {
                // It's a regular feed
                response = await agent.app.bsky.feed.getFeed({
                  feed: selectedFeed,
                  cursor: pageParam,
                  limit: 30,
                });
              }
            } else {
              // Handle known feed types
              switch (selectedFeed) {
                case "whats-hot":
                  response = await agent.app.bsky.feed.getFeed({
                    feed: "at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/whats-hot",
                    cursor: pageParam,
                    limit: 30,
                  });
                  break;

                case "popular-with-friends":
                  response = await agent.app.bsky.feed.getFeed({
                    feed: "at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/with-friends",
                    cursor: pageParam,
                    limit: 30,
                  });
                  break;

                default:
                  throw new Error(`Unknown feed type: ${selectedFeed}`);
              }
            }
        }
      } catch (error: any) {
        debug.error(`Failed to fetch feed ${selectedFeed}:`, error);

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
        } else if (error?.status >= 500) {
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
    enabled: !!agent,
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
    refetchOnMount: false, // Don't automatically refetch
  });

  const posts = React.useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((page, pageIndex) =>
      page.feed.map((item: any, itemIndex: number) => ({
        ...item,
        _pageIndex: pageIndex,
        _itemIndex: itemIndex,
      })),
    );
  }, [data]);

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
          className={`relative px-3 py-2.5 transition-colors duration-150 hover:bg-bsky-bg-hover ${
            item.reply?.parent || post.record?.reply?.parent
              ? "from-blue-500/3 border-l-4 border-blue-500 bg-gradient-to-r to-transparent"
              : ""
          } ${isFocused ? "bg-blue-500/3 outline outline-2 outline-offset-[-2px] outline-blue-500" : ""}`}
          data-post-uri={post.uri}
          tabIndex={isFocused ? 0 : -1}
          aria-selected={isFocused}
          role="article"
          onClick={() => {
            // Update focused index on click (not keyboard navigation)
            isKeyboardNavigationRef.current = false;
            setFocusedPostIndex(index);
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
              style={{ color: "var(--bsky-text-secondary)" }}
            >
              <Repeat2 size={12} />
              <span>
                {item.reason.by.displayName || item.reason.by.handle} reposted
              </span>
            </div>
          )}

          {/* Show reply context from feed item */}
          {item.reply?.parent && (
            <div className="relative">
              {/* Reply indicator with background */}
              <div className="hover:to-blue-500/8 mb-3 flex items-center gap-2 rounded-lg border border-blue-500/20 bg-gradient-to-br from-blue-500/10 to-blue-500/5 px-3 py-2 backdrop-blur-sm transition-all duration-300 hover:border-blue-500/30 hover:from-blue-500/15">
                <div className="flex items-center">
                  <div className="flex w-12 justify-center">
                    <div
                      className="h-6 w-0.5"
                      style={{ backgroundColor: "rgb(29, 155, 240)" }}
                    ></div>
                  </div>
                  <Reply
                    size={16}
                    className="mr-2"
                    style={{ color: "rgb(29, 155, 240)" }}
                  />
                </div>
                <div className="flex-1">
                  <span
                    className="text-sm font-medium"
                    style={{ color: "var(--bsky-text-primary)" }}
                  >
                    Replying to{" "}
                    <button
                      className="font-semibold hover:underline"
                      style={{ color: "rgb(29, 155, 240)" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        // Navigate to parent post
                        const parentPost = item.reply.parent;
                        if (parentPost) {
                          handlePostClick(parentPost);
                        }
                      }}
                    >
                      @{item.reply.parent.author?.handle || "unknown"}
                    </button>
                  </span>
                  {item.reply.parent.record?.text && (
                    <div
                      className="mt-0.5 line-clamp-1 text-xs"
                      style={{ color: "var(--bsky-text-secondary)" }}
                    >
                      "{item.reply.parent.record.text}"
                    </div>
                  )}
                </div>
              </div>
              {/* Connecting line from reply indicator to avatar */}
              <div
                className="absolute left-6 top-full h-3 w-0.5"
                style={{ backgroundColor: "rgba(29, 155, 240, 0.3)" }}
              ></div>
            </div>
          )}

          {/* Show reply context from post record if not in feed item */}
          {!item.reply?.parent && post.record?.reply?.parent && (
            <div className="relative">
              {/* Reply indicator with background */}
              <div className="hover:to-blue-500/8 mb-3 flex items-center gap-2 rounded-lg border border-blue-500/20 bg-gradient-to-br from-blue-500/10 to-blue-500/5 px-3 py-2 backdrop-blur-sm transition-all duration-300 hover:border-blue-500/30 hover:from-blue-500/15">
                <div className="flex items-center">
                  <div className="flex w-12 justify-center">
                    <div
                      className="h-6 w-0.5"
                      style={{ backgroundColor: "rgb(29, 155, 240)" }}
                    ></div>
                  </div>
                  <Reply
                    size={16}
                    className="mr-2"
                    style={{ color: "rgb(29, 155, 240)" }}
                  />
                </div>
                <span
                  className="text-sm font-medium"
                  style={{ color: "var(--bsky-text-primary)" }}
                >
                  This is a reply
                </span>
              </div>
              {/* Connecting line from reply indicator to avatar */}
              <div
                className="absolute left-6 top-full h-3 w-0.5"
                style={{ backgroundColor: "rgba(29, 155, 240, 0.3)" }}
              ></div>
            </div>
          )}

          <div className="flex gap-3">
            <img
              src={
                proxifyBskyImage(post.author.avatar) || "/default-avatar.svg"
              }
              alt={post.author.handle}
              className="h-12 w-12 rounded-full"
            />

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between">
                <div
                  className="cursor-pointer"
                  onClick={() => handlePostClick(post)}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="font-semibold"
                      style={{ color: "var(--bsky-text-primary)" }}
                    >
                      {post.author.displayName || post.author.handle}
                    </span>
                    {(item.reply?.parent || post.record?.reply?.parent) && (
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{
                          backgroundColor: "rgb(29, 155, 240)",
                          color: "white",
                        }}
                      >
                        REPLY
                      </span>
                    )}
                  </div>
                  <div
                    className="text-sm"
                    style={{ color: "var(--bsky-text-secondary)" }}
                  >
                    @{post.author.handle} ·{" "}
                    {formatDistanceToNow(new Date(post.record.createdAt), {
                      addSuffix: true,
                    })}
                  </div>
                </div>
              </div>

              <div
                className="mt-1 cursor-pointer whitespace-pre-wrap"
                style={{ color: "var(--bsky-text-primary)" }}
                onClick={() => handlePostClick(post)}
              >
                {post.record.text}
              </div>

              {renderEmbed(post.embed)}

              {/* Post Action Bar */}
              <PostActionBar
                post={post}
                onReply={() => {
                  // Open thread modal with reply focus
                  setSelectedPost(post);
                  setOpenThreadToReply(true);
                  setShowThread(true);
                }}
                onRepost={() => handleRepost(post)}
                onLike={() => handleLike(post)}
                showCounts={true}
                size="medium"
              />
            </div>
          </div>
        </div>
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

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  // Save scroll position on unmount
  useEffect(() => {
    const currentFeed = selectedFeed;
    return () => {
      // Save current scroll position when component unmounts
      if (currentFeed) {
        scrollPositionRef.current[currentFeed] = window.scrollY;
      }
    };
  }, [selectedFeed]);

  // Handler functions (must be defined before keyboard navigation useEffect)
  const handlePostClick = useCallback(
    (post: Post) => {
      trackClick("post", { postUri: post.uri });
      setSelectedPost(post);
      setOpenThreadToReply(false); // Reset when clicking on post normally
      setShowThread(true);
    },
    [trackClick],
  );

  // Mutations are handled by useOptimisticPosts hook

  const handleLike = async (post: Post, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!agent) return;

    trackFeatureAction("like_post", { postUri: post.uri });

    try {
      if (post.viewer?.like) {
        await unlikeMutation.mutateAsync({
          likeUri: post.viewer.like,
          postUri: post.uri,
        });
      } else {
        await likeMutation.mutateAsync({
          uri: post.uri,
          cid: post.cid,
        });
      }
    } catch (error) {
      debug.error("Failed to like/unlike post:", error);
    }
  };

  const handleRepost = async (post: Post, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!agent) return;

    trackFeatureAction("repost_post", { postUri: post.uri });

    try {
      if (post.viewer?.repost) {
        await unrepostMutation.mutateAsync({
          repostUri: post.viewer.repost,
          postUri: post.uri,
        });
      } else {
        await repostMutation.mutateAsync({
          uri: post.uri,
          cid: post.cid,
        });
      }
    } catch (error) {
      debug.error("Failed to repost:", error);
    }
  };

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

  const renderEmbed = (embed: any) => {
    if (!embed) return null;

    if (embed.$type === "app.bsky.embed.images#view") {
      const handleImageClick = (e: React.MouseEvent, index: number) => {
        e.stopPropagation();
        const images = embed.images.map((img: any) => ({
          thumb: proxifyBskyImage(img.thumb),
          fullsize: proxifyBskyImage(img.fullsize),
          alt: img.alt,
        }));
        setGalleryImages(images);
        setGalleryIndex(index);
        trackFeatureAction("image_gallery_opened", {
          imageCount: images.length,
        });
      };

      // Determine grid layout based on image count
      const gridClass =
        embed.images.length === 1
          ? "grid-cols-1"
          : embed.images.length === 2
            ? "grid-cols-2"
            : embed.images.length === 3
              ? "grid-cols-3"
              : "grid-cols-2";

      return (
        <div className={`mt-2 grid gap-1 ${gridClass}`}>
          {embed.images.map((img: any, idx: number) => {
            // Special layout for 3 images: first image takes 2/3, others 1/3 each
            const isThreeImageLayout = embed.images.length === 3;
            const colSpan =
              isThreeImageLayout && idx === 0 ? "col-span-2 row-span-2" : "";

            return (
              <div
                key={idx}
                className={`relative cursor-pointer overflow-hidden rounded-lg transition-opacity hover:opacity-95 ${colSpan}`}
                onClick={(e) => handleImageClick(e, idx)}
                style={{ backgroundColor: "var(--bsky-bg-tertiary)" }}
              >
                {/* Aspect ratio container */}
                <div
                  className="relative w-full"
                  style={{
                    paddingBottom:
                      isThreeImageLayout && idx === 0 ? "100%" : "75%",
                  }}
                >
                  <img
                    src={proxifyBskyImage(img.thumb)}
                    alt={img.alt || ""}
                    className="absolute inset-0 h-full w-full object-cover transition-opacity duration-300"
                    loading="lazy"
                    onLoad={(e) => {
                      // Fade in on load
                      const img = e.target as HTMLImageElement;
                      img.style.opacity = "1";
                    }}
                    style={{ opacity: 0 }}
                  />
                  {/* Loading state placeholder with blur effect */}
                  <div
                    className="absolute inset-0 animate-pulse bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900"
                    style={{ zIndex: -1, filter: "blur(20px)" }}
                  />
                </div>
                {img.alt && (
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-1.5 text-xs text-white opacity-0 transition-opacity hover:opacity-100">
                    ALT
                  </div>
                )}
              </div>
            );
          })}
        </div>
      );
    }

    if (embed.$type === "app.bsky.embed.external#view") {
      return (
        <div
          className="mt-2 cursor-pointer rounded-lg border p-2.5 transition-colors hover:bg-blue-500 hover:bg-opacity-5"
          style={{ borderColor: "var(--bsky-border-primary)" }}
          onClick={(e) => {
            e.stopPropagation();
            // Removed external link - only open links from ThreadViewer
          }}
        >
          {embed.external.thumb && (
            <img
              src={proxifyBskyImage(embed.external.thumb)}
              alt=""
              className="mb-2 h-auto w-full rounded object-cover"
              style={{
                maxHeight: "200px",
                backgroundColor: "var(--bsky-bg-tertiary)",
              }}
            />
          )}
          <div
            className="text-sm font-semibold"
            style={{ color: "var(--bsky-text-primary)" }}
          >
            {embed.external.title}
          </div>
          <div
            className="mt-1 text-xs"
            style={{ color: "var(--bsky-text-secondary)" }}
          >
            {embed.external.description}
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
          <VideoPlayer
            src={proxifyBskyVideo(embed.playlist) || ""}
            thumbnail={
              embed.thumbnail ? proxifyBskyVideo(embed.thumbnail) : undefined
            }
            aspectRatio={embed.aspectRatio}
            alt={embed.alt}
          />
        </div>
      );
    }

    // Handle quote posts
    if (embed.$type === "app.bsky.embed.record#view") {
      const quotedPost = embed.record;
      if (quotedPost?.$type === "app.bsky.embed.record#viewRecord") {
        return (
          <div
            className="mt-2 overflow-hidden rounded-lg border transition-all hover:border-opacity-80"
            style={{ borderColor: "var(--bsky-border-primary)" }}
          >
            {/* Quote post header */}
            <div
              className="flex items-center gap-2 px-3 py-1.5 text-xs"
              style={{
                backgroundColor: "var(--bsky-bg-tertiary)",
                borderBottom: `1px solid var(--bsky-border-primary)`,
                color: "var(--bsky-text-secondary)",
              }}
            >
              <MessageCircle size={12} />
              <span>Quoted post</span>
            </div>

            {/* Quote post content */}
            <div
              className="cursor-pointer p-3 transition-colors hover:bg-blue-500 hover:bg-opacity-5"
              onClick={(e) => {
                e.stopPropagation();
                if ("author" in quotedPost && "record" in quotedPost) {
                  handlePostClick(quotedPost as Post);
                }
              }}
            >
              <div className="mb-2 flex items-center gap-2">
                <img
                  src={
                    proxifyBskyImage(quotedPost.author.avatar) ||
                    "/default-avatar.svg"
                  }
                  alt={quotedPost.author?.handle || "unknown"}
                  className="h-5 w-5 rounded-full"
                />
                <div className="flex items-center gap-1 text-sm">
                  <span
                    className="font-semibold"
                    style={{ color: "var(--bsky-text-primary)" }}
                  >
                    {quotedPost.author?.displayName ||
                      quotedPost.author?.handle ||
                      "Unknown"}
                  </span>
                  <span style={{ color: "var(--bsky-text-secondary)" }}>
                    @{quotedPost.author?.handle || "unknown"}
                  </span>
                </div>
              </div>
              <div
                className="text-sm"
                style={{ color: "var(--bsky-text-primary)" }}
              >
                {quotedPost.value.text}
              </div>
              {quotedPost.embeds?.[0] && renderEmbed(quotedPost.embeds[0])}
            </div>
          </div>
        );
      }
      // Handle deleted or blocked quotes
      if (quotedPost?.$type === "app.bsky.embed.record#viewNotFound") {
        return (
          <div
            className="mt-2 overflow-hidden rounded-lg border"
            style={{ borderColor: "var(--bsky-border-primary)" }}
          >
            <div
              className="flex items-center gap-2 px-3 py-1.5 text-xs"
              style={{
                backgroundColor: "var(--bsky-bg-tertiary)",
                borderBottom: `1px solid var(--bsky-border-primary)`,
                color: "var(--bsky-text-secondary)",
              }}
            >
              <MessageCircle size={12} />
              <span>Quoted post</span>
            </div>
            <div className="p-3">
              <div
                className="text-sm italic"
                style={{ color: "var(--bsky-text-secondary)" }}
              >
                Post not found or deleted
              </div>
            </div>
          </div>
        );
      }
      if (quotedPost?.$type === "app.bsky.embed.record#viewBlocked") {
        return (
          <div
            className="mt-2 overflow-hidden rounded-lg border"
            style={{ borderColor: "var(--bsky-border-primary)" }}
          >
            <div
              className="flex items-center gap-2 px-3 py-1.5 text-xs"
              style={{
                backgroundColor: "var(--bsky-bg-tertiary)",
                borderBottom: `1px solid var(--bsky-border-primary)`,
                color: "var(--bsky-text-secondary)",
              }}
            >
              <MessageCircle size={12} />
              <span>Quoted post</span>
            </div>
            <div className="p-3">
              <div
                className="text-sm italic"
                style={{ color: "var(--bsky-text-secondary)" }}
              >
                Post from blocked user
              </div>
            </div>
          </div>
        );
      }
    }

    // Handle record with media (quote post + media)
    if (embed.$type === "app.bsky.embed.recordWithMedia#view") {
      return (
        <div className="mt-3">
          {embed.media && renderEmbed(embed.media)}
          {embed.record && renderEmbed(embed.record)}
        </div>
      );
    }

    return null;
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader
          className="animate-spin"
          size={32}
          style={{ color: "var(--bsky-primary)" }}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p style={{ color: "var(--bsky-text-secondary)" }}>
          Failed to load feed
        </p>
        <p
          className="mt-2 text-sm"
          style={{ color: "var(--bsky-text-tertiary)" }}
        >
          {error.message}
        </p>
      </div>
    );
  }

  // Feed change is now handled by parent component

  return (
    <div
      className="w-full"
      ref={containerRef}
      tabIndex={-1}
      style={{ outline: "none" }}
    >
      <div className="mx-auto max-w-2xl px-3 sm:px-4" ref={postsContainerRef}>
        <div
          className="divide-y divide-gray-100 dark:divide-gray-950"
          role="feed"
          aria-label="Posts"
        >
          {posts.map((item: any, index: number) => (
            <PostItem
              key={`${item.post.uri}-page${item._pageIndex}-item${item._itemIndex}`}
              item={item}
              index={index}
            />
          ))}
        </div>

        {isFetchingNextPage && (
          <div className="flex items-center justify-center p-8">
            <Loader
              className="animate-spin"
              size={24}
              style={{ color: "var(--bsky-primary)" }}
            />
          </div>
        )}

        <div ref={loadMoreRef} className="h-20" />
      </div>

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

      {galleryImages && (
        <ImageGallery
          images={galleryImages}
          initialIndex={galleryIndex}
          onClose={() => {
            setGalleryImages(null);
            setGalleryIndex(0);
          }}
        />
      )}

      {showThread && selectedPost && (
        <ThreadModal
          postUri={selectedPost.uri}
          openToReply={openThreadToReply}
          onClose={() => {
            setShowThread(false);
            setSelectedPost(null);
            setOpenThreadToReply(false);
          }}
        />
      )}
    </div>
  );
};
