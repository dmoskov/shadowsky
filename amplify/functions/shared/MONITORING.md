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

### Security Note

All Lambda function logs are encrypted at rest using AWS KMS customer-managed keys. See [CLOUDWATCH_LOGS_SECURITY.md](./CLOUDWATCH_LOGS_SECURITY.md) for detailed security documentation, data classification, and compliance information.

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

## Region Configuration

The CloudWatch metrics client is configured to use the AWS region from the `AWS_REGION` environment variable. This ensures metrics are sent to the correct region for your deployment.

### Environment Variable Setup

The `AWS_REGION` environment variable is automatically set during Lambda deployment:

1. The region is determined from the CloudFormation stack where the Lambda is deployed
2. Set in `amplify/backend.ts` using `Stack.of(apiStack).region`
3. Passed to the Lambda function via the `addEnvironment()` method

### Multi-Region Deployments

For multi-region deployments:

1. Each region's Lambda functions automatically receive the correct region
2. CloudWatch metrics are sent to the region-specific CloudWatch service
3. Each region maintains its own dashboard and alarms
4. No manual configuration is required

### Region Validation

The CloudWatch metrics client validates that `AWS_REGION` is set at initialization:

- If the environment variable is missing, the Lambda will throw an error
- This prevents metrics from being sent to incorrect regions
- The error message provides guidance on configuration

## Required IAM Permissions

The Lambda functions require specific IAM permissions to publish and read CloudWatch metrics. The implementation uses **least-privilege** IAM policies that restrict access to only what is needed.

### Minimum Required Permissions

The Lambda execution role must have the following permissions:

#### 1. Metric Publishing (Required)

```json
{
  "Effect": "Allow",
  "Action": [
    "cloudwatch:PutMetricData"
  ],
  "Resource": "*",
  "Condition": {
    "StringEquals": {
      "cloudwatch:namespace": [
        "ShadowSky/AnthropicAPI",
        "ShadowSky/Monitoring",
        "ShadowSky/AltTextGeneration"
      ]
    }
  }
}
```

**Why these permissions:**
- `cloudwatch:PutMetricData` - Publish metrics to CloudWatch
- Condition restricts to specific namespaces only (prevents unauthorized namespace access)

#### 2. Metric Reading (Optional, for dashboards)

```json
{
  "Effect": "Allow",
  "Action": [
    "cloudwatch:GetMetricStatistics",
    "cloudwatch:DescribeAlarms"
  ],
  "Resource": "*"
}
```

**Why these permissions:**
- `cloudwatch:GetMetricStatistics` - Query metric data for dashboards
- `cloudwatch:DescribeAlarms` - Check alarm states

#### 3. IAM Validation (Optional, for defense-in-depth)

```json
{
  "Effect": "Allow",
  "Action": [
    "sts:GetCallerIdentity",
    "iam:SimulatePrincipalPolicy"
  ],
  "Resource": "*"
}
```

**Why these permissions:**
- `sts:GetCallerIdentity` - Determine the Lambda execution role ARN
- `iam:SimulatePrincipalPolicy` - Validate permissions before CloudWatch operations

**Note:** If these permissions are not granted, the Lambda will skip IAM validation and rely on CloudWatch API errors to detect permission issues. The function will still work, but validation errors will be less descriptive.

### Complete IAM Policy Example

Here's a complete IAM policy that can be attached to the Lambda execution role:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cloudwatch:PutMetricData"
      ],
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "cloudwatch:namespace": [
            "ShadowSky/AnthropicAPI",
            "ShadowSky/Monitoring",
            "ShadowSky/AltTextGeneration"
          ]
        }
      }
    },
    {
      "Effect": "Allow",
      "Action": [
        "cloudwatch:GetMetricStatistics",
        "cloudwatch:DescribeAlarms"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "sts:GetCallerIdentity",
        "iam:SimulatePrincipalPolicy"
      ],
      "Resource": "*"
    }
  ]
}
```

### Permission Validation

The CloudWatch monitoring implementation includes **runtime IAM permission validation** to ensure the Lambda has required permissions before attempting CloudWatch operations.

#### How It Works

1. **Initialization Check**: On Lambda cold start, permissions are validated asynchronously
2. **Pre-Operation Check**: Before publishing metrics, namespace access is validated
3. **Clear Error Messages**: If permissions are insufficient, detailed error messages explain what's missing
4. **Graceful Degradation**: Permission failures don't break the Lambda - they only prevent metric publishing

#### Permission Validation Logs

Look for these log messages to diagnose permission issues:

**Success:**
```
CloudWatch permissions validated successfully
```

**Permission Failure:**
```
CloudWatch operation blocked: Lambda execution role lacks required CloudWatch permissions: cloudwatch:PutMetricData

Missing permissions:
  - cloudwatch:PutMetricData

Required for: CloudWatch operations

To fix this issue:
1. Open the AWS Console and navigate to IAM
2. Find the Lambda execution role for this function
3. Attach a policy with the required CloudWatch permissions
4. Redeploy the Lambda function
```

**Validation Skipped:**
```
CloudWatch permission validation skipped: [error details]
```

This indicates the IAM validation itself failed (e.g., missing IAM:SimulatePrincipalPolicy permission). The Lambda will still attempt CloudWatch operations.

### Security Features

#### Least-Privilege Access

- Permissions are restricted to specific namespaces using IAM conditions
- No wildcard namespace access (`AWS/*` namespaces are blocked)
- Read permissions are separate from write permissions
- No permissions to create, modify, or delete alarms

#### Defense-in-Depth

- Runtime permission validation before CloudWatch API calls
- Input validation for all metric parameters (see SECURITY.md)
- Namespace and metric name allowlists
- Rate limiting to prevent quota exhaustion

#### Resource Restrictions

While CloudWatch metrics don't support resource-level permissions (hence `Resource: "*"`), access is restricted through:
- IAM condition keys (`cloudwatch:namespace`)
- Application-level namespace validation
- Dimension filtering based on allowed function names

### Verifying Permissions

To verify the Lambda has correct permissions:

1. **Check IAM Role Policy:**
   ```bash
   aws iam get-role-policy --role-name <lambda-role-name> --policy-name <policy-name>
   ```

2. **Test with IAM Policy Simulator:**
   ```bash
   aws iam simulate-principal-policy \
     --policy-source-arn <lambda-role-arn> \
     --action-names cloudwatch:PutMetricData \
     --resource-arns "*" \
     --context-entries "ContextKeyName=cloudwatch:namespace,ContextKeyValues=ShadowSky/AnthropicAPI,ContextKeyType=string"
   ```

3. **Check Lambda Logs:**
   Look for "CloudWatch permissions validated successfully" or permission error messages

## Troubleshooting

### No metrics appearing in CloudWatch

1. **Verify Lambda has CloudWatch permissions (check IAM role)**
   - Check IAM role attached to Lambda function
   - Verify `cloudwatch:PutMetricData` permission exists
   - Verify namespace condition allows required namespaces
   - See "Required IAM Permissions" section above

2. Check Lambda logs for "Failed to publish CloudWatch metrics" errors
3. Check for "CloudWatch operation blocked" error messages
4. Verify AWS_REGION environment variable is set correctly
5. Ensure you're viewing CloudWatch dashboard in the correct region

### Dashboard not showing data

1. Check time range selection (data might be outside selected range)
2. Verify metrics are being published (check CloudWatch Metrics directly)
3. Ensure Lambda has been invoked (no data = no invocations)

### Alarms in INSUFFICIENT_DATA state

This is normal if:
- Lambda hasn't been invoked recently
- Not enough data points for evaluation
- Wait for more API calls to generate data

### Permission Errors

If you see permission errors in Lambda logs:

1. **"Lambda execution role lacks required CloudWatch permissions"**
   - Update the Lambda IAM role to include required permissions
   - See "Complete IAM Policy Example" above
   - Attach the policy to the Lambda execution role
   - Redeploy the Lambda function

2. **"Namespace 'X' is not in the allowed list"**
   - The code is trying to publish to an unauthorized namespace
   - This is a security feature to prevent unauthorized metric publishing
   - Update `ALLOWED_CLOUDWATCH_NAMESPACES` in cloudwatch-iam-validation.ts if needed

3. **"CloudWatch permission validation skipped"**
   - IAM validation permissions are missing (sts:GetCallerIdentity or iam:SimulatePrincipalPolicy)
   - This is OK - the Lambda will still attempt CloudWatch operations
   - For better error messages, grant IAM validation permissions

## Implementation Files

- `/amplify/functions/shared/cloudwatch-metrics.ts` - Core metrics utility with security validation and rate limiting
- `/amplify/functions/shared/cloudwatch-security.ts` - Security validation and access controls
- `/amplify/functions/shared/cloudwatch-dashboard.ts` - Dashboard and alarm definitions
- `/amplify/functions/shared/cloudwatch-iam-validation.ts` - IAM permission validation module
- `/amplify/functions/shared/cloudwatch-iam-policy.ts` - Least-privilege IAM policy definitions
- `/amplify/functions/shared/rate-limiter.ts` - Token bucket rate limiter implementation
- `/amplify/functions/shared/metric-cache.ts` - Metric caching layer with LRU eviction
- `/amplify/functions/generate-alt-text/handler.ts` - Instrumented Lambda handler
- `/amplify/functions/generate-alt-text/resource.ts` - Lambda configuration with least-privilege CloudWatch permissions
- `/amplify/backend.ts` - Dashboard and alarm creation
- `/amplify/functions/shared/SECURITY.md` - Security model and access control documentation
- `/amplify/functions/shared/RATE_LIMITING.md` - Rate limiting and caching documentation
- `/amplify/functions/shared/__tests__/cloudwatch-security.test.ts` - Security validation test suite

## Rate Limiting and Caching

CloudWatch API calls are now protected by multiple layers to prevent quota exhaustion and reduce costs:

1. **Token Bucket Rate Limiting** - Prevents exceeding CloudWatch API quotas (default: 10 TPS sustained, 20 TPS burst)
2. **Metric Caching** - Reduces redundant API calls with LRU cache (default: 5 minute TTL, 100 entry max)
3. **Exponential Backoff** - Handles transient failures gracefully (3 retries with jitter)

For detailed information, see [RATE_LIMITING.md](./RATE_LIMITING.md)

### Monitoring Namespace

The `ShadowSky/Monitoring` namespace tracks rate limiting and cache performance:

- `RateLimiterTokensRemaining` - Available rate limit tokens
- `RateLimiterTotalRequests` - Total requests processed
- `RateLimiterThrottledRequests` - Requests throttled
- `RateLimiterThrottleRate` - Percentage of throttled requests
- `CacheSize` - Current cache entries
- `CacheHits` - Cache hits
- `CacheMisses` - Cache misses
- `CacheEvictions` - LRU evictions
- `CacheHitRate` - Cache effectiveness percentage

These metrics help ensure the CloudWatch API is being used efficiently and within quotas.

### Performance Benefits

- **API Call Reduction**: 60-80% reduction in CloudWatch API calls
- **Cost Savings**: ~$6/month savings per 1M metric publications
- **Quota Protection**: Prevents accidental quota exhaustion
- **Latency Optimization**: Cache hits return in < 1ms

## Future Enhancements

Potential improvements:
- Add metrics for other Anthropic API functions (adjust-tone, writing-feedback, etc.)
- Implement cost tracking metrics
- Add anomaly detection
- Create SNS topic for alarm notifications
- Add X-Ray tracing integration
- Implement custom metric filters for advanced analysis
- Adaptive rate limiting based on AWS throttling responses
- Distributed caching with ElastiCache for multi-Lambda coordination
