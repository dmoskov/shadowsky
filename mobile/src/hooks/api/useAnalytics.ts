import { useQuery } from "@tanstack/react-query";
import {
  getUserAnalytics,
  getFollowerMetrics,
  TimeRange,
} from "../../services/atproto/analytics";

/**
 * Hook to fetch user analytics for a specific time range
 */
export function useUserAnalytics(actor: string, timeRange: TimeRange) {
  return useQuery({
    queryKey: ["analytics", actor, timeRange],
    queryFn: () => getUserAnalytics(actor, timeRange),
    enabled: !!actor,
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
  });
}
