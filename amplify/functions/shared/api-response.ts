/**
 * Shared API Response Utilities
 *
 * Provides standardized error response formatting, CORS headers management,
 * and request correlation IDs for consistent API behavior across all endpoints.
 *
 * Standard Error Format:
 * {
 *   error: {
 *     code: "ERROR_CODE",
 *     message: "Human-readable error message",
 *     details?: any,
 *     correlationId: "uuid-v4"
 *   }
 * }
 *
 * Features:
 * - Consistent error response format across all endpoints
 * - Automatic CORS headers with configurable origin validation
 * - Request correlation IDs for debugging and log tracing
 * - Type-safe error codes
 * - Helper functions for common error scenarios
 */

import * as crypto from "crypto";

/**
 * Standard error codes for API responses
 */
export const ErrorCodes = {
  // Client errors (4xx)
  BAD_REQUEST: "BAD_REQUEST",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  MISSING_PARAMETER: "MISSING_PARAMETER",
  INVALID_PARAMETER: "INVALID_PARAMETER",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  METHOD_NOT_ALLOWED: "METHOD_NOT_ALLOWED",
  RATE_LIMITED: "RATE_LIMITED",

  // Server errors (5xx)
  INTERNAL_ERROR: "INTERNAL_ERROR",
  CONFIG_ERROR: "CONFIG_ERROR",
  EXTERNAL_API_ERROR: "EXTERNAL_API_ERROR",
  TIMEOUT: "TIMEOUT",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/**
 * Standard error response structure
 */
export interface ApiError {
  code: ErrorCode;
  message: string;
  details?: unknown;
  correlationId: string;
}

/**
 * Standard API response body for errors
 */
export interface ErrorResponseBody {
  error: ApiError;
}

/**
 * Lambda response structure
 */
export interface LambdaResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

/**
 * CORS configuration
 */
export interface CorsConfig {
  /** Allowed origins (can be specific URLs or '*' for all) */
  allowedOrigins: string[];
  /** Additional allowed headers beyond defaults */
  allowedHeaders?: string[];
  /** Additional allowed methods beyond defaults */
  allowedMethods?: string[];
  /** Whether to include Access-Control-Allow-Credentials */
  allowCredentials?: boolean;
}

/**
 * Default CORS configuration
 */
export const DEFAULT_CORS_CONFIG: CorsConfig = {
  allowedOrigins: [
    "https://main.shadowsky.io",
    "https://shadowsky.io",
    "https://www.shadowsky.io",
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://localhost:5176",
  ],
  allowedHeaders: ["Content-Type", "Authorization"],
  allowedMethods: ["POST", "OPTIONS"],
  allowCredentials: false,
};

/**
 * Generate a unique correlation ID for request tracing
 * Format: timestamp-random (e.g., "1699876543210-a1b2c3d4")
 */
export function generateCorrelationId(): string {
  const timestamp = Date.now();
  const random = crypto.randomBytes(4).toString("hex");
  return `${timestamp}-${random}`;
}

/**
 * Extract or generate correlation ID from Lambda event
 * Checks for existing correlation ID in headers first
 */
export function getCorrelationId(event: any): string {
  // Check for existing correlation ID in common header formats
  const existingId =
    event.headers?.["x-correlation-id"] ||
    event.headers?.["X-Correlation-Id"] ||
    event.headers?.["x-request-id"] ||
    event.headers?.["X-Request-Id"] ||
    event.requestContext?.requestId;

  return existingId || generateCorrelationId();
}

/**
 * Get the origin from Lambda event headers
 */
export function getRequestOrigin(event: any): string {
  return event.headers?.origin || event.headers?.Origin || "";
}

/**
 * Build CORS headers based on request origin and configuration
 */
export function buildCorsHeaders(
  requestOrigin: string,
  config: CorsConfig = DEFAULT_CORS_CONFIG,
): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Headers":
      config.allowedHeaders?.join(",") || "Content-Type,Authorization",
    "Access-Control-Allow-Methods":
      config.allowedMethods?.join(",") || "POST,OPTIONS",
  };

  // Determine the appropriate Access-Control-Allow-Origin value
  if (config.allowedOrigins.includes("*")) {
    headers["Access-Control-Allow-Origin"] = "*";
  } else if (config.allowedOrigins.includes(requestOrigin)) {
    headers["Access-Control-Allow-Origin"] = requestOrigin;
  } else if (requestOrigin.match(/^https?:\/\/.*\.shadowsky\.io$/)) {
    // Allow any subdomain of shadowsky.io
    headers["Access-Control-Allow-Origin"] = requestOrigin;
  } else {
    // Default to first allowed origin if request origin not recognized
    headers["Access-Control-Allow-Origin"] = config.allowedOrigins[0] || "*";
  }

  if (config.allowCredentials) {
    headers["Access-Control-Allow-Credentials"] = "true";
  }

  return headers;
}

/**
 * Create an OPTIONS response for CORS preflight requests
 */
export function createOptionsResponse(
  event: any,
  config: CorsConfig = DEFAULT_CORS_CONFIG,
): LambdaResponse {
  const origin = getRequestOrigin(event);
  return {
    statusCode: 200,
    headers: buildCorsHeaders(origin, config),
    body: "",
  };
}

/**
 * Create a standardized error response
 */
export function createErrorResponse(
  statusCode: number,
  code: ErrorCode,
  message: string,
  event: any,
  options?: {
    details?: unknown;
    correlationId?: string;
    corsConfig?: CorsConfig;
  },
): LambdaResponse {
  const correlationId = options?.correlationId || getCorrelationId(event);
  const origin = getRequestOrigin(event);
  const headers = buildCorsHeaders(origin, options?.corsConfig);

  // Add correlation ID to response headers for easy access
  headers["X-Correlation-Id"] = correlationId;

  const errorBody: ErrorResponseBody = {
    error: {
      code,
      message,
      correlationId,
      ...(options?.details !== undefined && { details: options.details }),
    },
  };

  return {
    statusCode,
    headers,
    body: JSON.stringify(errorBody),
  };
}

/**
 * Create a standardized success response
 */
export function createSuccessResponse<T>(
  data: T,
  event: any,
  options?: {
    statusCode?: number;
    correlationId?: string;
    corsConfig?: CorsConfig;
  },
): LambdaResponse {
  const correlationId = options?.correlationId || getCorrelationId(event);
  const origin = getRequestOrigin(event);
  const headers = buildCorsHeaders(origin, options?.corsConfig);

  // Add correlation ID to response headers
  headers["X-Correlation-Id"] = correlationId;

  return {
    statusCode: options?.statusCode || 200,
    headers,
    body: JSON.stringify(data),
  };
}

// ============================================================================
// Common Error Response Helpers
// ============================================================================

/**
 * Create a 400 Bad Request response for missing required parameters
 */
export function createMissingParameterError(
  paramName: string,
  event: any,
  correlationId?: string,
): LambdaResponse {
  return createErrorResponse(
    400,
    ErrorCodes.MISSING_PARAMETER,
    `Missing required parameter: ${paramName}`,
    event,
    {
      details: { parameter: paramName },
      correlationId,
    },
  );
}

/**
 * Create a 400 Bad Request response for invalid parameters
 */
export function createInvalidParameterError(
  paramName: string,
  reason: string,
  event: any,
  correlationId?: string,
): LambdaResponse {
  return createErrorResponse(
    400,
    ErrorCodes.INVALID_PARAMETER,
    `Invalid parameter '${paramName}': ${reason}`,
    event,
    {
      details: { parameter: paramName, reason },
      correlationId,
    },
  );
}

/**
 * Create a 400 Bad Request response for validation errors
 */
export function createValidationError(
  message: string,
  details: unknown,
  event: any,
  correlationId?: string,
): LambdaResponse {
  return createErrorResponse(400, ErrorCodes.VALIDATION_ERROR, message, event, {
    details,
    correlationId,
  });
}

/**
 * Create a 500 Internal Server Error response for configuration issues
 */
export function createConfigError(
  configItem: string,
  event: any,
  correlationId?: string,
): LambdaResponse {
  return createErrorResponse(
    500,
    ErrorCodes.CONFIG_ERROR,
    `Server configuration error: ${configItem} not configured`,
    event,
    {
      details: { configItem },
      correlationId,
    },
  );
}

/**
 * Create a 500 error response for external API failures
 */
export function createExternalApiError(
  apiName: string,
  errorMessage: string,
  event: any,
  correlationId?: string,
): LambdaResponse {
  return createErrorResponse(
    500,
    ErrorCodes.EXTERNAL_API_ERROR,
    `External API error (${apiName}): ${errorMessage}`,
    event,
    {
      details: { api: apiName },
      correlationId,
    },
  );
}

/**
 * Create a 500 error response for internal server errors
 */
export function createInternalError(
  error: unknown,
  event: any,
  correlationId?: string,
): LambdaResponse {
  const message =
    error instanceof Error ? error.message : "Internal server error";
  return createErrorResponse(500, ErrorCodes.INTERNAL_ERROR, message, event, {
    correlationId,
  });
}

/**
 * Create a 504 timeout error response
 */
export function createTimeoutError(
  operation: string,
  event: any,
  correlationId?: string,
): LambdaResponse {
  return createErrorResponse(
    504,
    ErrorCodes.TIMEOUT,
    `Operation timed out: ${operation}`,
    event,
    {
      details: { operation },
      correlationId,
    },
  );
}

/**
 * Create a 429 rate limit error response
 */
export function createRateLimitError(
  retryAfterSeconds?: number,
  event?: any,
  correlationId?: string,
): LambdaResponse {
  const headers = event
    ? buildCorsHeaders(getRequestOrigin(event))
    : { "Content-Type": "application/json" };
  const corrId = correlationId || generateCorrelationId();

  if (retryAfterSeconds) {
    headers["Retry-After"] = String(retryAfterSeconds);
  }
  headers["X-Correlation-Id"] = corrId;

  return {
    statusCode: 429,
    headers,
    body: JSON.stringify({
      error: {
        code: ErrorCodes.RATE_LIMITED,
        message: retryAfterSeconds
          ? `Rate limit exceeded. Retry after ${retryAfterSeconds} seconds`
          : "Rate limit exceeded",
        correlationId: corrId,
        ...(retryAfterSeconds && { details: { retryAfterSeconds } }),
      },
    }),
  };
}

// ============================================================================
// JSON Utility Functions
// ============================================================================

/**
 * Helper function to strip markdown code fences from JSON responses
 * (Commonly needed when parsing Anthropic API JSON output)
 */
export function cleanJsonResponse(text: string): string {
  let cleaned = text.trim();

  // Remove ```json or ``` at the start
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }

  // Remove ``` at the end
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }

  return cleaned.trim();
}

/**
 * Safely parse JSON body from Lambda event
 * Returns the parsed body or null if parsing fails
 */
export function parseEventBody<T = Record<string, unknown>>(
  event: any,
): T | null {
  try {
    return JSON.parse(event.body || "{}") as T;
  } catch {
    return null;
  }
}

/**
 * Get HTTP method from Lambda event (supports both v1 and v2 formats)
 */
export function getHttpMethod(event: any): string {
  return event.requestContext?.http?.method || event.httpMethod || "UNKNOWN";
}

/**
 * Check if the request is a CORS preflight OPTIONS request
 */
export function isOptionsRequest(event: any): boolean {
  return getHttpMethod(event) === "OPTIONS";
}

// ============================================================================
// Logging Helpers
// ============================================================================

/**
 * Log an error with correlation ID for easy tracing
 */
export function logError(
  context: string,
  error: unknown,
  correlationId: string,
  additionalInfo?: Record<string, unknown>,
): void {
  console.error(
    JSON.stringify({
      level: "ERROR",
      context,
      correlationId,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      ...additionalInfo,
      timestamp: new Date().toISOString(),
    }),
  );
}

/**
 * Log a warning with correlation ID
 */
export function logWarning(
  context: string,
  message: string,
  correlationId: string,
  additionalInfo?: Record<string, unknown>,
): void {
  console.warn(
    JSON.stringify({
      level: "WARN",
      context,
      correlationId,
      message,
      ...additionalInfo,
      timestamp: new Date().toISOString(),
    }),
  );
}

/**
 * Log info with correlation ID
 */
export function logInfo(
  context: string,
  message: string,
  correlationId: string,
  additionalInfo?: Record<string, unknown>,
): void {
  console.log(
    JSON.stringify({
      level: "INFO",
      context,
      correlationId,
      message,
      ...additionalInfo,
      timestamp: new Date().toISOString(),
    }),
  );
}
