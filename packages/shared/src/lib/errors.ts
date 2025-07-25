/**
 * Custom error classes for AT Protocol operations
 */

export class ATProtoError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message)
    this.name = 'ATProtoError'
  }
}

export class NetworkError extends ATProtoError {
  constructor(message: string = 'Network request failed', details?: unknown) {
    super('NetworkError', message, details)
  }
}

export class AuthenticationError extends ATProtoError {
  constructor(message: string = 'Authentication failed', details?: unknown) {
    super('AuthenticationError', message, details)
  }
}

export class RateLimitError extends ATProtoError {
  constructor(
    public resetAt: Date,
    message: string = 'Rate limit exceeded',
    details?: unknown
  ) {
    super('RateLimit', message, details)
  }
}

export class InvalidRequestError extends ATProtoError {
  constructor(message: string = 'Invalid request', details?: unknown) {
    super('InvalidRequest', message, details)
  }
}

export class RecordNotFoundError extends ATProtoError {
  constructor(uri: string, details?: unknown) {
    super('RecordNotFound', `Record not found: ${uri}`, details)
  }
}

export class SessionExpiredError extends ATProtoError {
  constructor(message: string = 'Session has expired', details?: unknown) {
    super('SessionExpired', message, details)
  }
}

// Error mapping from AT Protocol errors
export function mapATProtoError(error: unknown): ATProtoError {
  const err = error as Error & {
    status?: number
    headers?: Record<string, string>
    error?: string
    code?: string
    name?: string
    message?: string
  }
  
  // Handle network errors first
  if (err.name === 'NetworkError' || (err.name === 'TypeError' && err.message?.includes('fetch'))) {
    return new NetworkError('Network connection failed', err)
  }
  
  // Handle timeout errors
  if (err.name === 'AbortError' || err.code === 'ECONNABORTED') {
    return new NetworkError('Request timeout', err)
  }
  
  if (err.status === 429) {
    const resetAt = err.headers?.['ratelimit-reset'] 
      ? new Date(parseInt(err.headers['ratelimit-reset']) * 1000)
      : new Date(Date.now() + 60000) // Default to 1 minute
    return new RateLimitError(resetAt, err.message || 'Rate limit exceeded', err)
  }

  if (err.status === 401) {
    return new AuthenticationError(err.message || 'Unauthorized', err)
  }

  if (err.status === 400) {
    // Check for specific token errors in the response
    if (err.error === 'ExpiredToken' || err.error === 'InvalidToken' ||
        err.message?.toLowerCase().includes('token') ||
        err.message?.toLowerCase().includes('expired')) {
      return new SessionExpiredError(err.message || 'Session expired', err)
    }
    return new InvalidRequestError(err.message || 'Bad request', err)
  }

  if (err.status === 404) {
    return new RecordNotFoundError(err.message || 'Not found', err)
  }

  if (err.error === 'ExpiredToken' || err.error === 'InvalidToken') {
    return new SessionExpiredError(err.message || 'Session expired', err)
  }

  // Generic network error for server errors
  if (err.status && err.status >= 500) {
    return new NetworkError('Server error', err)
  }
  
  // Handle CORS errors
  if (err.message?.toLowerCase().includes('cors')) {
    return new NetworkError('CORS error - unable to connect to server', err)
  }

  return new ATProtoError('UnknownError', err.message || 'An unknown error occurred', err)
}

// Type guard functions
export function isRateLimitError(error: unknown): error is RateLimitError {
  return error instanceof RateLimitError
}

export function isAuthenticationError(error: unknown): error is AuthenticationError {
  return error instanceof AuthenticationError
}

export function isSessionExpiredError(error: unknown): error is SessionExpiredError {
  return error instanceof SessionExpiredError
}

// Export convenience function for service layer
export const handleATProtoError = mapATProtoError