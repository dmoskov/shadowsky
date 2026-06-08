/**
 * useOptimisticFollow
 *
 * Returns a follow/unfollow handler that updates the UI in the same frame as
 * the click, then reconciles with the server — mirroring the optimistic pattern
 * used for likes/reposts in useOptimisticPosts. On failure it rolls back to the
 * pre-click state and surfaces a toast.
 *
 * Works with any profile object that exposes the fields in FollowableProfile and
 * any state setter that accepts a functional updater (useState dispatch or a
 * React Query cache writer).
 */
import { getProfileService } from "@bsky/shared";
import { useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { createLogger } from "../utils/logger";

const logger = createLogger("useOptimisticFollow");

export interface FollowableProfile {
  did: string;
  handle: string;
  followersCount?: number;
  viewer?: { following?: string } | undefined;
}

/**
 * Sentinel URI used while a follow request is in flight. The UI only checks the
 * truthiness of viewer.following to render "Following" vs "Follow", so this is
 * enough to flip the button instantly; it is replaced with the real record URI
 * once the server responds.
 */
const PENDING_FOLLOW_URI = "pending-follow";

type ProfileSetter<T> = (updater: (prev: T) => T) => void;

export function useOptimisticFollow() {
  const { agent } = useAuth();
  const { showToast } = useToast();

  return useCallback(
    async <T extends FollowableProfile>(
      profile: T,
      setProfile: ProfileSetter<T>,
    ): Promise<void> => {
      if (!agent) return;

      const previousFollowing = profile.viewer?.following;
      const previousCount = profile.followersCount;
      const wasFollowing = Boolean(previousFollowing);

      // 1. Optimistic update — flip the button in the same frame as the click.
      setProfile((prev) => ({
        ...prev,
        viewer: {
          ...prev.viewer,
          following: wasFollowing ? undefined : PENDING_FOLLOW_URI,
        },
        followersCount: (prev.followersCount || 0) + (wasFollowing ? -1 : 1),
      }));

      try {
        const profileService = getProfileService(agent);
        if (wasFollowing) {
          await profileService.unfollow(previousFollowing as string);
          showToast(`Unfollowed @${profile.handle}`, {
            type: "success",
            duration: 3000,
          });
        } else {
          const uri = await profileService.follow(profile.did);
          // Replace the in-flight sentinel with the real follow record URI.
          setProfile((prev) => ({
            ...prev,
            viewer: { ...prev.viewer, following: uri },
          }));
          showToast(`Following @${profile.handle}`, {
            type: "success",
            duration: 3000,
          });
        }
      } catch (err) {
        // 2. Rollback to the pre-click state.
        setProfile((prev) => ({
          ...prev,
          viewer: { ...prev.viewer, following: previousFollowing },
          followersCount: previousCount,
        }));
        logger.error("Error toggling follow:", err);
        showToast("Failed to update follow status", { type: "error" });
      }
    },
    [agent, showToast],
  );
}
