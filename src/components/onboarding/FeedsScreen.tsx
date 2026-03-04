import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Check, Hash, Loader2, Plus } from "lucide-react";
import React, { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { onboardingService } from "../../services/onboarding-service";
import { proxifyBskyImage } from "../../utils/image-proxy";

interface FeedsScreenProps {
  onContinue: (savedFeeds: string[]) => void;
  onBack: () => void;
  onSkip: () => void;
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
}

export const FeedsScreen: React.FC<FeedsScreenProps> = ({
  onContinue,
  onBack,
  onSkip,
}) => {
  const { agent } = useAuth();
  const [savedFeeds, setSavedFeeds] = useState<Set<string>>(new Set());
  const [savingInProgress, setSavingInProgress] = useState<Set<string>>(
    new Set(),
  );

  // Fetch suggested feeds
  const { data: suggestedFeeds, isLoading } = useQuery({
    queryKey: ["onboarding", "feeds"],
    queryFn: async () => {
      if (!agent) throw new Error("Not authenticated");
      const feeds = await onboardingService.getSuggestedFeeds(20);
      return feeds as FeedGenerator[];
    },
    enabled: !!agent,
  });

  const handleFeedToggle = async (feed: FeedGenerator) => {
    if (savingInProgress.has(feed.uri)) return;

    setSavingInProgress((prev) => new Set([...prev, feed.uri]));

    try {
      if (savedFeeds.has(feed.uri)) {
        // Remove feed (just from local state during onboarding)
        setSavedFeeds((prev) => {
          const newSet = new Set(prev);
          newSet.delete(feed.uri);
          return newSet;
        });
      } else {
        // Save feed
        const success = await onboardingService.saveFeed(feed.uri);
        if (success) {
          setSavedFeeds((prev) => new Set([...prev, feed.uri]));
        }
      }
    } finally {
      setSavingInProgress((prev) => {
        const newSet = new Set(prev);
        newSet.delete(feed.uri);
        return newSet;
      });
    }
  };

  const handleContinue = () => {
    onContinue(Array.from(savedFeeds));
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
              <Hash size={32} style={{ color: "var(--asph-primary)" }} />
            </div>
          </div>
          <h1
            className="mb-2 text-3xl font-bold"
            style={{ color: "var(--asph-text-primary)" }}
          >
            Discover custom feeds
          </h1>
          <p
            className="text-lg"
            style={{ color: "var(--asph-text-secondary)" }}
          >
            Add curated feeds to personalize your timeline
          </p>
          <p
            className="mt-2 text-sm"
            style={{ color: "var(--asph-text-tertiary)" }}
          >
            {savedFeeds.size > 0
              ? `${savedFeeds.size} feed${savedFeeds.size !== 1 ? "s" : ""} added`
              : "Browse and add feeds that interest you"}
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
              Loading feed suggestions...
            </p>
          </div>
        )}

        {/* Feeds Grid */}
        {!isLoading && suggestedFeeds && suggestedFeeds.length > 0 && (
          <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {suggestedFeeds.map((feed) => {
              const isSaved = savedFeeds.has(feed.uri);
              const isInProgress = savingInProgress.has(feed.uri);

              return (
                <div
                  key={feed.uri}
                  className="asph-card flex flex-col p-4"
                  style={{ background: "var(--asph-bg-secondary)" }}
                >
                  {/* Feed Info */}
                  <div className="mb-3 flex items-start gap-3">
                    {feed.avatar ? (
                      <img
                        src={proxifyBskyImage(feed.avatar)}
                        alt={feed.displayName}
                        className="h-12 w-12 rounded-lg object-cover"
                      />
                    ) : (
                      <div
                        className="flex h-12 w-12 items-center justify-center rounded-lg"
                        style={{ backgroundColor: "var(--asph-bg-tertiary)" }}
                      >
                        <Hash
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
                        {feed.displayName}
                      </h3>
                      <p
                        className="truncate text-sm"
                        style={{ color: "var(--asph-text-tertiary)" }}
                      >
                        by @{feed.creator.handle}
                      </p>
                    </div>
                  </div>

                  {/* Description */}
                  {feed.description && (
                    <p
                      className="mb-3 line-clamp-2 text-sm"
                      style={{ color: "var(--asph-text-secondary)" }}
                    >
                      {feed.description}
                    </p>
                  )}

                  {/* Stats and Add Button */}
                  <div className="mt-auto flex items-center justify-between">
                    {feed.likeCount !== undefined && (
                      <p
                        className="text-sm"
                        style={{ color: "var(--asph-text-tertiary)" }}
                      >
                        {feed.likeCount.toLocaleString()} likes
                      </p>
                    )}
                    <button
                      onClick={() => handleFeedToggle(feed)}
                      disabled={isInProgress}
                      className="touch-target-sm ml-auto flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50"
                      style={{
                        backgroundColor: isSaved
                          ? "var(--asph-bg-tertiary)"
                          : "var(--asph-primary)",
                        color: isSaved ? "var(--asph-text-secondary)" : "white",
                      }}
                    >
                      {isInProgress ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : isSaved ? (
                        <>
                          <Check size={16} />
                          Added
                        </>
                      ) : (
                        <>
                          <Plus size={16} />
                          Add
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && (!suggestedFeeds || suggestedFeeds.length === 0) && (
          <div className="mb-8 text-center">
            <p style={{ color: "var(--asph-text-secondary)" }}>
              No feed suggestions available at the moment. You can discover more
              feeds later.
            </p>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
          <button
            onClick={onBack}
            className="touch-target-sm rounded-xl px-6 py-3 font-medium transition-all hover:opacity-80"
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
              className="touch-target-sm rounded-xl px-6 py-3 font-medium transition-all hover:opacity-80"
              style={{
                color: "var(--asph-text-secondary)",
                border: "1px solid var(--asph-border-primary)",
              }}
            >
              Skip
            </button>
            <button
              onClick={handleContinue}
              className="touch-target-sm asph-button-primary flex items-center justify-center gap-2 px-6 py-3 font-semibold text-white"
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
