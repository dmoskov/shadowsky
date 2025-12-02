/**
 * Storage Retry Utility with Exponential Backoff and Circuit Breaker
 *
 * Specialized retry logic for storage operations (IndexedDB, AT Protocol).
 * Handles transient failures from:
 * - IndexedDB lock contention
 * - Temporary quota issues
 * - Browser tab switching
 * - Network hiccups (for AT Protocol)
 *
 * Configuration:
 * - 3 attempts with exponential backoff (100ms, 200ms, 400ms)
 * - Circuit breaker: 5 consecutive failures → open for 30s
 *
 * @module storage-retry
 */

import { createLogger } from "./logger";
import { recordStorageOperation, recordStorageError } from "./error-monitoring";

const logger = createLogger("StorageRetry");

// ==================== Configuration ====================

export interface StorageRetryConfig {
  /** Maximum number of retry attempts (default: 3) */
  maxAttempts: number;
  /** Base delay in ms for exponential backoff (default: 100) */
  baseDelayMs: number;
  /** Multiplier for exponential backoff (default: 2) */
  backoffMultiplier: number;
  /** Maximum delay cap in ms (default: 1000) */
  maxDelayMs: number;
  /** Operation name for logging */
  operationName?: string;
}

export interface CircuitBreakerConfig {
  /** Number of consecutive failures to trip the circuit (default: 5) */
  failureThreshold: number;
  /** Time in ms to keep circuit open before allowing retry (default: 30000) */
  resetTimeoutMs: number;
}

// Default configurations per task requirements
export const STORAGE_RETRY_CONFIG: StorageRetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 100,
  backoffMultiplier: 2,
  maxDelayMs: 1000,
};

export const STORAGE_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeoutMs: 30000,
};

// ==================== Telemetry ====================

export interface RetryTelemetry {
  operationName: string;
  attemptNumber: number;
  timestamp: number;
  success: boolean;
  error?: string;
  durationMs: number;
  circuitBreakerState: CircuitState;
}

export interface RetryStats {
  totalAttempts: number;
  successfulFirstAttempts: number;
  successfulRetries: number;
  failures: number;
  circuitBreakerTrips: number;
  averageRetryCount: number;
  retryRatePercent: number;
}

// Global telemetry storage (circular buffer for last 1000 entries)
const telemetryBuffer: RetryTelemetry[] = [];
const MAX_TELEMETRY_ENTRIES = 1000;

function recordTelemetry(entry: RetryTelemetry): void {
  telemetryBuffer.push(entry);
  if (telemetryBuffer.length > MAX_TELEMETRY_ENTRIES) {
    telemetryBuffer.shift();
  }
}

/**
 * Get retry statistics for monitoring and debugging
 */
export function getRetryStats(): RetryStats {
  const entries = telemetryBuffer;
  if (entries.length === 0) {
    return {
      totalAttempts: 0,
      successfulFirstAttempts: 0,
      successfulRetries: 0,
      failures: 0,
      circuitBreakerTrips: 0,
      averageRetryCount: 0,
      retryRatePercent: 0,
    };
  }

  // Group by operation (using timestamp to identify operation boundaries)
  const operations = new Map<string, RetryTelemetry[]>();
  let currentOpKey = "";
  let lastTimestamp = 0;

  for (const entry of entries) {
    // New operation if more than 5s gap or different operation name
    if (
      entry.timestamp - lastTimestamp > 5000 ||
      !currentOpKey.startsWith(entry.operationName)
    ) {
      currentOpKey = `${entry.operationName}-${entry.timestamp}`;
    }
    if (!operations.has(currentOpKey)) {
      operations.set(currentOpKey, []);
    }
    operations.get(currentOpKey)!.push(entry);
    lastTimestamp = entry.timestamp;
  }

  let successfulFirstAttempts = 0;
  let successfulRetries = 0;
  let failures = 0;
  let totalRetries = 0;
  let circuitBreakerTrips = 0;

  for (const opEntries of operations.values()) {
    const lastEntry = opEntries[opEntries.length - 1];
    const retryCount = opEntries.length - 1;

    if (lastEntry.success) {
      if (retryCount === 0) {
        successfulFirstAttempts++;
      } else {
        successfulRetries++;
        totalRetries += retryCount;
      }
    } else {
      failures++;
      totalRetries += retryCount;
    }

    if (opEntries.some((e) => e.circuitBreakerState === CircuitState.OPEN)) {
      circuitBreakerTrips++;
    }
  }

  const totalOperations = operations.size;
  const operationsWithRetries = successfulRetries + failures;

  return {
    totalAttempts: entries.length,
    successfulFirstAttempts,
    successfulRetries,
    failures,
    circuitBreakerTrips,
    averageRetryCount:
      operationsWithRetries > 0 ? totalRetries / operationsWithRetries : 0,
    retryRatePercent:
      totalOperations > 0 ? (operationsWithRetries / totalOperations) * 100 : 0,
  };
}

/**
 * Clear telemetry buffer (for testing)
 */
export function clearRetryTelemetry(): void {
  telemetryBuffer.length = 0;
}

/**
 * Get raw telemetry entries (for debugging)
 */
export function getRawTelemetry(): readonly RetryTelemetry[] {
  return telemetryBuffer;
}

// ==================== Circuit Breaker ====================

export enum CircuitState {
  CLOSED = "CLOSED",
  OPEN = "OPEN",
  HALF_OPEN = "HALF_OPEN",
}

export class StorageCircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private consecutiveFailures = 0;
  private lastFailureTime = 0;
  private readonly name: string;

  constructor(
    name: string,
    private config: CircuitBreakerConfig = STORAGE_CIRCUIT_BREAKER_CONFIG,
  ) {
    this.name = name;
  }

  /**
   * Check if request can proceed
   */
  canProceed(): boolean {
    if (this.state === CircuitState.CLOSED) {
      return true;
    }

    if (this.state === CircuitState.OPEN) {
      const now = Date.now();
      if (now - this.lastFailureTime >= this.config.resetTimeoutMs) {
        this.state = CircuitState.HALF_OPEN;
        logger.log(`[${this.name}] Circuit breaker transitioning to HALF_OPEN`);
        return true;
      }
      return false;
    }

    // HALF_OPEN: allow one request through
    return true;
  }

  /**
   * Record successful operation
   */
  recordSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      logger.log(
        `[${this.name}] Circuit breaker closing after successful test`,
      );
    }
    this.state = CircuitState.CLOSED;
    this.consecutiveFailures = 0;
  }

  /**
   * Record failed operation
   */
  recordFailure(): void {
    this.consecutiveFailures++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      // Failed during test - reopen circuit
      this.state = CircuitState.OPEN;
      logger.log(`[${this.name}] Circuit breaker reopening after failed test`);
      return;
    }

    if (this.consecutiveFailures >= this.config.failureThreshold) {
      this.state = CircuitState.OPEN;
      logger.log(
        `[${this.name}] Circuit breaker opening after ${this.consecutiveFailures} consecutive failures`,
      );
    }
  }

  /**
   * Get time until circuit resets (for error messages)
   */
  getResetTimeMs(): number {
    if (this.state !== CircuitState.OPEN) return 0;
    const elapsed = Date.now() - this.lastFailureTime;
    return Math.max(0, this.config.resetTimeoutMs - elapsed);
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Reset circuit breaker (for testing)
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.consecutiveFailures = 0;
    this.lastFailureTime = 0;
  }
}

// ==================== Error Classification ====================

/**
 * Error thrown when circuit breaker is open
 */
export class CircuitBreakerOpenError extends Error {
  constructor(
    public readonly circuitName: string,
    public readonly resetTimeMs: number,
  ) {
    super(
      `Circuit breaker [${circuitName}] is open. Retry in ${Math.ceil(
        resetTimeMs / 1000,
      )}s`,
    );
    this.name = "CircuitBreakerOpenError";
  }
}

/**
 * Check if an error is retryable for IndexedDB operations
 */
export function isRetryableIndexedDBError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();
  const name = error.name.toLowerCase();

  // Common transient IndexedDB errors
  const transientPatterns = [
    "aborterror", // Transaction aborted
    "quotaexceedederror", // Temporary quota issue (might resolve)
    "unknownerror", // Generic transient errors
    "timeout", // Operation timeout
    "transaction", // Transaction conflicts
    "locked", // Database locked by another tab
    "versionerror", // Database upgrade in progress
  ];

  return transientPatterns.some(
    (pattern) => message.includes(pattern) || name.includes(pattern),
  );
}

/**
 * Check if an error is retryable for AT Protocol operations
 */
export function isRetryableAtProtoError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const err = error as { status?: number; message?: string };

  // Network errors
  if (error instanceof TypeError) return true;

  // Rate limiting
  if (err.status === 429) return true;

  // Server errors (temporary)
  if (err.status && err.status >= 500 && err.status < 600) return true;

  // Specific transient errors
  if (err.message) {
    const message = err.message.toLowerCase();
    if (
      message.includes("network") ||
      message.includes("timeout") ||
      message.includes("econnreset") ||
      message.includes("econnrefused")
    ) {
      return true;
    }
  }

  return false;
}

// ==================== Retry Functions ====================

/**
 * Delay helper with exponential backoff calculation
 */
function calculateDelay(attempt: number, config: StorageRetryConfig): number {
  // attempt 0 -> baseDelayMs (100ms)
  // attempt 1 -> baseDelayMs * multiplier (200ms)
  // attempt 2 -> baseDelayMs * multiplier^2 (400ms)
  const delay =
    config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt);
  return Math.min(delay, config.maxDelayMs);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface StorageRetryOptions {
  /** Custom retry configuration */
  config?: Partial<StorageRetryConfig>;
  /** Circuit breaker instance to use */
  circuitBreaker?: StorageCircuitBreaker;
  /** Custom function to determine if error is retryable */
  isRetryable?: (error: unknown) => boolean;
  /** Callback called before each retry attempt */
  onRetry?: (attempt: number, error: unknown, delayMs: number) => void;
}

/**
 * Execute a storage operation with retry logic and circuit breaker
 *
 * @example
 * ```typescript
 * const circuitBreaker = new StorageCircuitBreaker("indexeddb");
 *
 * await withStorageRetry(
 *   async () => {
 *     const tx = db.transaction("store", "readwrite");
 *     await tx.store.put(data);
 *     await tx.done;
 *   },
 *   {
 *     config: { operationName: "saveData" },
 *     circuitBreaker,
 *     isRetryable: isRetryableIndexedDBError,
 *   }
 * );
 * ```
 */
export async function withStorageRetry<T>(
  operation: () => Promise<T>,
  options: StorageRetryOptions = {},
): Promise<T> {
  const config = { ...STORAGE_RETRY_CONFIG, ...options.config };
  const circuitBreaker = options.circuitBreaker;
  const isRetryable = options.isRetryable ?? (() => true);
  const operationName = config.operationName ?? "storage-operation";

  // Check circuit breaker first
  if (circuitBreaker && !circuitBreaker.canProceed()) {
    const resetTime = circuitBreaker.getResetTimeMs();
    recordTelemetry({
      operationName,
      attemptNumber: 0,
      timestamp: Date.now(),
      success: false,
      error: `Circuit breaker open`,
      durationMs: 0,
      circuitBreakerState: circuitBreaker.getState(),
    });
    throw new CircuitBreakerOpenError(operationName, resetTime);
  }

  let lastError: unknown;

  for (let attempt = 0; attempt < config.maxAttempts; attempt++) {
    const startTime = Date.now();

    try {
      const result = await operation();

      // Record success
      const durationMs = Date.now() - startTime;
      circuitBreaker?.recordSuccess();
      recordTelemetry({
        operationName,
        attemptNumber: attempt + 1,
        timestamp: startTime,
        success: true,
        durationMs,
        circuitBreakerState: circuitBreaker?.getState() ?? CircuitState.CLOSED,
      });

      // Record to error monitor for unified metrics
      recordStorageOperation(operationName, true, durationMs, {
        attempts: attempt + 1,
      });

      if (attempt > 0) {
        logger.log(
          `[${operationName}] Succeeded after ${attempt + 1} attempts`,
        );
      }

      return result;
    } catch (error) {
      lastError = error;
      const durationMs = Date.now() - startTime;

      // Record failure telemetry
      recordTelemetry({
        operationName,
        attemptNumber: attempt + 1,
        timestamp: startTime,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        durationMs,
        circuitBreakerState: circuitBreaker?.getState() ?? CircuitState.CLOSED,
      });

      // Check if we should retry
      const isLastAttempt = attempt === config.maxAttempts - 1;
      if (isLastAttempt || !isRetryable(error)) {
        circuitBreaker?.recordFailure();

        // Record final failure to error monitor
        recordStorageOperation(operationName, false, durationMs, {
          attempts: attempt + 1,
          errorType: error instanceof Error ? error.name : "unknown",
        });
        recordStorageError(error, operationName, {
          attempts: attempt + 1,
          circuitBreakerState: circuitBreaker?.getState() ?? CircuitState.CLOSED,
        });

        throw error;
      }

      // Calculate delay and wait
      const delayMs = calculateDelay(attempt, config);
      logger.log(
        `[${operationName}] Attempt ${attempt + 1} failed, retrying in ${delayMs}ms`,
        error,
      );

      options.onRetry?.(attempt + 1, error, delayMs);
      await sleep(delayMs);
    }
  }

  // Should not reach here, but TypeScript needs this
  circuitBreaker?.recordFailure();
  throw lastError;
}

// ==================== Specialized Retry Functions ====================

// Shared circuit breakers for different storage types
const indexedDBCircuitBreaker = new StorageCircuitBreaker("indexeddb");
const atProtoCircuitBreaker = new StorageCircuitBreaker("atproto");

/**
 * Execute an IndexedDB operation with retry logic
 */
export async function withIndexedDBRetry<T>(
  operation: () => Promise<T>,
  operationName = "indexeddb-operation",
): Promise<T> {
  return withStorageRetry(operation, {
    config: { operationName },
    circuitBreaker: indexedDBCircuitBreaker,
    isRetryable: isRetryableIndexedDBError,
  });
}

/**
 * Execute an AT Protocol operation with retry logic
 */
export async function withAtProtoRetry<T>(
  operation: () => Promise<T>,
  operationName = "atproto-operation",
): Promise<T> {
  return withStorageRetry(operation, {
    config: { operationName },
    circuitBreaker: atProtoCircuitBreaker,
    isRetryable: isRetryableAtProtoError,
  });
}

/**
 * Get circuit breaker states for monitoring
 */
export function getCircuitBreakerStates(): Record<string, CircuitState> {
  return {
    indexeddb: indexedDBCircuitBreaker.getState(),
    atproto: atProtoCircuitBreaker.getState(),
  };
}

/**
 * Reset all circuit breakers (for testing)
 */
export function resetAllCircuitBreakers(): void {
  indexedDBCircuitBreaker.reset();
  atProtoCircuitBreaker.reset();
}
