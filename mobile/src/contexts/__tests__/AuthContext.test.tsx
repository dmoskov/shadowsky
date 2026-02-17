import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthProvider, useAuth } from '../AuthContext';
import * as authService from '../../services/auth/auth-service';

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
