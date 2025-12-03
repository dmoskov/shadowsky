/**
 * Structured Error Monitoring Service
 *
 * Provides production-grade error tracking and performance monitoring
 * with privacy-first design (DNT support, PII sanitization).
 *
 * Features:
 * - Structured log format with JSON payloads
 * - Storage operation metrics (success/failure rates, latencies)
 * - Error type classification and frequency tracking
 * - PII sanitization (no user content in logs)
 * - Do Not Track (DNT) respect
 * - Session-based error aggregation
 * - Circular buffer for memory efficiency
 *
 * @module error-monitoring
 */

import { createLogger } from "./logger";

const logger = createLogger("ErrorMonitoring");

// ==================== Configuration ====================

export interface ErrorMonitoringConfig {
  /** Maximum error entries to keep in memory */
  maxEntries: number;
  /** Time window for aggregation in ms */
  aggregationWindowMs: number;
  /** Whether to send to external service (future CloudWatch integration) */
  enableRemoteLogging: boolean;
  /** Sample rate for non-critical errors (0-1) */
  sampleRate: number;
}

export const DEFAULT_ERROR_MONITORING_CONFIG: ErrorMonitoringConfig = {
  maxEntries: 500,
  aggregationWindowMs: 60000, // 1 minute
  enableRemoteLogging: false, // Disabled until CloudWatch integration
  sampleRate: 1.0, // Log all errors by default
};

// ==================== Types ====================

export type ErrorSeverity = "critical" | "error" | "warning" | "info";

export type ErrorCategory =
  | "storage"
  | "network"
  | "auth"
  | "rate_limit"
  | "validation"
  | "ui"
  | "unknown";

export interface ErrorContext {
  /** Operation that triggered the error */
  operation: string;
  /** Component or service name */
  component: string;
  /** Error category for grouping */
  category: ErrorCategory;
  /** Error severity level */
  severity: ErrorSeverity;
  /** Additional metadata (must be PII-free) */
  metadata?: Record<string, string | number | boolean>;
}

export interface MonitoredError {
  /** Unique error ID */
  id: string;
  /** Timestamp of occurrence */
  timestamp: number;
  /** Error message (sanitized) */
  message: string;
  /** Error name/type */
  type: string;
  /** Stack trace (sanitized) */
  stack?: string;
  /** Error context */
  context: ErrorContext;
  /** Session ID for grouping */
  sessionId: string;
  /** Whether user has DNT enabled */
  dntEnabled: boolean;
}

export interface OperationMetric {
  /** Operation name */
  operation: string;
  /** Category (storage, network, etc.) */
  category: ErrorCategory;
  /** Success or failure */
  success: boolean;
  /** Duration in milliseconds */
  durationMs: number;
  /** Timestamp */
  timestamp: number;
  /** Additional metadata */
  metadata?: Record<string, string | number | boolean>;
}

export interface ErrorStats {
  /** Total errors recorded */
  totalErrors: number;
  /** Errors by category */
  byCategory: Record<ErrorCategory, number>;
  /** Errors by severity */
  bySeverity: Record<ErrorSeverity, number>;
  /** Unique error types */
  uniqueTypes: number;
  /** Errors in last hour */
  lastHour: number;
  /** Most frequent error type */
  mostFrequentType?: string;
}

export interface OperationStats {
  /** Total operations recorded */
  totalOperations: number;
  /** Successful operations */
  successCount: number;
  /** Failed operations */
  failureCount: number;
  /** Success rate percentage */
  successRate: number;
  /** Average duration in ms */
  avgDurationMs: number;
  /** P50 latency */
  p50DurationMs: number;
  /** P95 latency */
  p95DurationMs: number;
  /** P99 latency */
  p99DurationMs: number;
  /** Stats by operation name */
  byOperation: Record<
    string,
    { success: number; failure: number; avgMs: number }
  >;
}

// ==================== PII Sanitization ====================

/**
 * Patterns that indicate potential PII in error messages
 */
const PII_PATTERNS = [
  // Email addresses
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  // DID (Decentralized Identifier)
  /did:[a-z]+:[a-zA-Z0-9._-]+/g,
  // Handle (Bluesky username)
  /@[a-zA-Z0-9._-]+\.[a-zA-Z]+/g,
  // AT Protocol URIs with user content
  /at:\/\/[^\s]+/g,
  // JWT tokens
  /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g,
  // Bearer tokens
  /Bearer\s+[a-zA-Z0-9._-]+/gi,
  // API keys (various formats)
  /[a-zA-Z0-9]{32,}/g,
  // URLs with query params (may contain tokens)
  /\?[^\s]*token=[^\s&]*/gi,
  // IP addresses
  /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
  // Phone numbers (various formats)
  /(\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
];

/**
 * Sensitive keys in stack traces or metadata
 */
const SENSITIVE_KEYS = [
  "password",
  "token",
  "secret",
  "api_key",
  "apiKey",
  "authorization",
  "auth",
  "credential",
  "session",
  "cookie",
];

/**
 * Sanitize a string to remove potential PII
 */
export function sanitizeMessage(message: string): string {
  let sanitized = message;

  for (const pattern of PII_PATTERNS) {
    sanitized = sanitized.replace(pattern, "[REDACTED]");
  }

  return sanitized;
}

/**
 * Sanitize stack trace to remove file paths and PII
 */
export function sanitizeStackTrace(
  stack: string | undefined,
): string | undefined {
  if (!stack) return undefined;

  let sanitized = stack;

  // Remove full file paths, keep only filename and line number
  sanitized = sanitized.replace(/at\s+.*\(([^/\\]+:\d+:\d+)\)/g, "at $1");

  // Remove file:// URLs
  sanitized = sanitized.replace(/file:\/\/[^\s)]+/g, "[FILE]");

  // Apply PII patterns
  for (const pattern of PII_PATTERNS) {
    sanitized = sanitized.replace(pattern, "[REDACTED]");
  }

  // Limit stack trace length
  const lines = sanitized.split("\n").slice(0, 10);
  return lines.join("\n");
}

/**
 * Sanitize metadata object
 */
export function sanitizeMetadata(
  metadata: Record<string, unknown> | undefined,
): Record<string, string | number | boolean> | undefined {
  if (!metadata) return undefined;

  const sanitized: Record<string, string | number | boolean> = {};

  for (const [key, value] of Object.entries(metadata)) {
    // Skip sensitive keys
    if (SENSITIVE_KEYS.some((k) => key.toLowerCase().includes(k))) {
      continue;
    }

    // Only include primitive values
    if (typeof value === "string") {
      sanitized[key] = sanitizeMessage(value);
    } else if (typeof value === "number" || typeof value === "boolean") {
      sanitized[key] = value;
    }
  }

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

// ==================== DNT (Do Not Track) Support ====================

let cachedDNTStatus: boolean | null = null;

/**
 * Check if user has Do Not Track enabled
 */
export function isDoNotTrackEnabled(): boolean {
  if (cachedDNTStatus !== null) {
    return cachedDNTStatus;
  }

  if (typeof navigator === "undefined") {
    return false;
  }

  // Check DNT header
  const dnt =
    navigator.doNotTrack === "1" ||
    navigator.doNotTrack === "yes" ||
    // @ts-expect-error - msDoNotTrack is IE-specific
    window.doNotTrack === "1" ||
    // @ts-expect-error - msDoNotTrack is IE-specific
    navigator.msDoNotTrack === "1";

  // Check Global Privacy Control
  // @ts-expect-error - GPC is a newer standard
  const gpc = navigator.globalPrivacyControl === true;

  cachedDNTStatus = dnt || gpc;
  return cachedDNTStatus;
}

/**
 * Clear cached DNT status (for testing)
 */
export function clearDNTCache(): void {
  cachedDNTStatus = null;
}

// ==================== Session Management ====================

let sessionId: string | null = null;

/**
 * Generate or get session ID for error grouping
 */
function getSessionId(): string {
  if (sessionId) {
    return sessionId;
  }

  // Generate a random session ID (not tied to user identity)
  sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  return sessionId;
}

/**
 * Reset session ID (for testing or new sessions)
 */
export function resetSession(): void {
  sessionId = null;
}

// ==================== Error Monitor Class ====================

class ErrorMonitor {
  private config: ErrorMonitoringConfig;
  private errorBuffer: MonitoredError[] = [];
  private operationBuffer: OperationMetric[] = [];
  private errorCounts: Map<string, number> = new Map();

  constructor(config: Partial<ErrorMonitoringConfig> = {}) {
    this.config = { ...DEFAULT_ERROR_MONITORING_CONFIG, ...config };
  }

  /**
   * Record an error with context
   */
  recordError(error: unknown, context: ErrorContext): MonitoredError | null {
    // Apply sampling for non-critical errors
    if (
      context.severity !== "critical" &&
      Math.random() > this.config.sampleRate
    ) {
      return null;
    }

    const dntEnabled = isDoNotTrackEnabled();
    const errorObj = error instanceof Error ? error : new Error(String(error));

    const monitoredError: MonitoredError = {
      id: `err_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      timestamp: Date.now(),
      message: sanitizeMessage(errorObj.message),
      type: errorObj.name,
      stack: dntEnabled ? undefined : sanitizeStackTrace(errorObj.stack),
      context: {
        ...context,
        metadata: dntEnabled ? undefined : sanitizeMetadata(context.metadata),
      },
      sessionId: getSessionId(),
      dntEnabled,
    };

    // Add to buffer
    this.errorBuffer.push(monitoredError);
    if (this.errorBuffer.length > this.config.maxEntries) {
      this.errorBuffer.shift();
    }

    // Update error counts
    const countKey = `${context.category}:${errorObj.name}`;
    this.errorCounts.set(countKey, (this.errorCounts.get(countKey) || 0) + 1);

    // Log structured error
    this.logStructuredError(monitoredError);

    return monitoredError;
  }

  /**
   * Record an operation metric (success or failure)
   */
  recordOperation(metric: Omit<OperationMetric, "timestamp">): void {
    const fullMetric: OperationMetric = {
      ...metric,
      timestamp: Date.now(),
      metadata: isDoNotTrackEnabled()
        ? undefined
        : sanitizeMetadata(metric.metadata),
    };

    this.operationBuffer.push(fullMetric);
    if (this.operationBuffer.length > this.config.maxEntries) {
      this.operationBuffer.shift();
    }

    // Log operation for debugging (only failures in production)
    if (!fullMetric.success) {
      logger.warn(
        `Operation failed: ${fullMetric.operation} (${fullMetric.durationMs}ms)`,
        fullMetric.metadata,
      );
    }
  }

  /**
   * Time and record an async operation
   */
  async timeOperation<T>(
    operation: string,
    category: ErrorCategory,
    fn: () => Promise<T>,
    metadata?: Record<string, string | number | boolean>,
  ): Promise<T> {
    const startTime = performance.now();
    let success = true;

    try {
      return await fn();
    } catch (error) {
      success = false;
      throw error;
    } finally {
      const durationMs = Math.round(performance.now() - startTime);
      this.recordOperation({
        operation,
        category,
        success,
        durationMs,
        metadata,
      });
    }
  }

  /**
   * Get error statistics
   */
  getErrorStats(): ErrorStats {
    const hourAgo = Date.now() - 3600000;
    const recentErrors = this.errorBuffer.filter((e) => e.timestamp > hourAgo);

    const byCategory: Record<ErrorCategory, number> = {
      storage: 0,
      network: 0,
      auth: 0,
      rate_limit: 0,
      validation: 0,
      ui: 0,
      unknown: 0,
    };

    const bySeverity: Record<ErrorSeverity, number> = {
      critical: 0,
      error: 0,
      warning: 0,
      info: 0,
    };

    const typeCounts = new Map<string, number>();

    for (const error of this.errorBuffer) {
      byCategory[error.context.category]++;
      bySeverity[error.context.severity]++;
      typeCounts.set(error.type, (typeCounts.get(error.type) || 0) + 1);
    }

    let mostFrequentType: string | undefined;
    let maxCount = 0;
    typeCounts.forEach((count, type) => {
      if (count > maxCount) {
        maxCount = count;
        mostFrequentType = type;
      }
    });

    return {
      totalErrors: this.errorBuffer.length,
      byCategory,
      bySeverity,
      uniqueTypes: typeCounts.size,
      lastHour: recentErrors.length,
      mostFrequentType,
    };
  }

  /**
   * Get operation statistics
   */
  getOperationStats(): OperationStats {
    if (this.operationBuffer.length === 0) {
      return {
        totalOperations: 0,
        successCount: 0,
        failureCount: 0,
        successRate: 100,
        avgDurationMs: 0,
        p50DurationMs: 0,
        p95DurationMs: 0,
        p99DurationMs: 0,
        byOperation: {},
      };
    }

    const successCount = this.operationBuffer.filter((o) => o.success).length;
    const failureCount = this.operationBuffer.length - successCount;

    // Calculate percentiles
    const sortedDurations = this.operationBuffer
      .map((o) => o.durationMs)
      .sort((a, b) => a - b);

    const percentile = (arr: number[], p: number): number => {
      const index = Math.ceil(arr.length * p) - 1;
      return arr[Math.max(0, index)];
    };

    // Group by operation
    const byOperation: Record<
      string,
      { success: number; failure: number; avgMs: number }
    > = {};
    for (const op of this.operationBuffer) {
      if (!byOperation[op.operation]) {
        byOperation[op.operation] = { success: 0, failure: 0, avgMs: 0 };
      }
      if (op.success) {
        byOperation[op.operation].success++;
      } else {
        byOperation[op.operation].failure++;
      }
    }

    // Calculate average duration per operation
    for (const opName of Object.keys(byOperation)) {
      const opsForName = this.operationBuffer.filter(
        (o) => o.operation === opName,
      );
      const totalMs = opsForName.reduce((sum, o) => sum + o.durationMs, 0);
      byOperation[opName].avgMs = Math.round(totalMs / opsForName.length);
    }

    const totalDuration = this.operationBuffer.reduce(
      (sum, o) => sum + o.durationMs,
      0,
    );

    return {
      totalOperations: this.operationBuffer.length,
      successCount,
      failureCount,
      successRate: Math.round(
        (successCount / this.operationBuffer.length) * 100,
      ),
      avgDurationMs: Math.round(totalDuration / this.operationBuffer.length),
      p50DurationMs: percentile(sortedDurations, 0.5),
      p95DurationMs: percentile(sortedDurations, 0.95),
      p99DurationMs: percentile(sortedDurations, 0.99),
      byOperation,
    };
  }

  /**
   * Get storage-specific operation stats
   */
  getStorageStats(): OperationStats {
    const storageOps = this.operationBuffer.filter(
      (o) => o.category === "storage",
    );

    if (storageOps.length === 0) {
      return {
        totalOperations: 0,
        successCount: 0,
        failureCount: 0,
        successRate: 100,
        avgDurationMs: 0,
        p50DurationMs: 0,
        p95DurationMs: 0,
        p99DurationMs: 0,
        byOperation: {},
      };
    }

    const successCount = storageOps.filter((o) => o.success).length;
    const sortedDurations = storageOps
      .map((o) => o.durationMs)
      .sort((a, b) => a - b);

    const percentile = (arr: number[], p: number): number => {
      const index = Math.ceil(arr.length * p) - 1;
      return arr[Math.max(0, index)];
    };

    const byOperation: Record<
      string,
      { success: number; failure: number; avgMs: number }
    > = {};
    for (const op of storageOps) {
      if (!byOperation[op.operation]) {
        byOperation[op.operation] = { success: 0, failure: 0, avgMs: 0 };
      }
      if (op.success) {
        byOperation[op.operation].success++;
      } else {
        byOperation[op.operation].failure++;
      }
    }

    for (const opName of Object.keys(byOperation)) {
      const opsForName = storageOps.filter((o) => o.operation === opName);
      const totalMs = opsForName.reduce((sum, o) => sum + o.durationMs, 0);
      byOperation[opName].avgMs = Math.round(totalMs / opsForName.length);
    }

    const totalDuration = storageOps.reduce((sum, o) => sum + o.durationMs, 0);

    return {
      totalOperations: storageOps.length,
      successCount,
      failureCount: storageOps.length - successCount,
      successRate: Math.round((successCount / storageOps.length) * 100),
      avgDurationMs: Math.round(totalDuration / storageOps.length),
      p50DurationMs: percentile(sortedDurations, 0.5),
      p95DurationMs: percentile(sortedDurations, 0.95),
      p99DurationMs: percentile(sortedDurations, 0.99),
      byOperation,
    };
  }

  /**
   * Export all data for debugging (respects DNT)
   */
  exportData(): {
    errors: MonitoredError[];
    operations: OperationMetric[];
    errorStats: ErrorStats;
    operationStats: OperationStats;
    storageStats: OperationStats;
    dntEnabled: boolean;
  } {
    return {
      errors: isDoNotTrackEnabled() ? [] : [...this.errorBuffer],
      operations: isDoNotTrackEnabled() ? [] : [...this.operationBuffer],
      errorStats: this.getErrorStats(),
      operationStats: this.getOperationStats(),
      storageStats: this.getStorageStats(),
      dntEnabled: isDoNotTrackEnabled(),
    };
  }

  /**
   * Clear all data (for testing or privacy)
   */
  clear(): void {
    this.errorBuffer = [];
    this.operationBuffer = [];
    this.errorCounts.clear();
  }

  /**
   * Log structured error in JSON format
   */
  private logStructuredError(error: MonitoredError): void {
    const logData = {
      level: error.context.severity,
      type: "error",
      error: {
        id: error.id,
        message: error.message,
        type: error.type,
        category: error.context.category,
        operation: error.context.operation,
        component: error.context.component,
      },
      session: error.sessionId,
      timestamp: new Date(error.timestamp).toISOString(),
      dnt: error.dntEnabled,
    };

    // Log based on severity
    switch (error.context.severity) {
      case "critical":
        logger.error("CRITICAL_ERROR:", JSON.stringify(logData));
        break;
      case "error":
        logger.error("ERROR:", JSON.stringify(logData));
        break;
      case "warning":
        logger.warn("WARNING:", JSON.stringify(logData));
        break;
      case "info":
        logger.info("INFO:", JSON.stringify(logData));
        break;
    }
  }
}

// ==================== Singleton Instance ====================

let monitorInstance: ErrorMonitor | null = null;

/**
 * Get the error monitor singleton instance
 */
export function getErrorMonitor(): ErrorMonitor {
  if (!monitorInstance) {
    monitorInstance = new ErrorMonitor();
  }
  return monitorInstance;
}

/**
 * Initialize error monitor with custom config
 */
export function initializeErrorMonitor(
  config?: Partial<ErrorMonitoringConfig>,
): ErrorMonitor {
  monitorInstance = new ErrorMonitor(config);
  return monitorInstance;
}

/**
 * Reset the error monitor instance (for testing)
 */
export function resetErrorMonitor(): void {
  monitorInstance?.clear();
  monitorInstance = null;
}

// ==================== Convenience Functions ====================

/**
 * Record a storage error
 */
export function recordStorageError(
  error: unknown,
  operation: string,
  metadata?: Record<string, string | number | boolean>,
): void {
  getErrorMonitor().recordError(error, {
    operation,
    component: "storage",
    category: "storage",
    severity: "error",
    metadata,
  });
}

/**
 * Record a network error
 */
export function recordNetworkError(
  error: unknown,
  operation: string,
  metadata?: Record<string, string | number | boolean>,
): void {
  getErrorMonitor().recordError(error, {
    operation,
    component: "network",
    category: "network",
    severity: "error",
    metadata,
  });
}

/**
 * Record an auth error
 */
export function recordAuthError(
  error: unknown,
  operation: string,
  metadata?: Record<string, string | number | boolean>,
): void {
  getErrorMonitor().recordError(error, {
    operation,
    component: "auth",
    category: "auth",
    severity: "error",
    metadata,
  });
}

/**
 * Record a storage operation metric
 */
export function recordStorageOperation(
  operation: string,
  success: boolean,
  durationMs: number,
  metadata?: Record<string, string | number | boolean>,
): void {
  getErrorMonitor().recordOperation({
    operation,
    category: "storage",
    success,
    durationMs,
    metadata,
  });
}

/**
 * Time a storage operation
 */
export async function timeStorageOperation<T>(
  operation: string,
  fn: () => Promise<T>,
  metadata?: Record<string, string | number | boolean>,
): Promise<T> {
  return getErrorMonitor().timeOperation(operation, "storage", fn, metadata);
}

/**
 * Time a network operation
 */
export async function timeNetworkOperation<T>(
  operation: string,
  fn: () => Promise<T>,
  metadata?: Record<string, string | number | boolean>,
): Promise<T> {
  return getErrorMonitor().timeOperation(operation, "network", fn, metadata);
}

// ==================== Debug Utilities ====================

/**
 * Expose monitor for debugging in development
 */
if (typeof window !== "undefined") {
  // @ts-expect-error - Adding to window for debugging
  window.__errorMonitor = {
    getStats: () => getErrorMonitor().exportData(),
    getErrorStats: () => getErrorMonitor().getErrorStats(),
    getOperationStats: () => getErrorMonitor().getOperationStats(),
    getStorageStats: () => getErrorMonitor().getStorageStats(),
    clear: () => getErrorMonitor().clear(),
    isDNTEnabled: isDoNotTrackEnabled,
  };
}
