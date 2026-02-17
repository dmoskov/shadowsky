/**
 * Tests for auth-service.ts
 * Comprehensive unit tests for authentication service functions
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

// Mock modules
jest.mock('@react-native-async-storage/async-storage');
jest.mock('../../atproto/client');

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

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

    // Reset AsyncStorage mock
    mockAsyncStorage.getItem.mockResolvedValue(null);
    mockAsyncStorage.setItem.mockResolvedValue();
    mockAsyncStorage.removeItem.mockResolvedValue();

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
    };

    (clientModule.getAtProtoClient as jest.Mock).mockReturnValue(mockClient);
    (clientModule.resetAtProtoClient as jest.Mock).mockImplementation(() => {});
  });

  describe('signInWithPassword', () => {
    it('should successfully login and store session and account', async () => {
      const result = await signInWithPassword('testuser.bsky.social', 'password123');

      // Verify client methods were called
      expect(clientModule.resetAtProtoClient).toHaveBeenCalled();
      expect(clientModule.getAtProtoClient).toHaveBeenCalled();
      expect(mockClient.login).toHaveBeenCalledWith('testuser.bsky.social', 'password123');
      expect(mockAgent.getProfile).toHaveBeenCalledWith({actor: mockSessionData.did});

      // Verify storage was updated
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        '@shadowsky/auth_session',
        expect.stringContaining(mockSessionData.did)
      );
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        '@shadowsky/active_account',
        mockSessionData.did
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

      // Verify storage was not updated
      expect(mockAsyncStorage.setItem).not.toHaveBeenCalledWith(
        '@shadowsky/auth_session',
        expect.anything()
      );
    });

    it('should throw error when login throws', async () => {
      mockClient.login.mockRejectedValue(new Error('Invalid credentials'));

      await expect(
        signInWithPassword('testuser.bsky.social', 'wrongpassword')
      ).rejects.toThrow('Invalid credentials');

      // Verify storage was not updated
      expect(mockAsyncStorage.setItem).not.toHaveBeenCalledWith(
        '@shadowsky/auth_session',
        expect.anything()
      );
    });
  });

  describe('signInWithOAuth', () => {
    it('should successfully sign in with OAuth session data', async () => {
      const result = await signInWithOAuth(mockSessionData);

      expect(clientModule.resetAtProtoClient).toHaveBeenCalled();
      expect(mockClient.initialize).toHaveBeenCalledWith(mockSessionData);
      expect(mockAgent.getProfile).toHaveBeenCalledWith({actor: mockSessionData.did});

      // Verify storage was updated
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        '@shadowsky/auth_session',
        expect.stringContaining(mockSessionData.did)
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
    it('should restore valid session from AsyncStorage', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(mockStoredSession));

      const result = await resumeSession();

      expect(mockAsyncStorage.getItem).toHaveBeenCalledWith('@shadowsky/auth_session');
      expect(mockClient.resumeSession).toHaveBeenCalledWith(mockStoredSession);
      expect(result).toMatchObject({
        did: mockSessionData.did,
        handle: mockSessionData.handle,
      });
    });

    it('should return null when no stored session exists', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      const result = await resumeSession();

      expect(mockAsyncStorage.getItem).toHaveBeenCalledWith('@shadowsky/auth_session');
      expect(result).toBeNull();
    });

    it('should return session immediately and refresh profile in background', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(mockStoredSession));
      mockAgent.getProfile.mockRejectedValueOnce(new Error('Unauthorized'));

      const result = await resumeSession();

      // resumeSession now returns immediately after client.resumeSession,
      // deferring profile refresh to the background for faster cold start.
      expect(result).toBeTruthy();
      expect(result?.did).toBe(mockSessionData.did);

      // Allow background refreshProfileInBackground to settle
      await new Promise(resolve => setTimeout(resolve, 50));

      // Background refresh should have attempted token refresh
      expect(mockClient.refreshSession).toHaveBeenCalled();
    });

    it('should sign out in background if session refresh fails', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(mockStoredSession));
      mockAgent.getProfile.mockRejectedValue(new Error('Unauthorized'));
      mockClient.refreshSession.mockRejectedValue(new Error('Refresh failed'));

      const result = await resumeSession();

      // resumeSession returns the stored session immediately; sign-out
      // happens in the background when both profile fetch and token refresh fail.
      expect(result).toBeTruthy();

      // Allow background refreshProfileInBackground to settle
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('@shadowsky/auth_session');
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('@shadowsky/active_account');
      expect(clientModule.resetAtProtoClient).toHaveBeenCalled();
    });

    it('should return null on invalid JSON in storage', async () => {
      mockAsyncStorage.getItem.mockResolvedValue('invalid-json');

      const result = await resumeSession();

      expect(result).toBeNull();
    });
  });

  describe('signOut', () => {
    it('should clear session from AsyncStorage and reset client', async () => {
      await signOut();

      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('@shadowsky/auth_session');
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('@shadowsky/active_account');
      expect(clientModule.resetAtProtoClient).toHaveBeenCalled();
    });
  });

  describe('getCurrentSession', () => {
    it('should return current session from storage', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(mockStoredSession));

      const result = await getCurrentSession();

      expect(mockAsyncStorage.getItem).toHaveBeenCalledWith('@shadowsky/auth_session');
      expect(result).toEqual(mockStoredSession);
    });

    it('should return null when no session exists', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      const result = await getCurrentSession();

      expect(result).toBeNull();
    });

    it('should return null on parse error', async () => {
      mockAsyncStorage.getItem.mockResolvedValue('invalid-json');

      const result = await getCurrentSession();

      expect(result).toBeNull();
    });
  });

  describe('getAccounts', () => {
    it('should return stored accounts list', async () => {
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

    it('should remove specific account by DID', async () => {
      const accounts = [mockAccount, secondAccount];
      mockAsyncStorage.getItem
        .mockResolvedValueOnce(JSON.stringify(accounts)) // getAccounts call
        .mockResolvedValueOnce(JSON.stringify([mockStoredSession])) // getSessions call
        .mockResolvedValueOnce('did:plc:other'); // active account check

      await removeAccount('did:plc:test123');

      // Verify account was removed
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        '@shadowsky/accounts',
        JSON.stringify([secondAccount])
      );

      // Verify session was removed
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        '@shadowsky/sessions',
        JSON.stringify([])
      );

      // Active account was different, so shouldn't clear auth
      expect(mockAsyncStorage.removeItem).not.toHaveBeenCalledWith('@shadowsky/auth_session');
    });

    it('should clear auth session if removing active account', async () => {
      mockAsyncStorage.getItem
        .mockResolvedValueOnce(JSON.stringify([mockAccount])) // getAccounts call
        .mockResolvedValueOnce(JSON.stringify([mockStoredSession])) // getSessions call
        .mockResolvedValueOnce(mockAccount.did); // active account check

      await removeAccount(mockAccount.did);

      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('@shadowsky/auth_session');
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('@shadowsky/active_account');
      expect(clientModule.resetAtProtoClient).toHaveBeenCalled();
    });

    it('should handle storage errors gracefully', async () => {
      mockAsyncStorage.getItem.mockRejectedValue(new Error('Storage error'));

      // Should not throw
      await expect(removeAccount('did:plc:test123')).resolves.not.toThrow();
    });
  });

  describe('getSessions', () => {
    it('should return all stored sessions', async () => {
      const sessions = [mockStoredSession];
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(sessions));

      const result = await getSessions();

      expect(mockAsyncStorage.getItem).toHaveBeenCalledWith('@shadowsky/sessions');
      expect(result).toEqual(sessions);
    });

    it('should return empty array when no sessions exist', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      const result = await getSessions();

      expect(result).toEqual([]);
    });
  });

  describe('switchToAccount', () => {
    it('should switch to a different account session', async () => {
      const sessions = [mockStoredSession];
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(sessions));

      const result = await switchToAccount(mockAccount.did);

      expect(mockClient.resumeSession).toHaveBeenCalledWith(mockStoredSession);
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        '@shadowsky/auth_session',
        expect.stringContaining(mockAccount.did)
      );
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        '@shadowsky/active_account',
        mockAccount.did
      );
      expect(result).toMatchObject({
        did: mockAccount.did,
      });
    });

    it('should throw error if session not found', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify([]));

      await expect(switchToAccount('did:plc:nonexistent')).rejects.toThrow(
        'Session not found for account'
      );
    });

    it('should handle expired session during switch', async () => {
      const sessions = [mockStoredSession];
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(sessions));
      mockAgent.getProfile.mockRejectedValue(new Error('Unauthorized'));

      const result = await switchToAccount(mockAccount.did);

      expect(mockClient.refreshSession).toHaveBeenCalled();
      expect(result).toBeTruthy();
    });

    it('should throw error if session refresh fails during switch', async () => {
      const sessions = [mockStoredSession];
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(sessions));
      mockAgent.getProfile.mockRejectedValue(new Error('Unauthorized'));
      mockClient.refreshSession.mockRejectedValue(new Error('Refresh failed'));

      await expect(switchToAccount(mockAccount.did)).rejects.toThrow(
        'Session expired. Please sign in again.'
      );
    });
  });
});
