/**
 * Utility functions for domain verification in Bluesky
 *
 * In Bluesky, users can verify domain ownership by using their domain as their handle.
 * For example: @example.com instead of @example.bsky.social
 * This indicates they control that domain and have verified ownership.
 */

/**
 * Check if a handle is using a custom domain (not .bsky.social)
 * @param handle - The user's handle (e.g., "example.com" or "user.bsky.social")
 * @returns true if the handle is domain-verified
 */
export function isDomainVerified(handle: string): boolean {
  if (!handle) return false;

  // Remove @ symbol if present
  const cleanHandle = handle.startsWith("@") ? handle.slice(1) : handle;

  // Check if it's NOT a bsky.social handle
  // Domain-verified handles don't end with .bsky.social
  return !cleanHandle.endsWith(".bsky.social");
}

/**
 * Get the domain name from a handle
 * @param handle - The user's handle
 * @returns The domain name or null if not domain-verified
 */
export function getDomainFromHandle(handle: string): string | null {
  if (!isDomainVerified(handle)) return null;

  // Remove @ symbol if present
  const cleanHandle = handle.startsWith("@") ? handle.slice(1) : handle;

  return cleanHandle;
}

/**
 * Get a display-friendly version of the domain
 * @param handle - The user's handle
 * @returns Formatted domain for display (e.g., "example.com" → "example.com")
 */
export function getVerifiedDomainDisplay(handle: string): string | null {
  const domain = getDomainFromHandle(handle);
  return domain;
}

/**
 * Check if a domain is a well-known/prestigious domain
 * This can be used to apply special styling for certain verified domains
 * @param handle - The user's handle
 * @returns true if it's a notable domain
 */
export function isNotableDomain(handle: string): boolean {
  const domain = getDomainFromHandle(handle);
  if (!domain) return false;

  // List of notable TLDs that might deserve special treatment
  const notableTLDs = [".com", ".org", ".net", ".edu", ".gov", ".io"];
  const hasNotableTLD = notableTLDs.some((tld) => domain.endsWith(tld));

  // Check if it's a single-level domain (e.g., example.com vs sub.example.com)
  const parts = domain.split(".");
  const isSingleLevel = parts.length === 2;

  return hasNotableTLD && isSingleLevel;
}
