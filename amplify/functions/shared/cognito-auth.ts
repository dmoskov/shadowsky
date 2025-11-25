/**
 * AWS Cognito JWT Validation Middleware
 *
 * Provides authentication functionality for Lambda endpoints using AWS Cognito.
 * Validates JWT tokens and extracts user information for authorization.
 *
 * Features:
 * - JWT token validation with Cognito User Pool
 * - User identity extraction from token claims
 * - Caching of JWKS keys for performance
 * - Support for both ID tokens and Access tokens
 */

import * as crypto from "crypto";
import {
  ErrorCodes,
  buildCorsHeaders,
  getCorrelationId,
  getRequestOrigin,
  logError,
  logInfo,
  logWarning,
  type LambdaResponse,
} from "./api-response";

/**
 * Decoded JWT header structure
 */
interface JwtHeader {
  kid: string;
  alg: string;
}

/**
 * Decoded JWT payload structure (Cognito claims)
 */
export interface CognitoTokenClaims {
  sub: string; // User ID
  email?: string;
  email_verified?: boolean;
  iss: string; // Issuer URL
  aud?: string; // Client ID (for ID token)
  client_id?: string; // Client ID (for Access token)
  token_use: "id" | "access";
  auth_time: number;
  exp: number;
  iat: number;
  jti?: string;
  username?: string;
  "cognito:username"?: string;
  "cognito:groups"?: string[];
}

/**
 * Authentication result returned to handler
 */
export interface AuthResult {
  authenticated: boolean;
  userId?: string;
  email?: string;
  groups?: string[];
  claims?: CognitoTokenClaims;
  error?: string;
}

/**
 * JWKS key structure from Cognito
 */
interface JwksKey {
  kid: string;
  kty: string;
  alg: string;
  use: string;
  n: string;
  e: string;
}

/**
 * JWKS response structure
 */
interface JwksResponse {
  keys: JwksKey[];
}

// Cache for JWKS keys (in-memory for Lambda warm starts)
let jwksCache: Map<string, JwksKey> | null = null;
let jwksCacheTime: number = 0;
const JWKS_CACHE_TTL = 3600000; // 1 hour in milliseconds

/**
 * Get Cognito configuration from environment
 */
function getCognitoConfig(): {
  userPoolId: string;
  region: string;
  clientId?: string;
} {
  const userPoolId = process.env.COGNITO_USER_POOL_ID;
  const region = process.env.AWS_REGION || "us-east-1";
  const clientId = process.env.COGNITO_CLIENT_ID;

  if (!userPoolId) {
    throw new Error("COGNITO_USER_POOL_ID environment variable is required");
  }

  return { userPoolId, region, clientId };
}

/**
 * Build the Cognito issuer URL
 */
function getIssuerUrl(region: string, userPoolId: string): string {
  return `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`;
}

/**
 * Build the JWKS URL for the Cognito User Pool
 */
function getJwksUrl(region: string, userPoolId: string): string {
  return `${getIssuerUrl(region, userPoolId)}/.well-known/jwks.json`;
}

/**
 * Fetch and cache JWKS keys from Cognito
 */
async function getJwksKeys(
  region: string,
  userPoolId: string
): Promise<Map<string, JwksKey>> {
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

  const jwks: JwksResponse = await response.json();

  // Build key map by kid
  jwksCache = new Map();
  for (const key of jwks.keys) {
    jwksCache.set(key.kid, key);
  }

  jwksCacheTime = now;
  return jwksCache;
}

/**
 * Base64URL decode
 */
function base64UrlDecode(str: string): Buffer {
  // Convert base64url to base64
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");

  // Add padding if needed
  const padding = 4 - (base64.length % 4);
  if (padding !== 4) {
    base64 += "=".repeat(padding);
  }

  return Buffer.from(base64, "base64");
}

/**
 * Parse JWT without verification (for extracting header)
 */
function parseJwt(token: string): {
  header: JwtHeader;
  payload: CognitoTokenClaims;
  signature: Buffer;
} {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT format");
  }

  const header = JSON.parse(base64UrlDecode(parts[0]).toString("utf8"));
  const payload = JSON.parse(base64UrlDecode(parts[1]).toString("utf8"));
  const signature = base64UrlDecode(parts[2]);

  return { header, payload, signature };
}

/**
 * Convert JWKS key to PEM format for verification
 */
function jwkToPem(jwk: JwksKey): string {
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

  const pem = `-----BEGIN PUBLIC KEY-----\n${der.subarray(0, offset).toString("base64").match(/.{1,64}/g)?.join("\n")}\n-----END PUBLIC KEY-----`;

  return pem;
}

/**
 * Verify JWT signature using Cognito public keys
 */
async function verifyJwtSignature(
  token: string,
  region: string,
  userPoolId: string
): Promise<CognitoTokenClaims> {
  const { header, payload, signature } = parseJwt(token);

  // Verify algorithm
  if (header.alg !== "RS256") {
    throw new Error(`Unsupported algorithm: ${header.alg}`);
  }

  // Get JWKS keys
  const keys = await getJwksKeys(region, userPoolId);
  const key = keys.get(header.kid);

  if (!key) {
    // Clear cache and retry once (key might have rotated)
    jwksCache = null;
    const refreshedKeys = await getJwksKeys(region, userPoolId);
    const refreshedKey = refreshedKeys.get(header.kid);

    if (!refreshedKey) {
      throw new Error(`Key not found: ${header.kid}`);
    }
  }

  const signingKey = keys.get(header.kid)!;

  // Convert JWK to PEM
  const pem = jwkToPem(signingKey);

  // Verify signature
  const signatureInput = token.split(".").slice(0, 2).join(".");
  const verifier = crypto.createVerify("RSA-SHA256");
  verifier.update(signatureInput);

  if (!verifier.verify(pem, signature)) {
    throw new Error("Invalid signature");
  }

  return payload;
}

/**
 * Validate token claims
 */
function validateClaims(
  claims: CognitoTokenClaims,
  region: string,
  userPoolId: string,
  clientId?: string
): void {
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

/**
 * Extract Authorization header from Lambda event
 */
function extractAuthToken(event: any): string | null {
  const authHeader =
    event.headers?.authorization ||
    event.headers?.Authorization ||
    event.headers?.["x-api-key"] ||
    event.headers?.["X-Api-Key"];

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
 * Authenticate request using Cognito JWT
 *
 * @param event - Lambda event object
 * @returns AuthResult with user information or error
 */
export async function authenticateRequest(event: any): Promise<AuthResult> {
  const correlationId = getCorrelationId(event);

  try {
    // Extract token from request
    const token = extractAuthToken(event);

    if (!token) {
      return {
        authenticated: false,
        error: "No authorization token provided",
      };
    }

    // Get Cognito configuration
    const { userPoolId, region, clientId } = getCognitoConfig();

    // Verify JWT signature
    const claims = await verifyJwtSignature(token, region, userPoolId);

    // Validate claims
    validateClaims(claims, region, userPoolId, clientId);

    // Extract user information
    const userId = claims.sub;
    const email = claims.email;
    const username = claims["cognito:username"] || claims.username;
    const groups = claims["cognito:groups"];

    logInfo("cognito-auth", `User authenticated: ${userId}`, correlationId, {
      email,
      username,
      tokenUse: claims.token_use,
    });

    return {
      authenticated: true,
      userId,
      email,
      groups,
      claims,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    logWarning("cognito-auth", `Authentication failed: ${message}`, correlationId);

    return {
      authenticated: false,
      error: message,
    };
  }
}

/**
 * Create a 401 Unauthorized response
 */
export function createUnauthorizedResponse(
  message: string,
  event: any,
  correlationId: string
): LambdaResponse {
  const origin = getRequestOrigin(event);
  const headers = buildCorsHeaders(origin);
  headers["X-Correlation-Id"] = correlationId;
  headers["WWW-Authenticate"] = 'Bearer realm="api"';

  return {
    statusCode: 401,
    headers,
    body: JSON.stringify({
      error: {
        code: ErrorCodes.UNAUTHORIZED,
        message,
        correlationId,
      },
    }),
  };
}

/**
 * Create a 403 Forbidden response
 */
export function createForbiddenResponse(
  message: string,
  event: any,
  correlationId: string
): LambdaResponse {
  const origin = getRequestOrigin(event);
  const headers = buildCorsHeaders(origin);
  headers["X-Correlation-Id"] = correlationId;

  return {
    statusCode: 403,
    headers,
    body: JSON.stringify({
      error: {
        code: ErrorCodes.FORBIDDEN,
        message,
        correlationId,
      },
    }),
  };
}

/**
 * Middleware wrapper that requires authentication
 * Use this to wrap your handler when authentication is required
 */
export function requireAuth<T>(
  handler: (
    event: any,
    auth: AuthResult
  ) => Promise<LambdaResponse>
): (event: any) => Promise<LambdaResponse> {
  return async (event: any): Promise<LambdaResponse> => {
    const correlationId = getCorrelationId(event);

    const auth = await authenticateRequest(event);

    if (!auth.authenticated) {
      return createUnauthorizedResponse(
        auth.error || "Authentication required",
        event,
        correlationId
      );
    }

    return handler(event, auth);
  };
}
