/**
 * Retry utility with exponential backoff for AT Protocol services
 *
 * Provides automatic retry logic for API calls with:
 * - Exponential backoff with jitter
 * - Retry-After header support
 * - Configurable retryable status codes
 * - Network error handling
 */

export interface RetryOptions {
  maxRetries?: number; // Default: 3
  baseDelay?: number; // Default: 1000ms
  maxDelay?: number; // Default: 30000ms
  retryableStatuses?: number[]; // Default: [429, 500, 502, 503, 504]
  onRetry?: (attempt: number, error: Error, delay: number) => void;
}

const DEFAULT_RETRYABLE_STATUSES = [429, 500, 502, 503, 504];
const NON_RETRYABLE_STATUSES = [400, 401, 403, 404];

/** Shape of HTTP-like errors from AT Protocol client */
interface HttpError {
  status?: number;
  statusCode?: number;
  name?: string;
  message?: string;
  headers?: Record<string, string>;
  response?: {
    status?: number;
    headers?: Record<string, string>;
  };
}

/**
 * Narrow unknown error to object shape for property access
 */
function asErrorObject(error: unknown): HttpError | null {
  if (error && typeof error === 'object') {
    return error as HttpError;
  }
  return null;
}

/**
 * Extract HTTP status code from error
 */
function getErrorStatus(error: unknown): number | undefined {
  const err = asErrorObject(error);
  if (!err) return undefined;
  if (err.status !== undefined) return err.status;
  if (err.statusCode !== undefined) return err.statusCode;
  if (err.response?.status !== undefined) return err.response.status;
  return undefined;
}

/**
 * Check if error has headers property
 */
function hasHeaders(error: unknown): error is { headers: Record<string, string> } {
  return (
    error !== null &&
    typeof error === 'object' &&
    'headers' in error &&
    typeof (error as HttpError).headers === 'object'
  );
}

/**
 * Extract Retry-After delay from error headers
 * Returns delay in milliseconds, or null if not present
 */
function getRetryAfterDelay(error: unknown): number | null {
  if (!hasHeaders(error)) return null;

  const err = asErrorObject(error);
  const retryAfter =
    error.headers['retry-after'] ||
    error.headers['Retry-After'] ||
    err?.response?.headers?.['retry-after'] ||
    err?.response?.headers?.['Retry-After'];

  if (!retryAfter) return null;

  // Handle seconds (integer)
  const delaySeconds = parseInt(String(retryAfter), 10);
  if (!isNaN(delaySeconds)) {
    return delaySeconds * 1000;
  }

  // Handle HTTP date
  const retryDate = new Date(String(retryAfter));
  if (!isNaN(retryDate.getTime())) {
    return Math.max(0, retryDate.getTime() - Date.now());
  }

  return null;
}

/**
 * Check if error is retryable
 */
function isRetryableError(
  error: unknown,
  retryableStatuses: number[]
): boolean {
  const status = getErrorStatus(error);

  // Don't retry non-retryable status codes
  if (status !== undefined && NON_RETRYABLE_STATUSES.includes(status)) {
    return false;
  }

  // Retry configured retryable statuses
  if (status !== undefined && retryableStatuses.includes(status)) {
    return true;
  }

  // Retry network errors
  if (error instanceof TypeError) {
    return true; // Network errors are typically TypeErrors
  }

  // Check error name for common network/timeout errors
  const err = asErrorObject(error);
  if (err) {
    const errorName = err.name;
    const errorMessage = err.message || '';

    if (
      errorName === 'AbortError' ||
      errorName === 'TimeoutError' ||
      errorMessage.includes('network') ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('ECONNREFUSED') ||
      errorMessage.includes('ETIMEDOUT')
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(
  attempt: number,
  baseDelay: number,
  maxDelay: number
): number {
  // Exponential backoff: baseDelay * 2^attempt
  const exponentialDelay = baseDelay * Math.pow(2, attempt);

  // Add random jitter (0-500ms) to prevent thundering herd
  const jitter = Math.random() * 500;

  // Cap at maxDelay
  return Math.min(exponentialDelay + jitter, maxDelay);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Wrap an async function with retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    retryableStatuses = DEFAULT_RETRYABLE_STATUSES,
    onRetry,
  } = options;

  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // If this is the last attempt, throw the error
      if (attempt === maxRetries) {
        throw lastError;
      }

      // Check if error is retryable
      if (!isRetryableError(error, retryableStatuses)) {
        throw lastError;
      }

      // Calculate delay (respect Retry-After header if present)
      const retryAfterDelay = getRetryAfterDelay(error);
      const delay = retryAfterDelay ?? calculateDelay(attempt, baseDelay, maxDelay);

      // Call onRetry callback if provided
      if (onRetry) {
        onRetry(attempt + 1, lastError, delay);
      }

      // Wait before retrying
      await sleep(delay);
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError!;
}
