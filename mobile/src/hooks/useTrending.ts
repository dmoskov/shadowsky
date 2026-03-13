/**
 * Hook for fetching and managing trending topics and trends.
 *
 * Primary source: Pan's firehose-powered trending API
 * Fallback: Bluesky's native getTrendingTopics
 */

import { useQuery } from "@tanstack/react-query";
import {
  getTrendingTopics,
  getTrends,
  TRENDING_CACHE_TTL,
  type Trend,
  type TrendingTopic,
  type TrendsResponse,
} from "../services/trending-service";

interface UseTrendingTopicsOptions {
  limit?: number;
  viewer?: string;
  enabled?: boolean;
}

interface UseTrendsOptions {
  limit?: number;
  hours?: number;
  enabled?: boolean;
}

/**
 * Hook to fetch trending topics (simpler format — backward compat)
 */
export function useTrendingTopics(options: UseTrendingTopicsOptions = {}) {
  const { limit = 10, viewer, enabled = true } = options;

  return useQuery({
    queryKey: ["trendingTopics", limit, viewer],
    queryFn: () => getTrendingTopics(limit, viewer),
    staleTime: TRENDING_CACHE_TTL,
    gcTime: TRENDING_CACHE_TTL * 2,
    enabled,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to fetch rich trends from Pan (with velocity, author counts, sample posts).
 * Automatically falls back to Bluesky if Pan is unreachable.
 */
export function useTrends(options: UseTrendsOptions = {}) {
  const { limit = 20, hours = 6, enabled = true } = options;

  return useQuery({
    queryKey: ["trends", limit, hours],
    queryFn: () => getTrends(limit, hours),
    staleTime: TRENDING_CACHE_TTL,
    gcTime: TRENDING_CACHE_TTL * 2,
    enabled,
    refetchOnWindowFocus: false,
  });
}

/**
 * Combined hook — the main one to use.
 * Returns rich trends when available, simple topics as fallback.
 */
export function useTrendingData(options: UseTrendingTopicsOptions = {}) {
  const { limit = 20, viewer, enabled = true } = options;

  const trendsQuery = useTrends({ limit, enabled });

  // Only fetch simple topics if trends failed or returned from Bluesky fallback
  // with no actual trend data
  const needsTopicsFallback =
    trendsQuery.isError ||
    (trendsQuery.data?.trends.length === 0 && !trendsQuery.isLoading);

  const trendingTopicsQuery = useTrendingTopics({
    limit,
    viewer,
    enabled: enabled && needsTopicsFallback,
  });

  return {
    // Rich trends (Pan or Bluesky detailed)
    trends: trendsQuery.data?.trends ?? [],
    source: trendsQuery.data?.source ?? null,
    isLoadingTrends: trendsQuery.isLoading,
    trendsError: trendsQuery.error,

    // Simple topics (fallback only)
    topics: trendingTopicsQuery.data?.topics ?? [],
    suggested: trendingTopicsQuery.data?.suggested ?? [],
    isLoadingTopics: trendingTopicsQuery.isLoading,
    topicsError: trendingTopicsQuery.error,

    // Combined
    isLoading: trendsQuery.isLoading || (needsTopicsFallback && trendingTopicsQuery.isLoading),
    error: trendsQuery.error || trendingTopicsQuery.error,

    refetchAll: () => {
      trendsQuery.refetch();
      if (needsTopicsFallback) trendingTopicsQuery.refetch();
    },
  };
}

export type { Trend, TrendingTopic, TrendsResponse };
