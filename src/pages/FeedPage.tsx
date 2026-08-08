import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  ExternalLink,
  Hash,
  Heart,
  Plus,
  Users,
} from "lucide-react";
import { useCallback } from "react";
import { useParams } from "react-router";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { Home } from "../components/Home";
import { FeedSkeleton } from "../components/ui/SkeletonLoader";
import { useAuth } from "../contexts/AuthContext";
import { useViewTransitionNavigate } from "../hooks/useViewTransitionNavigate";
import { proxifyBskyImage } from "../utils/image-proxy";

export default function FeedPage() {
  const { handle, rkey } = useParams<{ handle: string; rkey: string }>();
  const navigate = useViewTransitionNavigate();
  const { agent } = useAuth();
  const queryClient = useQueryClient();

  const feedUri = `at://${handle}/app.bsky.feed.generator/${rkey}`;

  const { data: feedInfo, isLoading: isLoadingInfo } = useQuery({
    queryKey: ["feedGenerator", feedUri],
    queryFn: async () => {
      if (!agent) throw new Error("Not authenticated");
      const response = await agent.app.bsky.feed.getFeedGenerator({
        feed: feedUri,
      });
      return response.data;
    },
    enabled: !!agent && !!handle && !!rkey,
    staleTime: 5 * 60 * 1000,
  });

  const feed = feedInfo?.view;
  // Use the canonical DID-based URI from the API response for saved feed
  // operations, since saved feeds store DID-based URIs while the URL uses handles.
  const canonicalUri = feed?.uri ?? feedUri;

  const { data: userPrefs } = useQuery({
    queryKey: ["userPreferences"],
    queryFn: async () => {
      if (!agent) throw new Error("Not authenticated");
      return await agent.getPreferences();
    },
    enabled: !!agent,
  });

  const isSaved =
    userPrefs?.savedFeeds?.some((f: any) => f.value === canonicalUri) ?? false;

  const addFeedMutation = useMutation({
    mutationFn: async () => {
      if (!agent) throw new Error("Not authenticated");
      const newSavedFeed = {
        id: `feed-${Date.now()}`,
        type: "feed" as const,
        value: canonicalUri,
        pinned: false,
      };
      await agent.addSavedFeeds([newSavedFeed]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userPreferences"] });
    },
  });

  const removeFeedMutation = useMutation({
    mutationFn: async () => {
      if (!agent || !userPrefs?.savedFeeds)
        throw new Error("Not authenticated");
      const feedToRemove = userPrefs.savedFeeds.find(
        (f: any) => f.value === canonicalUri,
      );
      if (feedToRemove) {
        await agent.removeSavedFeeds([feedToRemove.id]);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userPreferences"] });
    },
  });

  const handleToggleSave = useCallback(() => {
    if (isSaved) {
      removeFeedMutation.mutate();
    } else {
      addFeedMutation.mutate();
    }
  }, [isSaved, addFeedMutation, removeFeedMutation]);

  const isMutating = addFeedMutation.isPending || removeFeedMutation.isPending;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div
        className="sticky top-0 z-10 border-b"
        style={{
          borderColor: "var(--asph-border-primary)",
          backgroundColor: "var(--asph-bg-primary)",
        }}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => navigate(-1)}
            className="touch-target-icon rounded-full p-1.5 transition-colors hover:bg-asph-bg-active"
          >
            <ArrowLeft
              className="h-5 w-5"
              style={{ color: "var(--asph-text-primary)" }}
            />
          </button>

          {isLoadingInfo ? (
            <div className="flex-1">
              <div
                className="h-5 w-32 animate-pulse rounded"
                style={{ backgroundColor: "var(--asph-bg-tertiary)" }}
              />
            </div>
          ) : feed ? (
            <div className="flex min-w-0 flex-1 items-center gap-3">
              {feed.avatar ? (
                <img
                  src={proxifyBskyImage(feed.avatar)}
                  alt={feed.displayName}
                  className="h-8 w-8 flex-shrink-0 rounded-lg object-cover"
                />
              ) : (
                <div
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: "var(--asph-bg-tertiary)" }}
                >
                  <Hash
                    className="h-4 w-4"
                    style={{ color: "var(--asph-text-secondary)" }}
                  />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h1
                  className="truncate text-sm font-semibold"
                  style={{ color: "var(--asph-text-primary)" }}
                >
                  {feed.displayName}
                </h1>
                <p
                  className="truncate text-xs"
                  style={{ color: "var(--asph-text-secondary)" }}
                >
                  by @{feed.creator.handle}
                </p>
              </div>
            </div>
          ) : null}

          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleSave}
              disabled={isMutating}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                backgroundColor: isSaved
                  ? "transparent"
                  : "var(--asph-primary)",
                border: isSaved
                  ? "1px solid var(--asph-border-primary)"
                  : "1px solid transparent",
                color: isSaved ? "var(--asph-text-secondary)" : "white",
                opacity: isMutating ? 0.6 : 1,
              }}
            >
              {isSaved ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Saved
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5" />
                  Save
                </>
              )}
            </button>
            <a
              href={`https://bsky.app/profile/${handle}/feed/${rkey}`}
              target="_blank"
              rel="noopener noreferrer"
              className="touch-target-icon rounded-full p-1.5 transition-colors hover:bg-asph-bg-active"
            >
              <ExternalLink
                className="h-4 w-4"
                style={{ color: "var(--asph-text-secondary)" }}
              />
            </a>
          </div>
        </div>

        {/* Feed description */}
        {feed?.description && (
          <div
            className="border-t px-4 py-2"
            style={{ borderColor: "var(--asph-border-primary)" }}
          >
            <p
              className="text-xs leading-relaxed"
              style={{ color: "var(--asph-text-secondary)" }}
            >
              {feed.description}
            </p>
            <div className="mt-1 flex items-center gap-3 text-xs">
              {feed.likeCount !== undefined && (
                <span
                  className="flex items-center gap-1"
                  style={{ color: "var(--asph-text-tertiary)" }}
                >
                  <Heart className="h-3 w-3" />
                  {feed.likeCount.toLocaleString()} likes
                </span>
              )}
              <button
                onClick={() => navigate(`/profile/${feed.creator.handle}`)}
                className="flex items-center gap-1 hover:underline"
                style={{ color: "var(--asph-primary)" }}
              >
                <Users className="h-3 w-3" />
                {feed.creator.displayName || `@${feed.creator.handle}`}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Feed content */}
      <div className="flex-1">
        {isLoadingInfo ? (
          <div className="p-4">
            <FeedSkeleton count={5} />
          </div>
        ) : (
          <ErrorBoundary componentName="Feed">
            <Home feedUri={feedUri} isFocused isVisible />
          </ErrorBoundary>
        )}
      </div>
    </div>
  );
}
