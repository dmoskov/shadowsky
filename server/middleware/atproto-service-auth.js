/**
 * AT Protocol Service-Auth Verification
 *
 * Verifies the short-lived, PDS-signed JWTs a Bluesky client obtains from
 * `com.atproto.server.getServiceAuth` and sends as `Authorization: Bearer`.
 * Verification proves the caller controls the DID in the token's `iss`
 * claim: the signature is checked against the signing key published in that
 * DID's document (resolved via plc.directory or did:web).
 *
 * This replaces the legacy `X-User-DID` header, which was never verified and
 * let anyone impersonate any DID (see cognito-auth.js for the migration flag).
 *
 * Tokens must be minted for THIS service: `aud` must equal API_SERVICE_DID and
 * `lxm` must equal API_SERVICE_AUTH_LXM. The audience DID is only compared as
 * a string, so it does not need to resolve to a hosted DID document.
 */

// Default identity of this API. Must match the `aud` the web/mobile clients
// request in getServiceAuth (see src/utils/api-auth.ts and
// mobile/src/services/ai-service.ts).
const DEFAULT_SERVICE_DID = "did:web:api.asphodel.is";

// Lexicon method the token is scoped to. A single method covers every
// first-party API route; it exists so a token minted for this API cannot be
// replayed against a different service that shares our aud.
const SERVICE_AUTH_LXM = "is.asphodel.api.auth";

function getServiceDid() {
  return process.env.API_SERVICE_DID || DEFAULT_SERVICE_DID;
}

// @atproto/xrpc-server and @atproto/identity ship as ESM only; the server is
// CommonJS, so load them once via dynamic import.
let atprotoModulesPromise = null;
function loadAtprotoModules() {
  if (!atprotoModulesPromise) {
    atprotoModulesPromise = Promise.all([
      import("@atproto/xrpc-server"),
      import("@atproto/identity"),
    ]).then(([xrpcServer, identity]) => ({
      verifyJwt: xrpcServer.verifyJwt,
      idResolver: new identity.IdResolver({
        plcUrl: process.env.PLC_DIRECTORY_URL || undefined,
        didCache: new identity.MemoryCache(),
      }),
    }));
  }
  return atprotoModulesPromise;
}

/**
 * Decode a JWT payload without verifying it. Used only to decide which
 * verifier to route a token to; never trust the result on its own.
 *
 * @param {string} token
 * @returns {Record<string, unknown> | null}
 */
function peekJwtPayload(token) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const json = Buffer.from(parts[1], "base64url").toString("utf8");
    const payload = JSON.parse(json);
    return payload && typeof payload === "object" ? payload : null;
  } catch {
    return null;
  }
}

/**
 * True if the token's issuer is a DID, i.e. it is an AT Protocol service
 * token rather than a Cognito JWT.
 *
 * @param {string} token
 */
function looksLikeServiceAuthToken(token) {
  const payload = peekJwtPayload(token);
  return typeof payload?.iss === "string" && payload.iss.startsWith("did:");
}

/**
 * Verify a service-auth token and return the DID it proves control of.
 *
 * @param {string} token - Raw JWT from the Authorization header
 * @param {Object} [deps] - Overrides for tests
 * @param {(iss: string, forceRefresh: boolean) => Promise<string>} [deps.getSigningKey]
 * @param {string} [deps.serviceDid]
 * @returns {Promise<{ did: string, exp: number }>}
 */
async function verifyServiceAuthToken(token, deps = {}) {
  const { verifyJwt, idResolver } = await loadAtprotoModules();

  const getSigningKey =
    deps.getSigningKey ||
    ((iss, forceRefresh) => {
      // `iss` may carry a service fragment (did:...#atproto_labeler); we only
      // accept the account's own atproto signing key.
      const did = iss.includes("#") ? iss.slice(0, iss.indexOf("#")) : iss;
      return idResolver.did.resolveAtprotoKey(did, forceRefresh);
    });

  const payload = await verifyJwt(
    token,
    deps.serviceDid || getServiceDid(),
    SERVICE_AUTH_LXM,
    getSigningKey,
  );

  const did = payload.iss.includes("#")
    ? payload.iss.slice(0, payload.iss.indexOf("#"))
    : payload.iss;

  return { did, exp: payload.exp };
}

module.exports = {
  DEFAULT_SERVICE_DID,
  SERVICE_AUTH_LXM,
  getServiceDid,
  looksLikeServiceAuthToken,
  peekJwtPayload,
  verifyServiceAuthToken,
};
