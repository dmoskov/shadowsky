/**
 * Resilience Utilities for Lambda Functions
 *
 * Provides unified retry, timeout, and circuit breaker patterns for backend
 * API calls. Designed for mobile client resilience with configurable options.
 *
 * Features:
 * - Exponential backoff with jitter
 * - Configurable timeouts per request
 * - Circuit breaker integration
 * - Retry-After header support
 * - Correlation ID tracking for debugging
 *
 * Usage:
 * ```ts
 * const client = new ResilientClient({
 *   name: 'anthropic-api',
 *   timeout: 8000,
 *   maxRetries: 3,
 * });
 *
 * const response = await client.fetch(url, options);
 * ```
 */

import { logError, logInfo, logWarning } from './api-response';
import {
  CircuitBreaker,
  CircuitBreakerConfig,
  CircuitBreakerOpenError,
  CircuitBreakerState,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
} from './circuit-breaker';

/**
 * Configuration for resilient operations
 */
export interface ResilienceConfig {
  /** Descriptive name for logging */
  name: string;
  /** Request timeout in milliseconds (default: 10000) */
  timeout?: number;
  /** Maximum retry attempts (default: 3) */
  maxRetries?: number;
  /** Initial delay between retries in ms (default: 1000) */
  initialDelayMs?: number;
  /** Maximum delay between retries in ms (default: 10000) */
  maxDelayMs?: number;
  /** Backoff multiplier (default: 2) */
  backoffFactor?: number;
  /** Add jitter to delay (default: true) */
  jitter?: boolean;
  /** Custom function to determine if error is retryable */
  isRetryable?: (error: unknown, statusCode?: number) => boolean;
  /** Circuit breaker configuration (optional) */
  circuitBreaker?: Partial<CircuitBreakerConfig>;
  /** Disable circuit breaker (default: false) */
  disableCircuitBreaker?: boolean;
}

/**
 * Default configuration values
 */
export const DEFAULT_RESILIENCE_CONFIG: Required<
  Omit<ResilienceConfig, 'name' | 'circuitBreaker' | 'isRetryable'>
> = {
  timeout: 10000,
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffFactor: 2,
  jitter: true,
  disableCircuitBreaker: false,
};

/**
 * Preset configurations for common use cases
 */
export const RESILIENCE_PRESETS = {
  /** For Anthropic API calls - balanced retry with reasonable timeout */
  anthropicApi: {
    name: 'anthropic-api',
    timeout: 30000, // 30s - AI models can take longer
    maxRetries: 2,
    initialDelayMs: 1000,
    maxDelayMs: 4000,
  } as Partial<ResilienceConfig>,

  /** For image/alt-text generation - shorter timeout, more retries */
  imageProcessing: {
    name: 'image-processing',
    timeout: 8000,
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 2000,
  } as Partial<ResilienceConfig>,

  /** For external URL fetching - moderate settings */
  urlFetch: {
    name: 'url-fetch',
    timeout: 10000,
    maxRetries: 2,
    initialDelayMs: 500,
    maxDelayMs: 2000,
  } as Partial<ResilienceConfig>,

  /** For DynamoDB operations - fast retry */
  dynamodb: {
    name: 'dynamodb',
    timeout: 5000,
    maxRetries: 3,
    initialDelayMs: 100,
    maxDelayMs: 1000,
  } as Partial<ResilienceConfig>,
} as const;

/**
 * Error thrown when request times out
 */
export class TimeoutError extends Error {
  readonly code = 'TIMEOUT_ERROR';
  readonly isTimeout = true;
  readonly timeoutMs: number;

  constructor(message: string, timeoutMs: number) {
    super(message);
    this.name = 'TimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Error thrown when max retries exceeded
 */
export class MaxRetriesExceededError extends Error {
  readonly code = 'MAX_RETRIES_EXCEEDED';
  readonly attempts: number;
  readonly lastError: unknown;

  constructor(message: string, attempts: number, lastError: unknown) {
    super(message);
    this.name = 'MaxRetriesExceededError';
    this.attempts = attempts;
    this.lastError = lastError;
  }
}

/**
 * Default function to determine if an error is retryable
 */
export function isDefaultRetryable(
  error: unknown,
  statusCode?: number
): boolean {
  // Don't retry on client errors (except 429 rate limit)
  if (statusCode !== undefined) {
    if (statusCode === 429) return true; // Rate limit - always retry
    if (statusCode >= 400 && statusCode < 500) return false; // Client errors
    if (statusCode >= 500) return true; // Server errors
  }

  // Check for timeout errors
  if (error instanceof TimeoutError) return true;
  if (
    error instanceof Error &&
    (error.name === 'AbortError' ||
      error.message.toLowerCase().includes('timeout'))
  ) {
    return true;
  }

  // Check for network errors
  if (error instanceof TypeError) return true;

  // Check error message for known retryable patterns
  const message = error instanceof Error ? error.message : String(error);
  const retryablePatterns = [
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ENOTFOUND',
    'ENETUNREACH',
    'ECONNRESET',
    'socket hang up',
    'network',
  ];

  return retryablePatterns.some((pattern) =>
    message.toLowerCase().includes(pattern.toLowerCase())
  );
}

/**
 * Calculate delay with exponential backoff and optional jitter
 */
export function calculateBackoffDelay(
  attempt: number,
  config: Pick<
    ResilienceConfig,
    'initialDelayMs' | 'maxDelayMs' | 'backoffFactor' | 'jitter'
  >
): number {
  const initialDelay = config.initialDelayMs ?? DEFAULT_RESILIENCE_CONFIG.initialDelayMs;
  const maxDelay = config.maxDelayMs ?? DEFAULT_RESILIENCE_CONFIG.maxDelayMs;
  const factor = config.backoffFactor ?? DEFAULT_RESILIENCE_CONFIG.backoffFactor;
  const useJitter = config.jitter ?? DEFAULT_RESILIENCE_CONFIG.jitter;

  // Calculate exponential delay
  let delay = initialDelay * Math.pow(factor, attempt);

  // Add jitter (0-10% of delay)
  if (useJitter) {
    const jitter = delay * Math.random() * 0.1;
    delay += jitter;
  }

  return Math.min(delay, maxDelay);
}

/**
 * Extract Retry-After delay from error/response if available
 */
export function extractRetryAfter(error: unknown): number | null {
  // Check for Retry-After header in response
  if (
    error &&
    typeof error === 'object' &&
    'headers' in error &&
    error.headers
  ) {
    const headers = error.headers as Record<string, string>;
    const retryAfter = headers['retry-after'] || headers['Retry-After'];

    if (retryAfter) {
      // Try parsing as seconds
      const seconds = parseInt(retryAfter, 10);
      if (!isNaN(seconds)) return seconds * 1000;

      // Try parsing as date
      const date = new Date(retryAfter);
      if (!isNaN(date.getTime())) {
        return Math.max(0, date.getTime() - Date.now());
      }
    }
  }

  return null;
}

/**
 * Fetch with timeout support
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new TimeoutError(`Request timeout after ${timeoutMs}ms`, timeoutMs);
    }
    throw error;
  }
}

/**
 * Execute a function with retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<ResilienceConfig> & { name: string },
  correlationId?: string
): Promise<T> {
  const maxRetries = config.maxRetries ?? DEFAULT_RESILIENCE_CONFIG.maxRetries;
  const isRetryable = config.isRetryable ?? isDefaultRetryable;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Extract status code if available
      let statusCode: number | undefined;
      if (error && typeof error === 'object' && 'status' in error) {
        statusCode = (error as { status: number }).status;
      }

      // Check if we should retry
      if (!isRetryable(error, statusCode)) {
        if (correlationId) {
          logInfo(
            config.name,
            `Non-retryable error on attempt ${attempt + 1}`,
            correlationId,
            { statusCode }
          );
        }
        throw error;
      }

      // Check if we've exhausted retries
      if (attempt >= maxRetries) {
        if (correlationId) {
          logError(config.name, error, correlationId, {
            message: `Failed after ${attempt + 1} attempts`,
            attempts: attempt + 1,
          });
        }
        throw new MaxRetriesExceededError(
          `Failed after ${attempt + 1} attempts: ${error instanceof Error ? error.message : String(error)}`,
          attempt + 1,
          error
        );
      }

      // Calculate delay
      const retryAfterDelay = extractRetryAfter(error);
      const backoffDelay = calculateBackoffDelay(attempt, config);
      const delay = retryAfterDelay ?? backoffDelay;

      if (correlationId) {
        logWarning(
          config.name,
          `Attempt ${attempt + 1} failed, retrying in ${delay}ms`,
          correlationId,
          {
            attempt: attempt + 1,
            maxRetries,
            delay,
            error: error instanceof Error ? error.message : String(error),
          }
        );
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Resilient HTTP client with retry, timeout, and circuit breaker
 */
export class ResilientClient {
  private readonly config: Required<
    Omit<ResilienceConfig, 'circuitBreaker' | 'isRetryable'>
  > & {
    isRetryable: (error: unknown, statusCode?: number) => boolean;
  };
  private readonly circuitBreaker?: CircuitBreaker;

  constructor(config: ResilienceConfig) {
    this.config = {
      name: config.name,
      timeout: config.timeout ?? DEFAULT_RESILIENCE_CONFIG.timeout,
      maxRetries: config.maxRetries ?? DEFAULT_RESILIENCE_CONFIG.maxRetries,
      initialDelayMs:
        config.initialDelayMs ?? DEFAULT_RESILIENCE_CONFIG.initialDelayMs,
      maxDelayMs: config.maxDelayMs ?? DEFAULT_RESILIENCE_CONFIG.maxDelayMs,
      backoffFactor:
        config.backoffFactor ?? DEFAULT_RESILIENCE_CONFIG.backoffFactor,
      jitter: config.jitter ?? DEFAULT_RESILIENCE_CONFIG.jitter,
      disableCircuitBreaker:
        config.disableCircuitBreaker ??
        DEFAULT_RESILIENCE_CONFIG.disableCircuitBreaker,
      isRetryable: config.isRetryable ?? isDefaultRetryable,
    };

    // Initialize circuit breaker unless disabled
    if (!this.config.disableCircuitBreaker) {
      this.circuitBreaker = new CircuitBreaker({
        ...DEFAULT_CIRCUIT_BREAKER_CONFIG,
        ...config.circuitBreaker,
      });
    }
  }

  /**
   * Execute a fetch request with full resilience features
   */
  async fetch(
    url: string,
    options: RequestInit = {},
    correlationId?: string
  ): Promise<Response> {
    const operation = async (): Promise<Response> => {
      return withRetry(
        async () => {
          const response = await fetchWithTimeout(
            url,
            options,
            this.config.timeout
          );

          // Throw on HTTP errors to trigger retry logic
          if (!response.ok) {
            const error = new Error(
              `HTTP ${response.status}: ${response.statusText}`
            ) as Error & { status: number; response: Response };
            error.status = response.status;
            error.response = response;
            throw error;
          }

          return response;
        },
        this.config,
        correlationId
      );
    };

    // Execute through circuit breaker if enabled
    if (this.circuitBreaker) {
      try {
        return await this.circuitBreaker.execute(operation, this.config.name);
      } catch (error) {
        if (error instanceof CircuitBreakerOpenError && correlationId) {
          logWarning(
            this.config.name,
            'Circuit breaker is open, request rejected',
            correlationId,
            { metrics: error.metrics }
          );
        }
        throw error;
      }
    }

    return operation();
  }

  /**
   * Execute any async function with resilience features
   */
  async execute<T>(
    fn: () => Promise<T>,
    correlationId?: string
  ): Promise<T> {
    const operation = async (): Promise<T> => {
      return withRetry(fn, this.config, correlationId);
    };

    // Execute through circuit breaker if enabled
    if (this.circuitBreaker) {
      try {
        return await this.circuitBreaker.execute(operation, this.config.name);
      } catch (error) {
        if (error instanceof CircuitBreakerOpenError && correlationId) {
          logWarning(
            this.config.name,
            'Circuit breaker is open, request rejected',
            correlationId,
            { metrics: error.metrics }
          );
        }
        throw error;
      }
    }

    return operation();
  }

  /**
   * Get current circuit breaker state (if enabled)
   */
  getCircuitBreakerState(): CircuitBreakerState | null {
    return this.circuitBreaker?.getState() ?? null;
  }

  /**
   * Get circuit breaker metrics (if enabled)
   */
  getCircuitBreakerMetrics() {
    return this.circuitBreaker?.getMetrics() ?? null;
  }

  /**
   * Force circuit breaker to open (for testing/manual intervention)
   */
  forceCircuitOpen(): void {
    this.circuitBreaker?.forceOpen();
  }

  /**
   * Force circuit breaker to close (for testing/manual intervention)
   */
  forceCircuitClose(): void {
    this.circuitBreaker?.forceClose();
  }

  /**
   * Reset circuit breaker state
   */
  resetCircuitBreaker(): void {
    this.circuitBreaker?.reset();
  }
}

/**
 * Create a pre-configured resilient client for Anthropic API calls
 */
export function createAnthropicClient(
  overrides?: Partial<ResilienceConfig>
): ResilientClient {
  return new ResilientClient({
    ...RESILIENCE_PRESETS.anthropicApi,
    ...overrides,
    name: overrides?.name ?? RESILIENCE_PRESETS.anthropicApi.name!,
  });
}

/**
 * Create a pre-configured resilient client for image processing
 */
export function createImageProcessingClient(
  overrides?: Partial<ResilienceConfig>
): ResilientClient {
  return new ResilientClient({
    ...RESILIENCE_PRESETS.imageProcessing,
    ...overrides,
    name: overrides?.name ?? RESILIENCE_PRESETS.imageProcessing.name!,
  });
}

/**
 * Create a pre-configured resilient client for URL fetching
 */
export function createUrlFetchClient(
  overrides?: Partial<ResilienceConfig>
): ResilientClient {
  return new ResilientClient({
    ...RESILIENCE_PRESETS.urlFetch,
    ...overrides,
    name: overrides?.name ?? RESILIENCE_PRESETS.urlFetch.name!,
  });
}

// Re-export circuit breaker types for convenience
export { CircuitBreaker, CircuitBreakerOpenError, CircuitBreakerState };
export type { CircuitBreakerConfig };
