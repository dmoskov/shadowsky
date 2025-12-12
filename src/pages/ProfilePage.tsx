import { AppBskyFeedDefs } from "@atproto/api";
import { getProfileService } from "@bsky/shared";
import { useQuery } from "@tanstack/react-query";
import {
  Edit,
  ExternalLink,
  Flag,
  List as ListIcon,
  MoreHorizontal,
  Share2,
  Sparkles,
  UserX,
  VolumeX,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { List, ListImperativeAPI, useDynamicRowHeight } from "react-window";
import { AddToListModal } from "../components/AddToListModal";
import { PostCard } from "../components/PostCard";
import { ReportModal } from "../components/ReportModal";
import { ThreadModal } from "../components/ThreadModal";
import { DomainVerifiedBadge } from "../components/ui/DomainVerifiedBadge";
import { EmptyState } from "../components/ui/EmptyState";
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
  viewer?: {
    following?: string;
    followedBy?: string;
    muted?: boolean;
    blockedBy?: boolean;
    blocking?: string;
  };
}

type ProfileTab = "posts" | "replies" | "media" | "top";

// Store scroll positions for each profile/tab combination
const scrollPositions = new Map<string, number>();

export default function ProfilePage() {
  const { handle } = useParams<{ handle: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { session, agent } = useAuth();
  const { showToast } = useToast();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [posts, setPosts] = useState<AppBskyFeedDefs.FeedViewPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [postsLoading, setPostsLoading] = useState(false);
  const [cursor, setCursor] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(true);

  // Get active tab from URL, default to "posts"
  const tabParam = searchParams.get("tab");
  const activeTab: ProfileTab =
    tabParam === "replies" || tabParam === "media" || tabParam === "top"
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
  const [showProfileAnalysis, setShowProfileAnalysis] = useState(false);
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

  // Top posts for the "Top Posts" tab
  const { data: topPostsData, isLoading: isTopPostsLoading } = useTopPosts({
    handle: handle || "",
    limit: 10,
    enabled: activeTab === "top" && !!handle,
  });

  useEffect(() => {
    if (!handle || !agent) return;

    const loadProfile = async () => {
      try {
        setLoading(true);
        setError(null);

        // First try to get from cache
        const db = await getFollowerCacheDB();
        const cachedProfile = await db.getProfileByHandle(handle);
        if (cachedProfile) {
          setProfile({
            did: cachedProfile.did,
            handle: cachedProfile.handle,
            displayName: cachedProfile.displayName,
            description: cachedProfile.description,
            avatar: cachedProfile.avatar,
            banner: cachedProfile.banner,
            followersCount: cachedProfile.followersCount,
            followsCount:
              cachedProfile.followsCount || cachedProfile.followingCount,
            postsCount: cachedProfile.postsCount,
            viewer: cachedProfile.viewer,
          });
        }

        // Then fetch full profile data
        const profileService = getProfileService(agent);
        const profileRes = await profileService.getProfile(handle);

        if (profileRes) {
          setProfile(profileRes);
          // Update cache
          await db.saveProfiles([
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
          ]);
        }

        // Load initial posts
        loadPosts(true);
      } catch (err) {
        console.error("Error loading profile:", err);
        setError("Failed to load profile");
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [handle, agent]);

  const loadPosts = async (initial = false) => {
    if (!handle || !agent || postsLoading) return;
    if (activeTab === "top") return;

    try {
      setPostsLoading(true);
      const profileService = getProfileService(agent);

      const filter =
        activeTab === "replies"
          ? "posts_with_replies"
          : activeTab === "media"
            ? "posts_with_media"
            : "posts_no_replies";

      const response = await profileService.getAuthorFeed(
        handle,
        30,
        initial ? undefined : cursor,
        filter,
      );

      if (response) {
        setPosts((prev) =>
          initial ? response.feed : [...prev, ...response.feed],
        );
        setCursor(response.cursor);
        setHasMore(!!response.cursor);
      }
    } catch (err) {
      console.error("Error loading posts:", err);
    } finally {
      setPostsLoading(false);
    }
  };

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
      if (!hasMore || postsLoading || posts.length === 0) return;

      // Trigger load at 80% scroll position
      const scrollPercentage = visibleRows.stopIndex / posts.length;
      if (scrollPercentage >= 0.8) {
        loadPosts();
      }
    },
    [hasMore, postsLoading, posts.length],
  );

  useEffect(() => {
    if (profile) {
      setPosts([]);
      setCursor(undefined);
      setHasMore(true);
      loadPosts(true);
    }
  }, [activeTab]);

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
              "linear-gradient(135deg, var(--bsky-primary) 0%, var(--bsky-accent) 100%)",
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
        <div className="bsky-card border-0 px-6 pb-6">
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
                borderColor: "var(--bsky-bg-secondary)",
                backgroundColor: "var(--bsky-bg-tertiary)",
              }}
            />
            <div className="flex items-center gap-2">
              {!isOwnProfile && (
                <button
                  onClick={handleFollow}
                  className={`rounded-full px-6 py-2.5 font-medium transition-all ${
                    profile.viewer?.following
                      ? "bsky-button-secondary hover:scale-105"
                      : "bsky-button-primary hover:scale-105"
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
                    color: "var(--bsky-text-secondary)",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor =
                      "var(--bsky-bg-hover)")
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
                        backgroundColor: "var(--bsky-bg-secondary)",
                        borderColor: "var(--bsky-border-primary)",
                        boxShadow: "var(--bsky-shadow-lg)",
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
                            style={{ color: "var(--bsky-text-primary)" }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.backgroundColor =
                                "var(--bsky-bg-hover)")
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
                              setShowProfileAnalysis(true);
                            }}
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-all"
                            style={{ color: "var(--bsky-text-primary)" }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.backgroundColor =
                                "var(--bsky-bg-hover)")
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
                            style={{ color: "var(--bsky-text-primary)" }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.backgroundColor =
                                "var(--bsky-bg-hover)")
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
                            style={{ color: "var(--bsky-text-primary)" }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.backgroundColor =
                                "var(--bsky-bg-hover)")
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
                            style={{ color: "var(--bsky-text-primary)" }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.backgroundColor =
                                "var(--bsky-bg-hover)")
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
                              setShowProfileAnalysis(true);
                            }}
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-all"
                            style={{ color: "var(--bsky-text-primary)" }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.backgroundColor =
                                "var(--bsky-bg-hover)")
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
                            style={{ color: "var(--bsky-text-primary)" }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.backgroundColor =
                                "var(--bsky-bg-hover)")
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
                            style={{ color: "var(--bsky-text-primary)" }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.backgroundColor =
                                "var(--bsky-bg-hover)")
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
                                "var(--bsky-bg-hover)")
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
            <h1
              className="text-2xl font-bold"
              style={{ color: "var(--bsky-text-primary)" }}
            >
              {profile.displayName || profile.handle}
            </h1>
            <div className="flex items-center gap-1">
              <p style={{ color: "var(--bsky-text-secondary)" }}>
                @{profile.handle}
              </p>
              <DomainVerifiedBadge handle={profile.handle} size="md" />
            </div>
          </div>

          {profile.description && (
            <p
              className="mb-4 whitespace-pre-wrap"
              style={{ color: "var(--bsky-text-primary)" }}
            >
              {profile.description}
            </p>
          )}

          <div className="flex gap-6 text-sm">
            <div>
              <span
                className="font-semibold"
                style={{ color: "var(--bsky-text-primary)" }}
              >
                {formatCount(profile.postsCount || 0)}
              </span>
              <span
                className="ml-1"
                style={{ color: "var(--bsky-text-secondary)" }}
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
                style={{ color: "var(--bsky-text-primary)" }}
              >
                {formatCount(profile.followersCount || 0)}
              </span>
              <span
                className="ml-1"
                style={{ color: "var(--bsky-text-secondary)" }}
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
                style={{ color: "var(--bsky-text-primary)" }}
              >
                {formatCount(profile.followsCount || 0)}
              </span>
              <span
                className="ml-1"
                style={{ color: "var(--bsky-text-secondary)" }}
              >
                following
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Profile Tabs */}
      <div
        className="sticky top-16 z-10 mt-4 rounded-t-xl"
        style={{
          backgroundColor: "var(--bsky-bg-secondary)",
          borderTop: "1px solid var(--bsky-border-primary)",
          borderLeft: "1px solid var(--bsky-border-primary)",
          borderRight: "1px solid var(--bsky-border-primary)",
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
                  ? "var(--bsky-primary)"
                  : "var(--bsky-text-secondary)",
            }}
          >
            Posts
            {activeTab === "posts" && (
              <div
                className="absolute bottom-0 left-0 right-0 h-0.5"
                style={{ backgroundColor: "var(--bsky-primary)" }}
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
                  ? "var(--bsky-primary)"
                  : "var(--bsky-text-secondary)",
            }}
          >
            Replies
            {activeTab === "replies" && (
              <div
                className="absolute bottom-0 left-0 right-0 h-0.5"
                style={{ backgroundColor: "var(--bsky-primary)" }}
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
                  ? "var(--bsky-primary)"
                  : "var(--bsky-text-secondary)",
            }}
          >
            Media
            {activeTab === "media" && (
              <div
                className="absolute bottom-0 left-0 right-0 h-0.5"
                style={{ backgroundColor: "var(--bsky-primary)" }}
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
                  ? "var(--bsky-primary)"
                  : "var(--bsky-text-secondary)",
            }}
          >
            Top Posts
            {activeTab === "top" && (
              <div
                className="absolute bottom-0 left-0 right-0 h-0.5"
                style={{ backgroundColor: "var(--bsky-primary)" }}
              />
            )}
          </button>
        </div>
      </div>

      {/* Profile Analysis Section */}
      {showProfileAnalysis &&
        (isLoadingAnalysis || analysisData || analysisError) && (
          <div className="mb-4">
            <div
              className="rounded-lg p-6"
              style={{ background: "var(--bsky-bg-secondary)" }}
            >
              <div className="mb-4 flex items-center justify-between">
                <h2
                  className="flex items-center gap-2 text-lg font-semibold"
                  style={{ color: "var(--bsky-text-primary)" }}
                >
                  <Sparkles size={20} className="text-purple-500" />
                  Profile Analysis
                </h2>
                <button
                  onClick={() => {
                    setShowProfileAnalysis(false);
                    setAnalysisRequested(false);
                  }}
                  className="rounded px-3 py-1 text-sm transition-all hover:opacity-80"
                  style={{
                    backgroundColor: "var(--bsky-bg-tertiary)",
                    color: "var(--bsky-text-secondary)",
                  }}
                >
                  Hide
                </button>
              </div>

              {isLoadingAnalysis ? (
                <div className="py-8 text-center">
                  <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-purple-200 border-t-purple-500" />
                  <p style={{ color: "var(--bsky-text-primary)" }}>
                    Analyzing profile...
                  </p>
                </div>
              ) : analysisError && !analysisData ? (
                <div className="py-6 text-center">
                  <div
                    className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full"
                    style={{ backgroundColor: "rgba(239, 68, 68, 0.1)" }}
                  >
                    <span className="text-2xl">⚠️</span>
                  </div>
                  <p
                    className="mb-2 font-medium"
                    style={{ color: "var(--bsky-text-primary)" }}
                  >
                    Analysis Failed
                  </p>
                  <p
                    className="text-sm"
                    style={{ color: "var(--bsky-text-secondary)" }}
                  >
                    {analysisError instanceof Error
                      ? analysisError.message.includes("Rate limit")
                        ? "Too many requests. Please wait a minute and try again."
                        : analysisError.message.includes("401") ||
                            analysisError.message.includes("Authentication")
                          ? "Please sign in to use AI analysis."
                          : analysisError.message
                      : "An unexpected error occurred. Please try again."}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Show haiku if that's all we have, or sonnet if ready */}
                  {haikuAnalysis && !sonnetAnalysis && (
                    <div
                      className="mb-3 flex items-center gap-2 rounded px-3 py-2 text-sm"
                      style={{
                        backgroundColor: "var(--bsky-bg-tertiary)",
                        color: "var(--bsky-text-secondary)",
                      }}
                    >
                      <div className="h-2 w-2 animate-pulse rounded-full bg-purple-500" />
                      Quick analysis ({postsInMemory.length} posts) •{" "}
                      {isLoadingPostsForSonnet
                        ? "Fetching more posts..."
                        : "Deep analysis loading..."}
                    </div>
                  )}
                  {sonnetAnalysis && (
                    <div
                      className="mb-3 flex items-center gap-2 rounded px-3 py-2 text-sm font-medium"
                      style={{
                        backgroundColor: "rgba(168, 85, 247, 0.1)",
                        color: "var(--bsky-primary)",
                      }}
                    >
                      ✨ Full analysis complete ({postsForSonnet?.length || 0}{" "}
                      posts analyzed)
                    </div>
                  )}

                  {/* Summary (always shown) */}
                  <p style={{ color: "var(--bsky-text-secondary)" }}>
                    {analysisData?.summary}
                  </p>

                  {/* Full sonnet details (only when sonnet is available) */}
                  {sonnetAnalysis && (
                    <div className="mt-6 space-y-6">
                      {/* Content Themes */}
                      {sonnetAnalysis.contentThemes &&
                        sonnetAnalysis.contentThemes.length > 0 && (
                          <div>
                            <h3
                              className="mb-3 text-sm font-semibold"
                              style={{ color: "var(--bsky-text-primary)" }}
                            >
                              Content Themes
                            </h3>
                            <div className="space-y-3">
                              {sonnetAnalysis.contentThemes.map(
                                (theme, idx) => (
                                  <div
                                    key={idx}
                                    className="rounded-lg p-3"
                                    style={{
                                      backgroundColor:
                                        "var(--bsky-bg-tertiary)",
                                    }}
                                  >
                                    <div className="mb-1 flex items-center gap-2">
                                      <span
                                        className="font-medium"
                                        style={{
                                          color: "var(--bsky-text-primary)",
                                        }}
                                      >
                                        {theme.theme}
                                      </span>
                                      <span
                                        className="rounded-full px-2 py-0.5 text-xs"
                                        style={{
                                          backgroundColor:
                                            theme.frequency === "primary"
                                              ? "#8b5cf6"
                                              : theme.frequency === "regular"
                                                ? "#a78bfa"
                                                : "#c4b5fd",
                                          color: "white",
                                        }}
                                      >
                                        {theme.frequency}
                                      </span>
                                    </div>
                                    <p
                                      className="text-sm"
                                      style={{
                                        color: "var(--bsky-text-secondary)",
                                      }}
                                    >
                                      {theme.description}
                                    </p>
                                  </div>
                                ),
                              )}
                            </div>
                          </div>
                        )}

                      {/* Writing Style */}
                      {sonnetAnalysis.writingStyle && (
                        <div>
                          <h3
                            className="mb-3 text-sm font-semibold"
                            style={{ color: "var(--bsky-text-primary)" }}
                          >
                            Writing Style
                          </h3>
                          <div
                            className="rounded-lg p-3"
                            style={{
                              backgroundColor: "var(--bsky-bg-tertiary)",
                            }}
                          >
                            <p
                              className="mb-2 text-sm font-medium"
                              style={{ color: "var(--bsky-text-primary)" }}
                            >
                              {sonnetAnalysis.writingStyle.tone}
                            </p>
                            {sonnetAnalysis.writingStyle.characteristics && (
                              <ul className="space-y-1">
                                {sonnetAnalysis.writingStyle.characteristics.map(
                                  (char, idx) => (
                                    <li
                                      key={idx}
                                      className="text-sm"
                                      style={{
                                        color: "var(--bsky-text-secondary)",
                                      }}
                                    >
                                      • {char}
                                    </li>
                                  ),
                                )}
                              </ul>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

      {/* Posts - Virtualized */}
      <div ref={listContainerRef}>
        {activeTab === "top" ? (
          <div style={{ height: listHeight }}>
            {isTopPostsLoading ? (
              <div className="py-8 text-center text-gray-500">
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
            {posts.length > 0 && postsLoading && (
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
