# CloudWatch Logs Security and Encryption

## Overview

CloudWatch logs for Lambda functions handling sensitive user data are encrypted using AWS KMS customer-managed keys. This document details the security implementation, data classification, and compliance measures.

## Security Implementation

### KMS Encryption

All Lambda functions that process sensitive user data have their CloudWatch logs encrypted at rest using a customer-managed KMS key with the following properties:

- **Key Alias**: `shadowsky/cloudwatch-logs`
- **Key Rotation**: Enabled (automatic annual rotation)
- **Removal Policy**: RETAIN (protected against accidental deletion)
- **Service Principal**: CloudWatch Logs service has explicit permissions

### Encrypted Lambda Functions

The following Lambda functions have KMS-encrypted CloudWatch logs:

1. **generate-alt-text**
2. **adjust-tone**
3. **writing-feedback**
4. **optimize-thread**
5. **suggest-hashtags**
6. **style-analysis**

### Log Retention

All sensitive log groups are configured with:
- **Retention Period**: 30 days
- **Removal Policy**: RETAIN (logs protected from accidental stack deletion)

## Data Classification

### Sensitive Data Types

CloudWatch logs may contain the following types of sensitive data:

#### 1. User-Generated Content
- Social media post text
- Draft content
- Thread segments
- Historical posts (style-analysis)

#### 2. Image Data
- Image URLs (CDN links)
- Image hashes (SHA-256)
- Generated alt-text descriptions

#### 3. Potentially Personally Identifiable Information (PII)
- User writing patterns
- User behavior patterns
- User style characteristics
- Usernames or mentions in post content

### Function-Specific Data Classification

#### generate-alt-text
- **Sensitive Fields**: `imageUrl`, `imageHash`, `altText`, `cached`
- **Data Types**: User-Generated Content, Image URLs, PII (potential)
- **Logging**: Cache hits/misses, image hashes (not full URLs in performance logs)

#### adjust-tone
- **Sensitive Fields**: `text`, `adjustedText`, `tone`
- **Data Types**: User-Generated Content, PII (potential)
- **Logging**: Generic error messages only

#### writing-feedback
- **Sensitive Fields**: `text`, `correctedVersion`, `enhancedVersion`
- **Data Types**: User-Generated Content, PII (potential)
- **Logging**: Generic error messages only

#### optimize-thread
- **Sensitive Fields**: `text`, `segments`, `maxCharsPerPost`
- **Data Types**: User-Generated Content, PII (potential)
- **Logging**: Generic error messages only

#### suggest-hashtags
- **Sensitive Fields**: `text`, `existingTags`
- **Data Types**: User-Generated Content, PII (potential)
- **Logging**: Generic error messages only

#### style-analysis
- **Sensitive Fields**: `currentText`, `historicalPosts`
- **Data Types**: User-Generated Content, User Behavior Patterns, PII (potential)
- **Logging**: Generic error messages only
- **Note**: Most sensitive due to historical data

## Logging Best Practices

### Current Implementation

1. **Error Logging**
   - Generic error messages without sensitive data
   - Error types categorized without exposing user content
   - Stack traces logged (may contain function parameters)

2. **Performance Logging (generate-alt-text)**
   - Structured logs with `PERFORMANCE_METRIC:` prefix
   - Contains: latency, token counts, success status, error types
   - Does NOT log: full image URLs, user identifiers, actual content

3. **Cache Logging (generate-alt-text)**
   - Logs cache hit/miss with image hash only
   - Image hash is SHA-256, not reversible to original URL

### Security Guidelines

#### DO:
- Log error types and categories
- Log performance metrics (latency, token counts)
- Log cache hits/misses with hashed identifiers
- Log function execution flow
- Log authentication failures (without credentials)

#### DON'T:
- Log raw user-generated content
- Log full image URLs
- Log API keys or secrets
- Log user identifiers or session tokens
- Log personally identifiable information

### Recommended Improvements

For future implementation:

1. **Log Scrubbing**
   - Implement pre-logging filters to detect and redact PII
   - Use regex patterns to mask email addresses, phone numbers
   - Hash or truncate long text fields in error messages

2. **Structured Logging**
   - Standardize log format across all Lambda functions
   - Use consistent field names for security analysis
   - Add correlation IDs (not user IDs) for request tracking

3. **Error Context**
   - Limit stack trace depth to avoid exposing function parameters
   - Create error codes instead of logging full error messages
   - Log error hashes instead of full error details

## Compliance Considerations

### GDPR Compliance

- **Data Minimization**: Only necessary data is logged
- **Storage Limitation**: 30-day retention period
- **Security**: KMS encryption at rest
- **Right to Erasure**: Manual log deletion process required (documented below)

### Data Subject Access Requests (DSAR)

If a user requests deletion of their data:

1. Identify relevant log groups (all 6 Lambda functions)
2. Use CloudWatch Insights to search for user-specific data (if correlation ID exists)
3. Note: Due to 30-day retention, logs automatically expire
4. For immediate deletion: Contact AWS Support for log stream deletion

## Access Control

### KMS Key Permissions

The KMS key resource policy grants:
- **CloudWatch Logs Service**: Encrypt, Decrypt, GenerateDataKey
- **AWS Account Root**: Full key management
- **Encryption Context**: Required ARN match for logs

### IAM Requirements

To access encrypted logs, IAM principals need:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "kms:Decrypt",
        "kms:DescribeKey"
      ],
      "Resource": "arn:aws:kms:REGION:ACCOUNT:key/KEY-ID"
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:GetLogEvents",
        "logs:FilterLogEvents"
      ],
      "Resource": "arn:aws:logs:REGION:ACCOUNT:log-group:/aws/lambda/*"
    }
  ]
}
```

## Monitoring and Auditing

### CloudWatch Metrics

Monitor log access:
- Use CloudTrail to track KMS key usage
- Monitor `Decrypt` API calls on the KMS key
- Alert on unusual access patterns

### Security Alerts

Configure CloudWatch alarms for:
- High volume of error logs (potential attack)
- Unusual error types
- Failed decryption attempts (access control violations)

## Cost Implications

### KMS Costs
- **Customer-Managed Key**: $1/month
- **Key Rotation**: Included
- **KMS Requests**:
  - Encrypt: $0.03 per 10,000 requests
  - Decrypt: $0.03 per 10,000 requests

### CloudWatch Logs Costs
- **Log Ingestion**: $0.50 per GB
- **Log Storage**: $0.03 per GB/month
- **Insights Queries**: $0.005 per GB scanned

### Cost Optimization
- 30-day retention reduces storage costs
- Minimize verbose logging in production
- Use log sampling for high-volume events

## Incident Response

### Security Incident Procedure

1. **Detection**: CloudTrail alerts on suspicious KMS access
2. **Containment**: Revoke IAM permissions immediately
3. **Investigation**: Use CloudWatch Insights to query affected timeframes
4. **Recovery**: Rotate KMS key if compromise suspected
5. **Post-Incident**: Review and update logging policies

### Data Breach Response

If sensitive data is exposed through logs:

1. Identify scope of exposure (time range, affected functions)
2. Extract affected log streams (if possible)
3. Delete or expire logs immediately
4. Rotate KMS key
5. Notify affected users per GDPR/compliance requirements
6. Document incident and implement preventive measures

## Verification Checklist

Before deployment, verify:

- [ ] KMS key created with rotation enabled
- [ ] Log groups created with KMS encryption
- [ ] Log retention set to 30 days
- [ ] Removal policy set to RETAIN
- [ ] CloudWatch Logs service has KMS permissions
- [ ] Lambda functions have CloudWatch Logs permissions
- [ ] Log groups follow naming convention: `/aws/lambda/{function-name}`
- [ ] No sensitive data in performance logs
- [ ] Error messages are generic (no user content)

## Testing Encryption

### Verify KMS Encryption

1. Deploy the updated infrastructure
2. Invoke each Lambda function
3. Check CloudWatch Logs console for each function
4. Verify "Encrypted" badge appears on log group
5. Test log access with IAM user (should require KMS decrypt permission)

### AWS CLI Verification

```bash
# List log groups and check encryption
aws logs describe-log-groups \
  --log-group-name-prefix "/aws/lambda/generate-alt-text" \
  --query 'logGroups[*].[logGroupName,kmsKeyId]' \
  --output table

# Expected output: Should show KMS key ARN

# Describe KMS key
aws kms describe-key \
  --key-id alias/shadowsky/cloudwatch-logs \
  --query 'KeyMetadata.[KeyId,KeyState,KeyRotationEnabled]' \
  --output table

# Expected output: KeyRotationEnabled should be true
```

### Test Log Access

```bash
# Attempt to read logs (requires KMS decrypt permission)
aws logs get-log-events \
  --log-group-name "/aws/lambda/generate-alt-text" \
  --log-stream-name "LATEST" \
  --limit 10

# Should succeed if IAM principal has KMS permissions
# Should fail with "AccessDeniedException" if missing KMS permissions
```

## References

- [AWS KMS Key Policies](https://docs.aws.amazon.com/kms/latest/developerguide/key-policies.html)
- [CloudWatch Logs Encryption](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/encrypt-log-data-kms.html)
- [GDPR Compliance on AWS](https://aws.amazon.com/compliance/gdpr-center/)
- [AWS Lambda Logging Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/monitoring-cloudwatchlogs.html)

## Implementation Files

- `/amplify/functions/shared/kms-encryption.ts` - KMS key creation and configuration
- `/amplify/backend.ts` - Log group creation with encryption (lines 132-156)
- `/amplify/functions/shared/cloudwatch-metrics.ts` - Performance logging utility
- `/amplify/functions/generate-alt-text/handler.ts` - Example instrumented Lambda

## Change Log

- **2025-11-12**: Initial implementation of KMS encryption for CloudWatch logs
  - Created KMS customer-managed key with rotation
  - Configured encrypted log groups for 6 Lambda functions
  - Set 30-day retention period
  - Documented data classification and security practices
