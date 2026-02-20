import {
  AppBskyActorDefs,
  AppBskyFeedDefs,
  RichText as BskyRichText,
} from "@atproto/api";
import { getProfileService } from "@bsky/shared";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  BadgeCheck,
  Calendar,
  ChevronDown,
  ChevronUp,
  Edit,
  ExternalLink,
  Flag,
  Heart,
  List as ListIcon,
  MessageCircle,
  MoreHorizontal,
  Pin,
  Repeat2,
  Rss,
  Share2,
  Sparkles,
  TrendingUp,
  UserX,
  Users,
  VolumeX,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { List, ListImperativeAPI, useDynamicRowHeight } from "react-window";
import { AddToListModal } from "../components/AddToListModal";
import { PostCard } from "../components/PostCard";
import { ReportModal } from "../components/ReportModal";
import { ThreadModal } from "../components/ThreadModal";
import { DomainVerifiedBadge } from "../components/ui/DomainVerifiedBadge";
import { EmptyState } from "../components/ui/EmptyState";
import { LabelBadge } from "../components/ui/LabelBadge";
import { RichText } from "../components/ui/RichText";
import { ProfileSkeleton } from "../components/ui/SkeletonLoader";
import { UserListModal } from "../components/UserListModal";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { useOptimisticPosts } from "../hooks/useOptimisticPosts";
import { useTopPosts } from "../hooks/useTopPosts";
import { analyzePosts } from "../services/anthropic";
import { getFollowerCacheDB } from "../services/follower-cache-db";
import { moderationHistoryDB } from "../services/moderation-history-db";
import { shareProfile } from "../services/share-service";
import { proxifyBskyImage } from "../utils/image-proxy";

const formatCount = (count: number): string => {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  } else if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
};

interface ProfileData {
  did: string;
  handle: string;
  displayName?: string;
  description?: string;
  avatar?: string;
  banner?: string;
  followersCount?: number;
  followsCount?: number;
  postsCount?: number;
  createdAt?: string;
  indexedAt?: string;
  labels?: AppBskyActorDefs.ProfileViewDetailed["labels"];
  associated?: AppBskyActorDefs.ProfileAssociated;
  pinnedPost?: { uri: string; cid: string };
  verification?: AppBskyActorDefs.VerificationState;
  viewer?: {
    following?: string;
    followedBy?: string;
    muted?: boolean;
    blockedBy?: boolean;
    blocking?: string;
    knownFollowers?: AppBskyActorDefs.KnownFollowers;
  };
}

type ProfileTab = "posts" | "replies" | "media" | "likes" | "top";

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
};

// Store scroll positions for each profile/tab combination
const scrollPositions = new Map<string, number>();

export default function ProfilePage() {
  const { handle } = useParams<{ handle: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { session, agent } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  // Get active tab from URL, default to "posts"
  const tabParam = searchParams.get("tab");
  const activeTab: ProfileTab =
    tabParam === "replies" ||
    tabParam === "media" ||
    tabParam === "likes" ||
    tabParam === "top"
      ? tabParam
      : "posts";

  const setActiveTab = (tab: ProfileTab) => {
    setSearchParams(tab === "posts" ? {} : { tab }, { replace: true });
  };
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [profileMenuPosition, setProfileMenuPosition] = useState<{
    top: number;
    right: number;
  } | null>(null);
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [showFollowingModal, setShowFollowingModal] = useState(false);
  const [selectedPost, setSelectedPost] =
    useState<AppBskyFeedDefs.PostView | null>(null);
  const [showThread, setShowThread] = useState(false);
  const [openThreadToReply, setOpenThreadToReply] = useState(false);
  const [openThreadToQuote, setOpenThreadToQuote] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showAddToListModal, setShowAddToListModal] = useState(false);
  const [analysisRequested, setAnalysisRequested] = useState(false);

  const profileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<ListImperativeAPI>(null);
  const [listHeight, setListHeight] = useState(600);
  const [shouldRestoreScroll, setShouldRestoreScroll] = useState(false);

  const cacheKey = `profile-${handle}-${activeTab}`;

  const dynamicRowHeight = useDynamicRowHeight({
    defaultRowHeight: 200,
    key: cacheKey,
  });

  const { likeMutation, unlikeMutation, repostMutation, unrepostMutation } =
    useOptimisticPosts();

  // Fetch profile data via React Query for request deduplication
  // Uses the same ["profile", handle] key as prefetch hooks and hover cards
  const {
    data: profile,
    isLoading: loading,
    error: profileError,
  } = useQuery({
    queryKey: ["profile", handle],
    queryFn: async () => {
      if (!agent || !handle) throw new Error("Missing agent or handle");
      const profileService = getProfileService(agent);
      const profileRes = await profileService.getProfile(handle);
      if (!profileRes) throw new Error("Profile not found");

      // Update IndexedDB cache in background
      getFollowerCacheDB().then((db) =>
        db.saveProfiles([
          {
            did: profileRes.did,
            handle: profileRes.handle,
            displayName: profileRes.displayName,
            avatar: profileRes.avatar,
            description: profileRes.description,
            banner: profileRes.banner,
            followersCount: profileRes.followersCount || 0,
            followingCount: profileRes.followsCount || 0,
            followsCount: profileRes.followsCount || 0,
            postsCount: profileRes.postsCount || 0,
            viewer: profileRes.viewer,
            createdAt: profileRes.createdAt,
            lastFetched: new Date(),
          },
        ]),
      );

      return {
        ...profileRes,
        pinnedPost: profileRes.pinnedPost
          ? {
              uri: profileRes.pinnedPost.uri,
              cid: profileRes.pinnedPost.cid,
            }
          : undefined,
      } as ProfileData;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - reuses prefetched/hover card data
    gcTime: 30 * 60 * 1000,
    enabled: !!agent && !!handle,
    // Use IndexedDB cached profile as placeholder while fetching
    placeholderData: () => {
      // Check React Query cache first (from prefetch or hover card)
      const cached = queryClient.getQueryData<ProfileData>(["profile", handle]);
      return cached || undefined;
    },
  });

  const error = profileError ? "Failed to load profile" : null;

  // Helper to locally update the profile in the query cache
  const setProfile = useCallback(
    (updater: ProfileData | ((prev: ProfileData) => ProfileData)) => {
      queryClient.setQueryData<ProfileData>(
        ["profile", handle],
        (old: ProfileData | undefined) => {
          if (!old) return old;
          return typeof updater === "function" ? updater(old) : updater;
        },
      );
    },
    [queryClient, handle],
  );

  // Fetch posts via useInfiniteQuery for request deduplication
  const postsFilter =
    activeTab === "replies"
      ? "posts_with_replies"
      : activeTab === "media"
        ? "posts_with_media"
        : "posts_no_replies";

  const {
    data: postsData,
    isLoading: postsLoading,
    fetchNextPage,
    hasNextPage: hasMore,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: [
      "author-feed",
      handle,
      activeTab === "likes" ? "likes" : postsFilter,
    ],
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
      if (!agent || !handle) throw new Error("Missing agent or handle");

      if (activeTab === "likes") {
        const response = await agent.getActorLikes({
          actor: handle,
          limit: 30,
          cursor: pageParam,
        });
        return {
          feed: response.data.feed as AppBskyFeedDefs.FeedViewPost[],
          cursor: response.data.cursor as string | undefined,
        };
      } else {
        const profileService = getProfileService(agent);
        const response = await profileService.getAuthorFeed(
          handle,
          30,
          pageParam,
          postsFilter,
        );
        return {
          feed: (response?.feed || []) as AppBskyFeedDefs.FeedViewPost[],
          cursor: response?.cursor as string | undefined,
        };
      }
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.cursor || undefined,
    staleTime: 2 * 60 * 1000, // 2 minutes
    enabled: !!agent && !!handle && activeTab !== "top",
  });

  // Flatten paginated posts for rendering
  const posts = useMemo(
    () => postsData?.pages.flatMap((page) => page.feed) || [],
    [postsData],
  );

  // Transform posts already in memory for quick haiku analysis
  const postsInMemory = posts
    .filter((item) => {
      const isRepost = item.reason?.$type === "app.bsky.feed.defs#reasonRepost";
      return !isRepost;
    })
    .map((item) => ({
      text: (item.post.record as { text?: string })?.text || "",
      createdAt: item.post.indexedAt,
      likes: item.post.likeCount || 0,
      reposts: item.post.repostCount || 0,
      replies: item.post.replyCount || 0,
    }));

  // Quick haiku analysis using posts already in memory (instant start)
  const {
    data: haikuAnalysis,
    isLoading: isLoadingHaiku,
    error: haikuError,
  } = useQuery({
    queryKey: ["profile-analysis-haiku", handle],
    queryFn: async () => {
      if (postsInMemory.length === 0) throw new Error("No posts in memory");
      return await analyzePosts(postsInMemory, "haiku");
    },
    staleTime: 30 * 60 * 1000,
    enabled: analysisRequested && postsInMemory.length > 0,
  });

  // Fetch more posts for deeper Sonnet analysis (in parallel)
  const { data: postsForSonnet, isLoading: isLoadingPostsForSonnet } = useQuery(
    {
      queryKey: ["profile-posts-for-sonnet", handle],
      queryFn: async () => {
        if (!agent || !handle) throw new Error("No handle to analyze");

        const allPosts: AppBskyFeedDefs.FeedViewPost[] = [];
        let fetchCursor: string | undefined;
        const maxPages = 4; // Fetch up to 200 posts for deeper analysis

        for (let page = 0; page < maxPages; page++) {
          const response = await agent.getAuthorFeed({
            actor: handle,
            limit: 50,
            cursor: fetchCursor,
          });

          const filteredPosts = response.data.feed.filter((item) => {
            const isRepost =
              item.reason?.$type === "app.bsky.feed.defs#reasonRepost";
            return !isRepost;
          });

          allPosts.push(...filteredPosts);
          fetchCursor = response.data.cursor;
          if (!fetchCursor) break;
        }

        if (allPosts.length === 0) {
          throw new Error("No posts available for analysis");
        }

        return allPosts.map((item) => ({
          text: (item.post.record as { text?: string })?.text || "",
          createdAt: item.post.indexedAt,
          likes: item.post.likeCount || 0,
          reposts: item.post.repostCount || 0,
          replies: item.post.replyCount || 0,
        }));
      },
      staleTime: 30 * 60 * 1000,
      enabled: analysisRequested && !!handle && !!agent,
    },
  );

  // Full sonnet analysis with more posts (detailed)
  const {
    data: sonnetAnalysis,
    isLoading: isLoadingSonnet,
    error: sonnetError,
  } = useQuery({
    queryKey: ["profile-analysis-sonnet", handle],
    queryFn: async () => {
      if (!postsForSonnet) throw new Error("Posts not loaded");
      return await analyzePosts(postsForSonnet, "sonnet");
    },
    staleTime: 30 * 60 * 1000,
    enabled: !!postsForSonnet,
  });

  // Use haiku if available, then upgrade to sonnet when ready
  const analysisData = sonnetAnalysis || haikuAnalysis;
  const isLoadingAnalysis =
    (isLoadingHaiku && !haikuAnalysis) ||
    (isLoadingPostsForSonnet && isLoadingSonnet && !haikuAnalysis);
  // Show error if both haiku and sonnet fail (or sonnet fails after haiku succeeds)
  const analysisError = sonnetError || haikuError;

  // Pinned post
  const { data: pinnedPostData } = useQuery({
    queryKey: ["pinned-post", profile?.pinnedPost?.uri],
    queryFn: async () => {
      if (!agent || !profile?.pinnedPost) return null;
      const response = await agent.getPosts({
        uris: [profile.pinnedPost.uri],
      });
      return response.data.posts[0] || null;
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!agent && !!profile?.pinnedPost?.uri,
  });

  // Bio rich text facets
  const { data: bioFacets } = useQuery({
    queryKey: ["bio-facets", profile?.did, profile?.description],
    queryFn: async () => {
      if (!agent || !profile?.description) return null;
      const rt = new BskyRichText({ text: profile.description });
      await rt.detectFacets(agent);
      return rt.facets || null;
    },
    staleTime: 10 * 60 * 1000,
    enabled: !!agent && !!profile?.description,
  });

  // Top posts - always fetched for showcase and tab
  const { data: topPostsData, isLoading: isTopPostsLoading } = useTopPosts({
    handle: handle || "",
    limit: 10,
    enabled: !!handle,
  });

  // Showcase state for top posts and AI analysis
  const [showTopPostsShowcase, setShowTopPostsShowcase] = useState(true);
  const [aiInsightsExpanded, setAiInsightsExpanded] = useState(false);

  // Auto-trigger AI analysis when profile loads (for inline insights)
  useEffect(() => {
    if (profile && !analysisRequested && posts.length > 0) {
      setAnalysisRequested(true);
    }
  }, [profile, posts.length, analysisRequested]);

  // Measure container height for virtual list
  useEffect(() => {
    if (!listContainerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // Calculate height based on viewport minus header offset
        const viewportHeight = window.innerHeight;
        const containerRect = entry.target.getBoundingClientRect();
        const calculatedHeight = Math.max(
          400,
          viewportHeight - containerRect.top - 16,
        );
        setListHeight(calculatedHeight);
      }
    });

    resizeObserver.observe(listContainerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Restore scroll position when posts are loaded
  useEffect(() => {
    if (
      shouldRestoreScroll &&
      cacheKey &&
      posts.length > 0 &&
      scrollPositions.has(cacheKey) &&
      listRef.current
    ) {
      const savedPosition = scrollPositions.get(cacheKey)!;
      setTimeout(() => {
        if (listRef.current) {
          listRef.current.scrollToRow({
            index: 0,
            behavior: "auto",
          });
          const element = listRef.current.element;
          if (element) {
            element.scrollTop = savedPosition;
          }
        }
      }, 0);
      setShouldRestoreScroll(false);
    }
  }, [cacheKey, posts.length, shouldRestoreScroll]);

  // Mark that we should restore scroll on mount
  useEffect(() => {
    if (cacheKey && scrollPositions.has(cacheKey)) {
      setShouldRestoreScroll(true);
    }
  }, [cacheKey]);

  // Save scroll position when unmounting or changing tabs
  useEffect(() => {
    return () => {
      if (cacheKey && listRef.current) {
        const element = listRef.current.element;
        if (element) {
          scrollPositions.set(cacheKey, element.scrollTop);
        }
      }
    };
  }, [cacheKey]);

  // Handle scroll for infinite loading
  const handleRowsRendered = useCallback(
    (
      visibleRows: { startIndex: number; stopIndex: number },
      _allRows: { startIndex: number; stopIndex: number },
    ) => {
      if (!hasMore || postsLoading || isFetchingNextPage || posts.length === 0)
        return;

      // Trigger load at 80% scroll position
      const scrollPercentage = visibleRows.stopIndex / posts.length;
      if (scrollPercentage >= 0.8) {
        fetchNextPage();
      }
    },
    [hasMore, postsLoading, isFetchingNextPage, posts.length, fetchNextPage],
  );

  const handleFollow = async () => {
    if (!profile || !agent) return;

    try {
      const profileService = getProfileService(agent);
      if (profile.viewer?.following) {
        await profileService.unfollow(profile.viewer.following);
        setProfile({
          ...profile,
          viewer: { ...profile.viewer, following: undefined },
          followersCount: (profile.followersCount || 0) - 1,
        });
        showToast(`Unfollowed @${profile.handle}`, {
          type: "success",
          duration: 3000,
        });
      } else {
        const uri = await profileService.follow(profile.did);
        setProfile({
          ...profile,
          viewer: { ...profile.viewer, following: uri },
          followersCount: (profile.followersCount || 0) + 1,
        });
        showToast(`Following @${profile.handle}`, {
          type: "success",
          duration: 3000,
        });
      }
    } catch (err) {
      console.error("Error toggling follow:", err);
      showToast("Failed to update follow status", { type: "error" });
    }
  };

  if (loading) {
    return (
      <div className="skeleton-stagger">
        <ProfileSkeleton />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="p-4 text-center">
        <p className="text-red-500">{error || "Profile not found"}</p>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 text-blue-500 hover:underline"
        >
          Go back
        </button>
      </div>
    );
  }

  const isOwnProfile = session?.handle === profile.handle;

  const handleLike = async (post: AppBskyFeedDefs.PostView) => {
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
  };

  const handleRepost = async (post: AppBskyFeedDefs.PostView) => {
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
  };

  const handleShare = async () => {
    if (!profile) return;

    const result = await shareProfile(
      profile.handle,
      profile.displayName,
      profile.description,
    );

    if (result.success) {
      if (result.method === "clipboard") {
        showToast("Profile link copied to clipboard", {
          type: "success",
          duration: 2000,
        });
      }
      // Native share doesn't need a toast - the OS handles feedback
    } else if (result.error !== "Share cancelled") {
      showToast("Failed to share profile", { type: "error" });
    }
    setShowProfileMenu(false);
  };

  const handleOpenInBluesky = () => {
    if (!profile) return;
    const profileUrl = `https://bsky.app/profile/${profile.handle}`;
    window.open(profileUrl, "_blank", "noopener,noreferrer");
    setShowProfileMenu(false);
  };

  const handleBlock = async () => {
    if (!profile || !agent) return;
    try {
      const profileService = getProfileService(agent);
      if (profile.viewer?.blocking) {
        await profileService.unblock(profile.viewer.blocking);

        // Record unblock to history
        try {
          await moderationHistoryDB.init();
          await moderationHistoryDB.recordUnblock(profile.viewer.blocking);
        } catch (historyErr) {
          console.warn("Failed to record unblock to history:", historyErr);
        }

        setProfile({
          ...profile,
          viewer: { ...profile.viewer, blocking: undefined },
        });
        showToast(`Unblocked @${profile.handle}`, {
          type: "success",
          duration: 3000,
        });
      } else {
        const uri = await profileService.block(profile.did);

        // Record block to history
        try {
          await moderationHistoryDB.init();
          await moderationHistoryDB.recordBlock({
            id: uri,
            subjectDid: profile.did,
            subjectHandle: profile.handle,
            subjectDisplayName: profile.displayName,
            subjectAvatar: profile.avatar,
            createdAt: Date.now(),
          });
        } catch (historyErr) {
          console.warn("Failed to record block to history:", historyErr);
        }

        setProfile({
          ...profile,
          viewer: { ...profile.viewer, blocking: uri },
        });
        showToast(`Blocked @${profile.handle}`, {
          type: "success",
          duration: 3000,
        });
      }
    } catch (err) {
      console.error("Error toggling block:", err);
      showToast("Failed to update block status", { type: "error" });
    }
    setShowProfileMenu(false);
  };

  const handleMute = async () => {
    if (!profile || !agent) return;
    try {
      const profileService = getProfileService(agent);
      if (profile.viewer?.muted) {
        await profileService.unmute(profile.did);

        // Record unmute to history
        try {
          await moderationHistoryDB.init();
          await moderationHistoryDB.recordUnmute(profile.did);
        } catch (historyErr) {
          console.warn("Failed to record unmute to history:", historyErr);
        }

        setProfile({
          ...profile,
          viewer: { ...profile.viewer, muted: false },
        });
        showToast(`Unmuted @${profile.handle}`, {
          type: "success",
          duration: 3000,
        });
      } else {
        await profileService.mute(profile.did);

        // Record mute to history
        try {
          await moderationHistoryDB.init();
          await moderationHistoryDB.recordMute({
            subjectDid: profile.did,
            subjectHandle: profile.handle,
            subjectDisplayName: profile.displayName,
            subjectAvatar: profile.avatar,
            createdAt: Date.now(),
          });
        } catch (historyErr) {
          console.warn("Failed to record mute to history:", historyErr);
        }

        setProfile({
          ...profile,
          viewer: { ...profile.viewer, muted: true },
        });
        showToast(`Muted @${profile.handle}`, {
          type: "success",
          duration: 3000,
        });
      }
    } catch (err) {
      console.error("Error toggling mute:", err);
      showToast("Failed to update mute status", { type: "error" });
    }
    setShowProfileMenu(false);
  };

  const handleOpenReportModal = () => {
    setShowProfileMenu(false);
    setShowReportModal(true);
  };

  const handleOpenAddToListModal = () => {
    setShowProfileMenu(false);
    setShowAddToListModal(true);
  };

  return (
    <div className="mx-auto w-full max-w-4xl">
      {/* Profile Header */}
      <div className="relative overflow-hidden rounded-xl">
        {/* Banner */}
        <div
          className="h-48 bg-gradient-to-br"
          style={{
            backgroundImage:
              "linear-gradient(135deg, var(--asph-primary) 0%, var(--asph-accent) 100%)",
          }}
        >
          {profile.banner && (
            <img
              src={proxifyBskyImage(profile.banner)}
              alt="Profile banner"
              className="h-full w-full object-cover"
            />
          )}
        </div>

        {/* Profile Info */}
        <div className="asph-card border-0 px-6 pb-6">
          <div className="-mt-20 mb-4 flex items-end justify-between">
            <img
              src={
                profile.avatar
                  ? proxifyBskyImage(profile.avatar)
                  : "/default-avatar.svg"
              }
              alt={profile.displayName || profile.handle}
              className="h-36 w-36 rounded-full border-4 shadow-lg transition-transform hover:scale-105"
              style={{
                borderColor: "var(--asph-bg-secondary)",
                backgroundColor: "var(--asph-bg-tertiary)",
              }}
            />
            <div className="flex items-center gap-2">
              {!isOwnProfile && (
                <button
                  onClick={handleFollow}
                  className={`rounded-full px-6 py-2.5 font-medium transition-all ${
                    profile.viewer?.following
                      ? "asph-button-secondary hover:scale-105"
                      : "asph-button-primary hover:scale-105"
                  }`}
                >
                  {profile.viewer?.following ? "Following" : "Follow"}
                </button>
              )}
              <div className="relative">
                <button
                  ref={profileMenuButtonRef}
                  onClick={() => {
                    if (!showProfileMenu && profileMenuButtonRef.current) {
                      const rect =
                        profileMenuButtonRef.current.getBoundingClientRect();
                      setProfileMenuPosition({
                        top: rect.bottom + 8,
                        right: window.innerWidth - rect.right,
                      });
                    }
                    setShowProfileMenu(!showProfileMenu);
                  }}
                  className="rounded-full p-2 transition-all hover:scale-110"
                  style={{
                    color: "var(--asph-text-secondary)",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor =
                      "var(--asph-bg-hover)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = "transparent")
                  }
                >
                  <MoreHorizontal className="h-5 w-5" />
                </button>
                {showProfileMenu &&
                  profileMenuPosition &&
                  ReactDOM.createPortal(
                    <div
                      ref={profileMenuRef}
                      className="fixed z-[9999] w-48 rounded-lg border py-2 shadow-lg"
                      style={{
                        backgroundColor: "var(--asph-bg-secondary)",
                        borderColor: "var(--asph-border-primary)",
                        boxShadow: "var(--asph-shadow-lg)",
                        top: `${profileMenuPosition.top}px`,
                        right: `${profileMenuPosition.right}px`,
                      }}
                    >
                      {isOwnProfile ? (
                        <>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setShowProfileMenu(false);
                              navigate("/settings/account");
                            }}
                            className="flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm transition-all"
                            style={{ color: "var(--asph-text-primary)" }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.backgroundColor =
                                "var(--asph-bg-hover)")
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.backgroundColor =
                                "transparent")
                            }
                          >
                            <Edit className="h-4 w-4" />
                            Edit Profile
                          </button>
                          <button
                            onClick={() => {
                              setShowProfileMenu(false);
                              setAnalysisRequested(true);
                              setAiInsightsExpanded(true);
                            }}
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-all"
                            style={{ color: "var(--asph-text-primary)" }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.backgroundColor =
                                "var(--asph-bg-hover)")
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.backgroundColor =
                                "transparent")
                            }
                          >
                            <Sparkles className="h-4 w-4" />
                            Analyze Profile
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={handleShare}
                            className="flex w-full items-center gap-3 rounded-t-lg px-4 py-2.5 text-sm transition-all"
                            style={{ color: "var(--asph-text-primary)" }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.backgroundColor =
                                "var(--asph-bg-hover)")
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.backgroundColor =
                                "transparent")
                            }
                          >
                            <Share2 className="h-4 w-4" />
                            Share Profile
                          </button>
                          <button
                            onClick={handleOpenInBluesky}
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-all"
                            style={{ color: "var(--asph-text-primary)" }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.backgroundColor =
                                "var(--asph-bg-hover)")
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.backgroundColor =
                                "transparent")
                            }
                          >
                            <ExternalLink className="h-4 w-4" />
                            Open in Bluesky
                          </button>
                          <button
                            onClick={handleOpenAddToListModal}
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-all"
                            style={{ color: "var(--asph-text-primary)" }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.backgroundColor =
                                "var(--asph-bg-hover)")
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.backgroundColor =
                                "transparent")
                            }
                          >
                            <ListIcon className="h-4 w-4" />
                            Add to Lists
                          </button>
                          <button
                            onClick={() => {
                              setShowProfileMenu(false);
                              setAnalysisRequested(true);
                              setAiInsightsExpanded(true);
                            }}
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-all"
                            style={{ color: "var(--asph-text-primary)" }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.backgroundColor =
                                "var(--asph-bg-hover)")
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.backgroundColor =
                                "transparent")
                            }
                          >
                            <Sparkles className="h-4 w-4" />
                            Analyze Profile
                          </button>
                          <button
                            onClick={handleMute}
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-all"
                            style={{ color: "var(--asph-text-primary)" }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.backgroundColor =
                                "var(--asph-bg-hover)")
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.backgroundColor =
                                "transparent")
                            }
                          >
                            <VolumeX className="h-4 w-4 flex-shrink-0" />
                            <span className="truncate">
                              {profile.viewer?.muted ? "Unmute" : "Mute"} @
                              {profile.handle}
                            </span>
                          </button>
                          <button
                            onClick={handleOpenReportModal}
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-all"
                            style={{ color: "var(--asph-text-primary)" }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.backgroundColor =
                                "var(--asph-bg-hover)")
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.backgroundColor =
                                "transparent")
                            }
                          >
                            <Flag className="h-4 w-4 flex-shrink-0" />
                            <span className="truncate">
                              Report @{profile.handle}
                            </span>
                          </button>
                          <button
                            onClick={handleBlock}
                            className="flex w-full items-center gap-3 rounded-b-lg px-4 py-2.5 text-sm text-red-600 transition-all"
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.backgroundColor =
                                "var(--asph-bg-hover)")
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.backgroundColor =
                                "transparent")
                            }
                          >
                            <UserX className="h-4 w-4 flex-shrink-0" />
                            <span className="truncate">
                              {profile.viewer?.blocking ? "Unblock" : "Block"} @
                              {profile.handle}
                            </span>
                          </button>
                        </>
                      )}
                    </div>,
                    document.body,
                  )}
              </div>
            </div>
          </div>

          <div className="mb-4">
            <div className="flex items-center gap-2">
              <h1
                className="text-2xl font-bold"
                style={{ color: "var(--asph-text-primary)" }}
              >
                {profile.displayName || profile.handle}
              </h1>
              {/* Verification badge */}
              {profile.verification?.verifiedStatus === "valid" && (
                <BadgeCheck
                  className="h-6 w-6 flex-shrink-0 text-blue-500"
                  aria-label="Verified account"
                />
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <p style={{ color: "var(--asph-text-secondary)" }}>
                  @{profile.handle}
                </p>
                <DomainVerifiedBadge handle={profile.handle} size="md" />
              </div>
              {/* "Follows you" badge */}
              {!isOwnProfile && profile.viewer?.followedBy && (
                <span
                  className="rounded px-1.5 py-0.5 text-xs font-medium"
                  style={{
                    backgroundColor: "var(--asph-bg-tertiary)",
                    color: "var(--asph-text-secondary)",
                  }}
                >
                  Follows you
                </span>
              )}
            </div>
            {/* Show profile labels if present */}
            {profile.labels && profile.labels.length > 0 && (
              <div className="mt-2">
                <LabelBadge labels={profile.labels} maxDisplay={3} size="md" />
              </div>
            )}
          </div>

          {/* Bio with rich text rendering */}
          {profile.description && (
            <div
              className="mb-4 whitespace-pre-wrap"
              style={{ color: "var(--asph-text-primary)" }}
            >
              {bioFacets ? (
                <RichText text={profile.description} facets={bioFacets} />
              ) : (
                <p>{profile.description}</p>
              )}
            </div>
          )}

          {/* Account metadata row */}
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            {/* Creation date */}
            {profile.createdAt && (
              <div
                className="flex items-center gap-1"
                style={{ color: "var(--asph-text-secondary)" }}
              >
                <Calendar className="h-3.5 w-3.5" />
                <span>Joined {formatDate(profile.createdAt)}</span>
              </div>
            )}
            {/* Associated feeds */}
            {profile.associated?.feedgens &&
              profile.associated.feedgens > 0 && (
                <div
                  className="flex items-center gap-1"
                  style={{ color: "var(--asph-text-secondary)" }}
                >
                  <Rss className="h-3.5 w-3.5" />
                  <span>
                    {profile.associated.feedgens} feed
                    {profile.associated.feedgens > 1 ? "s" : ""}
                  </span>
                </div>
              )}
            {/* Associated starter packs */}
            {profile.associated?.starterPacks &&
              profile.associated.starterPacks > 0 && (
                <div
                  className="flex items-center gap-1"
                  style={{ color: "var(--asph-text-secondary)" }}
                >
                  <Users className="h-3.5 w-3.5" />
                  <span>
                    {profile.associated.starterPacks} starter pack
                    {profile.associated.starterPacks > 1 ? "s" : ""}
                  </span>
                </div>
              )}
            {/* Associated lists */}
            {profile.associated?.lists && profile.associated.lists > 0 && (
              <div
                className="flex items-center gap-1"
                style={{ color: "var(--asph-text-secondary)" }}
              >
                <ListIcon className="h-3.5 w-3.5" />
                <span>
                  {profile.associated.lists} list
                  {profile.associated.lists > 1 ? "s" : ""}
                </span>
              </div>
            )}
          </div>

          <div className="flex gap-6 text-sm">
            <div>
              <span
                className="font-semibold"
                style={{ color: "var(--asph-text-primary)" }}
              >
                {formatCount(profile.postsCount || 0)}
              </span>
              <span
                className="ml-1"
                style={{ color: "var(--asph-text-secondary)" }}
              >
                posts
              </span>
            </div>
            <button
              onClick={() => setShowFollowersModal(true)}
              className="transition-all hover:scale-105 hover:underline"
            >
              <span
                className="font-semibold"
                style={{ color: "var(--asph-text-primary)" }}
              >
                {formatCount(profile.followersCount || 0)}
              </span>
              <span
                className="ml-1"
                style={{ color: "var(--asph-text-secondary)" }}
              >
                followers
              </span>
            </button>
            <button
              onClick={() => setShowFollowingModal(true)}
              className="transition-all hover:scale-105 hover:underline"
            >
              <span
                className="font-semibold"
                style={{ color: "var(--asph-text-primary)" }}
              >
                {formatCount(profile.followsCount || 0)}
              </span>
              <span
                className="ml-1"
                style={{ color: "var(--asph-text-secondary)" }}
              >
                following
              </span>
            </button>
          </div>

          {/* Known followers */}
          {!isOwnProfile &&
            profile.viewer?.knownFollowers &&
            profile.viewer.knownFollowers.count > 0 && (
              <div className="mt-3 flex items-center gap-2 text-sm">
                <div className="flex -space-x-2">
                  {profile.viewer.knownFollowers.followers
                    .slice(0, 3)
                    .map((follower) => (
                      <img
                        key={follower.did}
                        src={
                          follower.avatar
                            ? proxifyBskyImage(follower.avatar)
                            : "/default-avatar.svg"
                        }
                        alt={follower.displayName || follower.handle}
                        className="h-6 w-6 rounded-full border-2"
                        style={{
                          borderColor: "var(--asph-bg-secondary)",
                          backgroundColor: "var(--asph-bg-tertiary)",
                        }}
                      />
                    ))}
                </div>
                <span style={{ color: "var(--asph-text-secondary)" }}>
                  Followed by{" "}
                  {(() => {
                    const followers = profile.viewer.knownFollowers.followers;
                    const total = profile.viewer.knownFollowers.count;
                    const names = followers
                      .slice(0, 2)
                      .map((f) => f.displayName || f.handle);

                    if (total === 1) return names[0];
                    if (total === 2) return `${names[0]} and ${names[1]}`;
                    const othersCount = total - names.length;
                    return `${names.join(", ")}, and ${othersCount} other${othersCount > 1 ? "s" : ""} you follow`;
                  })()}
                </span>
              </div>
            )}
        </div>
      </div>

      {/* Top Posts Showcase */}
      {topPostsData &&
        topPostsData.topPosts.length > 0 &&
        showTopPostsShowcase && (
          <div className="mt-4">
            <div
              className="rounded-xl p-4"
              style={{
                backgroundColor: "var(--asph-bg-secondary)",
                border: "1px solid var(--asph-border-primary)",
              }}
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp
                    className="h-4 w-4"
                    style={{ color: "var(--asph-primary)" }}
                  />
                  <h2
                    className="text-sm font-semibold"
                    style={{ color: "var(--asph-text-primary)" }}
                  >
                    Top Posts
                  </h2>
                  <span
                    className="text-xs"
                    style={{ color: "var(--asph-text-tertiary)" }}
                  >
                    by engagement
                  </span>
                </div>
                <button
                  onClick={() => setShowTopPostsShowcase(false)}
                  className="rounded px-2 py-1 text-xs transition-all hover:opacity-80"
                  style={{
                    color: "var(--asph-text-tertiary)",
                  }}
                >
                  Hide
                </button>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-1">
                {topPostsData.topPosts.slice(0, 5).map((item, idx) => {
                  const postText =
                    (item.post.record as { text?: string })?.text || "";
                  return (
                    <button
                      key={item.uri}
                      onClick={() => {
                        setSelectedPost(item.post);
                        setOpenThreadToReply(false);
                        setOpenThreadToQuote(false);
                        setShowThread(true);
                      }}
                      className="group flex-shrink-0 rounded-lg p-3 text-left transition-all hover:scale-[1.02]"
                      style={{
                        backgroundColor: "var(--asph-bg-tertiary)",
                        width: "220px",
                      }}
                    >
                      <div className="mb-2 flex items-center gap-1.5">
                        <span
                          className="flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold"
                          style={{
                            backgroundColor:
                              idx === 0
                                ? "var(--asph-primary)"
                                : "var(--asph-bg-hover)",
                            color:
                              idx === 0
                                ? "white"
                                : "var(--asph-text-secondary)",
                          }}
                        >
                          {idx + 1}
                        </span>
                        <span
                          className="truncate text-xs font-medium"
                          style={{ color: "var(--asph-text-primary)" }}
                        >
                          {formatCount(item.totalEngagement)} total
                        </span>
                      </div>
                      <p
                        className="mb-2 line-clamp-3 text-xs leading-relaxed"
                        style={{ color: "var(--asph-text-secondary)" }}
                      >
                        {postText || "(media post)"}
                      </p>
                      <div className="flex items-center gap-3 text-xs">
                        <span
                          className="flex items-center gap-1"
                          style={{ color: "var(--asph-text-tertiary)" }}
                        >
                          <Heart className="h-3 w-3" />
                          {formatCount(item.likes)}
                        </span>
                        <span
                          className="flex items-center gap-1"
                          style={{ color: "var(--asph-text-tertiary)" }}
                        >
                          <Repeat2 className="h-3 w-3" />
                          {formatCount(item.reposts)}
                        </span>
                        <span
                          className="flex items-center gap-1"
                          style={{ color: "var(--asph-text-tertiary)" }}
                        >
                          <MessageCircle className="h-3 w-3" />
                          {formatCount(item.replies)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
              {topPostsData.totalPostsAnalyzed > 0 && (
                <div
                  className="mt-2 text-xs"
                  style={{ color: "var(--asph-text-tertiary)" }}
                >
                  Based on {topPostsData.totalPostsAnalyzed} posts analyzed
                </div>
              )}
            </div>
          </div>
        )}

      {/* AI Profile Insights */}
      {analysisRequested && (analysisData || isLoadingAnalysis) && (
        <div className="mt-4">
          <div
            className="rounded-xl p-4"
            style={{
              backgroundColor: "var(--asph-bg-secondary)",
              border: "1px solid var(--asph-border-primary)",
            }}
          >
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles
                  className="h-4 w-4"
                  style={{ color: "rgb(168, 85, 247)" }}
                />
                <h2
                  className="text-sm font-semibold"
                  style={{ color: "var(--asph-text-primary)" }}
                >
                  AI Insights
                </h2>
                {haikuAnalysis && !sonnetAnalysis && (
                  <div className="flex items-center gap-1">
                    <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-purple-500" />
                    <span
                      className="text-xs"
                      style={{ color: "var(--asph-text-tertiary)" }}
                    >
                      analyzing...
                    </span>
                  </div>
                )}
                {sonnetAnalysis && (
                  <span
                    className="rounded-full px-1.5 py-0.5 text-xs"
                    style={{
                      backgroundColor: "rgba(168, 85, 247, 0.1)",
                      color: "rgb(168, 85, 247)",
                    }}
                  >
                    Full analysis
                  </span>
                )}
              </div>
              {analysisData && (
                <button
                  onClick={() => setAiInsightsExpanded(!aiInsightsExpanded)}
                  className="flex items-center gap-1 rounded px-2 py-1 text-xs transition-all hover:opacity-80"
                  style={{ color: "var(--asph-text-tertiary)" }}
                >
                  {aiInsightsExpanded ? "Less" : "More"}
                  {aiInsightsExpanded ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                </button>
              )}
            </div>

            {isLoadingAnalysis && !analysisData ? (
              <div className="flex items-center gap-3 py-3">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-200 border-t-purple-500" />
                <div>
                  <p
                    className="text-sm"
                    style={{ color: "var(--asph-text-primary)" }}
                  >
                    Analyzing profile...
                  </p>
                  <p
                    className="text-xs"
                    style={{ color: "var(--asph-text-tertiary)" }}
                  >
                    Reviewing posts for themes, style, and engagement
                  </p>
                </div>
              </div>
            ) : analysisError && !analysisData ? (
              <p
                className="py-2 text-sm"
                style={{ color: "var(--asph-text-secondary)" }}
              >
                {analysisError instanceof Error &&
                analysisError.message.includes("Rate limit")
                  ? "Rate limited. Try again later."
                  : "Analysis unavailable."}
              </p>
            ) : analysisData ? (
              <div>
                {/* Summary - always visible */}
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: "var(--asph-text-secondary)" }}
                >
                  {analysisData.summary}
                </p>

                {/* Expanded details */}
                {aiInsightsExpanded && sonnetAnalysis && (
                  <div className="mt-4 space-y-4">
                    {/* Content Themes */}
                    {sonnetAnalysis.contentThemes &&
                      sonnetAnalysis.contentThemes.length > 0 && (
                        <div>
                          <h3
                            className="mb-2 text-xs font-semibold uppercase tracking-wide"
                            style={{ color: "var(--asph-text-tertiary)" }}
                          >
                            Content Themes
                          </h3>
                          <div className="flex flex-wrap gap-2">
                            {sonnetAnalysis.contentThemes.map((theme) => (
                              <div
                                key={theme.theme}
                                className="rounded-lg px-3 py-1.5"
                                style={{
                                  backgroundColor: "var(--asph-bg-tertiary)",
                                }}
                              >
                                <span
                                  className="text-xs font-medium"
                                  style={{
                                    color: "var(--asph-text-primary)",
                                  }}
                                >
                                  {theme.theme}
                                </span>
                                <span
                                  className="ml-1.5 text-xs"
                                  style={{
                                    color: "var(--asph-text-tertiary)",
                                  }}
                                >
                                  {theme.frequency}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                    {/* Writing Style */}
                    {sonnetAnalysis.writingStyle && (
                      <div>
                        <h3
                          className="mb-2 text-xs font-semibold uppercase tracking-wide"
                          style={{ color: "var(--asph-text-tertiary)" }}
                        >
                          Writing Style
                        </h3>
                        <p
                          className="text-sm"
                          style={{ color: "var(--asph-text-secondary)" }}
                        >
                          {sonnetAnalysis.writingStyle.voiceDescription}
                        </p>
                        {sonnetAnalysis.writingStyle.characteristics &&
                          sonnetAnalysis.writingStyle.characteristics.length >
                            0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {sonnetAnalysis.writingStyle.characteristics.map(
                                (char, idx) => (
                                  <span
                                    key={`style-${idx}`}
                                    className="rounded-full px-2 py-0.5 text-xs"
                                    style={{
                                      backgroundColor:
                                        "var(--asph-bg-tertiary)",
                                      color: "var(--asph-text-secondary)",
                                    }}
                                  >
                                    {char}
                                  </span>
                                ),
                              )}
                            </div>
                          )}
                      </div>
                    )}

                    {/* Engagement Patterns */}
                    {sonnetAnalysis.engagementPatterns && (
                      <div>
                        <h3
                          className="mb-2 text-xs font-semibold uppercase tracking-wide"
                          style={{ color: "var(--asph-text-tertiary)" }}
                        >
                          Engagement Patterns
                        </h3>
                        {sonnetAnalysis.engagementPatterns.contentStrengths &&
                          sonnetAnalysis.engagementPatterns.contentStrengths
                            .length > 0 && (
                            <ul className="space-y-1">
                              {sonnetAnalysis.engagementPatterns.contentStrengths.map(
                                (strength, idx) => (
                                  <li
                                    key={`strength-${idx}`}
                                    className="text-xs"
                                    style={{
                                      color: "var(--asph-text-secondary)",
                                    }}
                                  >
                                    &bull; {strength}
                                  </li>
                                ),
                              )}
                            </ul>
                          )}
                        {sonnetAnalysis.engagementPatterns.observations &&
                          sonnetAnalysis.engagementPatterns.observations
                            .length > 0 && (
                            <ul className="mt-1 space-y-1">
                              {sonnetAnalysis.engagementPatterns.observations.map(
                                (obs, idx) => (
                                  <li
                                    key={`obs-${idx}`}
                                    className="text-xs"
                                    style={{
                                      color: "var(--asph-text-tertiary)",
                                    }}
                                  >
                                    &bull; {obs}
                                  </li>
                                ),
                              )}
                            </ul>
                          )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Profile Tabs */}
      <div
        className="sticky top-16 z-10 mt-4 rounded-t-xl"
        style={{
          backgroundColor: "var(--asph-bg-secondary)",
          borderTop: "1px solid var(--asph-border-primary)",
          borderLeft: "1px solid var(--asph-border-primary)",
          borderRight: "1px solid var(--asph-border-primary)",
        }}
      >
        <div className="flex">
          <button
            onClick={() => setActiveTab("posts")}
            className={`relative flex-1 px-4 py-4 text-center font-medium transition-all ${
              activeTab === "posts" ? "" : "hover:scale-105"
            }`}
            style={{
              color:
                activeTab === "posts"
                  ? "var(--asph-primary)"
                  : "var(--asph-text-secondary)",
            }}
          >
            Posts
            {activeTab === "posts" && (
              <div
                className="absolute bottom-0 left-0 right-0 h-0.5"
                style={{ backgroundColor: "var(--asph-primary)" }}
              />
            )}
          </button>
          <button
            onClick={() => setActiveTab("replies")}
            className={`relative flex-1 px-4 py-4 text-center font-medium transition-all ${
              activeTab === "replies" ? "" : "hover:scale-105"
            }`}
            style={{
              color:
                activeTab === "replies"
                  ? "var(--asph-primary)"
                  : "var(--asph-text-secondary)",
            }}
          >
            Replies
            {activeTab === "replies" && (
              <div
                className="absolute bottom-0 left-0 right-0 h-0.5"
                style={{ backgroundColor: "var(--asph-primary)" }}
              />
            )}
          </button>
          <button
            onClick={() => setActiveTab("media")}
            className={`relative flex-1 px-4 py-4 text-center font-medium transition-all ${
              activeTab === "media" ? "" : "hover:scale-105"
            }`}
            style={{
              color:
                activeTab === "media"
                  ? "var(--asph-primary)"
                  : "var(--asph-text-secondary)",
            }}
          >
            Media
            {activeTab === "media" && (
              <div
                className="absolute bottom-0 left-0 right-0 h-0.5"
                style={{ backgroundColor: "var(--asph-primary)" }}
              />
            )}
          </button>
          <button
            onClick={() => setActiveTab("likes")}
            className={`relative flex-1 px-4 py-4 text-center font-medium transition-all ${
              activeTab === "likes" ? "" : "hover:scale-105"
            }`}
            style={{
              color:
                activeTab === "likes"
                  ? "var(--asph-primary)"
                  : "var(--asph-text-secondary)",
            }}
          >
            Likes
            {activeTab === "likes" && (
              <div
                className="absolute bottom-0 left-0 right-0 h-0.5"
                style={{ backgroundColor: "var(--asph-primary)" }}
              />
            )}
          </button>
          <button
            onClick={() => setActiveTab("top")}
            className={`relative flex-1 px-4 py-4 text-center font-medium transition-all ${
              activeTab === "top" ? "" : "hover:scale-105"
            }`}
            style={{
              color:
                activeTab === "top"
                  ? "var(--asph-primary)"
                  : "var(--asph-text-secondary)",
            }}
          >
            Top Posts
            {activeTab === "top" && (
              <div
                className="absolute bottom-0 left-0 right-0 h-0.5"
                style={{ backgroundColor: "var(--asph-primary)" }}
              />
            )}
          </button>
        </div>
      </div>

      {/* Pinned Post */}
      {pinnedPostData && activeTab === "posts" && (
        <div
          className="relative border-b"
          style={{ borderColor: "var(--asph-border-primary)" }}
        >
          <div
            className="flex items-center gap-1.5 px-4 pt-2 text-xs font-medium"
            style={{ color: "var(--asph-text-secondary)" }}
          >
            <Pin className="h-3 w-3" />
            Pinned
          </div>
          <PostCard
            post={pinnedPostData}
            reason={undefined}
            onClick={() => {
              setSelectedPost(pinnedPostData);
              setOpenThreadToReply(false);
              setOpenThreadToQuote(false);
              setShowThread(true);
            }}
            onReply={() => {
              setSelectedPost(pinnedPostData);
              setOpenThreadToReply(true);
              setOpenThreadToQuote(false);
              setShowThread(true);
            }}
            onQuote={() => {
              setSelectedPost(pinnedPostData);
              setOpenThreadToReply(false);
              setOpenThreadToQuote(true);
              setShowThread(true);
            }}
            onLike={() => handleLike(pinnedPostData)}
            onRepost={() => handleRepost(pinnedPostData)}
          />
        </div>
      )}

      {/* Posts - Virtualized */}
      <div ref={listContainerRef}>
        {activeTab === "top" ? (
          <div style={{ height: listHeight }}>
            {isTopPostsLoading ? (
              <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                Loading top posts...
              </div>
            ) : topPostsData?.topPosts.length === 0 ? (
              <EmptyState
                variant="posts"
                title="No top posts found"
                message="Top posts will appear here once available."
                compact
              />
            ) : topPostsData?.topPosts && topPostsData.topPosts.length > 0 ? (
              <List
                listRef={listRef}
                rowCount={topPostsData.topPosts.length}
                rowHeight={dynamicRowHeight}
                defaultHeight={listHeight}
                overscanCount={5}
                rowComponent={({ index, style }) => {
                  const item = topPostsData.topPosts[index];
                  return (
                    <div style={style}>
                      <PostCard
                        post={item.post}
                        reason={undefined}
                        onClick={() => {
                          setSelectedPost(item.post);
                          setOpenThreadToReply(false);
                          setShowThread(true);
                        }}
                        onReply={() => {
                          setSelectedPost(item.post);
                          setOpenThreadToReply(true);
                          setShowThread(true);
                        }}
                      />
                    </div>
                  );
                }}
                rowProps={{}}
              />
            ) : null}
          </div>
        ) : (
          <div style={{ height: listHeight }}>
            {posts.length === 0 && !postsLoading ? (
              <EmptyState variant="posts" compact />
            ) : posts.length > 0 ? (
              <List
                listRef={listRef}
                rowCount={posts.length}
                rowHeight={dynamicRowHeight}
                defaultHeight={listHeight}
                onRowsRendered={handleRowsRendered}
                overscanCount={5}
                rowComponent={({ index, style }) => {
                  const post = posts[index];
                  return (
                    <div style={style}>
                      <PostCard
                        post={post.post}
                        reason={post.reason}
                        onClick={() => {
                          setSelectedPost(post.post);
                          setOpenThreadToReply(false);
                          setOpenThreadToQuote(false);
                          setShowThread(true);
                        }}
                        onQuoteClick={(uri) => {
                          const quotedPost = posts.find(
                            (p) => p.post.uri === uri,
                          )?.post;
                          if (quotedPost) {
                            setSelectedPost(quotedPost);
                          } else {
                            setSelectedPost({
                              uri,
                            } as AppBskyFeedDefs.PostView);
                          }
                          setOpenThreadToReply(false);
                          setOpenThreadToQuote(false);
                          setShowThread(true);
                        }}
                        onLike={() => handleLike(post.post)}
                        onRepost={() => handleRepost(post.post)}
                        onReply={() => {
                          setSelectedPost(post.post);
                          setOpenThreadToReply(true);
                          setOpenThreadToQuote(false);
                          setShowThread(true);
                        }}
                        onQuote={() => {
                          setSelectedPost(post.post);
                          setOpenThreadToReply(false);
                          setOpenThreadToQuote(true);
                          setShowThread(true);
                        }}
                      />
                    </div>
                  );
                }}
                rowProps={{}}
              />
            ) : postsLoading ? (
              <div className="flex justify-center p-4">
                <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-gray-900 dark:border-gray-100"></div>
              </div>
            ) : null}
            {posts.length > 0 && (postsLoading || isFetchingNextPage) && (
              <div className="flex justify-center p-4">
                <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-gray-900 dark:border-gray-100"></div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* User List Modals */}
      <UserListModal
        isOpen={showFollowersModal}
        onClose={() => setShowFollowersModal(false)}
        title={`${profile?.displayName || profile?.handle}'s Followers`}
        actor={profile?.did || ""}
        type="followers"
      />
      <UserListModal
        isOpen={showFollowingModal}
        onClose={() => setShowFollowingModal(false)}
        title={`${profile?.displayName || profile?.handle} Follows`}
        actor={profile?.did || ""}
        type="following"
      />

      {showThread && selectedPost && (
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
      )}

      {profile && (
        <ReportModal
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
          reportType="account"
          subjectUri={`at://${profile.did}/app.bsky.actor.profile/self`}
          subjectDid={profile.did}
          subjectHandle={profile.handle}
        />
      )}

      {showAddToListModal && profile && (
        <AddToListModal
          user={{
            did: profile.did,
            handle: profile.handle,
            displayName: profile.displayName,
            avatar: profile.avatar,
          }}
          onClose={() => setShowAddToListModal(false)}
        />
      )}
    </div>
  );
}
