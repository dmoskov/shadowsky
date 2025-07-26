/**
 * Custom hook for handling errors in a consistent way
 * 
 * Features:
 * - Handles AT Protocol errors (rate limits, auth errors, etc.)
 * - Supports both alert and console-based error reporting
 * - Provides callbacks for specific error types
 * - Can be used in both UI components (with alerts) and auth flows (silent mode)
 */

import { useCallback } from 'react'
import { 
  ATProtoError,
  isRateLimitError,
  isAuthenticationError,
  isSessionExpiredError
} from '@bsky/shared'
import { trackError } from '@bsky/shared'
import type { ErrorCategory } from '@bsky/shared'
import { useToast } from './useToast'

interface ErrorHandlerOptions {
  onRateLimit?: (resetAt: Date) => void
  onAuthError?: () => void
  onSessionExpired?: () => void
  fallback?: (error: Error) => void
  logout?: () => void  // Accept logout as a parameter
  silent?: boolean  // If true, use console instead of alerts
}

export const useErrorHandler = (options: ErrorHandlerOptions = {}) => {
  const showToast = useToast()

  const handleError = useCallback((error: Error | unknown, action?: string) => {
    // Determine error category for tracking
    let category: ErrorCategory = 'unknown';
    if (isRateLimitError(error) || error instanceof ATProtoError) {
      category = 'network';
    } else if (isAuthenticationError(error) || isSessionExpiredError(error)) {
      category = 'auth';
    }

    // Track the error with our new system
    trackError(error, { 
      category, 
      action,
      metadata: error instanceof ATProtoError ? { code: error.code } : undefined
    });

    // Handle rate limit errors
    if (isRateLimitError(error)) {
      if (options.onRateLimit) {
        options.onRateLimit(error.resetAt)
      } else {
        const secondsUntilReset = Math.ceil(
          (error.resetAt.getTime() - Date.now()) / 1000
        )
        const message = secondsUntilReset > 60 
          ? `Rate limited. Please try again in ${Math.ceil(secondsUntilReset / 60)} minute(s).`
          : `Rate limited. Please try again in ${secondsUntilReset} seconds.`
        
        if (options.silent) {
          console.warn(message)
        } else {
          // Use toast for rate limit errors
          showToast({
            message,
            type: 'warning',
            duration: Math.min(secondsUntilReset * 1000, 10000) // Show for wait time or max 10s
          })
        }
      }
      return
    }

    // Handle authentication errors
    if (isAuthenticationError(error)) {
      if (options.onAuthError) {
        options.onAuthError()
      } else if (options.logout) {
        options.logout()
        if (!options.silent) alert('Authentication failed. Please log in again.')
        else console.warn('Authentication failed. Session cleared.')
      } else {
        const message = 'Authentication failed. Please refresh and log in again.'
        if (options.silent) console.warn(message)
        else alert(message)
      }
      return
    }

    // Handle session expiration
    if (isSessionExpiredError(error)) {
      if (options.onSessionExpired) {
        options.onSessionExpired()
      } else if (options.logout) {
        options.logout()
        if (!options.silent) alert('Your session has expired. Please log in again.')
        else console.warn('Session expired. Session cleared.')
      } else {
        const message = 'Your session has expired. Please refresh and log in again.'
        if (options.silent) console.warn(message)
        else alert(message)
      }
      return
    }

    // Handle AT Protocol errors
    if (error instanceof ATProtoError) {
      if (options.silent) {
        console.error(`AT Protocol Error: ${error.message}`)
      } else {
        alert(`Error: ${error.message}`)
      }
      return
    }

    // Fallback for unknown errors
    if (options.fallback) {
      options.fallback(error as Error)
    } else {
      if (options.silent) {
        console.error('Unexpected error:', error)
      } else {
        alert('An unexpected error occurred. Please try again.')
      }
    }
  }, [options, showToast])

  return { handleError }
}

// Convenience hook for async operations with error handling
export const useAsyncError = () => {
  const { handleError } = useErrorHandler()

  const throwError = useCallback((error: Error | unknown) => {
    handleError(error)
    throw error
  }, [handleError])

  return throwError
}