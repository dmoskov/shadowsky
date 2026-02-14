/**
 * Custom hook for handling errors in a consistent way
 *
 * Features:
 * - Handles AT Protocol errors (rate limits, auth errors, etc.)
 * - Supports toast notifications for user feedback
 * - Provides callbacks for specific error types
 * - Categorizes errors for proper handling
 */

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { captureException } from "../utils/error-reporting";


import { createLogger } from '../utils/logger';

const logger = createLogger('Useerrorhandler');
interface ErrorHandlerOptions {
  onRateLimit?: (resetAt: Date) => void;
  onAuthError?: () => void;
  onSessionExpired?: () => void;
  fallback?: (error: Error) => void;
  silent?: boolean; // If true, don't show toasts
}

interface ApiError {
  status?: number;
  message?: string;
  error?: string;
  headers?: Record<string, string>;
}

/**
 * Check if error is a rate limit error (429)
 */
function isRateLimitError(error: unknown): error is ApiError {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    (error as ApiError).status === 429
  );
}

/**
 * Check if error is an authentication error (401)
 */
function isAuthError(error: unknown): error is ApiError {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    (error as ApiError).status === 401
  );
}

/**
 * Check if error is a forbidden error (403)
 */
function isForbiddenError(error: unknown): error is ApiError {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    (error as ApiError).status === 403
  );
}

/**
 * Check if error is a not found error (404)
 */
function isNotFoundError(error: unknown): error is ApiError {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    (error as ApiError).status === 404
  );
}

/**
 * Check if error is a server error (5xx)
 */
function isServerError(error: unknown): error is ApiError {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof (error as ApiError).status === "number" &&
    (error as ApiError).status! >= 500
  );
}

/**
 * Check if error is a network error
 */
function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    return (
      error.message.toLowerCase().includes("network") ||
      error.message.toLowerCase().includes("fetch") ||
      error.message.toLowerCase().includes("connection")
    );
  }
  return false;
}

/**
 * Extract error message from unknown error type
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as ApiError).message === "string"
  ) {
    return (error as ApiError).message as string;
  }
  return "An unexpected error occurred";
}

/**
 * Calculate retry delay from rate limit headers
 */
function getRetryDelay(error: ApiError): number {
  const retryAfter = error.headers?.["retry-after"];
  if (retryAfter) {
    const seconds = parseInt(retryAfter, 10);
    if (!isNaN(seconds)) {
      return seconds * 1000;
    }
  }
  return 60000; // Default to 60 seconds
}

export const useErrorHandler = (options: ErrorHandlerOptions = {}) => {
  const { showToast } = useToast();
  const { signOut } = useAuth();
  const queryClient = useQueryClient();

  const handleError = useCallback(
    (error: Error | unknown, context?: string) => {
      // Suppress rate limiter internal queue timeout errors — these are
      // a symptom of burst traffic, not actionable failures
      if (
        error instanceof Error &&
        error.message.includes("Rate limit queue timeout")
      ) {
        return;
      }

      logger.error(`${context || "Error"}:`, error);

      // Extract API error details for Sentry reporting
      const statusCode =
        typeof error === "object" && error !== null && "status" in error
          ? (error as ApiError).status
          : undefined;

      // Report all errors to Sentry (except rate limit queue timeouts)
      captureException(error, {
        statusCode,
        extra: {
          context: context || "Unknown context",
          errorType: error instanceof Error ? error.name : typeof error,
        },
      });

      // Handle rate limit errors (429)
      if (isRateLimitError(error)) {
        const delay = getRetryDelay(error as ApiError);
        const seconds = Math.ceil(delay / 1000);

        if (options.onRateLimit) {
          const resetAt = new Date(Date.now() + delay);
          options.onRateLimit(resetAt);
        }

        if (!options.silent) {
          showToast(`Slow down! Retrying in ${seconds}s`, {
            type: "warning",
            duration: delay,
          });
        }

        // Pause queries temporarily
        queryClient.setDefaultOptions({
          queries: {
            enabled: false,
          },
        });

        setTimeout(() => {
          queryClient.setDefaultOptions({
            queries: {
              enabled: true,
            },
          });
        }, delay);

        return;
      }

      // Handle authentication errors (401)
      if (isAuthError(error)) {
        const message = getErrorMessage(error);

        if (options.onAuthError) {
          options.onAuthError();
        } else if (options.onSessionExpired) {
          options.onSessionExpired();
        } else {
          // Try to handle auth error automatically
          if (!options.silent) {
            showToast("Session expired. Please log in again.", {
              type: "error",
              duration: 5000,
            });
          }
          // Logout user
          signOut();
        }
        return;
      }

      // Handle forbidden errors (403)
      if (isForbiddenError(error)) {
        if (!options.silent) {
          showToast("You don't have permission for this action", {
            type: "error",
            duration: 4000,
          });
        }
        return;
      }

      // Handle not found errors (404)
      if (isNotFoundError(error)) {
        if (!options.silent) {
          showToast("Content not found or deleted", {
            type: "info",
            duration: 3000,
          });
        }
        return;
      }

      // Handle network errors
      if (isNetworkError(error)) {
        if (!options.silent) {
          showToast("Network error. Please check your connection.", {
            type: "error",
            duration: 5000,
          });
        }
        return;
      }

      // Handle server errors (5xx)
      if (isServerError(error)) {
        if (!options.silent) {
          showToast("Server error, retrying...", {
            type: "error",
            duration: 4000,
          });
        }
        // React Query will automatically retry
        return;
      }

      // Fallback for unknown errors
      if (options.fallback) {
        options.fallback(error as Error);
      } else {
        if (!options.silent) {
          const message = getErrorMessage(error);
          showToast(message || "Something went wrong", {
            type: "error",
            duration: 4000,
          });
        }
      }
    },
    [
      options.onRateLimit,
      options.onAuthError,
      options.onSessionExpired,
      options.fallback,
      options.silent,
      showToast,
      signOut,
      queryClient,
    ],
  );

  const handleApiError = useCallback(
    (error: ApiError) => {
      handleError(error, "API Error");
    },
    [handleError],
  );

  return { handleError, handleApiError };
};
