/**
 * User-Based Rate Limiter
 *
 * Implements per-user rate limiting for authenticated API requests.
 * Uses an in-memory sliding window approach with Lambda warm start persistence.
 *
 * Features:
 * - Per-user request tracking
 * - Sliding window rate limiting
 * - Automatic cleanup of expired entries
 * - Metrics for monitoring
 *
 * Note: For production with high traffic, consider using DynamoDB or ElastiCache
 * for distributed rate limiting across Lambda instances.
 */

import {
  buildCorsHeaders,
  ErrorCodes,
  getRequestOrigin,
  logInfo,
  logWarning,
  type LambdaResponse,
} from "./api-response";

export interface UserRateLimitConfig {
  /** Maximum requests allowed per window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Message to show when rate limited */
  message?: string;
}

interface UserRequestRecord {
  /** Timestamps of requests within the current window */
  timestamps: number[];
  /** Last cleanup timestamp */
  lastCleanup: number;
}

/**
 * Default rate limit configuration
 * 10 requests per minute per user
 */
export const DEFAULT_USER_RATE_LIMIT: UserRateLimitConfig = {
  maxRequests: 10,
  windowMs: 60000, // 1 minute
  message: "Rate limit exceeded. Please try again later.",
};

/**
 * Stricter rate limit for expensive operations
 * 5 requests per minute per user
 */
export const STRICT_USER_RATE_LIMIT: UserRateLimitConfig = {
  maxRequests: 5,
  windowMs: 60000, // 1 minute
  message: "Rate limit exceeded for this operation. Please wait before trying again.",
};

// In-memory storage for rate limiting
// Note: This is per-Lambda-instance. For distributed limiting, use DynamoDB.
const userRequests: Map<string, UserRequestRecord> = new Map();

// Metrics
let totalRequests = 0;
let throttledRequests = 0;

/**
 * Clean up expired timestamps for a user
 */
function cleanupUserRecord(record: UserRequestRecord, windowMs: number): void {
  const now = Date.now();
  const cutoff = now - windowMs;

  record.timestamps = record.timestamps.filter(ts => ts > cutoff);
  record.lastCleanup = now;
}

/**
 * Periodically clean up all expired records (runs on cleanup interval)
 */
function cleanupExpiredRecords(windowMs: number): void {
  const now = Date.now();
  const cutoff = now - windowMs;

  for (const [userId, record] of userRequests.entries()) {
    // Remove timestamps older than the window
    record.timestamps = record.timestamps.filter(ts => ts > cutoff);

    // Remove empty records
    if (record.timestamps.length === 0) {
      userRequests.delete(userId);
    }
  }
}

// Run cleanup every 5 minutes
setInterval(() => cleanupExpiredRecords(300000), 300000);

/**
 * Check if a user has exceeded their rate limit
 *
 * @param userId - Unique identifier for the user
 * @param config - Rate limit configuration
 * @returns Object with allowed status and remaining requests
 */
export function checkUserRateLimit(
  userId: string,
  config: UserRateLimitConfig = DEFAULT_USER_RATE_LIMIT
): {
  allowed: boolean;
  remaining: number;
  resetIn: number;
  retryAfter?: number;
} {
  const now = Date.now();
  const windowStart = now - config.windowMs;

  totalRequests++;

  // Get or create user record
  let record = userRequests.get(userId);
  if (!record) {
    record = {
      timestamps: [],
      lastCleanup: now,
    };
    userRequests.set(userId, record);
  }

  // Cleanup old timestamps
  if (now - record.lastCleanup > config.windowMs / 2) {
    cleanupUserRecord(record, config.windowMs);
  }

  // Count requests in current window
  const requestsInWindow = record.timestamps.filter(ts => ts > windowStart).length;

  if (requestsInWindow >= config.maxRequests) {
    throttledRequests++;

    // Calculate when the oldest request will expire
    const oldestInWindow = record.timestamps
      .filter(ts => ts > windowStart)
      .sort((a, b) => a - b)[0];
    const resetIn = oldestInWindow ? oldestInWindow + config.windowMs - now : config.windowMs;
    const retryAfter = Math.ceil(resetIn / 1000);

    return {
      allowed: false,
      remaining: 0,
      resetIn,
      retryAfter,
    };
  }

  // Add current request timestamp
  record.timestamps.push(now);

  return {
    allowed: true,
    remaining: config.maxRequests - requestsInWindow - 1,
    resetIn: config.windowMs,
  };
}

/**
 * Create a rate limit exceeded response
 */
export function createUserRateLimitResponse(
  event: any,
  correlationId: string,
  retryAfter?: number,
  message?: string
): LambdaResponse {
  const origin = getRequestOrigin(event);
  const headers = buildCorsHeaders(origin);
  headers["X-Correlation-Id"] = correlationId;

  if (retryAfter) {
    headers["Retry-After"] = String(retryAfter);
    headers["X-RateLimit-Reset"] = String(Math.floor(Date.now() / 1000) + retryAfter);
  }

  return {
    statusCode: 429,
    headers,
    body: JSON.stringify({
      error: {
        code: ErrorCodes.RATE_LIMITED,
        message: message || "Rate limit exceeded. Please try again later.",
        correlationId,
        ...(retryAfter && { details: { retryAfter } }),
      },
    }),
  };
}

/**
 * Get rate limiter metrics
 */
export function getUserRateLimiterMetrics(): {
  totalRequests: number;
  throttledRequests: number;
  throttleRate: number;
  activeUsers: number;
} {
  return {
    totalRequests,
    throttledRequests,
    throttleRate: totalRequests > 0 ? (throttledRequests / totalRequests) * 100 : 0,
    activeUsers: userRequests.size,
  };
}

/**
 * Reset metrics (useful for testing)
 */
export function resetUserRateLimiterMetrics(): void {
  totalRequests = 0;
  throttledRequests = 0;
}

/**
 * Clear all rate limit records (useful for testing)
 */
export function clearUserRateLimits(): void {
  userRequests.clear();
}

/**
 * Rate limit middleware wrapper
 * Apply to handlers that require per-user rate limiting
 */
export function withUserRateLimit(
  handler: (event: any) => Promise<LambdaResponse>,
  getUserId: (event: any) => string | null,
  config: UserRateLimitConfig = DEFAULT_USER_RATE_LIMIT
): (event: any) => Promise<LambdaResponse> {
  return async (event: any): Promise<LambdaResponse> => {
    const correlationId = event.headers?.["x-correlation-id"] || `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const userId = getUserId(event);

    if (!userId) {
      // If no user ID, allow request but log warning
      logWarning(
        "user-rate-limiter",
        "No user ID for rate limiting, allowing request",
        correlationId
      );
      return handler(event);
    }

    const result = checkUserRateLimit(userId, config);

    if (!result.allowed) {
      logInfo(
        "user-rate-limiter",
        `Rate limit exceeded for user: ${userId}`,
        correlationId,
        {
          retryAfter: result.retryAfter,
          resetIn: result.resetIn,
        }
      );

      return createUserRateLimitResponse(
        event,
        correlationId,
        result.retryAfter,
        config.message
      );
    }

    // Add rate limit headers to the response
    const response = await handler(event);

    if (response.headers) {
      response.headers["X-RateLimit-Limit"] = String(config.maxRequests);
      response.headers["X-RateLimit-Remaining"] = String(result.remaining);
      response.headers["X-RateLimit-Window"] = String(config.windowMs / 1000);
    }

    return response;
  };
}
