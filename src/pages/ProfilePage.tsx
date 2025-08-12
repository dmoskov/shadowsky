import { AppBskyFeedDefs } from "@atproto/api";
import { getProfileService } from "@bsky/shared";
import { Edit, MoreHorizontal, Share2, UserX, VolumeX } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { InlineReplyComposer } from "../components/InlineReplyComposer";
import { PostActionBar } from "../components/PostActionBar";
import { PostRenderer } from "../components/PostRenderer";
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
  const [replyToPost, setReplyToPost] =
    useState<AppBskyFeedDefs.PostView | null>(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [showFollowingModal, setShowFollowingModal] = useState(false);

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

      let response;
      const filter =
        activeTab === "replies"
          ? "posts_with_replies"
          : activeTab === "media"
            ? "posts_with_media"
            : "posts_no_replies";

      response = await profileService.getAuthorFeed(
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
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-gray-900 dark:border-gray-100"></div>
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

  const handleShare = () => {
    if (!profile) return;
    const profileUrl = getBskyProfileUrl(profile.handle);
    navigator.clipboard.writeText(profileUrl);
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

  return (
    <div className="mx-auto max-w-2xl">
      {/* Profile Header */}
      <div className="relative">
        {/* Banner */}
        <div className="h-32 bg-gradient-to-b from-blue-200 to-blue-300 dark:from-blue-800 dark:to-blue-900">
          {profile.banner && (
            <img
              src={proxifyBskyImage(profile.banner)}
              alt="Profile banner"
              className="h-full w-full object-cover"
            />
          )}
        </div>

        {/* Profile Info */}
        <div className="px-4 pb-4">
          <div className="-mt-16 mb-4 flex items-end justify-between">
            <img
              src={
                profile.avatar
                  ? proxifyBskyImage(profile.avatar)
                  : "/default-avatar.svg"
              }
              alt={profile.displayName || profile.handle}
              className="h-32 w-32 rounded-full border-4 border-white bg-white dark:border-gray-900 dark:bg-gray-800"
            />
            <div className="flex items-center gap-2">
              {!isOwnProfile && (
                <button
                  onClick={handleFollow}
                  className={`rounded-full px-6 py-2 font-medium transition-colors ${
                    profile.viewer?.following
                      ? "bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                      : "bg-blue-500 text-white hover:bg-blue-600"
                  }`}
                >
                  {profile.viewer?.following ? "Following" : "Follow"}
                </button>
              )}
              <div className="relative">
                <button
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="rounded-full p-2 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <MoreHorizontal className="h-5 w-5" />
                </button>
                {showProfileMenu && (
                  <div className="absolute right-0 z-20 mt-2 w-48 rounded-lg bg-white py-2 shadow-lg dark:bg-gray-800">
                    {isOwnProfile ? (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setShowProfileMenu(false);
                          navigate("/settings/account");
                        }}
                        className="flex w-full items-center gap-3 px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        <Edit className="h-4 w-4" />
                        Edit Profile
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={handleShare}
                          className="flex w-full items-center gap-3 px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                          <Share2 className="h-4 w-4" />
                          Share Profile
                        </button>
                        <button
                          onClick={handleMute}
                          className="flex w-full items-center gap-3 px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                          <VolumeX className="h-4 w-4" />
                          {profile.viewer?.muted ? "Unmute" : "Mute"} @
                          {profile.handle}
                        </button>
                        <button
                          onClick={handleBlock}
                          className="flex w-full items-center gap-3 px-4 py-2 text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                          <UserX className="h-4 w-4" />
                          {profile.viewer?.blocking ? "Unblock" : "Block"} @
                          {profile.handle}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mb-4">
            <h1 className="text-2xl font-bold">
              {profile.displayName || profile.handle}
            </h1>
            <p className="text-gray-500 dark:text-gray-400">
              @{profile.handle}
            </p>
          </div>

          {profile.description && (
            <p className="mb-4 whitespace-pre-wrap">{profile.description}</p>
          )}

          <div className="flex gap-6 text-sm">
            <div>
              <span className="font-semibold">
                {formatCount(profile.postsCount || 0)}
              </span>
              <span className="ml-1 text-gray-500 dark:text-gray-400">
                posts
              </span>
            </div>
            <button
              onClick={() => setShowFollowersModal(true)}
              className="hover:underline"
            >
              <span className="font-semibold">
                {formatCount(profile.followersCount || 0)}
              </span>
              <span className="ml-1 text-gray-500 dark:text-gray-400">
                followers
              </span>
            </button>
            <button
              onClick={() => setShowFollowingModal(true)}
              className="hover:underline"
            >
              <span className="font-semibold">
                {formatCount(profile.followsCount || 0)}
              </span>
              <span className="ml-1 text-gray-500 dark:text-gray-400">
                following
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Profile Tabs */}
      <div className="sticky top-0 z-10 border-b border-t bg-white dark:border-gray-700 dark:bg-gray-900">
        <div className="flex">
          <button
            onClick={() => setActiveTab("posts")}
            className={`flex-1 px-4 py-4 text-center font-medium transition-colors ${
              activeTab === "posts"
                ? "border-b-2 border-blue-500 text-blue-500"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            Posts
          </button>
          <button
            onClick={() => setActiveTab("replies")}
            className={`flex-1 px-4 py-4 text-center font-medium transition-colors ${
              activeTab === "replies"
                ? "border-b-2 border-blue-500 text-blue-500"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            Replies
          </button>
          <button
            onClick={() => setActiveTab("media")}
            className={`flex-1 px-4 py-4 text-center font-medium transition-colors ${
              activeTab === "media"
                ? "border-b-2 border-blue-500 text-blue-500"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            Media
          </button>
        </div>
      </div>

      {/* Posts */}
      <div>
        {posts.map((post) => (
          <div key={post.post.uri} className="border-b dark:border-gray-700">
            <PostRenderer
              post={post.post}
              reason={post.reason}
              showActions={false}
            />
            <div className="px-4 pb-3">
              <PostActionBar
                post={post.post}
                onLike={() => handleLike(post.post)}
                onRepost={() => handleRepost(post.post)}
                onReply={() => setReplyToPost(post.post)}
                showCounts={true}
              />
            </div>
            {replyToPost?.uri === post.post.uri && (
              <InlineReplyComposer
                replyTo={{
                  uri: replyToPost.uri,
                  cid: replyToPost.cid,
                  author: replyToPost.author,
                }}
                onClose={() => setReplyToPost(null)}
                onSuccess={() => {
                  setReplyToPost(null);
                  // Optionally refresh the feed
                }}
              />
            )}
          </div>
        ))}
        {postsLoading && (
          <div className="flex justify-center p-4">
            <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-gray-900 dark:border-gray-100"></div>
          </div>
        )}
      </div>

      {/* Click outside to close menu */}
      {showProfileMenu && (
        <div
          className="fixed inset-0 z-10"
          onClick={(e) => {
            e.stopPropagation();
            setShowProfileMenu(false);
          }}
        />
      )}

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
    </div>
  );
}
