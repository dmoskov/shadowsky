/**
 * API Authentication Helper
 *
 * Provides authentication headers for API requests to protected endpoints.
 * Requests carry an AT Protocol service-auth token minted by the user's PDS
 * (see @bsky/core createApiAuthHeaders); the API server verifies it against
 * the account's DID document.
 */

import type { BskyAgent } from "@atproto/api";
import { createApiAuthHeaders } from "@bsky/core";
import type { Session } from "@bsky/shared";
import { createLogger } from "./logger";

const logger = createLogger("ApiAuth");

// Store reference to current session
let currentSession: Session | null = null;

// Returns the agent for the active account; registered by AuthContext.
let agentProvider: () => BskyAgent | null = () => null;

const authHeaders = createApiAuthHeaders({
  getAgent: () => agentProvider(),
  getDid: () => getCurrentUserDid(),
  onFallback: (error) => {
    logger.warn(
      "Could not mint a service-auth token; sending legacy DID headers",
      error,
    );
  },
});

/**
 * Set the current user session for API authentication
 * Called by AuthContext when user logs in/out
 *
 * @param session - User session or null if logged out
 */
export function setApiAuthSession(session: Session | null): void {
  if (session?.did !== currentSession?.did) {
    authHeaders.reset();
  }
  currentSession = session;
}

/**
 * Register the source of the signed-in agent used to mint auth tokens.
 * Called once by AuthContext; the provider is re-read on every request so
 * account switches are picked up without re-registering.
 */
export function setApiAuthAgentProvider(
  provider: () => BskyAgent | null,
): void {
  agentProvider = provider;
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
 *
 * @returns Headers object with authentication info, or empty object if not authenticated
 */
export function getApiAuthHeaders(): Promise<Record<string, string>> {
  return authHeaders.getHeaders();
}

/**
 * Merge authentication headers with existing headers
 *
 * @param existingHeaders - Existing headers from fetch request
 * @returns Combined headers with auth info
 */
export async function mergeAuthHeaders(
  existingHeaders: HeadersInit | undefined,
): Promise<Record<string, string>> {
  const authHeadersForRequest = await getApiAuthHeaders();

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
    ...authHeadersForRequest,
  };
}

/**
 * Create RequestInit with authentication headers
 *
 * @param init - Original RequestInit options
 * @returns RequestInit with auth headers added
 */
export async function withAuth(init?: RequestInit): Promise<RequestInit> {
  const headers = await mergeAuthHeaders(init?.headers);

  return {
    ...init,
    headers,
  };
}
