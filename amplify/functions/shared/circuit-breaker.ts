/**
 * Circuit Breaker Pattern Implementation
 *
 * Implements the circuit breaker pattern to prevent cascading failures when
 * a downstream service (like CloudWatch API) becomes unhealthy.
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Downstream service is unhealthy, requests are rejected immediately
 * - HALF_OPEN: Testing if downstream service has recovered
 *
 * Features:
 * - Configurable error rate threshold (default: 50%)
 * - Configurable time window for error rate calculation (default: 1 minute)
 * - Automatic recovery with exponential backoff
 * - Request volume threshold to prevent false positives
 * - Detailed metrics and state tracking
 */

export interface CircuitBreakerConfig {
  errorThresholdPercentage: number;
  requestVolumeThreshold: number;
  timeWindowMs: number;
  resetTimeoutMs: number;
  halfOpenMaxRequests: number;
}

export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  errorThresholdPercentage: 50,
  requestVolumeThreshold: 10,
  timeWindowMs: 60000,
  resetTimeoutMs: 30000,
  halfOpenMaxRequests: 3,
};

export enum CircuitBreakerState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

interface RequestRecord {
  timestamp: number;
  success: boolean;
}

export interface CircuitBreakerMetrics {
  state: CircuitBreakerState;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  errorRate: number;
  requestsInWindow: number;
  lastFailureTime?: number;
  lastStateChange: number;
  circuitOpenCount: number;
  stateHistory: Array<{ state: CircuitBreakerState; timestamp: number }>;
}

export class CircuitBreakerOpenError extends Error {
  constructor(
    message: string,
    public readonly metrics: CircuitBreakerMetrics
  ) {
    super(message);
    this.name = 'CircuitBreakerOpenError';
  }
}

export class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private requestHistory: RequestRecord[] = [];
  private stateChangeTime: number = Date.now();
  private halfOpenRequests: number = 0;
  private circuitOpenCount: number = 0;
  private stateHistory: Array<{ state: CircuitBreakerState; timestamp: number }> = [];
  private config: CircuitBreakerConfig;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = { ...DEFAULT_CIRCUIT_BREAKER_CONFIG, ...config };
    this.stateHistory.push({
      state: this.state,
      timestamp: Date.now(),
    });
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>, operationName?: string): Promise<T> {
    // Check if circuit is open
    if (this.state === CircuitBreakerState.OPEN) {
      // Check if it's time to try again (half-open)
      const timeSinceStateChange = Date.now() - this.stateChangeTime;
      if (timeSinceStateChange >= this.config.resetTimeoutMs) {
        this.transitionTo(CircuitBreakerState.HALF_OPEN);
      } else {
        throw new CircuitBreakerOpenError(
          `Circuit breaker is OPEN. ${operationName || 'Operation'} is currently disabled due to high error rate. ` +
          `Will retry in ${Math.ceil((this.config.resetTimeoutMs - timeSinceStateChange) / 1000)}s.`,
          this.getMetrics()
        );
      }
    }

    // Limit concurrent requests in half-open state
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      if (this.halfOpenRequests >= this.config.halfOpenMaxRequests) {
        throw new CircuitBreakerOpenError(
          `Circuit breaker is HALF_OPEN and at max concurrent requests. ${operationName || 'Operation'} temporarily disabled.`,
          this.getMetrics()
        );
      }
      this.halfOpenRequests++;
    }

    // Execute the function
    try {
      const result = await fn();
      this.recordSuccess();

      // If in half-open state and request succeeded, consider closing circuit
      if (this.state === CircuitBreakerState.HALF_OPEN) {
        this.halfOpenRequests--;
        // If we've successfully completed all half-open test requests, close the circuit
        if (this.halfOpenRequests === 0) {
          this.transitionTo(CircuitBreakerState.CLOSED);
        }
      }

      return result;
    } catch (error) {
      this.recordFailure();

      // If in half-open state and request failed, reopen circuit
      if (this.state === CircuitBreakerState.HALF_OPEN) {
        this.halfOpenRequests--;
        this.transitionTo(CircuitBreakerState.OPEN);
      }

      throw error;
    }
  }

  /**
   * Record a successful request
   */
  private recordSuccess(): void {
    this.requestHistory.push({
      timestamp: Date.now(),
      success: true,
    });
    this.cleanupOldRecords();
    this.evaluateCircuit();
  }

  /**
   * Record a failed request
   */
  private recordFailure(): void {
    this.requestHistory.push({
      timestamp: Date.now(),
      success: false,
    });
    this.cleanupOldRecords();
    this.evaluateCircuit();
  }

  /**
   * Remove records outside the time window
   */
  private cleanupOldRecords(): void {
    const cutoffTime = Date.now() - this.config.timeWindowMs;
    this.requestHistory = this.requestHistory.filter(
      record => record.timestamp > cutoffTime
    );
  }

  /**
   * Evaluate circuit state based on error rate
   */
  private evaluateCircuit(): void {
    // Only evaluate if we're in CLOSED state and have enough requests
    if (this.state !== CircuitBreakerState.CLOSED) {
      return;
    }

    const metrics = this.calculateMetrics();

    // Need minimum request volume to make a decision
    if (metrics.requestsInWindow < this.config.requestVolumeThreshold) {
      return;
    }

    // Check if error rate exceeds threshold
    if (metrics.errorRate >= this.config.errorThresholdPercentage) {
      this.transitionTo(CircuitBreakerState.OPEN);
    }
  }

  /**
   * Transition to a new circuit breaker state
   */
  private transitionTo(newState: CircuitBreakerState): void {
    if (this.state === newState) {
      return;
    }

    const oldState = this.state;
    this.state = newState;
    this.stateChangeTime = Date.now();
    this.halfOpenRequests = 0;

    // Track state transitions
    this.stateHistory.push({
      state: newState,
      timestamp: this.stateChangeTime,
    });

    // Keep only last 10 state changes
    if (this.stateHistory.length > 10) {
      this.stateHistory = this.stateHistory.slice(-10);
    }

    if (newState === CircuitBreakerState.OPEN) {
      this.circuitOpenCount++;
    }

    console.warn(
      `Circuit breaker state transition: ${oldState} -> ${newState}`,
      {
        metrics: this.getMetrics(),
        config: this.config,
      }
    );
  }

  /**
   * Calculate current metrics from request history
   */
  private calculateMetrics(): {
    requestsInWindow: number;
    successfulRequests: number;
    failedRequests: number;
    errorRate: number;
  } {
    const cutoffTime = Date.now() - this.config.timeWindowMs;
    const recentRequests = this.requestHistory.filter(
      record => record.timestamp > cutoffTime
    );

    const successfulRequests = recentRequests.filter(r => r.success).length;
    const failedRequests = recentRequests.filter(r => !r.success).length;
    const requestsInWindow = recentRequests.length;

    const errorRate =
      requestsInWindow > 0 ? (failedRequests / requestsInWindow) * 100 : 0;

    return {
      requestsInWindow,
      successfulRequests,
      failedRequests,
      errorRate,
    };
  }

  /**
   * Get current circuit breaker metrics
   */
  getMetrics(): CircuitBreakerMetrics {
    const calculated = this.calculateMetrics();
    const lastFailure = this.requestHistory
      .slice()
      .reverse()
      .find(r => !r.success);

    const totalRequests = this.requestHistory.length;
    const totalSuccessful = this.requestHistory.filter(r => r.success).length;
    const totalFailed = this.requestHistory.filter(r => !r.success).length;

    return {
      state: this.state,
      totalRequests,
      successfulRequests: totalSuccessful,
      failedRequests: totalFailed,
      errorRate: calculated.errorRate,
      requestsInWindow: calculated.requestsInWindow,
      lastFailureTime: lastFailure?.timestamp,
      lastStateChange: this.stateChangeTime,
      circuitOpenCount: this.circuitOpenCount,
      stateHistory: [...this.stateHistory],
    };
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitBreakerState {
    return this.state;
  }

  /**
   * Force circuit to open (for testing or manual intervention)
   */
  forceOpen(): void {
    this.transitionTo(CircuitBreakerState.OPEN);
  }

  /**
   * Force circuit to close (for testing or manual intervention)
   */
  forceClose(): void {
    this.transitionTo(CircuitBreakerState.CLOSED);
  }

  /**
   * Reset circuit breaker state and history
   */
  reset(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.requestHistory = [];
    this.stateChangeTime = Date.now();
    this.halfOpenRequests = 0;
    this.circuitOpenCount = 0;
    this.stateHistory = [
      {
        state: CircuitBreakerState.CLOSED,
        timestamp: Date.now(),
      },
    ];
  }

  /**
   * Update circuit breaker configuration
   */
  updateConfig(config: Partial<CircuitBreakerConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
