/**
 * CloudWatch Dashboard Configuration Validation
 *
 * Implements strict schema validation to prevent injection attacks and ensure
 * all dashboard configurations contain only expected, safe properties.
 *
 * Security Features:
 * - Validates all metric names, dimensions, and statistics
 * - Prevents SQL-like injection in metric queries
 * - Ensures alarm thresholds are numeric and within safe ranges
 * - Validates ARNs and topic references
 * - Whitelist-based validation for all configuration properties
 */

import { z } from 'zod';

// Allowed CloudWatch statistic types
const ALLOWED_STATISTICS = [
  'Average',
  'Sum',
  'Minimum',
  'Maximum',
  'SampleCount',
  'p50',
  'p90',
  'p95',
  'p99',
  'p99.9',
] as const;

// Allowed comparison operators
const ALLOWED_COMPARISON_OPERATORS = [
  'GreaterThanOrEqualToThreshold',
  'GreaterThanThreshold',
  'LessThanThreshold',
  'LessThanOrEqualToThreshold',
  'LessThanLowerOrGreaterThanUpperThreshold',
  'LessThanLowerThreshold',
  'GreaterThanUpperThreshold',
] as const;

// Allowed treat missing data behaviors
const ALLOWED_TREAT_MISSING_DATA = [
  'breaching',
  'notBreaching',
  'ignore',
  'missing',
] as const;

// Allowed standard units
const ALLOWED_UNITS = [
  'Seconds',
  'Microseconds',
  'Milliseconds',
  'Bytes',
  'Kilobytes',
  'Megabytes',
  'Gigabytes',
  'Terabytes',
  'Bits',
  'Kilobits',
  'Megabits',
  'Gigabits',
  'Terabits',
  'Percent',
  'Count',
  'Bytes/Second',
  'Kilobytes/Second',
  'Megabytes/Second',
  'Gigabytes/Second',
  'Terabytes/Second',
  'Bits/Second',
  'Kilobits/Second',
  'Megabits/Second',
  'Gigabits/Second',
  'Terabits/Second',
  'Count/Second',
  'None',
] as const;

/**
 * Validates that a string contains only alphanumeric characters, hyphens, underscores, and forward slashes
 * Prevents injection attacks through metric names and namespaces
 */
const SafeIdentifierSchema = z
  .string()
  .min(1)
  .max(255)
  .regex(
    /^[a-zA-Z0-9\-_\/\.]+$/,
    'Must contain only alphanumeric characters, hyphens, underscores, dots, and forward slashes'
  )
  .refine(
    (val) => !val.includes('..'),
    'Path traversal patterns (..) are not allowed'
  );

/**
 * Validates dimension names - more restrictive than general identifiers
 */
const DimensionNameSchema = z
  .string()
  .min(1)
  .max(255)
  .regex(
    /^[a-zA-Z][a-zA-Z0-9\-_]*$/,
    'Dimension name must start with a letter and contain only alphanumeric characters, hyphens, and underscores'
  );

/**
 * Validates dimension values - allows more characters but still restricted
 */
const DimensionValueSchema = z
  .string()
  .min(1)
  .max(255)
  .regex(
    /^[a-zA-Z0-9\-_\.\:\/\s]+$/,
    'Dimension value must contain only safe characters'
  )
  .refine(
    (val) => !val.includes('\n') && !val.includes('\r'),
    'Newline characters are not allowed'
  );

/**
 * Schema for metric dimension key-value pairs
 */
const DimensionSchema = z.object({
  Name: DimensionNameSchema,
  Value: DimensionValueSchema,
});

/**
 * Schema for CloudWatch metric configuration
 */
export const MetricConfigSchema = z.object({
  namespace: SafeIdentifierSchema,
  metricName: SafeIdentifierSchema,
  statistic: z.enum(ALLOWED_STATISTICS),
  dimensionsMap: z.record(DimensionNameSchema, DimensionValueSchema).optional(),
  label: z.string().min(1).max(255).optional(),
  color: z
    .string()
    .regex(
      /^#[0-9a-fA-F]{6}$/,
      'Color must be a valid hex color code (e.g., #1f77b4)'
    )
    .optional(),
});

/**
 * Schema for widget configuration
 */
export const WidgetConfigSchema = z.object({
  title: z.string().min(1).max(255),
  width: z.number().int().min(1).max(24),
  height: z.number().int().min(1).max(1000),
  metrics: z.array(MetricConfigSchema).min(1).max(100),
});

/**
 * Schema for alarm configuration
 */
export const AlarmConfigSchema = z.object({
  alarmName: SafeIdentifierSchema,
  alarmDescription: z.string().min(1).max(1024).optional(),
  metric: MetricConfigSchema,
  threshold: z.number().finite(),
  evaluationPeriods: z.number().int().min(1).max(5),
  comparisonOperator: z.enum(ALLOWED_COMPARISON_OPERATORS),
  treatMissingData: z.enum(ALLOWED_TREAT_MISSING_DATA),
  actionsEnabled: z.boolean().optional().default(true),
});

/**
 * Schema for dashboard configuration
 */
export const DashboardConfigSchema = z.object({
  dashboardName: SafeIdentifierSchema,
  widgets: z.array(WidgetConfigSchema).min(1).max(500),
});

/**
 * Schema for SNS topic ARN validation
 */
export const SnsTopicArnSchema = z
  .string()
  .regex(
    /^arn:aws:sns:[a-z0-9\-]+:\d{12}:[a-zA-Z0-9\-_]+$/,
    'Must be a valid SNS topic ARN'
  );

/**
 * Schema for metric data validation (used in metrics publishing)
 */
export const MetricDataSchema = z.object({
  MetricName: SafeIdentifierSchema,
  Value: z.number().finite(),
  Unit: z.enum(ALLOWED_UNITS),
  Timestamp: z.date(),
  Dimensions: z.array(DimensionSchema).max(30).optional(),
});

/**
 * Schema for put metric data request
 */
export const PutMetricDataSchema = z.object({
  Namespace: SafeIdentifierSchema,
  MetricData: z.array(MetricDataSchema).min(1).max(1000),
});

/**
 * Type exports for TypeScript
 */
export type MetricConfig = z.infer<typeof MetricConfigSchema>;
export type WidgetConfig = z.infer<typeof WidgetConfigSchema>;
export type AlarmConfig = z.infer<typeof AlarmConfigSchema>;
export type DashboardConfig = z.infer<typeof DashboardConfigSchema>;
export type MetricData = z.infer<typeof MetricDataSchema>;
export type PutMetricDataRequest = z.infer<typeof PutMetricDataSchema>;

/**
 * Validation error class for security violations
 */
export class DashboardValidationError extends Error {
  constructor(
    message: string,
    public readonly zodError?: z.ZodError
  ) {
    super(message);
    this.name = 'DashboardValidationError';
  }
}

/**
 * Validates a metric configuration and throws on validation failure
 */
export function validateMetricConfig(config: unknown): MetricConfig {
  try {
    return MetricConfigSchema.parse(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new DashboardValidationError(
        `Invalid metric configuration: ${error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
        error
      );
    }
    throw error;
  }
}

/**
 * Validates a widget configuration and throws on validation failure
 */
export function validateWidgetConfig(config: unknown): WidgetConfig {
  try {
    return WidgetConfigSchema.parse(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new DashboardValidationError(
        `Invalid widget configuration: ${error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
        error
      );
    }
    throw error;
  }
}

/**
 * Validates an alarm configuration and throws on validation failure
 */
export function validateAlarmConfig(config: unknown): AlarmConfig {
  try {
    return AlarmConfigSchema.parse(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new DashboardValidationError(
        `Invalid alarm configuration: ${error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
        error
      );
    }
    throw error;
  }
}

/**
 * Validates a dashboard configuration and throws on validation failure
 */
export function validateDashboardConfig(config: unknown): DashboardConfig {
  try {
    return DashboardConfigSchema.parse(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new DashboardValidationError(
        `Invalid dashboard configuration: ${error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
        error
      );
    }
    throw error;
  }
}

/**
 * Validates metric data before publishing to CloudWatch
 */
export function validateMetricData(data: unknown): PutMetricDataRequest {
  try {
    return PutMetricDataSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new DashboardValidationError(
        `Invalid metric data: ${error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
        error
      );
    }
    throw error;
  }
}

/**
 * Validates an SNS topic ARN
 */
export function validateSnsTopicArn(arn: unknown): string {
  try {
    return SnsTopicArnSchema.parse(arn);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new DashboardValidationError(
        `Invalid SNS topic ARN: ${error.errors.map((e) => e.message).join(', ')}`,
        error
      );
    }
    throw error;
  }
}

/**
 * Safe parsing functions that return validation results without throwing
 */
export const safeValidation = {
  metricConfig: (config: unknown) => MetricConfigSchema.safeParse(config),
  widgetConfig: (config: unknown) => WidgetConfigSchema.safeParse(config),
  alarmConfig: (config: unknown) => AlarmConfigSchema.safeParse(config),
  dashboardConfig: (config: unknown) => DashboardConfigSchema.safeParse(config),
  metricData: (data: unknown) => PutMetricDataSchema.safeParse(data),
  snsTopicArn: (arn: unknown) => SnsTopicArnSchema.safeParse(arn),
};
