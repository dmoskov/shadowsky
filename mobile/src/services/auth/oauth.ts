/**
 * OAuth Service for Mobile
 * Handles web-based OAuth flow for AT Protocol authentication
 */

import { AtpSessionData } from "@atproto/api";
import AsyncStorage from "@react-native-async-storage/async-storage";
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

  const authUrl =
    `${service}/oauth/authorize?` +
    `client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&state=${state}` +
    `&code_challenge=${codeVerifier}` +
    `&code_challenge_method=plain`;

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

    // TODO: Implement proper OAuth token exchange with PKCE
    throw new Error(
      "OAuth token exchange not yet implemented. Use app password authentication instead.",
    );
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
