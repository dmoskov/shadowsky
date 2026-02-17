/**
 * Tests for oauth.ts
 * Unit tests for OAuth flow functions with AT Protocol PAR and PDS discovery
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import * as WebBrowser from "expo-web-browser";
import {
  startOAuthFlow,
  handleOAuthCallback,
  cancelOAuthFlow,
  hasOngoingOAuthFlow,
  parseCallbackUrl,
  OAuthState,
  OAuthCallbackParams,
} from "../oauth";

// Mock modules
jest.mock("@react-native-async-storage/async-storage");
jest.mock("expo-crypto");
jest.mock("expo-web-browser");
jest.mock("../../../utils/logger", () => ({
  createLogger: () => ({
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  }),
}));

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const mockCrypto = Crypto as jest.Mocked<typeof Crypto>;
const mockWebBrowser = WebBrowser as jest.Mocked<typeof WebBrowser>;

// Mock fetch globally
global.fetch = jest.fn();

describe("oauth", () => {
  const OAUTH_STATE_KEY = "@shadowsky/oauth_state";

  beforeEach(() => {
    jest.clearAllMocks();
    mockAsyncStorage.getItem.mockResolvedValue(null);
    mockAsyncStorage.setItem.mockResolvedValue();
    mockAsyncStorage.removeItem.mockResolvedValue();
    mockCrypto.digestStringAsync.mockResolvedValue("mocked-base64-hash==");

    // Default: mock fetch to return proper discovery responses
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      // Handle resolution
      if (url.includes("com.atproto.identity.resolveHandle")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ did: "did:plc:test123" }),
        });
      }
      // DID document
      if (url.includes("plc.directory")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            service: [
              {
                id: "#atproto_pds",
                type: "AtprotoPersonalDataServer",
                serviceEndpoint: "https://bsky.social",
              },
            ],
          }),
        });
      }
      // OAuth protected resource metadata
      if (url.includes("oauth-protected-resource")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            authorization_servers: ["https://bsky.social"],
          }),
        });
      }
      // Authorization server metadata
      if (url.includes("oauth-authorization-server")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            issuer: "https://bsky.social",
            authorization_endpoint: "https://bsky.social/oauth/authorize",
            token_endpoint: "https://bsky.social/oauth/token",
            pushed_authorization_request_endpoint:
              "https://bsky.social/oauth/par",
          }),
        });
      }
      // PAR endpoint
      if (url.includes("/oauth/par")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            request_uri: "urn:ietf:params:oauth:request_uri:test123",
            expires_in: 60,
          }),
        });
      }
      return Promise.resolve({ ok: false, status: 404 });
    });
  });

  describe("startOAuthFlow", () => {
    it("should store state and open in-app auth browser", async () => {
      mockWebBrowser.openAuthSessionAsync.mockResolvedValue({
        type: "success",
        url: "shadowsky://oauth-callback?code=testcode&state=teststate",
      } as any);

      const result = await startOAuthFlow("alice.bsky.social");

      // Verify state was stored
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        OAUTH_STATE_KEY,
        expect.stringContaining("state"),
      );

      // Parse stored state to verify structure
      const storedStateCall = (
        mockAsyncStorage.setItem as jest.Mock
      ).mock.calls.find((call) => call[0] === OAUTH_STATE_KEY);
      const storedState = JSON.parse(storedStateCall[1]);
      expect(storedState).toHaveProperty("state");
      expect(storedState).toHaveProperty("codeVerifier");
      expect(storedState).toHaveProperty("tokenEndpoint");
      expect(storedState).toHaveProperty("timestamp");
      expect(storedState.tokenEndpoint).toBe(
        "https://bsky.social/oauth/token",
      );

      // Verify in-app browser was opened (not Linking.openURL)
      expect(mockWebBrowser.openAuthSessionAsync).toHaveBeenCalledWith(
        expect.any(String),
        "shadowsky://oauth-callback",
      );

      // Verify result
      expect(result).toEqual({
        callbackUrl:
          "shadowsky://oauth-callback?code=testcode&state=teststate",
      });
    });

    it("should use PAR when available", async () => {
      mockWebBrowser.openAuthSessionAsync.mockResolvedValue({
        type: "success",
        url: "shadowsky://oauth-callback?code=test&state=test",
      } as any);

      await startOAuthFlow("alice.bsky.social");

      // Verify PAR was called
      const parCall = (global.fetch as jest.Mock).mock.calls.find((call) =>
        call[0].includes("/oauth/par"),
      );
      expect(parCall).toBeTruthy();
      expect(parCall[1].method).toBe("POST");

      // Verify the auth URL uses request_uri from PAR
      const authUrl = mockWebBrowser.openAuthSessionAsync.mock.calls[0][0];
      expect(authUrl).toContain("request_uri=");
      expect(authUrl).toContain("client_id=");
    });

    it("should strip @ from handle", async () => {
      mockWebBrowser.openAuthSessionAsync.mockResolvedValue({
        type: "success",
        url: "shadowsky://oauth-callback?code=test&state=test",
      } as any);

      await startOAuthFlow("@alice.bsky.social");

      // Verify handle resolution was called with clean handle
      const resolveCall = (global.fetch as jest.Mock).mock.calls.find((call) =>
        call[0].includes("resolveHandle"),
      );
      expect(resolveCall[0]).toContain("handle=alice.bsky.social");
    });

    it("should return null when user cancels auth", async () => {
      mockWebBrowser.openAuthSessionAsync.mockResolvedValue({
        type: "cancel",
      } as any);

      const result = await startOAuthFlow("alice.bsky.social");

      expect(result).toBeNull();
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith(
        OAUTH_STATE_KEY,
      );
    });
  });

  describe("handleOAuthCallback", () => {
    const mockOAuthState: OAuthState = {
      state: "test-state-123",
      codeVerifier: "test-verifier-456",
      tokenEndpoint: "https://bsky.social/oauth/token",
      timestamp: Date.now(),
    };

    const mockCallbackParams: OAuthCallbackParams = {
      code: "auth-code-789",
      state: "test-state-123",
      iss: "https://bsky.social",
    };

    const mockTokenResponse = {
      access_token: "mock-access-token",
      refresh_token: "mock-refresh-token",
      token_type: "Bearer",
      scope: "read write",
      sub: "did:plc:test123",
      handle: "testuser.bsky.social",
      email: "test@example.com",
      email_confirmed: true,
    };

    beforeEach(() => {
      // Override the default fetch mock for token exchange
      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes("/oauth/token")) {
          return Promise.resolve({
            ok: true,
            json: async () => mockTokenResponse,
          });
        }
        return Promise.resolve({ ok: false, status: 404 });
      });
    });

    it("should validate state and exchange code for tokens", async () => {
      mockAsyncStorage.getItem.mockResolvedValue(
        JSON.stringify(mockOAuthState),
      );

      const result = await handleOAuthCallback(mockCallbackParams);

      expect(mockAsyncStorage.getItem).toHaveBeenCalledWith(OAUTH_STATE_KEY);

      // Verify token exchange uses stored tokenEndpoint
      expect(global.fetch).toHaveBeenCalledWith(
        "https://bsky.social/oauth/token",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }),
      );

      // Verify request body
      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const bodyParams = new URLSearchParams(fetchCall[1].body);
      expect(bodyParams.get("grant_type")).toBe("authorization_code");
      expect(bodyParams.get("code")).toBe("auth-code-789");
      expect(bodyParams.get("redirect_uri")).toBe(
        "shadowsky://oauth-callback",
      );
      expect(bodyParams.get("client_id")).toBe(
        "https://shadowsky.io/client-metadata-mobile.json",
      );
      expect(bodyParams.get("code_verifier")).toBe("test-verifier-456");

      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith(
        OAUTH_STATE_KEY,
      );

      expect(result).toEqual({
        active: true,
        accessJwt: "mock-access-token",
        refreshJwt: "mock-refresh-token",
        did: "did:plc:test123",
        handle: "testuser.bsky.social",
        email: "test@example.com",
        emailConfirmed: true,
      });
    });

    it("should reject when no OAuth state found", async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      await expect(handleOAuthCallback(mockCallbackParams)).rejects.toThrow(
        "No OAuth state found",
      );
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith(
        OAUTH_STATE_KEY,
      );
    });

    it("should reject when state parameter does not match", async () => {
      mockAsyncStorage.getItem.mockResolvedValue(
        JSON.stringify(mockOAuthState),
      );

      await expect(
        handleOAuthCallback({ ...mockCallbackParams, state: "wrong-state" }),
      ).rejects.toThrow("OAuth state mismatch");
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith(
        OAUTH_STATE_KEY,
      );
    });

    it("should reject expired state (older than 15 minutes)", async () => {
      const expiredState: OAuthState = {
        ...mockOAuthState,
        timestamp: Date.now() - 16 * 60 * 1000,
      };
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(expiredState));

      await expect(handleOAuthCallback(mockCallbackParams)).rejects.toThrow(
        "OAuth state expired",
      );
    });

    it("should throw error when token exchange fails", async () => {
      mockAsyncStorage.getItem.mockResolvedValue(
        JSON.stringify(mockOAuthState),
      );
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => "Invalid authorization code",
      });

      await expect(handleOAuthCallback(mockCallbackParams)).rejects.toThrow(
        "Token exchange failed: 400 - Invalid authorization code",
      );
    });
  });

  describe("parseCallbackUrl", () => {
    it("should parse valid callback URL", () => {
      const result = parseCallbackUrl(
        "shadowsky://oauth-callback?code=abc&state=xyz&iss=https://bsky.social",
      );
      expect(result).toEqual({
        code: "abc",
        state: "xyz",
        iss: "https://bsky.social",
      });
    });

    it("should return null for missing code", () => {
      const result = parseCallbackUrl(
        "shadowsky://oauth-callback?state=xyz",
      );
      expect(result).toBeNull();
    });

    it("should return null for invalid URL", () => {
      const result = parseCallbackUrl("not-a-url");
      expect(result).toBeNull();
    });

    it("should handle missing iss gracefully", () => {
      const result = parseCallbackUrl(
        "shadowsky://oauth-callback?code=abc&state=xyz",
      );
      expect(result).toEqual({
        code: "abc",
        state: "xyz",
        iss: undefined,
      });
    });
  });

  describe("cancelOAuthFlow", () => {
    it("should clear stored OAuth state", async () => {
      await cancelOAuthFlow();
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith(
        OAUTH_STATE_KEY,
      );
    });
  });

  describe("hasOngoingOAuthFlow", () => {
    const mockOAuthState: OAuthState = {
      state: "test-state",
      codeVerifier: "test-verifier",
      tokenEndpoint: "https://bsky.social/oauth/token",
      timestamp: Date.now(),
    };

    it("should return true when active OAuth flow exists", async () => {
      mockAsyncStorage.getItem.mockResolvedValue(
        JSON.stringify(mockOAuthState),
      );
      expect(await hasOngoingOAuthFlow()).toBe(true);
    });

    it("should return false when no OAuth state exists", async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);
      expect(await hasOngoingOAuthFlow()).toBe(false);
    });

    it("should return false when OAuth state is expired", async () => {
      const expiredState: OAuthState = {
        ...mockOAuthState,
        timestamp: Date.now() - 16 * 60 * 1000,
      };
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(expiredState));
      expect(await hasOngoingOAuthFlow()).toBe(false);
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith(
        OAUTH_STATE_KEY,
      );
    });

    it("should return false on parse error", async () => {
      mockAsyncStorage.getItem.mockResolvedValue("invalid-json");
      expect(await hasOngoingOAuthFlow()).toBe(false);
    });

    it("should return false when storage access fails", async () => {
      mockAsyncStorage.getItem.mockRejectedValue(new Error("Storage error"));
      expect(await hasOngoingOAuthFlow()).toBe(false);
    });
  });
});
