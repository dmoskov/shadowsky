/**
 * CloudWatch Security Module
 *
 * Implements access controls, input validation, and query filtering to prevent
 * unauthorized access to CloudWatch metrics and prevent injection attacks.
 *
 * Security Features:
 * - Input validation and sanitization for all metric parameters
 * - Namespace and dimension filtering to restrict metric access
 * - User/resource ownership validation
 * - Protection against injection attacks
 * - Rate limiting and quota enforcement
 */

import { MetricDatum } from '@aws-sdk/client-cloudwatch';

/**
 * Allowed CloudWatch namespaces for this application
 * Restricts metrics to application-specific namespaces only
 */
const ALLOWED_NAMESPACES = [
  'ShadowSky/AnthropicAPI',
  'ShadowSky/AltTextGeneration',
  'AWS/Lambda',
] as const;

type AllowedNamespace = typeof ALLOWED_NAMESPACES[number];

/**
 * Allowed metric names per namespace
 * Prevents querying arbitrary metrics
 */
const ALLOWED_METRICS: Record<AllowedNamespace, readonly string[]> = {
  'ShadowSky/AnthropicAPI': [
    'APILatency',
    'InputTokens',
    'OutputTokens',
    'ErrorRate',
    'ErrorsByType',
    'Timeouts',
    'RequestCount',
  ],
  'ShadowSky/AltTextGeneration': [
    'CacheHit',
    'CacheMiss',
  ],
  'AWS/Lambda': [
    'Invocations',
    'Errors',
    'Duration',
    'Throttles',
    'ConcurrentExecutions',
  ],
} as const;

/**
 * Allowed dimension names per namespace
 * Restricts which dimensions can be used to filter metrics
 */
const ALLOWED_DIMENSIONS: Record<AllowedNamespace, readonly string[]> = {
  'ShadowSky/AnthropicAPI': ['Function', 'Status', 'ErrorType'],
  'ShadowSky/AltTextGeneration': ['Function'],
  'AWS/Lambda': ['FunctionName', 'Resource', 'ExecutedVersion'],
} as const;

/**
 * Allowed function names that can be queried
 * Restricts access to specific Lambda functions
 */
const ALLOWED_FUNCTIONS = [
  'generate-alt-text',
  'writing-feedback',
  'adjust-tone',
  'optimize-thread',
  'suggest-hashtags',
  'style-analysis',
] as const;

/**
 * Maximum allowed values for rate limiting
 */
const LIMITS = {
  MAX_METRIC_DATA_POINTS: 20, // Maximum metrics per publish call
  MAX_DIMENSION_VALUE_LENGTH: 256,
  MAX_METRIC_NAME_LENGTH: 255,
  MAX_NAMESPACE_LENGTH: 255,
  MAX_DIMENSIONS_PER_METRIC: 10,
} as const;

/**
 * Input validation error with security context
 */
export class SecurityValidationError extends Error {
  constructor(
    message: string,
    public readonly field: string,
    public readonly value: any,
    public readonly reason: string
  ) {
    super(message);
    this.name = 'SecurityValidationError';
  }
}

/**
 * Validates that a string contains only alphanumeric characters, hyphens, underscores, and forward slashes
 * Prevents injection attacks through special characters
 */
function isValidIdentifier(value: string): boolean {
  // Allow alphanumeric, hyphen, underscore, forward slash, and period
  const validPattern = /^[a-zA-Z0-9\-_\/\.]+$/;
  return validPattern.test(value);
}

/**
 * Sanitizes a string by removing potentially dangerous characters
 * Used as a fallback when strict validation is too restrictive
 */
function sanitizeString(value: string, maxLength: number = 256): string {
  // Remove control characters and limit length
  return value
    .replace(/[\x00-\x1F\x7F-\x9F]/g, '') // Remove control characters
    .replace(/[<>\"']/g, '') // Remove HTML/script injection characters
    .substring(0, maxLength)
    .trim();
}

/**
 * Validates and sanitizes a namespace parameter
 */
export function validateNamespace(namespace: string): AllowedNamespace {
  if (!namespace) {
    throw new SecurityValidationError(
      'Namespace is required',
      'namespace',
      namespace,
      'missing_value'
    );
  }

  if (namespace.length > LIMITS.MAX_NAMESPACE_LENGTH) {
    throw new SecurityValidationError(
      `Namespace exceeds maximum length of ${LIMITS.MAX_NAMESPACE_LENGTH}`,
      'namespace',
      namespace,
      'length_exceeded'
    );
  }

  if (!isValidIdentifier(namespace)) {
    throw new SecurityValidationError(
      'Namespace contains invalid characters',
      'namespace',
      namespace,
      'invalid_characters'
    );
  }

  if (!ALLOWED_NAMESPACES.includes(namespace as AllowedNamespace)) {
    throw new SecurityValidationError(
      `Namespace '${namespace}' is not in the allowed list`,
      'namespace',
      namespace,
      'unauthorized_namespace'
    );
  }

  return namespace as AllowedNamespace;
}

/**
 * Validates a metric name for a given namespace
 */
export function validateMetricName(metricName: string, namespace: AllowedNamespace): string {
  if (!metricName) {
    throw new SecurityValidationError(
      'Metric name is required',
      'metricName',
      metricName,
      'missing_value'
    );
  }

  if (metricName.length > LIMITS.MAX_METRIC_NAME_LENGTH) {
    throw new SecurityValidationError(
      `Metric name exceeds maximum length of ${LIMITS.MAX_METRIC_NAME_LENGTH}`,
      'metricName',
      metricName,
      'length_exceeded'
    );
  }

  if (!isValidIdentifier(metricName)) {
    throw new SecurityValidationError(
      'Metric name contains invalid characters',
      'metricName',
      metricName,
      'invalid_characters'
    );
  }

  const allowedMetrics = ALLOWED_METRICS[namespace];
  if (!allowedMetrics.includes(metricName as any)) {
    throw new SecurityValidationError(
      `Metric '${metricName}' is not allowed for namespace '${namespace}'`,
      'metricName',
      metricName,
      'unauthorized_metric'
    );
  }

  return metricName;
}

/**
 * Validates a dimension name for a given namespace
 */
export function validateDimensionName(
  dimensionName: string,
  namespace: AllowedNamespace
): string {
  if (!dimensionName) {
    throw new SecurityValidationError(
      'Dimension name is required',
      'dimensionName',
      dimensionName,
      'missing_value'
    );
  }

  if (!isValidIdentifier(dimensionName)) {
    throw new SecurityValidationError(
      'Dimension name contains invalid characters',
      'dimensionName',
      dimensionName,
      'invalid_characters'
    );
  }

  const allowedDimensions = ALLOWED_DIMENSIONS[namespace];
  if (!allowedDimensions.includes(dimensionName as any)) {
    throw new SecurityValidationError(
      `Dimension '${dimensionName}' is not allowed for namespace '${namespace}'`,
      'dimensionName',
      dimensionName,
      'unauthorized_dimension'
    );
  }

  return dimensionName;
}

/**
 * Validates and sanitizes a dimension value
 * Enforces resource ownership when applicable
 */
export function validateDimensionValue(
  dimensionName: string,
  dimensionValue: string,
  userContext?: UserContext
): string {
  if (!dimensionValue) {
    throw new SecurityValidationError(
      'Dimension value is required',
      'dimensionValue',
      dimensionValue,
      'missing_value'
    );
  }

  if (dimensionValue.length > LIMITS.MAX_DIMENSION_VALUE_LENGTH) {
    throw new SecurityValidationError(
      `Dimension value exceeds maximum length of ${LIMITS.MAX_DIMENSION_VALUE_LENGTH}`,
      'dimensionValue',
      dimensionValue,
      'length_exceeded'
    );
  }

  // Sanitize the value to prevent injection
  const sanitized = sanitizeString(dimensionValue, LIMITS.MAX_DIMENSION_VALUE_LENGTH);

  // Enforce resource ownership for Function dimensions
  if (dimensionName === 'Function' || dimensionName === 'FunctionName') {
    validateFunctionAccess(sanitized, userContext);
  }

  return sanitized;
}

/**
 * User context for authorization checks
 * In a production system, this would include authenticated user ID and roles
 */
export interface UserContext {
  userId?: string;
  allowedFunctions?: string[];
  isAdmin?: boolean;
}

/**
 * Validates that a user has access to query metrics for a specific function
 */
export function validateFunctionAccess(
  functionName: string,
  userContext?: UserContext
): void {
  // Validate against allowed functions list
  if (!ALLOWED_FUNCTIONS.includes(functionName as any)) {
    throw new SecurityValidationError(
      `Function '${functionName}' is not in the allowed list`,
      'functionName',
      functionName,
      'unauthorized_function'
    );
  }

  // If user context is provided, enforce per-user restrictions
  if (userContext && !userContext.isAdmin) {
    if (userContext.allowedFunctions && userContext.allowedFunctions.length > 0) {
      if (!userContext.allowedFunctions.includes(functionName)) {
        throw new SecurityValidationError(
          `User does not have access to function '${functionName}'`,
          'functionName',
          functionName,
          'access_denied'
        );
      }
    }
  }
}

/**
 * Validates metric data before publishing to CloudWatch
 */
export function validateMetricData(
  namespace: string,
  metricData: MetricDatum[],
  userContext?: UserContext
): void {
  // Validate namespace
  const validatedNamespace = validateNamespace(namespace);

  // Check metric count limit
  if (metricData.length > LIMITS.MAX_METRIC_DATA_POINTS) {
    throw new SecurityValidationError(
      `Cannot publish more than ${LIMITS.MAX_METRIC_DATA_POINTS} metrics at once`,
      'metricData',
      metricData.length,
      'limit_exceeded'
    );
  }

  // Validate each metric
  for (const metric of metricData) {
    if (!metric.MetricName) {
      throw new SecurityValidationError(
        'Metric name is required',
        'MetricName',
        metric,
        'missing_value'
      );
    }

    // Validate metric name
    validateMetricName(metric.MetricName, validatedNamespace);

    // Validate dimensions
    if (metric.Dimensions) {
      if (metric.Dimensions.length > LIMITS.MAX_DIMENSIONS_PER_METRIC) {
        throw new SecurityValidationError(
          `Metric cannot have more than ${LIMITS.MAX_DIMENSIONS_PER_METRIC} dimensions`,
          'Dimensions',
          metric.Dimensions,
          'limit_exceeded'
        );
      }

      for (const dimension of metric.Dimensions) {
        if (!dimension.Name || !dimension.Value) {
          throw new SecurityValidationError(
            'Dimension name and value are required',
            'Dimensions',
            dimension,
            'missing_value'
          );
        }

        // Validate dimension name
        validateDimensionName(dimension.Name, validatedNamespace);

        // Validate and sanitize dimension value
        dimension.Value = validateDimensionValue(dimension.Name, dimension.Value, userContext);
      }
    }

    // Validate value or values
    if (metric.Value === undefined && !metric.Values) {
      throw new SecurityValidationError(
        'Metric must have either Value or Values',
        'Value',
        metric,
        'missing_value'
      );
    }

    // Validate timestamp if provided
    if (metric.Timestamp) {
      const now = Date.now();
      const metricTime = metric.Timestamp.getTime();
      const twoWeeksAgo = now - 14 * 24 * 60 * 60 * 1000;
      const twoHoursAhead = now + 2 * 60 * 60 * 1000;

      if (metricTime < twoWeeksAgo || metricTime > twoHoursAhead) {
        throw new SecurityValidationError(
          'Metric timestamp must be within the last 2 weeks and not more than 2 hours in the future',
          'Timestamp',
          metric.Timestamp,
          'invalid_timestamp'
        );
      }
    }
  }
}

/**
 * Creates a sanitized error message for logging
 * Removes sensitive information from error messages
 */
export function sanitizeErrorMessage(error: any): string {
  if (!error) {
    return 'Unknown error';
  }

  let message = error.message || String(error);

  // Remove potential sensitive patterns
  message = message
    .replace(/api[_-]?key[s]?[:=]\s*[^\s]+/gi, 'api_key=***')
    .replace(/token[s]?[:=]\s*[^\s]+/gi, 'token=***')
    .replace(/password[s]?[:=]\s*[^\s]+/gi, 'password=***')
    .replace(/secret[s]?[:=]\s*[^\s]+/gi, 'secret=***');

  return message;
}

/**
 * Logs security validation errors for monitoring
 */
export function logSecurityEvent(
  eventType: 'validation_error' | 'access_denied' | 'suspicious_activity',
  details: Record<string, any>
): void {
  const sanitizedDetails = {
    ...details,
    timestamp: new Date().toISOString(),
    eventType,
  };

  // Log as structured JSON for CloudWatch Logs Insights
  console.warn('SECURITY_EVENT:', JSON.stringify(sanitizedDetails));
}

/**
 * Rate limiter to prevent abuse
 * In production, this should be backed by Redis or DynamoDB
 */
class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(windowMs: number = 60000, maxRequests: number = 100) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }

  checkLimit(identifier: string): boolean {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Get existing requests for this identifier
    let requests = this.requests.get(identifier) || [];

    // Remove old requests outside the window
    requests = requests.filter((timestamp) => timestamp > windowStart);

    // Check if limit is exceeded
    if (requests.length >= this.maxRequests) {
      this.requests.set(identifier, requests);
      return false;
    }

    // Add current request
    requests.push(now);
    this.requests.set(identifier, requests);

    return true;
  }

  cleanup(): void {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Use Array.from to avoid downlevelIteration requirement
    const entries = Array.from(this.requests.entries());
    for (const [identifier, requests] of entries) {
      const filtered = requests.filter((timestamp) => timestamp > windowStart);
      if (filtered.length === 0) {
        this.requests.delete(identifier);
      } else {
        this.requests.set(identifier, filtered);
      }
    }
  }

  clear(): void {
    this.requests.clear();
  }
}

// Global rate limiter instance
// In production, use a distributed rate limiter
export const rateLimiter = new RateLimiter(60000, 100);

// Cleanup old rate limit data every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => rateLimiter.cleanup(), 5 * 60 * 1000);
}

/**
 * Validates rate limit for a given identifier
 */
export function checkRateLimit(identifier: string): void {
  if (!rateLimiter.checkLimit(identifier)) {
    throw new SecurityValidationError(
      'Rate limit exceeded',
      'rateLimit',
      identifier,
      'rate_limit_exceeded'
    );
  }
}

/**
 * Validates a batch of metric data for multiple namespaces
 * Used for batched metric publishing to CloudWatch
 */
export function validateMetricDataBatch(
  metricBatch: Array<{ namespace: string; metricData: MetricDatum[] }>,
  userContext?: UserContext
): void {
  // Validate total batch size doesn't exceed CloudWatch limits
  const totalMetrics = metricBatch.reduce(
    (sum, item) => sum + item.metricData.length,
    0
  );

  if (totalMetrics > LIMITS.MAX_METRIC_DATA_POINTS) {
    throw new SecurityValidationError(
      `Batch cannot contain more than ${LIMITS.MAX_METRIC_DATA_POINTS} total metrics`,
      'metricBatch',
      totalMetrics,
      'limit_exceeded'
    );
  }

  // Validate each namespace's metrics
  for (const item of metricBatch) {
    validateMetricData(item.namespace, item.metricData, userContext);
  }
}

/**
 * Validates namespace for video upload metrics
 * Extension to support ShadowSky/VideoUpload namespace
 */
const VIDEO_UPLOAD_NAMESPACE = 'ShadowSky/VideoUpload';

export function validateVideoUploadNamespace(namespace: string): string {
  if (namespace === VIDEO_UPLOAD_NAMESPACE) {
    return namespace;
  }
  // Fall back to standard validation
  return validateNamespace(namespace);
}

/**
 * Allowed metrics for video upload namespace
 */
const VIDEO_UPLOAD_METRICS = [
  'UploadDuration',
  'BandwidthUtilization',
  'TranscodingWaitTime',
  'RetryAttempts',
  'UploadCount',
] as const;

/**
 * Validates metric name for video upload namespace
 */
export function validateVideoUploadMetric(metricName: string): string {
  if (!metricName) {
    throw new SecurityValidationError(
      'Metric name is required',
      'metricName',
      metricName,
      'missing_value'
    );
  }

  if (metricName.length > LIMITS.MAX_METRIC_NAME_LENGTH) {
    throw new SecurityValidationError(
      `Metric name exceeds maximum length of ${LIMITS.MAX_METRIC_NAME_LENGTH}`,
      'metricName',
      metricName,
      'length_exceeded'
    );
  }

  if (!isValidIdentifier(metricName)) {
    throw new SecurityValidationError(
      'Metric name contains invalid characters',
      'metricName',
      metricName,
      'invalid_characters'
    );
  }

  if (!VIDEO_UPLOAD_METRICS.includes(metricName as any)) {
    throw new SecurityValidationError(
      `Metric '${metricName}' is not allowed for video upload namespace`,
      'metricName',
      metricName,
      'unauthorized_metric'
    );
  }

  return metricName;
}
