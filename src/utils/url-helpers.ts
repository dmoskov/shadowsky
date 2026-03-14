/**
 * URL helper functions for the notifications app
 */

/**
 * Generate a Bluesky profile URL from a handle
 */
export function getBskyProfileUrl(handle: string): string {
  // Remove @ if present
  const cleanHandle = handle.startsWith("@") ? handle.slice(1) : handle;
  return `/profile/${cleanHandle}`;
}

/**
 * Convert an AT URI to an internal app URL
 * AT URI format: at://did:plc:xxx/app.bsky.feed.post/3kfzxr5s2wt2x
 * Internal URL format: /profile/handle/post/3kfzxr5s2wt2x
 */
export function atUriToBskyUrl(uri: string, handle: string): string | null {
  if (!uri || !handle) return null;

  // Parse the AT URI
  // eslint-disable-next-line no-useless-escape
  const match = uri.match(/^at:\/\/([^\/]+)\/([^\/]+)\/([^\/]+)$/);
  if (!match) return null;

  const [, , collection, rkey] = match;
  const cleanHandle = handle.startsWith("@") ? handle.slice(1) : handle;

  // Handle different collection types
  if (collection === "app.bsky.feed.post") {
    return `/thread/${cleanHandle}/${rkey}`;
  } else if (collection === "app.bsky.feed.repost") {
    // Reposts don't have their own page, link to the profile
    return `/profile/${cleanHandle}`;
  } else if (collection === "app.bsky.feed.like") {
    // Likes don't have their own page, link to the profile
    return `/profile/${cleanHandle}`;
  }

  // Default to profile for unknown collection types
  return `/profile/${cleanHandle}`;
}

/**
 * Parse a Bluesky URL to extract the handle and post ID
 * Accepts URLs like:
 * - https://bsky.app/profile/handle/post/rkey
 * - https://bsky.app/profile/did/post/rkey
 */
export function parseBskyUrl(
  url: string,
): { handle?: string; did?: string; postId?: string } | null {
  if (!url) return null;

  // Handle relative URLs (starting with /)
  const cleanUrl = url.startsWith("/") ? `https://bsky.app${url}` : url;

  // Parse the URL - handle both handle and DID formats
  const match = cleanUrl.match(
    // eslint-disable-next-line no-useless-escape
    /^https?:\/\/bsky\.app\/profile\/([^\/]+)\/post\/([^\/\?#]+)/,
  );
  if (!match) return null;

  const [, profileIdentifier, postId] = match;

  // Check if profile identifier is a DID
  if (profileIdentifier.startsWith("did:")) {
    return { did: profileIdentifier, postId };
  } else {
    return { handle: profileIdentifier, postId };
  }
}

/**
 * Construct an AT URI from a handle/DID and post ID
 */
export function constructAtUri(identifier: string, postId: string): string {
  // If it's a handle, we need to use the DID instead
  // For now, we'll just construct with what we have
  // The actual resolution will happen when fetching the thread
  return `at://${identifier}/app.bsky.feed.post/${postId}`;
}

/**
 * Get the appropriate URL for a notification based on its type
 *
 * Note: For likes/reposts, the notification URI is the post being liked/reposted.
 * For replies/quotes/mentions, the URI is the new post created by the author.
 */
export function getNotificationUrl(
  notification: {
    reason: string;
    uri: string;
    author: { handle: string };
    reasonSubject?: string; // Optional URI of the original post for replies/quotes
  },
  postAuthorHandle?: string, // Optional handle of the post author for likes/reposts
): string {
  const { reason, uri, author } = notification;

  switch (reason) {
    case "follow":
      // For follows, link to the follower's profile
      return getBskyProfileUrl(author?.handle || "");

    case "like":
    case "repost":
      // For likes/reposts, the URI is the post being liked/reposted
      // If we have the post author's handle, we can construct the proper URL to the post
      if (uri && postAuthorHandle) {
        const postUrl = atUriToBskyUrl(uri, postAuthorHandle);
        return postUrl || getBskyProfileUrl(author?.handle || "");
      }
      // Otherwise, fall back to the notification author's profile
      return getBskyProfileUrl(author?.handle || "");

    case "reply":
    case "mention":
    case "quote": {
      // For replies/mentions/quotes, the URI is the new post by the author
      // This should link to the reply/mention/quote post, not the author's profile
      const postUrl = atUriToBskyUrl(uri, author?.handle || "");
      return postUrl || getBskyProfileUrl(author?.handle || "");
    }

    default:
      // Default to author's profile
      return getBskyProfileUrl(author?.handle || "");
  }
}
