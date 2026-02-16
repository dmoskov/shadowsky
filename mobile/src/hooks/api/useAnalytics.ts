import { useQuery } from "@tanstack/react-query";
import {
  getUserAnalytics,
  getFollowerMetrics,
  TimeRange,
} from "../../services/atproto/analytics";
import {
  analyzePosts,
  type PostAnalysisPost,
  type PostAnalysisResult,
} from "../../services/ai-service";

/**
 * Hook to fetch user analytics for a specific time range
 */
export function useUserAnalytics(actor: string, timeRange: TimeRange) {
  return useQuery({
    queryKey: ["analytics", actor, timeRange],
    queryFn: () => getUserAnalytics(actor, timeRange),
    enabled: !!actor,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch follower metrics
 */
export function useFollowerMetrics(actor: string) {
  return useQuery({
    queryKey: ["followerMetrics", actor],
    queryFn: () => getFollowerMetrics(actor),
    enabled: !!actor,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to run AI analysis on user posts
 * Only runs when explicitly enabled (user clicks "Analyze")
 */
export function usePostAnalysis(
  posts: PostAnalysisPost[] | undefined,
  enabled: boolean,
) {
  return useQuery<PostAnalysisResult>({
    queryKey: ["post-analysis", posts?.length],
    queryFn: () => {
      if (!posts || posts.length === 0) {
        throw new Error("No posts available for analysis");
      }
      return analyzePosts(posts);
    },
    enabled: enabled && !!posts && posts.length > 0,
    staleTime: 30 * 60 * 1000, // Cache for 30 minutes
  });
}
