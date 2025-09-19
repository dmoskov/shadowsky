import { createLogger } from "./logger";

const logger = createLogger("PerformanceMonitor");

interface PerformanceMetrics {
  fps: number;
  memory?: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
  longTasks: number;
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
  private observer?: PerformanceObserver;
  private rafId?: number;
  private isMonitoring = false;

  private constructor() {
    this.setupLongTaskObserver();
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
    logger.log("Performance monitoring started");
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

  private setupLongTaskObserver(): void {
    if (!("PerformanceObserver" in window)) return;

    try {
      this.observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          // Count tasks longer than 50ms
          if (entry.duration > 50) {
            this.longTaskCount++;
            logger.log("Long task detected:", {
              duration: entry.duration,
              name: entry.name,
            });
          }
        }
      });

      // Observe long tasks
      this.observer.observe({ entryTypes: ["longtask"] });
    } catch (_e) {
      logger.log("Long task observer not supported");
    }
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
  };
}
