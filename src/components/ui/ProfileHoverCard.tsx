import { getProfileService } from "@bsky/shared";
import { useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useRoutePrefetch } from "../../hooks/useRoutePrefetch";
import { useViewTransitionNavigate } from "../../hooks/useViewTransitionNavigate";
import { layoutMeasurementService } from "../../services/layout-measurement-service";
import { proxifyBskyImage } from "../../utils/image-proxy";
import { DomainVerifiedBadge } from "./DomainVerifiedBadge";

interface ProfileData {
  did: string;
  handle: string;
  displayName?: string;
  description?: string;
  avatar?: string;
  followersCount?: number;
  followsCount?: number;
  viewer?: {
    following?: string;
  };
}

interface ProfileHoverCardProps {
  handle: string;
  children: React.ReactNode;
  delay?: number;
}

export const ProfileHoverCard: React.FC<ProfileHoverCardProps> = React.memo(
  ({ handle, children, delay = 600 }) => {
    const [isHovering, setIsHovering] = useState(false);
    const [showCard, setShowCard] = useState(false);
    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [loading, setLoading] = useState(false);
    const [cardPosition, setCardPosition] = useState<{
      top: number;
      left: number;
    } | null>(null);

    const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const triggerRef = useRef<HTMLSpanElement>(null);
    const cardRef = useRef<HTMLDivElement>(null);

    const { agent, session } = useAuth();
    const navigate = useViewTransitionNavigate();
    const queryClient = useQueryClient();
    const { prefetchProfile } = useRoutePrefetch();

    useEffect(() => {
      if (isHovering) {
        // Clear any pending hide timeout
        if (hideTimeoutRef.current) {
          clearTimeout(hideTimeoutRef.current);
          hideTimeoutRef.current = null;
        }

        // Trigger prefetch immediately on hover for cache warming
        prefetchProfile(handle);

        // Set a timeout to show the card
        hoverTimeoutRef.current = setTimeout(async () => {
          if (!profile && agent) {
            // Check React Query cache first
            const cachedProfile = queryClient.getQueryData<ProfileData>([
              "profile",
              handle,
            ]);
            if (cachedProfile) {
              setProfile(cachedProfile);
            } else {
              setLoading(true);
              try {
                const profileService = getProfileService(agent);
                const profileData = await profileService.getProfile(handle);
                if (profileData) {
                  setProfile(profileData);
                  // Store in React Query cache for future prefetch reuse
                  queryClient.setQueryData(["profile", handle], profileData);
                }
              } catch (error) {
                console.error("Failed to load profile:", error);
              } finally {
                setLoading(false);
              }
            }
          }

          // Calculate position using batched measurement service
          if (triggerRef.current) {
            layoutMeasurementService.measureElement(
              triggerRef.current,
              (rect) => {
                const cardWidth = 320;
                const cardHeight = 250; // Increased to account for actual rendered height
                const padding = 16; // Increased padding for better spacing

                // Try to center the card horizontally relative to the trigger
                let left = rect.left + rect.width / 2 - cardWidth / 2;
                let top = rect.bottom + padding;

                // Keep card within viewport horizontally
                // If card would overflow on the left, align to left edge
                if (left < padding) {
                  left = padding;
                }
                // If card would overflow on the right, align to right edge
                else if (left + cardWidth > window.innerWidth - padding) {
                  left = window.innerWidth - cardWidth - padding;
                }

                // If card would go below viewport, show it above the trigger
                if (top + cardHeight > window.innerHeight - padding) {
                  top = rect.top - cardHeight - padding;
                  // If it still doesn't fit above, just show it at the top with some padding
                  if (top < padding) {
                    top = padding;
                  }
                }

                setCardPosition({ top, left });
                setShowCard(true);
              },
              { priority: "high" },
            );
          } else {
            setShowCard(true);
          }
        }, delay);
      } else {
        // Clear the show timeout if user moves mouse away before delay
        if (hoverTimeoutRef.current) {
          clearTimeout(hoverTimeoutRef.current);
          hoverTimeoutRef.current = null;
        }

        // Set a timeout to hide the card (gives time to move to card)
        hideTimeoutRef.current = setTimeout(() => {
          setShowCard(false);
        }, 200);
      }

      return () => {
        if (hoverTimeoutRef.current) {
          clearTimeout(hoverTimeoutRef.current);
        }
        if (hideTimeoutRef.current) {
          clearTimeout(hideTimeoutRef.current);
        }
      };
    }, [
      isHovering,
      handle,
      agent,
      profile,
      delay,
      prefetchProfile,
      queryClient,
    ]);

    const handleFollow = async (e: React.MouseEvent) => {
      e.stopPropagation();
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

    const formatCount = (count: number): string => {
      if (count >= 1000000) {
        return `${(count / 1000000).toFixed(1)}M`;
      } else if (count >= 1000) {
        return `${(count / 1000).toFixed(1)}K`;
      }
      return count.toString();
    };

    const isOwnProfile = session?.handle === handle;

    return (
      <>
        <span
          ref={triggerRef}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
          style={{ display: "inline-block" }}
        >
          {children}
        </span>

        {showCard &&
          cardPosition &&
          createPortal(
            <div
              ref={cardRef}
              className="fixed z-[10000] w-80 rounded-xl border shadow-lg"
              style={{
                top: `${cardPosition.top}px`,
                left: `${cardPosition.left}px`,
                backgroundColor: "var(--asph-bg-secondary)",
                borderColor: "var(--asph-border-primary)",
                boxShadow: "var(--asph-shadow-lg)",
              }}
              onMouseEnter={() => {
                setIsHovering(true);
                if (hideTimeoutRef.current) {
                  clearTimeout(hideTimeoutRef.current);
                  hideTimeoutRef.current = null;
                }
              }}
              onMouseLeave={() => setIsHovering(false)}
            >
              {loading || !profile ? (
                <div className="flex h-48 items-center justify-center">
                  <div
                    className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
                    style={{ borderColor: "var(--asph-primary)" }}
                  />
                </div>
              ) : (
                <div className="p-4">
                  {/* Header with avatar and follow button */}
                  <div className="mb-3 flex items-start justify-between">
                    <img
                      src={
                        profile.avatar
                          ? proxifyBskyImage(profile.avatar)
                          : "/default-avatar.svg"
                      }
                      alt={profile.displayName || profile.handle}
                      className="h-16 w-16 cursor-pointer rounded-full border-2 transition-transform hover:scale-105"
                      style={{
                        borderColor: "var(--asph-bg-tertiary)",
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/profile/${profile.handle}`);
                      }}
                    />
                    {!isOwnProfile && (
                      <button
                        onClick={handleFollow}
                        className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
                          profile.viewer?.following
                            ? "asph-button-secondary hover:scale-105"
                            : "asph-button-primary hover:scale-105"
                        }`}
                      >
                        {profile.viewer?.following ? "Following" : "Follow"}
                      </button>
                    )}
                  </div>

                  {/* Name and handle */}
                  <div
                    className="mb-2 cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/profile/${profile.handle}`);
                    }}
                  >
                    <div className="flex items-center gap-1">
                      <h3
                        className="truncate font-bold hover:underline"
                        style={{ color: "var(--asph-text-primary)" }}
                      >
                        {profile.displayName || profile.handle}
                      </h3>
                      <DomainVerifiedBadge handle={profile.handle} size="sm" />
                    </div>
                    <p
                      className="truncate text-sm hover:underline"
                      style={{ color: "var(--asph-text-secondary)" }}
                    >
                      @{profile.handle}
                    </p>
                  </div>

                  {/* Bio */}
                  {profile.description && (
                    <p
                      className="mb-3 line-clamp-3 text-sm"
                      style={{ color: "var(--asph-text-primary)" }}
                    >
                      {profile.description}
                    </p>
                  )}

                  {/* Stats */}
                  <div className="flex gap-4 text-sm">
                    <div>
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
                        Followers
                      </span>
                    </div>
                    <div>
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
                        Following
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>,
            document.body,
          )}
      </>
    );
  },
  (prevProps, nextProps) => {
    // Memoize based on handle and delay - children comparison is shallow by default
    return (
      prevProps.handle === nextProps.handle &&
      prevProps.delay === nextProps.delay
    );
  },
);

ProfileHoverCard.displayName = "ProfileHoverCard";
