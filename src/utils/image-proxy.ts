/**
 * Transform Bluesky CDN URLs to use local proxy to avoid CORS issues
 * Only transforms URLs in development mode where the proxy is available
 */
export function proxifyBskyImage(url: string | undefined): string | undefined {
  if (!url) return url;

  // Only use proxy in development mode
  if (import.meta.env.DEV && url.startsWith("https://cdn.bsky.app/")) {
    // Replace with our proxy URL
    return url.replace("https://cdn.bsky.app/", "/bsky-cdn/");
  }

  // In production, return the URL as-is
  return url;
}

/**
 * Check if we're in development mode where proxy is available
 */
export const isProxyAvailable = import.meta.env.DEV;

/**
 * Transform Bluesky video URLs to use local proxy to avoid CORS issues
 * Only transforms URLs in development mode where the proxy is available
 */
export function proxifyBskyVideo(url: string | undefined): string | undefined {
  if (!url) return url;

  // Only use proxy in development mode
  if (import.meta.env.DEV) {
    if (url.startsWith("https://video.bsky.app/")) {
      // Replace with our proxy URL
      return url.replace("https://video.bsky.app/", "/bsky-video/");
    } else if (url.startsWith("https://video.cdn.bsky.app/")) {
      // Replace with our proxy URL for CDN
      return url.replace("https://video.cdn.bsky.app/", "/bsky-video-cdn/");
    }
  }

  // In production, return the URL as-is
  return url;
}
