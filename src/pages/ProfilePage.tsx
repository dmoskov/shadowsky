import { AppBskyFeedDefs } from "@atproto/api";
import { getProfileService } from "@bsky/shared";
import {
  Edit,
  ExternalLink,
  Flag,
  List,
  MoreHorizontal,
  Share2,
  UserX,
  VolumeX,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { useNavigate, useParams } from "react-router";
import { AddToListModal } from "../components/AddToListModal";
import { PostCard } from "../components/PostCard";
import { ReportModal } from "../components/ReportModal";
import { ThreadModal } from "../components/ThreadModal";
import { DomainVerifiedBadge } from "../components/ui/DomainVerifiedBadge";
import { ProfileSkeleton } from "../components/ui/SkeletonLoader";
import { UserListModal } from "../components/UserListModal";
import { useAuth } from "../contexts/AuthContext";
import { useOptimisticPosts } from "../hooks/useOptimisticPosts";
import { getFollowerCacheDB } from "../services/follower-cache-db";
import { proxifyBskyImage } from "../utils/image-proxy";
import { getBskyProfileUrl } from "../utils/url-helpers";

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

type ProfileTab = "posts" | "replies" | "media";

export default function ProfilePage() {
  const { handle } = useParams<{ handle: string }>();
  const navigate = useNavigate();
  const { session, agent } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [posts, setPosts] = useState<AppBskyFeedDefs.FeedViewPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [postsLoading, setPostsLoading] = useState(false);
  const [cursor, setCursor] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(true);
  const [activeTab, setActiveTab] = useState<ProfileTab>("posts");
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

  const profileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  const { likeMutation, unlikeMutation, repostMutation, unrepostMutation } =
    useOptimisticPosts();

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

  const handleScroll = () => {
    if (
      window.innerHeight + document.documentElement.scrollTop >=
        document.documentElement.offsetHeight - 100 &&
      hasMore &&
      !postsLoading
    ) {
      loadPosts();
    }
  };

  useEffect(() => {
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [hasMore, postsLoading, cursor]);

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
      } else {
        const uri = await profileService.follow(profile.did);
        setProfile({
          ...profile,
          viewer: { ...profile.viewer, following: uri },
          followersCount: (profile.followersCount || 0) + 1,
        });
      }
    } catch (err) {
      console.error("Error toggling follow:", err);
    }
  };

  if (loading) {
    return <ProfileSkeleton />;
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

  const handleShare = () => {
    if (!profile) return;
    const profileUrl = getBskyProfileUrl(profile.handle);
    const fullUrl = `${window.location.origin}${profileUrl}`;
    navigator.clipboard.writeText(fullUrl);
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
        setProfile({
          ...profile,
          viewer: { ...profile.viewer, blocking: undefined },
        });
      } else {
        const uri = await profileService.block(profile.did);
        setProfile({
          ...profile,
          viewer: { ...profile.viewer, blocking: uri },
        });
      }
    } catch (err) {
      console.error("Error toggling block:", err);
    }
    setShowProfileMenu(false);
  };

  const handleMute = async () => {
    if (!profile || !agent) return;
    try {
      const profileService = getProfileService(agent);
      if (profile.viewer?.muted) {
        await profileService.unmute(profile.did);
        setProfile({
          ...profile,
          viewer: { ...profile.viewer, muted: false },
        });
      } else {
        await profileService.mute(profile.did);
        setProfile({
          ...profile,
          viewer: { ...profile.viewer, muted: true },
        });
      }
    } catch (err) {
      console.error("Error toggling mute:", err);
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
                            <List className="h-4 w-4" />
                            Add to Lists
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
                            <VolumeX className="h-4 w-4" />
                            {profile.viewer?.muted ? "Unmute" : "Mute"} @
                            {profile.handle}
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
                            <Flag className="h-4 w-4" />
                            Report @{profile.handle}
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
                            <UserX className="h-4 w-4" />
                            {profile.viewer?.blocking ? "Unblock" : "Block"} @
                            {profile.handle}
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
        </div>
      </div>

      {/* Posts */}
      <div>
        {posts.map((post) => (
          <PostCard
            key={post.post.uri}
            post={post.post}
            reason={post.reason}
            onClick={() => {
              setSelectedPost(post.post);
              setOpenThreadToReply(false);
              setOpenThreadToQuote(false);
              setShowThread(true);
            }}
            onQuoteClick={(uri) => {
              // Find the quoted post from our posts array or create a minimal post object
              const quotedPost = posts.find((p) => p.post.uri === uri)?.post;
              if (quotedPost) {
                setSelectedPost(quotedPost);
              } else {
                // Create a minimal post object with just the URI for the ThreadModal to fetch
                setSelectedPost({ uri } as AppBskyFeedDefs.PostView);
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
        ))}
        {postsLoading && (
          <div className="flex justify-center p-4">
            <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-gray-900 dark:border-gray-100"></div>
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
