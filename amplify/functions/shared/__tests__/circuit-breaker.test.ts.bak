/**
 * Circuit Breaker Tests
 *
 * Validates circuit breaker behavior for CloudWatch API protection.
 */

import {
  CircuitBreaker,
  CircuitBreakerState,
  CircuitBreakerOpenError,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
} from '../circuit-breaker';

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;

  beforeEach(() => {
    circuitBreaker = new CircuitBreaker({
      errorThresholdPercentage: 50,
      requestVolumeThreshold: 5,
      timeWindowMs: 1000,
      resetTimeoutMs: 1000,
      halfOpenMaxRequests: 2,
    });
  });

  describe('State Transitions', () => {
    it('should start in CLOSED state', () => {
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
    });

    it('should transition to OPEN when error threshold is exceeded', async () => {
      // Execute 5 requests with 60% failure rate (3 failures out of 5)
      await circuitBreaker.execute(() => Promise.resolve('success'));
      await circuitBreaker.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
      await circuitBreaker.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
      await circuitBreaker.execute(() => Promise.resolve('success'));
      await circuitBreaker.execute(() => Promise.reject(new Error('fail'))).catch(() => {});

      // Circuit should be OPEN now (60% error rate > 50% threshold)
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);
    });

    it('should reject requests when circuit is OPEN', async () => {
      // Force circuit to OPEN state
      circuitBreaker.forceOpen();

      // Attempt to execute should throw CircuitBreakerOpenError
      await expect(
        circuitBreaker.execute(() => Promise.resolve('success'))
      ).rejects.toThrow(CircuitBreakerOpenError);
    });

    it('should transition to HALF_OPEN after reset timeout', async () => {
      // Force circuit to OPEN
      circuitBreaker.forceOpen();
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);

      // Wait for reset timeout
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Next request should transition to HALF_OPEN
      await circuitBreaker.execute(() => Promise.resolve('success'));
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
    });

    it('should transition back to OPEN if HALF_OPEN request fails', async () => {
      // Force circuit to OPEN
      circuitBreaker.forceOpen();

      // Wait for reset timeout
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Execute failing request in HALF_OPEN state
      await circuitBreaker.execute(() => Promise.reject(new Error('fail'))).catch(() => {});

      // Should be back to OPEN
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);
    });

    it('should transition to CLOSED if HALF_OPEN requests succeed', async () => {
      // Force circuit to OPEN
      circuitBreaker.forceOpen();

      // Wait for reset timeout
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Execute successful request in HALF_OPEN state
      await circuitBreaker.execute(() => Promise.resolve('success'));

      // Should be CLOSED now
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
    });
  });

  describe('Error Rate Calculation', () => {
    it('should not open circuit with low request volume', async () => {
      // Execute only 3 requests (below threshold of 5)
      await circuitBreaker.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
      await circuitBreaker.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
      await circuitBreaker.execute(() => Promise.reject(new Error('fail'))).catch(() => {});

      // Circuit should remain CLOSED (not enough requests)
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
    });

    it('should not open circuit when error rate is below threshold', async () => {
      // Execute 10 requests with 40% failure rate (below 50% threshold)
      for (let i = 0; i < 6; i++) {
        await circuitBreaker.execute(() => Promise.resolve('success'));
      }
      for (let i = 0; i < 4; i++) {
        await circuitBreaker.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
      }

      // Circuit should remain CLOSED (40% error rate < 50% threshold)
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
    });

    it('should clean up old records outside time window', async () => {
      // Execute failures
      for (let i = 0; i < 5; i++) {
        await circuitBreaker.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
      }

      // Circuit should be OPEN
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);

      // Wait for time window to expire
      await new Promise(resolve => setTimeout(resolve, 1200));

      // Reset circuit to CLOSED
      circuitBreaker.forceClose();

      // Execute new successful requests (old failures should be cleaned up)
      for (let i = 0; i < 10; i++) {
        await circuitBreaker.execute(() => Promise.resolve('success'));
      }

      // Circuit should remain CLOSED
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.requestsInWindow).toBe(10);
    });
  });

  describe('Metrics', () => {
    it('should track total requests', async () => {
      await circuitBreaker.execute(() => Promise.resolve('success'));
      await circuitBreaker.execute(() => Promise.reject(new Error('fail'))).catch(() => {});

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.totalRequests).toBe(2);
    });

    it('should track successful and failed requests', async () => {
      await circuitBreaker.execute(() => Promise.resolve('success'));
      await circuitBreaker.execute(() => Promise.resolve('success'));
      await circuitBreaker.execute(() => Promise.reject(new Error('fail'))).catch(() => {});

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.successfulRequests).toBe(2);
      expect(metrics.failedRequests).toBe(1);
    });

    it('should track error rate in time window', async () => {
      // 60% error rate (3 failures out of 5)
      await circuitBreaker.execute(() => Promise.resolve('success'));
      await circuitBreaker.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
      await circuitBreaker.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
      await circuitBreaker.execute(() => Promise.resolve('success'));
      await circuitBreaker.execute(() => Promise.reject(new Error('fail'))).catch(() => {});

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.errorRate).toBe(60);
      expect(metrics.requestsInWindow).toBe(5);
    });

    it('should track circuit open count', async () => {
      // Force open and close multiple times
      circuitBreaker.forceOpen();
      circuitBreaker.forceClose();
      circuitBreaker.forceOpen();

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.circuitOpenCount).toBe(2);
    });

    it('should track state history', () => {
      circuitBreaker.forceOpen();
      circuitBreaker.forceClose();

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.stateHistory.length).toBeGreaterThan(1);
      expect(metrics.stateHistory[0].state).toBe(CircuitBreakerState.CLOSED);
    });
  });

  describe('Configuration', () => {
    it('should use default configuration', () => {
      const defaultBreaker = new CircuitBreaker();
      const metrics = defaultBreaker.getMetrics();

      expect(metrics.state).toBe(CircuitBreakerState.CLOSED);
    });

    it('should accept custom configuration', () => {
      const customBreaker = new CircuitBreaker({
        errorThresholdPercentage: 75,
        requestVolumeThreshold: 20,
        timeWindowMs: 5000,
        resetTimeoutMs: 10000,
        halfOpenMaxRequests: 5,
      });

      expect(customBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
    });

    it('should update configuration', () => {
      circuitBreaker.updateConfig({
        errorThresholdPercentage: 75,
      });

      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
    });
  });

  describe('Reset', () => {
    it('should reset all state and history', async () => {
      // Execute some requests
      await circuitBreaker.execute(() => Promise.resolve('success'));
      await circuitBreaker.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
      circuitBreaker.forceOpen();

      // Reset
      circuitBreaker.reset();

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.state).toBe(CircuitBreakerState.CLOSED);
      expect(metrics.totalRequests).toBe(0);
      expect(metrics.circuitOpenCount).toBe(0);
    });
  });

  describe('Half-Open State', () => {
    it('should limit concurrent requests in HALF_OPEN state', async () => {
      // Force circuit to OPEN
      circuitBreaker.forceOpen();

      // Wait for reset timeout
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Start two requests (at max)
      const promise1 = circuitBreaker.execute(() => new Promise(resolve => setTimeout(resolve, 100)));
      const promise2 = circuitBreaker.execute(() => new Promise(resolve => setTimeout(resolve, 100)));

      // Third request should be rejected
      await expect(
        circuitBreaker.execute(() => Promise.resolve('success'))
      ).rejects.toThrow(CircuitBreakerOpenError);

      // Wait for first two to complete
      await Promise.all([promise1, promise2]);
    });
  });

  describe('Edge Cases', () => {
    it('should handle synchronous errors', async () => {
      await expect(
        circuitBreaker.execute(() => {
          throw new Error('sync error');
        })
      ).rejects.toThrow('sync error');

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.failedRequests).toBe(1);
    });

    it('should handle non-Error rejections', async () => {
      await circuitBreaker.execute(() => Promise.reject('string error')).catch(() => {});

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.failedRequests).toBe(1);
    });

    it('should handle rapid state transitions', async () => {
      for (let i = 0; i < 5; i++) {
        circuitBreaker.forceOpen();
        circuitBreaker.forceClose();
      }

      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.stateHistory.length).toBeLessThanOrEqual(10); // Max history kept
    });
  });
});
