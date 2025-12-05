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
