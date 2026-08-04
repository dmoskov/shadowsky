import type { BskyAgent } from "@atproto/api";
import { debug } from "@bsky/shared";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, List } from "lucide-react";
import React from "react";
import { CURATED_FEED_URIS } from "../../config/curated-feeds";
import { proxifyBskyImage } from "../../utils/image-proxy";
import { LoadingState } from "../ui/LoadingState";

interface SearchTabFeedsProps {
  activeSearchQuery: string;
  agent: BskyAgent | null;
  navigate: (path: string) => void;
}

export const SearchTabFeeds: React.FC<SearchTabFeedsProps> = React.memo(
  ({ activeSearchQuery, agent, navigate: _navigate }) => {
    // Search feeds query
    const {
      data: feedsSearchResults,
      isLoading: isLoadingFeeds,
      error: feedsError,
    } = useQuery({
      queryKey: ["searchFeeds", activeSearchQuery],
      queryFn: async () => {
        if (!activeSearchQuery.trim()) return null;

        try {
          // Get popular feeds, suggested feeds, and curated picks
          const [popularResponse, suggestedResponse, curatedResponse] =
            await Promise.all([
              agent!.app.bsky.unspecced.getPopularFeedGenerators({
                limit: 50,
              }),
              agent!.app.bsky.feed.getSuggestedFeeds({
                limit: 50,
              }),
              agent!.app.bsky.feed.getFeedGenerators({
                feeds: CURATED_FEED_URIS,
              }),
            ]);

          // Combine and deduplicate feeds
          const allFeeds = [
            ...curatedResponse.data.feeds,
            ...popularResponse.data.feeds,
            ...suggestedResponse.data.feeds,
          ];
          const uniqueFeeds = Array.from(
            new Map(allFeeds.map((feed) => [feed.uri, feed])).values(),
          );

          // Filter feeds based on search query
          const searchLower = activeSearchQuery.toLowerCase();
          const filteredFeeds = uniqueFeeds.filter((feed: any) => {
            const displayName = feed.displayName?.toLowerCase() || "";
            const description = feed.description?.toLowerCase() || "";
            const creatorHandle = feed.creator?.handle?.toLowerCase() || "";
            const creatorName = feed.creator?.displayName?.toLowerCase() || "";

            return (
              displayName.includes(searchLower) ||
              description.includes(searchLower) ||
              creatorHandle.includes(searchLower) ||
              creatorName.includes(searchLower)
            );
          });

          return {
            feeds: filteredFeeds,
          };
        } catch (error) {
          debug.error("Error searching feeds:", error);
          // Fallback to just suggested feeds
          const response = await agent!.app.bsky.feed.getSuggestedFeeds({
            limit: 100,
          });

          const searchLower = activeSearchQuery.toLowerCase();
          const filteredFeeds = response.data.feeds.filter((feed: any) => {
            const displayName = feed.displayName?.toLowerCase() || "";
            const description = feed.description?.toLowerCase() || "";
            const creatorHandle = feed.creator?.handle?.toLowerCase() || "";
            const creatorName = feed.creator?.displayName?.toLowerCase() || "";

            return (
              displayName.includes(searchLower) ||
              description.includes(searchLower) ||
              creatorHandle.includes(searchLower) ||
              creatorName.includes(searchLower)
            );
          });

          return {
            feeds: filteredFeeds,
          };
        }
      },
      enabled: !!agent && !!activeSearchQuery.trim(),
    });

    // Show loading state
    if (isLoadingFeeds) {
      return (
        <LoadingState
          variant="spinner"
          size="lg"
          message="Searching..."
          centered
          className="py-6"
        />
      );
    }

    // Show error state
    if (feedsError) {
      return (
        <div
          className="rounded-xl border bg-red-500 bg-opacity-5 p-6 text-center"
          style={{ borderColor: "var(--asph-error)" }}
        >
          <p className="text-sm" style={{ color: "var(--asph-error)" }}>
            Error searching. Please try again.
          </p>
        </div>
      );
    }

    // Show empty state when no results
    if (feedsSearchResults && feedsSearchResults.feeds.length === 0) {
      return (
        <div
          className="rounded-xl border bg-white bg-opacity-5 p-6 text-center"
          style={{ borderColor: "var(--asph-border-primary)" }}
        >
          <List
            size={32}
            className="mx-auto mb-3 opacity-10"
            style={{ color: "var(--asph-text-secondary)" }}
          />
          <p
            className="mb-3 text-sm font-medium"
            style={{ color: "var(--asph-text-primary)" }}
          >
            No feeds found matching your search
          </p>
          <p
            className="mb-4 text-xs"
            style={{ color: "var(--asph-text-secondary)" }}
          >
            Try these suggestions:
          </p>
          <ul
            className="space-y-2 text-left text-xs"
            style={{ color: "var(--asph-text-secondary)" }}
          >
            <li className="flex items-start gap-2">
              <span>•</span>
              <span>Check the feed name spelling</span>
            </li>
            <li className="flex items-start gap-2">
              <span>•</span>
              <span>Try searching for feed topics or categories</span>
            </li>
            <li className="flex items-start gap-2">
              <span>•</span>
              <span>Browse popular feeds to discover new ones</span>
            </li>
            <li className="flex items-start gap-2">
              <span>•</span>
              <span>Try the "Posts" tab to search for content</span>
            </li>
          </ul>
        </div>
      );
    }

    // Show results
    if (
      feedsSearchResults &&
      feedsSearchResults.feeds &&
      feedsSearchResults.feeds.length > 0
    ) {
      return (
        <>
          <div className="mb-2 flex items-center justify-between">
            <p
              className="text-sm"
              style={{ color: "var(--asph-text-secondary)" }}
            >
              {feedsSearchResults.feeds.length} results
            </p>
          </div>

          {feedsSearchResults.feeds.map((feed) => (
            <div
              key={feed.uri}
              className="asph-glass cursor-pointer rounded-xl p-3 transition-all hover:shadow-lg sm:p-4"
              style={{
                border: "1px solid var(--asph-border-primary)",
              }}
              onClick={() => {
                // Navigate to home and set the selected feed
                // For now, just open the feed URL externally until we have proper feed navigation
                window.open(
                  `https://bsky.app/profile/${feed.creator.handle}/feed/${feed.uri.split("/").pop()}`,
                  "_blank",
                  "noopener,noreferrer",
                );
              }}
            >
              <div className="flex items-start gap-3">
                {feed.avatar && (
                  <img
                    src={proxifyBskyImage(feed.avatar)}
                    alt={feed.displayName}
                    className="h-12 w-12 flex-shrink-0 rounded-lg"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="mb-1">
                    <h3
                      className="font-medium"
                      style={{ color: "var(--asph-text-primary)" }}
                    >
                      {feed.displayName}
                    </h3>
                  </div>
                  {feed.description && (
                    <p
                      className="mb-2 line-clamp-2 text-sm"
                      style={{ color: "var(--asph-text-primary)" }}
                    >
                      {feed.description}
                    </p>
                  )}
                  <div className="mb-2 flex items-center gap-4 text-xs">
                    <span style={{ color: "var(--asph-text-secondary)" }}>
                      by @{feed.creator.handle}
                    </span>
                    {feed.likeCount !== undefined && (
                      <span
                        style={{
                          color: "var(--asph-text-secondary)",
                        }}
                      >
                        <strong>{feed.likeCount.toLocaleString()}</strong> likes
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className="text-xs"
                      style={{ color: "var(--asph-text-tertiary)" }}
                    >
                      Click to view feed
                    </span>
                    <a
                      href={`https://bsky.app/profile/${feed.creator.handle}/feed/${feed.uri.split("/").pop()}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-xs hover:underline"
                      style={{ color: "var(--asph-primary)" }}
                    >
                      <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </>
      );
    }

    // No results yet (initial state)
    return null;
  },
);

SearchTabFeeds.displayName = "SearchTabFeeds";
