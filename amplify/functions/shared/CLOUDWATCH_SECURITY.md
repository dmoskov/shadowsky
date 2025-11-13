# CloudWatch Dashboard Security

## Overview

This document describes the security validation implemented for CloudWatch dashboard configurations to prevent injection attacks and unauthorized access.

## Security Vulnerabilities Addressed

### 1. Injection Attacks

**Risk**: Malicious inputs in dashboard configurations could lead to:
- SQL injection-like attacks on metric queries
- Command injection through metric names or dimensions
- XSS attacks in dashboard widgets
- Path traversal attempts

**Mitigation**:
- Strict input validation using Zod schemas
- Whitelist-based validation for all identifiers
- Regex patterns that only allow safe characters
- Length limits on all string inputs

### 2. Unauthorized Metric Access

**Risk**: Without validation, users could query arbitrary CloudWatch metrics, potentially accessing sensitive data from other applications.

**Mitigation**:
- Namespace whitelist (only allowed namespaces)
- Metric name whitelist per namespace
- Dimension name whitelist per namespace
- Function access validation

### 3. Resource Exhaustion

**Risk**: Malicious configurations could create excessive dashboards, widgets, or metrics to exhaust resources.

**Mitigation**:
- Maximum widget limits per dashboard (500)
- Maximum metrics per widget (100)
- Maximum metric data points per publish (1000)
- Maximum dimensions per metric (30)
- String length limits (255 characters for most fields)

### 4. Data Injection

**Risk**: Malicious metric values, timestamps, or dimensions could corrupt monitoring data.

**Mitigation**:
- Numeric validation (no Infinity or NaN)
- Timestamp validation (must be within reasonable range)
- Dimension value sanitization
- Unit validation against allowed enum

## Validation Architecture

### Components

1. **cloudwatch-validation.ts**: Zod-based schema validation for dashboard configurations
2. **cloudwatch-security.ts**: Runtime security validation and access control
3. **cloudwatch-dashboard.ts**: Dashboard creation with validation
4. **cloudwatch-metrics.ts**: Metrics publishing with validation

### Validation Layers

#### Layer 1: Schema Validation (Zod)
- Type checking
- Format validation
- Range checking
- Enum validation

#### Layer 2: Security Validation
- Injection prevention
- Access control
- Resource limits
- Sanitization

#### Layer 3: Business Logic Validation
- Namespace authorization
- Metric authorization
- Function access control

## Allowed Configuration Structure

### Namespaces
Only these namespaces are allowed:
- `ShadowSky/AnthropicAPI`
- `ShadowSky/AltTextGeneration`
- `AWS/Lambda` (read-only for specific functions)

### Metric Names
Per namespace, only whitelisted metric names are allowed:

**ShadowSky/AnthropicAPI**:
- APILatency
- InputTokens
- OutputTokens
- ErrorRate
- ErrorsByType
- Timeouts
- RequestCount

**ShadowSky/AltTextGeneration**:
- CacheHit
- CacheMiss

### Dimensions
Per namespace, only whitelisted dimension names are allowed:

**ShadowSky/AnthropicAPI**:
- Function
- Status
- ErrorType

### Statistics
Only standard CloudWatch statistics:
- Average, Sum, Minimum, Maximum, SampleCount
- p50, p90, p95, p99, p99.9

### Comparison Operators
Only standard CloudWatch comparison operators:
- GreaterThanThreshold
- GreaterThanOrEqualToThreshold
- LessThanThreshold
- LessThanOrEqualToThreshold

### Units
Only standard CloudWatch units (Milliseconds, Count, Percent, etc.)

## Input Validation Rules

### Safe Identifier Pattern
```regex
^[a-zA-Z0-9\-_\/\.]+$
```

Allows:
- Alphanumeric characters
- Hyphens (-)
- Underscores (_)
- Forward slashes (/)
- Periods (.)

Blocks:
- SQL special characters (;, ', ", --)
- Command injection characters ($, `, |, &, <, >)
- Path traversal (../)
- Control characters (\x00-\x1F)
- Script injection (<script>, javascript:)

### Dimension Name Pattern
```regex
^[a-zA-Z][a-zA-Z0-9\-_]*$
```

More restrictive:
- Must start with a letter
- Only alphanumeric, hyphens, underscores

### Dimension Value Pattern
```regex
^[a-zA-Z0-9\-_\.\:\/\s]+$
```

Allows more characters but sanitizes:
- Removes control characters
- Removes HTML/script characters
- Limits length to 256 characters

### Color Code Pattern
```regex
^#[0-9a-fA-F]{6}$
```

Only valid hex color codes (e.g., #1f77b4)

### SNS Topic ARN Pattern
```regex
^arn:aws:sns:[a-z0-9\-]+:\d{12}:[a-zA-Z0-9\-_]+$
```

Only valid SNS ARNs

## Usage Examples

### Creating a Dashboard (Safe)
```typescript
import { createAnthropicDashboard } from './cloudwatch-dashboard';

const dashboard = createAnthropicDashboard(stack);
```

The dashboard creation automatically validates:
- Namespace format
- Metric names
- Widget configurations
- All dimensions

### Publishing Metrics (Safe)
```typescript
import { publishMetrics } from './cloudwatch-metrics';

await publishMetrics({
  functionName: 'generate-alt-text',
  latencyMs: 1234,
  inputTokens: 100,
  outputTokens: 50,
  success: true,
});
```

Validation automatically:
- Checks function name against whitelist
- Validates metric data structure
- Sanitizes dimension values
- Enforces rate limits

### Creating Alarms (Safe)
```typescript
const alarms = createAnthropicAlarms(stack, alertTopic);
```

Validation ensures:
- Alarm configurations are valid
- Thresholds are numeric and finite
- Comparison operators are allowed
- Metric references are valid

## Testing

### Test Coverage
The validation is tested against:
- SQL injection attempts
- Command injection attempts
- XSS attempts
- Path traversal attempts
- Null byte injection
- Control character injection
- Unicode injection
- Buffer overflow attempts
- Resource exhaustion attempts

### Running Tests
```bash
npm run test:unit -- cloudwatch-validation.test.ts
```

## Error Handling

### Validation Errors
All validation errors throw `DashboardValidationError` with:
- Clear error message
- Field name that failed validation
- Reason for failure
- Original error (if from Zod)

Example:
```typescript
try {
  validateMetricConfig(config);
} catch (error) {
  if (error instanceof DashboardValidationError) {
    console.error('Validation failed:', error.message);
    console.error('Field:', error.field);
    console.error('Reason:', error.reason);
  }
}
```

### Security Events
Security validation errors are logged to CloudWatch Logs:
```json
{
  "eventType": "validation_error",
  "field": "namespace",
  "value": "'; DROP TABLE metrics; --",
  "reason": "invalid_characters",
  "timestamp": "2025-01-17T12:00:00.000Z"
}
```

## Best Practices

### DO
- Use the provided validation functions before any CloudWatch API calls
- Log security validation errors for monitoring
- Keep whitelists up to date with legitimate needs
- Test new configurations in non-production first
- Review CloudWatch Logs for security events regularly

### DON'T
- Bypass validation functions
- Accept user input directly without validation
- Increase limits without security review
- Add new namespaces without justification
- Disable validation in production

## Monitoring Security

### Metrics to Watch
- `SECURITY_EVENT` log entries
- Rate limit violations
- Validation error frequency
- Unauthorized access attempts

### CloudWatch Logs Insights Queries

**Find validation errors**:
```
fields @timestamp, field, reason, value
| filter eventType = "validation_error"
| sort @timestamp desc
```

**Find unauthorized access attempts**:
```
fields @timestamp, namespace, userContext
| filter reason = "unauthorized_namespace" or reason = "access_denied"
| stats count() by namespace
```

**Find rate limit violations**:
```
fields @timestamp, identifier
| filter reason = "rate_limit_exceeded"
| stats count() by identifier
```

## Compliance

This security implementation helps meet:
- **OWASP Top 10**: Injection prevention (A03:2021)
- **AWS Security Best Practices**: Input validation, least privilege
- **SOC 2**: Access controls, monitoring, logging

## Future Enhancements

1. **Dynamic Whitelists**: Store allowed values in DynamoDB for runtime updates
2. **User-Level Access Control**: Implement per-user metric access policies
3. **Anomaly Detection**: ML-based detection of suspicious metric patterns
4. **Audit Trail**: Full audit logging of all configuration changes
5. **Content Security Policy**: Additional CSP headers for dashboard UI

## References

- [AWS CloudWatch API Reference](https://docs.aws.amazon.com/AmazonCloudWatch/latest/APIReference/)
- [OWASP Injection Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Injection_Prevention_Cheat_Sheet.html)
- [Zod Documentation](https://zod.dev/)
