/**
 * OAuth Service for Mobile
 * Handles web-based OAuth flow for AT Protocol authentication
 */

import { AtpSessionData } from "@atproto/api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import * as Linking from "expo-linking";

const OAUTH_STATE_KEY = "@shadowsky/oauth_state";

export interface OAuthState {
  state: string;
  codeVerifier: string;
  timestamp: number;
}

export interface OAuthCallbackParams {
  code: string;
  state: string;
  iss?: string;
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
 * Converts the code verifier to base64url-encoded SHA256 hash
 */
async function generateCodeChallenge(verifier: string): Promise<string> {
  // SHA256 hash the code verifier
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    verifier,
    { encoding: Crypto.CryptoEncoding.BASE64 },
  );

  // Convert base64 to base64url (URL-safe base64)
  // Replace + with -, / with _, and remove trailing =
  return hash.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Start OAuth flow by opening browser
 */
export async function startOAuthFlow(
  service: string = "https://bsky.social",
): Promise<OAuthState> {
  const state = generateRandomString(32);
  const codeVerifier = generateRandomString(64);

  const oauthState: OAuthState = {
    state,
    codeVerifier,
    timestamp: Date.now(),
  };
  await AsyncStorage.setItem(OAUTH_STATE_KEY, JSON.stringify(oauthState));

  const redirectUri = "shadowsky://oauth-callback";
  const clientId = "shadowsky-mobile";

  // Generate code challenge using S256 method
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  const authUrl =
    `${service}/oauth/authorize?` +
    `client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&state=${state}` +
    `&code_challenge=${codeChallenge}` +
    `&code_challenge_method=S256`;

  const canOpen = await Linking.canOpenURL(authUrl);
  if (!canOpen) {
    throw new Error("Cannot open OAuth URL");
  }

  await Linking.openURL(authUrl);

  return oauthState;
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

    // Determine the token endpoint from the issuer or use default
    const tokenEndpoint = params.iss
      ? `${params.iss}/oauth/token`
      : "https://bsky.social/oauth/token";

    // Exchange authorization code for tokens using PKCE
    const redirectUri = "shadowsky://oauth-callback";
    const clientId = "shadowsky-mobile";

    const tokenResponse = await fetch(tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: params.code,
        redirect_uri: redirectUri,
        client_id: clientId,
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

    // Parse the token response into AtpSessionData
    // AT Protocol OAuth token response includes: access_token, refresh_token, token_type, scope, sub (DID)
    const sessionData: AtpSessionData = {
      accessJwt: tokenData.access_token,
      refreshJwt: tokenData.refresh_token,
      did: tokenData.sub,
      handle: tokenData.handle || "", // May need to fetch handle separately
      email: tokenData.email,
      emailConfirmed: tokenData.email_confirmed,
    };

    // Clean up OAuth state
    await AsyncStorage.removeItem(OAUTH_STATE_KEY);

    return sessionData;
  } catch (error) {
    await AsyncStorage.removeItem(OAUTH_STATE_KEY);
    throw error;
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
