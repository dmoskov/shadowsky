/**
 * Structured network request logging utility
 *
 * Features:
 * - Request/response correlation IDs
 * - Timing information
 * - Success/failure categorization
 * - Automatic sensitive data redaction
 * - Structured log format for easy parsing
 */

import { getErrorMessage, getErrorStatus } from "../types/errors";
import { createLogger } from "./logger";

const logger = createLogger("NetworkRequest");

export interface NetworkLogContext {
  correlationId: string;
  method: string;
  url: string;
  timestamp: number;
  startTime: number;
  endTime?: number;
  duration?: number;
  status?: number;
  statusText?: string;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  error?: string;
  errorType?: string;
  retryAttempt?: number;
  success?: boolean;
}

const SENSITIVE_HEADER_PATTERNS = [
  /authorization/i,
  /api[_-]?key/i,
  /token/i,
  /secret/i,
  /password/i,
  /bearer/i,
  /x-api-key/i,
];

const SENSITIVE_URL_PATTERNS = [
  /api[_-]?key=/i,
  /token=/i,
  /password=/i,
  /secret=/i,
];

/**
 * Generate a unique correlation ID for tracking requests
 */
function generateCorrelationId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Redact sensitive data from headers
 */
function redactHeaders(
  headers: Record<string, string> | Headers,
): Record<string, string> {
  const redacted: Record<string, string> = {};

  const entries =
    headers instanceof Headers
      ? Array.from(headers.entries())
      : Object.entries(headers);

  for (const [key, value] of entries) {
    const isSensitive = SENSITIVE_HEADER_PATTERNS.some((pattern) =>
      pattern.test(key),
    );

    if (isSensitive) {
      redacted[key] = "[REDACTED]";
    } else {
      redacted[key] = value;
    }
  }

  return redacted;
}

/**
 * Redact sensitive data from URLs
 */
function redactUrl(url: string): string {
  let redactedUrl = url;

  for (const pattern of SENSITIVE_URL_PATTERNS) {
    redactedUrl = redactedUrl.replace(
      pattern,
      (match) => `${match.split("=")[0]}=[REDACTED]`,
    );
  }

  return redactedUrl;
}

/**
 * Extract relevant headers for logging
 */
function extractHeaders(headers?: HeadersInit): Record<string, string> {
  if (!headers) {
    return {};
  }

  if (headers instanceof Headers) {
    return redactHeaders(headers);
  }

  if (Array.isArray(headers)) {
    const headerObj: Record<string, string> = {};
    for (const [key, value] of headers) {
      headerObj[key] = value;
    }
    return redactHeaders(headerObj);
  }

  return redactHeaders(headers as Record<string, string>);
}

/**
 * Categorize error types
 */
function categorizeError(error: unknown): string {
  if (error instanceof TypeError) {
    if (error.message.includes("fetch")) {
      return "NETWORK_ERROR";
    }
    return "TYPE_ERROR";
  }

  const message = getErrorMessage(error);

  if (message.toLowerCase().includes("timeout")) {
    return "TIMEOUT_ERROR";
  }
  if (message.includes("429")) {
    return "RATE_LIMIT_ERROR";
  }
  if (message.includes("401")) {
    return "AUTH_ERROR";
  }
  if (message.includes("403")) {
    return "FORBIDDEN_ERROR";
  }
  if (message.includes("404")) {
    return "NOT_FOUND_ERROR";
  }
  if (message.includes("500") || message.includes("503")) {
    return "SERVER_ERROR";
  }

  return "UNKNOWN_ERROR";
}

/**
 * Format structured log output
 */
function formatStructuredLog(context: NetworkLogContext): string {
  const parts = [
    `[${context.correlationId}]`,
    context.method,
    redactUrl(context.url),
  ];

  if (context.success !== undefined) {
    parts.push(context.success ? "✓" : "✗");
  }

  if (context.status) {
    parts.push(`${context.status}`);
  }

  if (context.duration !== undefined) {
    parts.push(`${context.duration}ms`);
  }

  if (context.retryAttempt !== undefined && context.retryAttempt > 1) {
    parts.push(`(attempt ${context.retryAttempt})`);
  }

  if (context.error) {
    parts.push(`Error: ${context.error}`);
  }

  return parts.join(" ");
}

/**
 * Log the start of a network request
 */
export function logRequestStart(
  url: string,
  init?: RequestInit,
  retryAttempt?: number,
): NetworkLogContext {
  const correlationId = generateCorrelationId();
  const timestamp = Date.now();
  const method = init?.method || "GET";

  const context: NetworkLogContext = {
    correlationId,
    method,
    url: redactUrl(url),
    timestamp,
    startTime: performance.now(),
    requestHeaders: extractHeaders(init?.headers),
    retryAttempt,
  };

  logger.log(formatStructuredLog(context));

  return context;
}

/**
 * Log a successful network request
 */
export function logRequestSuccess(
  context: NetworkLogContext,
  response: Response,
): void {
  const endTime = performance.now();
  const duration = Math.round(endTime - context.startTime);

  const updatedContext: NetworkLogContext = {
    ...context,
    endTime,
    duration,
    status: response.status,
    statusText: response.statusText,
    responseHeaders: redactHeaders(response.headers),
    success: true,
  };

  logger.log(formatStructuredLog(updatedContext));
}

/**
 * Log a failed network request
 */
export function logRequestFailure(
  context: NetworkLogContext,
  error: unknown,
): void {
  const endTime = performance.now();
  const duration = Math.round(endTime - context.startTime);

  const updatedContext: NetworkLogContext = {
    ...context,
    endTime,
    duration,
    error: getErrorMessage(error),
    errorType: categorizeError(error),
    success: false,
  };

  const status = getErrorStatus(error);
  if (status !== undefined) {
    updatedContext.status = status;
  }

  logger.error(formatStructuredLog(updatedContext));
}

/**
 * Log retry attempt
 */
export function logRetryAttempt(
  context: NetworkLogContext,
  attempt: number,
  delayMs: number,
  error: unknown,
): void {
  const retryContext: NetworkLogContext = {
    ...context,
    retryAttempt: attempt,
    error: getErrorMessage(error),
    errorType: categorizeError(error),
  };

  logger.warn(
    `${formatStructuredLog(retryContext)} - Retrying in ${delayMs}ms`,
  );
}

/**
 * Create a wrapper for fetch that includes structured logging
 */
export async function fetchWithStructuredLogging(
  url: string,
  init?: RequestInit,
  retryAttempt?: number,
): Promise<Response> {
  const context = logRequestStart(url, init, retryAttempt);

  try {
    const response = await fetch(url, init);
    logRequestSuccess(context, response);
    return response;
  } catch (error: unknown) {
    logRequestFailure(context, error);
    throw error;
  }
}

/**
 * Helper to get correlation ID for external use
 */
export function getCorrelationId(): string {
  return generateCorrelationId();
}

/**
 * Export for testing purposes
 */
export const __test__ = {
  redactHeaders,
  redactUrl,
  categorizeError,
  formatStructuredLog,
};
