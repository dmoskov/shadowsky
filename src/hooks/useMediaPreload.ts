import type { AppBskyFeedDefs } from "@atproto/api";
import { debug } from "@bsky/shared";
import { useEffect, useRef } from "react";
import { MediaCacheService } from "../services/media-cache-service";

interface MediaPreloadOptions {
  enabled?: boolean; // Whether preloading is enabled
  lookahead?: number; // How many posts ahead to preload
  preloadVideos?: boolean; // Whether to preload videos (they're larger)
}

/**
 * Hook to preload media for upcoming timeline posts
 * Extracts media URLs from posts and preloads them in the background
 */
export function useMediaPreload(
  posts: AppBskyFeedDefs.FeedViewPost[], // Array of posts from timeline
  currentIndex: number, // Current scroll position/index
  options: MediaPreloadOptions = {},
) {
  const { enabled = true, lookahead = 5, preloadVideos = false } = options;

  const preloadedIndices = useRef(new Set<number>());
  const mediaCache = useRef<MediaCacheService | null>(null);
  const initPromise = useRef<Promise<void> | null>(null);

  // Initialize media cache
  useEffect(() => {
    if (!enabled) return;

    if (!initPromise.current) {
      initPromise.current = (async () => {
        try {
          const cache = MediaCacheService.getInstance();
          await cache.init();
          mediaCache.current = cache;
          debug.log("[MediaPreload] Initialized");
        } catch (error) {
          debug.error("[MediaPreload] Failed to initialize:", error);
        }
      })();
    }

    return () => {
      // Cleanup is handled by the singleton
    };
  }, [enabled]);

  // Preload media for upcoming posts
  useEffect(() => {
    if (!enabled || !mediaCache.current || !posts || posts.length === 0) {
      return;
    }

    const preloadUpcoming = async () => {
      const startIndex = Math.max(0, currentIndex);
      const endIndex = Math.min(posts.length, currentIndex + lookahead);

      const urlsToPreload: string[] = [];

      for (let i = startIndex; i < endIndex; i++) {
        // Skip if we've already preloaded this index
        if (preloadedIndices.current.has(i)) {
          continue;
        }

        const post = posts[i];
        if (!post) continue;

        // Extract media URLs from the post
        const mediaUrls = extractMediaUrls(post, preloadVideos);
        urlsToPreload.push(...mediaUrls);

        // Mark this index as preloaded
        preloadedIndices.current.add(i);
      }

      if (urlsToPreload.length > 0 && mediaCache.current) {
        debug.log(
          `[MediaPreload] Preloading ${urlsToPreload.length} media items for indices ${startIndex}-${endIndex}`,
        );

        try {
          await mediaCache.current.preloadMedia(urlsToPreload);
        } catch (error) {
          debug.error("[MediaPreload] Error preloading media:", error);
        }
      }
    };

    preloadUpcoming();
  }, [posts, currentIndex, enabled, lookahead, preloadVideos]);

  // Clear preloaded indices when posts change
  useEffect(() => {
    preloadedIndices.current.clear();
  }, [posts]);
}

/**
 * Extract media URLs from a post
 */
function extractMediaUrls(
  post: AppBskyFeedDefs.FeedViewPost,
  includeVideos: boolean,
): string[] {
  const urls: string[] = [];

  if (!post) return urls;

  // Handle author avatar
  if (post.post?.author?.avatar) {
    urls.push(post.post.author.avatar);
  }

  // Handle embedded images
  if (post.post?.embed) {
    const embed = post.post.embed as Record<string, unknown>;

    // Images array
    if (embed.images && Array.isArray(embed.images)) {
      for (const img of embed.images) {
        if (img.fullsize) urls.push(img.fullsize);
        if (img.thumb) urls.push(img.thumb);
      }
    }

    // Single image
    if (typeof embed.thumb === "string") {
      urls.push(embed.thumb);
    }

    // External embed with thumbnail
    if (
      embed.external &&
      typeof embed.external === "object" &&
      embed.external !== null &&
      "thumb" in embed.external &&
      typeof (embed.external as Record<string, unknown>).thumb === "string"
    ) {
      urls.push((embed.external as Record<string, unknown>).thumb as string);
    }

    // Video thumbnail
    if (typeof embed.thumbnail === "string") {
      urls.push(embed.thumbnail);
    }

    // Video playlist (if enabled)
    if (includeVideos && typeof embed.playlist === "string") {
      urls.push(embed.playlist);
    }

    // Quoted post
    if (embed.record) {
      const quotedUrls = extractMediaUrls(
        { post: embed.record } as AppBskyFeedDefs.FeedViewPost,
        includeVideos,
      );
      urls.push(...quotedUrls);
    }
  }

  // Handle reply parent/root media
  if (post.reply) {
    if (post.reply.parent) {
      const parentUrls = extractMediaUrls(
        { post: post.reply.parent } as AppBskyFeedDefs.FeedViewPost,
        includeVideos,
      );
      urls.push(...parentUrls);
    }
    if (post.reply.root) {
      const rootUrls = extractMediaUrls(
        { post: post.reply.root } as AppBskyFeedDefs.FeedViewPost,
        includeVideos,
      );
      urls.push(...rootUrls);
    }
  }

  return urls;
}

/**
 * Hook to get/cache a single media URL
 * Returns a blob URL if cached, otherwise the original URL
 */
export function useMediaCache(url: string | undefined): string | undefined {
  const mediaCache = useRef<MediaCacheService | null>(null);
  const initPromise = useRef<Promise<void> | null>(null);

  useEffect(() => {
    if (!url) return;

    if (!initPromise.current) {
      initPromise.current = (async () => {
        try {
          const cache = MediaCacheService.getInstance();
          await cache.init();
          mediaCache.current = cache;
        } catch (error) {
          debug.error("[MediaCache] Failed to initialize:", error);
        }
      })();
    }
  }, [url]);

  // For now, return the original URL
  // Components can use MediaCacheService directly for more control
  return url;
}
