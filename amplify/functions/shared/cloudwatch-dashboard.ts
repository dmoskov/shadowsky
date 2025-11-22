/**
 * CloudWatch Dashboard Configuration
 *
 * Defines dashboards and alarms for monitoring Anthropic API performance.
 * Includes security validation to prevent injection attacks.
 */

import { Dashboard, GraphWidget, SingleValueWidget, Alarm, ComparisonOperator, TreatMissingData, Metric } from 'aws-cdk-lib/aws-cloudwatch';
import { Stack } from 'aws-cdk-lib';
import { SnsAction } from 'aws-cdk-lib/aws-cloudwatch-actions';
import { Topic } from 'aws-cdk-lib/aws-sns';
import {
  validateAlarmConfig,
  DashboardValidationError,
  AlarmConfig,
} from './cloudwatch-validation';

const NAMESPACE = 'ShadowSky/AnthropicAPI';

/**
 * Validates the namespace to prevent injection attacks
 */
function validateNamespace(namespace: string): void {
  if (!/^[a-zA-Z0-9\-_\/\.]+$/.test(namespace)) {
    throw new DashboardValidationError(
      'Invalid namespace format - must contain only alphanumeric characters, hyphens, underscores, dots, and forward slashes'
    );
  }
  if (namespace.length > 255) {
    throw new DashboardValidationError(
      'Namespace exceeds maximum length of 255 characters'
    );
  }
}

/**
 * Creates a CloudWatch dashboard for Anthropic API monitoring
 * Validates all configuration to prevent injection attacks
 */
export function createAnthropicDashboard(stack: Stack): Dashboard {
  validateNamespace(NAMESPACE);

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
        new Metric({
          namespace: NAMESPACE,
          metricName: 'APILatency',
          statistic: 'p50',
          label: 'p50',
        }),
        new Metric({
          namespace: NAMESPACE,
          metricName: 'APILatency',
          statistic: 'p95',
          label: 'p95',
        }),
        new Metric({
          namespace: NAMESPACE,
          metricName: 'APILatency',
          statistic: 'p99',
          label: 'p99',
        }),
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
        new Metric({
          namespace: NAMESPACE,
          metricName: 'RequestCount',
          statistic: 'Sum',
          dimensionsMap: { Status: 'Success' },
          label: 'Success',
          color: '#2ca02c',
        }),
        new Metric({
          namespace: NAMESPACE,
          metricName: 'RequestCount',
          statistic: 'Sum',
          dimensionsMap: { Status: 'Error' },
          label: 'Error',
          color: '#d62728',
        }),
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
        new Metric({
          namespace: NAMESPACE,
          metricName: 'InputTokens',
          statistic: 'Sum',
          label: 'Input Tokens',
          color: '#1f77b4',
        }),
        new Metric({
          namespace: NAMESPACE,
          metricName: 'OutputTokens',
          statistic: 'Sum',
          label: 'Output Tokens',
          color: '#ff7f0e',
        }),
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
        new Metric({
          namespace: NAMESPACE,
          metricName: 'ErrorsByType',
          statistic: 'Sum',
          dimensionsMap: { ErrorType: 'Timeout' },
          label: 'Timeout',
        }),
        new Metric({
          namespace: NAMESPACE,
          metricName: 'ErrorsByType',
          statistic: 'Sum',
          dimensionsMap: { ErrorType: 'RateLimit' },
          label: 'Rate Limit',
        }),
        new Metric({
          namespace: NAMESPACE,
          metricName: 'ErrorsByType',
          statistic: 'Sum',
          dimensionsMap: { ErrorType: 'ServerError' },
          label: 'Server Error',
        }),
        new Metric({
          namespace: NAMESPACE,
          metricName: 'ErrorsByType',
          statistic: 'Sum',
          dimensionsMap: { ErrorType: 'NetworkError' },
          label: 'Network Error',
        }),
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
        new Metric({
          namespace: NAMESPACE,
          metricName: 'ErrorRate',
          statistic: 'Average',
        }),
      ],
    })
  );

  dashboard.addWidgets(
    new SingleValueWidget({
      title: 'Total Timeouts (24h)',
      width: 6,
      height: 3,
      metrics: [
        new Metric({
          namespace: NAMESPACE,
          metricName: 'Timeouts',
          statistic: 'Sum',
        }),
      ],
    })
  );

  return dashboard;
}

/**
 * Creates CloudWatch alarms for critical metrics
 * Validates all alarm configurations to prevent injection attacks
 */
export function createAnthropicAlarms(stack: Stack, alertTopic?: Topic): Alarm[] {
  validateNamespace(NAMESPACE);

  const alarms: Alarm[] = [];

  const highLatencyConfig: AlarmConfig = {
    alarmName: 'ShadowSky-Anthropic-HighLatency',
    alarmDescription: 'Alert when p99 API latency exceeds 5 seconds',
    metric: {
      namespace: NAMESPACE,
      metricName: 'APILatency',
      statistic: 'p99',
    },
    threshold: 5000,
    evaluationPeriods: 2,
    comparisonOperator: 'GreaterThanThreshold',
    treatMissingData: 'notBreaching',
    actionsEnabled: true,
  };

  validateAlarmConfig(highLatencyConfig);

  const highLatencyAlarm = new Alarm(stack, 'AnthropicHighLatencyAlarm', {
    alarmName: highLatencyConfig.alarmName,
    alarmDescription: highLatencyConfig.alarmDescription,
    metric: new Metric({
      namespace: highLatencyConfig.metric.namespace,
      metricName: highLatencyConfig.metric.metricName,
      statistic: highLatencyConfig.metric.statistic,
    }),
    threshold: highLatencyConfig.threshold,
    evaluationPeriods: highLatencyConfig.evaluationPeriods,
    comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
    treatMissingData: TreatMissingData.NOT_BREACHING,
  });

  alarms.push(highLatencyAlarm);

  const highErrorRateConfig: AlarmConfig = {
    alarmName: 'ShadowSky-Anthropic-HighErrorRate',
    alarmDescription: 'Alert when error rate exceeds 5%',
    metric: {
      namespace: NAMESPACE,
      metricName: 'ErrorRate',
      statistic: 'Average',
    },
    threshold: 0.05,
    evaluationPeriods: 3,
    comparisonOperator: 'GreaterThanThreshold',
    treatMissingData: 'notBreaching',
    actionsEnabled: true,
  };

  validateAlarmConfig(highErrorRateConfig);

  const highErrorRateAlarm = new Alarm(stack, 'AnthropicHighErrorRateAlarm', {
    alarmName: highErrorRateConfig.alarmName,
    alarmDescription: highErrorRateConfig.alarmDescription,
    metric: new Metric({
      namespace: highErrorRateConfig.metric.namespace,
      metricName: highErrorRateConfig.metric.metricName,
      statistic: highErrorRateConfig.metric.statistic,
    }),
    threshold: highErrorRateConfig.threshold,
    evaluationPeriods: highErrorRateConfig.evaluationPeriods,
    comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
    treatMissingData: TreatMissingData.NOT_BREACHING,
  });

  alarms.push(highErrorRateAlarm);

  const timeoutConfig: AlarmConfig = {
    alarmName: 'ShadowSky-Anthropic-Timeouts',
    alarmDescription: 'Alert when timeouts occur',
    metric: {
      namespace: NAMESPACE,
      metricName: 'Timeouts',
      statistic: 'Sum',
    },
    threshold: 5,
    evaluationPeriods: 1,
    comparisonOperator: 'GreaterThanThreshold',
    treatMissingData: 'notBreaching',
    actionsEnabled: true,
  };

  validateAlarmConfig(timeoutConfig);

  const timeoutAlarm = new Alarm(stack, 'AnthropicTimeoutAlarm', {
    alarmName: timeoutConfig.alarmName,
    alarmDescription: timeoutConfig.alarmDescription,
    metric: new Metric({
      namespace: timeoutConfig.metric.namespace,
      metricName: timeoutConfig.metric.metricName,
      statistic: timeoutConfig.metric.statistic,
    }),
    threshold: timeoutConfig.threshold,
    evaluationPeriods: timeoutConfig.evaluationPeriods,
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
