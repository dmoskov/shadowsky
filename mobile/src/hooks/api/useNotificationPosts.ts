/**
 * Hook to fetch posts referenced in notifications.
 * Provides rich post data (text, embeds, author info) for notification previews.
 * Adapted from the web version (src/hooks/useNotificationPosts.ts).
 */

import {useMemo} from 'react';
import {useQuery} from '@tanstack/react-query';
import {AppBskyNotificationListNotifications, AppBskyFeedDefs} from '@atproto/api';
import {getAgent} from '../../services/atproto/client';
import {rateLimited, ATProtoEndpointType} from '../../services/rate-limiter';

type Notification = AppBskyNotificationListNotifications.Notification;
type PostView = AppBskyFeedDefs.PostView;

/**
 * Hook to fetch posts referenced in notifications.
 * Returns a map of post URI -> PostView for rich rendering.
 */
export function useNotificationPosts(notifications: Notification[] | undefined) {
  // Extract unique post URIs that need fetching
  const postUris = useMemo(() => {
    if (!notifications || notifications.length === 0) return [];

    const uriSet = new Set<string>();
    const orderedUris: string[] = [];

    notifications.forEach(notification => {
      if (['like', 'repost', 'reply', 'quote', 'like-via-repost', 'repost-via-repost'].includes(notification.reason)) {
        const uri =
          (notification.reason === 'repost' || notification.reason === 'like' ||
           notification.reason === 'like-via-repost' || notification.reason === 'repost-via-repost') &&
          notification.reasonSubject
            ? notification.reasonSubject
            : notification.uri;

        if (!uriSet.has(uri)) {
          uriSet.add(uri);
          orderedUris.push(uri);
        }
      }
    });

    return orderedUris;
  }, [notifications]);

  // Stable query key based on URIs
  const queryKey = useMemo(() => {
    if (postUris.length === 0) return ['notification-posts-mobile', 'empty'];
    const sorted = [...postUris].sort();
    const str = sorted.join(',');
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
    }
    return ['notification-posts-mobile', `${hash}:${postUris.length}`];
  }, [postUris]);

  const queryResult = useQuery({
    queryKey,
    queryFn: async () => {
      if (postUris.length === 0) return [];

      const agent = getAgent();
      const posts: PostView[] = [];

      // Bluesky API supports up to 25 posts per request
      for (let i = 0; i < postUris.length; i += 25) {
        const batch = postUris.slice(i, i + 25);
        try {
          const response = await rateLimited(
            async () => agent.app.bsky.feed.getPosts({uris: batch}),
            ATProtoEndpointType.FEED,
          );
          posts.push(...(response.data.posts as PostView[]));
        } catch {
          // Skip failed batches
        }
      }

      return posts;
    },
    enabled: postUris.length > 0,
    staleTime: 60 * 60 * 1000, // 1 hour
    gcTime: 2 * 60 * 60 * 1000, // 2 hours
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    placeholderData: previousData => previousData,
  });

  // Build a post map for quick lookup
  const postMap = useMemo(() => {
    if (!queryResult.data) return new Map<string, PostView>();
    return new Map(queryResult.data.map(post => [post.uri, post]));
  }, [queryResult.data]);

  return {
    ...queryResult,
    postMap,
    totalPosts: postUris.length,
    fetchedPosts: queryResult.data?.length || 0,
  };
}
