/**
 * AT Protocol error classes and categorization.
 *
 * Platform-agnostic: connectivity detection is injected via setOnlineChecker
 * (web installs `() => navigator.onLine`; mobile can use NetInfo). The default
 * checker assumes online, so without injection a status-0 error is still
 * classified as a network error but offline state is not detected.
 */

export class ATProtoError extends Error {
  status?: number;
  error?: string;

  constructor(message: string, status?: number, error?: string) {
    super(message);
    this.name = "ATProtoError";
    this.status = status;
    this.error = error;
  }
}

export class SessionExpiredError extends ATProtoError {
  constructor(message = "Session expired") {
    super(message, 401, "SessionExpired");
    this.name = "SessionExpiredError";
  }
}

export class AuthenticationError extends ATProtoError {
  constructor(message = "Authentication failed") {
    super(message, 401, "AuthenticationFailed");
    this.name = "AuthenticationError";
  }
}

export class NetworkError extends ATProtoError {
  constructor(message = "Network error") {
    super(message, 0, "NetworkError");
    this.name = "NetworkError";
  }
}

export class RateLimitError extends ATProtoError {
  retryAfter?: number;

  constructor(message = "Rate limit exceeded", retryAfter?: number) {
    super(message, 429, "RateLimitExceeded");
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
  }
}

export type OnlineChecker = () => boolean;

let isOnline: OnlineChecker = () => true;

/**
 * Install a platform-specific connectivity checker used by mapATProtoError
 * and categorizeError to distinguish network errors from server errors.
 */
export function setOnlineChecker(checker: OnlineChecker): void {
  isOnline = checker;
}

export function isRateLimitError(error: any): error is RateLimitError {
  return (
    error instanceof RateLimitError ||
    error?.status === 429 ||
    error?.error === "RateLimitExceeded"
  );
}

export function isAuthenticationError(
  error: any,
): error is AuthenticationError {
  return (
    error instanceof AuthenticationError ||
    error?.status === 401 ||
    error?.error === "AuthenticationFailed"
  );
}

export function isSessionExpiredError(
  error: any,
): error is SessionExpiredError {
  return (
    error instanceof SessionExpiredError ||
    error?.error === "SessionExpired" ||
    (error?.status === 401 && error?.message?.includes("session"))
  );
}

export function mapATProtoError(error: any): ATProtoError {
  if (error instanceof ATProtoError) {
    return error;
  }

  const status = error?.status || error?.response?.status;
  const message =
    error?.message || error?.response?.data?.message || "Unknown error";

  if (status === 429) {
    return new RateLimitError(message, error?.headers?.["retry-after"]);
  }

  if (status === 401) {
    if (message.includes("session")) {
      return new SessionExpiredError(message);
    }
    return new AuthenticationError(message);
  }

  if (!isOnline() || status === 0) {
    return new NetworkError(message);
  }

  return new ATProtoError(message, status, error?.error);
}

export type ErrorCategory =
  | "auth"
  | "network"
  | "rate-limit"
  | "validation"
  | "unknown";

export function categorizeError(error: any): ErrorCategory {
  if (isAuthenticationError(error) || isSessionExpiredError(error)) {
    return "auth";
  }
  if (isRateLimitError(error)) {
    return "rate-limit";
  }
  if (error instanceof NetworkError || !isOnline()) {
    return "network";
  }
  if (error?.status === 400) {
    return "validation";
  }
  return "unknown";
}
