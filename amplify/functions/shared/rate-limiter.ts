/**
 * Token Bucket Rate Limiter
 *
 * Implements a token bucket algorithm to prevent CloudWatch API quota exhaustion.
 * The token bucket refills at a constant rate and allows bursts up to capacity.
 *
 * Configuration:
 * - capacity: Maximum number of tokens (burst size)
 * - refillRate: Tokens added per second
 * - refillInterval: How often to refill tokens (milliseconds)
 */

export interface RateLimiterConfig {
  capacity: number;
  refillRate: number;
  refillInterval: number;
}

export interface RateLimiterMetrics {
  tokensRemaining: number;
  totalRequests: number;
  throttledRequests: number;
  lastRefill: number;
}

export class TokenBucketRateLimiter {
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
    this.tokens = config.capacity; // Start with full bucket
    this.lastRefill = Date.now();
  }

  /**
   * Refill tokens based on elapsed time
   */
  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const intervals = Math.floor(elapsed / this.refillInterval);

    if (intervals > 0) {
      const tokensToAdd = intervals * this.refillRate;
      this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
      this.lastRefill = now;
    }
  }

  /**
   * Try to consume tokens for a request
   * Returns true if tokens were available, false if throttled
   */
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

  /**
   * Wait until tokens are available (with timeout)
   */
  public async waitForTokens(
    tokensNeeded: number = 1,
    timeoutMs: number = 5000
  ): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      if (this.tryConsume(tokensNeeded)) {
        return true;
      }

      // Wait for next refill interval
      await new Promise((resolve) =>
        setTimeout(resolve, this.refillInterval)
      );
    }

    return false;
  }

  /**
   * Get current rate limiter metrics
   */
  public getMetrics(): RateLimiterMetrics {
    this.refill(); // Update tokens before returning metrics

    return {
      tokensRemaining: this.tokens,
      totalRequests: this.totalRequests,
      throttledRequests: this.throttledRequests,
      lastRefill: this.lastRefill,
    };
  }

  /**
   * Reset the rate limiter state
   */
  public reset(): void {
    this.tokens = this.capacity;
    this.lastRefill = Date.now();
    this.totalRequests = 0;
    this.throttledRequests = 0;
  }

  /**
   * Get throttle rate as percentage
   */
  public getThrottleRate(): number {
    if (this.totalRequests === 0) return 0;
    return (this.throttledRequests / this.totalRequests) * 100;
  }
}

/**
 * Default CloudWatch rate limiter configuration
 *
 * CloudWatch PutMetricData limits:
 * - 150 TPS (transactions per second) per account per region
 * - 1 MB payload limit per request
 * - 1,000 metrics per request
 *
 * Conservative default: 10 requests per second with burst capacity of 20
 */
export const DEFAULT_CLOUDWATCH_RATE_LIMIT: RateLimiterConfig = {
  capacity: 20, // Burst up to 20 requests
  refillRate: 10, // Refill 10 tokens per second
  refillInterval: 1000, // Refill every 1 second
};
