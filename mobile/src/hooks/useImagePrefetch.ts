import {useRef, useCallback, useEffect} from 'react';
import {Image} from 'expo-image';
import {AppBskyFeedDefs, AppBskyEmbedImages} from '@atproto/api';
import {getOptimizedUrl} from '../utils/image-cdn';
import {useLowPowerMode} from './useLowPowerMode';

const PREFETCH_WINDOW = 10; // prefetch thumbs for posts 3-13 ahead
const MAX_PREFETCH_SET_SIZE = 200; // cap to prevent unbounded memory growth

function extractImageUrls(post: AppBskyFeedDefs.FeedViewPost): string[] {
  const embed = post.post.embed;
  if (!embed) return [];

  // Direct image embeds
  if (embed.$type === 'app.bsky.embed.images#view') {
    const images = (embed as AppBskyEmbedImages.View).images;
    return images.map(img => getOptimizedUrl(img.thumb));
  }

  // Images nested inside record-with-media embeds
  if (embed.$type === 'app.bsky.embed.recordWithMedia#view') {
    const media = (embed as any).media;
    if (media?.$type === 'app.bsky.embed.images#view') {
      return (media as AppBskyEmbedImages.View).images.map(
        (img: AppBskyEmbedImages.ViewImage) => getOptimizedUrl(img.thumb),
      );
    }
  }

  return [];
}

export function useImagePrefetch(posts: AppBskyFeedDefs.FeedViewPost[]) {
  const prefetchedUrls = useRef(new Set<string>());
  const isLowPower = useLowPowerMode();

  const prefetchVisibleWindow = useCallback(
    (firstVisibleIndex: number) => {
      // Skip prefetching entirely in Low Power Mode — images load on demand
      if (isLowPower) return;

      const startIdx = firstVisibleIndex + 3;
      const endIdx = Math.min(startIdx + PREFETCH_WINDOW, posts.length);
      const urlsToPrefetch: string[] = [];

      for (let i = startIdx; i < endIdx; i++) {
        const urls = extractImageUrls(posts[i]);
        for (const url of urls) {
          if (!prefetchedUrls.current.has(url)) {
            prefetchedUrls.current.add(url);
            urlsToPrefetch.push(url);
          }
        }
      }

      // Evict oldest entries when the set grows too large to prevent
      // unbounded memory growth during long scrolling sessions.
      if (prefetchedUrls.current.size > MAX_PREFETCH_SET_SIZE) {
        const entries = Array.from(prefetchedUrls.current);
        const toRemove = entries.length - MAX_PREFETCH_SET_SIZE;
        for (let i = 0; i < toRemove; i++) {
          prefetchedUrls.current.delete(entries[i]);
        }
      }

      if (urlsToPrefetch.length > 0) {
        Image.prefetch(urlsToPrefetch);
      }
    },
    [posts, isLowPower],
  );

  /**
   * Reset the prefetch tracking set. Call this on feed refresh so that
   * images are re-prefetched for the new content.
   */
  const resetPrefetchCache = useCallback(() => {
    prefetchedUrls.current.clear();
  }, []);

  // Clear the prefetch set on unmount to release memory
  useEffect(() => {
    return () => {
      prefetchedUrls.current.clear();
    };
  }, []);

  return {prefetchVisibleWindow, resetPrefetchCache};
}
