/**
 * CloudWatch Dashboard Configuration
 *
 * Defines dashboards and alarms for monitoring Anthropic API performance.
 */

import { Dashboard, GraphWidget, SingleValueWidget, Alarm, ComparisonOperator, TreatMissingData } from 'aws-cdk-lib/aws-cloudwatch';
import { Stack } from 'aws-cdk-lib';
import { SnsAction } from 'aws-cdk-lib/aws-cloudwatch-actions';
import { Topic } from 'aws-cdk-lib/aws-sns';

const NAMESPACE = 'ShadowSky/AnthropicAPI';

/**
 * Creates a CloudWatch dashboard for Anthropic API monitoring
 */
export function createAnthropicDashboard(stack: Stack): Dashboard {
  const dashboard = new Dashboard(stack, 'AnthropicAPIDashboard', {
    dashboardName: 'ShadowSky-Anthropic-API-Performance',
  });

  // API Latency widget (p50, p95, p99)
  dashboard.addWidgets(
    new GraphWidget({
      title: 'API Latency (ms)',
      width: 12,
      height: 6,
      left: [
        {
          namespace: NAMESPACE,
          metricName: 'APILatency',
          statistic: 'p50',
          label: 'p50',
        },
        {
          namespace: NAMESPACE,
          metricName: 'APILatency',
          statistic: 'p95',
          label: 'p95',
        },
        {
          namespace: NAMESPACE,
          metricName: 'APILatency',
          statistic: 'p99',
          label: 'p99',
        },
      ],
    })
  );

  // Request volume and success rate
  dashboard.addWidgets(
    new GraphWidget({
      title: 'Request Volume',
      width: 12,
      height: 6,
      left: [
        {
          namespace: NAMESPACE,
          metricName: 'RequestCount',
          statistic: 'Sum',
          dimensionsMap: { Status: 'Success' },
          label: 'Success',
          color: '#2ca02c',
        },
        {
          namespace: NAMESPACE,
          metricName: 'RequestCount',
          statistic: 'Sum',
          dimensionsMap: { Status: 'Error' },
          label: 'Error',
          color: '#d62728',
        },
      ],
    })
  );

  // Token usage widgets
  dashboard.addWidgets(
    new GraphWidget({
      title: 'Token Usage',
      width: 12,
      height: 6,
      left: [
        {
          namespace: NAMESPACE,
          metricName: 'InputTokens',
          statistic: 'Sum',
          label: 'Input Tokens',
          color: '#1f77b4',
        },
        {
          namespace: NAMESPACE,
          metricName: 'OutputTokens',
          statistic: 'Sum',
          label: 'Output Tokens',
          color: '#ff7f0e',
        },
      ],
    })
  );

  // Error breakdown by type
  dashboard.addWidgets(
    new GraphWidget({
      title: 'Errors by Type',
      width: 12,
      height: 6,
      left: [
        {
          namespace: NAMESPACE,
          metricName: 'ErrorsByType',
          statistic: 'Sum',
          dimensionsMap: { ErrorType: 'Timeout' },
          label: 'Timeout',
        },
        {
          namespace: NAMESPACE,
          metricName: 'ErrorsByType',
          statistic: 'Sum',
          dimensionsMap: { ErrorType: 'RateLimit' },
          label: 'Rate Limit',
        },
        {
          namespace: NAMESPACE,
          metricName: 'ErrorsByType',
          statistic: 'Sum',
          dimensionsMap: { ErrorType: 'ServerError' },
          label: 'Server Error',
        },
        {
          namespace: NAMESPACE,
          metricName: 'ErrorsByType',
          statistic: 'Sum',
          dimensionsMap: { ErrorType: 'NetworkError' },
          label: 'Network Error',
        },
      ],
    })
  );

  // Single value widgets for key metrics
  dashboard.addWidgets(
    new SingleValueWidget({
      title: 'Current Error Rate',
      width: 6,
      height: 3,
      metrics: [
        {
          namespace: NAMESPACE,
          metricName: 'ErrorRate',
          statistic: 'Average',
        },
      ],
    })
  );

  dashboard.addWidgets(
    new SingleValueWidget({
      title: 'Total Timeouts (24h)',
      width: 6,
      height: 3,
      metrics: [
        {
          namespace: NAMESPACE,
          metricName: 'Timeouts',
          statistic: 'Sum',
        },
      ],
    })
  );

  return dashboard;
}

/**
 * Creates CloudWatch alarms for critical metrics
 */
export function createAnthropicAlarms(stack: Stack, alertTopic?: Topic): Alarm[] {
  const alarms: Alarm[] = [];

  // Alarm for high latency (p99 > 5000ms)
  const highLatencyAlarm = new Alarm(stack, 'AnthropicHighLatencyAlarm', {
    alarmName: 'ShadowSky-Anthropic-HighLatency',
    alarmDescription: 'Alert when p99 API latency exceeds 5 seconds',
    metric: {
      namespace: NAMESPACE,
      metricName: 'APILatency',
      statistic: 'p99',
    },
    threshold: 5000,
    evaluationPeriods: 2,
    comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
    treatMissingData: TreatMissingData.NOT_BREACHING,
  });

  alarms.push(highLatencyAlarm);

  // Alarm for high error rate (> 5%)
  const highErrorRateAlarm = new Alarm(stack, 'AnthropicHighErrorRateAlarm', {
    alarmName: 'ShadowSky-Anthropic-HighErrorRate',
    alarmDescription: 'Alert when error rate exceeds 5%',
    metric: {
      namespace: NAMESPACE,
      metricName: 'ErrorRate',
      statistic: 'Average',
    },
    threshold: 0.05,
    evaluationPeriods: 3,
    comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
    treatMissingData: TreatMissingData.NOT_BREACHING,
  });

  alarms.push(highErrorRateAlarm);

  // Alarm for timeouts
  const timeoutAlarm = new Alarm(stack, 'AnthropicTimeoutAlarm', {
    alarmName: 'ShadowSky-Anthropic-Timeouts',
    alarmDescription: 'Alert when timeouts occur',
    metric: {
      namespace: NAMESPACE,
      metricName: 'Timeouts',
      statistic: 'Sum',
    },
    threshold: 5,
    evaluationPeriods: 1,
    comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
    treatMissingData: TreatMissingData.NOT_BREACHING,
  });

  alarms.push(timeoutAlarm);

  // Add SNS actions if topic is provided
  if (alertTopic) {
    alarms.forEach(alarm => {
      alarm.addAlarmAction(new SnsAction(alertTopic));
    });
  }

  return alarms;
}
