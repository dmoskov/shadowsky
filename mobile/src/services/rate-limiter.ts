/**
 * Token Bucket Rate Limiter for AT Protocol Endpoints (Mobile)
 *
 * Implements rate limiting per endpoint type to prevent HTTP 429 errors.
 * Uses token bucket algorithm for smooth rate limiting with burst capacity.
 *
 * Features:
 * - Per-endpoint-type limits (AUTH, FEED, RECORD, UPLOAD, NOTIFICATION)
 * - Request queuing when rate limited
 * - Rate limit header parsing from API responses
 * - Adaptive throttling on repeated 429 errors with circuit breaker
 * - Circuit breaker probes for early recovery from adaptive mode
 * - Comprehensive metrics tracking
 */

import { createLogger } from '../utils/logger';

const logger = createLogger('RateLimiter');

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
  queuedRequests: number;
  averageWaitTime: number;
  lastRefill: number;
  throttleRate: number;
}

/**
 * Endpoint types with different rate limits
 */
export enum ATProtoEndpointType {
  AUTH = 'auth',
  FEED = 'feed',
  RECORD = 'record',
  UPLOAD = 'upload',
  NOTIFICATION = 'notification',
}

/**
 * Rate limit information from API response headers
 */
export interface RateLimitHeaders {
  limit?: number;
  remaining?: number;
  reset?: number; // Unix timestamp
  retryAfter?: number; // Seconds to wait
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
  private queuedRequests: number = 0;
  private waitTimes: number[] = [];
  private queue: Array<{
    resolve: () => void;
    reject: (error: Error) => void;
    enqueuedAt: number;
    timeout: ReturnType<typeof setTimeout>;
  }> = [];

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

  private processQueue(): void {
    if (this.queue.length === 0) return;

    this.refill();

    while (this.queue.length > 0 && this.tokens >= 1) {
      const item = this.queue.shift();
      if (!item) break;

      clearTimeout(item.timeout);
      this.tokens -= 1;

      // Track wait time
      const waitTime = Date.now() - item.enqueuedAt;
      this.waitTimes.push(waitTime);
      if (this.waitTimes.length > 100) {
        this.waitTimes.shift(); // Keep last 100 samples
      }

      this.queuedRequests--;
      item.resolve();
    }

    // Schedule next queue processing if items remain
    if (this.queue.length > 0) {
      const timeUntilNextToken = this.refillInterval;
      setTimeout(() => this.processQueue(), timeUntilNextToken);
    }
  }

  public async acquire(timeoutMs: number = 30000): Promise<void> {
    this.refill();
    this.totalRequests++;

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }

    // Need to queue the request
    this.throttledRequests++;
    this.queuedRequests++;

    return new Promise<void>((resolve, reject) => {
      const enqueuedAt = Date.now();

      const timeout = setTimeout(() => {
        // Remove from queue and reject
        const index = this.queue.findIndex((item) => item.resolve === resolve);
        if (index !== -1) {
          this.queue.splice(index, 1);
          this.queuedRequests--;
          reject(
            new Error(
              `Rate limit queue timeout after ${timeoutMs}ms. Too many concurrent requests.`
            )
          );
        }
      }, timeoutMs);

      this.queue.push({
        resolve,
        reject,
        enqueuedAt,
        timeout,
      });

      // Start processing queue
      this.processQueue();
    });
  }

  public getMetrics(): RateLimiterMetrics {
    this.refill();

    const averageWaitTime =
      this.waitTimes.length > 0
        ? this.waitTimes.reduce((a, b) => a + b, 0) / this.waitTimes.length
        : 0;

    return {
      tokensRemaining: Math.floor(this.tokens * 10) / 10,
      totalRequests: this.totalRequests,
      throttledRequests: this.throttledRequests,
      queuedRequests: this.queuedRequests,
      averageWaitTime: Math.round(averageWaitTime),
      lastRefill: this.lastRefill,
      throttleRate:
        this.totalRequests > 0
          ? Math.round((this.throttledRequests / this.totalRequests) * 100)
          : 0,
    };
  }

  public reset(): void {
    this.tokens = this.capacity;
    this.lastRefill = Date.now();
    this.totalRequests = 0;
    this.throttledRequests = 0;
    this.queuedRequests = 0;
    this.waitTimes = [];

    // Clear queue and reject all pending requests
    while (this.queue.length > 0) {
      const item = this.queue.shift();
      if (item) {
        clearTimeout(item.timeout);
        item.reject(new Error('Rate limiter reset'));
      }
    }
  }

  public updateCapacity(newCapacity: number): void {
    this.tokens = Math.min(this.tokens, newCapacity);
  }
}

/**
 * Circuit breaker states for adaptive rate limiting
 */
export enum CircuitBreakerState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open',
}

const CIRCUIT_BREAKER_INITIAL_PROBE_MS = 30_000;
const CIRCUIT_BREAKER_MAX_PROBE_MS = 5 * 60 * 1000;
const CIRCUIT_BREAKER_BACKOFF_MULTIPLIER = 2;

/**
 * Adaptive rate limiting state with circuit breaker
 */
interface AdaptiveState {
  recent429Count: number;
  last429Timestamp: number;
  adaptiveModeUntil: number;
  originalConfigs: Map<ATProtoEndpointType, RateLimiterConfig>;
  circuitState: CircuitBreakerState;
  probeScheduledAt: number;
  currentProbeIntervalMs: number;
  probeTimer: ReturnType<typeof setTimeout> | null;
  consecutiveProbeFailures: number;
}

/**
 * Default rate limit configurations per endpoint type
 *
 * Based on task requirements:
 * - AUTH: 5 req/min (login, refresh)
 * - FEED: 30 req/min (timeline, author feed, search)
 * - RECORD: 20 req/min (like, repost, follow, create post)
 * - UPLOAD: 10 req/min (image upload)
 * - NOTIFICATION: 15 req/min (list notifications, unread count)
 */
const DEFAULT_CONFIGS: Record<ATProtoEndpointType, RateLimiterConfig> = {
  [ATProtoEndpointType.AUTH]: {
    capacity: 5,
    refillRate: 1,
    refillInterval: 12000, // 5 per minute = 1 per 12 seconds
  },
  [ATProtoEndpointType.FEED]: {
    capacity: 30,
    refillRate: 1,
    refillInterval: 2000, // 30 per minute = 1 per 2 seconds
  },
  [ATProtoEndpointType.RECORD]: {
    capacity: 20,
    refillRate: 1,
    refillInterval: 3000, // 20 per minute = 1 per 3 seconds
  },
  [ATProtoEndpointType.UPLOAD]: {
    capacity: 10,
    refillRate: 1,
    refillInterval: 6000, // 10 per minute = 1 per 6 seconds
  },
  [ATProtoEndpointType.NOTIFICATION]: {
    capacity: 15,
    refillRate: 1,
    refillInterval: 4000, // 15 per minute = 1 per 4 seconds
  },
};

/**
 * Rate limiter for AT Protocol endpoints
 */
export class ATProtoRateLimiter {
  private buckets: Map<ATProtoEndpointType, TokenBucket>;
  private headerMetrics: Map<ATProtoEndpointType, RateLimitHeaders> = new Map();
  private adaptiveState: AdaptiveState;
  private configs: Record<ATProtoEndpointType, RateLimiterConfig>;

  constructor(
    configs: Partial<Record<ATProtoEndpointType, RateLimiterConfig>> = {}
  ) {
    this.buckets = new Map();
    this.configs = {...DEFAULT_CONFIGS, ...configs};

    Object.entries(this.configs).forEach(([type, config]) => {
      this.buckets.set(type as ATProtoEndpointType, new TokenBucket(config));
    });

    this.adaptiveState = {
      recent429Count: 0,
      last429Timestamp: 0,
      adaptiveModeUntil: 0,
      originalConfigs: new Map(),
      circuitState: CircuitBreakerState.CLOSED,
      probeScheduledAt: 0,
      currentProbeIntervalMs: CIRCUIT_BREAKER_INITIAL_PROBE_MS,
      probeTimer: null,
      consecutiveProbeFailures: 0,
    };
  }

  /**
   * Check if currently in adaptive mode (reduced limits due to 429s)
   */
  private isInAdaptiveMode(): boolean {
    return Date.now() < this.adaptiveState.adaptiveModeUntil;
  }

  /**
   * Enable adaptive mode: reduce all limits by 50% and schedule circuit breaker probe
   */
  private enableAdaptiveMode(): void {
    if (this.isInAdaptiveMode()) {
      // Already in adaptive mode — if a probe just failed, don't reset the timer
      // just extend the outer deadline
      this.adaptiveState.adaptiveModeUntil = Date.now() + CIRCUIT_BREAKER_MAX_PROBE_MS;
      return;
    }

    logger.log('Enabling adaptive mode with circuit breaker: reducing all limits by 50%');

    // Save original configs
    this.adaptiveState.originalConfigs.clear();
    Object.entries(this.configs).forEach(([type, config]) => {
      this.adaptiveState.originalConfigs.set(type as ATProtoEndpointType, {
        ...config,
      });
    });

    // Reduce all limits by 50%
    Array.from(this.buckets.entries()).forEach(([type, bucket]) => {
      const originalConfig = this.configs[type];
      const reducedCapacity = Math.max(1, Math.floor(originalConfig.capacity / 2));
      bucket.updateCapacity(reducedCapacity);
    });

    this.adaptiveState.adaptiveModeUntil = Date.now() + CIRCUIT_BREAKER_MAX_PROBE_MS;
    this.adaptiveState.circuitState = CircuitBreakerState.OPEN;
    this.adaptiveState.currentProbeIntervalMs = CIRCUIT_BREAKER_INITIAL_PROBE_MS;
    this.adaptiveState.consecutiveProbeFailures = 0;

    this.scheduleProbe();
  }

  /**
   * Disable adaptive mode: restore original limits and reset circuit breaker
   */
  private disableAdaptiveMode(): void {
    if (!this.isInAdaptiveMode() && this.adaptiveState.circuitState === CircuitBreakerState.CLOSED) {
      return;
    }

    logger.log('Disabling adaptive mode: restoring original limits');

    // Clear any pending probe timer
    if (this.adaptiveState.probeTimer !== null) {
      clearTimeout(this.adaptiveState.probeTimer);
      this.adaptiveState.probeTimer = null;
    }

    // Restore original capacities
    Array.from(this.adaptiveState.originalConfigs.entries()).forEach(([type, originalConfig]) => {
      const bucket = this.buckets.get(type);
      if (bucket) {
        bucket.updateCapacity(originalConfig.capacity);
      }
    });

    this.adaptiveState.adaptiveModeUntil = 0;
    this.adaptiveState.circuitState = CircuitBreakerState.CLOSED;
    this.adaptiveState.probeScheduledAt = 0;
    this.adaptiveState.consecutiveProbeFailures = 0;
    this.adaptiveState.originalConfigs.clear();
  }

  /**
   * Schedule a circuit breaker probe to test if the server has recovered
   */
  private scheduleProbe(): void {
    // Clear any existing probe timer
    if (this.adaptiveState.probeTimer !== null) {
      clearTimeout(this.adaptiveState.probeTimer);
    }

    const interval = this.adaptiveState.currentProbeIntervalMs;
    this.adaptiveState.probeScheduledAt = Date.now() + interval;

    logger.log(`Circuit breaker: scheduling probe in ${interval}ms`);

    this.adaptiveState.probeTimer = setTimeout(() => {
      this.transitionToHalfOpen();
    }, interval);
  }

  /**
   * Transition circuit breaker to half-open state for probing
   */
  private transitionToHalfOpen(): void {
    if (!this.isInAdaptiveMode()) return;

    logger.log('Circuit breaker: transitioning to HALF_OPEN for probe');
    this.adaptiveState.circuitState = CircuitBreakerState.HALF_OPEN;
    this.adaptiveState.probeTimer = null;
  }

  /**
   * Report a successful request to the circuit breaker.
   * If in half-open state, this triggers recovery.
   */
  public trackSuccess(): void {
    if (this.adaptiveState.circuitState === CircuitBreakerState.HALF_OPEN) {
      logger.log('Circuit breaker: probe succeeded, restoring normal limits');
      this.adaptiveState.recent429Count = 0;
      this.disableAdaptiveMode();
    }
  }

  /**
   * Handle a probe failure: stay open and schedule next probe with backoff
   */
  private handleProbeFailure(): void {
    this.adaptiveState.consecutiveProbeFailures++;
    this.adaptiveState.circuitState = CircuitBreakerState.OPEN;

    // Exponential backoff for next probe, capped at max
    this.adaptiveState.currentProbeIntervalMs = Math.min(
      this.adaptiveState.currentProbeIntervalMs * CIRCUIT_BREAKER_BACKOFF_MULTIPLIER,
      CIRCUIT_BREAKER_MAX_PROBE_MS,
    );

    logger.log(
      `Circuit breaker: probe failed (${this.adaptiveState.consecutiveProbeFailures} consecutive). ` +
      `Next probe in ${this.adaptiveState.currentProbeIntervalMs}ms`
    );

    // Extend the adaptive mode deadline
    this.adaptiveState.adaptiveModeUntil = Date.now() + CIRCUIT_BREAKER_MAX_PROBE_MS;

    this.scheduleProbe();
  }

  /**
   * Track a 429 error and potentially enable adaptive mode.
   * If the circuit breaker is in half-open state, this counts as a probe failure.
   */
  public track429Error(endpointType: ATProtoEndpointType): void {
    const now = Date.now();

    // If we're probing (half-open), treat this as a probe failure
    if (this.adaptiveState.circuitState === CircuitBreakerState.HALF_OPEN) {
      this.adaptiveState.last429Timestamp = now;
      this.handleProbeFailure();
      return;
    }

    // Reset counter if last 429 was more than 60 seconds ago
    if (now - this.adaptiveState.last429Timestamp > 60000) {
      this.adaptiveState.recent429Count = 0;
    }

    this.adaptiveState.recent429Count++;
    this.adaptiveState.last429Timestamp = now;

    logger.log(`429 error for ${endpointType}. Recent count: ${this.adaptiveState.recent429Count}`);

    // Enable adaptive mode if 3+ 429s in 60 seconds
    if (this.adaptiveState.recent429Count >= 3) {
      this.enableAdaptiveMode();
    }
  }

  /**
   * Wait for rate limit to allow request (blocking with timeout)
   */
  public async waitForAllowance(
    endpointType: ATProtoEndpointType,
    timeoutMs: number = 30000
  ): Promise<void> {
    // Check if we need to exit adaptive mode
    if (
      this.isInAdaptiveMode() &&
      Date.now() >= this.adaptiveState.adaptiveModeUntil
    ) {
      this.disableAdaptiveMode();
    }

    const bucket = this.buckets.get(endpointType);
    if (!bucket) {
      logger.warn(`Unknown endpoint type: ${endpointType}`);
      return;
    }

    await bucket.acquire(timeoutMs);
  }

  /**
   * Track rate limit headers from API response
   */
  public trackRateLimitHeaders(
    endpointType: ATProtoEndpointType,
    headers: RateLimitHeaders
  ): void {
    this.headerMetrics.set(endpointType, {
      ...headers,
    });

    // If remaining is very low, log a warning
    if (headers.remaining !== undefined && headers.remaining < 5) {
      logger.warn(`Low rate limit remaining for ${endpointType}: ${headers.remaining}`
      );
    }
  }

  /**
   * Parse rate limit headers from response
   */
  public parseRateLimitHeaders(
    endpointType: ATProtoEndpointType,
    responseHeaders: Record<string, string>
  ): void {
    const headers: RateLimitHeaders = {};

    // Parse standard rate limit headers
    if (responseHeaders['ratelimit-limit']) {
      headers.limit = parseInt(responseHeaders['ratelimit-limit'], 10);
    }
    if (responseHeaders['ratelimit-remaining']) {
      headers.remaining = parseInt(responseHeaders['ratelimit-remaining'], 10);
    }
    if (responseHeaders['ratelimit-reset']) {
      headers.reset = parseInt(responseHeaders['ratelimit-reset'], 10);
    }
    if (responseHeaders['retry-after']) {
      headers.retryAfter = parseInt(responseHeaders['retry-after'], 10);
    }

    // Track if we found any headers
    if (Object.keys(headers).length > 0) {
      this.trackRateLimitHeaders(endpointType, headers);
    }
  }

  /**
   * Get metrics for all endpoints
   */
  public getAllMetrics(): Record<
    string,
    RateLimiterMetrics & {headerMetrics?: RateLimitHeaders}
  > {
    const metrics: Record<
      string,
      RateLimiterMetrics & {headerMetrics?: RateLimitHeaders}
    > = {};

    Array.from(this.buckets.entries()).forEach(([type, bucket]) => {
      const bucketMetrics = bucket.getMetrics();
      const headerMetrics = this.headerMetrics.get(type);

      metrics[type] = {
        ...bucketMetrics,
        ...(headerMetrics ? {headerMetrics} : {}),
      };
    });

    return metrics;
  }

  /**
   * Get metrics for specific endpoint
   */
  public getMetrics(
    endpointType: ATProtoEndpointType
  ): (RateLimiterMetrics & {headerMetrics?: RateLimitHeaders}) | null {
    const bucket = this.buckets.get(endpointType);
    if (!bucket) {
      return null;
    }

    const bucketMetrics = bucket.getMetrics();
    const headerMetrics = this.headerMetrics.get(endpointType);

    return {
      ...bucketMetrics,
      ...(headerMetrics ? {headerMetrics} : {}),
    };
  }

  /**
   * Get adaptive mode status including circuit breaker state
   */
  public getAdaptiveStatus(): {
    isActive: boolean;
    recent429Count: number;
    remainingTimeMs: number;
    circuitState: CircuitBreakerState;
    nextProbeMs: number;
    consecutiveProbeFailures: number;
  } {
    const isActive = this.isInAdaptiveMode();
    const now = Date.now();
    return {
      isActive,
      recent429Count: this.adaptiveState.recent429Count,
      remainingTimeMs: isActive
        ? Math.max(0, this.adaptiveState.adaptiveModeUntil - now)
        : 0,
      circuitState: this.adaptiveState.circuitState,
      nextProbeMs: this.adaptiveState.probeScheduledAt > now
        ? this.adaptiveState.probeScheduledAt - now
        : 0,
      consecutiveProbeFailures: this.adaptiveState.consecutiveProbeFailures,
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
    // Clear probe timer before resetting state
    if (this.adaptiveState.probeTimer !== null) {
      clearTimeout(this.adaptiveState.probeTimer);
    }

    Array.from(this.buckets.entries()).forEach(([type, bucket]) => {
      bucket.reset();
      this.headerMetrics.delete(type);
    });

    // Reset adaptive state
    this.adaptiveState = {
      recent429Count: 0,
      last429Timestamp: 0,
      adaptiveModeUntil: 0,
      originalConfigs: new Map(),
      circuitState: CircuitBreakerState.CLOSED,
      probeScheduledAt: 0,
      currentProbeIntervalMs: CIRCUIT_BREAKER_INITIAL_PROBE_MS,
      probeTimer: null,
      consecutiveProbeFailures: 0,
    };

    logger.log('Reset all rate limiters');
  }
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
  if (globalRateLimiter) {
    globalRateLimiter.resetAll();
  }
  globalRateLimiter = null;
}

/**
 * Wrapper function to rate limit any async function.
 * Reports both successes and 429 failures to the circuit breaker.
 */
export async function rateLimited<T>(
  fn: () => Promise<T>,
  endpointType: ATProtoEndpointType,
  timeoutMs: number = 30000
): Promise<T> {
  const limiter = getGlobalRateLimiter();

  try {
    await limiter.waitForAllowance(endpointType, timeoutMs);
    const result = await fn();
    // Report success to circuit breaker for half-open probe recovery
    limiter.trackSuccess();
    return result;
  } catch (error: any) {
    // Track 429 errors
    if (error?.status === 429 || error?.message?.includes('429')) {
      limiter.track429Error(endpointType);
    }
    throw error;
  }
}
