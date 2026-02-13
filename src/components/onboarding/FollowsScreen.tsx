import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Check, Loader2, UserPlus, Users } from "lucide-react";
import React, { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { onboardingService } from "../../services/onboarding-service";
import { proxifyBskyImage } from "../../utils/image-proxy";

interface FollowsScreenProps {
  onContinue: (followedDids: string[]) => void;
  onBack: () => void;
  onSkip: () => void;
}

interface SuggestedUser {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
  description?: string;
  viewer?: {
    following?: string;
  };
}

export const FollowsScreen: React.FC<FollowsScreenProps> = ({
  onContinue,
  onBack,
  onSkip,
}) => {
  const { agent } = useAuth();
  const [followedUsers, setFollowedUsers] = useState<Set<string>>(new Set());
  const [followingInProgress, setFollowingInProgress] = useState<Set<string>>(
    new Set(),
  );

  // Fetch suggested users
  const { data: suggestedUsers, isLoading } = useQuery({
    queryKey: ["onboarding", "suggestions"],
    queryFn: async () => {
      if (!agent) throw new Error("Not authenticated");
      const users = await onboardingService.getSuggestedUsers(20);
      return users as SuggestedUser[];
    },
    enabled: !!agent,
  });

  const handleFollowToggle = async (user: SuggestedUser) => {
    if (followingInProgress.has(user.did)) return;

    setFollowingInProgress((prev) => new Set([...prev, user.did]));

    try {
      if (followedUsers.has(user.did)) {
        // Unfollow (though we won't expose this in onboarding, keeping for consistency)
        setFollowedUsers((prev) => {
          const newSet = new Set(prev);
          newSet.delete(user.did);
          return newSet;
        });
      } else {
        // Follow
        const success = await onboardingService.followUser(user.did);
        if (success) {
          setFollowedUsers((prev) => new Set([...prev, user.did]));
        }
      }
    } finally {
      setFollowingInProgress((prev) => {
        const newSet = new Set(prev);
        newSet.delete(user.did);
        return newSet;
      });
    }
  };

  const handleContinue = () => {
    onContinue(Array.from(followedUsers));
  };

  return (
    <div
      className="flex min-h-screen flex-col px-4 py-8"
      style={{ background: "var(--asph-bg-primary)" }}
    >
      <div className="mx-auto w-full max-w-4xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mb-4 flex justify-center">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full"
              style={{ backgroundColor: "var(--asph-primary-transparent)" }}
            >
              <Users size={32} style={{ color: "var(--asph-primary)" }} />
            </div>
          </div>
          <h1
            className="mb-2 text-3xl font-bold"
            style={{ color: "var(--asph-text-primary)" }}
          >
            Discover people to follow
          </h1>
          <p
            className="text-lg"
            style={{ color: "var(--asph-text-secondary)" }}
          >
            Here are some suggested accounts to get you started
          </p>
          <p
            className="mt-2 text-sm"
            style={{ color: "var(--asph-text-tertiary)" }}
          >
            {followedUsers.size > 0
              ? `Following ${followedUsers.size} account${followedUsers.size !== 1 ? "s" : ""}`
              : "Follow at least a few accounts to see content"}
          </p>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2
              size={48}
              className="animate-spin"
              style={{ color: "var(--asph-primary)" }}
            />
            <p
              className="mt-4 text-sm"
              style={{ color: "var(--asph-text-secondary)" }}
            >
              Loading suggestions...
            </p>
          </div>
        )}

        {/* Suggested Users Grid */}
        {!isLoading && suggestedUsers && suggestedUsers.length > 0 && (
          <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {suggestedUsers.map((user) => {
              const isFollowed =
                followedUsers.has(user.did) || user.viewer?.following;
              const isInProgress = followingInProgress.has(user.did);

              return (
                <div
                  key={user.did}
                  className="asph-card flex flex-col p-4"
                  style={{ background: "var(--asph-bg-secondary)" }}
                >
                  {/* User Info */}
                  <div className="mb-3 flex items-start gap-3">
                    {user.avatar ? (
                      <img
                        src={proxifyBskyImage(user.avatar)}
                        alt={user.displayName || user.handle}
                        className="h-12 w-12 rounded-full object-cover"
                      />
                    ) : (
                      <div
                        className="flex h-12 w-12 items-center justify-center rounded-full"
                        style={{ backgroundColor: "var(--asph-bg-tertiary)" }}
                      >
                        <Users
                          size={24}
                          style={{ color: "var(--asph-text-tertiary)" }}
                        />
                      </div>
                    )}
                    <div className="flex-1 overflow-hidden">
                      <h3
                        className="truncate font-semibold"
                        style={{ color: "var(--asph-text-primary)" }}
                      >
                        {user.displayName || user.handle}
                      </h3>
                      <p
                        className="truncate text-sm"
                        style={{ color: "var(--asph-text-tertiary)" }}
                      >
                        @{user.handle}
                      </p>
                    </div>
                  </div>

                  {/* Description */}
                  {user.description && (
                    <p
                      className="mb-3 line-clamp-2 text-sm"
                      style={{ color: "var(--asph-text-secondary)" }}
                    >
                      {user.description}
                    </p>
                  )}

                  {/* Follow Button */}
                  <button
                    onClick={() => handleFollowToggle(user)}
                    disabled={isInProgress || !!user.viewer?.following}
                    className="mt-auto flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50"
                    style={{
                      backgroundColor: isFollowed
                        ? "var(--asph-bg-tertiary)"
                        : "var(--asph-primary)",
                      color: isFollowed
                        ? "var(--asph-text-secondary)"
                        : "white",
                    }}
                  >
                    {isInProgress ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : isFollowed ? (
                      <>
                        <Check size={16} />
                        Following
                      </>
                    ) : (
                      <>
                        <UserPlus size={16} />
                        Follow
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && (!suggestedUsers || suggestedUsers.length === 0) && (
          <div className="mb-8 text-center">
            <p style={{ color: "var(--asph-text-secondary)" }}>
              No suggestions available at the moment. You can discover more
              accounts later.
            </p>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
          <button
            onClick={onBack}
            className="rounded-xl px-6 py-3 font-medium transition-all hover:opacity-80"
            style={{
              color: "var(--asph-text-secondary)",
              border: "1px solid var(--asph-border-primary)",
            }}
          >
            Back
          </button>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              onClick={onSkip}
              className="rounded-xl px-6 py-3 font-medium transition-all hover:opacity-80"
              style={{
                color: "var(--asph-text-secondary)",
                border: "1px solid var(--asph-border-primary)",
              }}
            >
              Skip
            </button>
            <button
              onClick={handleContinue}
              className="asph-button-primary flex items-center justify-center gap-2 px-6 py-3 font-semibold text-white"
            >
              Continue
              <ArrowRight size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
