import {useEffect, useRef, useCallback} from 'react';
import {InteractionManager} from 'react-native';
import {useQueryClient} from '@tanstack/react-query';
import {AppBskyFeedDefs} from '@atproto/api';
import {getPostThread} from '../services/atproto/feeds';
import {getProfile} from '../services/atproto/profiles';
import {useNetworkStatus} from './useNetworkStatus';
import {useIsScrolling} from './useScrollState';
import {useVideoAutoplay} from '../contexts/VideoAutoplayContext';

const PREFETCH_COUNT = 5;
const THREAD_STALE_TIME = 60_000; // 1 minute
const PROFILE_STALE_TIME = 300_000; // 5 minutes
const MAX_PREFETCHED_SET_SIZE = 200;

/**
 * Prefetches thread and profile data for feed posts so that tapping
 * a post or avatar opens the destination instantly from cache.
 *
 * Prefetching is automatically skipped when:
 * - The device is in Low Power Mode
 * - The network quality is poor or offline
 * - The user is actively scrolling
 *
 * Only the first {@link PREFETCH_COUNT} posts are prefetched to limit
 * network and memory overhead. A tracking set with eviction prevents
 * unbounded growth during long scrolling sessions.
 */
export function useDataPrefetch(posts: AppBskyFeedDefs.FeedViewPost[]) {
  const queryClient = useQueryClient();
  const {networkQuality} = useNetworkStatus();
  const isScrolling = useIsScrolling();
  const {isLowPowerMode} = useVideoAutoplay();

  // Store volatile conditions in refs so the prefetch callback doesn't
  // need to be recreated on every scroll/network/battery state change.
  const networkQualityRef = useRef(networkQuality);
  networkQualityRef.current = networkQuality;
  const isScrollingRef = useRef(isScrolling);
  isScrollingRef.current = isScrolling;
  const isLowPowerModeRef = useRef(isLowPowerMode);
  isLowPowerModeRef.current = isLowPowerMode;

  const prefetchedThreads = useRef(new Set<string>());
  const prefetchedProfiles = useRef(new Set<string>());

  // Stable callback — only depends on queryClient (which is stable).
  const prefetchPosts = useCallback(
    (feedPosts: AppBskyFeedDefs.FeedViewPost[]) => {
      if (isLowPowerModeRef.current) return;
      if (
        networkQualityRef.current === 'offline' ||
        networkQualityRef.current === 'poor'
      ) {
        return;
      }
      if (isScrollingRef.current) return;

      const candidates = feedPosts.slice(0, PREFETCH_COUNT);

      for (const item of candidates) {
        const uri = item.post.uri;
        const authorHandle = item.post.author.handle;

        // Prefetch thread data
        if (!prefetchedThreads.current.has(uri)) {
          prefetchedThreads.current.add(uri);
          queryClient.prefetchQuery({
            queryKey: ['thread', uri],
            queryFn: () => getPostThread(uri),
            staleTime: THREAD_STALE_TIME,
          });
        }

        // Prefetch author profile
        if (!prefetchedProfiles.current.has(authorHandle)) {
          prefetchedProfiles.current.add(authorHandle);
          queryClient.prefetchQuery({
            queryKey: ['profile', authorHandle],
            queryFn: () => getProfile(authorHandle),
            staleTime: PROFILE_STALE_TIME,
          });
        }
      }

      // Evict oldest entries to prevent unbounded memory growth
      if (prefetchedThreads.current.size > MAX_PREFETCHED_SET_SIZE) {
        const entries = Array.from(prefetchedThreads.current);
        const toRemove = entries.length - MAX_PREFETCHED_SET_SIZE;
        for (let i = 0; i < toRemove; i++) {
          prefetchedThreads.current.delete(entries[i]);
        }
      }
      if (prefetchedProfiles.current.size > MAX_PREFETCHED_SET_SIZE) {
        const entries = Array.from(prefetchedProfiles.current);
        const toRemove = entries.length - MAX_PREFETCHED_SET_SIZE;
        for (let i = 0; i < toRemove; i++) {
          prefetchedProfiles.current.delete(entries[i]);
        }
      }
    },
    [queryClient],
  );

  // Trigger prefetch whenever the posts array identity changes
  // (new page load, feed switch, etc.). Deferred via InteractionManager
  // so that prefetch network calls don't compete with the initial render.
  useEffect(() => {
    if (posts.length === 0) return;

    const handle = InteractionManager.runAfterInteractions(() => {
      prefetchPosts(posts);
    });

    return () => handle.cancel();
  }, [posts, prefetchPosts]);

  /**
   * Reset the tracking sets. Call on feed refresh so newly loaded posts
   * are prefetched again with fresh data.
   */
  const resetPrefetchCache = useCallback(() => {
    prefetchedThreads.current.clear();
    prefetchedProfiles.current.clear();
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      prefetchedThreads.current.clear();
      prefetchedProfiles.current.clear();
    };
  }, []);

  return {resetPrefetchCache};
}
