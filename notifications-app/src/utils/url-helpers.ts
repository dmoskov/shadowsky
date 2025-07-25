/**
 * URL helper functions for the notifications app
 */

/**
 * Generate a Bluesky profile URL from a handle
 */
export function getBskyProfileUrl(handle: string): string {
  // Remove @ if present
  const cleanHandle = handle.startsWith('@') ? handle.slice(1) : handle
  return `https://bsky.app/profile/${cleanHandle}`
}