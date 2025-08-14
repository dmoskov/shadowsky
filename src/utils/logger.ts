/**
 * Logger utility for consistent logging across the application
 *
 * Features:
 * - Automatic suppression of logs in production (except errors)
 * - Categorized logging with namespaces
 * - Performance timing utilities
 * - Structured error logging
 */

import { debug } from "../shared/debug";

export type LogLevel = "log" | "info" | "warn" | "error";

export interface LoggerOptions {
  namespace?: string;
  showTimestamp?: boolean;
}

class Logger {
  private namespace: string;
  private showTimestamp: boolean;

  constructor(options: LoggerOptions = {}) {
    this.namespace = options.namespace || "";
    this.showTimestamp = options.showTimestamp || false;
  }

  private formatMessage(...args: unknown[]): unknown[] {
    const prefix = this.namespace ? `[${this.namespace}]` : "";
    const timestamp = this.showTimestamp ? `[${new Date().toISOString()}]` : "";
    const prefixParts = [prefix, timestamp].filter(Boolean).join(" ");

    return prefixParts ? [prefixParts, ...args] : args;
  }

  log(...args: unknown[]): void {
    debug.log(...this.formatMessage(...args));
  }

  info(...args: unknown[]): void {
    debug.info(...this.formatMessage(...args));
  }

  warn(...args: unknown[]): void {
    debug.warn(...this.formatMessage(...args));
  }

  error(...args: unknown[]): void {
    debug.error(...this.formatMessage(...args));
  }

  /**
   * Log an error with additional context
   */
  logError(error: unknown, context?: Record<string, unknown>): void {
    const errorInfo = {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      ...context,
    };

    this.error("Error occurred:", errorInfo);
  }

  /**
   * Create a child logger with a sub-namespace
   */
  child(subNamespace: string): Logger {
    const namespace = this.namespace
      ? `${this.namespace}:${subNamespace}`
      : subNamespace;

    return new Logger({
      namespace,
      showTimestamp: this.showTimestamp,
    });
  }

  /**
   * Time a function execution
   */
  async time<T>(label: string, fn: () => T | Promise<T>): Promise<T> {
    const startLabel = `${this.namespace ? `${this.namespace}:` : ""}${label}`;
    debug.time(startLabel);

    try {
      const result = await fn();
      debug.timeEnd(startLabel);
      return result;
    } catch (error) {
      debug.timeEnd(startLabel);
      throw error;
    }
  }
}

// Create default logger instance
export const logger = new Logger();

// Export factory function for creating namespaced loggers
export function createLogger(
  namespace: string,
  options?: Omit<LoggerOptions, "namespace">,
): Logger {
  return new Logger({ namespace, ...options });
}

// Convenience exports for common namespaces
export const componentLogger = createLogger("Component");
export const serviceLogger = createLogger("Service");
export const apiLogger = createLogger("API");
export const uiLogger = createLogger("UI");
