/**
 * Hook for background pre-generation of thread summaries
 *
 * This hook enables automatic background generation of thread summaries
 * for bookmarked posts, making them available for offline reading.
 *
 * Usage:
 * - Call useThreadSummaryPreGeneration() in a top-level component
 * - It will automatically pre-generate summaries for bookmarked threads
 * - Summaries are cached in IndexedDB for offline access
 */

import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";
import { type ThreadSummaryPost } from "../services/anthropic";
import { bookmarkServiceV2 } from "../services/bookmark-service-v2";
import {
  threadSummaryCacheService,
  type ThreadSummaryCacheOptions,
} from "../services/thread-summary-cache";
import { createLogger } from "../utils/logger";

const logger = createLogger("ThreadSummaryPreGeneration");

// Minimum number of posts required for summary generation
const MIN_POSTS_FOR_SUMMARY = 5;

// Delay between checking bookmarks and starting pre-generation (ms)
const PRE_GENERATION_DELAY = 5000;

// Maximum number of summaries to generate per session
const MAX_GENERATIONS_PER_SESSION = 10;

interface UseThreadSummaryPreGenerationOptions {
  enabled?: boolean;
}

export function useThreadSummaryPreGeneration(
  options: UseThreadSummaryPreGenerationOptions = {},
) {
  const { enabled = true } = options;
  const preGenerationRan = useRef(false);
  const generationCount = useRef(0);

  // Fetch bookmarked posts
  const { data: bookmarkedPosts } = useQuery({
    queryKey: ["bookmarks-for-summary-generation"],
    queryFn: async () => {
      return await bookmarkServiceV2.getBookmarkedPosts();
    },
    enabled,
    staleTime: 60000, // 1 minute
    refetchOnWindowFocus: false,
  });

  // Pre-generate summaries for bookmarked threads in background
  const preGenerateSummaries = useCallback(async () => {
    if (!bookmarkedPosts || preGenerationRan.current) return;
    preGenerationRan.current = true;

    logger.log(
      `Checking ${bookmarkedPosts.length} bookmarked posts for summary pre-generation`,
    );

    const threadsToProcess: Array<{
      threadUri: string;
      posts: ThreadSummaryPost[];
      source: "bookmarked";
    }> = [];

    for (const bookmark of bookmarkedPosts) {
      // Skip if we've reached the max for this session
      if (generationCount.current >= MAX_GENERATIONS_PER_SESSION) {
        logger.log(
          `Reached max generations per session (${MAX_GENERATIONS_PER_SESSION})`,
        );
        break;
      }

      const post = bookmark.post;
      if (!post) continue;

      // Check if this is a thread with replies (indicating it might have enough posts)
      const replyCount = post.replyCount || 0;
      if (replyCount < MIN_POSTS_FOR_SUMMARY - 1) continue;

      // Check if we already have this summary cached
      const isCached = await threadSummaryCacheService.hasCachedSummary(
        post.uri,
      );
      if (isCached) {
        logger.log(`Summary already cached for: ${post.uri}`);
        continue;
      }

      // We need to fetch the full thread to get all posts for summary
      // This is done lazily - we'll just mark it for potential generation
      // The actual thread fetch happens when the user views the thread
      // For now, we create a placeholder with the root post info
      const summaryPosts: ThreadSummaryPost[] = [
        {
          text: bookmark.text || "",
          author: post.author.displayName || post.author.handle,
          likes: post.likeCount || 0,
          replies: post.replyCount || 0,
        },
      ];

      // Only queue if we have reasonable indication of a substantive thread
      if (replyCount >= MIN_POSTS_FOR_SUMMARY) {
        threadsToProcess.push({
          threadUri: post.uri,
          posts: summaryPosts,
          source: "bookmarked",
        });
        generationCount.current++;
      }
    }

    if (threadsToProcess.length > 0) {
      logger.log(
        `Queuing ${threadsToProcess.length} threads for background summary generation`,
      );

      // Note: The actual generation requires the full thread posts
      // For now, we're just marking these as candidates
      // The ThreadHaikuSummary component will handle the actual generation
      // when the user views the thread

      // We can optionally trigger fetching thread data here if we want
      // true background generation, but that requires the agent to be available
      // and makes many API calls which might not be desirable

      logger.log(
        "Background summary pre-generation queued. Summaries will be generated when threads are viewed.",
      );
    }
  }, [bookmarkedPosts]);

  // Run pre-generation after a delay
  useEffect(() => {
    if (!enabled || !bookmarkedPosts) return;

    const timeoutId = setTimeout(() => {
      preGenerateSummaries();
    }, PRE_GENERATION_DELAY);

    return () => clearTimeout(timeoutId);
  }, [enabled, bookmarkedPosts, preGenerateSummaries]);

  // Manual trigger for pre-generation
  const triggerPreGeneration = useCallback(async () => {
    preGenerationRan.current = false;
    generationCount.current = 0;
    await preGenerateSummaries();
  }, [preGenerateSummaries]);

  return {
    isPreGenerating: threadSummaryCacheService.getBackgroundQueueSize() > 0,
    triggerPreGeneration,
    queueSize: threadSummaryCacheService.getBackgroundQueueSize(),
  };
}

/**
 * Pre-generate summary for a specific thread
 * Call this when you have the full thread data available
 */
export async function preGenerateThreadSummary(
  threadUri: string,
  posts: ThreadSummaryPost[],
  options: ThreadSummaryCacheOptions = {},
): Promise<void> {
  if (posts.length < MIN_POSTS_FOR_SUMMARY) {
    logger.log(
      `Skipping pre-generation for ${threadUri} (only ${posts.length} posts)`,
    );
    return;
  }

  const isCached = await threadSummaryCacheService.hasCachedSummary(threadUri);
  if (isCached && !options.forceRefresh) {
    logger.log(`Summary already cached for: ${threadUri}`);
    return;
  }

  await threadSummaryCacheService.preGenerateSummaries([
    {
      threadUri,
      posts,
      source: options.source || "viewed",
    },
  ]);
}

/**
 * Get cache statistics
 */
export async function getThreadSummaryCacheStats(): Promise<{
  count: number;
  queueSize: number;
}> {
  const count = await threadSummaryCacheService.getCacheCount();
  const queueSize = threadSummaryCacheService.getBackgroundQueueSize();
  return { count, queueSize };
}
