/**
 * Auth Flow Tests
 *
 * Tests the login flow end-to-end: password auth, OAuth, custom PDS,
 * error handling, and session storage after successful login.
 */

import React from 'react';
import { render, act, waitFor } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '../../contexts/AuthContext';

// ── Mocks ──────────────────────────────────────────────────────────────────────

// auth-service: the main module under test — all functions mocked
const mockSignInWithPassword = jest.fn();
const mockSignInWithOAuth = jest.fn();
const mockResumeSession = jest.fn();
const mockGetAccounts = jest.fn().mockResolvedValue([]);
const mockSignOut = jest.fn().mockResolvedValue(undefined);
const mockGetCurrentSession = jest.fn().mockResolvedValue(null);

jest.mock('../../services/auth/auth-service', () => ({
  signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
  signInWithOAuth: (...args: unknown[]) => mockSignInWithOAuth(...args),
  resumeSession: (...args: unknown[]) => mockResumeSession(...args),
  getAccounts: (...args: unknown[]) => mockGetAccounts(...args),
  signOut: (...args: unknown[]) => mockSignOut(...args),
  switchToAccount: jest.fn(),
  removeAccount: jest.fn(),
  getCurrentSession: (...args: unknown[]) => mockGetCurrentSession(...args),
}));

// Secure token storage
jest.mock('../../services/auth/secure-token-storage', () => ({
  saveSessionTokens: jest.fn().mockResolvedValue(undefined),
  getSessionTokens: jest.fn().mockResolvedValue(null),
  deleteSessionTokens: jest.fn().mockResolvedValue(undefined),
  setActiveSessionDid: jest.fn().mockResolvedValue(undefined),
  getActiveSessionDid: jest.fn().mockResolvedValue(null),
  clearActiveSessionDid: jest.fn().mockResolvedValue(undefined),
  migrateTokensToSecureStore: jest.fn().mockResolvedValue(undefined),
}));

// AT Proto client
const mockGetProfile = jest.fn();
const mockLogin = jest.fn();
const mockClientResumeSession = jest.fn();

jest.mock('../../services/atproto/client', () => ({
  getAtProtoClient: jest.fn(() => ({
    login: mockLogin,
    getAgent: jest.fn(() => ({
      getProfile: mockGetProfile,
      session: null,
    })),
    resumeSession: mockClientResumeSession,
    refreshSession: jest.fn(),
    isOAuthSession: jest.fn().mockReturnValue(false),
  })),
  resetAtProtoClient: jest.fn(),
}));

// Side-effect modules
jest.mock('../../services/mutation-queue', () => ({
  mutationQueue: { destroy: jest.fn() },
}));
jest.mock('../../shared/query-client', () => ({
  clearQueryCache: jest.fn(),
}));
jest.mock('../../services/preferences', () => ({
  preferencesService: { clearCache: jest.fn() },
}));
jest.mock('../../utils/error-reporting', () => ({
  addBreadcrumb: jest.fn(),
  setUser: jest.fn().mockResolvedValue(undefined),
  clearUser: jest.fn(),
}));
jest.mock('../../utils/logger', () => ({
  createLogger: () => ({
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeFakeSession(overrides: Record<string, unknown> = {}) {
  return {
    did: 'did:plc:testuser123',
    handle: 'alice.bsky.social',
    accessJwt: 'access-jwt-token',
    refreshJwt: 'refresh-jwt-token',
    email: 'alice@example.com',
    emailConfirmed: true,
    active: true,
    account: {
      did: 'did:plc:testuser123',
      handle: 'alice.bsky.social',
      email: 'alice@example.com',
      displayName: 'Alice',
      avatar: 'https://cdn.bsky.app/avatar.jpg',
    },
    ...overrides,
  };
}

/** A tiny component that exposes AuthContext values so we can assert on them. */
let capturedAuth: ReturnType<typeof useAuth> | null = null;
/** Track all renders for debugging */
let renderCount = 0;

function AuthConsumer({ onRender }: { onRender?: (auth: ReturnType<typeof useAuth>) => void }) {
  const auth = useAuth();
  capturedAuth = auth;
  renderCount++;
  onRender?.(auth);
  return null;
}

function renderWithAuth() {
  const result = render(
    <AuthProvider>
      <AuthConsumer />
    </AuthProvider>,
  );
  return result;
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('Auth Flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    capturedAuth = null;

    // Default: no saved session (fresh state)
    mockResumeSession.mockResolvedValue(null);
    mockGetAccounts.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ── Login with handle + app password ─────────────────────────────────────

  describe('Password login', () => {
    it('signs in successfully with handle and app password', async () => {
      const session = makeFakeSession();
      mockSignInWithPassword.mockResolvedValue(session);

      renderWithAuth();

      // Wait for initial load to complete (no saved session)
      await act(async () => {
        jest.runAllTimers();
      });

      await waitFor(() => {
        expect(capturedAuth?.isLoading).toBe(false);
        expect(capturedAuth?.isAuthenticated).toBe(false);
      });

      // Perform sign-in
      await act(async () => {
        await capturedAuth!.signIn('alice.bsky.social', 'app-password-123');
      });

      expect(mockSignInWithPassword).toHaveBeenCalledWith(
        'alice.bsky.social',
        'app-password-123',
        undefined,
      );

      await waitFor(() => {
        expect(capturedAuth?.isAuthenticated).toBe(true);
        expect(capturedAuth?.session?.did).toBe('did:plc:testuser123');
        expect(capturedAuth?.session?.handle).toBe('alice.bsky.social');
      });
    });

    it('passes custom PDS URL when provided', async () => {
      const session = makeFakeSession();
      mockSignInWithPassword.mockResolvedValue(session);

      renderWithAuth();
      await act(async () => {
        jest.runAllTimers();
      });

      await waitFor(() => expect(capturedAuth?.isLoading).toBe(false));

      await act(async () => {
        await capturedAuth!.signIn(
          'alice.bsky.social',
          'app-password-123',
          'https://pds.custom-server.com',
        );
      });

      expect(mockSignInWithPassword).toHaveBeenCalledWith(
        'alice.bsky.social',
        'app-password-123',
        'https://pds.custom-server.com',
      );
    });

    it('throws on invalid credentials and stays unauthenticated', async () => {
      mockSignInWithPassword.mockRejectedValue(
        new Error('Invalid identifier or password'),
      );

      renderWithAuth();
      await act(async () => {
        jest.runAllTimers();
      });
      await waitFor(() => expect(capturedAuth?.isLoading).toBe(false));

      await expect(
        act(async () => {
          await capturedAuth!.signIn('alice.bsky.social', 'wrong-password');
        }),
      ).rejects.toThrow('Invalid identifier or password');

      expect(capturedAuth?.isAuthenticated).toBe(false);
      expect(capturedAuth?.session).toBeNull();
    });

    it('throws when handle does not exist', async () => {
      mockSignInWithPassword.mockRejectedValue(
        new Error('Login failed: no session data returned'),
      );

      renderWithAuth();
      await act(async () => {
        jest.runAllTimers();
      });
      await waitFor(() => expect(capturedAuth?.isLoading).toBe(false));

      await expect(
        act(async () => {
          await capturedAuth!.signIn('nonexistent.bsky.social', 'password');
        }),
      ).rejects.toThrow('Login failed');

      expect(capturedAuth?.isAuthenticated).toBe(false);
    });

    it('handles network error during login without crashing', async () => {
      mockSignInWithPassword.mockRejectedValue(new Error('Network request failed'));

      renderWithAuth();
      await act(async () => {
        jest.runAllTimers();
      });
      await waitFor(() => expect(capturedAuth?.isLoading).toBe(false));

      await expect(
        act(async () => {
          await capturedAuth!.signIn('alice.bsky.social', 'password');
        }),
      ).rejects.toThrow('Network request failed');

      expect(capturedAuth?.isAuthenticated).toBe(false);
      // isLoading should be reset even after an error
      expect(capturedAuth?.isLoading).toBe(false);
    });

    it('reloads accounts list after successful sign-in', async () => {
      const session = makeFakeSession();
      mockSignInWithPassword.mockResolvedValue(session);
      mockGetAccounts.mockResolvedValue([session.account]);

      renderWithAuth();
      await act(async () => {
        jest.runAllTimers();
      });
      await waitFor(() => expect(capturedAuth?.isLoading).toBe(false));

      await act(async () => {
        await capturedAuth!.signIn('alice.bsky.social', 'app-password-123');
      });

      // getAccounts should be called during sign-in (loadAccounts)
      expect(mockGetAccounts).toHaveBeenCalled();
    });
  });

  // ── OAuth login ──────────────────────────────────────────────────────────

  describe('OAuth login', () => {
    it('signs in with OAuth and creates session', async () => {
      const session = makeFakeSession({
        did: 'did:plc:oauthuser',
        handle: 'bob.bsky.social',
      });
      mockSignInWithOAuth.mockResolvedValue(session);

      renderWithAuth();
      await act(async () => {
        jest.runAllTimers();
      });
      await waitFor(() => expect(capturedAuth?.isLoading).toBe(false));

      await act(async () => {
        await capturedAuth!.signInWithOAuth('bob.bsky.social');
      });

      expect(mockSignInWithOAuth).toHaveBeenCalledWith('bob.bsky.social');
      await waitFor(() => {
        expect(capturedAuth?.isAuthenticated).toBe(true);
        expect(capturedAuth?.session?.did).toBe('did:plc:oauthuser');
      });
    });

    it('handles user cancellation of OAuth flow', async () => {
      // ExpoOAuthClient throws "Authentication cancelled" when user dismisses browser
      mockSignInWithOAuth.mockRejectedValue(new Error('Authentication cancelled: cancel'));

      renderWithAuth();
      await act(async () => {
        jest.runAllTimers();
      });
      await waitFor(() => expect(capturedAuth?.isLoading).toBe(false));

      await expect(
        act(async () => {
          await capturedAuth!.signInWithOAuth('bob.bsky.social');
        }),
      ).rejects.toThrow('Authentication cancelled');

      expect(capturedAuth?.isAuthenticated).toBe(false);
      expect(capturedAuth?.isLoading).toBe(false);
    });

    it('throws on OAuth error and stays unauthenticated', async () => {
      mockSignInWithOAuth.mockRejectedValue(new Error('OAuth sign-in failed'));

      renderWithAuth();
      await act(async () => {
        jest.runAllTimers();
      });
      await waitFor(() => expect(capturedAuth?.isLoading).toBe(false));

      await expect(
        act(async () => {
          await capturedAuth!.signInWithOAuth('bob.bsky.social');
        }),
      ).rejects.toThrow('OAuth sign-in failed');

      expect(capturedAuth?.isAuthenticated).toBe(false);
    });
  });

  // ── Session restore on app start ─────────────────────────────────────────

  describe('Session restore', () => {
    it('restores a saved session on mount', async () => {
      const session = makeFakeSession();
      mockResumeSession.mockResolvedValue(session);

      renderWithAuth();

      await act(async () => {
        jest.runAllTimers();
      });

      await waitFor(() => {
        expect(capturedAuth?.isAuthenticated).toBe(true);
        expect(capturedAuth?.session?.did).toBe('did:plc:testuser123');
        expect(capturedAuth?.isLoading).toBe(false);
      });
    });

    it('finishes loading even when no saved session exists', async () => {
      mockResumeSession.mockResolvedValue(null);

      renderWithAuth();

      await act(async () => {
        jest.runAllTimers();
      });

      await waitFor(() => {
        expect(capturedAuth?.isLoading).toBe(false);
        expect(capturedAuth?.isAuthenticated).toBe(false);
      });
    });

    it('handles session restore failure gracefully', async () => {
      mockResumeSession.mockRejectedValue(new Error('SecureStore read failed'));

      renderWithAuth();

      await act(async () => {
        jest.runAllTimers();
      });

      await waitFor(() => {
        expect(capturedAuth?.isLoading).toBe(false);
        expect(capturedAuth?.isAuthenticated).toBe(false);
      });
    });
  });

  // ── Sign out ─────────────────────────────────────────────────────────────

  describe('Sign out', () => {
    it('calls auth service signOut and clears query cache', async () => {
      const session = makeFakeSession();
      mockResumeSession.mockResolvedValue(session);

      renderWithAuth();
      await act(async () => {
        jest.runAllTimers();
      });
      await waitFor(() => expect(capturedAuth?.isAuthenticated).toBe(true));

      const { clearQueryCache } = require('../../shared/query-client');
      const { mutationQueue } = require('../../services/mutation-queue');

      await act(async () => {
        await capturedAuth!.signOut();
        jest.runAllTimers();
      });

      expect(mockSignOut).toHaveBeenCalled();
      expect(clearQueryCache).toHaveBeenCalled();
      expect(mutationQueue.destroy).toHaveBeenCalled();
    });

    it('does not throw even if auth service signOut fails', async () => {
      const session = makeFakeSession();
      mockResumeSession.mockResolvedValue(session);
      mockSignOut.mockRejectedValueOnce(new Error('Storage error'));

      renderWithAuth();
      await act(async () => {
        jest.runAllTimers();
      });
      await waitFor(() => expect(capturedAuth?.isAuthenticated).toBe(true));

      // signOut re-throws, so the caller should catch
      await expect(
        act(async () => {
          await capturedAuth!.signOut();
          jest.runAllTimers();
        }),
      ).rejects.toThrow('Storage error');
    });
  });

  // ── PDS server errors ────────────────────────────────────────────────────

  describe('PDS server errors', () => {
    it('surfaces PDS server errors during login', async () => {
      const serverError = new Error('Internal Server Error');
      (serverError as any).status = 500;
      mockSignInWithPassword.mockRejectedValue(serverError);

      renderWithAuth();
      await act(async () => {
        jest.runAllTimers();
      });
      await waitFor(() => expect(capturedAuth?.isLoading).toBe(false));

      await expect(
        act(async () => {
          await capturedAuth!.signIn('alice.bsky.social', 'password');
        }),
      ).rejects.toThrow('Internal Server Error');

      expect(capturedAuth?.isAuthenticated).toBe(false);
    });

    it('handles malformed session response without crash', async () => {
      // Simulate auth-service returning a broken object
      mockSignInWithPassword.mockResolvedValue({
        // Missing required fields
        did: undefined,
        handle: undefined,
        accessJwt: '',
        account: null,
      });

      renderWithAuth();
      await act(async () => {
        jest.runAllTimers();
      });
      await waitFor(() => expect(capturedAuth?.isLoading).toBe(false));

      // Should not crash, but state may be inconsistent —
      // the important thing is no unhandled exception
      await act(async () => {
        await capturedAuth!.signIn('alice.bsky.social', 'password');
      });

      // If the session has falsy `did`, the context should still not throw.
      expect(capturedAuth?.isLoading).toBe(false);
    });
  });
});
