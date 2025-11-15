/**
 * CloudWatch Metrics Utility
 *
 * Provides structured performance monitoring for Anthropic API calls.
 * Tracks latency, token usage, error rates, and timeout occurrences.
 *
 * Features:
 * - Token bucket rate limiting to prevent quota exhaustion
 * - Exponential backoff retry logic for transient failures
 * - Metric caching to reduce redundant API calls
 * - Self-monitoring metrics for rate limiting and caching
 * - Input validation and sanitization
 * - Namespace and metric name validation
 * - Resource ownership enforcement
 * - Circuit breaker pattern to prevent cascading failures
 * - Configurable timeout guards (default 2s) for CloudWatch API calls
 * - Graceful degradation when CloudWatch API is unhealthy
 * - Automatic recovery with exponential backoff
 *
 * Circuit Breaker Configuration:
 * - Error threshold: 50% (configurable via CLOUDWATCH_ERROR_THRESHOLD env)
 * - Time window: 60 seconds (configurable via CLOUDWATCH_WINDOW_MS env)
 * - Timeout: 2 seconds (configurable via CLOUDWATCH_TIMEOUT_MS env)
 * - States: CLOSED (normal), OPEN (disabled), HALF_OPEN (testing recovery)
 */

import { CloudWatchClient, PutMetricDataCommand, MetricDatum, StandardUnit } from '@aws-sdk/client-cloudwatch';
import { TokenBucketRateLimiter, DEFAULT_CLOUDWATCH_RATE_LIMIT } from './rate-limiter';
import { MetricCache, DEFAULT_METRIC_CACHE_CONFIG, createMetricCacheKey } from './metric-cache';
import {
  validateMetricData,
  UserContext,
  SecurityValidationError,
  logSecurityEvent,
  sanitizeErrorMessage,
} from './cloudwatch-security';
import {
  validateCloudWatchPermissions,
  validateNamespaceAccess,
  InsufficientPermissionsError,
  formatPermissionError,
} from './cloudwatch-iam-validation';
import {
  CircuitBreaker,
  CircuitBreakerOpenError,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
} from './circuit-breaker';

// Validate AWS_REGION is set
if (!process.env.AWS_REGION) {
  throw new Error(
    'AWS_REGION environment variable must be set. ' +
    'This is required for CloudWatch metrics to be sent to the correct region. ' +
    'Configure this in your Lambda function resource definition.'
  );
}

// Use AWS SDK default region resolution (respects AWS_REGION env var, AWS config, and instance metadata)
const cloudwatch = new CloudWatchClient({
  region: process.env.AWS_REGION,
});

const NAMESPACE = 'ShadowSky/AnthropicAPI';
const MONITORING_NAMESPACE = 'ShadowSky/Monitoring';

// CloudWatch API timeout configuration (default 2s, configurable via env)
const CLOUDWATCH_TIMEOUT_MS = parseInt(
  process.env.CLOUDWATCH_TIMEOUT_MS || '2000',
  10
);

// Initialize rate limiter, cache, and circuit breaker
const rateLimiter = new TokenBucketRateLimiter(DEFAULT_CLOUDWATCH_RATE_LIMIT);
const metricCache = new MetricCache<boolean>(DEFAULT_METRIC_CACHE_CONFIG);
const circuitBreaker = new CircuitBreaker({
  ...DEFAULT_CIRCUIT_BREAKER_CONFIG,
  errorThresholdPercentage: parseInt(
    process.env.CLOUDWATCH_ERROR_THRESHOLD || '50',
    10
  ),
  timeWindowMs: parseInt(
    process.env.CLOUDWATCH_WINDOW_MS || '60000',
    10
  ),
});

// Validate CloudWatch permissions on initialization (async, non-blocking)
let permissionsValidated = false;
validateCloudWatchPermissions()
  .then(() => {
    permissionsValidated = true;
    console.log('CloudWatch permissions validated successfully');
  })
  .catch((error) => {
    if (error instanceof InsufficientPermissionsError) {
      console.error('CloudWatch permission validation failed:', formatPermissionError(error));
    } else {
      console.warn('CloudWatch permission validation skipped:', error);
    }
  });

export interface APIMetrics {
  functionName: string;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  success: boolean;
  errorType?: string;
  timeout?: boolean;
}

/**
 * Publishes performance metrics to CloudWatch with security validation
 */
export async function publishMetrics(
  metrics: APIMetrics,
  userContext?: UserContext
): Promise<void> {
  const metricData: MetricDatum[] = [];

  // Latency metric with percentile statistics
  metricData.push({
    MetricName: 'APILatency',
    Value: metrics.latencyMs,
    Unit: StandardUnit.Milliseconds,
    Timestamp: new Date(),
    Dimensions: [
      { Name: 'Function', Value: metrics.functionName },
      { Name: 'Status', Value: metrics.success ? 'Success' : 'Error' },
    ],
  });

  // Token usage metrics
  if (metrics.inputTokens !== undefined) {
    metricData.push({
      MetricName: 'InputTokens',
      Value: metrics.inputTokens,
      Unit: StandardUnit.Count,
      Timestamp: new Date(),
      Dimensions: [
        { Name: 'Function', Value: metrics.functionName },
      ],
    });
  }

  if (metrics.outputTokens !== undefined) {
    metricData.push({
      MetricName: 'OutputTokens',
      Value: metrics.outputTokens,
      Unit: StandardUnit.Count,
      Timestamp: new Date(),
      Dimensions: [
        { Name: 'Function', Value: metrics.functionName },
      ],
    });
  }

  // Error rate metric
  metricData.push({
    MetricName: 'ErrorRate',
    Value: metrics.success ? 0 : 1,
    Unit: StandardUnit.Count,
    Timestamp: new Date(),
    Dimensions: [
      { Name: 'Function', Value: metrics.functionName },
    ],
  });

  // Error type breakdown
  if (!metrics.success && metrics.errorType) {
    metricData.push({
      MetricName: 'ErrorsByType',
      Value: 1,
      Unit: StandardUnit.Count,
      Timestamp: new Date(),
      Dimensions: [
        { Name: 'Function', Value: metrics.functionName },
        { Name: 'ErrorType', Value: metrics.errorType },
      ],
    });
  }

  // Timeout tracking
  if (metrics.timeout) {
    metricData.push({
      MetricName: 'Timeouts',
      Value: 1,
      Unit: StandardUnit.Count,
      Timestamp: new Date(),
      Dimensions: [
        { Name: 'Function', Value: metrics.functionName },
      ],
    });
  }

  // Success/failure count
  metricData.push({
    MetricName: 'RequestCount',
    Value: 1,
    Unit: StandardUnit.Count,
    Timestamp: new Date(),
    Dimensions: [
      { Name: 'Function', Value: metrics.functionName },
      { Name: 'Status', Value: metrics.success ? 'Success' : 'Error' },
    ],
  });

  // Create cache key for deduplication
  const cacheKey = createMetricCacheKey(
    NAMESPACE,
    `${metrics.functionName}-${Date.now()}`,
    {
      success: String(metrics.success),
      latency: String(Math.floor(metrics.latencyMs / 1000)),
    }
  );

  // Check if we've recently published similar metrics
  if (metricCache.has(cacheKey)) {
    return;
  }

  // Wait for rate limiter token (with 2 second timeout)
  const allowed = await rateLimiter.waitForTokens(1, 2000);

  if (!allowed) {
    const limiterMetrics = rateLimiter.getMetrics();
    console.warn('CloudWatch API call rate limited', {
      tokensRemaining: limiterMetrics.tokensRemaining,
      throttleRate: rateLimiter.getThrottleRate(),
    });
    return;
  }

  try {
    // Validate namespace access (checks IAM permissions)
    await validateNamespaceAccess([NAMESPACE]);

    // Validate metrics before publishing
    validateMetricData(NAMESPACE, metricData, userContext);

    const command = new PutMetricDataCommand({
      Namespace: NAMESPACE,
      MetricData: metricData,
    });

    // Execute with circuit breaker protection and timeout
    await circuitBreaker.execute(
      () => sendMetricsWithRetry(command),
      'CloudWatch metrics publishing'
    );

    // Mark as cached to prevent redundant calls
    metricCache.set(cacheKey, true);
  } catch (error) {
    // Handle circuit breaker open state gracefully
    if (error instanceof CircuitBreakerOpenError) {
      console.warn('CloudWatch metrics disabled due to circuit breaker:', {
        metrics: error.metrics,
        functionName: metrics.functionName,
      });
      return; // Gracefully degrade - don't break upload flow
    }
    // Handle insufficient permissions
    if (error instanceof InsufficientPermissionsError) {
      const errorMessage = formatPermissionError(error);
      console.error(errorMessage);
      logSecurityEvent('access_denied', {
        missingPermissions: error.missingPermissions,
        requiredFor: error.requiredFor,
        namespace: NAMESPACE,
        userContext,
      });
      return; // Don't break the main flow
    }

    // Log security validation errors for monitoring
    if (error instanceof SecurityValidationError) {
      logSecurityEvent('validation_error', {
        field: error.field,
        value: error.value,
        reason: error.reason,
        namespace: NAMESPACE,
        userContext,
      });
    }

    // Log but don't throw - metrics should never break the main flow
    const sanitizedMessage = sanitizeErrorMessage(error);
    console.error('Failed to publish CloudWatch metrics:', sanitizedMessage);
  }
}

/**
 * Execute a promise with timeout protection
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operationName: string
): Promise<T> {
  let timeoutHandle: NodeJS.Timeout;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(
        new Error(
          `${operationName} timed out after ${timeoutMs}ms. CloudWatch API may be slow or unresponsive.`
        )
      );
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutHandle!);
    return result;
  } catch (error) {
    clearTimeout(timeoutHandle!);
    throw error;
  }
}

/**
 * Send CloudWatch API call with exponential backoff retry logic and timeout protection
 */
async function sendMetricsWithRetry(
  command: PutMetricDataCommand,
  maxRetries: number = 3,
  initialDelayMs: number = 100
): Promise<void> {
  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Wrap CloudWatch API call with timeout protection
      await withTimeout(
        cloudwatch.send(command),
        CLOUDWATCH_TIMEOUT_MS,
        'CloudWatch PutMetricData'
      );
      return;
    } catch (error: any) {
      lastError = error;

      // Don't retry on client errors (400-499) except throttling (429)
      if (error.$metadata?.httpStatusCode >= 400 &&
          error.$metadata?.httpStatusCode < 500 &&
          error.$metadata?.httpStatusCode !== 429) {
        throw error;
      }

      // If this is the last attempt, throw
      if (attempt === maxRetries) {
        throw error;
      }

      // Calculate exponential backoff with jitter
      const delay = Math.min(
        initialDelayMs * Math.pow(2, attempt - 1) + Math.random() * 100,
        5000
      );

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Structured logging with performance context
 */
export function logPerformance(metrics: APIMetrics): void {
  const logData = {
    timestamp: new Date().toISOString(),
    function: metrics.functionName,
    latencyMs: metrics.latencyMs,
    inputTokens: metrics.inputTokens,
    outputTokens: metrics.outputTokens,
    success: metrics.success,
    errorType: metrics.errorType,
    timeout: metrics.timeout,
  };

  console.log('PERFORMANCE_METRIC:', JSON.stringify(logData));
}

/**
 * Helper to categorize error types
 */
export function categorizeError(error: any): string {
  if (error.status === 401 || error.status === 403) {
    return 'Authentication';
  }
  if (error.status === 429) {
    return 'RateLimit';
  }
  if (error.status === 500 || error.status === 502 || error.status === 503) {
    return 'ServerError';
  }
  if (error.status >= 400 && error.status < 500) {
    return 'ClientError';
  }
  if (error.message?.includes('timeout') || error.code === 'ETIMEDOUT') {
    return 'Timeout';
  }
  if (error.message?.includes('fetch') || error.code === 'ECONNREFUSED') {
    return 'NetworkError';
  }
  return 'Unknown';
}

/**
 * Publish monitoring metrics for rate limiter and cache performance
 * Should be called periodically to track system health
 */
export async function publishMonitoringMetrics(): Promise<void> {
  const rateLimiterMetrics = rateLimiter.getMetrics();
  const cacheMetrics = metricCache.getMetrics();

  const metricData: MetricDatum[] = [];

  // Rate limiter metrics
  metricData.push({
    MetricName: 'RateLimiterTokensRemaining',
    Value: rateLimiterMetrics.tokensRemaining,
    Unit: StandardUnit.Count,
    Timestamp: new Date(),
  });

  metricData.push({
    MetricName: 'RateLimiterTotalRequests',
    Value: rateLimiterMetrics.totalRequests,
    Unit: StandardUnit.Count,
    Timestamp: new Date(),
  });

  metricData.push({
    MetricName: 'RateLimiterThrottledRequests',
    Value: rateLimiterMetrics.throttledRequests,
    Unit: StandardUnit.Count,
    Timestamp: new Date(),
  });

  if (rateLimiterMetrics.totalRequests > 0) {
    const throttleRate = (rateLimiterMetrics.throttledRequests / rateLimiterMetrics.totalRequests) * 100;
    metricData.push({
      MetricName: 'RateLimiterThrottleRate',
      Value: throttleRate,
      Unit: StandardUnit.Percent,
      Timestamp: new Date(),
    });
  }

  // Cache metrics
  metricData.push({
    MetricName: 'CacheSize',
    Value: cacheMetrics.size,
    Unit: StandardUnit.Count,
    Timestamp: new Date(),
  });

  metricData.push({
    MetricName: 'CacheHits',
    Value: cacheMetrics.hits,
    Unit: StandardUnit.Count,
    Timestamp: new Date(),
  });

  metricData.push({
    MetricName: 'CacheMisses',
    Value: cacheMetrics.misses,
    Unit: StandardUnit.Count,
    Timestamp: new Date(),
  });

  metricData.push({
    MetricName: 'CacheEvictions',
    Value: cacheMetrics.evictions,
    Unit: StandardUnit.Count,
    Timestamp: new Date(),
  });

  metricData.push({
    MetricName: 'CacheHitRate',
    Value: cacheMetrics.hitRate,
    Unit: StandardUnit.Percent,
    Timestamp: new Date(),
  });

  try {
    const command = new PutMetricDataCommand({
      Namespace: MONITORING_NAMESPACE,
      MetricData: metricData,
    });

    // Execute with circuit breaker protection and timeout
    await circuitBreaker.execute(
      () => withTimeout(
        cloudwatch.send(command),
        CLOUDWATCH_TIMEOUT_MS,
        'CloudWatch monitoring metrics'
      ),
      'CloudWatch monitoring metrics publishing'
    );
  } catch (error) {
    // Gracefully handle circuit breaker open state
    if (error instanceof CircuitBreakerOpenError) {
      console.warn('CloudWatch monitoring metrics disabled due to circuit breaker:', error.metrics);
      return;
    }
    console.error('Failed to publish monitoring metrics:', error);
  }
}

/**
 * Get current rate limiter, cache, and circuit breaker metrics (for debugging)
 */
export function getSystemMetrics() {
  return {
    rateLimiter: rateLimiter.getMetrics(),
    cache: metricCache.getMetrics(),
    circuitBreaker: circuitBreaker.getMetrics(),
  };
}

/**
 * Get circuit breaker metrics
 */
export function getCircuitBreakerMetrics() {
  return circuitBreaker.getMetrics();
}

/**
 * Get circuit breaker state
 */
export function getCircuitBreakerState() {
  return circuitBreaker.getState();
}

/**
 * Reset circuit breaker (for testing or manual intervention)
 */
export function resetCircuitBreaker() {
  circuitBreaker.reset();
}
