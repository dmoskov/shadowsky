/**
 * Storage error types and classification utilities
 *
 * Implements the hybrid error handling strategy:
 * - Transient: Retry with toast notification
 * - Permanent: Graceful degradation with banner
 * - Critical: Fail loudly with modal
 *
 * @see /docs/storage-error-handling-strategy.md
 */

/**
 * Error severity levels determining how errors are handled
 */
export enum StorageErrorSeverity {
  /** Temporary errors that should be retried with backoff */
  TRANSIENT = "transient",
  /** Persistent errors allowing degraded functionality */
  PERMANENT = "permanent",
  /** Blocking errors requiring immediate user attention */
  CRITICAL = "critical",
}

/**
 * Specific storage error codes for precise error handling
 */
export enum StorageErrorCode {
  // Transient errors - retry with backoff
  LOCK_CONTENTION = "LOCK_CONTENTION",
  QUOTA_TEMPORARY = "QUOTA_TEMPORARY",
  NETWORK_TIMEOUT = "NETWORK_TIMEOUT",
  DB_BUSY = "DB_BUSY",
  TRANSACTION_INACTIVE = "TRANSACTION_INACTIVE",

  // Permanent errors - graceful degradation
  INDEXEDDB_UNAVAILABLE = "INDEXEDDB_UNAVAILABLE",
  DB_CORRUPTION = "DB_CORRUPTION",
  QUOTA_EXCEEDED = "QUOTA_EXCEEDED",
  PERMISSION_DENIED = "PERMISSION_DENIED",
  PRIVATE_BROWSING = "PRIVATE_BROWSING",
  VERSION_MISMATCH = "VERSION_MISMATCH",

  // Critical errors - fail loudly
  AUTH_STORAGE_FAILURE = "AUTH_STORAGE_FAILURE",
  ENCRYPTION_FAILURE = "ENCRYPTION_FAILURE",
  PREFERENCES_CORRUPTION = "PREFERENCES_CORRUPTION",
  DATA_INTEGRITY = "DATA_INTEGRITY",
  SECURITY_VIOLATION = "SECURITY_VIOLATION",

  // Unknown - default classification
  UNKNOWN = "UNKNOWN",
}

/**
 * Extended error interface for storage operations
 */
export interface StorageError extends Error {
  /** Specific error code for programmatic handling */
  code: StorageErrorCode;
  /** Severity level determining UI behavior */
  severity: StorageErrorSeverity;
  /** Whether the error can be recovered from */
  recoverable: boolean;
  /** User-friendly message for display */
  userMessage: string;
  /** Technical details for debugging */
  technicalDetails?: string;
  /** Original error that caused this storage error */
  originalError?: Error;
}

/**
 * Options for creating a storage error
 */
export interface StorageErrorOptions {
  code: StorageErrorCode;
  severity: StorageErrorSeverity;
  recoverable: boolean;
  userMessage: string;
  technicalDetails?: string;
  originalError?: Error;
}

/**
 * Creates a StorageError from options
 */
export function createStorageError(
  message: string,
  options: StorageErrorOptions,
): StorageError {
  const error = new Error(message) as StorageError;
  error.code = options.code;
  error.severity = options.severity;
  error.recoverable = options.recoverable;
  error.userMessage = options.userMessage;
  error.technicalDetails = options.technicalDetails;
  error.originalError = options.originalError;

  // Preserve original stack if available
  if (options.originalError?.stack) {
    error.stack = options.originalError.stack;
  }

  return error;
}

/**
 * Type guard to check if an error is a StorageError
 */
export function isStorageError(error: unknown): error is StorageError {
  return (
    error instanceof Error &&
    "code" in error &&
    "severity" in error &&
    Object.values(StorageErrorCode).includes((error as StorageError).code)
  );
}

/**
 * Classifies an arbitrary error into a StorageError
 * Analyzes error message and type to determine appropriate handling
 */
export function classifyStorageError(error: unknown): StorageError {
  // If already classified, return as-is
  if (isStorageError(error)) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);
  const name = error instanceof Error ? error.name : "Error";
  const originalError = error instanceof Error ? error : undefined;

  // IndexedDB QuotaExceededError
  if (name === "QuotaExceededError" || message.includes("quota exceeded")) {
    return createStorageError("Storage quota exceeded", {
      code: StorageErrorCode.QUOTA_EXCEEDED,
      severity: StorageErrorSeverity.PERMANENT,
      recoverable: true,
      userMessage:
        "Storage is full. Please clear browser data to restore full functionality.",
      technicalDetails: message,
      originalError,
    });
  }

  // Lock contention / database busy
  if (
    message.includes("lock") ||
    message.includes("busy") ||
    name === "DatabaseLockedError"
  ) {
    return createStorageError("Database lock contention", {
      code: StorageErrorCode.LOCK_CONTENTION,
      severity: StorageErrorSeverity.TRANSIENT,
      recoverable: true,
      userMessage: "Storage temporarily busy. Retrying...",
      technicalDetails: message,
      originalError,
    });
  }

  // Transaction inactive (common Dexie error)
  if (
    message.includes("TransactionInactiveError") ||
    message.includes("transaction")
  ) {
    return createStorageError("Transaction inactive", {
      code: StorageErrorCode.TRANSACTION_INACTIVE,
      severity: StorageErrorSeverity.TRANSIENT,
      recoverable: true,
      userMessage: "Storage operation interrupted. Retrying...",
      technicalDetails: message,
      originalError,
    });
  }

  // Private browsing / SecurityError
  if (
    name === "SecurityError" ||
    message.includes("InvalidStateError") ||
    message.includes("A mutation operation was attempted on a database") ||
    message.includes("access is denied")
  ) {
    return createStorageError("Storage unavailable (private browsing)", {
      code: StorageErrorCode.PRIVATE_BROWSING,
      severity: StorageErrorSeverity.PERMANENT,
      recoverable: false,
      userMessage:
        "Private browsing mode detected. Some features will be unavailable.",
      technicalDetails: message,
      originalError,
    });
  }

  // IndexedDB not available
  if (
    typeof indexedDB === "undefined" ||
    message.includes("indexedDB is not defined") ||
    message.includes("IndexedDB not available")
  ) {
    return createStorageError("IndexedDB unavailable", {
      code: StorageErrorCode.INDEXEDDB_UNAVAILABLE,
      severity: StorageErrorSeverity.PERMANENT,
      recoverable: false,
      userMessage:
        "Local storage is not available in this browser. Working in online-only mode.",
      technicalDetails: message,
      originalError,
    });
  }

  // Database corruption
  if (
    message.includes("corrupt") ||
    message.includes("InvalidAccessError") ||
    message.includes("VersionError")
  ) {
    return createStorageError("Database corruption detected", {
      code: StorageErrorCode.DB_CORRUPTION,
      severity: StorageErrorSeverity.PERMANENT,
      recoverable: true,
      userMessage:
        "Local storage has become corrupted. Some data may need to be refreshed.",
      technicalDetails: message,
      originalError,
    });
  }

  // Permission denied
  if (
    message.includes("permission") ||
    message.includes("denied") ||
    message.includes("NotAllowedError")
  ) {
    return createStorageError("Storage permission denied", {
      code: StorageErrorCode.PERMISSION_DENIED,
      severity: StorageErrorSeverity.PERMANENT,
      recoverable: false,
      userMessage:
        "Storage access was denied. Check browser settings to enable storage.",
      technicalDetails: message,
      originalError,
    });
  }

  // Auth-related storage failures (CRITICAL)
  if (
    message.toLowerCase().includes("auth") ||
    message.toLowerCase().includes("session") ||
    message.toLowerCase().includes("token") ||
    message.toLowerCase().includes("credential")
  ) {
    return createStorageError("Authentication storage failure", {
      code: StorageErrorCode.AUTH_STORAGE_FAILURE,
      severity: StorageErrorSeverity.CRITICAL,
      recoverable: false,
      userMessage:
        "Unable to save authentication data. Please try logging in again.",
      technicalDetails: message,
      originalError,
    });
  }

  // Encryption failures (CRITICAL)
  if (
    message.toLowerCase().includes("encrypt") ||
    message.toLowerCase().includes("decrypt") ||
    message.toLowerCase().includes("cipher")
  ) {
    return createStorageError("Encryption failure", {
      code: StorageErrorCode.ENCRYPTION_FAILURE,
      severity: StorageErrorSeverity.CRITICAL,
      recoverable: false,
      userMessage: "Security error occurred. Please refresh and try again.",
      technicalDetails: message,
      originalError,
    });
  }

  // Network timeout (for sync operations)
  if (
    message.includes("timeout") ||
    message.includes("ETIMEDOUT") ||
    message.includes("network")
  ) {
    return createStorageError("Network timeout", {
      code: StorageErrorCode.NETWORK_TIMEOUT,
      severity: StorageErrorSeverity.TRANSIENT,
      recoverable: true,
      userMessage: "Connection timeout. Retrying...",
      technicalDetails: message,
      originalError,
    });
  }

  // Default: treat unknown errors as transient (optimistic)
  return createStorageError(message || "Unknown storage error", {
    code: StorageErrorCode.UNKNOWN,
    severity: StorageErrorSeverity.TRANSIENT,
    recoverable: true,
    userMessage: "A storage error occurred. Retrying...",
    technicalDetails: message,
    originalError,
  });
}

/**
 * Configuration for retry behavior
 */
export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffFactor: number;
}

/**
 * Default retry configuration for transient errors
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  backoffFactor: 2,
};

/**
 * Calculates the delay for a retry attempt using exponential backoff
 */
export function calculateRetryDelay(
  attempt: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
): number {
  const delay =
    config.baseDelayMs * Math.pow(config.backoffFactor, attempt - 1);
  return Math.min(delay, config.maxDelayMs);
}

/**
 * Determines if an error should be retried based on severity
 */
export function shouldRetryStorageError(error: StorageError): boolean {
  return error.severity === StorageErrorSeverity.TRANSIENT && error.recoverable;
}
