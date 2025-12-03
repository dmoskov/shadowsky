/**
 * User-friendly error message utilities
 *
 * Maps technical errors to plain-language explanations with contextual recovery actions.
 * Provides consistent error messaging across the application.
 */

import type { ErrorCategory } from "../shared/errors";

export interface UserFriendlyError {
  title: string;
  message: string;
  recoveryActions: RecoveryAction[];
  severity: "error" | "warning" | "info";
  retryable: boolean;
  technical?: string;
}

export interface RecoveryAction {
  label: string;
  action: "retry" | "refresh" | "login" | "wait" | "contact-support" | "custom";
  customAction?: () => void;
  waitTime?: number;
}

/**
 * Error categories for user-friendly mapping
 */
export type FriendlyErrorCategory =
  | "network"
  | "auth"
  | "rate-limit"
  | "validation"
  | "server"
  | "offline"
  | "unknown";

/**
 * Detect if the user is offline
 */
export function isOffline(): boolean {
  return typeof navigator !== "undefined" && !navigator.onLine;
}

/**
 * Extract error code from various error formats
 */
function getErrorCode(error: unknown): number | undefined {
  if (typeof error === "object" && error !== null) {
    const err = error as Record<string, unknown>;
    if (typeof err.status === "number") return err.status;
    if (typeof err.code === "number") return err.code;
    if (
      err.response &&
      typeof (err.response as Record<string, unknown>).status === "number"
    ) {
      return (err.response as Record<string, unknown>).status as number;
    }
  }
  return undefined;
}

/**
 * Extract error message from various error formats
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (typeof error === "object" && error !== null) {
    const err = error as Record<string, unknown>;
    if (typeof err.message === "string") return err.message;
    if (typeof err.error === "string") return err.error;
  }
  return "An unknown error occurred";
}

/**
 * Categorize an error for user-friendly handling
 */
export function categorizeUserFriendlyError(
  error: unknown,
): FriendlyErrorCategory {
  if (isOffline()) return "offline";

  const code = getErrorCode(error);
  const message = getErrorMessage(error).toLowerCase();

  // Network errors
  if (
    code === 0 ||
    message.includes("network") ||
    message.includes("fetch") ||
    message.includes("connection") ||
    message.includes("timeout") ||
    message.includes("websocket") ||
    message.includes("econnrefused") ||
    message.includes("dns")
  ) {
    return "network";
  }

  // Auth errors
  if (
    code === 401 ||
    message.includes("unauthorized") ||
    message.includes("session")
  ) {
    return "auth";
  }

  // Rate limit errors
  if (
    code === 429 ||
    message.includes("rate limit") ||
    message.includes("too many requests")
  ) {
    return "rate-limit";
  }

  // Validation errors
  if (
    code === 400 ||
    message.includes("invalid") ||
    message.includes("validation")
  ) {
    return "validation";
  }

  // Server errors
  if (code && code >= 500) {
    return "server";
  }

  return "unknown";
}

/**
 * User-friendly error messages by category
 */
const ERROR_MESSAGES: Record<FriendlyErrorCategory, UserFriendlyError> = {
  offline: {
    title: "You're offline",
    message:
      "Your internet connection was lost. Changes will sync when you're back online.",
    recoveryActions: [{ label: "Check connection", action: "custom" }],
    severity: "warning",
    retryable: true,
  },
  network: {
    title: "Connection problem",
    message:
      "We couldn't reach the server. This might be a temporary network issue.",
    recoveryActions: [
      { label: "Try again", action: "retry" },
      { label: "Refresh page", action: "refresh" },
    ],
    severity: "warning",
    retryable: true,
  },
  auth: {
    title: "Login expired",
    message: "Your session has ended. Please log in again to continue.",
    recoveryActions: [{ label: "Log in", action: "login" }],
    severity: "error",
    retryable: false,
  },
  "rate-limit": {
    title: "Slow down",
    message:
      "You're posting too fast. Please wait a moment before trying again.",
    recoveryActions: [
      { label: "Wait and retry", action: "wait", waitTime: 60 },
    ],
    severity: "warning",
    retryable: true,
  },
  validation: {
    title: "Something's not right",
    message: "Please check your input and try again.",
    recoveryActions: [{ label: "Try again", action: "retry" }],
    severity: "error",
    retryable: true,
  },
  server: {
    title: "Server trouble",
    message:
      "Bluesky is experiencing issues. This isn't your fault—please try again later.",
    recoveryActions: [
      { label: "Try again", action: "retry" },
      { label: "Check status", action: "custom" },
    ],
    severity: "error",
    retryable: true,
  },
  unknown: {
    title: "Something went wrong",
    message: "An unexpected error occurred. Please try again.",
    recoveryActions: [
      { label: "Try again", action: "retry" },
      { label: "Refresh page", action: "refresh" },
    ],
    severity: "error",
    retryable: true,
  },
};

/**
 * Specific error message overrides for common scenarios
 */
const SPECIFIC_ERROR_PATTERNS: Array<{
  pattern: RegExp | ((error: unknown) => boolean);
  error: Partial<UserFriendlyError>;
}> = [
  // WebSocket errors
  {
    pattern: /websocket.*error.*1006|connection.*closed.*abnormally/i,
    error: {
      title: "Connection lost",
      message: "Real-time updates paused. We'll reconnect automatically.",
      severity: "warning",
      retryable: true,
    },
  },
  // Post character limit
  {
    pattern: /text.*too.*long|exceeds.*character.*limit|300.*characters/i,
    error: {
      title: "Post too long",
      message: "Your post exceeds the 300 character limit. Please shorten it.",
      severity: "warning",
      retryable: true,
    },
  },
  // Image upload errors
  {
    pattern: /image.*too.*large|file.*size.*exceeded/i,
    error: {
      title: "Image too large",
      message: "Please use an image under 1MB.",
      severity: "warning",
      retryable: true,
    },
  },
  // Video upload errors
  {
    pattern: /video.*too.*large|video.*size.*exceeded/i,
    error: {
      title: "Video too large",
      message: "Please use a video under 50MB.",
      severity: "warning",
      retryable: true,
    },
  },
  // Handle not found
  {
    pattern: /handle.*not.*found|user.*not.*found|profile.*not.*found/i,
    error: {
      title: "User not found",
      message: "This user doesn't exist or may have been deleted.",
      severity: "info",
      retryable: false,
    },
  },
  // Post not found
  {
    pattern: /post.*not.*found|record.*not.*found/i,
    error: {
      title: "Post not found",
      message: "This post may have been deleted or is no longer available.",
      severity: "info",
      retryable: false,
    },
  },
  // Blocked user
  {
    pattern: /blocked|blocking/i,
    error: {
      title: "Blocked",
      message: "You can't view this content due to block settings.",
      severity: "info",
      retryable: false,
    },
  },
  // Already exists
  {
    pattern: /already.*exists|duplicate/i,
    error: {
      title: "Already done",
      message: "This action has already been completed.",
      severity: "info",
      retryable: false,
    },
  },
  // Permission denied
  {
    pattern: /forbidden|permission.*denied|not.*authorized/i,
    error: {
      title: "Access denied",
      message: "You don't have permission to do this.",
      severity: "error",
      retryable: false,
    },
  },
];

/**
 * Convert a technical error to a user-friendly error
 */
export function toUserFriendlyError(
  error: unknown,
  context?: { action?: string; includeDetails?: boolean },
): UserFriendlyError {
  const technicalMessage = getErrorMessage(error);
  const category = categorizeUserFriendlyError(error);
  const baseError = { ...ERROR_MESSAGES[category] };

  // Check for specific error patterns
  for (const { pattern, error: specificError } of SPECIFIC_ERROR_PATTERNS) {
    const matches =
      typeof pattern === "function"
        ? pattern(error)
        : pattern.test(technicalMessage);

    if (matches) {
      return {
        ...baseError,
        ...specificError,
        recoveryActions:
          specificError.recoveryActions || baseError.recoveryActions,
        technical: context?.includeDetails ? technicalMessage : undefined,
      };
    }
  }

  // Add action context if provided
  if (context?.action) {
    baseError.message = getContextualMessage(category, context.action);
  }

  return {
    ...baseError,
    technical: context?.includeDetails ? technicalMessage : undefined,
  };
}

/**
 * Get contextual error message based on the action being performed
 */
function getContextualMessage(
  category: FriendlyErrorCategory,
  action: string,
): string {
  const actionMessages: Record<
    FriendlyErrorCategory,
    Record<string, string>
  > = {
    network: {
      post: "Couldn't send your post. Check your connection and try again.",
      like: "Couldn't like this post. Check your connection.",
      repost: "Couldn't repost. Check your connection.",
      follow: "Couldn't follow this user. Check your connection.",
      load: "Couldn't load content. Check your connection.",
      default: "Connection issue. Please try again.",
    },
    auth: {
      post: "You need to log in again to post.",
      default: "Please log in again to continue.",
    },
    "rate-limit": {
      post: "You're posting too fast. Wait a moment.",
      like: "You're liking too fast. Slow down a bit.",
      follow: "You're following too fast. Wait a moment.",
      default: "Please wait a moment before trying again.",
    },
    validation: {
      post: "There's a problem with your post. Please check and try again.",
      default: "Please check your input and try again.",
    },
    server: {
      default: "Bluesky is having trouble. Try again in a few minutes.",
    },
    offline: {
      post: "You're offline. Your post will be sent when you're back online.",
      default: "You're offline. Changes will sync when connected.",
    },
    unknown: {
      default: "Something went wrong. Please try again.",
    },
  };

  const categoryMessages = actionMessages[category];
  return categoryMessages[action] || categoryMessages.default;
}

/**
 * Get a simple, one-line error message for inline display
 */
export function getSimpleErrorMessage(error: unknown): string {
  const friendly = toUserFriendlyError(error);
  return friendly.message;
}

/**
 * Get error severity for styling purposes
 */
export function getErrorSeverity(error: unknown): "error" | "warning" | "info" {
  const category = categorizeUserFriendlyError(error);
  return ERROR_MESSAGES[category].severity;
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  const category = categorizeUserFriendlyError(error);
  return ERROR_MESSAGES[category].retryable;
}

/**
 * Format retry wait time for display
 */
export function formatWaitTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} second${seconds !== 1 ? "s" : ""}`;
  }
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
}

/**
 * Map legacy ErrorCategory to FriendlyErrorCategory
 */
export function mapErrorCategory(
  category: ErrorCategory,
): FriendlyErrorCategory {
  switch (category) {
    case "auth":
      return "auth";
    case "network":
      return "network";
    case "rate-limit":
      return "rate-limit";
    case "validation":
      return "validation";
    default:
      return "unknown";
  }
}
