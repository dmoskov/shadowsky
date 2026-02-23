import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthProvider, useAuth } from '../AuthContext';
import * as authService from '../../services/auth/auth-service';

// Mock dependencies
jest.mock('../../services/auth/auth-service');
jest.mock('../../services/atproto/client', () => ({
  getAtProtoClient: jest.fn(() => ({
    getAgent: jest.fn(() => ({ session: null, getProfile: jest.fn() })),
    isOAuthSession: jest.fn().mockReturnValue(false),
    resumeSession: jest.fn(),
    refreshSession: jest.fn(),
  })),
  resetAtProtoClient: jest.fn(),
}));
jest.mock('../../utils/error-reporting', () => ({
  addBreadcrumb: jest.fn(),
  setUser: jest.fn().mockResolvedValue(undefined),
  clearUser: jest.fn(),
}));

jest.mock('../../services/mutation-queue', () => ({
  mutationQueue: {
    destroy: jest.fn(),
  },
}));

const mockClearQueryCache = jest.fn();
jest.mock('../../shared/query-client', () => ({
  clearQueryCache: (...args: unknown[]) => mockClearQueryCache(...args),
}));

const mockClearPreferencesCache = jest.fn();
jest.mock('../../services/preferences', () => ({
  preferencesService: {
    clearCache: (...args: unknown[]) => mockClearPreferencesCache(...args),
  },
}));

const mockAuthService = authService as jest.Mocked<typeof authService>;

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    AsyncStorage.clear();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
  );

  describe('useAuth hook', () => {
    it('throws error when used outside AuthProvider', () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();

      expect(() => {
        renderHook(() => useAuth());
      }).toThrow('useAuth must be used within an AuthProvider');

      consoleError.mockRestore();
    });

    it('provides auth context when used within AuthProvider', async () => {
      mockAuthService.resumeSession.mockResolvedValue(null);
      mockAuthService.getAccounts.mockResolvedValue([]);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current).toHaveProperty('isAuthenticated');
      expect(result.current).toHaveProperty('signIn');
      expect(result.current).toHaveProperty('signOut');
    });
  });

  describe('Session restoration', () => {
    it('restores session on mount if available', async () => {
      const mockSession = {
        did: 'did:plc:test123',
        handle: 'test.bsky.social',
        email: 'test@example.com',
        accessJwt: 'access-token',
        refreshJwt: 'refresh-token',
        account: {
          did: 'did:plc:test123',
          handle: 'test.bsky.social',
          email: 'test@example.com',
        },
      };

      mockAuthService.resumeSession.mockResolvedValue(mockSession);
      mockAuthService.getAccounts.mockResolvedValue([mockSession.account]);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.session).toEqual(mockSession);
    });

    it('sets isAuthenticated to false when no session is available', async () => {
      mockAuthService.resumeSession.mockResolvedValue(null);
      mockAuthService.getAccounts.mockResolvedValue([]);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.session).toBeNull();
    });

    it('handles session restoration failure gracefully', async () => {
      mockAuthService.resumeSession.mockRejectedValue(new Error('Session expired'));
      mockAuthService.getAccounts.mockResolvedValue([]);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe('Sign out', () => {
    it('clears query cache and preferences cache on sign out', async () => {
      const mockSession = {
        did: 'did:plc:test123',
        handle: 'test.bsky.social',
        email: 'test@example.com',
        accessJwt: 'access-token',
        refreshJwt: 'refresh-token',
        account: {
          did: 'did:plc:test123',
          handle: 'test.bsky.social',
          email: 'test@example.com',
        },
      };

      mockAuthService.resumeSession.mockResolvedValue(mockSession);
      mockAuthService.getAccounts.mockResolvedValue([mockSession.account]);
      (mockAuthService as any).signOut.mockResolvedValue(undefined);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      await act(async () => {
        await result.current.signOut();
      });

      expect(mockClearQueryCache).toHaveBeenCalled();
      expect(mockClearPreferencesCache).toHaveBeenCalled();
    });
  });

  describe('Switch account', () => {
    it('clears query cache and preferences cache on account switch', async () => {
      const account1 = {
        did: 'did:plc:user1',
        handle: 'user1.bsky.social',
        email: 'user1@example.com',
      };
      const account2 = {
        did: 'did:plc:user2',
        handle: 'user2.bsky.social',
        email: 'user2@example.com',
      };
      const session1 = {
        ...account1,
        accessJwt: 'access-1',
        refreshJwt: 'refresh-1',
        account: account1,
      };
      const session2 = {
        ...account2,
        accessJwt: 'access-2',
        refreshJwt: 'refresh-2',
        account: account2,
      };

      mockAuthService.resumeSession.mockResolvedValue(session1);
      mockAuthService.getAccounts.mockResolvedValue([account1, account2]);
      mockAuthService.switchToAccount.mockResolvedValue(session2);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.switchAccount('did:plc:user2');
      });

      expect(mockClearQueryCache).toHaveBeenCalled();
      expect(mockClearPreferencesCache).toHaveBeenCalled();
    });
  });

  describe('Sign in with password', () => {
    it('successfully signs in with valid credentials', async () => {
      const mockSession = {
        did: 'did:plc:test123',
        handle: 'test.bsky.social',
        email: 'test@example.com',
        accessJwt: 'access-token',
        refreshJwt: 'refresh-token',
        account: {
          did: 'did:plc:test123',
          handle: 'test.bsky.social',
          email: 'test@example.com',
        },
      };

      mockAuthService.resumeSession.mockResolvedValue(null);
      mockAuthService.getAccounts.mockResolvedValue([]);
      mockAuthService.signInWithPassword.mockResolvedValue(mockSession);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.signIn('test.bsky.social', 'password123');
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.session).toEqual(mockSession);
      expect(mockAuthService.signInWithPassword).toHaveBeenCalledWith(
        'test.bsky.social',
        'password123',
        undefined
      );
    });

    it('throws error on invalid credentials', async () => {
      mockAuthService.resumeSession.mockResolvedValue(null);
      mockAuthService.getAccounts.mockResolvedValue([]);
      mockAuthService.signInWithPassword.mockRejectedValue(
        new Error('Invalid credentials')
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(
        act(async () => {
          await result.current.signIn('test.bsky.social', 'wrong-password');
        })
      ).rejects.toThrow('Invalid credentials');

      expect(result.current.isAuthenticated).toBe(false);
    });
  });
});
