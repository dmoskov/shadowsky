/**
 * Hook for computing and caching posting time recommendations from post data.
 */

import { useMemo } from "react";
import type { OptimalPostingTimes } from "../services/anthropic";
import {
  analyzePostingTimes,
  cacheAnalysis,
  fromApiResponse,
  getCachedAnalysis,
  type PostingTimeAnalysis,
  type PostTimingData,
} from "../services/posting-time-recommendations";

/**
 * Compute posting time analysis from raw post data.
 * Caches the result for use by the scheduler's suggested times.
 */
export function usePostingTimeRecommendations(
  posts: PostTimingData[] | undefined,
): PostingTimeAnalysis | null {
  return useMemo(() => {
    if (!posts || posts.length < 5) return null;

    const analysis = analyzePostingTimes(posts);
    if (analysis.recommendations.length > 0) {
      cacheAnalysis(analysis);
    }
    return analysis;
  }, [posts]);
}

/**
 * Use posting time analysis from the API response (from AI analysis).
 * Caches the result for use by the scheduler's suggested times.
 */
export function useApiPostingTimeRecommendations(
  apiData: OptimalPostingTimes | undefined,
  postCount: number,
): PostingTimeAnalysis | null {
  return useMemo(() => {
    if (!apiData || !apiData.recommendations?.length) return null;

    const analysis = fromApiResponse(apiData, postCount);
    cacheAnalysis(analysis);
    return analysis;
  }, [apiData, postCount]);
}

/**
 * Get cached posting time analysis (no computation, just reads cache).
 */
export function useCachedPostingTimeRecommendations(): PostingTimeAnalysis | null {
  return useMemo(() => getCachedAnalysis(), []);
}
