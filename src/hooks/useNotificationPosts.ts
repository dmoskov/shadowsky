import type {
  AppBskyFeedDefs,
  AppBskyNotificationListNotifications,
} from "@atproto/api";
import { debug } from "@bsky/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import React from "react";
import { useAuth } from "../contexts/AuthContext";
import { rateLimitedPostFetch } from "../services/rate-limiter";
import { PostCache } from "../utils/postCache";

type Post = AppBskyFeedDefs.PostView;

/**
 * Hook to fetch posts referenced in notifications
 * This is used to get full post data including embeds for image filtering
 */
export function useNotificationPosts(
  notifications:
    | AppBskyNotificationListNotifications.Notification[]
    | undefined,
) {
  const { session, agent } = useAuth();
  const queryClient = useQueryClient();
  const fetchedCountRef = React.useRef(0);
  const [isFetchingMore, setIsFetchingMore] = React.useState(false);
  const cancelledRef = React.useRef(false);

  // Create a stable query key based on unique post URIs, maintaining order
  const postUris = React.useMemo(() => {
    if (!notifications || notifications.length === 0) return [];

    // Maintain order of notifications as they appear in the feed
    const uriSet = new Set<string>();
    const orderedUris: string[] = [];

    notifications.forEach((notification) => {
      if (["like", "repost", "reply", "quote"].includes(notification.reason)) {
        // For reposts and likes, use reasonSubject which contains the original post URI
        const uri =
          (notification.reason === "repost" ||
            notification.reason === "like") &&
          notification.reasonSubject
            ? notification.reasonSubject
            : notification.uri;

        // Only add if we haven't seen this URI before
        if (!uriSet.has(uri)) {
          uriSet.add(uri);
          orderedUris.push(uri);
        }
      }
    });

    return orderedUris;
  }, [notifications]);

  const queryKey = React.useMemo(() => {
    if (postUris.length === 0) return ["notification-posts", "empty"];
    const sorted = [...postUris].sort();
    const str = sorted.join(",");
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
    }
    return ["notification-posts", `${hash}:${postUris.length}`];
  }, [postUris]);

  const queryResult = useQuery({
    queryKey,
    queryFn: async ({ signal }) => {
      if (postUris.length === 0) return [];

      // First, check if ALL posts are cached (not just first 200)
      const { cached: allCached, missing: allMissing } =
        await PostCache.getCachedPostsAsync(postUris);

      // If we have ALL posts cached, return them immediately - no progressive loading needed!
      if (allMissing.length === 0) {
        fetchedCountRef.current = allCached.length;
        debug.log(
          `🚀 All ${allCached.length} posts found in cache - instant load!`,
        );
        return allCached;
      }

      // Otherwise, do progressive loading starting with first 500
      const INITIAL_POSTS_TO_FETCH = 500;
      const urisToFetch = postUris.slice(0, INITIAL_POSTS_TO_FETCH);

      // Check cache for initial batch
      const { cached, missing } =
        await PostCache.getCachedPostsAsync(urisToFetch);

      // If we have the initial batch cached, use it
      if (missing.length === 0 && cached.length === urisToFetch.length) {
        fetchedCountRef.current = cached.length;
        return cached;
      }

      if (!agent) throw new Error("Not authenticated");

      // Batch fetch only missing posts (Bluesky API supports up to 25 posts per request)
      const posts: Post[] = [...cached]; // Start with cached posts

      for (let i = 0; i < missing.length; i += 25) {
        if (signal?.aborted) return posts; // bail early on cancellation

        const batch = missing.slice(i, i + 25);
        try {
          // Rate limit the API call
          const response = await rateLimitedPostFetch(async () =>
            agent.app.bsky.feed.getPosts({ uris: batch }),
          );
          const newPosts = response.data.posts as Post[];
          posts.push(...newPosts);

          // Cache the newly fetched posts
          PostCache.save(newPosts);
        } catch (error) {
          debug.error("Failed to fetch posts batch:", error);
        }
      }

      fetchedCountRef.current = posts.length;
      return posts;
    },
    enabled: !!session && !!agent && postUris.length > 0,
    staleTime: 60 * 60 * 1000, // 1 hour - posts rarely change
    gcTime: 2 * 60 * 60 * 1000, // Keep in cache for 2 hours
    refetchOnWindowFocus: false, // Don't refetch posts on window focus
    refetchOnMount: false, // Don't refetch when component remounts if data exists
    refetchOnReconnect: false, // Don't refetch on reconnect
    // Prevent flicker by keeping previous data while fetching
    placeholderData: (previousData) => previousData,
    // Use structural sharing to prevent unnecessary re-renders
    structuralSharing: true,
  });

  // Progressive fetch for remaining posts
  React.useEffect(() => {
    if (!session || !agent || !queryResult.data) return;

    // Check if we have unfetched posts
    const fetchedUris = new Set(
      (queryResult.data || []).map((post) => post.uri),
    );
    const unfetchedCount = postUris.filter(
      (uri) => !fetchedUris.has(uri),
    ).length;

    if (unfetchedCount === 0) {
      fetchedCountRef.current = queryResult.data?.length || 0;
      return;
    }

    // Use a cancelled flag to stop the recursive chain on cleanup
    cancelledRef.current = false;

    const fetchMorePosts = async () => {
      if (cancelledRef.current) return;
      setIsFetchingMore(true);
      if (!agent) return;

      // Smaller batches with more breathing room: each batch writes to the
      // query cache, which re-triggers the (expensive) notification
      // aggregation downstream. Large 200-post bursts caused render spikes;
      // smaller batches keep each update cheap and the main thread responsive.
      const batchNumber = Math.floor(fetchedCountRef.current / 100) + 1;
      const BATCH_SIZE = batchNumber <= 3 ? 75 : 50;
      const DELAY_BETWEEN_BATCHES = batchNumber <= 3 ? 400 : 1000;

      // Get already fetched URIs from current query data
      const currentData: Post[] | undefined =
        queryClient.getQueryData(queryKey);
      const currentFetchedUris = new Set(
        (currentData || []).map((post) => post.uri),
      );

      // Filter out URIs that have already been fetched
      const unfetchedUris = postUris.filter(
        (uri) => !currentFetchedUris.has(uri),
      );

      if (unfetchedUris.length === 0 || cancelledRef.current) {
        setIsFetchingMore(false);
        return;
      }

      // Take the next batch of unfetched URIs in order
      const urisToFetch = unfetchedUris.slice(0, BATCH_SIZE);

      // Check cache first for this batch
      const { cached: cachedBatch, missing: missingBatch } =
        await PostCache.getCachedPostsAsync(urisToFetch);
      const newPosts: Post[] = [...cachedBatch];

      // Only fetch missing posts from API
      if (missingBatch.length > 0 && !cancelledRef.current) {
        for (let i = 0; i < missingBatch.length; i += 25) {
          if (cancelledRef.current) break;
          const batch = missingBatch.slice(i, i + 25);
          try {
            const response = await rateLimitedPostFetch(async () =>
              agent.app.bsky.feed.getPosts({ uris: batch }),
            );
            const fetchedPosts = response.data.posts as Post[];
            newPosts.push(...fetchedPosts);

            // Cache the newly fetched posts
            PostCache.save(fetchedPosts);

            // Small delay between API calls within a batch to ease pressure
            if (i + 25 < missingBatch.length) {
              await new Promise((resolve) => setTimeout(resolve, 100));
            }
          } catch (error) {
            debug.error("Failed to fetch additional posts batch:", error);
          }
        }
      }

      if (cancelledRef.current) return;

      // Update the query data with new posts
      if (newPosts.length > 0) {
        queryClient.setQueryData(queryKey, (oldData: Post[] | undefined) => {
          const updatedData = [...(oldData || []), ...newPosts];
          return updatedData;
        });
        fetchedCountRef.current += newPosts.length;
      }

      setIsFetchingMore(false);

      // Schedule next batch if there are more unfetched posts
      if (unfetchedUris.length > BATCH_SIZE && !cancelledRef.current) {
        await new Promise((resolve) =>
          setTimeout(resolve, DELAY_BETWEEN_BATCHES),
        );
        if (!cancelledRef.current) {
          fetchMorePosts();
        }
      }
    };

    // Start fetching more posts after a short delay
    const timeoutId = setTimeout(fetchMorePosts, 50);
    return () => {
      cancelledRef.current = true;
      clearTimeout(timeoutId);
    };
  }, [session, agent, queryResult.data, postUris, queryClient, queryKey]);

  // Calculate actual fetched count based on current data
  const actualFetchedCount = queryResult.data?.length || 0;

  return {
    ...queryResult,
    totalPosts: postUris.length,
    fetchedPosts: actualFetchedCount,
    isFetchingMore,
    percentageFetched:
      postUris.length > 0
        ? Math.round((actualFetchedCount / postUris.length) * 100)
        : 100,
  };
}

/**
 * Check if a post has image embeds
 */
export function postHasImages(post: Post): boolean {
  if (!post.embed) return false;

  const embed = post.embed as
    | { $type: string; media?: { $type: string } }
    | undefined;

  if (!embed) return false;

  // Check for direct image embed
  if (embed.$type === "app.bsky.embed.images#view") {
    return true;
  }

  // Check for images in record with media embed
  if (
    embed.$type === "app.bsky.embed.recordWithMedia#view" &&
    embed.media?.$type === "app.bsky.embed.images#view"
  ) {
    return true;
  }

  return false;
}
