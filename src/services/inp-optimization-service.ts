/**
 * INP (Interaction to Next Paint) Optimization Service
 *
 * Provides long task detection using PerformanceObserver and an input
 * prioritization system that defers non-critical work during user interactions.
 *
 * Key features:
 * - Long task detection (>50ms tasks) with detailed attribution
 * - Input prioritization system for deferring non-critical work
 * - Task yielding utilities for breaking up long-running operations
 * - Integration with existing Web Vitals monitoring
 */

import { createLogger } from "../utils/logger";

const logger = createLogger("INPOptimization");

// Long task threshold (50ms is the standard threshold)
const LONG_TASK_THRESHOLD_MS = 50;

// Input interaction window - time to keep yielding after user input (ms)
const INPUT_INTERACTION_WINDOW_MS = 100;

// Maximum time to wait before forcing deferred task execution (ms)
const MAX_DEFERRED_WAIT_MS = 5000;

// Yield interval for chunked operations (ms)
const DEFAULT_YIELD_INTERVAL_MS = 5;

/**
 * Priority levels for deferred tasks
 */
export enum TaskPriority {
  /** Critical UI updates - run ASAP */
  Critical = 0,
  /** User-visible updates - run during idle or after interactions */
  High = 1,
  /** Background work - defer during interactions */
  Normal = 2,
  /** Low priority - only run when truly idle */
  Low = 3,
}

/**
 * Long task entry with attribution data
 */
export interface LongTaskEntry {
  /** Task duration in milliseconds */
  duration: number;
  /** Start time relative to navigation start */
  startTime: number;
  /** Task name/type */
  name: string;
  /** Attribution data (script URL, container info) */
  attribution: LongTaskAttribution[];
  /** Timestamp when detected */
  timestamp: number;
}

/**
 * Attribution data for long task sources
 */
export interface LongTaskAttribution {
  /** Name of the attribution entry */
  name: string;
  /** Entry type */
  entryType: string;
  /** Start time */
  startTime: number;
  /** Duration */
  duration: number;
  /** Container type (window, iframe, embed, object) */
  containerType?: string;
  /** Container source URL */
  containerSrc?: string;
  /** Container ID */
  containerId?: string;
  /** Container name */
  containerName?: string;
}

/**
 * Deferred task definition
 */
export interface DeferredTask<T = unknown> {
  /** Unique task ID */
  id: string;
  /** Task execution function */
  execute: () => T | Promise<T>;
  /** Task priority */
  priority: TaskPriority;
  /** Timestamp when queued */
  queuedAt: number;
  /** Optional callback on completion */
  onComplete?: (result: T) => void;
  /** Optional callback on error */
  onError?: (error: Error) => void;
  /** Whether this task can be cancelled */
  cancellable: boolean;
  /** Task description for debugging */
  description?: string;
}

/**
 * Configuration for the INP optimization service
 */
export interface INPOptimizationConfig {
  /** Enable long task detection */
  enableLongTaskDetection: boolean;
  /** Enable input prioritization */
  enableInputPrioritization: boolean;
  /** Long task threshold in ms (default: 50ms) */
  longTaskThresholdMs: number;
  /** Input interaction window in ms (default: 100ms) */
  inputInteractionWindowMs: number;
  /** Maximum wait for deferred tasks in ms (default: 5000ms) */
  maxDeferredWaitMs: number;
  /** Default yield interval for chunked operations in ms */
  defaultYieldIntervalMs: number;
  /** Maximum long tasks to store in history */
  maxLongTaskHistory: number;
}

const DEFAULT_CONFIG: INPOptimizationConfig = {
  enableLongTaskDetection: true,
  enableInputPrioritization: true,
  longTaskThresholdMs: LONG_TASK_THRESHOLD_MS,
  inputInteractionWindowMs: INPUT_INTERACTION_WINDOW_MS,
  maxDeferredWaitMs: MAX_DEFERRED_WAIT_MS,
  defaultYieldIntervalMs: DEFAULT_YIELD_INTERVAL_MS,
  maxLongTaskHistory: 100,
};

type LongTaskListener = (entry: LongTaskEntry) => void;
type InputStateListener = (isInteracting: boolean) => void;

/**
 * INP Optimization Service
 *
 * Singleton service for optimizing Interaction to Next Paint by:
 * 1. Detecting and tracking long tasks
 * 2. Providing input prioritization to defer non-critical work
 * 3. Offering utilities for yielding to the main thread
 */
class INPOptimizationService {
  private static instance: INPOptimizationService;

  private config: INPOptimizationConfig;
  private longTaskObserver: PerformanceObserver | null = null;
  private longTaskHistory: LongTaskEntry[] = [];
  private longTaskListeners: Set<LongTaskListener> = new Set();
  private inputStateListeners: Set<InputStateListener> = new Set();

  // Input prioritization state
  private isUserInteracting = false;
  private lastInteractionTime = 0;
  private interactionTimeoutId: ReturnType<typeof setTimeout> | null = null;

  // Deferred task queue
  private deferredTasks: Map<string, DeferredTask> = new Map();
  private taskIdCounter = 0;
  private isProcessingDeferredTasks = false;
  private deferredTaskTimeoutId: ReturnType<typeof setTimeout> | null = null;

  // Event listener references for cleanup
  private boundHandleInteractionStart: () => void;
  private boundHandleInteractionEnd: () => void;

  private constructor(config: Partial<INPOptimizationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.boundHandleInteractionStart = this.handleInteractionStart.bind(this);
    this.boundHandleInteractionEnd = this.handleInteractionEnd.bind(this);
  }

  static getInstance(
    config?: Partial<INPOptimizationConfig>,
  ): INPOptimizationService {
    if (!INPOptimizationService.instance) {
      INPOptimizationService.instance = new INPOptimizationService(config);
    }
    return INPOptimizationService.instance;
  }

  static resetInstance(): void {
    if (INPOptimizationService.instance) {
      INPOptimizationService.instance.cleanup();
      INPOptimizationService.instance =
        undefined as unknown as INPOptimizationService;
    }
  }

  /**
   * Initialize the INP optimization service
   */
  init(): void {
    if (this.config.enableLongTaskDetection) {
      this.setupLongTaskObserver();
    }

    if (this.config.enableInputPrioritization) {
      this.setupInputListeners();
    }

    logger.log("INP optimization service initialized", this.config);
  }

  /**
   * Set up PerformanceObserver for long task detection
   */
  private setupLongTaskObserver(): void {
    if (!("PerformanceObserver" in window)) {
      logger.warn(
        "PerformanceObserver not supported - long task detection disabled",
      );
      return;
    }

    try {
      // Check if longtask entry type is supported
      const supportedEntryTypes = PerformanceObserver.supportedEntryTypes || [];
      if (!supportedEntryTypes.includes("longtask")) {
        logger.warn("longtask entry type not supported");
        return;
      }

      this.longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.handleLongTask(entry as PerformanceEntry);
        }
      });

      this.longTaskObserver.observe({
        entryTypes: ["longtask"],
        buffered: true,
      });

      logger.log("Long task observer initialized");
    } catch (error) {
      logger.warn("Failed to initialize long task observer:", error);
    }
  }

  /**
   * Handle a detected long task
   */
  private handleLongTask(entry: PerformanceEntry): void {
    // Only track tasks that exceed our threshold
    if (entry.duration < this.config.longTaskThresholdMs) {
      return;
    }

    // Extract attribution data if available
    const attribution: LongTaskAttribution[] = [];
    const taskEntry = entry as PerformanceEntry & {
      attribution?: PerformanceEntryList;
    };

    if (taskEntry.attribution) {
      for (const attr of taskEntry.attribution) {
        const attrWithProps = attr as PerformanceEntry & {
          containerType?: string;
          containerSrc?: string;
          containerId?: string;
          containerName?: string;
        };
        attribution.push({
          name: attr.name,
          entryType: attr.entryType,
          startTime: attr.startTime,
          duration: attr.duration,
          containerType: attrWithProps.containerType,
          containerSrc: attrWithProps.containerSrc,
          containerId: attrWithProps.containerId,
          containerName: attrWithProps.containerName,
        });
      }
    }

    const longTaskEntry: LongTaskEntry = {
      duration: entry.duration,
      startTime: entry.startTime,
      name: entry.name,
      attribution,
      timestamp: Date.now(),
    };

    // Add to history
    this.longTaskHistory.push(longTaskEntry);
    if (this.longTaskHistory.length > this.config.maxLongTaskHistory) {
      this.longTaskHistory = this.longTaskHistory.slice(
        -this.config.maxLongTaskHistory,
      );
    }

    // Notify listeners
    this.longTaskListeners.forEach((listener) => {
      try {
        listener(longTaskEntry);
      } catch (error) {
        logger.error("Error in long task listener:", error);
      }
    });

    // Log for debugging
    logger.log(`Long task detected: ${entry.duration.toFixed(1)}ms`, {
      name: entry.name,
      attribution: attribution.length > 0 ? attribution : undefined,
    });
  }

  /**
   * Set up event listeners for user interactions
   */
  private setupInputListeners(): void {
    // Track interaction start events
    const interactionStartEvents = [
      "pointerdown",
      "touchstart",
      "keydown",
      "mousedown",
    ];

    // Track interaction end events
    const interactionEndEvents = ["pointerup", "touchend", "keyup", "mouseup"];

    interactionStartEvents.forEach((eventType) => {
      document.addEventListener(eventType, this.boundHandleInteractionStart, {
        passive: true,
        capture: true,
      });
    });

    interactionEndEvents.forEach((eventType) => {
      document.addEventListener(eventType, this.boundHandleInteractionEnd, {
        passive: true,
        capture: true,
      });
    });

    logger.log("Input listeners initialized");
  }

  /**
   * Handle interaction start
   */
  private handleInteractionStart(): void {
    const wasInteracting = this.isUserInteracting;
    this.isUserInteracting = true;
    this.lastInteractionTime = performance.now();

    // Clear any pending timeout
    if (this.interactionTimeoutId) {
      clearTimeout(this.interactionTimeoutId);
      this.interactionTimeoutId = null;
    }

    // Notify listeners if state changed
    if (!wasInteracting) {
      this.notifyInputStateListeners(true);
    }
  }

  /**
   * Handle interaction end
   */
  private handleInteractionEnd(): void {
    this.lastInteractionTime = performance.now();

    // Set a timeout to mark interaction as complete
    if (this.interactionTimeoutId) {
      clearTimeout(this.interactionTimeoutId);
    }

    this.interactionTimeoutId = setTimeout(() => {
      this.isUserInteracting = false;
      this.interactionTimeoutId = null;
      this.notifyInputStateListeners(false);

      // Process deferred tasks after interaction completes
      this.processDeferredTasks();
    }, this.config.inputInteractionWindowMs);
  }

  /**
   * Notify input state listeners
   */
  private notifyInputStateListeners(isInteracting: boolean): void {
    this.inputStateListeners.forEach((listener) => {
      try {
        listener(isInteracting);
      } catch (error) {
        logger.error("Error in input state listener:", error);
      }
    });
  }

  /**
   * Subscribe to long task events
   */
  onLongTask(listener: LongTaskListener): () => void {
    this.longTaskListeners.add(listener);
    return () => this.longTaskListeners.delete(listener);
  }

  /**
   * Subscribe to input state changes
   */
  onInputStateChange(listener: InputStateListener): () => void {
    this.inputStateListeners.add(listener);
    return () => this.inputStateListeners.delete(listener);
  }

  /**
   * Check if user is currently interacting
   */
  isInteracting(): boolean {
    return this.isUserInteracting;
  }

  /**
   * Get time since last interaction in milliseconds
   */
  getTimeSinceLastInteraction(): number {
    if (this.lastInteractionTime === 0) {
      return Infinity;
    }
    return performance.now() - this.lastInteractionTime;
  }

  /**
   * Get long task history
   */
  getLongTaskHistory(): LongTaskEntry[] {
    return [...this.longTaskHistory];
  }

  /**
   * Get long task statistics
   */
  getLongTaskStats(): {
    count: number;
    totalDuration: number;
    averageDuration: number;
    maxDuration: number;
    recentCount: number; // Last minute
  } {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    const recentTasks = this.longTaskHistory.filter(
      (t) => t.timestamp > oneMinuteAgo,
    );

    const totalDuration = this.longTaskHistory.reduce(
      (sum, t) => sum + t.duration,
      0,
    );
    const maxDuration =
      this.longTaskHistory.length > 0
        ? Math.max(...this.longTaskHistory.map((t) => t.duration))
        : 0;

    return {
      count: this.longTaskHistory.length,
      totalDuration,
      averageDuration:
        this.longTaskHistory.length > 0
          ? totalDuration / this.longTaskHistory.length
          : 0,
      maxDuration,
      recentCount: recentTasks.length,
    };
  }

  /**
   * Clear long task history
   */
  clearLongTaskHistory(): void {
    this.longTaskHistory = [];
    logger.log("Long task history cleared");
  }

  // ==========================================
  // Input Prioritization / Deferred Task Queue
  // ==========================================

  /**
   * Defer a task to run when the user is not interacting
   *
   * @param execute - Function to execute
   * @param options - Task options
   * @returns Task ID and a promise that resolves when the task completes
   */
  deferTask<T>(
    execute: () => T | Promise<T>,
    options: {
      priority?: TaskPriority;
      onComplete?: (result: T) => void;
      onError?: (error: Error) => void;
      cancellable?: boolean;
      description?: string;
    } = {},
  ): { id: string; promise: Promise<T> } {
    const id = `deferred-task-${++this.taskIdCounter}-${Date.now()}`;

    const taskPromise = new Promise<T>((resolve, reject) => {
      const task: DeferredTask<T> = {
        id,
        execute,
        priority: options.priority ?? TaskPriority.Normal,
        queuedAt: Date.now(),
        onComplete: (result) => {
          options.onComplete?.(result);
          resolve(result);
        },
        onError: (error) => {
          options.onError?.(error);
          reject(error);
        },
        cancellable: options.cancellable ?? true,
        description: options.description,
      };

      this.deferredTasks.set(id, task as DeferredTask);
    });

    // Schedule processing if not currently interacting
    if (!this.isUserInteracting) {
      this.scheduleDeferredTaskProcessing();
    } else {
      // Set a max timeout to ensure tasks eventually run
      this.ensureMaxWaitTimeout();
    }

    logger.log(
      `Task deferred: ${id} (priority: ${TaskPriority[options.priority ?? TaskPriority.Normal]})`,
    );

    return { id, promise: taskPromise };
  }

  /**
   * Cancel a deferred task
   */
  cancelDeferredTask(taskId: string): boolean {
    const task = this.deferredTasks.get(taskId);
    if (!task) {
      return false;
    }

    if (!task.cancellable) {
      logger.warn(`Task ${taskId} is not cancellable`);
      return false;
    }

    this.deferredTasks.delete(taskId);
    logger.log(`Task cancelled: ${taskId}`);
    return true;
  }

  /**
   * Get pending deferred task count
   */
  getPendingTaskCount(): number {
    return this.deferredTasks.size;
  }

  /**
   * Schedule deferred task processing
   */
  private scheduleDeferredTaskProcessing(): void {
    if (this.isProcessingDeferredTasks || this.deferredTasks.size === 0) {
      return;
    }

    // Use requestIdleCallback if available, otherwise setTimeout
    if ("requestIdleCallback" in window) {
      requestIdleCallback(
        () => this.processDeferredTasks(),
        { timeout: 100 }, // Ensure it runs within 100ms
      );
    } else {
      setTimeout(() => this.processDeferredTasks(), 0);
    }
  }

  /**
   * Ensure max wait timeout is set
   */
  private ensureMaxWaitTimeout(): void {
    if (this.deferredTaskTimeoutId) {
      return;
    }

    this.deferredTaskTimeoutId = setTimeout(() => {
      this.deferredTaskTimeoutId = null;
      logger.log("Max deferred wait reached, forcing task processing");
      this.processDeferredTasks();
    }, this.config.maxDeferredWaitMs);
  }

  /**
   * Process deferred tasks
   */
  private async processDeferredTasks(): Promise<void> {
    if (this.isProcessingDeferredTasks || this.deferredTasks.size === 0) {
      return;
    }

    // Don't process during active interactions (unless forced by timeout)
    if (this.isUserInteracting && !this.deferredTaskTimeoutId) {
      return;
    }

    this.isProcessingDeferredTasks = true;

    // Sort tasks by priority
    const sortedTasks = Array.from(this.deferredTasks.values()).sort(
      (a, b) => a.priority - b.priority,
    );

    for (const task of sortedTasks) {
      // Check if user started interacting
      if (this.isUserInteracting && task.priority > TaskPriority.High) {
        // Pause processing for non-critical tasks during interaction
        break;
      }

      this.deferredTasks.delete(task.id);

      try {
        const result = await task.execute();
        task.onComplete?.(result);
      } catch (error) {
        task.onError?.(
          error instanceof Error ? error : new Error(String(error)),
        );
      }

      // Yield to allow other work
      await this.yieldToMain();
    }

    this.isProcessingDeferredTasks = false;

    // If there are remaining tasks, schedule another processing round
    if (this.deferredTasks.size > 0) {
      this.scheduleDeferredTaskProcessing();
    }
  }

  // ==========================================
  // Task Yielding Utilities
  // ==========================================

  /**
   * Yield to the main thread to allow browser to process events
   *
   * Uses scheduler.yield() if available, falls back to setTimeout
   */
  async yieldToMain(): Promise<void> {
    // Use scheduler.yield() if available (Chrome 115+)
    if (
      "scheduler" in window &&
      typeof (
        window as Window & { scheduler?: { yield?: () => Promise<void> } }
      ).scheduler?.yield === "function"
    ) {
      return (
        window as Window & { scheduler: { yield: () => Promise<void> } }
      ).scheduler.yield();
    }

    // Fallback: setTimeout(0) yields to the event loop
    return new Promise((resolve) => setTimeout(resolve, 0));
  }

  /**
   * Execute a long-running operation in chunks, yielding between chunks
   *
   * @param items - Array of items to process
   * @param processor - Function to process each item
   * @param options - Chunking options
   * @returns Promise that resolves when all items are processed
   */
  async processInChunks<T, R>(
    items: T[],
    processor: (item: T, index: number) => R | Promise<R>,
    options: {
      /** Items per chunk before yielding */
      chunkSize?: number;
      /** Time limit per chunk in ms */
      timeLimitMs?: number;
      /** Callback for progress updates */
      onProgress?: (processed: number, total: number) => void;
      /** Whether to abort if user starts interacting */
      yieldOnInteraction?: boolean;
    } = {},
  ): Promise<R[]> {
    const {
      chunkSize = 10,
      timeLimitMs = this.config.defaultYieldIntervalMs,
      onProgress,
      yieldOnInteraction = true,
    } = options;

    const results: R[] = [];
    let chunkStart = performance.now();
    let itemsInChunk = 0;

    for (let i = 0; i < items.length; i++) {
      // Check if we should yield
      const elapsed = performance.now() - chunkStart;
      const shouldYield =
        itemsInChunk >= chunkSize ||
        elapsed >= timeLimitMs ||
        (yieldOnInteraction && this.isUserInteracting);

      if (shouldYield) {
        await this.yieldToMain();
        chunkStart = performance.now();
        itemsInChunk = 0;
      }

      // Process item
      const result = await processor(items[i], i);
      results.push(result);
      itemsInChunk++;

      // Report progress
      onProgress?.(i + 1, items.length);
    }

    return results;
  }

  /**
   * Run a callback only when idle (not during user interactions)
   *
   * @param callback - Function to run
   * @param options - Options
   * @returns Promise that resolves with the callback result
   */
  async runWhenIdle<T>(
    callback: () => T | Promise<T>,
    options: {
      /** Maximum time to wait in ms */
      timeout?: number;
    } = {},
  ): Promise<T> {
    const { timeout = this.config.maxDeferredWaitMs } = options;

    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      const tryRun = async () => {
        // Check timeout
        if (Date.now() - startTime > timeout) {
          // Run anyway after timeout
          try {
            const result = await callback();
            resolve(result);
          } catch (error) {
            reject(error);
          }
          return;
        }

        // Check if idle
        if (this.isUserInteracting) {
          // Check again after interaction window
          setTimeout(tryRun, this.config.inputInteractionWindowMs);
          return;
        }

        // Run callback
        try {
          const result = await callback();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      };

      // Use requestIdleCallback if available
      if ("requestIdleCallback" in window) {
        requestIdleCallback(() => tryRun(), { timeout });
      } else {
        setTimeout(tryRun, 0);
      }
    });
  }

  /**
   * Debounce a function during user interactions
   *
   * Returns a wrapped function that only executes after interactions settle
   */
  debounceOnInteraction<T extends (...args: unknown[]) => unknown>(
    fn: T,
    options: {
      /** Additional delay after interaction ends */
      delayMs?: number;
    } = {},
  ): (...args: Parameters<T>) => void {
    const { delayMs = 50 } = options;
    let pendingArgs: Parameters<T> | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const execute = () => {
      if (pendingArgs !== null) {
        fn(...(pendingArgs as unknown[]));
        pendingArgs = null;
      }
    };

    return (...args: Parameters<T>) => {
      pendingArgs = args;

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      if (this.isUserInteracting) {
        // Schedule for after interaction
        const unsubscribe = this.onInputStateChange((isInteracting) => {
          if (!isInteracting) {
            unsubscribe();
            timeoutId = setTimeout(execute, delayMs);
          }
        });
      } else {
        timeoutId = setTimeout(execute, delayMs);
      }
    };
  }

  // ==========================================
  // Configuration
  // ==========================================

  /**
   * Update configuration
   */
  updateConfig(config: Partial<INPOptimizationConfig>): void {
    this.config = { ...this.config, ...config };
    logger.log("Configuration updated", this.config);
  }

  /**
   * Get current configuration
   */
  getConfig(): INPOptimizationConfig {
    return { ...this.config };
  }

  // ==========================================
  // Cleanup
  // ==========================================

  /**
   * Clean up all resources
   */
  cleanup(): void {
    // Disconnect observer
    if (this.longTaskObserver) {
      this.longTaskObserver.disconnect();
      this.longTaskObserver = null;
    }

    // Remove event listeners
    const interactionStartEvents = [
      "pointerdown",
      "touchstart",
      "keydown",
      "mousedown",
    ];
    const interactionEndEvents = ["pointerup", "touchend", "keyup", "mouseup"];

    interactionStartEvents.forEach((eventType) => {
      document.removeEventListener(
        eventType,
        this.boundHandleInteractionStart,
        true,
      );
    });

    interactionEndEvents.forEach((eventType) => {
      document.removeEventListener(
        eventType,
        this.boundHandleInteractionEnd,
        true,
      );
    });

    // Clear timeouts
    if (this.interactionTimeoutId) {
      clearTimeout(this.interactionTimeoutId);
      this.interactionTimeoutId = null;
    }

    if (this.deferredTaskTimeoutId) {
      clearTimeout(this.deferredTaskTimeoutId);
      this.deferredTaskTimeoutId = null;
    }

    // Clear state
    this.longTaskHistory = [];
    this.longTaskListeners.clear();
    this.inputStateListeners.clear();
    this.deferredTasks.clear();
    this.isUserInteracting = false;
    this.isProcessingDeferredTasks = false;

    logger.log("INP optimization service cleaned up");
  }
}

// Export singleton instance
export const inpOptimizationService = INPOptimizationService.getInstance();

// Export class for testing
export { INPOptimizationService };

// Convenience exports for common operations
export const yieldToMain = () => inpOptimizationService.yieldToMain();
export const processInChunks = <T, R>(
  items: T[],
  processor: (item: T, index: number) => R | Promise<R>,
  options?: Parameters<INPOptimizationService["processInChunks"]>[2],
) => inpOptimizationService.processInChunks(items, processor, options);
export const deferTask = <T>(
  execute: () => T | Promise<T>,
  options?: Parameters<INPOptimizationService["deferTask"]>[1],
) => inpOptimizationService.deferTask(execute, options);
export const runWhenIdle = <T>(
  callback: () => T | Promise<T>,
  options?: Parameters<INPOptimizationService["runWhenIdle"]>[1],
) => inpOptimizationService.runWhenIdle(callback, options);
