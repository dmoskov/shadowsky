/**
 * OAuth Service for Mobile
 * Handles web-based OAuth flow for AT Protocol authentication
 */

import { AtpSessionData } from "@atproto/api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Linking } from "react-native";

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

/**
 * Generate a random string for OAuth state parameter
 */
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
 * Returns the OAuth state for verification
 */
export async function startOAuthFlow(
  service: string = "https://bsky.social",
): Promise<OAuthState> {
  try {
    // Generate state and code verifier for PKCE
    const state = generateRandomString(32);
    const codeVerifier = generateRandomString(64);

    // Store OAuth state for callback verification
    const oauthState: OAuthState = {
      state,
      codeVerifier,
      timestamp: Date.now(),
    };
    await AsyncStorage.setItem(OAUTH_STATE_KEY, JSON.stringify(oauthState));

    // Build OAuth URL
    // Note: This is a simplified version. In production, you'd use the full OAuth 2.0 flow
    // with PKCE (Proof Key for Code Exchange) and proper authorization endpoints
    const redirectUri = "shadowsky://oauth-callback";
    const clientId = "shadowsky-mobile"; // This should be registered with the service

    // For AT Protocol, the OAuth flow would typically go through the PDS's OAuth endpoints
    // For now, we'll use a placeholder that demonstrates the flow structure
    const authUrl =
      `${service}/oauth/authorize?` +
      `client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&state=${state}` +
      `&code_challenge=${codeVerifier}` + // In production, this should be hashed
      `&code_challenge_method=plain`; // Should be S256 in production

    // Open browser for OAuth flow
    const canOpen = await Linking.canOpenURL(authUrl);
    if (!canOpen) {
      throw new Error("Cannot open OAuth URL");
    }

    await Linking.openURL(authUrl);

    return oauthState;
  } catch (error) {
    console.error("Failed to start OAuth flow:", error);
    throw error;
  }
}

/**
 * Handle OAuth callback and exchange code for tokens
 */
export async function handleOAuthCallback(
  params: OAuthCallbackParams,
): Promise<AtpSessionData> {
  try {
    // Retrieve stored OAuth state
    const storedStateJson = await AsyncStorage.getItem(OAUTH_STATE_KEY);
    if (!storedStateJson) {
      throw new Error("No OAuth state found");
    }

    const storedState: OAuthState = JSON.parse(storedStateJson);

    // Verify state parameter
    if (params.state !== storedState.state) {
      throw new Error("OAuth state mismatch");
    }

    // Check if state is expired (15 minutes)
    const stateAge = Date.now() - storedState.timestamp;
    if (stateAge > 15 * 60 * 1000) {
      throw new Error("OAuth state expired");
    }

    // Exchange authorization code for tokens
    // Note: In production, this would call the token endpoint of the OAuth server
    // For AT Protocol, this is typically handled by the PDS
    // const service = params.iss || "https://bsky.social";
    // const client = getAtProtoClient();

    // TODO: Implement proper OAuth token exchange
    // For now, this is a placeholder that shows the expected flow
    // In production, you would:
    // 1. Call the token endpoint with the authorization code
    // 2. Include the code verifier for PKCE validation
    // 3. Receive access and refresh tokens
    // 4. Initialize the client with the tokens

    // Placeholder: In reality, we'd make an HTTP request to the token endpoint
    // const tokenResponse = await fetch(`${service}/oauth/token`, {
    //   method: 'POST',
    //   headers: {'Content-Type': 'application/json'},
    //   body: JSON.stringify({
    //     grant_type: 'authorization_code',
    //     code: params.code,
    //     redirect_uri: 'shadowsky://oauth-callback',
    //     client_id: 'shadowsky-mobile',
    //     code_verifier: storedState.codeVerifier,
    //   }),
    // });

    // For now, throw an error indicating OAuth is not fully implemented
    throw new Error(
      "OAuth token exchange not yet implemented. Use app password authentication instead.",
    );

    // Clean up OAuth state
    await AsyncStorage.removeItem(OAUTH_STATE_KEY);

    // Return session data (placeholder)
    // return sessionData;
  } catch (error) {
    console.error("Failed to handle OAuth callback:", error);
    // Clean up OAuth state on error
    await AsyncStorage.removeItem(OAUTH_STATE_KEY);
    throw error;
  }
}

/**
 * Cancel ongoing OAuth flow
 */
export async function cancelOAuthFlow(): Promise<void> {
  try {
    await AsyncStorage.removeItem(OAUTH_STATE_KEY);
  } catch (error) {
    console.error("Failed to cancel OAuth flow:", error);
  }
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

    // Check if state is expired (15 minutes)
    const stateAge = Date.now() - storedState.timestamp;
    if (stateAge > 15 * 60 * 1000) {
      // Clean up expired state
      await AsyncStorage.removeItem(OAUTH_STATE_KEY);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Failed to check OAuth flow status:", error);
    return false;
  }
}
