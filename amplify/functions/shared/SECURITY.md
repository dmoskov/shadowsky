# CloudWatch Metrics Security Model

## Overview

This document describes the security controls implemented for CloudWatch metrics to prevent unauthorized access, injection attacks, and ensure proper resource isolation.

## Security Principles

1. **Defense in Depth**: Multiple layers of validation and sanitization
2. **Fail Secure**: Invalid inputs are rejected rather than sanitized when possible
3. **Least Privilege**: Users can only access metrics for their authorized resources
4. **Input Validation**: All inputs are validated before use
5. **Audit Logging**: Security events are logged for monitoring

## Access Control Model

### Namespace Restrictions

Only the following namespaces are accessible:
- `ShadowSky/AnthropicAPI` - Anthropic API performance metrics
- `ShadowSky/AltTextGeneration` - Alt-text generation cache metrics
- `AWS/Lambda` - Lambda function metrics (read-only)

Attempts to access other namespaces (e.g., `AWS/EC2`, `AWS/RDS`) are rejected with a `SecurityValidationError`.

### Metric Name Restrictions

Each namespace has a whitelist of allowed metric names:

**ShadowSky/AnthropicAPI:**
- APILatency
- InputTokens
- OutputTokens
- ErrorRate
- ErrorsByType
- Timeouts
- RequestCount

**ShadowSky/AltTextGeneration:**
- CacheHit
- CacheMiss

**AWS/Lambda:**
- Invocations
- Errors
- Duration
- Throttles
- ConcurrentExecutions

### Dimension Restrictions

Each namespace has allowed dimensions:

**ShadowSky/AnthropicAPI:**
- Function
- Status (Success/Error)
- ErrorType

**ShadowSky/AltTextGeneration:**
- Function

**AWS/Lambda:**
- FunctionName
- Resource
- ExecutedVersion

### Function Access Control

Only specific Lambda functions are accessible:
- generate-alt-text
- writing-feedback
- adjust-tone
- optimize-thread
- suggest-hashtags
- style-analysis

## User Context and Authorization

### UserContext Interface

```typescript
interface UserContext {
  userId?: string;           // Unique user identifier
  allowedFunctions?: string[]; // Functions user can access
  isAdmin?: boolean;          // Admin bypass flag
}
```

### Authorization Rules

1. **No User Context**: Default restrictions apply (allowed functions only)
2. **Regular User**: Can only access functions in `allowedFunctions` list
3. **Admin User**: Can access all allowed functions

### Example Usage

```typescript
// Regular user with limited access
const userContext: UserContext = {
  userId: 'user-123',
  allowedFunctions: ['generate-alt-text'],
  isAdmin: false,
};

// Publishing metrics requires user context validation
await publishMetrics(metrics, userContext);
```

## Input Validation

### Validation Rules

#### String Identifiers (Namespace, Metric, Dimension Names)
- Must contain only: `a-z`, `A-Z`, `0-9`, `-`, `_`, `/`, `.`
- Maximum length: 255 characters (namespaces and metrics), 256 characters (dimension values)
- Must be non-empty
- Must be in the allowed list for the namespace

#### Dimension Values
- Sanitized to remove control characters and dangerous HTML/script characters
- Maximum length: 256 characters
- Function dimensions are validated against allowed function list

#### Timestamps
- Must be within the last 2 weeks
- Must not be more than 2 hours in the future
- Validates against CloudWatch timestamp requirements

#### Metric Counts
- Maximum 20 metrics per publish call
- Maximum 10 dimensions per metric

### Validation Flow

```
Input → Length Check → Character Validation → Whitelist Check → Sanitization → Usage
   ↓         ↓                ↓                    ↓                ↓
  Fail     Fail             Fail                Fail            Success
```

## Injection Attack Prevention

### SQL Injection
Pattern: `'; DROP TABLE metrics;--`

**Protection**: Character validation rejects semicolons, quotes, and SQL keywords in identifiers.

### XSS Injection
Pattern: `<script>alert(document.cookie)</script>`

**Protection**: HTML/script characters (`<`, `>`, `"`, `'`) are removed during sanitization.

### Command Injection
Pattern: `; rm -rf /` or `| cat /etc/passwd`

**Protection**: Special shell characters are rejected in identifiers.

### Path Traversal
Pattern: `../../../etc/passwd`

**Protection**: Function names are validated against a strict whitelist. Path separators in unexpected locations are rejected.

### LDAP Injection
Pattern: `Function)(cn=*`

**Protection**: Parentheses and asterisks are not allowed in identifiers.

### NoSQL Injection
Pattern: `{ "$ne": null }`

**Protection**: Object/JSON syntax characters are rejected in string identifiers.

## Rate Limiting

### Global Rate Limiter

```typescript
// 100 requests per 60 seconds per identifier
const rateLimiter = new RateLimiter(60000, 100);

// Check rate limit before processing
checkRateLimit(userId);
```

### Rate Limit Enforcement

- Sliding window algorithm
- Per-identifier tracking (userId, IP address, or API key)
- Automatic cleanup of old entries
- Graceful handling of rate limit exceeded

### Rate Limit Response

When rate limit is exceeded:
```typescript
throw new SecurityValidationError(
  'Rate limit exceeded',
  'rateLimit',
  identifier,
  'rate_limit_exceeded'
);
```

## Error Handling and Logging

### Security Event Logging

All security validation failures are logged with structured data:

```typescript
logSecurityEvent('validation_error', {
  field: 'namespace',
  value: 'AWS/EC2',
  reason: 'unauthorized_namespace',
  timestamp: '2025-01-17T10:30:00.000Z',
  eventType: 'validation_error',
});
```

### Event Types

- `validation_error` - Input validation failure
- `access_denied` - Authorization failure
- `suspicious_activity` - Potential attack pattern detected

### Error Sanitization

Sensitive information is removed from error messages:

```typescript
// Before: "API request failed with api_key=sk-1234567890"
// After:  "API request failed with api_key=***"

sanitizeErrorMessage(error);
```

Patterns sanitized:
- API keys (`api_key=*`)
- Tokens (`token=*`)
- Passwords (`password=*`)
- Secrets (`secret=*`)

### CloudWatch Logs Integration

Security events are logged to CloudWatch Logs with prefix `SECURITY_EVENT:` for easy filtering and alerting.

**Example CloudWatch Insights Query:**

```
fields @timestamp, field, value, reason
| filter @message like /SECURITY_EVENT:/
| parse @message "SECURITY_EVENT: *" as data
| stats count() by reason
```

## Security Validation API

### Core Functions

#### validateNamespace(namespace: string): AllowedNamespace
Validates and returns namespace if in allowed list.

**Throws:** `SecurityValidationError` if invalid

#### validateMetricName(metricName: string, namespace: AllowedNamespace): string
Validates metric name for specific namespace.

**Throws:** `SecurityValidationError` if invalid

#### validateDimensionName(dimensionName: string, namespace: AllowedNamespace): string
Validates dimension name for specific namespace.

**Throws:** `SecurityValidationError` if invalid

#### validateDimensionValue(dimensionName: string, dimensionValue: string, userContext?: UserContext): string
Validates and sanitizes dimension value. Enforces function access for Function dimensions.

**Returns:** Sanitized value
**Throws:** `SecurityValidationError` if invalid

#### validateFunctionAccess(functionName: string, userContext?: UserContext): void
Validates user has access to specific function.

**Throws:** `SecurityValidationError` if unauthorized

#### validateMetricData(namespace: string, metricData: MetricDatum[], userContext?: UserContext): void
Validates entire metric data payload before publishing.

**Throws:** `SecurityValidationError` if any validation fails

#### checkRateLimit(identifier: string): void
Checks rate limit for identifier.

**Throws:** `SecurityValidationError` if rate limit exceeded

#### sanitizeErrorMessage(error: any): string
Removes sensitive information from error messages.

**Returns:** Sanitized error message

#### logSecurityEvent(eventType: string, details: Record<string, any>): void
Logs security event to CloudWatch Logs.

### SecurityValidationError

Custom error class with security context:

```typescript
class SecurityValidationError extends Error {
  constructor(
    message: string,
    public readonly field: string,
    public readonly value: any,
    public readonly reason: string
  );
}
```

**Properties:**
- `field` - Field that failed validation
- `value` - Value that was rejected (may be truncated)
- `reason` - Machine-readable reason code

**Reason Codes:**
- `missing_value` - Required value not provided
- `length_exceeded` - Value exceeds maximum length
- `invalid_characters` - Contains invalid characters
- `unauthorized_namespace` - Namespace not in allowed list
- `unauthorized_metric` - Metric not allowed for namespace
- `unauthorized_dimension` - Dimension not allowed for namespace
- `unauthorized_function` - Function not in allowed list
- `access_denied` - User lacks permission
- `limit_exceeded` - Exceeds rate or count limit
- `invalid_timestamp` - Timestamp outside valid range
- `rate_limit_exceeded` - Too many requests

## Integration with CloudWatch Metrics

### Publishing Metrics Securely

```typescript
import { publishMetrics } from './cloudwatch-metrics';
import { UserContext } from './cloudwatch-security';

const userContext: UserContext = {
  userId: 'user-123',
  allowedFunctions: ['generate-alt-text'],
  isAdmin: false,
};

await publishMetrics({
  functionName: 'generate-alt-text',
  latencyMs: 250,
  inputTokens: 1000,
  outputTokens: 150,
  success: true,
}, userContext);
```

### Validation Workflow

1. **Input Validation**: All fields validated against rules
2. **Namespace Check**: Namespace must be in allowed list
3. **Metric Name Check**: Metric must be allowed for namespace
4. **Dimension Validation**: Each dimension name and value validated
5. **Function Access Check**: If Function dimension present, user access verified
6. **Rate Limit Check**: Request rate checked against limits
7. **Timestamp Validation**: Timestamps within valid range
8. **Count Limits**: Metric and dimension counts within limits
9. **Sanitization**: Values sanitized if needed
10. **Publishing**: Metrics sent to CloudWatch

If any validation fails, `SecurityValidationError` is thrown and logged.

## Security Testing

Comprehensive test suite at `__tests__/cloudwatch-security.test.ts` covers:

- ✅ Valid namespace acceptance
- ✅ Invalid namespace rejection
- ✅ Character validation (alphanumeric, special chars)
- ✅ Length limit enforcement
- ✅ Whitelist validation
- ✅ User context authorization
- ✅ Admin privilege escalation
- ✅ Injection attack prevention (SQL, XSS, Command, Path Traversal, LDAP)
- ✅ Rate limiting
- ✅ Error sanitization
- ✅ Security event logging
- ✅ Timestamp validation
- ✅ Dimension value sanitization

## Monitoring and Alerting

### Key Metrics to Monitor

1. **Security Event Count**
   ```
   fields @timestamp
   | filter @message like /SECURITY_EVENT:/
   | stats count() by bin(5m)
   ```

2. **Validation Errors by Reason**
   ```
   fields reason
   | filter @message like /SECURITY_EVENT:/ and eventType = "validation_error"
   | stats count() by reason
   ```

3. **Access Denied Events**
   ```
   fields userId, functionName
   | filter @message like /SECURITY_EVENT:/ and reason = "access_denied"
   | stats count() by userId, functionName
   ```

4. **Rate Limit Exceeded Events**
   ```
   fields identifier
   | filter @message like /SECURITY_EVENT:/ and reason = "rate_limit_exceeded"
   | stats count() by identifier
   ```

### Recommended Alarms

1. **High Validation Error Rate**
   - Threshold: > 10 validation errors per minute
   - Action: Alert security team

2. **Repeated Access Denied**
   - Threshold: > 5 access denied for same userId in 5 minutes
   - Action: Investigate potential unauthorized access attempt

3. **Rate Limit Exceeded**
   - Threshold: > 3 rate limit exceeded events in 1 minute
   - Action: Review client behavior, possible DoS attempt

## Best Practices

1. **Always Provide User Context**: Pass `UserContext` when available for proper authorization
2. **Handle SecurityValidationError**: Catch and log security validation errors appropriately
3. **Monitor Security Events**: Set up CloudWatch alarms for security events
4. **Principle of Least Privilege**: Only grant access to necessary functions
5. **Regular Security Audits**: Review allowed lists and access patterns periodically
6. **Update Whitelists Carefully**: Changes to allowed namespaces/metrics should be reviewed
7. **Log Analysis**: Regularly analyze security event logs for patterns

## Compliance Considerations

### Data Privacy
- No PII is logged in security events
- User IDs are treated as non-sensitive identifiers
- Error messages are sanitized to remove secrets

### Audit Trail
- All security validation failures are logged
- Timestamp, field, value, and reason are recorded
- Logs retained per CloudWatch Logs retention policy

### Access Control
- Role-based access through UserContext
- Admin flag for privileged operations
- Function-level access restrictions

## Future Enhancements

Potential improvements to consider:

1. **Distributed Rate Limiting**: Use Redis or DynamoDB for cross-Lambda rate limiting
2. **IP-based Restrictions**: Add IP whitelist/blacklist support
3. **Anomaly Detection**: Machine learning-based suspicious pattern detection
4. **Metric Encryption**: Encrypt sensitive metric values at rest
5. **OAuth Integration**: Support OAuth tokens for user authentication
6. **Dynamic Whitelists**: Store allowed lists in DynamoDB for runtime updates
7. **Multi-Region Support**: Coordinate security across regions
8. **Web Application Firewall**: Add WAF rules for API Gateway
9. **SIEM Integration**: Forward security events to SIEM system
10. **Compliance Reporting**: Automated compliance report generation

## References

- [AWS CloudWatch Security Best Practices](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/security.html)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
- [AWS Lambda Security Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/lambda-security.html)
