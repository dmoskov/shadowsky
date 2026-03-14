/**
 * Hook for fetching and managing trending topics and trends
 */

import { useQuery } from "@tanstack/react-query";
import {
  getTrendingTopics,
  getTrends,
  TRENDING_CACHE_TTL,
  type Trend,
  type TrendingTopic,
} from "../services/trending-service";

interface UseTrendingTopicsOptions {
  limit?: number;
  viewer?: string;
  enabled?: boolean;
}

interface UseTrendsOptions {
  limit?: number;
  enabled?: boolean;
}

/**
 * Hook to fetch trending topics (simpler format with topics and suggested feeds)
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
 * Hook to fetch trends (detailed format with actors and post counts)
 */
export function useTrends(options: UseTrendsOptions = {}) {
  const { limit = 10, enabled = true } = options;

  return useQuery({
    queryKey: ["trends", limit],
    queryFn: () => getTrends(limit),
    staleTime: TRENDING_CACHE_TTL,
    gcTime: TRENDING_CACHE_TTL * 2,
    enabled,
    refetchOnWindowFocus: false,
  });
}

/**
 * Combined hook for both trending topics and trends
 */
export function useTrendingData(options: UseTrendingTopicsOptions = {}) {
  const { limit = 10, viewer, enabled = true } = options;

  const trendingTopicsQuery = useTrendingTopics({ limit, viewer, enabled });
  const trendsQuery = useTrends({ limit, enabled });

  return {
    // Trending topics (simpler format)
    topics: trendingTopicsQuery.data?.topics ?? [],
    suggested: trendingTopicsQuery.data?.suggested ?? [],
    isLoadingTopics: trendingTopicsQuery.isLoading,
    topicsError: trendingTopicsQuery.error,

    // Detailed trends
    trends: trendsQuery.data?.trends ?? [],
    source: trendsQuery.data?.source ?? null,
    isLoadingTrends: trendsQuery.isLoading,
    trendsError: trendsQuery.error,

    // Combined loading state
    isLoading: trendingTopicsQuery.isLoading || trendsQuery.isLoading,
    error: trendingTopicsQuery.error || trendsQuery.error,

    // Refetch functions
    refetchTopics: trendingTopicsQuery.refetch,
    refetchTrends: trendsQuery.refetch,
    refetchAll: () => {
      trendingTopicsQuery.refetch();
      trendsQuery.refetch();
    },
  };
}

export type { Trend, TrendingTopic };
