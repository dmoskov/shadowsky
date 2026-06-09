/**
 * Error handling utilities
 *
 * The error classes and categorization logic live in @bsky/core
 * (packages/core/src/errors.ts) so they are single-sourced across web and
 * mobile. This module re-exports them, installs the browser connectivity
 * checker, and keeps web-only error tracking.
 */

import { categorizeError, setOnlineChecker } from "@bsky/core";

export {
  ATProtoError,
  SessionExpiredError,
  AuthenticationError,
  NetworkError,
  RateLimitError,
  type ErrorCategory,
  isRateLimitError,
  isAuthenticationError,
  isSessionExpiredError,
  mapATProtoError,
  categorizeError,
} from "@bsky/core";

// Core defaults to "always online"; the browser knows better.
setOnlineChecker(() => navigator.onLine);

export function trackError(
  error: unknown,
  context?: string,
  metadata?: Record<string, string | number | boolean>,
): void {
  // Use lazy import to avoid circular dependencies
  import("../utils/error-monitoring").then(({ getErrorMonitor }) => {
    const category = categorizeError(error);

    // Map our ErrorCategory to the monitoring ErrorCategory
    const monitorCategory =
      category === "rate-limit"
        ? "rate_limit"
        : category === "auth"
          ? "auth"
          : category === "network"
            ? "network"
            : category === "validation"
              ? "validation"
              : "unknown";

    getErrorMonitor().recordError(error, {
      operation: context || "unknown",
      component: "error-handler",
      category:
        monitorCategory as import("../utils/error-monitoring").ErrorCategory,
      severity:
        category === "auth" || category === "network" ? "error" : "warning",
      metadata,
    });
  });
}
