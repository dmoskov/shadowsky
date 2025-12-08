/**
 * API Authentication Helper
 *
 * Provides authentication headers for API requests to protected endpoints.
 * Uses the authenticated user's Bluesky DID as the authentication token.
 */

import type { Session } from "@bsky/shared";

// Store reference to current session
let currentSession: Session | null = null;

/**
 * Set the current user session for API authentication
 * Called by AuthContext when user logs in/out
 *
 * @param session - User session or null if logged out
 */
export function setApiAuthSession(session: Session | null): void {
  currentSession = session;
}

/**
 * Get the current user's DID for API authentication
 *
 * @returns User DID or null if not authenticated
 */
export function getCurrentUserDid(): string | null {
  return currentSession?.did ?? null;
}

/**
 * Check if user is authenticated for API requests
 *
 * @returns True if user has a valid session with DID
 */
export function isApiAuthenticated(): boolean {
  return currentSession?.did != null;
}

/**
 * Get authentication headers for API requests
 * Returns headers with the user's DID for authentication
 *
 * @returns Headers object with authentication info, or empty object if not authenticated
 */
export function getApiAuthHeaders(): Record<string, string> {
  const did = getCurrentUserDid();

  if (!did) {
    return {};
  }

  return {
    "X-User-DID": did,
    "X-Bluesky-DID": did,
  };
}

/**
 * Merge authentication headers with existing headers
 *
 * @param existingHeaders - Existing headers from fetch request
 * @returns Combined headers with auth info
 */
export function mergeAuthHeaders(
  existingHeaders: HeadersInit | undefined,
): Record<string, string> {
  const authHeaders = getApiAuthHeaders();

  // Convert existing headers to plain object
  let headers: Record<string, string> = {};

  if (existingHeaders) {
    if (existingHeaders instanceof Headers) {
      existingHeaders.forEach((value, key) => {
        headers[key] = value;
      });
    } else if (Array.isArray(existingHeaders)) {
      existingHeaders.forEach(([key, value]) => {
        headers[key] = value;
      });
    } else {
      headers = { ...existingHeaders };
    }
  }

  // Add auth headers (don't override if already present)
  return {
    ...headers,
    ...authHeaders,
  };
}

/**
 * Create RequestInit with authentication headers
 *
 * @param init - Original RequestInit options
 * @returns RequestInit with auth headers added
 */
export function withAuth(init?: RequestInit): RequestInit {
  const headers = mergeAuthHeaders(init?.headers);

  return {
    ...init,
    headers,
  };
}
