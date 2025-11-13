/**
 * CloudWatch Dashboard Validation Tests
 *
 * Tests security validation to prevent injection attacks and ensure
 * all dashboard configurations are properly validated.
 */

import { describe, it, expect } from 'vitest';
import {
  validateMetricConfig,
  validateWidgetConfig,
  validateAlarmConfig,
  validateDashboardConfig,
  validateMetricData,
  validateSnsTopicArn,
  DashboardValidationError,
  safeValidation,
} from './cloudwatch-validation';

describe('CloudWatch Validation - Injection Attack Prevention', () => {
  describe('validateMetricConfig', () => {
    it('should accept valid metric configuration', () => {
      const validConfig = {
        namespace: 'ShadowSky/AnthropicAPI',
        metricName: 'APILatency',
        statistic: 'p99' as const,
        label: 'p99 Latency',
      };

      expect(() => validateMetricConfig(validConfig)).not.toThrow();
    });

    it('should reject SQL injection attempts in namespace', () => {
      const maliciousConfig = {
        namespace: "'; DROP TABLE metrics; --",
        metricName: 'APILatency',
        statistic: 'p99' as const,
      };

      expect(() => validateMetricConfig(maliciousConfig)).toThrow(
        DashboardValidationError
      );
    });

    it('should reject command injection in namespace', () => {
      const maliciousConfig = {
        namespace: '$(rm -rf /)',
        metricName: 'APILatency',
        statistic: 'p99' as const,
      };

      expect(() => validateMetricConfig(maliciousConfig)).toThrow(
        DashboardValidationError
      );
    });

    it('should reject XSS attempts in metric name', () => {
      const maliciousConfig = {
        namespace: 'ShadowSky/AnthropicAPI',
        metricName: '<script>alert("xss")</script>',
        statistic: 'p99' as const,
      };

      expect(() => validateMetricConfig(maliciousConfig)).toThrow(
        DashboardValidationError
      );
    });

    it('should reject path traversal attempts', () => {
      const maliciousConfig = {
        namespace: '../../../etc/passwd',
        metricName: 'APILatency',
        statistic: 'p99' as const,
      };

      expect(() => validateMetricConfig(maliciousConfig)).toThrow(
        DashboardValidationError
      );
    });

    it('should reject invalid statistic values', () => {
      const maliciousConfig = {
        namespace: 'ShadowSky/AnthropicAPI',
        metricName: 'APILatency',
        statistic: 'DROP TABLE' as any,
      };

      expect(() => validateMetricConfig(maliciousConfig)).toThrow();
    });

    it('should reject excessively long namespace', () => {
      const maliciousConfig = {
        namespace: 'A'.repeat(300),
        metricName: 'APILatency',
        statistic: 'p99' as const,
      };

      expect(() => validateMetricConfig(maliciousConfig)).toThrow(
        DashboardValidationError
      );
    });

    it('should reject malicious dimension names', () => {
      const maliciousConfig = {
        namespace: 'ShadowSky/AnthropicAPI',
        metricName: 'APILatency',
        statistic: 'p99' as const,
        dimensionsMap: {
          '"; DELETE FROM *; --': 'value',
        },
      };

      expect(() => validateMetricConfig(maliciousConfig)).toThrow(
        DashboardValidationError
      );
    });

    it('should reject malicious color codes', () => {
      const maliciousConfig = {
        namespace: 'ShadowSky/AnthropicAPI',
        metricName: 'APILatency',
        statistic: 'p99' as const,
        color: 'javascript:alert(1)',
      };

      expect(() => validateMetricConfig(maliciousConfig)).toThrow(
        DashboardValidationError
      );
    });

    it('should accept valid hex color codes', () => {
      const validConfig = {
        namespace: 'ShadowSky/AnthropicAPI',
        metricName: 'APILatency',
        statistic: 'p99' as const,
        color: '#1f77b4',
      };

      expect(() => validateMetricConfig(validConfig)).not.toThrow();
    });
  });

  describe('validateAlarmConfig', () => {
    it('should accept valid alarm configuration', () => {
      const validConfig = {
        alarmName: 'HighLatencyAlarm',
        alarmDescription: 'Alert when latency is high',
        metric: {
          namespace: 'ShadowSky/AnthropicAPI',
          metricName: 'APILatency',
          statistic: 'p99' as const,
        },
        threshold: 5000,
        evaluationPeriods: 2,
        comparisonOperator: 'GreaterThanThreshold' as const,
        treatMissingData: 'notBreaching' as const,
      };

      expect(() => validateAlarmConfig(validConfig)).not.toThrow();
    });

    it('should reject infinite threshold values', () => {
      const maliciousConfig = {
        alarmName: 'MaliciousAlarm',
        metric: {
          namespace: 'ShadowSky/AnthropicAPI',
          metricName: 'APILatency',
          statistic: 'p99' as const,
        },
        threshold: Infinity,
        evaluationPeriods: 2,
        comparisonOperator: 'GreaterThanThreshold' as const,
        treatMissingData: 'notBreaching' as const,
      };

      expect(() => validateAlarmConfig(maliciousConfig)).toThrow();
    });

    it('should reject NaN threshold values', () => {
      const maliciousConfig = {
        alarmName: 'MaliciousAlarm',
        metric: {
          namespace: 'ShadowSky/AnthropicAPI',
          metricName: 'APILatency',
          statistic: 'p99' as const,
        },
        threshold: NaN,
        evaluationPeriods: 2,
        comparisonOperator: 'GreaterThanThreshold' as const,
        treatMissingData: 'notBreaching' as const,
      };

      expect(() => validateAlarmConfig(maliciousConfig)).toThrow();
    });

    it('should reject invalid comparison operators', () => {
      const maliciousConfig = {
        alarmName: 'MaliciousAlarm',
        metric: {
          namespace: 'ShadowSky/AnthropicAPI',
          metricName: 'APILatency',
          statistic: 'p99' as const,
        },
        threshold: 5000,
        evaluationPeriods: 2,
        comparisonOperator: 'DROP TABLE alarms' as any,
        treatMissingData: 'notBreaching' as const,
      };

      expect(() => validateAlarmConfig(maliciousConfig)).toThrow();
    });

    it('should reject excessive evaluation periods', () => {
      const maliciousConfig = {
        alarmName: 'MaliciousAlarm',
        metric: {
          namespace: 'ShadowSky/AnthropicAPI',
          metricName: 'APILatency',
          statistic: 'p99' as const,
        },
        threshold: 5000,
        evaluationPeriods: 100,
        comparisonOperator: 'GreaterThanThreshold' as const,
        treatMissingData: 'notBreaching' as const,
      };

      expect(() => validateAlarmConfig(maliciousConfig)).toThrow();
    });

    it('should reject SQL injection in alarm name', () => {
      const maliciousConfig = {
        alarmName: "'; DROP TABLE alarms; --",
        metric: {
          namespace: 'ShadowSky/AnthropicAPI',
          metricName: 'APILatency',
          statistic: 'p99' as const,
        },
        threshold: 5000,
        evaluationPeriods: 2,
        comparisonOperator: 'GreaterThanThreshold' as const,
        treatMissingData: 'notBreaching' as const,
      };

      expect(() => validateAlarmConfig(maliciousConfig)).toThrow(
        DashboardValidationError
      );
    });

    it('should reject alarm description with excessive length', () => {
      const maliciousConfig = {
        alarmName: 'ValidAlarm',
        alarmDescription: 'A'.repeat(2000),
        metric: {
          namespace: 'ShadowSky/AnthropicAPI',
          metricName: 'APILatency',
          statistic: 'p99' as const,
        },
        threshold: 5000,
        evaluationPeriods: 2,
        comparisonOperator: 'GreaterThanThreshold' as const,
        treatMissingData: 'notBreaching' as const,
      };

      expect(() => validateAlarmConfig(maliciousConfig)).toThrow();
    });
  });

  describe('validateDashboardConfig', () => {
    it('should accept valid dashboard configuration', () => {
      const validConfig = {
        dashboardName: 'Anthropic-API-Dashboard',
        widgets: [
          {
            title: 'API Latency',
            width: 12,
            height: 6,
            metrics: [
              {
                namespace: 'ShadowSky/AnthropicAPI',
                metricName: 'APILatency',
                statistic: 'p99' as const,
              },
            ],
          },
        ],
      };

      expect(() => validateDashboardConfig(validConfig)).not.toThrow();
    });

    it('should reject dashboard with excessive widgets', () => {
      const widgets = Array(600).fill({
        title: 'Widget',
        width: 12,
        height: 6,
        metrics: [
          {
            namespace: 'ShadowSky/AnthropicAPI',
            metricName: 'APILatency',
            statistic: 'p99' as const,
          },
        ],
      });

      const maliciousConfig = {
        dashboardName: 'MaliciousDashboard',
        widgets,
      };

      expect(() => validateDashboardConfig(maliciousConfig)).toThrow();
    });

    it('should reject empty widget list', () => {
      const maliciousConfig = {
        dashboardName: 'EmptyDashboard',
        widgets: [],
      };

      expect(() => validateDashboardConfig(maliciousConfig)).toThrow();
    });

    it('should reject widget with invalid dimensions', () => {
      const maliciousConfig = {
        dashboardName: 'Dashboard',
        widgets: [
          {
            title: 'Widget',
            width: 100,
            height: 6,
            metrics: [
              {
                namespace: 'ShadowSky/AnthropicAPI',
                metricName: 'APILatency',
                statistic: 'p99' as const,
              },
            ],
          },
        ],
      };

      expect(() => validateDashboardConfig(maliciousConfig)).toThrow();
    });
  });

  describe('validateMetricData', () => {
    it('should accept valid metric data', () => {
      const validData = {
        Namespace: 'ShadowSky/AnthropicAPI',
        MetricData: [
          {
            MetricName: 'APILatency',
            Value: 123,
            Unit: 'Milliseconds' as const,
            Timestamp: new Date(),
            Dimensions: [
              { Name: 'Function', Value: 'test-function' },
            ],
          },
        ],
      };

      expect(() => validateMetricData(validData)).not.toThrow();
    });

    it('should reject excessive metric data points', () => {
      const metrics = Array(2000).fill({
        MetricName: 'APILatency',
        Value: 123,
        Unit: 'Milliseconds' as const,
        Timestamp: new Date(),
      });

      const maliciousData = {
        Namespace: 'ShadowSky/AnthropicAPI',
        MetricData: metrics,
      };

      expect(() => validateMetricData(maliciousData)).toThrow();
    });

    it('should reject malicious dimension names in metric data', () => {
      const maliciousData = {
        Namespace: 'ShadowSky/AnthropicAPI',
        MetricData: [
          {
            MetricName: 'APILatency',
            Value: 123,
            Unit: 'Milliseconds' as const,
            Timestamp: new Date(),
            Dimensions: [
              { Name: '<script>alert(1)</script>', Value: 'test' },
            ],
          },
        ],
      };

      expect(() => validateMetricData(maliciousData)).toThrow();
    });

    it('should reject excessive dimensions per metric', () => {
      const dimensions = Array(50).fill({ Name: 'Dim', Value: 'Value' });

      const maliciousData = {
        Namespace: 'ShadowSky/AnthropicAPI',
        MetricData: [
          {
            MetricName: 'APILatency',
            Value: 123,
            Unit: 'Milliseconds' as const,
            Timestamp: new Date(),
            Dimensions: dimensions,
          },
        ],
      };

      expect(() => validateMetricData(maliciousData)).toThrow();
    });
  });

  describe('validateSnsTopicArn', () => {
    it('should accept valid SNS topic ARN', () => {
      const validArn = 'arn:aws:sns:us-east-1:123456789012:my-topic';

      expect(() => validateSnsTopicArn(validArn)).not.toThrow();
    });

    it('should reject malformed ARN', () => {
      const maliciousArn = 'not-an-arn';

      expect(() => validateSnsTopicArn(maliciousArn)).toThrow(
        DashboardValidationError
      );
    });

    it('should reject ARN with injection attempts', () => {
      const maliciousArn = "arn:aws:sns:us-east-1:123456789012:'; DROP TABLE topics; --";

      expect(() => validateSnsTopicArn(maliciousArn)).toThrow(
        DashboardValidationError
      );
    });

    it('should reject non-SNS ARN', () => {
      const maliciousArn = 'arn:aws:lambda:us-east-1:123456789012:function:my-function';

      expect(() => validateSnsTopicArn(maliciousArn)).toThrow(
        DashboardValidationError
      );
    });
  });

  describe('safeValidation', () => {
    it('should return success for valid metric config', () => {
      const validConfig = {
        namespace: 'ShadowSky/AnthropicAPI',
        metricName: 'APILatency',
        statistic: 'p99' as const,
      };

      const result = safeValidation.metricConfig(validConfig);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validConfig);
      }
    });

    it('should return error for invalid metric config', () => {
      const invalidConfig = {
        namespace: "'; DROP TABLE metrics; --",
        metricName: 'APILatency',
        statistic: 'p99' as const,
      };

      const result = safeValidation.metricConfig(invalidConfig);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });

    it('should handle null and undefined inputs', () => {
      expect(safeValidation.metricConfig(null).success).toBe(false);
      expect(safeValidation.metricConfig(undefined).success).toBe(false);
    });
  });

  describe('Special Character Injection', () => {
    it('should reject null bytes in metric names', () => {
      const maliciousConfig = {
        namespace: 'ShadowSky/AnthropicAPI',
        metricName: 'APILatency\x00malicious',
        statistic: 'p99' as const,
      };

      expect(() => validateMetricConfig(maliciousConfig)).toThrow(
        DashboardValidationError
      );
    });

    it('should reject newlines in dimension values', () => {
      const maliciousConfig = {
        namespace: 'ShadowSky/AnthropicAPI',
        metricName: 'APILatency',
        statistic: 'p99' as const,
        dimensionsMap: {
          Function: 'test\nmalicious',
        },
      };

      expect(() => validateMetricConfig(maliciousConfig)).toThrow(
        DashboardValidationError
      );
    });

    it('should reject control characters', () => {
      const maliciousConfig = {
        namespace: 'ShadowSky/AnthropicAPI',
        metricName: 'APILatency\r\n',
        statistic: 'p99' as const,
      };

      expect(() => validateMetricConfig(maliciousConfig)).toThrow(
        DashboardValidationError
      );
    });

    it('should reject unicode injection attempts', () => {
      const maliciousConfig = {
        namespace: 'ShadowSky/AnthropicAPI',
        metricName: 'APILatency\u202e',
        statistic: 'p99' as const,
      };

      expect(() => validateMetricConfig(maliciousConfig)).toThrow(
        DashboardValidationError
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string inputs', () => {
      const invalidConfig = {
        namespace: '',
        metricName: '',
        statistic: 'p99' as const,
      };

      expect(() => validateMetricConfig(invalidConfig)).toThrow();
    });

    it('should handle whitespace-only inputs', () => {
      const invalidConfig = {
        namespace: '   ',
        metricName: '   ',
        statistic: 'p99' as const,
      };

      expect(() => validateMetricConfig(invalidConfig)).toThrow();
    });

    it('should preserve valid forward slashes in namespace', () => {
      const validConfig = {
        namespace: 'ShadowSky/AnthropicAPI',
        metricName: 'APILatency',
        statistic: 'p99' as const,
      };

      const validated = validateMetricConfig(validConfig);
      expect(validated.namespace).toBe('ShadowSky/AnthropicAPI');
    });

    it('should allow dots and hyphens in valid identifiers', () => {
      const validConfig = {
        namespace: 'ShadowSky/Anthropic-API.v2',
        metricName: 'API-Latency.p99',
        statistic: 'p99' as const,
      };

      expect(() => validateMetricConfig(validConfig)).not.toThrow();
    });
  });
});
