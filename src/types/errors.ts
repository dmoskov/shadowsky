/**
 * Common error types used throughout the application
 */

// Re-export storage error types for convenience
export {
  DEFAULT_RETRY_CONFIG,
  StorageErrorCode,
  StorageErrorSeverity,
  calculateRetryDelay,
  classifyStorageError,
  createStorageError,
  isStorageError,
  shouldRetryStorageError,
  type RetryConfig,
  type StorageError,
  type StorageErrorOptions,
} from "./storage-errors";

export interface ErrorWithStatus {
  status?: number;
  message?: string;
}

export interface NetworkError {
  status?: number;
  statusText?: string;
  message?: string;
  error?: string;
}

export interface ATProtoError {
  status?: number | string;
  error?: string;
  message?: string;
}

export interface QueryError {
  status?: number;
  message?: string;
  data?: unknown;
}

export interface RateLimitErrorWithReset {
  status?: number;
  message?: string;
  resetAt: Date;
}

export function isErrorWithStatus(error: unknown): error is ErrorWithStatus {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    (typeof (error as ErrorWithStatus).status === "number" ||
      typeof (error as ErrorWithStatus).status === "undefined")
  );
}

/**
 * Extended error interface for HTTP responses with headers
 * Used in retry logic to extract Retry-After headers
 */
export interface RetryableHttpError extends ErrorWithStatus {
  headers?: Record<string, string> | { [key: string]: string };
  response?: Response;
}

/**
 * Type guard for RetryableHttpError
 */
export function isRetryableHttpError(
  error: unknown,
): error is RetryableHttpError {
  return isErrorWithStatus(error);
}

/**
 * Type guard for checking if an error has a status property
 */
export function hasStatusProperty(error: unknown): error is { status: number } {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof (error as { status: unknown }).status === "number"
  );
}

/**
 * Type guard for checking if an error has a message property
 */
export function hasMessageProperty(
  error: unknown,
): error is { message: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  );
}

/**
 * Type guard for checking if an error has headers property
 */
export function hasHeadersProperty(
  error: unknown,
): error is { headers: Record<string, string> } {
  return (
    typeof error === "object" &&
    error !== null &&
    "headers" in error &&
    typeof (error as { headers: unknown }).headers === "object" &&
    (error as { headers: unknown }).headers !== null
  );
}

/**
 * Safely extract error message from unknown error
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (hasMessageProperty(error)) {
    return error.message;
  }
  return String(error);
}

/**
 * Safely extract status code from unknown error
 */
export function getErrorStatus(error: unknown): number | undefined {
  if (hasStatusProperty(error)) {
    return error.status;
  }
  return undefined;
}
