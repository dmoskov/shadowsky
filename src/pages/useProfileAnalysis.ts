import type { AppBskyFeedDefs } from "@atproto/api";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../contexts/AuthContext";
import { analyzePosts } from "../services/anthropic";

/**
 * Drives the two-stage AI profile analysis:
 * 1. A fast "haiku" pass over posts already in memory (instant start).
 * 2. A deeper "sonnet" pass that fetches up to ~200 posts in parallel.
 *
 * The displayed result upgrades from haiku to sonnet as soon as sonnet is
 * ready. Extracted from ProfilePage to keep the component focused on layout.
 *
 * @param handle   the profile handle being viewed
 * @param posts    the author-feed posts already loaded in the page
 * @param enabled  whether analysis has been requested by the user
 */
export function useProfileAnalysis(
  handle: string | undefined,
  posts: AppBskyFeedDefs.FeedViewPost[],
  enabled: boolean,
) {
  const { agent } = useAuth();

  // Transform posts already in memory for quick haiku analysis
  const postsInMemory = posts
    .filter((item) => {
      const isRepost = item.reason?.$type === "app.bsky.feed.defs#reasonRepost";
      return !isRepost;
    })
    .map((item) => ({
      text: (item.post.record as { text?: string })?.text || "",
      createdAt: item.post.indexedAt,
      likes: item.post.likeCount || 0,
      reposts: item.post.repostCount || 0,
      replies: item.post.replyCount || 0,
    }));

  // Quick haiku analysis using posts already in memory (instant start)
  const {
    data: haikuAnalysis,
    isLoading: isLoadingHaiku,
    error: haikuError,
  } = useQuery({
    queryKey: ["profile-analysis-haiku", handle],
    queryFn: async () => {
      if (postsInMemory.length === 0) throw new Error("No posts in memory");
      return await analyzePosts(postsInMemory, "haiku");
    },
    staleTime: 30 * 60 * 1000,
    enabled: enabled && postsInMemory.length > 0,
  });

  // Fetch more posts for deeper Sonnet analysis (in parallel)
  const { data: postsForSonnet, isLoading: isLoadingPostsForSonnet } = useQuery(
    {
      queryKey: ["profile-posts-for-sonnet", handle],
      queryFn: async () => {
        if (!agent || !handle) throw new Error("No handle to analyze");

        const allPosts: AppBskyFeedDefs.FeedViewPost[] = [];
        let fetchCursor: string | undefined;
        const maxPages = 4; // Fetch up to 200 posts for deeper analysis

        for (let page = 0; page < maxPages; page++) {
          const response = await agent.getAuthorFeed({
            actor: handle,
            limit: 50,
            cursor: fetchCursor,
          });

          const filteredPosts = response.data.feed.filter((item) => {
            const isRepost =
              item.reason?.$type === "app.bsky.feed.defs#reasonRepost";
            return !isRepost;
          });

          allPosts.push(...filteredPosts);
          fetchCursor = response.data.cursor;
          if (!fetchCursor) break;
        }

        if (allPosts.length === 0) {
          throw new Error("No posts available for analysis");
        }

        return allPosts.map((item) => ({
          text: (item.post.record as { text?: string })?.text || "",
          createdAt: item.post.indexedAt,
          likes: item.post.likeCount || 0,
          reposts: item.post.repostCount || 0,
          replies: item.post.replyCount || 0,
        }));
      },
      staleTime: 30 * 60 * 1000,
      enabled: enabled && !!handle && !!agent,
    },
  );

  // Full sonnet analysis with more posts (detailed)
  const {
    data: sonnetAnalysis,
    isLoading: isLoadingSonnet,
    error: sonnetError,
  } = useQuery({
    queryKey: ["profile-analysis-sonnet", handle],
    queryFn: async () => {
      if (!postsForSonnet) throw new Error("Posts not loaded");
      return await analyzePosts(postsForSonnet, "sonnet");
    },
    staleTime: 30 * 60 * 1000,
    enabled: !!postsForSonnet,
  });

  // Use haiku if available, then upgrade to sonnet when ready
  const analysisData = sonnetAnalysis || haikuAnalysis;
  const isLoadingAnalysis =
    (isLoadingHaiku && !haikuAnalysis) ||
    (isLoadingPostsForSonnet && isLoadingSonnet && !haikuAnalysis);
  // Show error if both haiku and sonnet fail (or sonnet fails after haiku succeeds)
  const analysisError = sonnetError || haikuError;

  return {
    analysisData,
    isLoadingAnalysis,
    analysisError,
    haikuAnalysis,
    sonnetAnalysis,
  };
}
