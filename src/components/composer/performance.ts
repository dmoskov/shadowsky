/**
 * Performance benchmarking utilities for the Composer component
 *
 * Used to measure and compare performance before/after refactoring.
 * Enable in dev mode via console: window.enableComposerBenchmarks()
 */

import { createLogger } from "../../utils/logger";

const logger = createLogger("ComposerPerformance");

export interface PerformanceMark {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
}

export interface ComponentMetrics {
  componentName: string;
  renderCount: number;
  totalRenderTime: number;
  averageRenderTime: number;
  maxRenderTime: number;
  minRenderTime: number;
  lastRenderTime: number;
}

// Global state for benchmarks
let benchmarksEnabled = false;
const performanceMarks: Map<string, PerformanceMark> = new Map();
const componentMetrics: Map<string, ComponentMetrics> = new Map();

/**
 * Enable composer benchmarks in development mode
 */
export function enableComposerBenchmarks(): void {
  benchmarksEnabled = true;
  logger.log("Composer benchmarks enabled");

  // Expose globally for console access
  if (typeof window !== "undefined") {
    (window as any).composerBenchmarks = {
      getMetrics: getComponentMetrics,
      getRenderCounts: getRenderCounts,
      getAverageRenderTimes: getAverageRenderTimes,
      reset: resetBenchmarks,
      report: generateReport,
    };
  }
}

/**
 * Disable composer benchmarks
 */
export function disableComposerBenchmarks(): void {
  benchmarksEnabled = false;
  logger.log("Composer benchmarks disabled");
}

/**
 * Check if benchmarks are enabled
 */
export function areBenchmarksEnabled(): boolean {
  return benchmarksEnabled;
}

/**
 * Mark the start of a performance measurement
 */
export function startMark(name: string): void {
  if (!benchmarksEnabled) return;

  performanceMarks.set(name, {
    name,
    startTime: performance.now(),
  });
}

/**
 * Mark the end of a performance measurement
 */
export function endMark(name: string): number | undefined {
  if (!benchmarksEnabled) return undefined;

  const mark = performanceMarks.get(name);
  if (!mark) {
    logger.warn(`No start mark found for: ${name}`);
    return undefined;
  }

  const endTime = performance.now();
  const duration = endTime - mark.startTime;

  mark.endTime = endTime;
  mark.duration = duration;

  return duration;
}

/**
 * Track component render time
 */
export function trackRender(componentName: string, renderTime: number): void {
  if (!benchmarksEnabled) return;

  const existing = componentMetrics.get(componentName);

  if (existing) {
    existing.renderCount++;
    existing.totalRenderTime += renderTime;
    existing.averageRenderTime =
      existing.totalRenderTime / existing.renderCount;
    existing.maxRenderTime = Math.max(existing.maxRenderTime, renderTime);
    existing.minRenderTime = Math.min(existing.minRenderTime, renderTime);
    existing.lastRenderTime = renderTime;
  } else {
    componentMetrics.set(componentName, {
      componentName,
      renderCount: 1,
      totalRenderTime: renderTime,
      averageRenderTime: renderTime,
      maxRenderTime: renderTime,
      minRenderTime: renderTime,
      lastRenderTime: renderTime,
    });
  }
}

/**
 * Higher-order component to measure render time
 */
export function measureRenderTime<T>(
  componentName: string,
  renderFn: () => T,
): T {
  if (!benchmarksEnabled) {
    return renderFn();
  }

  const startTime = performance.now();
  const result = renderFn();
  const renderTime = performance.now() - startTime;

  trackRender(componentName, renderTime);

  return result;
}

/**
 * React hook to measure component render time
 */
export function useRenderTimer(componentName: string): void {
  if (!benchmarksEnabled) return;

  const renderStart = performance.now();

  // Use a microtask to measure after render completes
  queueMicrotask(() => {
    const renderTime = performance.now() - renderStart;
    trackRender(componentName, renderTime);
  });
}

/**
 * Get metrics for a specific component
 */
export function getComponentMetrics(
  componentName: string,
): ComponentMetrics | undefined {
  return componentMetrics.get(componentName);
}

/**
 * Get all component metrics
 */
export function getAllComponentMetrics(): ComponentMetrics[] {
  return Array.from(componentMetrics.values());
}

/**
 * Get render counts for all components
 */
export function getRenderCounts(): Record<string, number> {
  const counts: Record<string, number> = {};
  componentMetrics.forEach((metrics, name) => {
    counts[name] = metrics.renderCount;
  });
  return counts;
}

/**
 * Get average render times for all components
 */
export function getAverageRenderTimes(): Record<string, number> {
  const times: Record<string, number> = {};
  componentMetrics.forEach((metrics, name) => {
    times[name] = Math.round(metrics.averageRenderTime * 100) / 100;
  });
  return times;
}

/**
 * Reset all benchmarks
 */
export function resetBenchmarks(): void {
  performanceMarks.clear();
  componentMetrics.clear();
  logger.log("Composer benchmarks reset");
}

/**
 * Generate a performance report
 */
export function generateReport(): string {
  if (componentMetrics.size === 0) {
    return "No performance data collected. Enable benchmarks and interact with the composer.";
  }

  const lines: string[] = [
    "=== Composer Performance Report ===",
    "",
    "Component Metrics:",
    "-".repeat(60),
  ];

  const sortedMetrics = Array.from(componentMetrics.values()).sort(
    (a, b) => b.totalRenderTime - a.totalRenderTime,
  );

  for (const metrics of sortedMetrics) {
    lines.push(`\n${metrics.componentName}:`);
    lines.push(`  Render count: ${metrics.renderCount}`);
    lines.push(`  Total time: ${metrics.totalRenderTime.toFixed(2)}ms`);
    lines.push(`  Average: ${metrics.averageRenderTime.toFixed(2)}ms`);
    lines.push(`  Min: ${metrics.minRenderTime.toFixed(2)}ms`);
    lines.push(`  Max: ${metrics.maxRenderTime.toFixed(2)}ms`);
  }

  lines.push("");
  lines.push("-".repeat(60));
  lines.push("");

  // Summary
  const totalRenders = sortedMetrics.reduce((sum, m) => sum + m.renderCount, 0);
  const totalTime = sortedMetrics.reduce(
    (sum, m) => sum + m.totalRenderTime,
    0,
  );

  lines.push("Summary:");
  lines.push(`  Total components tracked: ${sortedMetrics.length}`);
  lines.push(`  Total renders: ${totalRenders}`);
  lines.push(`  Total render time: ${totalTime.toFixed(2)}ms`);
  lines.push(
    `  Average render time: ${(totalTime / totalRenders).toFixed(2)}ms`,
  );

  const report = lines.join("\n");
  logger.log(report);
  return report;
}

/**
 * Measure text splitting performance
 */
export function benchmarkTextSplitting(
  splitFn: (text: string, format: string) => string[],
  options: { iterations?: number; textLength?: number } = {},
): { averageTime: number; results: number[] } {
  const iterations = options.iterations ?? 100;
  const textLength = options.textLength ?? 1000;
  const testText = "word ".repeat(textLength);

  const results: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    splitFn(testText, "simple");
    results.push(performance.now() - start);
  }

  const averageTime = results.reduce((a, b) => a + b, 0) / results.length;

  return {
    averageTime,
    results,
  };
}

/**
 * Measure numbering application performance
 */
export function benchmarkNumberingApplication(
  applyFn: (
    posts: string[],
    order: number[] | undefined,
    format: string,
    position: string,
  ) => string[],
  options: { iterations?: number; postCount?: number } = {},
): { averageTime: number; results: number[] } {
  const iterations = options.iterations ?? 100;
  const postCount = options.postCount ?? 50;
  const testPosts = Array(postCount).fill("Test post content for benchmarking");

  const results: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    applyFn(testPosts, undefined, "simple", "end");
    results.push(performance.now() - start);
  }

  const averageTime = results.reduce((a, b) => a + b, 0) / results.length;

  return {
    averageTime,
    results,
  };
}

// Expose enable function globally in development
if (typeof window !== "undefined" && import.meta.env.DEV) {
  (window as any).enableComposerBenchmarks = enableComposerBenchmarks;
  (window as any).disableComposerBenchmarks = disableComposerBenchmarks;
}
