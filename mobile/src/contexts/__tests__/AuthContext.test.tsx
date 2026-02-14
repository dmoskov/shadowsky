import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthProvider, useAuth } from '../AuthContext';
import * as authService from '../../services/auth/auth-service';
import * as OAuthService from '../../services/auth/oauth';
import { getAtProtoClient } from '../../services/atproto/client';

// Mock dependencies
jest.mock('../../services/auth/auth-service');
jest.mock('../../services/auth/oauth');
jest.mock('../../services/atproto/client');
jest.mock('../../utils/error-reporting', () => ({
  addBreadcrumb: jest.fn(),
  setUser: jest.fn(),
  clearUser: jest.fn(),
}));

const mockAuthService = authService as jest.Mocked<typeof authService>;
const mockOAuthService = OAuthService as jest.Mocked<typeof OAuthService>;
const mockGetAtProtoClient = getAtProtoClient as jest.MockedFunction<typeof getAtProtoClient>;

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
      // Suppress console.error for this test
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
        'password123'
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

    it('sets loading state during sign in', async () => {
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

      const signInPromise = act(async () => {
        await result.current.signIn('test.bsky.social', 'password123');
      });

      // Should be loading during sign in
      expect(result.current.isLoading).toBe(true);

      await signInPromise;

      // Should not be loading after sign in
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('Sign in with OAuth', () => {
    it('successfully initiates OAuth flow', async () => {
      mockAuthService.resumeSession.mockResolvedValue(null);
      mockAuthService.getAccounts.mockResolvedValue([]);
      mockOAuthService.startOAuthFlow.mockResolvedValue();

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.signInWithOAuth();
      });

      expect(mockOAuthService.startOAuthFlow).toHaveBeenCalled();
    });

    it('handles OAuth flow errors', async () => {
      mockAuthService.resumeSession.mockResolvedValue(null);
      mockAuthService.getAccounts.mockResolvedValue([]);
      mockOAuthService.startOAuthFlow.mockRejectedValue(
        new Error('OAuth flow cancelled')
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(
        act(async () => {
          await result.current.signInWithOAuth();
        })
      ).rejects.toThrow('OAuth flow cancelled');
    });
  });

  describe('Sign out', () => {
    it('successfully signs out', async () => {
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
      mockAuthService.signOut.mockResolvedValue();

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      await act(async () => {
        await result.current.signOut();
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.session).toBeNull();
      expect(mockAuthService.signOut).toHaveBeenCalled();
    });

    it('handles sign out errors', async () => {
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
      mockAuthService.signOut.mockRejectedValue(new Error('Sign out failed'));

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      await expect(
        act(async () => {
          await result.current.signOut();
        })
      ).rejects.toThrow('Sign out failed');
    });
  });

  describe('Account switching', () => {
    it('successfully switches to another account', async () => {
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

      const mockAccount2 = {
        did: 'did:plc:test456',
        handle: 'test2.bsky.social',
        email: 'test2@example.com',
      };

      const mockNewSession = {
        did: 'did:plc:test456',
        handle: 'test2.bsky.social',
        email: 'test2@example.com',
        accessJwt: 'access-token-2',
        refreshJwt: 'refresh-token-2',
        account: mockAccount2,
      };

      mockAuthService.resumeSession.mockResolvedValue(mockSession);
      mockAuthService.getAccounts.mockResolvedValue([
        mockSession.account,
        mockAccount2,
      ]);
      mockAuthService.switchToAccount.mockResolvedValue(mockNewSession);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      await act(async () => {
        await result.current.switchAccount('did:plc:test456');
      });

      expect(result.current.session?.did).toBe('did:plc:test456');
      expect(mockAuthService.switchToAccount).toHaveBeenCalledWith('did:plc:test456');
    });

    it('throws error when switching to non-existent account', async () => {
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
        expect(result.current.isAuthenticated).toBe(true);
      });

      await expect(
        act(async () => {
          await result.current.switchAccount('did:plc:nonexistent');
        })
      ).rejects.toThrow('Account not found');
    });
  });

  describe('Account removal', () => {
    it('successfully removes an account', async () => {
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

      const mockAccount2 = {
        did: 'did:plc:test456',
        handle: 'test2.bsky.social',
        email: 'test2@example.com',
      };

      mockAuthService.resumeSession.mockResolvedValue(mockSession);
      mockAuthService.getAccounts
        .mockResolvedValueOnce([mockSession.account, mockAccount2])
        .mockResolvedValueOnce([mockSession.account]);
      mockAuthService.removeAccount.mockResolvedValue();
      mockAuthService.getCurrentSession.mockResolvedValue(mockSession);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.accounts).toHaveLength(2);
      });

      await act(async () => {
        await result.current.removeAccount('did:plc:test456');
      });

      expect(result.current.accounts).toHaveLength(1);
      expect(mockAuthService.removeAccount).toHaveBeenCalledWith('did:plc:test456');
    });

    it('signs out when removing current account', async () => {
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
      mockAuthService.getAccounts
        .mockResolvedValueOnce([mockSession.account])
        .mockResolvedValueOnce([]);
      mockAuthService.removeAccount.mockResolvedValue();
      mockAuthService.getCurrentSession.mockResolvedValue(null);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      await act(async () => {
        await result.current.removeAccount('did:plc:test123');
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.session).toBeNull();
    });
  });

  describe('Session refresh', () => {
    it('refreshes session with new tokens', async () => {
      const mockSession = {
        did: 'did:plc:test123',
        handle: 'test.bsky.social',
        email: 'test@example.com',
        accessJwt: 'old-access-token',
        refreshJwt: 'old-refresh-token',
        account: {
          did: 'did:plc:test123',
          handle: 'test.bsky.social',
          email: 'test@example.com',
        },
      };

      const mockAgent = {
        session: {
          accessJwt: 'new-access-token',
          refreshJwt: 'new-refresh-token',
        },
      };

      mockAuthService.resumeSession.mockResolvedValue(mockSession);
      mockAuthService.getAccounts.mockResolvedValue([mockSession.account]);
      mockGetAtProtoClient.mockReturnValue({
        getAgent: () => mockAgent,
      } as any);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      await act(async () => {
        await result.current.refreshSession();
      });

      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });
  });
});
