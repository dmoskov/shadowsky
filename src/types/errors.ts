/**
 * Common error types used throughout the application
 */

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
