/**
 * Authentication for the first-party API server (server/).
 *
 * Clients prove which Bluesky account is calling by presenting an AT Protocol
 * service-auth token: a short-lived JWT the user's PDS signs with the
 * account's signing key (`com.atproto.server.getServiceAuth`). The server
 * verifies the signature against the DID document, so a forged DID is
 * rejected — unlike the legacy `X-User-DID` header, which was never verified.
 *
 * Both constants must match the server (server/middleware/atproto-service-auth.js).
 */

import type { BskyAgent } from "@atproto/api";

/** The API server's identity — the `aud` claim every token is minted for. */
export const API_SERVICE_DID = "did:web:api.asphodel.is";

/** Lexicon method the token is scoped to (`lxm` claim). */
export const API_SERVICE_AUTH_LXM = "is.asphodel.api.auth";

// PDSes cap method-scoped tokens at one hour; stay under it so clock skew
// between client and PDS can't push the request over the limit.
const TOKEN_TTL_SECONDS = 55 * 60;

// Refresh this long before expiry so an in-flight request never carries a
// token that expires mid-verification.
const REFRESH_MARGIN_SECONDS = 60;

/** The slice of an agent needed to mint tokens; satisfied by BskyAgent and the OAuth Agent. */
export type ServiceAuthAgent = Pick<BskyAgent, "com">;

export interface ApiAuthHeadersOptions {
  /** Returns the signed-in agent, or null when logged out. */
  getAgent: () => ServiceAuthAgent | null;
  /** Returns the signed-in account DID, or null when logged out. */
  getDid: () => string | null;
  /**
   * Called when a token could not be minted and the legacy unsigned header
   * is sent instead. Wire this to a logger so fallbacks are visible.
   */
  onFallback?: (error: unknown) => void;
  /** Clock override for tests (ms since epoch). */
  now?: () => number;
}

export interface ApiAuthHeaders {
  /** Headers to spread into an API request. Empty when logged out. */
  getHeaders(): Promise<Record<string, string>>;
  /** Drop any cached token (call on logout / account switch). */
  reset(): void;
}

interface CachedToken {
  did: string;
  token: string;
  /** Unix seconds. */
  exp: number;
}

/**
 * Build a header source that mints service-auth tokens on demand and caches
 * them per account until shortly before they expire.
 *
 * If the PDS refuses to mint a token (older PDS, missing OAuth scope), the
 * legacy `X-User-DID` headers are sent instead so the app keeps working;
 * the server accepts those only while its ALLOW_UNSIGNED_DID_AUTH rollout
 * flag is on.
 */
export function createApiAuthHeaders(
  options: ApiAuthHeadersOptions,
): ApiAuthHeaders {
  const now = options.now ?? Date.now;

  let cached: CachedToken | null = null;
  let inflight: Promise<CachedToken> | null = null;

  const isFresh = (
    entry: CachedToken | null,
    did: string,
  ): entry is CachedToken =>
    entry !== null &&
    entry.did === did &&
    entry.exp - now() / 1000 > REFRESH_MARGIN_SECONDS;

  const mint = async (
    agent: ServiceAuthAgent,
    did: string,
  ): Promise<CachedToken> => {
    const exp = Math.floor(now() / 1000) + TOKEN_TTL_SECONDS;
    const response = await agent.com.atproto.server.getServiceAuth({
      aud: API_SERVICE_DID,
      lxm: API_SERVICE_AUTH_LXM,
      exp,
    });
    return { did, token: response.data.token, exp };
  };

  const legacyHeaders = (did: string): Record<string, string> => ({
    "X-User-DID": did,
    "X-Bluesky-DID": did,
  });

  return {
    async getHeaders() {
      const did = options.getDid();
      if (!did) {
        return {};
      }

      if (isFresh(cached, did)) {
        return { Authorization: `Bearer ${cached.token}` };
      }

      const agent = options.getAgent();
      if (!agent) {
        return legacyHeaders(did);
      }

      try {
        if (!inflight) {
          inflight = mint(agent, did).finally(() => {
            inflight = null;
          });
        }
        const entry = await inflight;
        // A concurrent account switch can resolve a token for another DID;
        // only cache and use it if it still matches the caller.
        if (entry.did !== did) {
          return legacyHeaders(did);
        }
        cached = entry;
        return { Authorization: `Bearer ${entry.token}` };
      } catch (error) {
        options.onFallback?.(error);
        return legacyHeaders(did);
      }
    },

    reset() {
      cached = null;
    },
  };
}
