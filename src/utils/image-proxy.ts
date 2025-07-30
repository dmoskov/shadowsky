/**
 * Transform Bluesky CDN URLs to use local proxy to avoid CORS issues
 */
export function proxifyBskyImage(url: string | undefined): string | undefined {
  if (!url) return url;
  
  // Check if it's a Bluesky CDN URL
  if (url.startsWith('https://cdn.bsky.app/')) {
    // Replace with our proxy URL
    return url.replace('https://cdn.bsky.app/', '/bsky-cdn/');
  }
  
  return url;
}

/**
 * Check if we're in development mode where proxy is available
 */
export const isProxyAvailable = import.meta.env.DEV;