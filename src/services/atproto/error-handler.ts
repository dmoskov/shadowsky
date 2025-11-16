/**
 * Standardized error handling for AT Protocol API calls
 *
 * Provides consistent error response format: { code, message, context, retryable }
 * Maps AT Protocol errors to this standard format with detailed context
 */

import { createLogger } from "../../utils/logger";

const logger = createLogger("ATProtoErrorHandler");

/**
 * Error codes for AT Protocol operations
 */
export enum ATProtoErrorCode {
  // Authentication errors
  AUTH_MISSING_TOKEN = "AUTH_MISSING_TOKEN",
  AUTH_INVALID_TOKEN = "AUTH_INVALID_TOKEN",
  AUTH_EXPIRED_TOKEN = "AUTH_EXPIRED_TOKEN",

  // Network errors
  NETWORK_TIMEOUT = "NETWORK_TIMEOUT",
  NETWORK_CONNECTION = "NETWORK_CONNECTION",
  NETWORK_DNS = "NETWORK_DNS",

  // Rate limiting errors
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
  RATE_LIMIT_QUOTA = "RATE_LIMIT_QUOTA",

  // Validation errors
  VALIDATION_SCHEMA = "VALIDATION_SCHEMA",
  VALIDATION_INPUT = "VALIDATION_INPUT",
  VALIDATION_CONTRACT = "VALIDATION_CONTRACT",

  // Video processing errors
  VIDEO_UPLOAD_FAILED = "VIDEO_UPLOAD_FAILED",
  VIDEO_PROCESSING_FAILED = "VIDEO_PROCESSING_FAILED",
  VIDEO_PROCESSING_TIMEOUT = "VIDEO_PROCESSING_TIMEOUT",
  VIDEO_INVALID_FORMAT = "VIDEO_INVALID_FORMAT",
  VIDEO_SIZE_EXCEEDED = "VIDEO_SIZE_EXCEEDED",

  // Server errors
  SERVER_INTERNAL = "SERVER_INTERNAL",
  SERVER_UNAVAILABLE = "SERVER_UNAVAILABLE",
  SERVER_OVERLOADED = "SERVER_OVERLOADED",

  // Client errors
  CLIENT_BAD_REQUEST = "CLIENT_BAD_REQUEST",
  CLIENT_FORBIDDEN = "CLIENT_FORBIDDEN",
  CLIENT_NOT_FOUND = "CLIENT_NOT_FOUND",

  // Unknown errors
  UNKNOWN = "UNKNOWN",
}

/**
 * Standardized error response format
 */
export interface StandardErrorResponse {
  code: ATProtoErrorCode;
  message: string;
  context: {
    endpoint?: string;
    uploadId?: string;
    jobId?: string;
    status?: number;
    originalError?: string;
    timestamp: string;
    [key: string]: any;
  };
  retryable: boolean;
}

/**
 * Create a standardized error response
 */
export function createErrorResponse(
  code: ATProtoErrorCode,
  message: string,
  context: Record<string, any> = {},
  retryable: boolean = false,
): StandardErrorResponse {
  return {
    code,
    message,
    context: {
      ...context,
      timestamp: new Date().toISOString(),
    },
    retryable,
  };
}

/**
 * Map AT Protocol errors to standardized format
 */
export function mapATProtoError(
  error: any,
  endpoint?: string,
  additionalContext: Record<string, any> = {},
): StandardErrorResponse {
  const status = error?.status || error?.response?.status;
  const originalMessage =
    error?.message || error?.response?.data?.message || "Unknown error";

  const context = {
    endpoint,
    status,
    originalError: originalMessage,
    ...additionalContext,
  };

  // Authentication errors (401)
  if (status === 401) {
    if (originalMessage.toLowerCase().includes("token")) {
      if (originalMessage.toLowerCase().includes("expired")) {
        return createErrorResponse(
          ATProtoErrorCode.AUTH_EXPIRED_TOKEN,
          "Authentication token has expired. Please log in again.",
          context,
          false,
        );
      }
      return createErrorResponse(
        ATProtoErrorCode.AUTH_INVALID_TOKEN,
        "Authentication token is invalid. Please log in again.",
        context,
        false,
      );
    }
    return createErrorResponse(
      ATProtoErrorCode.AUTH_MISSING_TOKEN,
      "Authentication required. Please log in.",
      context,
      false,
    );
  }

  // Forbidden errors (403)
  if (status === 403) {
    return createErrorResponse(
      ATProtoErrorCode.CLIENT_FORBIDDEN,
      "Access forbidden. You don't have permission to perform this action.",
      context,
      false,
    );
  }

  // Not found errors (404)
  if (status === 404) {
    return createErrorResponse(
      ATProtoErrorCode.CLIENT_NOT_FOUND,
      "Resource not found.",
      context,
      false,
    );
  }

  // Rate limit errors (429)
  if (status === 429 || originalMessage.toLowerCase().includes("rate limit")) {
    const retryAfter = error?.headers?.["retry-after"];
    return createErrorResponse(
      ATProtoErrorCode.RATE_LIMIT_EXCEEDED,
      retryAfter
        ? `Rate limit exceeded. Please try again in ${retryAfter} seconds.`
        : "Rate limit exceeded. Please try again later.",
      { ...context, retryAfter },
      true,
    );
  }

  // Bad request errors (400)
  if (status === 400) {
    if (originalMessage.toLowerCase().includes("validation")) {
      return createErrorResponse(
        ATProtoErrorCode.VALIDATION_INPUT,
        `Invalid input: ${originalMessage}`,
        context,
        false,
      );
    }
    return createErrorResponse(
      ATProtoErrorCode.CLIENT_BAD_REQUEST,
      `Bad request: ${originalMessage}`,
      context,
      false,
    );
  }

  // Server errors (500-599)
  if (status >= 500) {
    if (status === 503) {
      return createErrorResponse(
        ATProtoErrorCode.SERVER_UNAVAILABLE,
        "Service temporarily unavailable. Please try again later.",
        context,
        true,
      );
    }
    if (originalMessage.toLowerCase().includes("overload")) {
      return createErrorResponse(
        ATProtoErrorCode.SERVER_OVERLOADED,
        "Server is currently overloaded. Please try again later.",
        context,
        true,
      );
    }
    return createErrorResponse(
      ATProtoErrorCode.SERVER_INTERNAL,
      "Internal server error. Please try again later.",
      context,
      true,
    );
  }

  // Network errors
  if (error instanceof TypeError) {
    if (originalMessage.toLowerCase().includes("timeout")) {
      return createErrorResponse(
        ATProtoErrorCode.NETWORK_TIMEOUT,
        "Network request timed out. Please check your connection and try again.",
        context,
        true,
      );
    }
    if (originalMessage.toLowerCase().includes("dns")) {
      return createErrorResponse(
        ATProtoErrorCode.NETWORK_DNS,
        "DNS resolution failed. Please check your internet connection.",
        context,
        true,
      );
    }
    return createErrorResponse(
      ATProtoErrorCode.NETWORK_CONNECTION,
      "Network connection failed. Please check your internet connection.",
      context,
      true,
    );
  }

  // Timeout errors
  if (originalMessage.toLowerCase().includes("timeout")) {
    return createErrorResponse(
      ATProtoErrorCode.NETWORK_TIMEOUT,
      "Request timed out. Please try again.",
      context,
      true,
    );
  }

  // Video-specific errors
  if (endpoint?.includes("video")) {
    if (originalMessage.toLowerCase().includes("format")) {
      return createErrorResponse(
        ATProtoErrorCode.VIDEO_INVALID_FORMAT,
        "Invalid video format. Please use a supported format (MP4, MOV, etc.).",
        context,
        false,
      );
    }
    if (originalMessage.toLowerCase().includes("size")) {
      return createErrorResponse(
        ATProtoErrorCode.VIDEO_SIZE_EXCEEDED,
        "Video file is too large. Please use a smaller file.",
        context,
        false,
      );
    }
    if (originalMessage.toLowerCase().includes("processing")) {
      return createErrorResponse(
        ATProtoErrorCode.VIDEO_PROCESSING_FAILED,
        "Video processing failed. Please try again with a different file.",
        context,
        false,
      );
    }
  }

  // Schema validation errors
  if (originalMessage.includes("API contract validation failed")) {
    return createErrorResponse(
      ATProtoErrorCode.VALIDATION_CONTRACT,
      originalMessage,
      context,
      false,
    );
  }

  // Unknown errors
  return createErrorResponse(
    ATProtoErrorCode.UNKNOWN,
    `An unexpected error occurred: ${originalMessage}`,
    context,
    false,
  );
}

/**
 * Determine if an error is retryable
 */
export function isRetryableError(error: StandardErrorResponse | any): boolean {
  if (typeof error === "object" && "retryable" in error) {
    return error.retryable;
  }

  const status = error?.status || error?.response?.status;

  if (status === 429 || status >= 500 || status === 503) {
    return true;
  }

  if (error instanceof TypeError) {
    return true;
  }

  const message = error?.message?.toLowerCase() || "";
  if (message.includes("timeout") || message.includes("network")) {
    return true;
  }

  return false;
}

/**
 * Get user-friendly error message from standardized error
 */
export function getUserFriendlyMessage(error: StandardErrorResponse): string {
  return error.message;
}

/**
 * Log error with full context
 */
export function logError(
  error: StandardErrorResponse,
  operation: string,
): void {
  const logData = {
    operation,
    code: error.code,
    message: error.message,
    retryable: error.retryable,
    ...error.context,
  };

  if (error.retryable) {
    logger.warn(`Retryable error in ${operation}:`, logData);
  } else {
    logger.error(`Error in ${operation}:`, logData);
  }
}

/**
 * Create error from validation failure
 */
export function createValidationError(
  message: string,
  endpoint: string,
  rawResponse?: any,
): StandardErrorResponse {
  return createErrorResponse(
    ATProtoErrorCode.VALIDATION_SCHEMA,
    message,
    {
      endpoint,
      rawResponse: rawResponse ? JSON.stringify(rawResponse) : undefined,
    },
    false,
  );
}

/**
 * Create error for video processing timeout
 */
export function createVideoTimeoutError(
  uploadId: string,
  jobId?: string,
  pollingAttempts?: number,
): StandardErrorResponse {
  return createErrorResponse(
    ATProtoErrorCode.VIDEO_PROCESSING_TIMEOUT,
    "Video processing timed out. The video may still be processing. Please try again later.",
    {
      uploadId,
      jobId,
      pollingAttempts,
    },
    true,
  );
}

/**
 * Create error for video processing failure
 */
export function createVideoProcessingError(
  uploadId: string,
  jobId?: string,
  reason?: string,
): StandardErrorResponse {
  return createErrorResponse(
    ATProtoErrorCode.VIDEO_PROCESSING_FAILED,
    reason
      ? `Video processing failed: ${reason}`
      : "Video processing failed. Please try again with a different file.",
    {
      uploadId,
      jobId,
      reason,
    },
    false,
  );
}
