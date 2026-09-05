/**
 * Authentication Middleware for Express
 *
 * Supports multiple authentication methods:
 * 1. AWS Cognito JWT tokens (for admin/service accounts)
 * 2. AT Protocol service-auth JWTs (regular users; signed by the user's PDS,
 *    verified against their DID document — see atproto-service-auth.js)
 * 3. LEGACY: an unverified Bluesky DID header. Anyone can set this header to
 *    any DID, so it is only honored while ALLOW_UNSIGNED_DID_AUTH is not
 *    "false". It exists to keep old clients working during the rollout of
 *    service-auth and should be disabled once web + mobile have shipped it.
 *
 * Priority: Cognito JWT > service-auth JWT > legacy DID header
 */

const crypto = require("crypto");
const {
  looksLikeServiceAuthToken,
  verifyServiceAuthToken,
} = require("./atproto-service-auth");

function allowUnsignedDidAuth() {
  return process.env.ALLOW_UNSIGNED_DID_AUTH !== "false";
}

// Cache for JWKS keys (in-memory)
let jwksCache = null;
let jwksCacheTime = 0;
const JWKS_CACHE_TTL = 3600000; // 1 hour in milliseconds

// Flag to track if Cognito is available
let cognitoAvailable = true;

// Get Cognito configuration from environment or defaults
function getCognitoConfig() {
  // Load from amplify_outputs.json at startup for defaults
  let amplifyOutputs = null;
  try {
    amplifyOutputs = require("../../amplify_outputs.json");
  } catch (e) {
    // File not found, use environment variables only
  }

  const userPoolId =
    process.env.COGNITO_USER_POOL_ID || amplifyOutputs?.auth?.user_pool_id;
  const region =
    process.env.AWS_REGION || amplifyOutputs?.auth?.aws_region || "us-west-1";
  const clientId =
    process.env.COGNITO_CLIENT_ID || amplifyOutputs?.auth?.user_pool_client_id;

  // Cognito is optional - if not configured, we'll use DID-based auth
  if (!userPoolId) {
    cognitoAvailable = false;
    return { userPoolId: null, region, clientId: null };
  }

  return { userPoolId, region, clientId };
}

// Build the Cognito issuer URL
function getIssuerUrl(region, userPoolId) {
  return `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`;
}

// Build the JWKS URL for the Cognito User Pool
function getJwksUrl(region, userPoolId) {
  return `${getIssuerUrl(region, userPoolId)}/.well-known/jwks.json`;
}

// Base64URL decode
function base64UrlDecode(str) {
  // Convert base64url to base64
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");

  // Add padding if needed
  const padding = 4 - (base64.length % 4);
  if (padding !== 4) {
    base64 += "=".repeat(padding);
  }

  return Buffer.from(base64, "base64");
}

// Parse JWT without verification (for extracting header)
function parseJwt(token) {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT format");
  }

  const header = JSON.parse(base64UrlDecode(parts[0]).toString("utf8"));
  const payload = JSON.parse(base64UrlDecode(parts[1]).toString("utf8"));
  const signature = base64UrlDecode(parts[2]);

  return { header, payload, signature };
}

// Fetch and cache JWKS keys from Cognito
async function getJwksKeys(region, userPoolId) {
  const now = Date.now();

  // Return cached keys if still valid
  if (jwksCache && now - jwksCacheTime < JWKS_CACHE_TTL) {
    return jwksCache;
  }

  const jwksUrl = getJwksUrl(region, userPoolId);

  const response = await fetch(jwksUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch JWKS: ${response.status}`);
  }

  const jwks = /** @type {{ keys: Array<{ kid: string }> }} */ (
    await response.json()
  );

  // Build key map by kid
  jwksCache = new Map();
  for (const key of jwks.keys) {
    jwksCache.set(key.kid, key);
  }

  jwksCacheTime = now;
  return jwksCache;
}

// Convert JWKS key to PEM format for verification
function jwkToPem(jwk) {
  if (jwk.kty !== "RSA") {
    throw new Error(`Unsupported key type: ${jwk.kty}`);
  }

  const n = base64UrlDecode(jwk.n);
  const e = base64UrlDecode(jwk.e);

  // Build DER encoded public key
  const modulusLen = n.length + (n[0] & 0x80 ? 1 : 0);
  const exponentLen = e.length + (e[0] & 0x80 ? 1 : 0);

  const sequenceLen = 2 + modulusLen + 2 + exponentLen;
  const totalLen = 1 + (sequenceLen > 127 ? 2 : 1) + sequenceLen;

  const der = Buffer.alloc(totalLen + 24); // Extra space for ASN.1 structure
  let offset = 0;

  // RSA public key OID: 1.2.840.113549.1.1.1
  const rsaOid = Buffer.from([
    0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01,
    0x01, 0x05, 0x00,
  ]);

  // Build the RSA public key sequence
  const rsaKey = Buffer.alloc(4 + modulusLen + 4 + exponentLen);
  let rsaOffset = 0;

  // INTEGER (modulus)
  rsaKey[rsaOffset++] = 0x02;
  if (modulusLen > n.length) {
    rsaKey[rsaOffset++] = modulusLen;
    rsaKey[rsaOffset++] = 0x00;
  } else {
    rsaKey[rsaOffset++] = n.length;
  }
  n.copy(rsaKey, rsaOffset);
  rsaOffset += n.length;

  // INTEGER (exponent)
  rsaKey[rsaOffset++] = 0x02;
  if (exponentLen > e.length) {
    rsaKey[rsaOffset++] = exponentLen;
    rsaKey[rsaOffset++] = 0x00;
  } else {
    rsaKey[rsaOffset++] = e.length;
  }
  e.copy(rsaKey, rsaOffset);
  rsaOffset += e.length;

  // Wrap in SEQUENCE
  const innerSequence = Buffer.alloc(rsaOffset + 4);
  innerSequence[0] = 0x30;
  if (rsaOffset > 127) {
    innerSequence[1] = 0x82;
    innerSequence[2] = (rsaOffset >> 8) & 0xff;
    innerSequence[3] = rsaOffset & 0xff;
    rsaKey.copy(innerSequence, 4, 0, rsaOffset);
  } else {
    innerSequence[1] = rsaOffset;
    rsaKey.copy(innerSequence, 2, 0, rsaOffset);
  }

  // BIT STRING wrapper
  const bitStringLen = innerSequence.length + 1;
  const bitString = Buffer.alloc(bitStringLen + 4);
  let bsOffset = 0;
  bitString[bsOffset++] = 0x03;
  if (bitStringLen > 127) {
    bitString[bsOffset++] = 0x82;
    bitString[bsOffset++] = (bitStringLen >> 8) & 0xff;
    bitString[bsOffset++] = bitStringLen & 0xff;
  } else {
    bitString[bsOffset++] = bitStringLen;
  }
  bitString[bsOffset++] = 0x00; // unused bits
  innerSequence.copy(bitString, bsOffset);

  // Outer SEQUENCE
  const outerLen = rsaOid.length + bitString.length;
  der[offset++] = 0x30;
  if (outerLen > 127) {
    der[offset++] = 0x82;
    der[offset++] = (outerLen >> 8) & 0xff;
    der[offset++] = outerLen & 0xff;
  } else {
    der[offset++] = outerLen;
  }

  rsaOid.copy(der, offset);
  offset += rsaOid.length;
  bitString.copy(der, offset);
  offset += bitString.length;

  const pem = `-----BEGIN PUBLIC KEY-----\n${der
    .subarray(0, offset)
    .toString("base64")
    .match(/.{1,64}/g)
    ?.join("\n")}\n-----END PUBLIC KEY-----`;

  return pem;
}

// Verify JWT signature using Cognito public keys
async function verifyJwtSignature(token, region, userPoolId) {
  const { header, payload, signature } = parseJwt(token);

  // Verify algorithm
  if (header.alg !== "RS256") {
    throw new Error(`Unsupported algorithm: ${header.alg}`);
  }

  // Get JWKS keys
  let keys = await getJwksKeys(region, userPoolId);
  let key = keys.get(header.kid);

  if (!key) {
    // Clear cache and retry once (key might have rotated)
    jwksCache = null;
    keys = await getJwksKeys(region, userPoolId);
    key = keys.get(header.kid);

    if (!key) {
      throw new Error(`Key not found: ${header.kid}`);
    }
  }

  // Convert JWK to PEM
  const pem = jwkToPem(key);

  // Verify signature
  const signatureInput = token.split(".").slice(0, 2).join(".");
  const verifier = crypto.createVerify("RSA-SHA256");
  verifier.update(signatureInput);

  if (!verifier.verify(pem, signature)) {
    throw new Error("Invalid signature");
  }

  return payload;
}

// Validate token claims
function validateClaims(claims, region, userPoolId, clientId) {
  const now = Math.floor(Date.now() / 1000);

  // Check expiration
  if (claims.exp < now) {
    throw new Error("Token has expired");
  }

  // Check not-before (iat)
  if (claims.iat > now + 60) {
    // 60 second clock skew tolerance
    throw new Error("Token issued in the future");
  }

  // Verify issuer
  const expectedIssuer = getIssuerUrl(region, userPoolId);
  if (claims.iss !== expectedIssuer) {
    throw new Error(`Invalid issuer: ${claims.iss}`);
  }

  // Verify audience/client_id if configured
  if (clientId) {
    const tokenClientId =
      claims.token_use === "id" ? claims.aud : claims.client_id;
    if (tokenClientId !== clientId) {
      throw new Error(`Invalid client ID: ${tokenClientId}`);
    }
  }

  // Verify token_use is either 'id' or 'access'
  if (claims.token_use !== "id" && claims.token_use !== "access") {
    throw new Error(`Invalid token_use: ${claims.token_use}`);
  }
}

// Extract Authorization header from request
function extractAuthToken(req) {
  const authHeader =
    req.headers.authorization ||
    req.headers.Authorization ||
    req.headers["x-api-key"] ||
    req.headers["X-Api-Key"];

  if (!authHeader) {
    return null;
  }

  // Handle Bearer token format
  if (authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  return authHeader;
}

/**
 * Extract Bluesky DID from request headers
 * Supports: DID:<did>, x-user-did header, x-bluesky-did header
 *
 * @param {Object} req - Express request object
 * @returns {string|null} DID or null if not found
 */
function extractUserDid(req) {
  const authHeader = req.headers.authorization;

  // Support DID directly in Authorization header (e.g., "DID:did:plc:...")
  if (authHeader && authHeader.startsWith("DID:")) {
    return authHeader.slice(4);
  }

  // Support x-user-did header
  if (req.headers["x-user-did"]) {
    return req.headers["x-user-did"];
  }

  // Support x-bluesky-did header
  if (req.headers["x-bluesky-did"]) {
    return req.headers["x-bluesky-did"];
  }

  return null;
}

/**
 * Validate Bluesky DID format
 * Valid formats: did:plc:... or did:web:...
 *
 * @param {string} did - DID to validate
 * @returns {boolean} True if valid DID format
 */
function isValidDid(did) {
  if (!did || typeof did !== "string") {
    return false;
  }

  // DID must start with "did:" and have a method
  if (!did.startsWith("did:")) {
    return false;
  }

  // Common Bluesky DID methods: plc and web
  const didPattern = /^did:(plc|web):[a-zA-Z0-9._%-]+$/;
  return didPattern.test(did);
}

/**
 * Authenticate request using Cognito JWT
 *
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} AuthResult with user information or error
 */
async function authenticateCognito(req) {
  try {
    // Extract token from request
    const token = extractAuthToken(req);

    if (!token) {
      return {
        authenticated: false,
        error: "No authorization token provided",
      };
    }

    // Check if it looks like a JWT (3 dot-separated parts)
    if (token.split(".").length !== 3) {
      return {
        authenticated: false,
        error: "Invalid token format",
      };
    }

    // Get Cognito configuration
    const { userPoolId, region, clientId } = getCognitoConfig();

    if (!userPoolId) {
      return {
        authenticated: false,
        error: "Cognito not configured",
      };
    }

    // Verify JWT signature
    const claims = await verifyJwtSignature(token, region, userPoolId);

    // Validate claims
    validateClaims(claims, region, userPoolId, clientId);

    // Extract user information
    const userId = claims.sub;
    const email = claims.email;
    const username = claims["cognito:username"] || claims.username;
    const groups = claims["cognito:groups"];

    return {
      authenticated: true,
      method: "cognito",
      userId,
      email,
      username,
      groups,
      claims,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    return {
      authenticated: false,
      error: message,
    };
  }
}

/**
 * Authenticate request using an AT Protocol service-auth JWT.
 * The token proves the caller controls the DID in its `iss` claim.
 *
 * @param {Object} req - Express request object
 * @param {Parameters<typeof verifyServiceAuthToken>[1]} [deps] - Test overrides
 * @returns {Promise<Object>} AuthResult with user information or error
 */
async function authenticateServiceAuth(req, deps) {
  const token = extractAuthToken(req);

  if (!token || !looksLikeServiceAuthToken(token)) {
    return {
      authenticated: false,
      error: "No service-auth token provided",
    };
  }

  try {
    const { did } = await verifyServiceAuthToken(token, deps);
    return {
      authenticated: true,
      method: "did",
      userId: did,
      did,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      authenticated: false,
      error: `Invalid service-auth token: ${message}`,
    };
  }
}

/**
 * LEGACY: authenticate request using an unverified Bluesky DID header.
 *
 * This proves nothing — the header is caller-controlled — and is only kept
 * so clients that predate service-auth keep working during rollout. Every
 * use is logged as `did-unsigned` so the remaining legacy traffic can be
 * measured before ALLOW_UNSIGNED_DID_AUTH=false is set.
 *
 * @param {Object} req - Express request object
 * @returns {Object} AuthResult with user information or error
 */
function authenticateDid(req) {
  const did = extractUserDid(req);

  if (!did) {
    return {
      authenticated: false,
      error: "No DID provided",
    };
  }

  if (!isValidDid(did)) {
    return {
      authenticated: false,
      error: "Invalid DID format",
    };
  }

  if (!allowUnsignedDidAuth()) {
    return {
      authenticated: false,
      error:
        "Unsigned DID headers are no longer accepted. Send a service-auth token.",
    };
  }

  console.warn(
    JSON.stringify({
      t: "auth",
      method: "did-unsigned",
      route: req.originalUrl?.split("?")[0],
      did,
    }),
  );

  return {
    authenticated: true,
    method: "did",
    userId: did,
    did: did,
    unsigned: true,
  };
}

/**
 * Authenticate request using any available method
 * Priority: Cognito JWT > service-auth JWT > legacy DID header
 *
 * @param {Object} req - Express request object
 * @param {Parameters<typeof verifyServiceAuthToken>[1]} [deps] - Test overrides
 * @returns {Promise<Object>} AuthResult with user information or error
 */
async function authenticateRequest(req, deps) {
  const token = extractAuthToken(req);
  const isServiceToken = !!token && looksLikeServiceAuthToken(token);

  // Try Cognito JWT first (if available). Skip it for tokens issued by a
  // DID — those can never validate against Cognito's JWKS.
  if (cognitoAvailable && token && !isServiceToken) {
    const cognitoAuth = await authenticateCognito(req);
    if (cognitoAuth.authenticated) {
      return cognitoAuth;
    }
  }

  if (isServiceToken) {
    // A presented service token must verify; never fall through to the
    // unverified header when a signed credential was offered and rejected.
    return authenticateServiceAuth(req, deps);
  }

  // Fall back to the legacy unverified DID header (gated by env flag)
  const didAuth = authenticateDid(req);
  if (didAuth.authenticated) {
    return didAuth;
  }

  // No valid authentication found. Only surface the legacy-header error when
  // a header was actually sent; otherwise say what credentials are expected.
  return {
    authenticated: false,
    error: extractUserDid(req)
      ? didAuth.error
      : "Authentication required. Provide a Cognito JWT or an AT Protocol service-auth token.",
  };
}

/**
 * Express middleware that requires authentication
 * Accepts either Cognito JWT or Bluesky DID
 *
 * @returns {Function} Express middleware function
 */
function requireCognitoAuth() {
  return async (req, res, next) => {
    const auth = await authenticateRequest(req);

    if (!auth.authenticated) {
      return res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: auth.error || "Authentication required",
        },
      });
    }

    // Attach auth info to request for downstream handlers
    req.auth = auth;
    next();
  };
}

/**
 * Express middleware that optionally validates authentication
 * If token/DID is present, validates it. If not, continues without auth.
 *
 * @returns {Function} Express middleware function
 */
function optionalCognitoAuth() {
  return async (req, res, next) => {
    const token = extractAuthToken(req);
    const did = extractUserDid(req);

    if (token || did) {
      const auth = await authenticateRequest(req);
      req.auth = auth;
    } else {
      req.auth = { authenticated: false };
    }

    next();
  };
}

module.exports = {
  requireCognitoAuth,
  optionalCognitoAuth,
  authenticateRequest,
  authenticateCognito,
  authenticateServiceAuth,
  authenticateDid,
  extractUserDid,
  isValidDid,
  getCognitoConfig,
};
