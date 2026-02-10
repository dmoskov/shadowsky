/**
 * Deep link URL builders
 *
 * Supported URL patterns:
 * - bsky://home -> Home tab
 * - bsky://search?q=query -> Search with query
 * - bsky://notifications -> Notifications tab
 * - bsky://profile/handle.bsky.social -> Profile screen
 * - bsky://profile/handle.bsky.social/post/postId -> Thread screen
 * - bsky://compose -> Compose screen
 * - bsky://settings -> Settings screen
 * - bsky://bookmarks -> Bookmarks screen
 * - bsky://messages -> Messages screen
 * - bsky://lists -> Lists screen
 * - bsky://lists/listId -> List timeline
 *
 * Also handles https://bsky.app and https://shadowsky.io via app.config.ts schemes.
 */

export function buildDeepLink(
  path: string,
  params?: Record<string, string>,
): string {
  let url = `bsky://${path}`;

  if (params && Object.keys(params).length > 0) {
    const searchParams = new URLSearchParams(params);
    url += `?${searchParams.toString()}`;
  }

  return url;
}

export function buildProfileLink(handle: string): string {
  return buildDeepLink(`profile/${handle}`);
}

export function buildThreadLink(handle: string, postId: string): string {
  return buildDeepLink(`profile/${handle}/post/${postId}`);
}

export function buildSearchLink(query?: string): string {
  return query
    ? buildDeepLink("search", { q: query })
    : buildDeepLink("search");
}
