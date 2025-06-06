/**
 * Auth-specific error handler that doesn't depend on AuthContext
 * This avoids circular dependencies
 */

import { useCallback } from 'react'
import { 
  ATProtoError, 
  RateLimitError, 
  AuthenticationError, 
  SessionExpiredError,
  isRateLimitError,
  isAuthenticationError,
  isSessionExpiredError
} from '../lib/errors'

interface AuthErrorHandlerOptions {
  onRateLimit?: (resetAt: Date) => void
  onAuthError?: () => void
  onSessionExpired?: () => void
  fallback?: (error: Error) => void
  logout?: () => void
}

export const useAuthErrorHandler = (options: AuthErrorHandlerOptions = {}) => {
  const handleError = useCallback((error: Error | unknown) => {
    console.error('Auth Error caught by handler:', error)

    // Handle rate limit errors
    if (isRateLimitError(error)) {
      if (options.onRateLimit) {
        options.onRateLimit(error.resetAt)
      } else {
        const minutesUntilReset = Math.ceil(
          (error.resetAt.getTime() - Date.now()) / 60000
        )
        console.warn(`Rate limited. Retry in ${minutesUntilReset} minute(s).`)
      }
      return
    }

    // Handle authentication errors
    if (isAuthenticationError(error)) {
      if (options.onAuthError) {
        options.onAuthError()
      } else if (options.logout) {
        options.logout()
        console.warn('Authentication failed. Session cleared.')
      }
      return
    }

    // Handle session expiration
    if (isSessionExpiredError(error)) {
      if (options.onSessionExpired) {
        options.onSessionExpired()
      } else if (options.logout) {
        options.logout()
        console.warn('Session expired. Session cleared.')
      }
      return
    }

    // Handle AT Protocol errors
    if (error instanceof ATProtoError) {
      console.error(`AT Protocol Error: ${error.message}`)
      return
    }

    // Fallback for unknown errors
    if (options.fallback) {
      options.fallback(error as Error)
    } else {
      console.error('Unexpected error in auth flow:', error)
    }
  }, [options])

  return { handleError }
}