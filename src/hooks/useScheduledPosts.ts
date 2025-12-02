/**
 * useScheduledPosts Hook
 *
 * React Query hook for managing scheduled posts with real-time updates.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  CreateScheduledPostInput,
  ScheduledPost,
  ScheduledPostFilter,
  ScheduledPostStatus,
  schedulerService,
  UpdateScheduledPostInput,
} from "../services/scheduled-posts";

const QUERY_KEYS = {
  all: ["scheduledPosts"] as const,
  list: (filter?: ScheduledPostFilter) =>
    [...QUERY_KEYS.all, "list", filter] as const,
  stats: () => [...QUERY_KEYS.all, "stats"] as const,
  single: (id: string) => [...QUERY_KEYS.all, "single", id] as const,
  byDate: (date: string) => [...QUERY_KEYS.all, "byDate", date] as const,
  byDateRange: (start: string, end: string) =>
    [...QUERY_KEYS.all, "byDateRange", start, end] as const,
};

/**
 * Hook to initialize the scheduler service
 */
export function useSchedulerInit() {
  const { session } = useAuth();

  useEffect(() => {
    if (session?.did) {
      schedulerService.init(session.did).catch(console.error);
    }

    return () => {
      schedulerService.stop();
    };
  }, [session?.did]);
}

/**
 * Hook to fetch all scheduled posts with optional filtering
 */
export function useScheduledPosts(filter?: ScheduledPostFilter) {
  const queryClient = useQueryClient();

  // Subscribe to real-time events
  useEffect(() => {
    const unsubscribe = schedulerService.subscribe(() => {
      // Invalidate queries on any change
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.all });
    });

    return unsubscribe;
  }, [queryClient]);

  return useQuery({
    queryKey: QUERY_KEYS.list(filter),
    queryFn: () => schedulerService.getAll(filter),
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Hook to fetch pending scheduled posts (most common use case)
 */
export function usePendingScheduledPosts() {
  return useScheduledPosts({ status: "pending" });
}

/**
 * Hook to fetch scheduled posts for a specific date
 */
export function useScheduledPostsByDate(date: Date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  return useScheduledPosts({
    scheduledAfter: startOfDay.toISOString(),
    scheduledBefore: endOfDay.toISOString(),
    status: ["pending", "processing"],
  });
}

/**
 * Hook to fetch scheduled posts for a date range
 */
export function useScheduledPostsByDateRange(startDate: Date, endDate: Date) {
  return useScheduledPosts({
    scheduledAfter: startDate.toISOString(),
    scheduledBefore: endDate.toISOString(),
    status: ["pending", "processing", "failed"],
  });
}

/**
 * Hook to fetch queue statistics
 */
export function useScheduledPostStats() {
  return useQuery({
    queryKey: QUERY_KEYS.stats(),
    queryFn: () => schedulerService.getStats(),
    staleTime: 10 * 1000, // 10 seconds
    refetchInterval: 30 * 1000, // Auto-refresh every 30 seconds
  });
}

/**
 * Hook to fetch a single scheduled post
 */
export function useScheduledPost(id: string) {
  return useQuery({
    queryKey: QUERY_KEYS.single(id),
    queryFn: () => schedulerService.get(id),
    enabled: !!id,
  });
}

/**
 * Hook to create a scheduled post
 */
export function useCreateScheduledPost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateScheduledPostInput) =>
      schedulerService.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.all });
    },
  });
}

/**
 * Hook to update a scheduled post
 */
export function useUpdateScheduledPost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      updates,
    }: {
      id: string;
      updates: UpdateScheduledPostInput;
    }) => schedulerService.update(id, updates),
    onSuccess: (post) => {
      if (post) {
        queryClient.setQueryData(QUERY_KEYS.single(post.id), post);
      }
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.all });
    },
  });
}

/**
 * Hook to cancel a scheduled post
 */
export function useCancelScheduledPost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => schedulerService.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.all });
    },
  });
}

/**
 * Hook to delete a scheduled post
 */
export function useDeleteScheduledPost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => schedulerService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.all });
    },
  });
}

/**
 * Hook to reschedule a post to a new time
 */
export function useReschedulePost() {
  const updateMutation = useUpdateScheduledPost();

  return useMutation({
    mutationFn: ({ id, newTime }: { id: string; newTime: Date }) =>
      updateMutation.mutateAsync({
        id,
        updates: { scheduledFor: newTime.toISOString() },
      }),
  });
}

/**
 * Group scheduled posts by date for calendar view
 */
export function useScheduledPostsGroupedByDate(startDate: Date, endDate: Date) {
  const { data: posts, ...rest } = useScheduledPostsByDateRange(
    startDate,
    endDate,
  );

  const groupedPosts = useCallback(() => {
    if (!posts) return new Map<string, ScheduledPost[]>();

    const grouped = new Map<string, ScheduledPost[]>();

    posts.forEach((post) => {
      const dateKey = new Date(post.scheduledFor).toDateString();
      const existing = grouped.get(dateKey) || [];
      grouped.set(dateKey, [...existing, post]);
    });

    // Sort posts within each day by scheduled time
    grouped.forEach((dayPosts, key) => {
      grouped.set(
        key,
        dayPosts.sort(
          (a, b) =>
            new Date(a.scheduledFor).getTime() -
            new Date(b.scheduledFor).getTime(),
        ),
      );
    });

    return grouped;
  }, [posts]);

  return {
    ...rest,
    data: posts,
    groupedByDate: groupedPosts(),
  };
}

/**
 * Get status color for a scheduled post
 */
export function getStatusColor(status: ScheduledPostStatus): string {
  switch (status) {
    case "pending":
      return "var(--bsky-primary)"; // Blue
    case "processing":
      return "var(--bsky-warning, #f59e0b)"; // Amber
    case "completed":
      return "var(--bsky-success, #22c55e)"; // Green
    case "failed":
      return "var(--bsky-error, #ef4444)"; // Red
    case "cancelled":
      return "var(--bsky-text-tertiary)"; // Gray
    default:
      return "var(--bsky-text-secondary)";
  }
}

/**
 * Get status label for display
 */
export function getStatusLabel(status: ScheduledPostStatus): string {
  switch (status) {
    case "pending":
      return "Scheduled";
    case "processing":
      return "Publishing...";
    case "completed":
      return "Published";
    case "failed":
      return "Failed";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}
