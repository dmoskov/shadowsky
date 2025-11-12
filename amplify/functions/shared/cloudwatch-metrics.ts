/**
 * CloudWatch Metrics Utility
 *
 * Provides structured performance monitoring for Anthropic API calls.
 * Tracks latency, token usage, error rates, and timeout occurrences.
 */

import { CloudWatchClient, PutMetricDataCommand, MetricDatum, StandardUnit } from '@aws-sdk/client-cloudwatch';

const cloudwatch = new CloudWatchClient({ region: process.env.AWS_REGION || 'us-east-1' });

const NAMESPACE = 'ShadowSky/AnthropicAPI';

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
 * Publishes performance metrics to CloudWatch
 */
export async function publishMetrics(metrics: APIMetrics): Promise<void> {
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

  try {
    const command = new PutMetricDataCommand({
      Namespace: NAMESPACE,
      MetricData: metricData,
    });

    await cloudwatch.send(command);
  } catch (error) {
    // Log but don't throw - metrics should never break the main flow
    console.error('Failed to publish CloudWatch metrics:', error);
  }
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
