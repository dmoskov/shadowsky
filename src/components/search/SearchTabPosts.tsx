import type { AppBskyFeedDefs, BskyAgent } from "@atproto/api";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ExternalLink, FileText } from "lucide-react";
import React, { useMemo } from "react";
import type { SearchFilters as FacetedSearchFilters } from "../../hooks/useSearch";
import { proxifyBskyImage } from "../../utils/image-proxy";
import { ImageGrid } from "../ImageGrid";
import { LoadingSkeleton } from "../ui/LoadingSkeleton";
import { ProfileHoverCard } from "../ui/ProfileHoverCard";
import {
  filterByMediaType,
  getPostImages,
  postHasMedia,
  postMeetsEngagement,
} from "./search-utils";

interface SearchTabPostsProps {
  activeSearchQuery: string;
  agent: BskyAgent | null;
  sortOrder: "top" | "latest";
  facetedFilters: FacetedSearchFilters;
  hasMediaFilter: boolean;
  isPostHidden: (uri: string) => boolean;
  isUserMuted: (did: string) => boolean;
  isUserBlocked: (did: string) => boolean;
  isThreadMuted: (uri: string) => boolean;
  handlePostClick: (post: AppBskyFeedDefs.PostView) => void;
}

export const SearchTabPosts: React.FC<SearchTabPostsProps> = React.memo(
  ({
    activeSearchQuery,
    agent,
    sortOrder,
    facetedFilters,
    hasMediaFilter,
    isPostHidden,
    isUserMuted,
    isUserBlocked,
    isThreadMuted,
    handlePostClick,
  }) => {
    // Search posts query
    const {
      data: postsSearchResults,
      isLoading: isLoadingPosts,
      error: postsError,
    } = useQuery({
      queryKey: ["searchPosts", activeSearchQuery, hasMediaFilter, sortOrder],
      queryFn: async () => {
        if (!activeSearchQuery.trim()) return null;

        const response = await agent!.app.bsky.feed.searchPosts({
          q: activeSearchQuery,
          limit: 50,
          sort: sortOrder,
        });

        // Filter by media if needed
        if (hasMediaFilter) {
          const filteredPosts = response.data.posts.filter((post) =>
            postHasMedia(post),
          );
          return {
            ...response.data,
            posts: filteredPosts,
          };
        }

        return response.data;
      },
      enabled: !!agent && !!activeSearchQuery.trim(),
    });

    // Apply faceted filters to search results (client-side filtering)
    const filteredPostsSearchResults = useMemo(() => {
      if (!postsSearchResults?.posts) return postsSearchResults;

      let posts = postsSearchResults.posts;

      // Apply media type filter
      posts = filterByMediaType(posts, facetedFilters.mediaType);

      // Apply engagement thresholds
      const hasEngagementFilters =
        facetedFilters.engagement.minLikes > 0 ||
        facetedFilters.engagement.minReposts > 0 ||
        facetedFilters.engagement.minReplies > 0;

      if (hasEngagementFilters) {
        posts = posts.filter((post) =>
          postMeetsEngagement(post, facetedFilters.engagement),
        );
      }

      return { ...postsSearchResults, posts };
    }, [
      postsSearchResults,
      facetedFilters.mediaType,
      facetedFilters.engagement,
    ]);

    // Show loading state
    if (isLoadingPosts) {
      return <LoadingSkeleton variant="search" />;
    }

    // Show error state
    if (postsError) {
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
    if (postsSearchResults && filteredPostsSearchResults?.posts.length === 0) {
      return (
        <div
          className="rounded-xl border bg-white bg-opacity-5 p-6 text-center"
          style={{ borderColor: "var(--asph-border-primary)" }}
        >
          <FileText
            size={32}
            className="mx-auto mb-3 opacity-10"
            style={{ color: "var(--asph-text-secondary)" }}
          />
          <p
            className="mb-3 text-sm font-medium"
            style={{ color: "var(--asph-text-primary)" }}
          >
            No posts found matching your search
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
              <span>Check your spelling or try different keywords</span>
            </li>
            <li className="flex items-start gap-2">
              <span>•</span>
              <span>Try removing some filters or date restrictions</span>
            </li>
            <li className="flex items-start gap-2">
              <span>•</span>
              <span>Search for broader terms or hashtags</span>
            </li>
            <li className="flex items-start gap-2">
              <span>•</span>
              <span>Try switching to "Users" or "Feeds" tabs</span>
            </li>
          </ul>
        </div>
      );
    }

    // Show results
    if (
      postsSearchResults &&
      filteredPostsSearchResults?.posts &&
      filteredPostsSearchResults.posts.length > 0
    ) {
      const visiblePosts = filteredPostsSearchResults.posts.filter(
        (post) =>
          !isPostHidden(post.uri) &&
          !isUserMuted(post.author.did) &&
          !isUserBlocked(post.author.did) &&
          !isThreadMuted(post.uri),
      );

      return (
        <>
          <div className="mb-2 flex items-center justify-between">
            <p
              className="text-sm"
              style={{ color: "var(--asph-text-secondary)" }}
            >
              {visiblePosts.length} results
            </p>
          </div>

          {visiblePosts.map((post) => (
            <div
              key={post.uri}
              className="asph-glass cursor-pointer rounded-xl p-3 transition-all hover:shadow-lg sm:p-4"
              style={{
                border: "1px solid var(--asph-border-primary)",
              }}
              onClick={() => handlePostClick(post)}
            >
              <div className="flex items-start gap-2.5">
                <ProfileHoverCard handle={post.author.handle}>
                  <img
                    src={proxifyBskyImage(post.author.avatar)}
                    alt={post.author.displayName}
                    className="h-9 w-9 flex-shrink-0 cursor-pointer rounded-full transition-opacity hover:opacity-80"
                  />
                </ProfileHoverCard>
                <div className="min-w-0 flex-1">
                  <div className="mb-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <ProfileHoverCard handle={post.author.handle}>
                      <span
                        className="cursor-pointer truncate text-sm font-medium hover:underline"
                        style={{ color: "var(--asph-text-primary)" }}
                      >
                        {post.author.displayName}
                      </span>
                    </ProfileHoverCard>
                    <span
                      className="truncate text-xs"
                      style={{
                        color: "var(--asph-text-secondary)",
                      }}
                    >
                      @{post.author?.handle || "unknown"}
                    </span>
                    <span
                      className="whitespace-nowrap text-xs"
                      style={{ color: "var(--asph-text-tertiary)" }}
                    >
                      · {formatDistanceToNow(new Date(post.indexedAt))} ago
                    </span>
                  </div>
                  <div
                    className="break-words text-sm"
                    style={{ color: "var(--asph-text-primary)" }}
                  >
                    {(post.record as any).text}
                  </div>

                  {/* Display quoted post if present */}
                  {(() => {
                    const embed = post.embed as any;

                    // Check for quoted post (record embed or recordWithMedia)
                    const quotedPost =
                      embed?.$type === "app.bsky.embed.record#view"
                        ? embed.record
                        : embed?.$type === "app.bsky.embed.recordWithMedia#view"
                          ? embed.record?.record
                          : null;

                    if (
                      quotedPost &&
                      quotedPost.$type === "app.bsky.embed.record#viewRecord"
                    ) {
                      return (
                        <div className="mt-2 rounded-lg border border-asph-border-primary bg-asph-bg-secondary p-2.5">
                          <div className="mb-1 flex items-center gap-1.5">
                            {quotedPost.author?.avatar &&
                              quotedPost.author?.handle && (
                                <ProfileHoverCard
                                  handle={quotedPost.author.handle}
                                >
                                  <img
                                    src={proxifyBskyImage(
                                      quotedPost.author.avatar,
                                    )}
                                    alt={quotedPost.author.handle}
                                    className="h-4 w-4 cursor-pointer rounded-full transition-opacity hover:opacity-80"
                                  />
                                </ProfileHoverCard>
                              )}
                            {quotedPost.author?.handle ? (
                              <ProfileHoverCard
                                handle={quotedPost.author.handle}
                              >
                                <span className="cursor-pointer text-xs font-medium text-asph-text-secondary hover:underline">
                                  {quotedPost.author?.displayName ||
                                    quotedPost.author?.handle}
                                </span>
                              </ProfileHoverCard>
                            ) : (
                              <span className="text-xs font-medium text-asph-text-secondary">
                                Unknown
                              </span>
                            )}
                            <span className="text-xs text-asph-text-tertiary">
                              @{quotedPost.author?.handle || "unknown"}
                            </span>
                          </div>
                          <p className="text-xs leading-relaxed text-asph-text-primary">
                            {quotedPost.value?.text || "[No text]"}
                          </p>

                          {/* Show images from quoted post if it has them */}
                          {quotedPost.embeds &&
                            quotedPost.embeds[0] &&
                            quotedPost.embeds[0].$type ===
                              "app.bsky.embed.images#view" &&
                            quotedPost.embeds[0].images && (
                              <ImageGrid
                                images={quotedPost.embeds[0].images}
                                className="mt-2"
                              />
                            )}
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {/* Display images using ImageGrid component */}
                  {(() => {
                    const images = getPostImages(post);
                    if (images.length === 0) return null;
                    return <ImageGrid images={images} className="mt-3" />;
                  })()}

                  <div className="mt-2 flex items-center gap-3">
                    <span
                      className="text-xs"
                      style={{ color: "var(--asph-text-tertiary)" }}
                    >
                      Click to view thread
                    </span>
                    <a
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(
                          `https://bsky.app/profile/${post.author?.handle || "unknown"}/post/${post.uri.split("/").pop()}`,
                          "_blank",
                          "noopener,noreferrer",
                        );
                      }}
                      className="inline-flex cursor-pointer items-center gap-1 text-xs hover:underline"
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

SearchTabPosts.displayName = "SearchTabPosts";
