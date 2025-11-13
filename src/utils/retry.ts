import { createLogger } from "./logger";
import {
  logRequestFailure,
  logRequestStart,
  logRequestSuccess,
  logRetryAttempt,
  type NetworkLogContext,
} from "./network-logger";

const logger = createLogger("Retry");

export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffFactor?: number;
  retryableErrors?: (error: any) => boolean;
  onRetry?: (error: any, attempt: number) => void;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffFactor: 2,
  retryableErrors: (error: any) => {
    // Retry on network errors
    if (error instanceof TypeError && error.message.includes("fetch")) {
      return true;
    }

    // Retry on rate limits (429)
    if (error instanceof Error && error.message.includes("429")) {
      return true;
    }

    // Retry on server errors (500, 503)
    if (
      error instanceof Error &&
      (error.message.includes("500") || error.message.includes("503"))
    ) {
      return true;
    }

    // Retry on timeout errors
    if (
      error instanceof Error &&
      error.message.toLowerCase().includes("timeout")
    ) {
      return true;
    }

    return false;
  },
  onRetry: () => {},
};

/**
 * Retry a function with exponential backoff
 *
 * @example
 * const result = await retryWithBackoff(
 *   () => fetch('/api/endpoint'),
 *   { maxAttempts: 3, initialDelayMs: 1000 }
 * );
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: any;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if this is the last attempt
      if (attempt === opts.maxAttempts) {
        logger.error(`Failed after ${attempt} attempts:`, error);
        throw error;
      }

      // Check if error is retryable
      if (!opts.retryableErrors(error)) {
        logger.error("Non-retryable error:", error);
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        opts.initialDelayMs * Math.pow(opts.backoffFactor, attempt - 1),
        opts.maxDelayMs,
      );

      logger.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`, error);
      opts.onRetry(error, attempt);

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Retry options optimized for blob/file operations
 */
export const BLOB_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 2,
  initialDelayMs: 500,
  maxDelayMs: 2000,
  retryableErrors: (error: any) => {
    // Retry on blob fetch failures
    if (error instanceof TypeError) {
      return true;
    }
    return DEFAULT_OPTIONS.retryableErrors(error);
  },
};

/**
 * Retry options optimized for API calls
 */
export const API_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffFactor: 2,
  retryableErrors: (error: any) => {
    // Don't retry on authentication errors (401)
    if (error instanceof Error && error.message.includes("401")) {
      return false;
    }

    // Don't retry on client errors (400, 403)
    if (
      error instanceof Error &&
      (error.message.includes("400") || error.message.includes("403"))
    ) {
      return false;
    }

    return DEFAULT_OPTIONS.retryableErrors(error);
  },
};

/**
 * Retry options optimized for AT Protocol operations
 */
export const AT_PROTO_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 5000,
  retryableErrors: (error: any) => {
    // Don't retry on 400 (record not found is expected)
    if (error?.status === 400) {
      return false;
    }

    // Retry on network errors
    if (error instanceof TypeError) {
      return true;
    }

    // Retry on server errors
    if (error?.status >= 500) {
      return true;
    }

    return false;
  },
};

/**
 * Retry options optimized for alt-text generation
 * - 8 second timeout per request (handled by Lambda)
 * - Maximum 3 attempts (1 initial + 2 retries)
 * - Exponential backoff: 1s, 2s delays
 * - Total max time: ~27s (8s + 1s + 8s + 2s + 8s)
 * - Target: 95% completion within 10s
 */
export const ALT_TEXT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 2000,
  backoffFactor: 2,
  retryableErrors: (error: any) => {
    // Don't retry on authentication errors (401)
    if (error instanceof Error && error.message.includes("401")) {
      return false;
    }

    // Don't retry on client errors (400, 403)
    if (
      error instanceof Error &&
      (error.message.includes("400") || error.message.includes("403"))
    ) {
      return false;
    }

    // Retry on timeout errors
    if (
      error instanceof Error &&
      (error.message.toLowerCase().includes("timeout") ||
        error.message.includes("TIMEOUT_ERROR"))
    ) {
      return true;
    }

    return DEFAULT_OPTIONS.retryableErrors(error);
  },
};

/**
 * Safe wrapper for createObjectURL with error handling
 */
export function safeCreateObjectURL(blob: Blob): string | null {
  try {
    return URL.createObjectURL(blob);
  } catch (error) {
    logger.error("Failed to create object URL:", error);
    return null;
  }
}

/**
 * Safe wrapper for revokeObjectURL with error handling
 */
export function safeRevokeObjectURL(url: string): void {
  try {
    if (url && url.startsWith("blob:")) {
      URL.revokeObjectURL(url);
    }
  } catch (error) {
    logger.error("Failed to revoke object URL:", error);
  }
}

/**
 * Convert blob URL to data URL with retry
 */
export async function blobUrlToDataUrl(
  blobUrl: string,
  options: RetryOptions = BLOB_RETRY_OPTIONS,
): Promise<string> {
  return retryWithBackoff(async () => {
    const response = await fetch(blobUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch blob: ${response.status}`);
    }
    const blob = await response.blob();

    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.result && typeof reader.result === "string") {
          resolve(reader.result);
        } else {
          reject(new Error("Failed to read file"));
        }
      };
      reader.onerror = () =>
        reject(reader.error || new Error("FileReader error"));
      reader.readAsDataURL(blob);
    });
  }, options);
}

/**
 * Fetch with retry and structured logging
 */
export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  options: RetryOptions = API_RETRY_OPTIONS,
): Promise<Response> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: any;
  let logContext: NetworkLogContext | undefined;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      logContext = logRequestStart(url, init, attempt);
      const response = await fetch(url, init);

      // Throw on HTTP errors to trigger retry logic
      if (!response.ok) {
        const error: any = new Error(
          `HTTP ${response.status}: ${response.statusText}`,
        );
        error.status = response.status;
        error.response = response;

        // Log failure
        logRequestFailure(logContext, error);

        // Check if we should retry
        if (attempt < opts.maxAttempts && opts.retryableErrors(error)) {
          lastError = error;
          const delay = Math.min(
            opts.initialDelayMs * Math.pow(opts.backoffFactor, attempt - 1),
            opts.maxDelayMs,
          );
          logRetryAttempt(logContext, attempt, delay, error);
          opts.onRetry(error, attempt);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        throw error;
      }

      logRequestSuccess(logContext, response);
      return response;
    } catch (error) {
      lastError = error;

      if (
        logContext &&
        !(error && typeof error === "object" && "response" in error)
      ) {
        logRequestFailure(logContext, error);
      }

      // Check if this is the last attempt
      if (attempt === opts.maxAttempts) {
        logger.error(`Failed after ${attempt} attempts:`, error);
        throw error;
      }

      // Check if error is retryable
      if (!opts.retryableErrors(error)) {
        logger.error("Non-retryable error:", error);
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        opts.initialDelayMs * Math.pow(opts.backoffFactor, attempt - 1),
        opts.maxDelayMs,
      );

      if (logContext) {
        logRetryAttempt(logContext, attempt, delay, error);
      }
      opts.onRetry(error, attempt);

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
