/**
 * Input Debouncing Service
 *
 * An intelligent debouncing service that handles rapid user interactions
 * to complement the INP (Interaction to Next Paint) optimization pipeline.
 *
 * This service provides:
 * - Configurable debounce delays for different interaction types
 * - Adaptive debouncing based on device capabilities
 * - Integration with Web Vitals monitoring for INP optimization
 * - Priority-based execution for critical interactions
 *
 * @module services/input-debouncing-service
 */

import { createLogger } from "../utils/logger";
import { webVitalsMonitor } from "./web-vitals-monitor";

const logger = createLogger("InputDebouncingService");

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Supported interaction types with their default configurations
 */
export type InteractionType =
  | "typing"
  | "clicking"
  | "scrolling"
  | "resizing"
  | "searching"
  | "navigation"
  | "media"
  | "form"
  | "custom";

/**
 * Priority levels for interaction handling
 */
export type InteractionPriority = "critical" | "high" | "normal" | "low";

/**
 * Configuration for a specific interaction type
 */
export interface InteractionConfig {
  /** Debounce delay in milliseconds */
  debounceDelay: number;
  /** Throttle interval in milliseconds (optional, for throttled interactions) */
  throttleInterval?: number;
  /** Whether to use leading edge execution */
  leading?: boolean;
  /** Whether to use trailing edge execution (default: true) */
  trailing?: boolean;
  /** Maximum wait time before forced execution */
  maxWait?: number;
  /** Priority level for this interaction type */
  priority?: InteractionPriority;
  /** Whether to use requestAnimationFrame for visual updates */
  useRAF?: boolean;
  /** Whether to use requestIdleCallback when available */
  useIdleCallback?: boolean;
}

/**
 * Configuration for the entire debouncing service
 */
export interface DebouncingServiceConfig {
  /** Enable adaptive delays based on device performance */
  adaptiveDelays: boolean;
  /** Base multiplier for delays on low-end devices */
  lowEndDeviceMultiplier: number;
  /** INP budget target in milliseconds */
  inpBudget: number;
  /** Enable performance tracking integration */
  enableTracking: boolean;
  /** Custom interaction configurations */
  interactions: Partial<Record<InteractionType, Partial<InteractionConfig>>>;
}

/**
 * Debounced function result with control methods
 */
export interface DebouncedFunction<T extends (...args: unknown[]) => unknown> {
  /** The debounced function */
  (...args: Parameters<T>): void;
  /** Cancel any pending invocation */
  cancel: () => void;
  /** Flush and execute immediately */
  flush: () => void;
  /** Check if there's a pending invocation */
  pending: () => boolean;
}

/**
 * Throttled function result with control methods
 */
export interface ThrottledFunction<T extends (...args: unknown[]) => unknown> {
  /** The throttled function */
  (...args: Parameters<T>): void;
  /** Cancel any pending invocation */
  cancel: () => void;
}

/**
 * Performance metrics for debounced interactions
 */
export interface InteractionMetrics {
  type: InteractionType;
  totalCalls: number;
  executedCalls: number;
  cancelledCalls: number;
  averageDelay: number;
  maxDelay: number;
  lastExecutionTime: number;
}

// ============================================================================
// Default Configurations
// ============================================================================

/**
 * Default configurations for each interaction type
 * These values are optimized for good INP scores (< 200ms)
 */
const DEFAULT_INTERACTION_CONFIGS: Record<InteractionType, InteractionConfig> =
  {
    typing: {
      debounceDelay: 150,
      trailing: true,
      maxWait: 1000,
      priority: "normal",
      useIdleCallback: false, // Typing needs responsive feedback
    },
    clicking: {
      debounceDelay: 0, // No debounce for clicks - immediate response
      leading: true,
      trailing: false,
      priority: "critical",
      useRAF: true,
    },
    scrolling: {
      debounceDelay: 16, // ~60fps
      throttleInterval: 16,
      trailing: true,
      priority: "high",
      useRAF: true,
    },
    resizing: {
      debounceDelay: 150,
      trailing: true,
      maxWait: 500,
      priority: "normal",
      useRAF: true,
    },
    searching: {
      debounceDelay: 300,
      trailing: true,
      maxWait: 2000,
      priority: "normal",
      useIdleCallback: true,
    },
    navigation: {
      debounceDelay: 50,
      leading: true,
      trailing: false,
      priority: "high",
    },
    media: {
      debounceDelay: 100,
      throttleInterval: 100,
      trailing: true,
      priority: "normal",
      useRAF: true,
    },
    form: {
      debounceDelay: 200,
      trailing: true,
      maxWait: 1500,
      priority: "normal",
    },
    custom: {
      debounceDelay: 150,
      trailing: true,
      priority: "normal",
    },
  };

/**
 * Default service configuration
 */
const DEFAULT_SERVICE_CONFIG: DebouncingServiceConfig = {
  adaptiveDelays: true,
  lowEndDeviceMultiplier: 1.5,
  inpBudget: 200, // 200ms INP target
  enableTracking: true,
  interactions: {},
};

// ============================================================================
// Input Debouncing Service
// ============================================================================

class InputDebouncingService {
  private static instance: InputDebouncingService;
  private config: DebouncingServiceConfig;
  private interactionConfigs: Map<InteractionType, InteractionConfig>;
  private metrics: Map<InteractionType, InteractionMetrics>;
  private isLowEndDevice: boolean = false;
  private devicePerformanceMultiplier: number = 1;
  private activeTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private pendingCallbacks: Map<string, () => void> = new Map();

  private constructor() {
    this.config = { ...DEFAULT_SERVICE_CONFIG };
    this.interactionConfigs = new Map();
    this.metrics = new Map();
    this.initializeConfigs();
    this.detectDeviceCapabilities();
  }

  static getInstance(): InputDebouncingService {
    if (!InputDebouncingService.instance) {
      InputDebouncingService.instance = new InputDebouncingService();
    }
    return InputDebouncingService.instance;
  }

  /**
   * Initialize the service with custom configuration
   */
  configure(config: Partial<DebouncingServiceConfig>): void {
    this.config = { ...this.config, ...config };

    // Merge custom interaction configs
    if (config.interactions) {
      Object.entries(config.interactions).forEach(([type, customConfig]) => {
        if (customConfig) {
          const existing =
            this.interactionConfigs.get(type as InteractionType) ||
            DEFAULT_INTERACTION_CONFIGS[type as InteractionType];
          this.interactionConfigs.set(type as InteractionType, {
            ...existing,
            ...customConfig,
          });
        }
      });
    }

    logger.log("Service configured:", this.config);
  }

  /**
   * Initialize default interaction configurations
   */
  private initializeConfigs(): void {
    Object.entries(DEFAULT_INTERACTION_CONFIGS).forEach(([type, config]) => {
      this.interactionConfigs.set(type as InteractionType, { ...config });
      this.metrics.set(type as InteractionType, this.createEmptyMetrics(type));
    });
  }

  /**
   * Detect device capabilities and adjust performance multiplier
   */
  private detectDeviceCapabilities(): void {
    // Check for device memory (Chrome only)
    const nav = navigator as Navigator & { deviceMemory?: number };
    if (nav.deviceMemory && nav.deviceMemory < 4) {
      this.isLowEndDevice = true;
      this.devicePerformanceMultiplier = this.config.lowEndDeviceMultiplier;
    }

    // Check for hardware concurrency
    if (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4) {
      this.isLowEndDevice = true;
      this.devicePerformanceMultiplier = Math.max(
        this.devicePerformanceMultiplier,
        1.3,
      );
    }

    // Subscribe to Web Vitals for ongoing performance monitoring
    if (this.config.enableTracking) {
      webVitalsMonitor.subscribe((metric, value) => {
        if (metric === "inp" && value > this.config.inpBudget) {
          // If INP is consistently high, increase debounce delays
          this.adjustForPoorINP(value);
        }
      });
    }

    logger.log("Device capabilities detected:", {
      isLowEndDevice: this.isLowEndDevice,
      multiplier: this.devicePerformanceMultiplier,
    });
  }

  /**
   * Adjust debounce delays when INP is poor
   */
  private adjustForPoorINP(inpValue: number): void {
    if (!this.config.adaptiveDelays) return;

    // Calculate how much we need to adjust
    const ratio = inpValue / this.config.inpBudget;
    const adjustment = Math.min(ratio, 2); // Cap at 2x

    // Only adjust non-critical interactions
    this.interactionConfigs.forEach((config, type) => {
      if (config.priority !== "critical" && config.priority !== "high") {
        const baseConfig = DEFAULT_INTERACTION_CONFIGS[type];
        config.debounceDelay = Math.round(
          baseConfig.debounceDelay * adjustment,
        );
      }
    });

    logger.log("Adjusted debounce delays for poor INP:", {
      inpValue,
      adjustment,
    });
  }

  /**
   * Get the effective delay for an interaction type
   */
  getEffectiveDelay(type: InteractionType): number {
    const config = this.interactionConfigs.get(type);
    if (!config) return DEFAULT_INTERACTION_CONFIGS.custom.debounceDelay;

    let delay = config.debounceDelay;

    // Apply device performance multiplier for adaptive delays
    if (this.config.adaptiveDelays && this.isLowEndDevice) {
      delay = Math.round(delay * this.devicePerformanceMultiplier);
    }

    return delay;
  }

  /**
   * Get configuration for an interaction type
   */
  getConfig(type: InteractionType): InteractionConfig {
    return (
      this.interactionConfigs.get(type) || DEFAULT_INTERACTION_CONFIGS.custom
    );
  }

  /**
   * Create a debounced function for a specific interaction type
   */
  debounce<T extends (...args: unknown[]) => unknown>(
    fn: T,
    type: InteractionType = "custom",
    customDelay?: number,
  ): DebouncedFunction<T> {
    const config = this.getConfig(type);
    const delay = customDelay ?? this.getEffectiveDelay(type);
    const functionId = `${type}_${Math.random().toString(36).substr(2, 9)}`;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let maxTimeoutId: ReturnType<typeof setTimeout> | null = null;
    let lastArgs: Parameters<T> | null = null;
    let isPending = false;

    const metrics = this.metrics.get(type);

    const execute = () => {
      if (lastArgs) {
        const startTime = performance.now();

        // Use requestAnimationFrame for visual updates
        if (config.useRAF) {
          requestAnimationFrame(() => {
            fn(...lastArgs!);
            this.trackExecution(type, startTime);
          });
        }
        // Use requestIdleCallback for low-priority tasks
        else if (config.useIdleCallback && "requestIdleCallback" in window) {
          (
            window as Window &
              typeof globalThis & {
                requestIdleCallback: (cb: () => void) => void;
              }
          ).requestIdleCallback(() => {
            fn(...lastArgs!);
            this.trackExecution(type, startTime);
          });
        } else {
          fn(...lastArgs);
          this.trackExecution(type, startTime);
        }

        lastArgs = null;
        isPending = false;

        if (metrics) {
          metrics.executedCalls++;
          metrics.lastExecutionTime = Date.now();
        }
      }
    };

    const debouncedFn = ((...args: Parameters<T>) => {
      lastArgs = args;
      isPending = true;

      if (metrics) {
        metrics.totalCalls++;
      }

      // Clear existing timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
        this.activeTimers.delete(functionId);
      }

      // Leading edge execution
      if (config.leading && !timeoutId) {
        execute();
      }

      // Trailing edge execution
      if (config.trailing !== false) {
        timeoutId = setTimeout(() => {
          execute();
          timeoutId = null;
          this.activeTimers.delete(functionId);
        }, delay);
        this.activeTimers.set(functionId, timeoutId);
      }

      // Max wait handling
      if (config.maxWait && !maxTimeoutId) {
        maxTimeoutId = setTimeout(() => {
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
          execute();
          maxTimeoutId = null;
        }, config.maxWait);
      }
    }) as DebouncedFunction<T>;

    debouncedFn.cancel = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
        this.activeTimers.delete(functionId);
      }
      if (maxTimeoutId) {
        clearTimeout(maxTimeoutId);
        maxTimeoutId = null;
      }
      lastArgs = null;
      isPending = false;

      if (metrics) {
        metrics.cancelledCalls++;
      }
    };

    debouncedFn.flush = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
        this.activeTimers.delete(functionId);
      }
      if (maxTimeoutId) {
        clearTimeout(maxTimeoutId);
        maxTimeoutId = null;
      }
      execute();
    };

    debouncedFn.pending = () => isPending;

    return debouncedFn;
  }

  /**
   * Create a throttled function for a specific interaction type
   */
  throttle<T extends (...args: unknown[]) => unknown>(
    fn: T,
    type: InteractionType = "scrolling",
    customInterval?: number,
  ): ThrottledFunction<T> {
    const config = this.getConfig(type);
    const interval =
      customInterval ?? config.throttleInterval ?? this.getEffectiveDelay(type);
    const functionId = `throttle_${type}_${Math.random().toString(36).substr(2, 9)}`;

    let lastCallTime = 0;
    let pendingTimeoutId: ReturnType<typeof setTimeout> | null = null;
    let lastArgs: Parameters<T> | null = null;

    const metrics = this.metrics.get(type);

    const throttledFn = ((...args: Parameters<T>) => {
      const now = Date.now();
      lastArgs = args;

      if (metrics) {
        metrics.totalCalls++;
      }

      if (now - lastCallTime >= interval) {
        lastCallTime = now;
        const startTime = performance.now();

        if (config.useRAF) {
          requestAnimationFrame(() => {
            fn(...args);
            this.trackExecution(type, startTime);
          });
        } else {
          fn(...args);
          this.trackExecution(type, startTime);
        }

        if (metrics) {
          metrics.executedCalls++;
          metrics.lastExecutionTime = now;
        }
        return;
      }

      // Schedule trailing call
      if (pendingTimeoutId) {
        clearTimeout(pendingTimeoutId);
      }

      pendingTimeoutId = setTimeout(
        () => {
          lastCallTime = Date.now();
          if (lastArgs) {
            const startTime = performance.now();
            fn(...lastArgs);
            this.trackExecution(type, startTime);
          }
          pendingTimeoutId = null;

          if (metrics) {
            metrics.executedCalls++;
            metrics.lastExecutionTime = Date.now();
          }
        },
        interval - (now - lastCallTime),
      );

      this.activeTimers.set(functionId, pendingTimeoutId);
    }) as ThrottledFunction<T>;

    throttledFn.cancel = () => {
      if (pendingTimeoutId) {
        clearTimeout(pendingTimeoutId);
        pendingTimeoutId = null;
        this.activeTimers.delete(functionId);
      }

      if (metrics) {
        metrics.cancelledCalls++;
      }
    };

    return throttledFn;
  }

  /**
   * Track execution for performance metrics
   */
  private trackExecution(type: InteractionType, startTime: number): void {
    if (!this.config.enableTracking) return;

    const executionTime = performance.now() - startTime;
    const metrics = this.metrics.get(type);

    if (metrics) {
      // Update average delay
      const totalExecutions = metrics.executedCalls;
      metrics.averageDelay =
        (metrics.averageDelay * (totalExecutions - 1) + executionTime) /
        totalExecutions;
      metrics.maxDelay = Math.max(metrics.maxDelay, executionTime);
    }

    // Track if execution time exceeds INP budget
    if (executionTime > this.config.inpBudget) {
      logger.warn(`Interaction ${type} exceeded INP budget:`, {
        executionTime,
        budget: this.config.inpBudget,
      });
    }
  }

  /**
   * Create empty metrics object
   */
  private createEmptyMetrics(type: string): InteractionMetrics {
    return {
      type: type as InteractionType,
      totalCalls: 0,
      executedCalls: 0,
      cancelledCalls: 0,
      averageDelay: 0,
      maxDelay: 0,
      lastExecutionTime: 0,
    };
  }

  /**
   * Get metrics for a specific interaction type
   */
  getMetrics(type: InteractionType): InteractionMetrics | undefined {
    return this.metrics.get(type);
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): Map<InteractionType, InteractionMetrics> {
    return new Map(this.metrics);
  }

  /**
   * Reset metrics for a specific type or all types
   */
  resetMetrics(type?: InteractionType): void {
    if (type) {
      this.metrics.set(type, this.createEmptyMetrics(type));
    } else {
      this.interactionConfigs.forEach((_, t) => {
        this.metrics.set(t, this.createEmptyMetrics(t));
      });
    }
    logger.log("Metrics reset:", type || "all");
  }

  /**
   * Cancel all pending debounced/throttled functions
   */
  cancelAll(): void {
    this.activeTimers.forEach((timerId) => {
      clearTimeout(timerId);
    });
    this.activeTimers.clear();
    this.pendingCallbacks.clear();
    logger.log("All pending interactions cancelled");
  }

  /**
   * Check if device is low-end
   */
  isDeviceLowEnd(): boolean {
    return this.isLowEndDevice;
  }

  /**
   * Get current performance multiplier
   */
  getPerformanceMultiplier(): number {
    return this.devicePerformanceMultiplier;
  }

  /**
   * Generate a report of interaction performance
   */
  generateReport(): {
    deviceInfo: {
      isLowEnd: boolean;
      multiplier: number;
    };
    metrics: Record<InteractionType, InteractionMetrics>;
    recommendations: string[];
  } {
    const metricsObj: Record<InteractionType, InteractionMetrics> =
      {} as Record<InteractionType, InteractionMetrics>;
    this.metrics.forEach((m, type) => {
      metricsObj[type] = m;
    });

    const recommendations: string[] = [];

    // Analyze metrics and provide recommendations
    this.metrics.forEach((m, type) => {
      if (m.totalCalls > 0) {
        const executionRate = m.executedCalls / m.totalCalls;
        if (executionRate < 0.1) {
          recommendations.push(
            `${type}: Very high cancellation rate (${((1 - executionRate) * 100).toFixed(1)}%). Consider reducing debounce delay.`,
          );
        }
        if (m.maxDelay > this.config.inpBudget) {
          recommendations.push(
            `${type}: Max execution time (${m.maxDelay.toFixed(0)}ms) exceeds INP budget. Consider optimizing the handler.`,
          );
        }
      }
    });

    return {
      deviceInfo: {
        isLowEnd: this.isLowEndDevice,
        multiplier: this.devicePerformanceMultiplier,
      },
      metrics: metricsObj,
      recommendations,
    };
  }
}

// ============================================================================
// Exports
// ============================================================================

// Export singleton instance
export const inputDebouncingService = InputDebouncingService.getInstance();

// Export convenience functions bound to singleton
export const debounceInteraction = inputDebouncingService.debounce.bind(
  inputDebouncingService,
);
export const throttleInteraction = inputDebouncingService.throttle.bind(
  inputDebouncingService,
);
export const getInteractionConfig = inputDebouncingService.getConfig.bind(
  inputDebouncingService,
);
export const getEffectiveDelay = inputDebouncingService.getEffectiveDelay.bind(
  inputDebouncingService,
);

// Export default interaction delays for reference
export const INTERACTION_DELAYS: Record<InteractionType, number> = {
  typing: 150,
  clicking: 0,
  scrolling: 16,
  resizing: 150,
  searching: 300,
  navigation: 50,
  media: 100,
  form: 200,
  custom: 150,
};
