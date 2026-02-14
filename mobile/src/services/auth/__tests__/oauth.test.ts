/**
 * Tests for oauth.ts
 * Comprehensive unit tests for OAuth flow functions
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import {
  startOAuthFlow,
  handleOAuthCallback,
  cancelOAuthFlow,
  hasOngoingOAuthFlow,
  OAuthState,
  OAuthCallbackParams,
} from '../oauth';

// Mock modules
jest.mock('@react-native-async-storage/async-storage');
jest.mock('expo-crypto');
jest.mock('expo-linking');

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const mockCrypto = Crypto as jest.Mocked<typeof Crypto>;
const mockLinking = Linking as jest.Mocked<typeof Linking>;

// Mock fetch globally
global.fetch = jest.fn();

describe('oauth', () => {
  const OAUTH_STATE_KEY = '@shadowsky/oauth_state';

  beforeEach(() => {
    jest.clearAllMocks();
    mockAsyncStorage.getItem.mockResolvedValue(null);
    mockAsyncStorage.setItem.mockResolvedValue();
    mockAsyncStorage.removeItem.mockResolvedValue();
    mockLinking.canOpenURL.mockResolvedValue(true);
    mockLinking.openURL.mockResolvedValue(true);
    mockCrypto.digestStringAsync.mockResolvedValue('mocked-base64-hash==');
  });

  describe('startOAuthFlow', () => {
    it('should store state and open OAuth URL', async () => {
      const result = await startOAuthFlow('https://bsky.social');

      // Verify state was stored
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        OAUTH_STATE_KEY,
        expect.stringContaining('state')
      );

      // Parse stored state to verify structure
      const storedStateCall = (mockAsyncStorage.setItem as jest.Mock).mock.calls.find(
        call => call[0] === OAUTH_STATE_KEY
      );
      const storedState = JSON.parse(storedStateCall[1]);
      expect(storedState).toHaveProperty('state');
      expect(storedState).toHaveProperty('codeVerifier');
      expect(storedState).toHaveProperty('timestamp');
      expect(typeof storedState.state).toBe('string');
      expect(storedState.state.length).toBe(32);
      expect(typeof storedState.codeVerifier).toBe('string');
      expect(storedState.codeVerifier.length).toBe(64);

      // Verify URL was opened
      expect(mockLinking.canOpenURL).toHaveBeenCalled();
      expect(mockLinking.openURL).toHaveBeenCalledWith(
        expect.stringContaining('https://bsky.social/oauth/authorize')
      );

      // Verify URL contains required parameters
      const urlCall = (mockLinking.openURL as jest.Mock).mock.calls[0][0];
      expect(urlCall).toContain('client_id=shadowsky-mobile');
      expect(urlCall).toContain('redirect_uri=shadowsky%3A%2F%2Foauth-callback');
      expect(urlCall).toContain('response_type=code');
      expect(urlCall).toContain(`state=${storedState.state}`);
      expect(urlCall).toContain('code_challenge=');
      expect(urlCall).toContain('code_challenge_method=S256');

      // Verify return value
      expect(result).toEqual(storedState);
    });

    it('should use default service if not provided', async () => {
      await startOAuthFlow();

      expect(mockLinking.openURL).toHaveBeenCalledWith(
        expect.stringContaining('https://bsky.social/oauth/authorize')
      );
    });

    it('should throw error if URL cannot be opened', async () => {
      mockLinking.canOpenURL.mockResolvedValue(false);

      await expect(startOAuthFlow()).rejects.toThrow('Cannot open OAuth URL');

      expect(mockLinking.openURL).not.toHaveBeenCalled();
    });

    it('should generate code challenge using S256 method', async () => {
      await startOAuthFlow();

      // Verify SHA256 hash was called
      expect(mockCrypto.digestStringAsync).toHaveBeenCalledWith(
        Crypto.CryptoDigestAlgorithm.SHA256,
        expect.any(String),
        {encoding: Crypto.CryptoEncoding.BASE64}
      );

      // Verify code challenge is base64url encoded (replaces + with -, / with _, removes =)
      const urlCall = (mockLinking.openURL as jest.Mock).mock.calls[0][0];
      const codeChallengeMatch = urlCall.match(/code_challenge=([^&]+)/);
      expect(codeChallengeMatch).toBeTruthy();
      const codeChallenge = decodeURIComponent(codeChallengeMatch[1]);
      expect(codeChallenge).toBe('mocked-base64-hash'); // Should have = removed
    });
  });

  describe('handleOAuthCallback', () => {
    const mockOAuthState: OAuthState = {
      state: 'test-state-123',
      codeVerifier: 'test-verifier-456',
      timestamp: Date.now(),
    };

    const mockCallbackParams: OAuthCallbackParams = {
      code: 'auth-code-789',
      state: 'test-state-123',
      iss: 'https://bsky.social',
    };

    const mockTokenResponse = {
      access_token: 'mock-access-token',
      refresh_token: 'mock-refresh-token',
      token_type: 'Bearer',
      scope: 'read write',
      sub: 'did:plc:test123',
      handle: 'testuser.bsky.social',
      email: 'test@example.com',
      email_confirmed: true,
    };

    beforeEach(() => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockTokenResponse,
      });
    });

    it('should validate state parameter and exchange code for tokens', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(mockOAuthState));

      const result = await handleOAuthCallback(mockCallbackParams);

      // Verify state was retrieved
      expect(mockAsyncStorage.getItem).toHaveBeenCalledWith(OAUTH_STATE_KEY);

      // Verify token exchange request
      expect(global.fetch).toHaveBeenCalledWith(
        'https://bsky.social/oauth/token',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        })
      );

      // Verify request body contains required parameters
      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const bodyParams = new URLSearchParams(fetchCall[1].body);
      expect(bodyParams.get('grant_type')).toBe('authorization_code');
      expect(bodyParams.get('code')).toBe('auth-code-789');
      expect(bodyParams.get('redirect_uri')).toBe('shadowsky://oauth-callback');
      expect(bodyParams.get('client_id')).toBe('shadowsky-mobile');
      expect(bodyParams.get('code_verifier')).toBe('test-verifier-456');

      // Verify OAuth state was cleaned up
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith(OAUTH_STATE_KEY);

      // Verify result structure
      expect(result).toEqual({
        active: true,
        accessJwt: 'mock-access-token',
        refreshJwt: 'mock-refresh-token',
        did: 'did:plc:test123',
        handle: 'testuser.bsky.social',
        email: 'test@example.com',
        emailConfirmed: true,
      });
    });

    it('should reject when no OAuth state found', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      await expect(handleOAuthCallback(mockCallbackParams)).rejects.toThrow(
        'No OAuth state found'
      );

      expect(global.fetch).not.toHaveBeenCalled();
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith(OAUTH_STATE_KEY);
    });

    it('should reject when state parameter does not match', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(mockOAuthState));

      const invalidParams = {
        ...mockCallbackParams,
        state: 'wrong-state',
      };

      await expect(handleOAuthCallback(invalidParams)).rejects.toThrow('OAuth state mismatch');

      expect(global.fetch).not.toHaveBeenCalled();
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith(OAUTH_STATE_KEY);
    });

    it('should reject expired state (older than 15 minutes)', async () => {
      const expiredState: OAuthState = {
        ...mockOAuthState,
        timestamp: Date.now() - 16 * 60 * 1000, // 16 minutes ago
      };
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(expiredState));

      await expect(handleOAuthCallback(mockCallbackParams)).rejects.toThrow(
        'OAuth state expired'
      );

      expect(global.fetch).not.toHaveBeenCalled();
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith(OAUTH_STATE_KEY);
    });

    it('should accept state that is not quite 15 minutes old', async () => {
      const almostExpiredState: OAuthState = {
        ...mockOAuthState,
        timestamp: Date.now() - (15 * 60 * 1000 - 1000), // 14 minutes 59 seconds ago
      };
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(almostExpiredState));

      await expect(handleOAuthCallback(mockCallbackParams)).resolves.toBeTruthy();
    });

    it('should use default token endpoint if issuer not provided', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(mockOAuthState));

      const paramsWithoutIss: OAuthCallbackParams = {
        code: 'auth-code-789',
        state: 'test-state-123',
      };

      await handleOAuthCallback(paramsWithoutIss);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://bsky.social/oauth/token',
        expect.anything()
      );
    });

    it('should throw error when token exchange fails', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(mockOAuthState));
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => 'Invalid authorization code',
      });

      await expect(handleOAuthCallback(mockCallbackParams)).rejects.toThrow(
        'Token exchange failed: 400 - Invalid authorization code'
      );

      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith(OAUTH_STATE_KEY);
    });

    it('should clean up state even when callback processing fails', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(mockOAuthState));
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(handleOAuthCallback(mockCallbackParams)).rejects.toThrow('Network error');

      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith(OAUTH_STATE_KEY);
    });
  });

  describe('cancelOAuthFlow', () => {
    it('should clear stored OAuth state', async () => {
      await cancelOAuthFlow();

      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith(OAUTH_STATE_KEY);
    });
  });

  describe('hasOngoingOAuthFlow', () => {
    const mockOAuthState: OAuthState = {
      state: 'test-state',
      codeVerifier: 'test-verifier',
      timestamp: Date.now(),
    };

    it('should return true when active OAuth flow exists', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(mockOAuthState));

      const result = await hasOngoingOAuthFlow();

      expect(mockAsyncStorage.getItem).toHaveBeenCalledWith(OAUTH_STATE_KEY);
      expect(result).toBe(true);
    });

    it('should return false when no OAuth state exists', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      const result = await hasOngoingOAuthFlow();

      expect(result).toBe(false);
    });

    it('should return false when OAuth state is expired', async () => {
      const expiredState: OAuthState = {
        ...mockOAuthState,
        timestamp: Date.now() - 16 * 60 * 1000, // 16 minutes ago
      };
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(expiredState));

      const result = await hasOngoingOAuthFlow();

      expect(result).toBe(false);
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith(OAUTH_STATE_KEY);
    });

    it('should return true when state is not expired (14 minutes old)', async () => {
      const validState: OAuthState = {
        ...mockOAuthState,
        timestamp: Date.now() - 14 * 60 * 1000, // 14 minutes ago
      };
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(validState));

      const result = await hasOngoingOAuthFlow();

      expect(result).toBe(true);
      expect(mockAsyncStorage.removeItem).not.toHaveBeenCalled();
    });

    it('should return false on parse error', async () => {
      mockAsyncStorage.getItem.mockResolvedValue('invalid-json');

      const result = await hasOngoingOAuthFlow();

      expect(result).toBe(false);
    });

    it('should return false when storage access fails', async () => {
      mockAsyncStorage.getItem.mockRejectedValue(new Error('Storage error'));

      const result = await hasOngoingOAuthFlow();

      expect(result).toBe(false);
    });
  });
});
