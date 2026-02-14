const BSKY_CDN_PATTERN = /cdn\.bsky\.app/;

/**
 * Transform Bluesky CDN URLs to use WebP format for ~30% bandwidth savings.
 * Both iOS and Android support WebP natively via expo-image.
 */
export function getOptimizedUrl(url: string): string {
  if (!url || !BSKY_CDN_PATTERN.test(url)) {
    return url;
  }
  return url.replace(/@jpeg$/, '@webp');
}

/**
 * Derive a thumbnail URL from a fullsize CDN URL.
 * Bluesky CDN serves `feed_thumbnail` (~2-5KB) and `feed_fullsize` (~50-200KB).
 */
export function getThumbFromFullsize(url: string): string {
  if (!url || !BSKY_CDN_PATTERN.test(url)) {
    return url;
  }
  return url.replace('/feed_fullsize/', '/feed_thumbnail/');
}
