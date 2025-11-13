/**
 * CloudWatch Security Module Tests
 *
 * Tests for access controls, input validation, and query filtering
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  validateNamespace,
  validateMetricName,
  validateDimensionName,
  validateDimensionValue,
  validateFunctionAccess,
  validateMetricData,
  SecurityValidationError,
  UserContext,
  sanitizeErrorMessage,
  logSecurityEvent,
  checkRateLimit,
  rateLimiter,
} from '../cloudwatch-security';
import { StandardUnit } from '@aws-sdk/client-cloudwatch';

describe('CloudWatch Security', () => {
  describe('validateNamespace', () => {
    it('should accept valid allowed namespaces', () => {
      expect(validateNamespace('ShadowSky/AnthropicAPI')).toBe('ShadowSky/AnthropicAPI');
      expect(validateNamespace('ShadowSky/AltTextGeneration')).toBe('ShadowSky/AltTextGeneration');
      expect(validateNamespace('AWS/Lambda')).toBe('AWS/Lambda');
    });

    it('should reject empty namespace', () => {
      expect(() => validateNamespace('')).toThrow(SecurityValidationError);
      expect(() => validateNamespace('')).toThrow('Namespace is required');
    });

    it('should reject namespace with invalid characters', () => {
      expect(() => validateNamespace('ShadowSky/<script>alert(1)</script>'))
        .toThrow(SecurityValidationError);
      expect(() => validateNamespace('Test; DROP TABLE metrics;'))
        .toThrow('contains invalid characters');
    });

    it('should reject namespace exceeding length limit', () => {
      const longNamespace = 'A'.repeat(256);
      expect(() => validateNamespace(longNamespace)).toThrow('exceeds maximum length');
    });

    it('should reject unauthorized namespaces', () => {
      expect(() => validateNamespace('AWS/EC2')).toThrow('not in the allowed list');
      expect(() => validateNamespace('Custom/Namespace')).toThrow('not in the allowed list');
    });
  });

  describe('validateMetricName', () => {
    it('should accept valid metric names', () => {
      expect(validateMetricName('APILatency', 'ShadowSky/AnthropicAPI')).toBe('APILatency');
      expect(validateMetricName('InputTokens', 'ShadowSky/AnthropicAPI')).toBe('InputTokens');
      expect(validateMetricName('CacheHit', 'ShadowSky/AltTextGeneration')).toBe('CacheHit');
    });

    it('should reject empty metric name', () => {
      expect(() => validateMetricName('', 'ShadowSky/AnthropicAPI'))
        .toThrow('Metric name is required');
    });

    it('should reject metric name with invalid characters', () => {
      expect(() => validateMetricName('API<script>', 'ShadowSky/AnthropicAPI'))
        .toThrow('contains invalid characters');
    });

    it('should reject metric name exceeding length limit', () => {
      const longName = 'M'.repeat(256);
      expect(() => validateMetricName(longName, 'ShadowSky/AnthropicAPI'))
        .toThrow('exceeds maximum length');
    });

    it('should reject unauthorized metric names for namespace', () => {
      expect(() => validateMetricName('UnknownMetric', 'ShadowSky/AnthropicAPI'))
        .toThrow('not allowed for namespace');
      expect(() => validateMetricName('APILatency', 'ShadowSky/AltTextGeneration'))
        .toThrow('not allowed for namespace');
    });
  });

  describe('validateDimensionName', () => {
    it('should accept valid dimension names', () => {
      expect(validateDimensionName('Function', 'ShadowSky/AnthropicAPI')).toBe('Function');
      expect(validateDimensionName('Status', 'ShadowSky/AnthropicAPI')).toBe('Status');
      expect(validateDimensionName('ErrorType', 'ShadowSky/AnthropicAPI')).toBe('ErrorType');
    });

    it('should reject empty dimension name', () => {
      expect(() => validateDimensionName('', 'ShadowSky/AnthropicAPI'))
        .toThrow('Dimension name is required');
    });

    it('should reject dimension name with invalid characters', () => {
      expect(() => validateDimensionName('Func<script>', 'ShadowSky/AnthropicAPI'))
        .toThrow('contains invalid characters');
    });

    it('should reject unauthorized dimension names for namespace', () => {
      expect(() => validateDimensionName('UnknownDimension', 'ShadowSky/AnthropicAPI'))
        .toThrow('not allowed for namespace');
    });
  });

  describe('validateDimensionValue', () => {
    it('should accept and sanitize valid dimension values', () => {
      expect(validateDimensionValue('Function', 'generate-alt-text')).toBe('generate-alt-text');
      expect(validateDimensionValue('Status', 'Success')).toBe('Success');
      expect(validateDimensionValue('ErrorType', 'Timeout')).toBe('Timeout');
    });

    it('should reject empty dimension value', () => {
      expect(() => validateDimensionValue('Function', ''))
        .toThrow('Dimension value is required');
    });

    it('should sanitize dimension values with dangerous characters', () => {
      const sanitized = validateDimensionValue('Status', 'Success<script>alert(1)</script>');
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('</script>');
    });

    it('should enforce length limits', () => {
      const longValue = 'A'.repeat(257);
      expect(() => validateDimensionValue('Status', longValue))
        .toThrow('exceeds maximum length');
    });

    it('should validate function access for Function dimensions', () => {
      expect(() => validateDimensionValue('Function', 'unauthorized-function'))
        .toThrow('not in the allowed list');
    });
  });

  describe('validateFunctionAccess', () => {
    it('should allow access to valid functions', () => {
      expect(() => validateFunctionAccess('generate-alt-text')).not.toThrow();
      expect(() => validateFunctionAccess('writing-feedback')).not.toThrow();
      expect(() => validateFunctionAccess('adjust-tone')).not.toThrow();
    });

    it('should reject access to unauthorized functions', () => {
      expect(() => validateFunctionAccess('unauthorized-function'))
        .toThrow('not in the allowed list');
      expect(() => validateFunctionAccess('../../../etc/passwd'))
        .toThrow('not in the allowed list');
    });

    it('should enforce user-specific restrictions', () => {
      const userContext: UserContext = {
        userId: 'user123',
        allowedFunctions: ['generate-alt-text'],
        isAdmin: false,
      };

      expect(() => validateFunctionAccess('generate-alt-text', userContext)).not.toThrow();
      expect(() => validateFunctionAccess('writing-feedback', userContext))
        .toThrow('does not have access');
    });

    it('should allow admin access to all functions', () => {
      const adminContext: UserContext = {
        userId: 'admin123',
        allowedFunctions: ['generate-alt-text'],
        isAdmin: true,
      };

      expect(() => validateFunctionAccess('writing-feedback', adminContext)).not.toThrow();
      expect(() => validateFunctionAccess('adjust-tone', adminContext)).not.toThrow();
    });
  });

  describe('validateMetricData', () => {
    it('should accept valid metric data', () => {
      const metricData = [
        {
          MetricName: 'APILatency',
          Value: 100,
          Unit: StandardUnit.Milliseconds,
          Timestamp: new Date(),
          Dimensions: [
            { Name: 'Function', Value: 'generate-alt-text' },
            { Name: 'Status', Value: 'Success' },
          ],
        },
      ];

      expect(() => validateMetricData('ShadowSky/AnthropicAPI', metricData)).not.toThrow();
    });

    it('should reject metric data exceeding count limit', () => {
      const metricData = Array(21).fill({
        MetricName: 'APILatency',
        Value: 100,
        Unit: StandardUnit.Milliseconds,
      });

      expect(() => validateMetricData('ShadowSky/AnthropicAPI', metricData))
        .toThrow('Cannot publish more than');
    });

    it('should reject metrics without name', () => {
      const metricData = [
        {
          Value: 100,
          Unit: StandardUnit.Milliseconds,
        } as any,
      ];

      expect(() => validateMetricData('ShadowSky/AnthropicAPI', metricData))
        .toThrow('Metric name is required');
    });

    it('should reject metrics without value or values', () => {
      const metricData = [
        {
          MetricName: 'APILatency',
          Unit: StandardUnit.Milliseconds,
        } as any,
      ];

      expect(() => validateMetricData('ShadowSky/AnthropicAPI', metricData))
        .toThrow('must have either Value or Values');
    });

    it('should reject metrics with too many dimensions', () => {
      const dimensions = Array(11).fill(null).map((_, i) => ({
        Name: 'Status',
        Value: `Value${i}`,
      }));

      const metricData = [
        {
          MetricName: 'APILatency',
          Value: 100,
          Dimensions: dimensions,
        },
      ];

      expect(() => validateMetricData('ShadowSky/AnthropicAPI', metricData))
        .toThrow('cannot have more than');
    });

    it('should reject metrics with invalid timestamps', () => {
      const oldDate = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000); // 15 days ago
      const metricData = [
        {
          MetricName: 'APILatency',
          Value: 100,
          Timestamp: oldDate,
        },
      ];

      expect(() => validateMetricData('ShadowSky/AnthropicAPI', metricData))
        .toThrow('Metric timestamp must be within');
    });

    it('should enforce user context restrictions', () => {
      const userContext: UserContext = {
        userId: 'user123',
        allowedFunctions: ['generate-alt-text'],
        isAdmin: false,
      };

      const metricData = [
        {
          MetricName: 'APILatency',
          Value: 100,
          Dimensions: [
            { Name: 'Function', Value: 'writing-feedback' },
          ],
        },
      ];

      expect(() => validateMetricData('ShadowSky/AnthropicAPI', metricData, userContext))
        .toThrow('does not have access');
    });

    it('should sanitize dimension values', () => {
      const metricData = [
        {
          MetricName: 'APILatency',
          Value: 100,
          Dimensions: [
            { Name: 'Status', Value: 'Success<script>alert(1)</script>' },
          ],
        },
      ];

      validateMetricData('ShadowSky/AnthropicAPI', metricData);
      expect(metricData[0].Dimensions![0].Value).not.toContain('<script>');
    });
  });

  describe('sanitizeErrorMessage', () => {
    it('should sanitize API keys from error messages', () => {
      const error = new Error('API request failed with api_key=sk-1234567890');
      const sanitized = sanitizeErrorMessage(error);
      expect(sanitized).toContain('api_key=***');
      expect(sanitized).not.toContain('sk-1234567890');
    });

    it('should sanitize tokens from error messages', () => {
      const error = new Error('Authentication failed: token=abc123xyz');
      const sanitized = sanitizeErrorMessage(error);
      expect(sanitized).toContain('token=***');
      expect(sanitized).not.toContain('abc123xyz');
    });

    it('should sanitize passwords from error messages', () => {
      const error = new Error('Login failed: password=secret123');
      const sanitized = sanitizeErrorMessage(error);
      expect(sanitized).toContain('password=***');
      expect(sanitized).not.toContain('secret123');
    });

    it('should handle null or undefined errors', () => {
      expect(sanitizeErrorMessage(null)).toBe('Unknown error');
      expect(sanitizeErrorMessage(undefined)).toBe('Unknown error');
    });
  });

  describe('logSecurityEvent', () => {
    it('should log security events with structured data', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      logSecurityEvent('validation_error', {
        field: 'namespace',
        value: 'invalid',
        reason: 'unauthorized_namespace',
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'SECURITY_EVENT:',
        expect.stringContaining('validation_error')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('checkRateLimit', () => {
    beforeEach(() => {
      // Clear rate limiter between tests
      rateLimiter.cleanup();
    });

    it('should allow requests within rate limit', () => {
      expect(() => checkRateLimit('user123')).not.toThrow();
      expect(() => checkRateLimit('user123')).not.toThrow();
      expect(() => checkRateLimit('user123')).not.toThrow();
    });

    it('should reject requests exceeding rate limit', () => {
      // Make 100 requests (the limit)
      for (let i = 0; i < 100; i++) {
        checkRateLimit('user123');
      }

      // 101st request should fail
      expect(() => checkRateLimit('user123')).toThrow('Rate limit exceeded');
    });

    it('should track rate limits per identifier', () => {
      // User 1 makes requests
      for (let i = 0; i < 100; i++) {
        checkRateLimit('user1');
      }

      // User 2 should still be able to make requests
      expect(() => checkRateLimit('user2')).not.toThrow();
    });
  });

  describe('SecurityValidationError', () => {
    it('should create error with security context', () => {
      const error = new SecurityValidationError(
        'Test error',
        'testField',
        'testValue',
        'test_reason'
      );

      expect(error.message).toBe('Test error');
      expect(error.field).toBe('testField');
      expect(error.value).toBe('testValue');
      expect(error.reason).toBe('test_reason');
      expect(error.name).toBe('SecurityValidationError');
    });
  });

  describe('Injection Attack Prevention', () => {
    it('should prevent SQL injection patterns', () => {
      expect(() => validateNamespace("Test'; DROP TABLE metrics;--"))
        .toThrow('contains invalid characters');
    });

    it('should prevent XSS injection patterns', () => {
      const value = validateDimensionValue('Status', '<script>alert(document.cookie)</script>');
      expect(value).not.toContain('<script>');
      expect(value).not.toContain('</script>');
    });

    it('should prevent path traversal attacks', () => {
      expect(() => validateFunctionAccess('../../../etc/passwd'))
        .toThrow('not in the allowed list');
    });

    it('should prevent command injection patterns', () => {
      expect(() => validateNamespace('Test; rm -rf /'))
        .toThrow('contains invalid characters');
    });

    it('should prevent LDAP injection patterns', () => {
      expect(() => validateDimensionName('Function)(cn=*', 'ShadowSky/AnthropicAPI'))
        .toThrow('contains invalid characters');
    });
  });
});
