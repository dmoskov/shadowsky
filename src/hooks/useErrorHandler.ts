/**
 * Custom hook for handling errors in a consistent way
 */

import { useCallback } from 'react'
import { 
  ATProtoError,
  isRateLimitError,
  isAuthenticationError,
  isSessionExpiredError
} from '../lib/errors'

interface ErrorHandlerOptions {
  onRateLimit?: (resetAt: Date) => void
  onAuthError?: () => void
  onSessionExpired?: () => void
  fallback?: (error: Error) => void
  logout?: () => void  // Accept logout as a parameter
}

export const useErrorHandler = (options: ErrorHandlerOptions = {}) => {

  const handleError = useCallback((error: Error | unknown) => {
    console.error('Error caught by handler:', error)

    // Handle rate limit errors
    if (isRateLimitError(error)) {
      if (options.onRateLimit) {
        options.onRateLimit(error.resetAt)
      } else {
        const minutesUntilReset = Math.ceil(
          (error.resetAt.getTime() - Date.now()) / 60000
        )
        alert(`Rate limited. Please try again in ${minutesUntilReset} minute(s).`)
      }
      return
    }

    // Handle authentication errors
    if (isAuthenticationError(error)) {
      if (options.onAuthError) {
        options.onAuthError()
      } else if (options.logout) {
        options.logout()
        alert('Authentication failed. Please log in again.')
      } else {
        alert('Authentication failed. Please refresh and log in again.')
      }
      return
    }

    // Handle session expiration
    if (isSessionExpiredError(error)) {
      if (options.onSessionExpired) {
        options.onSessionExpired()
      } else if (options.logout) {
        options.logout()
        alert('Your session has expired. Please log in again.')
      } else {
        alert('Your session has expired. Please refresh and log in again.')
      }
      return
    }

    // Handle AT Protocol errors
    if (error instanceof ATProtoError) {
      alert(`Error: ${error.message}`)
      return
    }

    // Fallback for unknown errors
    if (options.fallback) {
      options.fallback(error as Error)
    } else {
      alert('An unexpected error occurred. Please try again.')
    }
  }, [options])

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