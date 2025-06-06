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
export function mapATProtoError(error: any): ATProtoError {
  if (error.status === 429) {
    const resetAt = error.headers?.['ratelimit-reset'] 
      ? new Date(parseInt(error.headers['ratelimit-reset']) * 1000)
      : new Date(Date.now() + 60000) // Default to 1 minute
    return new RateLimitError(resetAt, error.message, error)
  }

  if (error.status === 401) {
    return new AuthenticationError(error.message || 'Unauthorized', error)
  }

  if (error.status === 400) {
    return new InvalidRequestError(error.message || 'Bad request', error)
  }

  if (error.status === 404) {
    return new RecordNotFoundError(error.message || 'Not found', error)
  }

  if (error.error === 'ExpiredToken' || error.error === 'InvalidToken') {
    return new SessionExpiredError(error.message, error)
  }

  // Generic network error for unknown cases
  if (error.status >= 500) {
    return new NetworkError('Server error', error)
  }

  return new ATProtoError('UnknownError', error.message || 'An unknown error occurred', error)
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