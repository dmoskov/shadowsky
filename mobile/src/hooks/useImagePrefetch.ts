import {useRef, useCallback} from 'react';
import {Image} from 'expo-image';
import {AppBskyFeedDefs, AppBskyEmbedImages} from '@atproto/api';
import {getOptimizedUrl} from '../utils/image-cdn';

const PREFETCH_WINDOW = 5; // prefetch thumbs for posts 3-8 ahead

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

  const prefetchVisibleWindow = useCallback(
    (firstVisibleIndex: number) => {
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

      if (urlsToPrefetch.length > 0) {
        Image.prefetch(urlsToPrefetch);
      }
    },
    [posts],
  );

  return {prefetchVisibleWindow};
}
