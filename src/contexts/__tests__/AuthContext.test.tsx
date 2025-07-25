/**
 * Tests for AuthContext
 * This is a critical path that handles authentication state
 */

import { renderHook, act, waitFor } from '@testing-library/react'
import { AuthProvider, useAuth } from '../AuthContext'
import { atProtoClient, ATProtoClient } from '@bsky/shared'
import type { Session } from '@bsky/shared'
import { SessionExpiredError, AuthenticationError, NetworkError } from '@bsky/shared'

// Mock the atproto client module
jest.mock('../../services/atproto', () => ({
  atProtoClient: {
    login: jest.fn(),
    logout: jest.fn(),
    resumeSession: jest.fn(),
    refreshSession: jest.fn(),
  },
  ATProtoClient: {
    loadSavedSession: jest.fn(),
  },
}))

// Mock query client
jest.mock('../../lib/query-client', () => ({
  queryClient: {
    clear: jest.fn(),
  },
}))

// Store original location
const originalLocation = window.location;

// Delete and recreate location
delete (window as any).location;
(window as any).location = {
  href: '/',
  reload: jest.fn(),
  assign: jest.fn(),
  replace: jest.fn(),
};

describe('AuthContext', () => {
  const mockSession: Session = {
    did: 'did:plc:test123',
    handle: 'testuser.bsky.social',
    email: 'test@example.com',
    accessJwt: 'mock-access-token',
    refreshJwt: 'mock-refresh-token',
  }

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks()
    
    // Clear localStorage
    localStorage.clear()
    
    // Reset window.location
    window.location.href = '/'
    
    // Set default mock behaviors
    ;(atProtoClient.login as jest.Mock).mockResolvedValue(mockSession)
    ;(atProtoClient.resumeSession as jest.Mock).mockResolvedValue(mockSession)
    ;(atProtoClient.refreshSession as jest.Mock).mockResolvedValue(mockSession)
    ;(ATProtoClient.loadSavedSession as jest.Mock).mockReturnValue(null)
  })

  describe('initial state', () => {
    it('should complete initial load when no saved session exists', async () => {
      // Don't mock any saved session
      ;(ATProtoClient.loadSavedSession as jest.Mock).mockReturnValue(null)
      
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      })

      // Wait for loading to complete
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
      
      // Should not be authenticated
      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.session).toBeNull()
    })

    it('should attempt to resume session from saved data', async () => {
      // Set up stored session
      const storedSession = {
        did: 'did:plc:stored',
        handle: 'stored.bsky.social',
        accessJwt: 'stored-token',
        refreshJwt: 'stored-refresh',
      }
      ;(ATProtoClient.loadSavedSession as jest.Mock).mockReturnValue(storedSession)

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      })

      // Wait for session resume
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(atProtoClient.resumeSession).toHaveBeenCalledWith(storedSession)
      expect(result.current.isAuthenticated).toBe(true)
      expect(result.current.session).toEqual(mockSession)
    })

    it('should handle missing session gracefully', async () => {
      // No saved session
      ;(ATProtoClient.loadSavedSession as jest.Mock).mockReturnValue(null)

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      })

      // Wait for loading to complete
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Should not be authenticated
      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.session).toBeNull()
    })

    it('should clear session on authentication error during resume', async () => {
      const authError = new AuthenticationError('Invalid session')
      ;(ATProtoClient.loadSavedSession as jest.Mock).mockReturnValue(mockSession)
      ;(atProtoClient.resumeSession as jest.Mock).mockRejectedValue(authError)

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      })

      // Wait for loading to complete
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Should have cleared the session
      expect(atProtoClient.logout).toHaveBeenCalled()
      expect(result.current.isAuthenticated).toBe(false)
    })

    it('should retry on network error during resume', async () => {
      const networkError = new NetworkError('Network unavailable')
      ;(ATProtoClient.loadSavedSession as jest.Mock).mockReturnValue(mockSession)
      ;(atProtoClient.resumeSession as jest.Mock)
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce(mockSession)

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      })

      // Wait for retry and success
      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true)
      }, { timeout: 5000 })

      // Should have retried
      expect(atProtoClient.resumeSession).toHaveBeenCalledTimes(2)
    })
  })

  describe('login', () => {
    it('should login successfully with valid credentials', async () => {
      ;(atProtoClient.login as jest.Mock).mockResolvedValue(mockSession)

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      })

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Perform login
      let loginResult: boolean = false
      await act(async () => {
        loginResult = await result.current.login('testuser', 'password123')
      })

      expect(loginResult).toBe(true)
      expect(atProtoClient.login).toHaveBeenCalledWith('testuser', 'password123')
      expect(result.current.isAuthenticated).toBe(true)
      expect(result.current.session).toEqual(mockSession)
    })

    it('should handle login errors', async () => {
      const loginError = new Error('Invalid credentials')
      ;(atProtoClient.login as jest.Mock).mockRejectedValue(loginError)

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      })

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Attempt login
      await expect(
        act(async () => {
          await result.current.login('baduser', 'badpass')
        })
      ).rejects.toThrow('Invalid credentials')

      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.session).toBeNull()
    })
  })

  describe('logout', () => {
    it('should clear session and redirect on logout', async () => {
      // Set up authenticated state
      ;(ATProtoClient.loadSavedSession as jest.Mock).mockReturnValue(mockSession)

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      })

      // Wait for session resume
      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true)
      })

      // Perform logout
      act(() => {
        result.current.logout()
      })

      expect(atProtoClient.logout).toHaveBeenCalled()
      // Location change happens in jsdom
      expect(window.location.href).toMatch(/^(http:\/\/localhost)?\/$/)
    })
  })

  describe('session refresh', () => {
    it('should refresh session when requested', async () => {
      // Mock a new refreshed session
      const refreshedSession = {
        ...mockSession,
        accessJwt: 'new-access-token',
      }
      
      ;(atProtoClient.refreshSession as jest.Mock).mockResolvedValue(refreshedSession)

      // Start with authenticated state
      ;(ATProtoClient.loadSavedSession as jest.Mock).mockReturnValue(mockSession)

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      })

      // Wait for initial session
      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true)
      })

      // Refresh session
      let refreshResult: boolean = false
      await act(async () => {
        refreshResult = await result.current.refreshSession()
      })

      expect(refreshResult).toBe(true)
      expect(result.current.session?.accessJwt).toBe('new-access-token')
    })

    it('should handle refresh errors and logout on auth error', async () => {
      const authError = new SessionExpiredError('Session expired')
      ;(atProtoClient.refreshSession as jest.Mock).mockRejectedValue(authError)
      
      // Start with authenticated state
      ;(ATProtoClient.loadSavedSession as jest.Mock).mockReturnValue(mockSession)

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      })

      // Wait for initial session
      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true)
      })

      // Try to refresh
      let refreshResult: boolean = true
      await act(async () => {
        refreshResult = await result.current.refreshSession()
      })

      expect(refreshResult).toBe(false)
      expect(atProtoClient.logout).toHaveBeenCalled()
      // Location change happens in jsdom
      expect(window.location.href).toMatch(/^(http:\/\/localhost)?\/$/)
    })
  })

  describe('client access', () => {
    it('should provide access to ATProtoClient', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.client).toBe(atProtoClient)
    })
  })
})