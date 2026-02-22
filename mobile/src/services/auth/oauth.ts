/**
 * OAuth Service for Mobile
 * Implements AT Protocol OAuth with PKCE, PAR, and authorization server discovery.
 * Uses expo-web-browser for in-app auth sessions.
 */

import { AtpSessionData } from "@atproto/api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import * as WebBrowser from "expo-web-browser";

import { createLogger } from "../../utils/logger";

const logger = createLogger("OAuth");

const OAUTH_STATE_KEY = "@shadowsky/oauth_state";
const CLIENT_ID = "https://shadowsky.io/client-metadata-mobile.json";
const REDIRECT_URI = "io.asphodel.app:/oauth-callback";
const DEFAULT_PDS = "https://bsky.social";

export interface OAuthState {
  state: string;
  codeVerifier: string;
  tokenEndpoint: string;
  timestamp: number;
}

export interface OAuthCallbackParams {
  code: string;
  state: string;
  iss?: string;
}

interface AuthServerMetadata {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  pushed_authorization_request_endpoint?: string;
}

function generateRandomString(length: number = 32): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate code challenge from code verifier using S256 method
 */
async function generateCodeChallenge(verifier: string): Promise<string> {
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    verifier,
    { encoding: Crypto.CryptoEncoding.BASE64 },
  );
  return hash.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Resolve a user's PDS URL from their handle.
 * Tries the handle as a domain first, then falls back to bsky.social resolution.
 */
async function resolvePdsFromHandle(handle: string): Promise<string> {
  const cleanHandle = handle.startsWith("@") ? handle.slice(1) : handle;

  // Try resolving via bsky.social's XRPC endpoint
  try {
    const res = await fetch(
      `${DEFAULT_PDS}/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(cleanHandle)}`,
    );
    if (res.ok) {
      const data = await res.json();
      if (data.did) {
        // Now resolve the DID document to find the PDS
        return await resolvePdsFromDid(data.did);
      }
    }
  } catch {
    // Fall through to default
  }

  return DEFAULT_PDS;
}

/**
 * Resolve PDS service endpoint from a DID document
 */
async function resolvePdsFromDid(did: string): Promise<string> {
  try {
    let didDocUrl: string;
    if (did.startsWith("did:plc:")) {
      didDocUrl = `https://plc.directory/${did}`;
    } else if (did.startsWith("did:web:")) {
      const domain = did.replace("did:web:", "");
      didDocUrl = `https://${domain}/.well-known/did.json`;
    } else {
      return DEFAULT_PDS;
    }

    const res = await fetch(didDocUrl);
    if (!res.ok) return DEFAULT_PDS;

    const didDoc = await res.json();
    const pdsService = didDoc.service?.find(
      (s: any) => s.id === "#atproto_pds" || s.type === "AtprotoPersonalDataServer",
    );

    if (pdsService?.serviceEndpoint) {
      return pdsService.serviceEndpoint;
    }
  } catch {
    // Fall through to default
  }

  return DEFAULT_PDS;
}

/**
 * Discover the authorization server metadata for a PDS.
 * Fetches the protected resource metadata, then the authorization server metadata.
 */
async function discoverAuthServer(
  pdsUrl: string,
): Promise<AuthServerMetadata> {
  // First try the OAuth protected resource metadata
  try {
    const resourceRes = await fetch(
      `${pdsUrl}/.well-known/oauth-protected-resource`,
    );
    if (resourceRes.ok) {
      const resourceMeta = await resourceRes.json();
      const authServerUrl = resourceMeta.authorization_servers?.[0];
      if (authServerUrl) {
        const authRes = await fetch(
          `${authServerUrl}/.well-known/oauth-authorization-server`,
        );
        if (authRes.ok) {
          return await authRes.json();
        }
      }
    }
  } catch {
    // Fall through to direct attempt
  }

  // Fall back to trying the PDS directly as the authorization server
  try {
    const authRes = await fetch(
      `${pdsUrl}/.well-known/oauth-authorization-server`,
    );
    if (authRes.ok) {
      return await authRes.json();
    }
  } catch {
    // Fall through to defaults
  }

  // Last resort: construct default endpoints for bsky.social
  return {
    issuer: pdsUrl,
    authorization_endpoint: `${pdsUrl}/oauth/authorize`,
    token_endpoint: `${pdsUrl}/oauth/token`,
    pushed_authorization_request_endpoint: `${pdsUrl}/oauth/par`,
  };
}

/**
 * Start OAuth flow using in-app browser.
 * Resolves the user's PDS and authorization server, then opens the auth session.
 *
 * @param handle - User's handle (e.g. "alice.bsky.social")
 * @returns The redirect URL result from the auth session, or null if cancelled
 */
export async function startOAuthFlow(
  handle: string,
): Promise<{ callbackUrl: string } | null> {
  const cleanHandle = handle.startsWith("@") ? handle.slice(1) : handle;

  // Resolve user's PDS from handle
  const pdsUrl = await resolvePdsFromHandle(cleanHandle);
  logger.log("Resolved PDS:", pdsUrl);

  // Discover authorization server endpoints
  const authServer = await discoverAuthServer(pdsUrl);
  logger.log("Authorization server:", authServer.issuer);

  const state = generateRandomString(32);
  const codeVerifier = generateRandomString(64);
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  const oauthState: OAuthState = {
    state,
    codeVerifier,
    tokenEndpoint: authServer.token_endpoint,
    timestamp: Date.now(),
  };
  await AsyncStorage.setItem(OAUTH_STATE_KEY, JSON.stringify(oauthState));

  // Build authorization parameters
  const authParams: Record<string, string> = {
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    scope: "atproto transition:generic",
    login_hint: cleanHandle,
  };

  let authUrl: string;

  // Use Pushed Authorization Request (PAR) if available
  if (authServer.pushed_authorization_request_endpoint) {
    try {
      const parResponse = await fetch(
        authServer.pushed_authorization_request_endpoint,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams(authParams).toString(),
        },
      );

      if (parResponse.ok) {
        const parData = await parResponse.json();
        authUrl =
          `${authServer.authorization_endpoint}?` +
          `client_id=${encodeURIComponent(CLIENT_ID)}` +
          `&request_uri=${encodeURIComponent(parData.request_uri)}`;
      } else {
        // PAR failed, fall back to direct authorization
        const queryString = new URLSearchParams(authParams).toString();
        authUrl = `${authServer.authorization_endpoint}?${queryString}`;
      }
    } catch {
      // PAR request failed, fall back to direct authorization
      const queryString = new URLSearchParams(authParams).toString();
      authUrl = `${authServer.authorization_endpoint}?${queryString}`;
    }
  } else {
    const queryString = new URLSearchParams(authParams).toString();
    authUrl = `${authServer.authorization_endpoint}?${queryString}`;
  }

  // Open in-app browser for authentication
  const result = await WebBrowser.openAuthSessionAsync(authUrl, REDIRECT_URI);

  if (result.type === "success" && result.url) {
    return { callbackUrl: result.url };
  }

  // User cancelled or browser was dismissed
  await AsyncStorage.removeItem(OAUTH_STATE_KEY);
  return null;
}

/**
 * Handle OAuth callback and exchange code for tokens
 */
export async function handleOAuthCallback(
  params: OAuthCallbackParams,
): Promise<AtpSessionData> {
  try {
    const storedStateJson = await AsyncStorage.getItem(OAUTH_STATE_KEY);
    if (!storedStateJson) {
      throw new Error("No OAuth state found");
    }

    const storedState: OAuthState = JSON.parse(storedStateJson);

    if (params.state !== storedState.state) {
      throw new Error("OAuth state mismatch");
    }

    const stateAge = Date.now() - storedState.timestamp;
    if (stateAge > 15 * 60 * 1000) {
      throw new Error("OAuth state expired");
    }

    // Use the stored token endpoint (discovered during authorization)
    const tokenEndpoint = storedState.tokenEndpoint;

    const tokenResponse = await fetch(tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: params.code,
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        code_verifier: storedState.codeVerifier,
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      throw new Error(
        `Token exchange failed: ${tokenResponse.status} - ${errorText}`,
      );
    }

    const tokenData = await tokenResponse.json();

    const sessionData: AtpSessionData = {
      active: true,
      accessJwt: tokenData.access_token,
      refreshJwt: tokenData.refresh_token,
      did: tokenData.sub,
      handle: tokenData.handle || "",
      email: tokenData.email,
      emailConfirmed: tokenData.email_confirmed,
    };

    await AsyncStorage.removeItem(OAUTH_STATE_KEY);
    return sessionData;
  } catch (error) {
    await AsyncStorage.removeItem(OAUTH_STATE_KEY);
    throw error;
  }
}

/**
 * Parse OAuth callback parameters from a redirect URL
 */
export function parseCallbackUrl(url: string): OAuthCallbackParams | null {
  try {
    const parsed = new URL(url);
    const code = parsed.searchParams.get("code");
    const state = parsed.searchParams.get("state");
    const iss = parsed.searchParams.get("iss") ?? undefined;

    if (code && state) {
      return { code, state, iss };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Cancel ongoing OAuth flow
 */
export async function cancelOAuthFlow(): Promise<void> {
  await AsyncStorage.removeItem(OAUTH_STATE_KEY);
}

/**
 * Check if there's an ongoing OAuth flow
 */
export async function hasOngoingOAuthFlow(): Promise<boolean> {
  try {
    const storedStateJson = await AsyncStorage.getItem(OAUTH_STATE_KEY);
    if (!storedStateJson) {
      return false;
    }

    const storedState: OAuthState = JSON.parse(storedStateJson);

    const stateAge = Date.now() - storedState.timestamp;
    if (stateAge > 15 * 60 * 1000) {
      await AsyncStorage.removeItem(OAUTH_STATE_KEY);
      return false;
    }

    return true;
  } catch {
    return false;
  }
}
