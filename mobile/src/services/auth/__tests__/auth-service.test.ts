/**
 * Tests for auth-service.ts
 * Comprehensive unit tests for authentication service functions
 *
 * After the SecureStore migration, tokens are stored in expo-secure-store
 * while account metadata stays in AsyncStorage.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {AtpSessionData} from '@atproto/api';
import {
  signInWithPassword,
  signInWithOAuth,
  resumeSession,
  signOut,
  getCurrentSession,
  getAccounts,
  removeAccount,
  getSessions,
  switchToAccount,
  AuthAccount,
  StoredSession,
} from '../auth-service';
import * as clientModule from '../../atproto/client';
import * as secureTokenStorage from '../secure-token-storage';

// Mock modules
jest.mock('@react-native-async-storage/async-storage');
jest.mock('../../atproto/client');
jest.mock('../secure-token-storage');
jest.mock('../oauth-expo');

import * as oauthExpo from '../oauth-expo';

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const mockSecureStorage = secureTokenStorage as jest.Mocked<typeof secureTokenStorage>;
const mockOAuthExpo = oauthExpo as jest.Mocked<typeof oauthExpo>;

describe('auth-service', () => {
  // Mock data
  const mockSessionData: AtpSessionData = {
    did: 'did:plc:test123',
    handle: 'testuser.bsky.social',
    email: 'test@example.com',
    accessJwt: 'mock-access-jwt',
    refreshJwt: 'mock-refresh-jwt',
    active: true,
  };

  const mockProfile = {
    data: {
      did: 'did:plc:test123',
      handle: 'testuser.bsky.social',
      displayName: 'Test User',
      avatar: 'https://example.com/avatar.jpg',
    },
  };

  const mockAccount: AuthAccount = {
    did: 'did:plc:test123',
    handle: 'testuser.bsky.social',
    email: 'test@example.com',
    displayName: 'Test User',
    avatar: 'https://example.com/avatar.jpg',
  };

  const mockStoredSession: StoredSession = {
    ...mockSessionData,
    account: mockAccount,
  } as StoredSession;

  let mockClient: any;
  let mockAgent: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset AsyncStorage mock (only used for accounts metadata now)
    mockAsyncStorage.getItem.mockResolvedValue(null);
    mockAsyncStorage.setItem.mockResolvedValue();
    mockAsyncStorage.removeItem.mockResolvedValue();

    // Reset SecureStore mocks
    mockSecureStorage.saveSessionTokens.mockResolvedValue();
    mockSecureStorage.getSessionTokens.mockResolvedValue(null);
    mockSecureStorage.deleteSessionTokens.mockResolvedValue();
    mockSecureStorage.setActiveSessionDid.mockResolvedValue();
    mockSecureStorage.getActiveSessionDid.mockResolvedValue(null);
    mockSecureStorage.clearActiveSessionDid.mockResolvedValue();
    mockSecureStorage.migrateTokensToSecureStore.mockResolvedValue();

    // Setup mock client and agent
    mockAgent = {
      getProfile: jest.fn().mockResolvedValue(mockProfile),
    };

    mockClient = {
      login: jest.fn().mockResolvedValue(mockSessionData),
      initialize: jest.fn().mockResolvedValue(mockAgent),
      resumeSession: jest.fn().mockResolvedValue(mockAgent),
      refreshSession: jest.fn().mockResolvedValue({
        accessJwt: 'new-access-jwt',
        refreshJwt: 'new-refresh-jwt',
      }),
      getAgent: jest.fn().mockReturnValue(mockAgent),
      setOAuthAgent: jest.fn(),
      isOAuthSession: jest.fn().mockReturnValue(false),
    };

    (clientModule.getAtProtoClient as jest.Mock).mockReturnValue(mockClient);
    (clientModule.resetAtProtoClient as jest.Mock).mockImplementation(() => {});
  });

  describe('signInWithPassword', () => {
    it('should successfully login and store tokens in SecureStore', async () => {
      const result = await signInWithPassword('testuser.bsky.social', 'password123');

      // Verify client methods were called
      expect(clientModule.resetAtProtoClient).toHaveBeenCalled();
      expect(clientModule.getAtProtoClient).toHaveBeenCalled();
      expect(mockClient.login).toHaveBeenCalledWith('testuser.bsky.social', 'password123');
      expect(mockAgent.getProfile).toHaveBeenCalledWith({actor: mockSessionData.did});

      // Verify tokens stored in SecureStore
      expect(mockSecureStorage.saveSessionTokens).toHaveBeenCalledWith(
        mockSessionData.did,
        expect.objectContaining({
          did: mockSessionData.did,
          accessJwt: mockSessionData.accessJwt,
          refreshJwt: mockSessionData.refreshJwt,
        })
      );
      expect(mockSecureStorage.setActiveSessionDid).toHaveBeenCalledWith(
        mockSessionData.did
      );

      // Verify account metadata stored in AsyncStorage
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        '@shadowsky/accounts',
        expect.stringContaining(mockSessionData.did)
      );

      // Verify return value
      expect(result).toMatchObject({
        did: mockSessionData.did,
        handle: mockSessionData.handle,
        account: expect.objectContaining({
          did: mockSessionData.did,
          handle: mockSessionData.handle,
        }),
      });
    });

    it('should throw error when login fails (no session data)', async () => {
      mockClient.login.mockResolvedValue(null);

      await expect(
        signInWithPassword('testuser.bsky.social', 'wrongpassword')
      ).rejects.toThrow('Login failed: no session data returned');

      // Verify SecureStore was not updated
      expect(mockSecureStorage.saveSessionTokens).not.toHaveBeenCalled();
    });

    it('should throw error when login throws', async () => {
      mockClient.login.mockRejectedValue(new Error('Invalid credentials'));

      await expect(
        signInWithPassword('testuser.bsky.social', 'wrongpassword')
      ).rejects.toThrow('Invalid credentials');

      // Verify SecureStore was not updated
      expect(mockSecureStorage.saveSessionTokens).not.toHaveBeenCalled();
    });
  });

  describe('signInWithOAuth', () => {
    it('should successfully sign in with OAuth using oauth-expo', async () => {
      const mockOAuthAgent = {
        getProfile: jest.fn().mockResolvedValue(mockProfile),
      };
      mockOAuthExpo.signInWithOAuth.mockResolvedValue({
        agent: mockOAuthAgent as any,
        did: mockSessionData.did,
      });

      const result = await signInWithOAuth('testuser.bsky.social');

      expect(clientModule.resetAtProtoClient).toHaveBeenCalled();
      expect(mockOAuthExpo.signInWithOAuth).toHaveBeenCalledWith('testuser.bsky.social');
      expect(mockClient.setOAuthAgent).toHaveBeenCalledWith(
        mockOAuthAgent,
        mockSessionData.did,
      );
      expect(mockOAuthAgent.getProfile).toHaveBeenCalledWith({actor: mockSessionData.did});

      // Verify auth method flag was stored
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        `@shadowsky/auth_method:${mockSessionData.did}`,
        'oauth',
      );

      expect(result).toMatchObject({
        did: mockSessionData.did,
        account: expect.objectContaining({
          did: mockSessionData.did,
        }),
      });
    });
  });

  describe('resumeSession', () => {
    it('should run migration and restore session from SecureStore', async () => {
      mockSecureStorage.getActiveSessionDid.mockResolvedValue(mockSessionData.did);
      mockSecureStorage.getSessionTokens.mockResolvedValue({
        did: mockSessionData.did,
        handle: mockSessionData.handle,
        accessJwt: mockSessionData.accessJwt,
        refreshJwt: mockSessionData.refreshJwt,
        email: mockSessionData.email,
        active: true,
      });
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify([mockAccount]));

      const result = await resumeSession();

      // Verify migration was run
      expect(mockSecureStorage.migrateTokensToSecureStore).toHaveBeenCalled();

      expect(mockSecureStorage.getActiveSessionDid).toHaveBeenCalled();
      expect(mockSecureStorage.getSessionTokens).toHaveBeenCalledWith(mockSessionData.did);
      expect(mockClient.resumeSession).toHaveBeenCalled();
      expect(result).toMatchObject({
        did: mockSessionData.did,
        handle: mockSessionData.handle,
      });
    });

    it('should return null when no active session DID exists', async () => {
      mockSecureStorage.getActiveSessionDid.mockResolvedValue(null);

      const result = await resumeSession();

      expect(result).toBeNull();
    });

    it('should return null when no tokens found for active DID', async () => {
      mockSecureStorage.getActiveSessionDid.mockResolvedValue(mockSessionData.did);
      mockSecureStorage.getSessionTokens.mockResolvedValue(null);

      const result = await resumeSession();

      expect(result).toBeNull();
    });

    it('should return session immediately and refresh profile in background', async () => {
      mockSecureStorage.getActiveSessionDid.mockResolvedValue(mockSessionData.did);
      mockSecureStorage.getSessionTokens.mockResolvedValue({
        did: mockSessionData.did,
        handle: mockSessionData.handle,
        accessJwt: mockSessionData.accessJwt,
        refreshJwt: mockSessionData.refreshJwt,
        email: mockSessionData.email,
        active: true,
      });
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify([mockAccount]));
      mockAgent.getProfile.mockRejectedValueOnce(new Error('Unauthorized'));

      const result = await resumeSession();

      expect(result).toBeTruthy();
      expect(result?.did).toBe(mockSessionData.did);

      // Allow background refreshProfileInBackground to settle
      await new Promise(resolve => setTimeout(resolve, 50));

      // Background refresh should have attempted token refresh
      expect(mockClient.refreshSession).toHaveBeenCalled();
    });

    it('should sign out in background if session refresh fails', async () => {
      mockSecureStorage.getActiveSessionDid.mockResolvedValue(mockSessionData.did);
      mockSecureStorage.getSessionTokens.mockResolvedValue({
        did: mockSessionData.did,
        handle: mockSessionData.handle,
        accessJwt: mockSessionData.accessJwt,
        refreshJwt: mockSessionData.refreshJwt,
        email: mockSessionData.email,
        active: true,
      });
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify([mockAccount]));
      mockAgent.getProfile.mockRejectedValue(new Error('Unauthorized'));
      mockClient.refreshSession.mockRejectedValue(new Error('Refresh failed'));

      const result = await resumeSession();

      expect(result).toBeTruthy();

      // Allow background refreshProfileInBackground to settle
      await new Promise(resolve => setTimeout(resolve, 50));

      // Sign out should delete tokens from SecureStore
      expect(mockSecureStorage.clearActiveSessionDid).toHaveBeenCalled();
      expect(clientModule.resetAtProtoClient).toHaveBeenCalled();
    });
  });

  describe('signOut', () => {
    it('should clear tokens from SecureStore and reset client', async () => {
      mockSecureStorage.getActiveSessionDid.mockResolvedValue(mockSessionData.did);

      await signOut();

      expect(mockSecureStorage.deleteSessionTokens).toHaveBeenCalledWith(mockSessionData.did);
      expect(mockSecureStorage.clearActiveSessionDid).toHaveBeenCalled();
      expect(clientModule.resetAtProtoClient).toHaveBeenCalled();
    });

    it('should handle sign out when no active session', async () => {
      mockSecureStorage.getActiveSessionDid.mockResolvedValue(null);

      await signOut();

      expect(mockSecureStorage.deleteSessionTokens).not.toHaveBeenCalled();
      expect(mockSecureStorage.clearActiveSessionDid).toHaveBeenCalled();
      expect(clientModule.resetAtProtoClient).toHaveBeenCalled();
    });
  });

  describe('getCurrentSession', () => {
    it('should return current session from SecureStore', async () => {
      mockSecureStorage.getActiveSessionDid.mockResolvedValue(mockSessionData.did);
      mockSecureStorage.getSessionTokens.mockResolvedValue({
        did: mockSessionData.did,
        handle: mockSessionData.handle,
        accessJwt: mockSessionData.accessJwt,
        refreshJwt: mockSessionData.refreshJwt,
        email: mockSessionData.email,
        active: true,
      });
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify([mockAccount]));

      const result = await getCurrentSession();

      expect(mockSecureStorage.getActiveSessionDid).toHaveBeenCalled();
      expect(result).toMatchObject({
        did: mockSessionData.did,
        accessJwt: mockSessionData.accessJwt,
        refreshJwt: mockSessionData.refreshJwt,
      });
    });

    it('should return null when no active session DID', async () => {
      mockSecureStorage.getActiveSessionDid.mockResolvedValue(null);

      const result = await getCurrentSession();

      expect(result).toBeNull();
    });

    it('should return null when no tokens found', async () => {
      mockSecureStorage.getActiveSessionDid.mockResolvedValue(mockSessionData.did);
      mockSecureStorage.getSessionTokens.mockResolvedValue(null);

      const result = await getCurrentSession();

      expect(result).toBeNull();
    });
  });

  describe('getAccounts', () => {
    it('should return stored accounts list from AsyncStorage', async () => {
      const accounts = [mockAccount];
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(accounts));

      const result = await getAccounts();

      expect(mockAsyncStorage.getItem).toHaveBeenCalledWith('@shadowsky/accounts');
      expect(result).toEqual(accounts);
    });

    it('should return empty array when no accounts exist', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      const result = await getAccounts();

      expect(result).toEqual([]);
    });

    it('should return empty array on parse error', async () => {
      mockAsyncStorage.getItem.mockResolvedValue('invalid-json');

      const result = await getAccounts();

      expect(result).toEqual([]);
    });
  });

  describe('removeAccount', () => {
    const secondAccount: AuthAccount = {
      did: 'did:plc:test456',
      handle: 'seconduser.bsky.social',
    };

    it('should remove account metadata and delete session tokens', async () => {
      const accounts = [mockAccount, secondAccount];
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(accounts));
      mockSecureStorage.getActiveSessionDid.mockResolvedValue('did:plc:other');

      await removeAccount('did:plc:test123');

      // Verify account metadata was removed from AsyncStorage
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        '@shadowsky/accounts',
        JSON.stringify([secondAccount])
      );

      // Verify session tokens deleted from SecureStore
      expect(mockSecureStorage.deleteSessionTokens).toHaveBeenCalledWith('did:plc:test123');

      // Active account was different, so shouldn't clear active session
      expect(mockSecureStorage.clearActiveSessionDid).not.toHaveBeenCalled();
    });

    it('should clear active session if removing active account', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify([mockAccount]));
      mockSecureStorage.getActiveSessionDid.mockResolvedValue(mockAccount.did);

      await removeAccount(mockAccount.did);

      expect(mockSecureStorage.deleteSessionTokens).toHaveBeenCalledWith(mockAccount.did);
      expect(mockSecureStorage.clearActiveSessionDid).toHaveBeenCalled();
      expect(clientModule.resetAtProtoClient).toHaveBeenCalled();
    });

    it('should handle storage errors gracefully', async () => {
      mockAsyncStorage.getItem.mockRejectedValue(new Error('Storage error'));

      // Should not throw
      await expect(removeAccount('did:plc:test123')).resolves.not.toThrow();
    });
  });

  describe('getSessions', () => {
    it('should reconstruct sessions from SecureStore tokens and AsyncStorage accounts', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify([mockAccount]));
      mockSecureStorage.getSessionTokens.mockResolvedValue({
        did: mockSessionData.did,
        handle: mockSessionData.handle,
        accessJwt: mockSessionData.accessJwt,
        refreshJwt: mockSessionData.refreshJwt,
        email: mockSessionData.email,
        active: true,
      });

      const result = await getSessions();

      expect(mockSecureStorage.getSessionTokens).toHaveBeenCalledWith(mockAccount.did);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        did: mockSessionData.did,
        accessJwt: mockSessionData.accessJwt,
        account: mockAccount,
      });
    });

    it('should return empty array when no accounts exist', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      const result = await getSessions();

      expect(result).toEqual([]);
    });

    it('should skip accounts with no SecureStore tokens', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify([mockAccount]));
      mockSecureStorage.getSessionTokens.mockResolvedValue(null);

      const result = await getSessions();

      expect(result).toEqual([]);
    });
  });

  describe('switchToAccount', () => {
    it('should switch to a different account using SecureStore tokens', async () => {
      mockSecureStorage.getSessionTokens.mockResolvedValue({
        did: mockSessionData.did,
        handle: mockSessionData.handle,
        accessJwt: mockSessionData.accessJwt,
        refreshJwt: mockSessionData.refreshJwt,
        email: mockSessionData.email,
        active: true,
      });
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify([mockAccount]));

      const result = await switchToAccount(mockAccount.did);

      expect(mockSecureStorage.getSessionTokens).toHaveBeenCalledWith(mockAccount.did);
      expect(mockClient.resumeSession).toHaveBeenCalled();
      expect(mockSecureStorage.saveSessionTokens).toHaveBeenCalledWith(
        mockSessionData.did,
        expect.objectContaining({
          did: mockSessionData.did,
          accessJwt: mockSessionData.accessJwt,
        })
      );
      expect(mockSecureStorage.setActiveSessionDid).toHaveBeenCalledWith(
        mockSessionData.did
      );
      expect(result).toMatchObject({
        did: mockAccount.did,
      });
    });

    it('should throw error if no tokens found for account', async () => {
      mockSecureStorage.getSessionTokens.mockResolvedValue(null);

      await expect(switchToAccount('did:plc:nonexistent')).rejects.toThrow(
        'Session not found for account'
      );
    });

    it('should handle expired session during switch', async () => {
      mockSecureStorage.getSessionTokens.mockResolvedValue({
        did: mockSessionData.did,
        handle: mockSessionData.handle,
        accessJwt: mockSessionData.accessJwt,
        refreshJwt: mockSessionData.refreshJwt,
        email: mockSessionData.email,
        active: true,
      });
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify([mockAccount]));
      mockAgent.getProfile.mockRejectedValue(new Error('Unauthorized'));

      const result = await switchToAccount(mockAccount.did);

      expect(mockClient.refreshSession).toHaveBeenCalled();
      expect(result).toBeTruthy();
    });

    it('should throw error if session refresh fails during switch', async () => {
      mockSecureStorage.getSessionTokens.mockResolvedValue({
        did: mockSessionData.did,
        handle: mockSessionData.handle,
        accessJwt: mockSessionData.accessJwt,
        refreshJwt: mockSessionData.refreshJwt,
        email: mockSessionData.email,
        active: true,
      });
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify([mockAccount]));
      mockAgent.getProfile.mockRejectedValue(new Error('Unauthorized'));
      mockClient.refreshSession.mockRejectedValue(new Error('Refresh failed'));

      await expect(switchToAccount(mockAccount.did)).rejects.toThrow(
        'Session expired. Please sign in again.'
      );

      // Should delete tokens on failed refresh
      expect(mockSecureStorage.deleteSessionTokens).toHaveBeenCalledWith(mockAccount.did);
    });
  });
});
