/**
 * Batched LocalStorage Service
 *
 * Addresses the performance issue of 136+ synchronous localStorage operations
 * blocking the main thread. This service provides:
 *
 * 1. Write Queue: Accumulates writes instead of executing immediately
 * 2. Debounced Flush: Batches writes with 500ms debounce
 * 3. Performance Marks: Monitors batch sizes and flush timing
 * 4. Fallback Safety: Immediately flushes critical writes on page unload
 *
 * Usage:
 *   import { batchedStorage } from '@/services/storage/batched-local-storage';
 *   batchedStorage.setItem('key', 'value');
 *   batchedStorage.getItem('key'); // reads from queue or localStorage
 *
 * @module storage/batched-local-storage
 */

import { createLogger } from "../../utils/logger";

const logger = createLogger("BatchedLocalStorage");

/** Default debounce delay in ms */
const DEFAULT_DEBOUNCE_MS = 500;

/** Maximum pending writes before forcing a flush */
const MAX_PENDING_WRITES = 50;

/** Performance mark names */
const PERF_MARKS = {
  FLUSH_START: "batchedStorage:flush:start",
  FLUSH_END: "batchedStorage:flush:end",
  BATCH_WRITE: "batchedStorage:batch:write",
} as const;

interface PendingWrite {
  type: "set" | "remove";
  key: string;
  value?: string;
  timestamp: number;
}

interface BatchStats {
  totalWrites: number;
  totalFlushes: number;
  averageBatchSize: number;
  lastFlushTime: number | null;
  pendingWrites: number;
}

/**
 * BatchedLocalStorage - Debounced, batched localStorage operations
 */
class BatchedLocalStorage {
  private writeQueue: Map<string, PendingWrite> = new Map();
  private flushTimeout: ReturnType<typeof setTimeout> | null = null;
  private debounceMs: number;
  private stats: BatchStats = {
    totalWrites: 0,
    totalFlushes: 0,
    averageBatchSize: 0,
    lastFlushTime: null,
    pendingWrites: 0,
  };
  private isAvailable: boolean;
  private flushPromise: Promise<void> | null = null;
  private boundBeforeUnload: (() => void) | null = null;
  private boundPageHide: (() => void) | null = null;
  private boundVisibilityChange: (() => void) | null = null;

  constructor(debounceMs: number = DEFAULT_DEBOUNCE_MS) {
    this.debounceMs = debounceMs;
    this.isAvailable = this.checkAvailability();

    // Flush on page unload to prevent data loss
    if (typeof window !== "undefined") {
      this.boundBeforeUnload = () => this.flushSync();
      this.boundPageHide = () => this.flushSync();
      this.boundVisibilityChange = () => {
        if (document.visibilityState === "hidden") {
          this.flushSync();
        }
      };
      window.addEventListener("beforeunload", this.boundBeforeUnload);
      window.addEventListener("pagehide", this.boundPageHide);
      document.addEventListener("visibilitychange", this.boundVisibilityChange);
    }
  }

  /**
   * Check if localStorage is available
   */
  private checkAvailability(): boolean {
    if (typeof window === "undefined" || typeof localStorage === "undefined") {
      return false;
    }
    try {
      const testKey = "__storage_test__";
      localStorage.setItem(testKey, testKey);
      localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Set an item in localStorage (batched/debounced)
   */
  setItem(key: string, value: string): void {
    if (!this.isAvailable) {
      logger.warn("localStorage not available, write skipped:", key);
      return;
    }

    // Add to write queue (overwrites previous pending write for same key)
    this.writeQueue.set(key, {
      type: "set",
      key,
      value,
      timestamp: Date.now(),
    });

    this.stats.pendingWrites = this.writeQueue.size;
    this.scheduleFlush();

    // Force immediate flush if queue is too large
    if (this.writeQueue.size >= MAX_PENDING_WRITES) {
      logger.log(
        `Queue size ${this.writeQueue.size} reached max, forcing flush`,
      );
      this.flush();
    }
  }

  /**
   * Remove an item from localStorage (batched/debounced)
   */
  removeItem(key: string): void {
    if (!this.isAvailable) {
      return;
    }

    this.writeQueue.set(key, {
      type: "remove",
      key,
      timestamp: Date.now(),
    });

    this.stats.pendingWrites = this.writeQueue.size;
    this.scheduleFlush();
  }

  /**
   * Get an item - reads from pending queue first, then localStorage
   */
  getItem(key: string): string | null {
    if (!this.isAvailable) {
      return null;
    }

    // Check if there's a pending write for this key
    const pending = this.writeQueue.get(key);
    if (pending) {
      if (pending.type === "remove") {
        return null;
      }
      return pending.value ?? null;
    }

    // Read from localStorage
    return localStorage.getItem(key);
  }

  /**
   * Get storage key - synchronous pass-through
   */
  key(index: number): string | null {
    if (!this.isAvailable) {
      return null;
    }
    return localStorage.key(index);
  }

  /**
   * Get storage length - returns localStorage length
   * Note: This doesn't account for pending writes
   */
  get length(): number {
    if (!this.isAvailable) {
      return 0;
    }
    return localStorage.length;
  }

  /**
   * Clear all localStorage (immediate, not batched)
   */
  clear(): void {
    if (!this.isAvailable) {
      return;
    }
    this.writeQueue.clear();
    this.stats.pendingWrites = 0;
    localStorage.clear();
  }

  /**
   * Schedule a debounced flush
   */
  private scheduleFlush(): void {
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
    }

    this.flushTimeout = setTimeout(() => {
      this.flush();
    }, this.debounceMs);
  }

  /**
   * Flush all pending writes to localStorage (async)
   */
  async flush(): Promise<void> {
    // If a flush is already in progress, wait for it
    if (this.flushPromise) {
      return this.flushPromise;
    }

    this.flushPromise = this.doFlush();
    try {
      await this.flushPromise;
    } finally {
      this.flushPromise = null;
    }
  }

  /**
   * Internal flush implementation
   */
  private async doFlush(): Promise<void> {
    if (this.writeQueue.size === 0) {
      return;
    }

    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }

    const batchSize = this.writeQueue.size;
    const writes = Array.from(this.writeQueue.values());
    this.writeQueue.clear();
    this.stats.pendingWrites = 0;

    // Performance mark start
    if (typeof performance !== "undefined" && performance.mark) {
      performance.mark(PERF_MARKS.FLUSH_START);
    }

    const startTime = performance.now();

    try {
      // Execute all writes
      for (const write of writes) {
        if (write.type === "set" && write.value !== undefined) {
          localStorage.setItem(write.key, write.value);
        } else if (write.type === "remove") {
          localStorage.removeItem(write.key);
        }
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Performance mark end
      if (typeof performance !== "undefined" && performance.mark) {
        performance.mark(PERF_MARKS.FLUSH_END);
        performance.measure(
          PERF_MARKS.BATCH_WRITE,
          PERF_MARKS.FLUSH_START,
          PERF_MARKS.FLUSH_END,
        );
      }

      // Update stats
      this.stats.totalWrites += batchSize;
      this.stats.totalFlushes++;
      this.stats.lastFlushTime = Date.now();
      this.stats.averageBatchSize =
        this.stats.totalWrites / this.stats.totalFlushes;

      logger.log(
        `Flushed ${batchSize} writes in ${duration.toFixed(2)}ms (avg batch: ${this.stats.averageBatchSize.toFixed(1)})`,
      );
    } catch (error) {
      // On quota exceeded, try to write individually and report failures
      if (
        error instanceof DOMException &&
        error.name === "QuotaExceededError"
      ) {
        logger.error("localStorage quota exceeded during batch flush");
        this.handleQuotaExceeded(writes);
      } else {
        logger.error("Error during batch flush:", error);
        throw error;
      }
    }
  }

  /**
   * Synchronous flush for beforeunload events
   */
  flushSync(): void {
    if (this.writeQueue.size === 0) {
      return;
    }

    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }

    const writes = Array.from(this.writeQueue.values());
    this.writeQueue.clear();
    this.stats.pendingWrites = 0;

    try {
      for (const write of writes) {
        if (write.type === "set" && write.value !== undefined) {
          localStorage.setItem(write.key, write.value);
        } else if (write.type === "remove") {
          localStorage.removeItem(write.key);
        }
      }
      logger.log(`Sync flushed ${writes.length} writes on page unload`);
    } catch (error) {
      logger.error("Error during sync flush:", error);
    }
  }

  /**
   * Handle quota exceeded by attempting individual writes
   */
  private handleQuotaExceeded(writes: PendingWrite[]): void {
    let successCount = 0;
    let failCount = 0;

    for (const write of writes) {
      try {
        if (write.type === "set" && write.value !== undefined) {
          localStorage.setItem(write.key, write.value);
          successCount++;
        } else if (write.type === "remove") {
          localStorage.removeItem(write.key);
          successCount++;
        }
      } catch {
        failCount++;
        logger.warn(`Failed to write key: ${write.key} (quota exceeded)`);
      }
    }

    logger.warn(
      `Quota exceeded recovery: ${successCount} succeeded, ${failCount} failed`,
    );
  }

  /**
   * Clean up event listeners and pending timers
   */
  destroy(): void {
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }
    if (typeof window !== "undefined") {
      if (this.boundBeforeUnload) {
        window.removeEventListener("beforeunload", this.boundBeforeUnload);
        this.boundBeforeUnload = null;
      }
      if (this.boundPageHide) {
        window.removeEventListener("pagehide", this.boundPageHide);
        this.boundPageHide = null;
      }
      if (this.boundVisibilityChange) {
        document.removeEventListener(
          "visibilitychange",
          this.boundVisibilityChange,
        );
        this.boundVisibilityChange = null;
      }
    }
  }

  /**
   * Get current batch statistics
   */
  getStats(): BatchStats {
    return { ...this.stats };
  }

  /**
   * Get count of pending writes
   */
  getPendingCount(): number {
    return this.writeQueue.size;
  }

  /**
   * Check if there are pending writes
   */
  hasPendingWrites(): boolean {
    return this.writeQueue.size > 0;
  }

  /**
   * Force an immediate flush (for testing or critical writes)
   */
  async forceFlush(): Promise<void> {
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }
    await this.flush();
  }

  /**
   * Set the debounce delay
   */
  setDebounceMs(ms: number): void {
    this.debounceMs = ms;
  }

  /**
   * Get the current debounce delay
   */
  getDebounceMs(): number {
    return this.debounceMs;
  }

  /**
   * Reset stats (for testing)
   */
  resetStats(): void {
    this.stats = {
      totalWrites: 0,
      totalFlushes: 0,
      averageBatchSize: 0,
      lastFlushTime: null,
      pendingWrites: this.writeQueue.size,
    };
  }
}

// Singleton instance
let instance: BatchedLocalStorage | null = null;

/**
 * Get the singleton BatchedLocalStorage instance
 */
export function getBatchedStorage(): BatchedLocalStorage {
  if (!instance) {
    instance = new BatchedLocalStorage();
  }
  return instance;
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetBatchedStorage(): void {
  if (instance) {
    instance.flushSync();
    instance.destroy();
  }
  instance = null;
}

/**
 * Convenience export of the singleton
 */
export const batchedStorage = getBatchedStorage();

// Export the class for type usage
export { BatchedLocalStorage };
export type { BatchStats, PendingWrite };
