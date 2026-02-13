/**
 * Error Reporting Utility
 *
 * Centralized error tracking and reporting using Sentry.
 * Handles exception capture, breadcrumbs, user context, and performance monitoring.
 *
 * Features:
 * - Captures JavaScript exceptions and native crashes
 * - Tracks user actions as breadcrumbs for debugging
 * - Tags errors with user DID (hashed), app version, device info
 * - Performance monitoring for app startup, screen loads, API calls
 * - No PII sent (DID is hashed, no email/handle)
 */

import * as Sentry from "@sentry/react-native";
import Constants from "expo-constants";
import * as Crypto from "expo-crypto";

export interface ErrorContext {
  endpoint?: string;
  statusCode?: number;
  method?: string;
  extra?: Record<string, unknown>;
}

export interface BreadcrumbData {
  message: string;
  category: string;
  level?: Sentry.SeverityLevel;
  data?: Record<string, unknown>;
}

/**
 * Hash a user DID to preserve privacy while maintaining session tracking
 */
async function hashDid(did: string): Promise<string> {
  try {
    const digest = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      did
    );
    // Return first 16 chars for brevity
    return digest.substring(0, 16);
  } catch (error) {
    console.error("[ErrorReporting] Failed to hash DID:", error);
    return "unknown";
  }
}

/**
 * Initialize Sentry with configuration
 * Should be called early in app initialization
 */
export function initializeSentry(dsn?: string): void {
  // Skip initialization if no DSN provided or in development
  if (!dsn) {
    console.log("[ErrorReporting] No DSN provided, Sentry disabled");
    return;
  }

  try {
    Sentry.init({
      dsn,
      // Enable performance monitoring
      enableAutoPerformanceTracing: true,
      enableAutoSessionTracking: true,
      sessionTrackingIntervalMillis: 30000,

      // Track app start performance
      enableNativeFramesTracking: true,
      enableAppStartTracking: true,

      // Sample rate for performance (50% in production)
      tracesSampleRate: 0.5,

      // Don't send default PII
      sendDefaultPii: false,

      // Environment detection
      environment: __DEV__ ? "development" : "production",

      // Release version from app config
      release: `shadowsky-mobile@${Constants.expoConfig?.version || "unknown"}`,
      dist: Constants.expoConfig?.version,

      // Attach stack traces to errors
      attachStacktrace: true,

      // Max breadcrumbs to keep
      maxBreadcrumbs: 100,

      // Integration configurations
      integrations: [],

      // Before send hook to modify events
      beforeSend(event) {
        // Don't send events in development
        if (__DEV__) {
          console.log("[ErrorReporting] Would send event:", event);
          return null;
        }

        return event;
      },

      // Before breadcrumb hook
      beforeBreadcrumb(breadcrumb) {
        // Filter out noisy breadcrumbs
        if (breadcrumb.category === "console" && breadcrumb.level === "log") {
          return null;
        }
        return breadcrumb;
      },
    });

    console.log("[ErrorReporting] Sentry initialized successfully");
  } catch (error) {
    console.error("[ErrorReporting] Failed to initialize Sentry:", error);
  }
}

/**
 * Set user context (call after authentication)
 * @param did - User's DID (will be hashed for privacy)
 */
export async function setUser(did: string | null): Promise<void> {
  try {
    if (!did) {
      Sentry.setUser(null);
      return;
    }

    const hashedDid = await hashDid(did);
    Sentry.setUser({
      id: hashedDid,
      // Don't include username/email to avoid PII
    });

    // Add DID as tag for filtering
    Sentry.setTag("user_did_hash", hashedDid);
  } catch (error) {
    console.error("[ErrorReporting] Failed to set user:", error);
  }
}

/**
 * Clear user context (call on logout)
 */
export function clearUser(): void {
  Sentry.setUser(null);
}

/**
 * Capture an exception with optional context
 * @param error - The error to capture
 * @param context - Additional context (endpoint, status code, etc.)
 */
export function captureException(
  error: Error | unknown,
  context?: ErrorContext
): void {
  try {
    const eventId = Sentry.captureException(error, {
      contexts: context
        ? {
            api: {
              endpoint: context.endpoint,
              status_code: context.statusCode,
              method: context.method,
            },
          }
        : undefined,
      extra: context?.extra,
      tags: context?.statusCode
        ? {
            status_code: context.statusCode.toString(),
          }
        : undefined,
    });

    console.log(
      `[ErrorReporting] Exception captured: ${eventId}`,
      error,
      context
    );
  } catch (err) {
    console.error("[ErrorReporting] Failed to capture exception:", err);
  }
}

/**
 * Capture a message (for non-error events)
 * @param message - The message to capture
 * @param level - Severity level
 */
export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = "info"
): void {
  try {
    Sentry.captureMessage(message, level);
  } catch (error) {
    console.error("[ErrorReporting] Failed to capture message:", error);
  }
}

/**
 * Add a breadcrumb for debugging
 * @param category - Breadcrumb category (navigate, compose, like, search, auth, etc.)
 * @param message - Breadcrumb message
 * @param data - Additional data
 */
export function addBreadcrumb(
  category: string,
  message: string,
  data?: Record<string, unknown>
): void {
  try {
    Sentry.addBreadcrumb({
      type: "user",
      category,
      message,
      level: "info",
      data,
      timestamp: Date.now() / 1000,
    });
  } catch (error) {
    console.error("[ErrorReporting] Failed to add breadcrumb:", error);
  }
}

/**
 * Start a performance transaction (using startSpan API)
 * @param name - Transaction name (e.g., "screen.home", "api.fetchFeed")
 * @param op - Operation type (e.g., "navigation", "http.client")
 * @returns Span object or null
 */
export function startTransaction(
  name: string,
  op: string
): ReturnType<typeof Sentry.startSpan> | null {
  try {
    return Sentry.startSpan({ name, op }, (span) => span);
  } catch (error) {
    console.error("[ErrorReporting] Failed to start transaction:", error);
    return null;
  }
}

/**
 * Start a span within the current context
 * @param op - Operation name
 * @param description - Span description
 * @returns Span result or null
 */
export function startSpan(
  op: string,
  description: string
): ReturnType<typeof Sentry.startSpan> | null {
  try {
    return Sentry.startSpan({ op, name: description }, (span) => span);
  } catch (error) {
    console.error("[ErrorReporting] Failed to start span:", error);
    return null;
  }
}

/**
 * Set a tag for filtering/grouping errors
 * @param key - Tag key
 * @param value - Tag value
 */
export function setTag(key: string, value: string): void {
  try {
    Sentry.setTag(key, value);
  } catch (error) {
    console.error("[ErrorReporting] Failed to set tag:", error);
  }
}

/**
 * Set multiple tags at once
 * @param tags - Object with tag key-value pairs
 */
export function setTags(tags: Record<string, string>): void {
  try {
    Sentry.setTags(tags);
  } catch (error) {
    console.error("[ErrorReporting] Failed to set tags:", error);
  }
}

/**
 * Set custom context data
 * @param name - Context name
 * @param context - Context data
 */
export function setContext(name: string, context: Record<string, unknown>): void {
  try {
    Sentry.setContext(name, context);
  } catch (error) {
    console.error("[ErrorReporting] Failed to set context:", error);
  }
}

/**
 * Wrap a function to capture any errors it throws
 * @param fn - Function to wrap
 * @returns Wrapped function
 */
export function wrapErrorHandler<T extends (...args: unknown[]) => unknown>(
  fn: T
): T {
  return ((...args: unknown[]) => {
    try {
      return fn(...args);
    } catch (error) {
      captureException(error);
      throw error;
    }
  }) as T;
}

// Export Sentry for advanced usage
export { Sentry };
