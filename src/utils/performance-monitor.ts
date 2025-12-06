import {
  inpOptimizationService,
  type LongTaskEntry,
} from "../services/inp-optimization-service";
import {
  WebVitalsMetrics,
  webVitalsMonitor,
} from "../services/web-vitals-monitor";
import { createLogger } from "./logger";

const logger = createLogger("PerformanceMonitor");

export interface LongTaskStats {
  count: number;
  totalDuration: number;
  averageDuration: number;
  maxDuration: number;
  recentCount: number;
}

export interface PerformanceMetrics {
  fps: number;
  memory?: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
  longTasks: number;
  longTaskStats?: LongTaskStats;
  isUserInteracting?: boolean;
  webVitals?: WebVitalsMetrics;
}

/**
 * Performance monitoring utility for mobile optimization
 */
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private frameCount = 0;
  private lastTime = performance.now();
  private fps = 60;
  private longTaskCount = 0;
  private rafId?: number;
  private isMonitoring = false;
  private inpServiceInitialized = false;
  private longTaskUnsubscribe?: () => void;

  private constructor() {
    this.setupINPOptimization();
  }

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  /**
   * Start monitoring performance metrics
   */
  start(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.measureFPS();

    // Initialize Web Vitals monitoring
    webVitalsMonitor.init();

    // Initialize INP optimization service
    this.setupINPOptimization();

    logger.log(
      "Performance monitoring started (including Web Vitals and INP optimization)",
    );
  }

  /**
   * Stop monitoring performance metrics
   */
  stop(): void {
    this.isMonitoring = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
    }
    logger.log("Performance monitoring stopped");
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    const metrics: PerformanceMetrics = {
      fps: Math.round(this.fps),
      longTasks: this.longTaskCount,
    };

    // Add memory info if available (Chrome only)
    if ("memory" in performance && (performance as any).memory) {
      const memory = (performance as any).memory;
      metrics.memory = {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit,
      };
    }

    // Add Web Vitals metrics if monitoring is active
    if (webVitalsMonitor.isMonitoringActive()) {
      metrics.webVitals = webVitalsMonitor.getMetrics();
    }

    // Add detailed long task stats from INP optimization service
    if (this.inpServiceInitialized) {
      metrics.longTaskStats = inpOptimizationService.getLongTaskStats();
      metrics.isUserInteracting = inpOptimizationService.isInteracting();
    }

    return metrics;
  }

  /**
   * Check if device is likely low-end based on performance
   */
  isLowEndDevice(): boolean {
    const metrics = this.getMetrics();

    // Consider device low-end if:
    // - FPS consistently below 30
    // - Memory usage above 80%
    // - Multiple long tasks detected
    const isLowFPS = metrics.fps < 30;
    const isHighMemory =
      metrics.memory &&
      metrics.memory.usedJSHeapSize / metrics.memory.jsHeapSizeLimit > 0.8;
    const hasManyLongTasks = metrics.longTasks > 5;

    return isLowFPS || isHighMemory || hasManyLongTasks;
  }

  /**
   * Log performance warning if metrics are poor
   */
  checkPerformance(): void {
    if (this.isLowEndDevice()) {
      logger.warn("Poor performance detected", this.getMetrics());

      // Emit custom event for app to handle
      window.dispatchEvent(
        new CustomEvent("lowperformance", {
          detail: this.getMetrics(),
        }),
      );
    }
  }

  private measureFPS(): void {
    if (!this.isMonitoring) return;

    const currentTime = performance.now();
    const delta = currentTime - this.lastTime;

    this.frameCount++;

    // Calculate FPS every second
    if (delta >= 1000) {
      this.fps = (this.frameCount * 1000) / delta;
      this.frameCount = 0;
      this.lastTime = currentTime;

      // Check performance periodically
      this.checkPerformance();
    }

    this.rafId = requestAnimationFrame(() => this.measureFPS());
  }

  /**
   * Set up INP optimization service for long task detection
   */
  private setupINPOptimization(): void {
    if (this.inpServiceInitialized) return;

    try {
      // Initialize the INP optimization service
      inpOptimizationService.init();
      this.inpServiceInitialized = true;

      // Subscribe to long task events to keep our count in sync
      this.longTaskUnsubscribe = inpOptimizationService.onLongTask(
        (entry: LongTaskEntry) => {
          this.longTaskCount++;
          logger.log("Long task detected via INP service:", {
            duration: entry.duration,
            name: entry.name,
            attribution: entry.attribution,
          });
        },
      );

      logger.log(
        "INP optimization service initialized for long task detection",
      );
    } catch (error) {
      logger.warn("Failed to initialize INP optimization service:", error);
    }
  }

  /**
   * Get the INP optimization service for advanced usage
   */
  getINPService() {
    return inpOptimizationService;
  }

  /**
   * Clean up resources when stopping monitoring
   */
  cleanup(): void {
    this.stop();
    if (this.longTaskUnsubscribe) {
      this.longTaskUnsubscribe();
      this.longTaskUnsubscribe = undefined;
    }
    this.inpServiceInitialized = false;
    logger.log("Performance monitor cleaned up");
  }
}

/**
 * Hook to use performance monitoring in React components
 */
export function usePerformanceMonitor() {
  const monitor = PerformanceMonitor.getInstance();

  return {
    start: () => monitor.start(),
    stop: () => monitor.stop(),
    getMetrics: () => monitor.getMetrics(),
    isLowEndDevice: () => monitor.isLowEndDevice(),
    cleanup: () => monitor.cleanup(),
    getINPService: () => monitor.getINPService(),
  };
}

// Re-export types from INP optimization service for convenience
export {
  deferTask,
  processInChunks,
  runWhenIdle,
  TaskPriority,
  yieldToMain,
} from "../services/inp-optimization-service";
export type { LongTaskEntry } from "../services/inp-optimization-service";
