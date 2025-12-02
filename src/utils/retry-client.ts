/**
 * Retry Client with Exponential Backoff and Circuit Breaker
 *
 * Provides automatic retry logic for API calls with:
 * - Exponential backoff (1s, 2s, 4s, 8s)
 * - Retry-After header support
 * - Circuit breaker pattern
 * - Retry status notifications
 */

import {
  getErrorMessage,
  getErrorStatus,
  hasHeadersProperty,
} from "../types/errors";
import { createLogger } from "./logger";

const logger = createLogger("RetryClient");

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  exponentialBase?: number;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
  signal?: AbortSignal;
}

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  resetTimeoutMs?: number;
  halfOpenMaxAttempts?: number;
}

enum CircuitState {
  CLOSED = "CLOSED",
  OPEN = "OPEN",
  HALF_OPEN = "HALF_OPEN",
}

class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private successCount: number = 0;

  constructor(private options: Required<CircuitBreakerOptions>) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      const now = Date.now();
      if (now - this.lastFailureTime >= this.options.resetTimeoutMs) {
        logger.log("Circuit breaker transitioning to HALF_OPEN");
        this.state = CircuitState.HALF_OPEN;
        this.successCount = 0;
      } else {
        throw new Error(
          `Circuit breaker is OPEN. Too many consecutive failures. Retry in ${Math.ceil((this.options.resetTimeoutMs - (now - this.lastFailureTime)) / 1000)}s`,
        );
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error: unknown) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.options.halfOpenMaxAttempts) {
        logger.log("Circuit breaker transitioning to CLOSED");
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
      }
    } else {
      this.failureCount = 0;
    }
  }

  private onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (
      this.state === CircuitState.HALF_OPEN ||
      this.failureCount >= this.options.failureThreshold
    ) {
      logger.log(
        `Circuit breaker transitioning to OPEN (failures: ${this.failureCount})`,
      );
      this.state = CircuitState.OPEN;
    }
  }

  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
    };
  }

  reset() {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
  }
}

export class RetryClient {
  private circuitBreaker: CircuitBreaker;
  private defaultOptions: Required<Omit<RetryOptions, "signal">>;

  constructor(
    retryOptions?: RetryOptions,
    circuitBreakerOptions?: CircuitBreakerOptions,
  ) {
    this.defaultOptions = {
      maxRetries: retryOptions?.maxRetries ?? 3,
      initialDelayMs: retryOptions?.initialDelayMs ?? 1000,
      maxDelayMs: retryOptions?.maxDelayMs ?? 8000,
      exponentialBase: retryOptions?.exponentialBase ?? 2,
      shouldRetry: retryOptions?.shouldRetry ?? this.defaultShouldRetry,
      onRetry: retryOptions?.onRetry ?? (() => {}),
    };

    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: circuitBreakerOptions?.failureThreshold ?? 5,
      resetTimeoutMs: circuitBreakerOptions?.resetTimeoutMs ?? 60000,
      halfOpenMaxAttempts: circuitBreakerOptions?.halfOpenMaxAttempts ?? 2,
    });
  }

  private defaultShouldRetry(error: unknown, attempt: number): boolean {
    if (attempt >= this.defaultOptions.maxRetries) {
      return false;
    }

    const status = getErrorStatus(error);

    if (status === 429) {
      return true;
    }

    if (status !== undefined && status >= 500 && status < 600) {
      return true;
    }

    const message = getErrorMessage(error);
    if (
      message.includes("network") ||
      message.includes("timeout") ||
      message.includes("ECONNREFUSED") ||
      message.includes("ETIMEDOUT")
    ) {
      return true;
    }

    return false;
  }

  private getRetryAfterDelay(error: unknown): number | null {
    if (!hasHeadersProperty(error)) return null;

    const retryAfter =
      error.headers["retry-after"] || error.headers["Retry-After"];
    if (!retryAfter) return null;

    const delaySeconds = parseInt(retryAfter, 10);
    if (!isNaN(delaySeconds)) {
      return delaySeconds * 1000;
    }

    const retryDate = new Date(retryAfter);
    if (!isNaN(retryDate.getTime())) {
      return Math.max(0, retryDate.getTime() - Date.now());
    }

    return null;
  }

  private calculateDelay(attempt: number): number {
    const exponentialDelay =
      this.defaultOptions.initialDelayMs *
      Math.pow(this.defaultOptions.exponentialBase, attempt);

    const jitter = Math.random() * 0.1 * exponentialDelay;

    return Math.min(exponentialDelay + jitter, this.defaultOptions.maxDelayMs);
  }

  private async delay(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(new Error("Request cancelled"));
        return;
      }

      const timeout = setTimeout(resolve, ms);

      signal?.addEventListener("abort", () => {
        clearTimeout(timeout);
        reject(new Error("Request cancelled"));
      });
    });
  }

  async execute<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T> {
    const opts = { ...this.defaultOptions, ...options };
    let lastError: unknown;

    return this.circuitBreaker.execute(async () => {
      for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
        try {
          if (options?.signal?.aborted) {
            throw new Error("Request cancelled");
          }

          const result = await fn();
          return result;
        } catch (error: unknown) {
          lastError = error;

          if (!opts.shouldRetry(error, attempt)) {
            throw error;
          }

          if (attempt === opts.maxRetries) {
            throw error;
          }

          const retryAfterDelay = this.getRetryAfterDelay(error);
          const delayMs = retryAfterDelay ?? this.calculateDelay(attempt);

          logger.log(
            `Retry attempt ${attempt + 1}/${opts.maxRetries} after ${delayMs}ms`,
            error,
          );

          opts.onRetry(error, attempt + 1, delayMs);

          await this.delay(delayMs, options?.signal);
        }
      }

      throw lastError;
    });
  }

  getCircuitBreakerState() {
    return this.circuitBreaker.getState();
  }

  resetCircuitBreaker() {
    this.circuitBreaker.reset();
  }
}

export const defaultRetryClient = new RetryClient();

export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions,
): Promise<T> {
  return defaultRetryClient.execute(fn, options);
}
