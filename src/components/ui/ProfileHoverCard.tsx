import { formatCount } from "@bsky/core";
import { getProfileService } from "@bsky/shared";
import { useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useOptimisticFollow } from "../../hooks/useOptimisticFollow";
import { useRoutePrefetch } from "../../hooks/useRoutePrefetch";
import { useViewTransitionNavigate } from "../../hooks/useViewTransitionNavigate";
import { layoutMeasurementService } from "../../services/layout-measurement-service";
import { type AuthorCard, fetchAuthorCard } from "../../services/pan-api";
import { proxifyBskyImage } from "../../utils/image-proxy";
import { DomainVerifiedBadge } from "./DomainVerifiedBadge";
import { Tooltip } from "./Tooltip";

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

// Reputation is a *suspicion* score: higher = more likely inauthentic. We show
// the class label (never the raw number) and color it green→red accordingly.
const REPUTATION_STYLES: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  trusted: {
    label: "Trusted",
    color: "var(--asph-success)",
    bg: "var(--asph-success-10)",
  },
  neutral: {
    label: "Neutral",
    color: "var(--asph-text-secondary)",
    bg: "var(--asph-bg-tertiary)",
  },
  suspicious: {
    label: "Suspicious",
    color: "var(--asph-warning)",
    bg: "var(--asph-warning-10)",
  },
  likely_inauthentic: {
    label: "Likely inauthentic",
    color: "var(--asph-error)",
    bg: "var(--asph-error-10)",
  },
};

const PanAuthorSection: React.FC<{ card: AuthorCard }> = ({ card }) => {
  const rep = card.reputation
    ? (REPUTATION_STYLES[card.reputation.class] ?? {
        label: card.reputation.class,
        color: "var(--asph-text-secondary)",
        bg: "var(--asph-bg-tertiary)",
      })
    : null;

  const s = card.sentiment_recent;
  const sentiment = s && s.sample > 0 ? s : null;
  const total = sentiment
    ? sentiment.positive + sentiment.negative + sentiment.neutral
    : 0;

  const lines: string[] = [];
  if (card.activity?.total_posts != null) {
    lines.push(
      `${formatCount(card.activity.total_posts)} ${
        card.activity.total_posts === 1 ? "post" : "posts"
      }`,
    );
  }
  if (card.community_count != null && card.community_count > 0) {
    lines.push(
      `in ${card.community_count} ${
        card.community_count === 1 ? "community" : "communities"
      }`,
    );
  }
  const topNarrative = card.narratives?.[0]?.name;

  // Nothing to show — render nothing rather than an empty divider.
  if (!rep && !sentiment && lines.length === 0 && !topNarrative) return null;

  return (
    <div
      className="mt-3 border-t pt-3"
      style={{ borderColor: "var(--asph-border-primary)" }}
    >
      {rep && (
        <span
          className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
          style={{ color: rep.color, backgroundColor: rep.bg }}
        >
          {rep.label}
        </span>
      )}

      {sentiment && total > 0 && (
        <Tooltip
          content={`Recent sentiment (${sentiment.sample} ${
            sentiment.sample === 1 ? "post" : "posts"
          }): ${sentiment.positive} positive · ${sentiment.negative} negative · ${sentiment.neutral} neutral`}
          delay={200}
        >
          <div
            className="mt-2 flex h-1.5 w-full overflow-hidden rounded-full"
            style={{ backgroundColor: "var(--asph-bg-tertiary)" }}
          >
            <div
              style={{
                width: `${(sentiment.positive / total) * 100}%`,
                backgroundColor: "var(--asph-success)",
              }}
            />
            <div
              style={{
                width: `${(sentiment.negative / total) * 100}%`,
                backgroundColor: "var(--asph-error)",
              }}
            />
            <div
              style={{
                width: `${(sentiment.neutral / total) * 100}%`,
                backgroundColor: "var(--asph-text-secondary)",
              }}
            />
          </div>
        </Tooltip>
      )}

      {(lines.length > 0 || topNarrative) && (
        <p
          className="mt-2 truncate text-xs"
          style={{ color: "var(--asph-text-secondary)" }}
        >
          {[lines.join(" · "), topNarrative].filter(Boolean).join(" · ")}
        </p>
      )}
    </div>
  );
};

export const ProfileHoverCard: React.FC<ProfileHoverCardProps> = React.memo(
  ({ handle, children, delay = 600 }) => {
    const [isHovering, setIsHovering] = useState(false);
    const [showCard, setShowCard] = useState(false);
    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [panCard, setPanCard] = useState<AuthorCard | null>(null);
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
    const optimisticFollow = useOptimisticFollow();
    const navigate = useViewTransitionNavigate();
    const queryClient = useQueryClient();
    const { prefetchProfile } = useRoutePrefetch();

    const isTouchDevice =
      "ontouchstart" in window || navigator.maxTouchPoints > 0;

    useEffect(() => {
      if (isHovering) {
        // On touch devices, hover cards are useless and waste API calls
        if (isTouchDevice) return;

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

    // Once the profile is known, fetch Pan's author signals out-of-band. This
    // never blocks the main card — the Pan section pops in if/when it arrives.
    useEffect(() => {
      if (isTouchDevice) return;
      const did = profile?.did;
      if (!did || panCard?.did === did) return;

      let cancelled = false;
      fetchAuthorCard(did).then((card) => {
        if (!cancelled && card) setPanCard(card);
      });
      return () => {
        cancelled = true;
      };
    }, [profile?.did, panCard?.did, isTouchDevice]);

    const handleFollow = async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!profile) return;

      await optimisticFollow(profile, (updater) =>
        setProfile((prev) => (prev ? updater(prev) : prev)),
      );
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
                        className={`touch-target rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
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

                  {/* Pan author signals (pops in when available) */}
                  {panCard && panCard.did === profile.did && (
                    <PanAuthorSection card={panCard} />
                  )}
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
