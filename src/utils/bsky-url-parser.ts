/**
 * Parse Bluesky URLs to extract post information
 */

export interface ParsedBskyUrl {
  handle: string;
  postId: string;
  uri: string;
}

/**
 * Parse a Bluesky post URL to extract handle and post ID
 * Supports formats:
 * - https://bsky.app/profile/handle.bsky.social/post/3abc123
 * - https://bsky.social/profile/handle.bsky.social/post/3abc123
 * - https://staging.bsky.app/profile/handle.bsky.social/post/3abc123
 */
export function parseBskyPostUrl(url: string): ParsedBskyUrl | null {
  try {
    const urlObj = new URL(url);

    // Check if it's a Bluesky domain
    if (
      !urlObj.hostname.includes("bsky.app") &&
      !urlObj.hostname.includes("bsky.social")
    ) {
      return null;
    }

    // Match the pattern: /profile/{handle}/post/{postId}
    const match = urlObj.pathname.match(/^\/profile\/([^/]+)\/post\/([^/]+)$/);

    if (!match) {
      return null;
    }

    const [, handle, postId] = match;

    // Construct the AT URI
    const uri = `at://${handle}/app.bsky.feed.post/${postId}`;

    return {
      handle,
      postId,
      uri,
    };
  } catch (_e) {
    return null;
  }
}

/**
 * Extract all Bluesky post URLs from text
 */
export function extractBskyUrls(text: string): string[] {
  // Match URLs that look like Bluesky post URLs
  const urlRegex =
    /https?:\/\/[^\s]+bsky\.(app|social)\/profile\/[^\s]+\/post\/[^\s]+/gi;
  return text.match(urlRegex) || [];
}
