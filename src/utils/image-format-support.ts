/**
 * Image Format Support Detection
 *
 * Detects browser support for modern image formats (AVIF, WebP)
 * and provides utilities for building fallback chains.
 */

// Cache detection results to avoid repeated async operations
let avifSupported: boolean | null = null;
let webpSupported: boolean | null = null;
let detectionPromise: Promise<void> | null = null;

// Minimal test images encoded in base64
// These are the smallest valid images that browsers can decode
const AVIF_TEST_IMAGE =
  "data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKBzgABpAgAAIwAg==";

const WEBP_TEST_IMAGE =
  "data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==";

/**
 * Test if the browser supports a specific image format
 * by attempting to load a minimal test image
 */
function testImageFormat(dataUri: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      // Image loaded successfully - format is supported
      resolve(img.width > 0 && img.height > 0);
    };
    img.onerror = () => {
      // Image failed to load - format not supported
      resolve(false);
    };
    img.src = dataUri;
  });
}

/**
 * Initialize format detection
 * Call this early in app lifecycle to cache results
 */
async function detectFormats(): Promise<void> {
  if (detectionPromise) {
    return detectionPromise;
  }

  detectionPromise = (async () => {
    const [avif, webp] = await Promise.all([
      testImageFormat(AVIF_TEST_IMAGE),
      testImageFormat(WEBP_TEST_IMAGE),
    ]);

    avifSupported = avif;
    webpSupported = webp;
  })();

  return detectionPromise;
}

// Start detection immediately when module loads
if (typeof window !== "undefined") {
  detectFormats();
}

/**
 * Check if AVIF is supported
 * Returns cached result or runs detection if not yet available
 */
export async function supportsAvif(): Promise<boolean> {
  if (avifSupported !== null) {
    return avifSupported;
  }
  await detectFormats();
  return avifSupported ?? false;
}

/**
 * Check if WebP is supported
 * Returns cached result or runs detection if not yet available
 */
export async function supportsWebP(): Promise<boolean> {
  if (webpSupported !== null) {
    return webpSupported;
  }
  await detectFormats();
  return webpSupported ?? false;
}

/**
 * Get synchronous cached support status
 * Returns null if detection hasn't completed yet
 */
export function getCachedSupport(): {
  avif: boolean | null;
  webp: boolean | null;
} {
  return {
    avif: avifSupported,
    webp: webpSupported,
  };
}

/**
 * Ensure detection is complete and return all results
 */
export async function getFormatSupport(): Promise<{
  avif: boolean;
  webp: boolean;
}> {
  await detectFormats();
  return {
    avif: avifSupported ?? false,
    webp: webpSupported ?? false,
  };
}

/**
 * Image format priorities for optimization
 * AVIF offers best compression, WebP is second, JPEG as fallback
 */
export type ImageFormat = "avif" | "webp" | "jpeg" | "png";

/**
 * Get the best supported format from the priority list
 */
export async function getBestSupportedFormat(): Promise<ImageFormat> {
  const support = await getFormatSupport();

  if (support.avif) {
    return "avif";
  }
  if (support.webp) {
    return "webp";
  }
  return "jpeg";
}

/**
 * Get ordered list of supported formats (best to worst)
 */
export async function getSupportedFormats(): Promise<ImageFormat[]> {
  const support = await getFormatSupport();
  const formats: ImageFormat[] = [];

  if (support.avif) formats.push("avif");
  if (support.webp) formats.push("webp");
  formats.push("jpeg");

  return formats;
}

/**
 * Transform a Bluesky CDN URL to request a specific format
 * The Bluesky CDN (cdn.bsky.app) supports format conversion via URL parameters
 *
 * @param url - Original image URL from Bluesky CDN
 * @param format - Target format to request
 * @returns Transformed URL with format parameter
 */
export function transformBskyCdnUrl(url: string, format: ImageFormat): string {
  if (!url || !url.includes("cdn.bsky.app")) {
    return url;
  }

  // The Bluesky CDN uses @format suffix for format specification
  // e.g., img/feed_thumbnail/plain/did:.../cid@jpeg
  // We can append format parameter to request different formats

  // Check if URL already has a format specified
  const formatMatch = url.match(/@(jpeg|webp|avif|png)$/);

  if (formatMatch) {
    // Replace existing format
    return url.replace(/@(jpeg|webp|avif|png)$/, `@${format}`);
  }

  // If no format suffix, append one
  // This assumes the URL structure where format can be appended
  return url;
}

/**
 * Generate source URLs for picture element srcset
 * Returns URLs for each supported format in priority order
 *
 * @param baseUrl - Base image URL from Bluesky CDN
 * @returns Array of {url, type} for picture source elements
 */
export async function generateFormatSources(
  baseUrl: string,
): Promise<Array<{ url: string; type: string }>> {
  if (!baseUrl) {
    return [];
  }

  const support = await getFormatSupport();
  const sources: Array<{ url: string; type: string }> = [];

  // Only add formats the browser supports and the CDN can provide
  if (support.avif && baseUrl.includes("cdn.bsky.app")) {
    sources.push({
      url: transformBskyCdnUrl(baseUrl, "avif"),
      type: "image/avif",
    });
  }

  if (support.webp && baseUrl.includes("cdn.bsky.app")) {
    sources.push({
      url: transformBskyCdnUrl(baseUrl, "webp"),
      type: "image/webp",
    });
  }

  return sources;
}

/**
 * Get the MIME type for a format
 */
export function getMimeType(format: ImageFormat): string {
  const mimeTypes: Record<ImageFormat, string> = {
    avif: "image/avif",
    webp: "image/webp",
    jpeg: "image/jpeg",
    png: "image/png",
  };
  return mimeTypes[format];
}

/**
 * Estimated compression ratios vs JPEG
 * These are approximate and vary by image content
 */
export const compressionRatios: Record<ImageFormat, number> = {
  avif: 0.5, // AVIF is ~50% smaller than JPEG
  webp: 0.7, // WebP is ~30% smaller than JPEG
  jpeg: 1.0, // Baseline
  png: 1.5, // PNG is typically larger for photos
};

/**
 * Estimate size savings when using modern formats
 * @param jpegSize - Size in bytes of JPEG version
 * @param targetFormat - Format to estimate for
 * @returns Estimated size in bytes
 */
export function estimateSizeSavings(
  jpegSize: number,
  targetFormat: ImageFormat,
): { estimatedSize: number; savingsPercent: number } {
  const ratio = compressionRatios[targetFormat];
  const estimatedSize = Math.round(jpegSize * ratio);
  const savingsPercent = Math.round((1 - ratio) * 100);
  return { estimatedSize, savingsPercent };
}

/**
 * LQIP (Low-Quality Image Placeholder) Configuration
 *
 * LQIP generation strategy: CDN Transformation
 * The Bluesky CDN supports different size variants via URL path:
 * - feed_fullsize: Full resolution images
 * - feed_thumbnail: Smaller thumbnails (~150px)
 *
 * For LQIP, we use the thumbnail variant which is already cached by the CDN.
 * This approach requires no build changes and leverages existing CDN infrastructure.
 */

export interface LQIPConfig {
  /** Enable LQIP blur-up effect */
  enabled: boolean;
  /** Blur radius in pixels for the placeholder */
  blurRadius: number;
  /** Transition duration in milliseconds */
  transitionDuration: number;
  /** Whether to use WebP for LQIP when supported (smaller size) */
  preferWebP: boolean;
}

/** Default LQIP configuration */
export const DEFAULT_LQIP_CONFIG: LQIPConfig = {
  enabled: true,
  blurRadius: 20,
  transitionDuration: 400,
  preferWebP: true,
};

/**
 * Generate a Low-Quality Image Placeholder URL from a Bluesky CDN URL.
 *
 * Uses CDN transformation to request a thumbnail variant, which is:
 * - Already cached by the CDN (no additional server processing)
 * - Typically ~2-5KB vs ~50-200KB for full images
 * - Loaded quickly to show immediate visual feedback
 *
 * @param url - Original Bluesky CDN image URL
 * @param config - LQIP configuration options
 * @returns LQIP URL or original URL if not a Bluesky CDN URL
 */
export function generateLQIPUrl(
  url: string,
  config: Partial<LQIPConfig> = {},
): string {
  if (!url) return url;

  const mergedConfig = { ...DEFAULT_LQIP_CONFIG, ...config };

  // Only transform Bluesky CDN URLs
  if (!url.includes("cdn.bsky.app")) {
    return url;
  }

  // Transform feed_fullsize to feed_thumbnail for LQIP
  // URL structure: https://cdn.bsky.app/img/feed_fullsize/plain/did:plc:.../cid@jpeg
  let lqipUrl = url.replace("/feed_fullsize/", "/feed_thumbnail/");

  // If URL doesn't have fullsize, it might already be a thumbnail or other variant
  // In that case, just use the URL as-is for the placeholder
  if (lqipUrl === url && !url.includes("/feed_thumbnail/")) {
    // Try to extract and rebuild with thumbnail
    const feedMatch = url.match(
      /cdn\.bsky\.app\/img\/([^/]+)\/plain\/(did:[^/]+)\/([^@]+)(@\w+)?/,
    );
    if (feedMatch) {
      const [, , did, cid, format] = feedMatch;
      lqipUrl = `https://cdn.bsky.app/img/feed_thumbnail/plain/${did}/${cid}${format || "@jpeg"}`;
    }
  }

  // Optionally convert to WebP for smaller LQIP file size
  if (mergedConfig.preferWebP && webpSupported) {
    lqipUrl = transformBskyCdnUrl(lqipUrl, "webp");
  }

  return lqipUrl;
}

/**
 * Check if a URL is from the Bluesky CDN and supports LQIP generation
 * @param url - URL to check
 * @returns true if LQIP can be generated for this URL
 */
export function supportsLQIP(url: string): boolean {
  if (!url) return false;
  return url.includes("cdn.bsky.app/img/");
}

/**
 * Get the full-resolution URL from a thumbnail URL
 * Useful for restoring the original URL from an LQIP
 *
 * @param url - Thumbnail or LQIP URL
 * @returns Full-resolution URL
 */
export function getFullResolutionUrl(url: string): string {
  if (!url) return url;

  if (!url.includes("cdn.bsky.app")) {
    return url;
  }

  // Transform feed_thumbnail back to feed_fullsize
  return url.replace("/feed_thumbnail/", "/feed_fullsize/");
}
