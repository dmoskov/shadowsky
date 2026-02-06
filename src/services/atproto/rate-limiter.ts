/**
 * Token Bucket Rate Limiter for AT Protocol Endpoints
 *
 * Implements rate limiting per endpoint type (auth, upload, feed) as they have
 * different rate limit thresholds. Uses token bucket algorithm for smooth rate limiting
 * with burst capacity.
 *
 * AT Protocol Rate Limits (approximate):
 * - Auth endpoints: 300 requests per 5 minutes
 * - Upload endpoints: 50 requests per hour
 * - Feed/query endpoints: 3000 requests per 5 minutes
 */

import { createLogger } from "../../utils/logger";

const logger = createLogger("ATProtoRateLimiter");

/**
 * Rate limiter configuration for a specific endpoint type
 */
export interface RateLimiterConfig {
  capacity: number;
  refillRate: number;
  refillInterval: number;
}

/**
 * Rate limiter metrics for monitoring
 */
export interface RateLimiterMetrics {
  tokensRemaining: number;
  totalRequests: number;
  throttledRequests: number;
  lastRefill: number;
  throttleRate: number;
}

/**
 * Endpoint types with different rate limits
 */
export enum ATProtoEndpointType {
  AUTH = "auth",
  UPLOAD = "upload",
  FEED = "feed",
  RECORD = "record",
}

/**
 * Token bucket implementation for rate limiting
 */
class TokenBucket {
  private tokens: number;
  private readonly capacity: number;
  private readonly refillRate: number;
  private readonly refillInterval: number;
  private lastRefill: number;
  private totalRequests: number = 0;
  private throttledRequests: number = 0;

  constructor(config: RateLimiterConfig) {
    this.capacity = config.capacity;
    this.refillRate = config.refillRate;
    this.refillInterval = config.refillInterval;
    this.tokens = config.capacity;
    this.lastRefill = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const intervals = Math.floor(elapsed / this.refillInterval);

    if (intervals > 0) {
      const tokensToAdd = intervals * this.refillRate;
      this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
      this.lastRefill += intervals * this.refillInterval;
    }
  }

  public tryConsume(tokensNeeded: number = 1): boolean {
    this.refill();
    this.totalRequests++;

    if (this.tokens >= tokensNeeded) {
      this.tokens -= tokensNeeded;
      return true;
    }

    this.throttledRequests++;
    return false;
  }

  public async waitForTokens(
    tokensNeeded: number = 1,
    timeoutMs: number = 5000,
  ): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      if (this.tryConsume(tokensNeeded)) {
        return true;
      }

      await new Promise((resolve) => setTimeout(resolve, this.refillInterval));
    }

    return false;
  }

  public getMetrics(): RateLimiterMetrics {
    this.refill();

    return {
      tokensRemaining: this.tokens,
      totalRequests: this.totalRequests,
      throttledRequests: this.throttledRequests,
      lastRefill: this.lastRefill,
      throttleRate:
        this.totalRequests > 0
          ? (this.throttledRequests / this.totalRequests) * 100
          : 0,
    };
  }

  public reset(): void {
    this.tokens = this.capacity;
    this.lastRefill = Date.now();
    this.totalRequests = 0;
    this.throttledRequests = 0;
  }
}

/**
 * Default rate limit configurations per endpoint type
 *
 * Auth: 300 requests per 5 minutes = 1 per second
 * Upload: 50 requests per hour = ~1 per minute
 * Feed: 3000 requests per 5 minutes = 10 per second
 * Record: 300 requests per 5 minutes = 1 per second
 */
const DEFAULT_CONFIGS: Record<ATProtoEndpointType, RateLimiterConfig> = {
  [ATProtoEndpointType.AUTH]: {
    capacity: 5,
    refillRate: 1,
    refillInterval: 1000,
  },
  [ATProtoEndpointType.UPLOAD]: {
    capacity: 3,
    refillRate: 1,
    refillInterval: 60000,
  },
  [ATProtoEndpointType.FEED]: {
    capacity: 20,
    refillRate: 10,
    refillInterval: 1000,
  },
  [ATProtoEndpointType.RECORD]: {
    capacity: 5,
    refillRate: 1,
    refillInterval: 1000,
  },
};

/**
 * Rate limiter for AT Protocol endpoints
 */
export class ATProtoRateLimiter {
  private buckets: Map<ATProtoEndpointType, TokenBucket>;
  private headerMetrics: Map<ATProtoEndpointType, RateLimitHeaderMetrics> =
    new Map();

  constructor(
    configs: Partial<Record<ATProtoEndpointType, RateLimiterConfig>> = {},
  ) {
    this.buckets = new Map();

    for (const [type, defaultConfig] of Object.entries(DEFAULT_CONFIGS)) {
      const config = configs[type as ATProtoEndpointType] || defaultConfig;
      this.buckets.set(type as ATProtoEndpointType, new TokenBucket(config));
    }
  }

  /**
   * Check if request can proceed (non-blocking)
   */
  public canProceed(
    endpointType: ATProtoEndpointType,
    tokensNeeded: number = 1,
  ): boolean {
    const bucket = this.buckets.get(endpointType);
    if (!bucket) {
      logger.warn(`Unknown endpoint type: ${endpointType}`);
      return true;
    }

    const allowed = bucket.tryConsume(tokensNeeded);

    if (!allowed) {
      logger.warn(
        `Rate limit exceeded for ${endpointType} endpoint`,
        bucket.getMetrics(),
      );
    }

    return allowed;
  }

  /**
   * Wait for rate limit to allow request (blocking with timeout)
   */
  public async waitForAllowance(
    endpointType: ATProtoEndpointType,
    tokensNeeded: number = 1,
    timeoutMs: number = 5000,
  ): Promise<boolean> {
    const bucket = this.buckets.get(endpointType);
    if (!bucket) {
      logger.warn(`Unknown endpoint type: ${endpointType}`);
      return true;
    }

    const allowed = await bucket.waitForTokens(tokensNeeded, timeoutMs);

    if (!allowed) {
      logger.error(
        `Rate limit timeout for ${endpointType} endpoint after ${timeoutMs}ms`,
      );
    }

    return allowed;
  }

  /**
   * Track rate limit headers from API response
   */
  public trackRateLimitHeaders(
    endpointType: ATProtoEndpointType,
    headers: {
      limit?: number;
      remaining?: number;
      resetTimestamp?: number;
    },
  ): void {
    this.headerMetrics.set(endpointType, {
      ...headers,
      timestamp: Date.now(),
    });

    logger.log(`Rate limit headers for ${endpointType}:`, headers);
  }

  /**
   * Get metrics for all endpoints
   */
  public getAllMetrics(): Record<
    string,
    RateLimiterMetrics & { headerMetrics?: RateLimitHeaderMetrics }
  > {
    const metrics: Record<string, any> = {};

    for (const [type, bucket] of this.buckets.entries()) {
      const bucketMetrics = bucket.getMetrics();
      const headerMetrics = this.headerMetrics.get(type);

      metrics[type] = {
        ...bucketMetrics,
        ...(headerMetrics ? { headerMetrics } : {}),
      };
    }

    return metrics;
  }

  /**
   * Get metrics for specific endpoint
   */
  public getMetrics(
    endpointType: ATProtoEndpointType,
  ): (RateLimiterMetrics & { headerMetrics?: RateLimitHeaderMetrics }) | null {
    const bucket = this.buckets.get(endpointType);
    if (!bucket) {
      return null;
    }

    const bucketMetrics = bucket.getMetrics();
    const headerMetrics = this.headerMetrics.get(endpointType);

    return {
      ...bucketMetrics,
      ...(headerMetrics ? { headerMetrics } : {}),
    };
  }

  /**
   * Reset rate limiter for specific endpoint
   */
  public reset(endpointType: ATProtoEndpointType): void {
    const bucket = this.buckets.get(endpointType);
    if (bucket) {
      bucket.reset();
      this.headerMetrics.delete(endpointType);
      logger.log(`Reset rate limiter for ${endpointType}`);
    }
  }

  /**
   * Reset all rate limiters
   */
  public resetAll(): void {
    for (const [type, bucket] of this.buckets.entries()) {
      bucket.reset();
      this.headerMetrics.delete(type);
    }
    logger.log("Reset all rate limiters");
  }
}

/**
 * Rate limit metrics from API response headers
 */
interface RateLimitHeaderMetrics {
  limit?: number;
  remaining?: number;
  resetTimestamp?: number;
  timestamp: number;
}

/**
 * Singleton instance for global rate limiting
 */
let globalRateLimiter: ATProtoRateLimiter | null = null;

/**
 * Get global rate limiter instance
 */
export function getGlobalRateLimiter(): ATProtoRateLimiter {
  if (!globalRateLimiter) {
    globalRateLimiter = new ATProtoRateLimiter();
  }
  return globalRateLimiter;
}

/**
 * Reset global rate limiter (useful for testing)
 */
export function resetGlobalRateLimiter(): void {
  globalRateLimiter = null;
}
