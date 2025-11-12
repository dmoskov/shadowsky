# Anthropic API Performance Monitoring

This document describes the CloudWatch monitoring implementation for the Anthropic API integration.

## Overview

CloudWatch monitoring has been implemented to track performance metrics for all Anthropic API calls, with a focus on the `generate-alt-text` Lambda function.

## Metrics Collected

### Performance Metrics

1. **APILatency** (Milliseconds)
   - Tracks the end-to-end latency of Anthropic API calls
   - Dimensions: `Function`, `Status` (Success/Error)
   - Statistics: p50, p95, p99 percentiles
   - Use case: Identify performance degradation and latency spikes

2. **InputTokens** (Count)
   - Number of tokens in API request
   - Dimension: `Function`
   - Use case: Track API usage and costs

3. **OutputTokens** (Count)
   - Number of tokens in API response
   - Dimension: `Function`
   - Use case: Track API usage and costs

### Error Tracking

4. **ErrorRate** (Count, 0 or 1 per request)
   - Binary indicator of success/failure
   - Dimension: `Function`
   - Use case: Calculate error percentage over time

5. **ErrorsByType** (Count)
   - Breakdown of errors by category
   - Dimensions: `Function`, `ErrorType`
   - Error types: Authentication, RateLimit, ServerError, ClientError, Timeout, NetworkError, Unknown
   - Use case: Diagnose root cause of failures

6. **Timeouts** (Count)
   - Specific tracking of timeout occurrences
   - Dimension: `Function`
   - Use case: Monitor timeout frequency and adjust timeout thresholds

7. **RequestCount** (Count)
   - Total number of requests
   - Dimensions: `Function`, `Status` (Success/Error)
   - Use case: Track request volume and success rate

## CloudWatch Dashboard

A dashboard named **ShadowSky-Anthropic-API-Performance** is automatically created with:

- API Latency graph (p50, p95, p99)
- Request Volume (Success vs Error)
- Token Usage trends
- Error breakdown by type
- Current error rate (single value)
- Total timeouts in last 24h (single value)

### Viewing the Dashboard

1. Navigate to AWS Console > CloudWatch > Dashboards
2. Select **ShadowSky-Anthropic-API-Performance**
3. Adjust time range as needed (1h, 3h, 12h, 1d, 1w, custom)

## CloudWatch Alarms

Three alarms are configured to alert on critical conditions:

### 1. High Latency Alarm
- **Name**: `ShadowSky-Anthropic-HighLatency`
- **Threshold**: p99 latency > 5000ms
- **Evaluation**: 2 consecutive periods
- **Description**: Alerts when API response time is consistently slow

### 2. High Error Rate Alarm
- **Name**: `ShadowSky-Anthropic-HighErrorRate`
- **Threshold**: Error rate > 5%
- **Evaluation**: 3 consecutive periods
- **Description**: Alerts when error rate exceeds acceptable threshold

### 3. Timeout Alarm
- **Name**: `ShadowSky-Anthropic-Timeouts`
- **Threshold**: > 5 timeouts in evaluation period
- **Evaluation**: 1 period
- **Description**: Alerts when timeout occurrences spike

### Viewing Alarms

1. Navigate to AWS Console > CloudWatch > Alarms
2. Filter by prefix: `ShadowSky-Anthropic-`
3. Check alarm state: OK, ALARM, or INSUFFICIENT_DATA

## Structured Logging

In addition to CloudWatch metrics, structured performance logs are written to CloudWatch Logs:

```json
{
  "timestamp": "2025-01-17T10:30:45.123Z",
  "function": "generate-alt-text",
  "latencyMs": 2450,
  "inputTokens": 1234,
  "outputTokens": 89,
  "success": true,
  "errorType": null,
  "timeout": false
}
```

### Viewing Logs

1. Navigate to AWS Console > CloudWatch > Log Groups
2. Select `/aws/lambda/generate-alt-text`
3. Search for `PERFORMANCE_METRIC` to filter performance logs
4. Use CloudWatch Insights for advanced queries

### Example CloudWatch Insights Queries

**Average latency by hour:**
```
fields @timestamp, latencyMs
| filter @message like /PERFORMANCE_METRIC/
| parse @message "PERFORMANCE_METRIC: *" as data
| stats avg(latencyMs) by bin(1h)
```

**Error rate by error type:**
```
fields errorType
| filter @message like /PERFORMANCE_METRIC/ and success = false
| stats count() by errorType
```

**Token usage trends:**
```
fields inputTokens, outputTokens
| filter @message like /PERFORMANCE_METRIC/
| stats sum(inputTokens) as totalInput, sum(outputTokens) as totalOutput by bin(1d)
```

## Integration with DynamoDB Cache

The monitoring implementation works alongside the DynamoDB caching layer:

- Cache hits bypass Anthropic API calls (no API latency metrics)
- Cache misses trigger API calls (full metrics collected)
- Separate cache hit/miss metrics track cache effectiveness

## Cost Optimization

Metrics are published asynchronously and do not block the main Lambda execution. Publishing failures are logged but do not affect API functionality.

- CloudWatch metrics cost: ~$0.30 per 1,000 metrics
- CloudWatch dashboard: Free (up to 3 dashboards)
- CloudWatch alarms: $0.10 per alarm per month

## Troubleshooting

### No metrics appearing in CloudWatch

1. Verify Lambda has CloudWatch permissions (check IAM role)
2. Check Lambda logs for "Failed to publish CloudWatch metrics" errors
3. Ensure correct AWS region is configured

### Dashboard not showing data

1. Check time range selection (data might be outside selected range)
2. Verify metrics are being published (check CloudWatch Metrics directly)
3. Ensure Lambda has been invoked (no data = no invocations)

### Alarms in INSUFFICIENT_DATA state

This is normal if:
- Lambda hasn't been invoked recently
- Not enough data points for evaluation
- Wait for more API calls to generate data

## Implementation Files

- `/amplify/functions/shared/cloudwatch-metrics.ts` - Core metrics utility
- `/amplify/functions/shared/cloudwatch-dashboard.ts` - Dashboard and alarm definitions
- `/amplify/functions/generate-alt-text/handler.ts` - Instrumented Lambda handler
- `/amplify/functions/generate-alt-text/resource.ts` - Lambda configuration with CloudWatch permissions
- `/amplify/backend.ts` - Dashboard and alarm creation

## Future Enhancements

Potential improvements:
- Add metrics for other Anthropic API functions (adjust-tone, writing-feedback, etc.)
- Implement cost tracking metrics
- Add anomaly detection
- Create SNS topic for alarm notifications
- Add X-Ray tracing integration
- Implement custom metric filters for advanced analysis
