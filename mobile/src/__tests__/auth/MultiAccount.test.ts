/**
 * Multi-Account Tests
 *
 * Tests account switching, account removal, session reconstruction from
 * multiple stored sessions, and edge cases like switching to an account
 * with an expired session.
 */

// ── Mocks ──────────────────────────────────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('../../utils/logger', () => ({
  createLogger: () => ({
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

// Secure token storage
const mockSaveSessionTokens = jest.fn().mockResolvedValue(undefined);
const mockGetSessionTokens = jest.fn();
const mockDeleteSessionTokens = jest.fn().mockResolvedValue(undefined);
const mockSetActiveSessionDid = jest.fn().mockResolvedValue(undefined);
const mockGetActiveSessionDid = jest.fn();
const mockClearActiveSessionDid = jest.fn().mockResolvedValue(undefined);
const mockMigrateTokensToSecureStore = jest.fn().mockResolvedValue(undefined);

jest.mock('../../services/auth/secure-token-storage', () => ({
  saveSessionTokens: (...args: unknown[]) => mockSaveSessionTokens(...args),
  getSessionTokens: (...args: unknown[]) => mockGetSessionTokens(...args),
  deleteSessionTokens: (...args: unknown[]) => mockDeleteSessionTokens(...args),
  setActiveSessionDid: (...args: unknown[]) => mockSetActiveSessionDid(...args),
  getActiveSessionDid: (...args: unknown[]) => mockGetActiveSessionDid(...args),
  clearActiveSessionDid: (...args: unknown[]) => mockClearActiveSessionDid(...args),
  migrateTokensToSecureStore: (...args: unknown[]) => mockMigrateTokensToSecureStore(...args),
}));

// AT Proto client
const mockGetProfile = jest.fn();
const mockClientResumeSession = jest.fn().mockResolvedValue(undefined);
const mockClientRefreshSession = jest.fn();

jest.mock('../../services/atproto/client', () => ({
  getAtProtoClient: jest.fn(() => ({
    getAgent: jest.fn(() => ({
      getProfile: mockGetProfile,
      session: null,
    })),
    login: jest.fn(),
    resumeSession: mockClientResumeSession,
    refreshSession: mockClientRefreshSession,
    initialize: jest.fn(),
  })),
  resetAtProtoClient: jest.fn(),
}));

jest.mock('../../services/rate-limiter', () => ({
  rateLimited: jest.fn((fn: () => unknown) => fn()),
  ATProtoEndpointType: { AUTH: 'AUTH' },
}));

// ── Import after mocks ────────────────────────────────────────────────────────

import {
  switchToAccount,
  removeAccount,
  getAccounts,
  getSessions,
} from '../../services/auth/auth-service';

// ── Helpers ────────────────────────────────────────────────────────────────────

const ACCOUNTS_STORAGE_KEY = '@shadowsky/accounts';

const ALICE = {
  account: { did: 'did:plc:alice', handle: 'alice.bsky.social', displayName: 'Alice' },
  tokens: {
    did: 'did:plc:alice',
    handle: 'alice.bsky.social',
    accessJwt: 'alice-access',
    refreshJwt: 'alice-refresh',
    active: true,
  },
};

const BOB = {
  account: { did: 'did:plc:bob', handle: 'bob.bsky.social', displayName: 'Bob' },
  tokens: {
    did: 'did:plc:bob',
    handle: 'bob.bsky.social',
    accessJwt: 'bob-access',
    refreshJwt: 'bob-refresh',
    active: true,
  },
};

const CHARLIE = {
  account: { did: 'did:plc:charlie', handle: 'charlie.bsky.social', displayName: 'Charlie' },
  tokens: {
    did: 'did:plc:charlie',
    handle: 'charlie.bsky.social',
    accessJwt: 'charlie-access',
    refreshJwt: 'charlie-refresh',
    active: true,
  },
};

function setupMultiAccountStorage(users: typeof ALICE[]) {
  const accounts = users.map(u => u.account);
  (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
    if (key === ACCOUNTS_STORAGE_KEY) {
      return Promise.resolve(JSON.stringify(accounts));
    }
    return Promise.resolve(null);
  });

  mockGetSessionTokens.mockImplementation((did: string) => {
    const user = users.find(u => u.tokens.did === did);
    return Promise.resolve(user ? user.tokens : null);
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('Multi-Account', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
  });

  // ── Account listing ──────────────────────────────────────────────────────

  describe('getAccounts', () => {
    it('returns all stored accounts from AsyncStorage', async () => {
      const accounts = [ALICE.account, BOB.account];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(accounts),
      );

      const result = await getAccounts();

      expect(result).toHaveLength(2);
      expect(result[0].did).toBe('did:plc:alice');
      expect(result[1].did).toBe('did:plc:bob');
    });

    it('returns empty array when no accounts are stored', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const result = await getAccounts();

      expect(result).toEqual([]);
    });

    it('returns empty array on storage read failure', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

      const result = await getAccounts();

      expect(result).toEqual([]);
    });
  });

  // ── getSessions (reconstruct from SecureStore + AsyncStorage) ────────────

  describe('getSessions', () => {
    it('reconstructs StoredSession objects from all accounts', async () => {
      setupMultiAccountStorage([ALICE, BOB]);

      const sessions = await getSessions();

      expect(sessions).toHaveLength(2);
      expect(sessions[0].did).toBe('did:plc:alice');
      expect(sessions[0].accessJwt).toBe('alice-access');
      expect(sessions[0].account.handle).toBe('alice.bsky.social');
      expect(sessions[1].did).toBe('did:plc:bob');
    });

    it('skips accounts that have no tokens in SecureStore', async () => {
      const accounts = [ALICE.account, BOB.account, CHARLIE.account];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(accounts),
      );

      // Only Alice and Charlie have tokens; Bob's are missing
      mockGetSessionTokens.mockImplementation((did: string) => {
        if (did === 'did:plc:alice') return Promise.resolve(ALICE.tokens);
        if (did === 'did:plc:charlie') return Promise.resolve(CHARLIE.tokens);
        return Promise.resolve(null);
      });

      const sessions = await getSessions();

      expect(sessions).toHaveLength(2);
      expect(sessions.map(s => s.did)).toEqual(['did:plc:alice', 'did:plc:charlie']);
    });

    it('returns empty array when no accounts exist', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const sessions = await getSessions();

      expect(sessions).toEqual([]);
    });
  });

  // ── Account switching ────────────────────────────────────────────────────

  describe('switchToAccount', () => {
    it('switches to another account and loads its session', async () => {
      setupMultiAccountStorage([ALICE, BOB]);
      mockClientResumeSession.mockResolvedValue(undefined);
      mockGetProfile.mockResolvedValue({
        data: { handle: 'bob.bsky.social', displayName: 'Bob', avatar: 'bob-avatar' },
      });

      const session = await switchToAccount('did:plc:bob');

      expect(session.did).toBe('did:plc:bob');
      expect(session.handle).toBe('bob.bsky.social');
      expect(mockClientResumeSession).toHaveBeenCalled();
      expect(mockSetActiveSessionDid).toHaveBeenCalledWith('did:plc:bob');
    });

    it('updates profile data from the server after switching', async () => {
      setupMultiAccountStorage([ALICE, BOB]);
      mockClientResumeSession.mockResolvedValue(undefined);
      mockGetProfile.mockResolvedValue({
        data: {
          handle: 'bob.bsky.social',
          displayName: 'Robert',
          avatar: 'https://cdn.bsky.app/new-avatar.jpg',
        },
      });

      const session = await switchToAccount('did:plc:bob');

      // Profile data should be updated with server response
      expect(session.account.displayName).toBe('Robert');
      expect(session.account.avatar).toBe('https://cdn.bsky.app/new-avatar.jpg');
    });

    it('throws when target account has no stored session', async () => {
      mockGetSessionTokens.mockResolvedValue(null);

      await expect(switchToAccount('did:plc:unknown')).rejects.toThrow(
        'Session not found for account',
      );
    });

    it('attempts token refresh when profile fetch fails (expired session)', async () => {
      setupMultiAccountStorage([ALICE, BOB]);
      mockClientResumeSession.mockResolvedValue(undefined);

      // Profile fetch fails (expired token)
      mockGetProfile.mockRejectedValue(new Error('Token expired'));

      // Refresh succeeds
      mockClientRefreshSession.mockResolvedValue({
        accessJwt: 'bob-refreshed-access',
        refreshJwt: 'bob-refreshed-refresh',
      });

      const session = await switchToAccount('did:plc:bob');

      expect(mockClientRefreshSession).toHaveBeenCalled();
      expect(session.accessJwt).toBe('bob-refreshed-access');
      expect(session.refreshJwt).toBe('bob-refreshed-refresh');
    });

    it('throws when both profile fetch and token refresh fail', async () => {
      setupMultiAccountStorage([ALICE, BOB]);
      mockClientResumeSession.mockResolvedValue(undefined);

      // Profile fetch fails
      mockGetProfile.mockRejectedValue(new Error('Token expired'));
      // Refresh also fails
      mockClientRefreshSession.mockRejectedValue(new Error('Refresh token expired'));

      await expect(switchToAccount('did:plc:bob')).rejects.toThrow(
        'Session expired. Please sign in again.',
      );

      // Should clean up tokens for the expired account
      expect(mockDeleteSessionTokens).toHaveBeenCalledWith('did:plc:bob');
    });

    it('persists refreshed tokens to SecureStore after successful refresh', async () => {
      setupMultiAccountStorage([ALICE, BOB]);
      mockClientResumeSession.mockResolvedValue(undefined);
      mockGetProfile.mockRejectedValue(new Error('Expired'));
      mockClientRefreshSession.mockResolvedValue({
        accessJwt: 'new-access',
        refreshJwt: 'new-refresh',
      });

      await switchToAccount('did:plc:bob');

      // saveSessionTokens should be called with the refreshed tokens
      expect(mockSaveSessionTokens).toHaveBeenCalledWith(
        'did:plc:bob',
        expect.objectContaining({
          accessJwt: 'new-access',
          refreshJwt: 'new-refresh',
        }),
      );
    });
  });

  // ── Account removal ──────────────────────────────────────────────────────

  describe('removeAccount', () => {
    it('removes account from AsyncStorage and deletes tokens', async () => {
      setupMultiAccountStorage([ALICE, BOB]);
      mockGetActiveSessionDid.mockResolvedValue('did:plc:alice');

      await removeAccount('did:plc:bob');

      expect(mockDeleteSessionTokens).toHaveBeenCalledWith('did:plc:bob');
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        ACCOUNTS_STORAGE_KEY,
        expect.any(String),
      );

      // Verify Bob was removed from the accounts list
      const setItemCall = (AsyncStorage.setItem as jest.Mock).mock.calls.find(
        (call: unknown[]) => call[0] === ACCOUNTS_STORAGE_KEY,
      );
      const savedAccounts = JSON.parse(setItemCall![1] as string);
      expect(savedAccounts).toHaveLength(1);
      expect(savedAccounts[0].did).toBe('did:plc:alice');
    });

    it('clears active session when removing the active account', async () => {
      setupMultiAccountStorage([ALICE, BOB]);
      mockGetActiveSessionDid.mockResolvedValue('did:plc:alice');

      await removeAccount('did:plc:alice');

      expect(mockDeleteSessionTokens).toHaveBeenCalledWith('did:plc:alice');
      expect(mockClearActiveSessionDid).toHaveBeenCalled();
    });

    it('does not clear active session when removing a non-active account', async () => {
      setupMultiAccountStorage([ALICE, BOB]);
      mockGetActiveSessionDid.mockResolvedValue('did:plc:alice');

      await removeAccount('did:plc:bob');

      expect(mockDeleteSessionTokens).toHaveBeenCalledWith('did:plc:bob');
      expect(mockClearActiveSessionDid).not.toHaveBeenCalled();
    });

    it('handles removal of last remaining account', async () => {
      setupMultiAccountStorage([ALICE]);
      mockGetActiveSessionDid.mockResolvedValue('did:plc:alice');

      await removeAccount('did:plc:alice');

      expect(mockDeleteSessionTokens).toHaveBeenCalledWith('did:plc:alice');
      expect(mockClearActiveSessionDid).toHaveBeenCalled();

      // Saved accounts list should be empty
      const setItemCall = (AsyncStorage.setItem as jest.Mock).mock.calls.find(
        (call: unknown[]) => call[0] === ACCOUNTS_STORAGE_KEY,
      );
      const savedAccounts = JSON.parse(setItemCall![1] as string);
      expect(savedAccounts).toHaveLength(0);
    });

    it('handles storage failure gracefully (does not throw)', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(
        new Error('AsyncStorage read failed'),
      );

      // Should not throw — removeAccount catches errors internally
      await expect(removeAccount('did:plc:alice')).resolves.not.toThrow();
    });
  });

  // ── Edge cases ───────────────────────────────────────────────────────────

  describe('Edge cases', () => {
    it('handles switching to same account (no-op refresh)', async () => {
      setupMultiAccountStorage([ALICE]);
      mockGetActiveSessionDid.mockResolvedValue('did:plc:alice');
      mockClientResumeSession.mockResolvedValue(undefined);
      mockGetProfile.mockResolvedValue({
        data: { handle: 'alice.bsky.social', displayName: 'Alice', avatar: 'url' },
      });

      const session = await switchToAccount('did:plc:alice');

      expect(session.did).toBe('did:plc:alice');
      // Should still work — switching to same account is valid
    });

    it('handles three-account scenario with middle account removed', async () => {
      setupMultiAccountStorage([ALICE, BOB, CHARLIE]);
      mockGetActiveSessionDid.mockResolvedValue('did:plc:alice');

      await removeAccount('did:plc:bob');

      const setItemCall = (AsyncStorage.setItem as jest.Mock).mock.calls.find(
        (call: unknown[]) => call[0] === ACCOUNTS_STORAGE_KEY,
      );
      const savedAccounts = JSON.parse(setItemCall![1] as string);
      expect(savedAccounts).toHaveLength(2);
      expect(savedAccounts.map((a: { did: string }) => a.did)).toEqual([
        'did:plc:alice',
        'did:plc:charlie',
      ]);
    });

    it('switching to account with network error on profile fetch triggers refresh', async () => {
      setupMultiAccountStorage([ALICE, BOB]);
      mockClientResumeSession.mockResolvedValue(undefined);

      // Network error on profile fetch
      mockGetProfile.mockRejectedValue(new TypeError('Network request failed'));

      // Refresh also fails (network is down)
      mockClientRefreshSession.mockRejectedValue(
        new TypeError('Network request failed'),
      );

      await expect(switchToAccount('did:plc:bob')).rejects.toThrow(
        'Session expired. Please sign in again.',
      );
    });
  });
});
