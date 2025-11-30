import { debug } from "@bsky/shared";

/**
 * Performance monitoring utilities for IndexedDB queries.
 * Helps track query performance and identify potential bottlenecks.
 */

export interface QueryMetrics {
  queryName: string;
  startTime: number;
  endTime: number;
  duration: number;
  recordCount: number;
  indexUsed: string | null;
  isCompoundIndex: boolean;
}

interface PerformanceStats {
  totalQueries: number;
  totalDuration: number;
  averageDuration: number;
  slowestQuery: QueryMetrics | null;
  fastestQuery: QueryMetrics | null;
  queriesByIndex: Record<string, { count: number; totalDuration: number }>;
  compoundIndexUsage: number;
  singleIndexUsage: number;
  fullScanUsage: number;
}

// Store for collecting metrics during debug sessions
let metricsStore: QueryMetrics[] = [];
let isMonitoringEnabled = false;

/**
 * Enable query performance monitoring.
 * Call this to start collecting metrics for debugging.
 */
export function enableQueryMonitoring(): void {
  isMonitoringEnabled = true;
  metricsStore = [];
  debug.log("IndexedDB query monitoring enabled");
}

/**
 * Disable query performance monitoring.
 */
export function disableQueryMonitoring(): void {
  isMonitoringEnabled = false;
  debug.log("IndexedDB query monitoring disabled");
}

/**
 * Check if monitoring is enabled.
 */
export function isMonitoring(): boolean {
  return isMonitoringEnabled;
}

/**
 * Record a query metric.
 * @param metrics The metrics to record
 */
export function recordQueryMetrics(metrics: QueryMetrics): void {
  if (!isMonitoringEnabled) return;

  metricsStore.push(metrics);

  // Log slow queries (> 100ms)
  if (metrics.duration > 100) {
    debug.log(
      `[SLOW QUERY] ${metrics.queryName}: ${metrics.duration.toFixed(2)}ms, ` +
        `${metrics.recordCount} records, index: ${metrics.indexUsed || "none (full scan)"}`,
    );
  }
}

/**
 * Create a query timer for measuring query performance.
 * @param queryName A descriptive name for the query
 * @returns An object with methods to track the query
 */
export function createQueryTimer(queryName: string): {
  end: (
    recordCount: number,
    indexUsed?: string | null,
    isCompoundIndex?: boolean,
  ) => QueryMetrics;
} {
  const startTime = performance.now();

  return {
    end: (
      recordCount: number,
      indexUsed: string | null = null,
      isCompoundIndex = false,
    ): QueryMetrics => {
      const endTime = performance.now();
      const metrics: QueryMetrics = {
        queryName,
        startTime,
        endTime,
        duration: endTime - startTime,
        recordCount,
        indexUsed,
        isCompoundIndex,
      };

      recordQueryMetrics(metrics);
      return metrics;
    },
  };
}

/**
 * Get aggregated performance statistics.
 * @returns Stats about all recorded queries
 */
export function getPerformanceStats(): PerformanceStats {
  const stats: PerformanceStats = {
    totalQueries: metricsStore.length,
    totalDuration: 0,
    averageDuration: 0,
    slowestQuery: null,
    fastestQuery: null,
    queriesByIndex: {},
    compoundIndexUsage: 0,
    singleIndexUsage: 0,
    fullScanUsage: 0,
  };

  if (metricsStore.length === 0) {
    return stats;
  }

  for (const metric of metricsStore) {
    stats.totalDuration += metric.duration;

    // Track slowest/fastest
    if (!stats.slowestQuery || metric.duration > stats.slowestQuery.duration) {
      stats.slowestQuery = metric;
    }
    if (!stats.fastestQuery || metric.duration < stats.fastestQuery.duration) {
      stats.fastestQuery = metric;
    }

    // Track index usage
    const indexKey = metric.indexUsed || "full_scan";
    if (!stats.queriesByIndex[indexKey]) {
      stats.queriesByIndex[indexKey] = { count: 0, totalDuration: 0 };
    }
    stats.queriesByIndex[indexKey].count++;
    stats.queriesByIndex[indexKey].totalDuration += metric.duration;

    // Track index type usage
    if (metric.isCompoundIndex) {
      stats.compoundIndexUsage++;
    } else if (metric.indexUsed) {
      stats.singleIndexUsage++;
    } else {
      stats.fullScanUsage++;
    }
  }

  stats.averageDuration = stats.totalDuration / metricsStore.length;

  return stats;
}

/**
 * Clear all collected metrics.
 */
export function clearMetrics(): void {
  metricsStore = [];
}

/**
 * Get all collected metrics.
 * @returns Array of all recorded query metrics
 */
export function getAllMetrics(): QueryMetrics[] {
  return [...metricsStore];
}

/**
 * Log a summary of performance stats to the console.
 */
export function logPerformanceSummary(): void {
  const stats = getPerformanceStats();

  debug.log("=== IndexedDB Performance Summary ===");
  debug.log(`Total queries: ${stats.totalQueries}`);
  debug.log(`Total duration: ${stats.totalDuration.toFixed(2)}ms`);
  debug.log(`Average duration: ${stats.averageDuration.toFixed(2)}ms`);

  if (stats.slowestQuery) {
    debug.log(
      `Slowest query: ${stats.slowestQuery.queryName} (${stats.slowestQuery.duration.toFixed(2)}ms)`,
    );
  }
  if (stats.fastestQuery) {
    debug.log(
      `Fastest query: ${stats.fastestQuery.queryName} (${stats.fastestQuery.duration.toFixed(2)}ms)`,
    );
  }

  debug.log("\nIndex usage:");
  debug.log(`  Compound indexes: ${stats.compoundIndexUsage}`);
  debug.log(`  Single indexes: ${stats.singleIndexUsage}`);
  debug.log(`  Full scans: ${stats.fullScanUsage}`);

  debug.log("\nBy index:");
  for (const [index, data] of Object.entries(stats.queriesByIndex)) {
    const avgDuration = data.totalDuration / data.count;
    debug.log(
      `  ${index}: ${data.count} queries, avg ${avgDuration.toFixed(2)}ms`,
    );
  }
}

/**
 * Estimate the performance improvement from using compound indexes.
 * This compares O(n) full scan time with O(log n) indexed time.
 * @param recordCount Total number of records in the store
 * @param resultCount Number of records returned
 * @returns Estimated speedup factor
 */
export function estimateIndexSpeedup(
  recordCount: number,
  resultCount: number,
): {
  fullScanComplexity: string;
  indexedComplexity: string;
  estimatedSpeedup: number;
} {
  // O(n) for full scan - must examine all records
  const fullScanOps = recordCount;

  // O(log n + k) for indexed query where k is result count
  const indexedOps = Math.log2(Math.max(1, recordCount)) + resultCount;

  const speedup = recordCount > 0 ? fullScanOps / indexedOps : 1;

  return {
    fullScanComplexity: `O(${recordCount})`,
    indexedComplexity: `O(log ${recordCount} + ${resultCount})`,
    estimatedSpeedup: Math.round(speedup * 100) / 100,
  };
}

// Expose to window for debugging in development
if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).indexedDbPerf = {
    enable: enableQueryMonitoring,
    disable: disableQueryMonitoring,
    stats: getPerformanceStats,
    metrics: getAllMetrics,
    clear: clearMetrics,
    summary: logPerformanceSummary,
    estimateSpeedup: estimateIndexSpeedup,
  };
}
