/**
 * Error Reporting Utility
 *
 * Stub implementation — Sentry has been removed.
 * Apple's native crash reporting (MetricKit / MXCrashDiagnostic) handles
 * crash telemetry. These no-op functions preserve the call-site API so
 * callers don't need changes.
 */

export interface ErrorContext {
  endpoint?: string;
  statusCode?: number;
  method?: string;
  extra?: Record<string, unknown>;
}

export interface BreadcrumbData {
  message: string;
  category: string;
  level?: string;
  data?: Record<string, unknown>;
}

export function initializeSentry(_dsn?: string): void {}

export function isSentryInitialized(): boolean {
  return false;
}

export async function setUser(_did: string | null): Promise<void> {}

export function clearUser(): void {}

export function captureException(
  error: Error | unknown,
  _context?: ErrorContext,
): void {
  if (__DEV__) {
    console.error("[ErrorReporting] captureException:", error);
  }
}

export function captureMessage(message: string, _level?: string): void {
  if (__DEV__) {
    console.warn("[ErrorReporting] captureMessage:", message);
  }
}

export function addBreadcrumb(
  _category: string,
  _message: string,
  _data?: Record<string, unknown>,
): void {}

export function startTransaction(_name: string, _op: string): null {
  return null;
}

export function startSpan(_op: string, _description: string): null {
  return null;
}

export function setTag(_key: string, _value: string): void {}

export function setTags(_tags: Record<string, string>): void {}

export function setContext(
  _name: string,
  _context: Record<string, unknown>,
): void {}
