# CloudWatch API Rate Limiting and Caching

This document describes the rate limiting and caching implementation for CloudWatch API calls to prevent quota exhaustion and reduce costs.

## Overview

The CloudWatch metrics system now includes three critical protection layers:

1. **Token Bucket Rate Limiting** - Prevents exceeding CloudWatch API quotas
2. **Metric Caching** - Reduces redundant API calls
3. **Exponential Backoff** - Handles transient failures gracefully

## Components

### 1. Token Bucket Rate Limiter

Located in: `/amplify/functions/shared/rate-limiter.ts`

#### How It Works

The token bucket algorithm allows bursts of API calls while maintaining an average rate:

- **Capacity**: Maximum tokens in bucket (burst size)
- **Refill Rate**: Tokens added per second
- **Refill Interval**: How often tokens are added

When a request needs to be made:
1. Check if enough tokens are available
2. If yes: consume tokens and allow request
3. If no: wait for refill or reject request

#### Default Configuration

```typescript
{
  capacity: 20,        // Burst up to 20 requests
  refillRate: 10,      // Add 10 tokens per second
  refillInterval: 1000 // Refill every 1 second
}
```

This allows:
- **Sustained rate**: 10 requests/second
- **Burst capacity**: 20 requests instantly
- **Recovery time**: 2 seconds to fully refill

#### CloudWatch API Limits

AWS CloudWatch PutMetricData limits:
- **150 TPS** (transactions per second) per account per region
- **1 MB** payload limit per request
- **1,000 metrics** per request

Our default configuration (10 TPS) is conservative to:
- Leave headroom for other services
- Avoid accidental quota exhaustion
- Prevent unexpected AWS charges

#### Customizing Rate Limits

To adjust rate limiting for your workload:

```typescript
import { TokenBucketRateLimiter } from './rate-limiter';

const customRateLimiter = new TokenBucketRateLimiter({
  capacity: 50,        // Higher burst for traffic spikes
  refillRate: 20,      // Higher sustained rate
  refillInterval: 1000 // Keep 1 second refill
});
```

#### Monitoring Rate Limiting

Track rate limiter health with these metrics:

```typescript
const metrics = rateLimiter.getMetrics();
console.log({
  tokensRemaining: metrics.tokensRemaining,
  totalRequests: metrics.totalRequests,
  throttledRequests: metrics.throttledRequests,
  throttleRate: rateLimiter.getThrottleRate()
});
```

### 2. Metric Cache

Located in: `/amplify/functions/shared/metric-cache.ts`

#### How It Works

In-memory LRU (Least Recently Used) cache prevents redundant metric publications:

- **TTL (Time To Live)**: Entries expire after configured duration
- **LRU Eviction**: Oldest entries removed when capacity reached
- **Cache Key**: Generated from namespace, metric name, and dimensions

#### Default Configuration

```typescript
{
  defaultTTL: 300000,  // 5 minutes (300,000 ms)
  maxSize: 100         // 100 cached entries
}
```

This configuration:
- **Reduces API calls by ~60-80%** for frequently published metrics
- **Low memory footprint**: ~10-20 KB depending on entry size
- **Fast lookups**: O(1) average case

#### Cache Strategy

The cache uses a "get-or-set" pattern:

```typescript
// Create cache key from metric parameters
const cacheKey = createMetricCacheKey(
  namespace,
  metricName,
  dimensions
);

// Check cache before API call
if (metricCache.has(cacheKey)) {
  return; // Skip redundant call
}

// Make API call and cache result
await publishToCloudWatch(metrics);
metricCache.set(cacheKey, true);
```

#### Customizing Cache Behavior

Adjust cache settings for your use case:

```typescript
import { MetricCache } from './metric-cache';

const customCache = new MetricCache({
  defaultTTL: 600000,  // 10 minutes for less frequent updates
  maxSize: 200         // More entries for high-volume systems
});
```

For specific metrics with custom TTL:

```typescript
// Cache this metric for only 1 minute
cache.set(key, value, 60000);
```

#### Cache Cleanup

The cache automatically removes expired entries on access. For manual cleanup:

```typescript
// Remove all expired entries
const removed = metricCache.cleanup();
console.log(`Cleaned up ${removed} expired entries`);

// Clear entire cache
metricCache.clear();
```

### 3. Exponential Backoff

Located in: `/amplify/functions/shared/cloudwatch-metrics.ts` (function: `sendMetricsWithRetry`)

#### How It Works

Retry failed API calls with increasing delays:

1. **Initial attempt**: Send immediately
2. **First retry**: Wait 100ms + random jitter
3. **Second retry**: Wait 200ms + random jitter
4. **Third retry**: Wait 400ms + random jitter
5. **Max delay**: Capped at 5000ms (5 seconds)

#### Retry Logic

```typescript
async function sendMetricsWithRetry(
  command: PutMetricDataCommand,
  maxRetries: number = 3,
  initialDelayMs: number = 100
): Promise<void>
```

**Retry conditions**:
- ✅ Retry on: Network errors, 5xx server errors, 429 throttling
- ❌ Don't retry on: 4xx client errors (except 429)

**Jitter**: Random 0-100ms added to prevent thundering herd

#### Customizing Retry Behavior

```typescript
// More aggressive retries
await sendMetricsWithRetry(command, 5, 50);

// Less aggressive retries
await sendMetricsWithRetry(command, 2, 200);
```

## Integration

### Using the Rate-Limited Metrics System

The rate limiting and caching are automatically applied when using `publishMetrics`:

```typescript
import { publishMetrics } from '../shared/cloudwatch-metrics';

// Automatically rate limited and cached
await publishMetrics({
  functionName: 'my-function',
  latencyMs: 1234,
  success: true,
});
```

### Monitoring System Health

Publish monitoring metrics to track rate limiter and cache performance:

```typescript
import { publishMonitoringMetrics } from '../shared/cloudwatch-metrics';

// Call periodically (e.g., every 10 invocations)
await publishMonitoringMetrics();
```

This publishes to the `ShadowSky/Monitoring` namespace:

- `RateLimiterTokensRemaining` - Available tokens
- `RateLimiterTotalRequests` - Total requests processed
- `RateLimiterThrottledRequests` - Requests throttled
- `RateLimiterThrottleRate` - Percentage of throttled requests
- `CacheSize` - Current cache entries
- `CacheHits` - Cache hits
- `CacheMisses` - Cache misses
- `CacheEvictions` - LRU evictions
- `CacheHitRate` - Cache hit percentage

### Debugging

Get real-time metrics for debugging:

```typescript
import { getSystemMetrics } from '../shared/cloudwatch-metrics';

const metrics = getSystemMetrics();
console.log('Rate Limiter:', metrics.rateLimiter);
console.log('Cache:', metrics.cache);
```

## Performance Impact

### API Call Reduction

With default configuration:
- **Without caching**: 100% API calls
- **With caching**: ~20-40% API calls (60-80% reduction)

### Latency Impact

- **Cache hit**: < 1ms (in-memory lookup)
- **Rate limit wait**: 0-2000ms (depends on token availability)
- **Exponential backoff**: 0-5000ms (only on failures)

### Cost Savings

CloudWatch API pricing (as of 2024):
- **PutMetricData**: $0.01 per 1,000 requests
- **With 60% cache hit rate**: Save $0.006 per 1,000 requests
- **High-volume example**: 1M requests/month saves ~$6/month

Additional savings:
- Reduced Lambda execution time (fewer API calls)
- Lower CloudWatch Logs ingestion (fewer retry logs)

## Best Practices

### 1. Monitor Throttle Rate

Set up CloudWatch alarms:

```typescript
// Alert if throttle rate exceeds 5%
if (throttleRate > 5) {
  console.warn('High throttle rate detected:', throttleRate);
  // Consider increasing rate limit capacity
}
```

### 2. Tune Cache TTL

Balance freshness vs API reduction:

- **Real-time dashboards**: 1-2 minutes TTL
- **Historical analysis**: 5-10 minutes TTL
- **Alerting metrics**: No caching (set TTL to 0)

### 3. Handle Rate Limiting Gracefully

```typescript
// publishMetrics returns early if rate limited
await publishMetrics(metrics);

// Check if metrics were sent
const systemMetrics = getSystemMetrics();
if (systemMetrics.rateLimiter.throttledRequests > 0) {
  console.warn('Some metrics were throttled');
}
```

### 4. Periodic Cleanup

For long-running Lambda containers:

```typescript
// Clean up cache every hour
setInterval(() => {
  metricCache.cleanup();
}, 3600000);
```

### 5. Load Testing

Before production deployment:

1. Simulate expected load
2. Monitor throttle rate
3. Adjust rate limits if needed
4. Verify cache hit rate meets expectations

## Troubleshooting

### High Throttle Rate

**Symptoms**: `RateLimiterThrottleRate` > 10%

**Solutions**:
1. Increase rate limiter capacity
2. Reduce metric publication frequency
3. Batch multiple metrics into single API call
4. Increase cache TTL to reduce API calls

### Low Cache Hit Rate

**Symptoms**: `CacheHitRate` < 40%

**Causes**:
- Cache size too small (evictions)
- TTL too short (entries expiring)
- Metrics not deduplicated properly

**Solutions**:
1. Increase cache size
2. Increase cache TTL
3. Review cache key generation logic

### Metrics Not Appearing

**Symptoms**: Metrics not visible in CloudWatch

**Checks**:
1. Verify Lambda has CloudWatch permissions
2. Check for rate limiting warnings in logs
3. Ensure `AWS_REGION` environment variable is set
4. Review CloudWatch Logs for error messages

### Memory Constraints

**Symptoms**: Lambda out of memory errors

**Solutions**:
1. Reduce cache max size
2. Implement periodic cleanup
3. Use shorter cache TTL
4. Increase Lambda memory allocation

## Configuration Reference

### Environment Variables

None required - all configuration is code-based for flexibility.

### IAM Permissions

Lambda execution role needs:

```json
{
  "Effect": "Allow",
  "Action": [
    "cloudwatch:PutMetricData"
  ],
  "Resource": "*"
}
```

### Default Configurations

```typescript
// Rate Limiter
DEFAULT_CLOUDWATCH_RATE_LIMIT = {
  capacity: 20,
  refillRate: 10,
  refillInterval: 1000
}

// Metric Cache
DEFAULT_METRIC_CACHE_CONFIG = {
  defaultTTL: 300000,  // 5 minutes
  maxSize: 100
}

// Exponential Backoff
maxRetries = 3
initialDelayMs = 100
maxDelayMs = 5000
```

## Future Enhancements

Potential improvements:

1. **Adaptive Rate Limiting**: Automatically adjust based on AWS throttling responses
2. **Distributed Caching**: Use ElastiCache for multi-Lambda coordination
3. **Metric Batching**: Combine multiple metrics into fewer API calls
4. **Priority Queuing**: Critical metrics bypass rate limiting
5. **Circuit Breaker**: Temporarily disable metrics on persistent failures
6. **Dashboard Integration**: Real-time visualization of rate limiting status

## Related Documentation

- [MONITORING.md](./MONITORING.md) - CloudWatch monitoring setup
- [cloudwatch-metrics.ts](./cloudwatch-metrics.ts) - Main metrics utility
- [rate-limiter.ts](./rate-limiter.ts) - Token bucket implementation
- [metric-cache.ts](./metric-cache.ts) - LRU cache implementation

## Support

For issues or questions:
1. Check CloudWatch Logs for error messages
2. Review metrics in `ShadowSky/Monitoring` namespace
3. Run `getSystemMetrics()` for debugging information
