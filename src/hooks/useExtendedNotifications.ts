import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../contexts/AuthContext";
import { NotificationCacheService } from "../services/notification-cache-service";

/**
 * Hook to load extended notifications from IndexedDB
 * This ensures analytics data persists across page reloads
 */
export function useExtendedNotifications() {
  const { agent } = useAuth();
  const cacheService = NotificationCacheService.getInstance();

  const { data, isLoading, error } = useQuery({
    queryKey: ["notifications-extended-db"],
    queryFn: async () => {
      if (!agent) throw new Error("Not authenticated");

      // Check if IndexedDB is ready
      const isReady = await cacheService.isIndexedDBReady();
      if (!isReady) {
        return null;
      }

      // Check if we have cached data
      const hasCached = await cacheService.hasCachedData();
      if (!hasCached) {
        return null;
      }

      // Load all cached notifications
      const cachedResult = await cacheService.getCachedNotifications(50000); // Load up to 50k notifications

      if (cachedResult.notifications.length === 0) {
        return null;
      }

      // Convert to the format expected by analytics
      const pages = [];
      const pageSize = 100;
      for (let i = 0; i < cachedResult.notifications.length; i += pageSize) {
        const pageNotifications = cachedResult.notifications.slice(
          i,
          i + pageSize,
        );
        pages.push({
          notifications: pageNotifications,
          cursor:
            i + pageSize < cachedResult.notifications.length
              ? `page-${i + pageSize}`
              : undefined,
        });
      }

      return {
        pages,
        pageParams: [
          undefined,
          ...pages.slice(0, -1).map((_, i) => `page-${(i + 1) * pageSize}`),
        ],
      };
    },
    enabled: !!agent,
    staleTime: 5 * 60 * 1000, // Consider data stale after 5 minutes
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
    retry: 1,
  });

  // Also check React Query cache for in-memory data
  const queryClient = useQueryClient();
  const inMemoryData = queryClient.getQueryData([
    "notifications-extended",
  ]) as any;

  // Use in-memory data if available, otherwise use IndexedDB data
  const extendedData = inMemoryData?.pages?.length > 0 ? inMemoryData : data;
  const hasExtendedData = extendedData?.pages?.length > 0;

  return {
    extendedData,
    hasExtendedData,
    isLoading,
    error,
  };
}
