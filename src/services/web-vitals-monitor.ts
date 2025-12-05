/**
 * Web Vitals Performance Monitoring Service
 *
 * Tracks Core Web Vitals metrics (LCP, FID, CLS, TTFB, INP) and provides
 * regression detection based on configurable performance budgets.
 */

import {
  CLSMetric,
  FCPMetric,
  INPMetric,
  LCPMetric,
  TTFBMetric,
  onCLS,
  onFCP,
  onINP,
  onLCP,
  onTTFB,
} from "web-vitals";
import { createLogger } from "../utils/logger";

const logger = createLogger("WebVitalsMonitor");

export interface WebVitalsMetrics {
  lcp: number | null; // Largest Contentful Paint (ms)
  fid: number | null; // First Input Delay (ms) - deprecated but still tracked
  cls: number | null; // Cumulative Layout Shift (score)
  fcp: number | null; // First Contentful Paint (ms)
  ttfb: number | null; // Time to First Byte (ms)
  inp: number | null; // Interaction to Next Paint (ms)
  timestamp: number;
}

export interface PerformanceBudget {
  lcp: number; // Target: < 2500ms (good), < 4000ms (needs improvement)
  fcp: number; // Target: < 1800ms (good), < 3000ms (needs improvement)
  cls: number; // Target: < 0.1 (good), < 0.25 (needs improvement)
  ttfb: number; // Target: < 800ms (good), < 1800ms (needs improvement)
  inp: number; // Target: < 200ms (good), < 500ms (needs improvement)
}

export interface VitalRating {
  value: number;
  rating: "good" | "needs-improvement" | "poor";
  budget: number;
  exceedsBudget: boolean;
}

export interface WebVitalsReport {
  metrics: WebVitalsMetrics;
  ratings: {
    lcp: VitalRating | null;
    fcp: VitalRating | null;
    cls: VitalRating | null;
    ttfb: VitalRating | null;
    inp: VitalRating | null;
  };
  overallScore: number; // 0-100
  hasRegressions: boolean;
  regressionDetails: string[];
}

// Default performance budgets based on Google's Core Web Vitals thresholds
export const DEFAULT_PERFORMANCE_BUDGET: PerformanceBudget = {
  lcp: 2500, // ms - should be < 2.5s
  fcp: 1800, // ms - should be < 1.8s
  cls: 0.1, // score - should be < 0.1
  ttfb: 800, // ms - should be < 800ms
  inp: 200, // ms - should be < 200ms
};

// Thresholds for determining ratings
const THRESHOLDS = {
  lcp: { good: 2500, needsImprovement: 4000 },
  fcp: { good: 1800, needsImprovement: 3000 },
  cls: { good: 0.1, needsImprovement: 0.25 },
  ttfb: { good: 800, needsImprovement: 1800 },
  inp: { good: 200, needsImprovement: 500 },
};

const STORAGE_KEY = "shadowsky_web_vitals_history";
const MAX_HISTORY_SIZE = 100;

export type MetricUpdateCallback = (
  metric: keyof WebVitalsMetrics,
  value: number,
) => void;

class WebVitalsMonitor {
  private static instance: WebVitalsMonitor;
  private metrics: WebVitalsMetrics;
  private budget: PerformanceBudget;
  private history: WebVitalsMetrics[] = [];
  private isInitialized = false;
  private callbacks: Set<MetricUpdateCallback> = new Set();

  private constructor() {
    this.metrics = this.createEmptyMetrics();
    this.budget = { ...DEFAULT_PERFORMANCE_BUDGET };
    this.loadHistory();
  }

  static getInstance(): WebVitalsMonitor {
    if (!WebVitalsMonitor.instance) {
      WebVitalsMonitor.instance = new WebVitalsMonitor();
    }
    return WebVitalsMonitor.instance;
  }

  private createEmptyMetrics(): WebVitalsMetrics {
    return {
      lcp: null,
      fid: null,
      cls: null,
      fcp: null,
      ttfb: null,
      inp: null,
      timestamp: Date.now(),
    };
  }

  private loadHistory(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.history = JSON.parse(stored);
        // Trim to max size
        if (this.history.length > MAX_HISTORY_SIZE) {
          this.history = this.history.slice(-MAX_HISTORY_SIZE);
          this.saveHistory();
        }
      }
    } catch (error) {
      logger.warn("Failed to load Web Vitals history:", error);
      this.history = [];
    }
  }

  private saveHistory(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.history));
    } catch (error) {
      logger.warn("Failed to save Web Vitals history:", error);
    }
  }

  private notifyCallbacks(metric: keyof WebVitalsMetrics, value: number): void {
    this.callbacks.forEach((callback) => {
      try {
        callback(metric, value);
      } catch (error) {
        logger.error("Error in metric callback:", error);
      }
    });
  }

  /**
   * Initialize Web Vitals monitoring
   */
  init(): void {
    if (this.isInitialized) {
      logger.log("Web Vitals monitoring already initialized");
      return;
    }

    this.isInitialized = true;
    logger.log("Initializing Web Vitals monitoring");

    // Track LCP - Largest Contentful Paint
    onLCP((metric: LCPMetric) => {
      this.metrics.lcp = metric.value;
      this.notifyCallbacks("lcp", metric.value);
      logger.log(`LCP: ${metric.value.toFixed(0)}ms (${metric.rating})`);
    });

    // Track FCP - First Contentful Paint
    onFCP((metric: FCPMetric) => {
      this.metrics.fcp = metric.value;
      this.notifyCallbacks("fcp", metric.value);
      logger.log(`FCP: ${metric.value.toFixed(0)}ms (${metric.rating})`);
    });

    // Track CLS - Cumulative Layout Shift
    onCLS((metric: CLSMetric) => {
      this.metrics.cls = metric.value;
      this.notifyCallbacks("cls", metric.value);
      logger.log(`CLS: ${metric.value.toFixed(3)} (${metric.rating})`);
    });

    // Track TTFB - Time to First Byte
    onTTFB((metric: TTFBMetric) => {
      this.metrics.ttfb = metric.value;
      this.notifyCallbacks("ttfb", metric.value);
      logger.log(`TTFB: ${metric.value.toFixed(0)}ms (${metric.rating})`);
    });

    // Track INP - Interaction to Next Paint (replaces FID)
    onINP((metric: INPMetric) => {
      this.metrics.inp = metric.value;
      this.notifyCallbacks("inp", metric.value);
      logger.log(`INP: ${metric.value.toFixed(0)}ms (${metric.rating})`);
    });

    // Save metrics to history when page is about to unload
    window.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        this.saveCurrentMetrics();
      }
    });
  }

  /**
   * Subscribe to metric updates
   */
  subscribe(callback: MetricUpdateCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  /**
   * Get current metrics
   */
  getMetrics(): WebVitalsMetrics {
    return { ...this.metrics };
  }

  /**
   * Get performance budget
   */
  getBudget(): PerformanceBudget {
    return { ...this.budget };
  }

  /**
   * Update performance budget
   */
  setBudget(budget: Partial<PerformanceBudget>): void {
    this.budget = { ...this.budget, ...budget };
    logger.log("Performance budget updated:", this.budget);
  }

  /**
   * Get rating for a specific metric
   */
  getRating(
    metric: "lcp" | "fcp" | "cls" | "ttfb" | "inp",
    value: number,
  ): VitalRating {
    const thresholds = THRESHOLDS[metric];
    const budget = this.budget[metric];

    let rating: "good" | "needs-improvement" | "poor";
    if (value <= thresholds.good) {
      rating = "good";
    } else if (value <= thresholds.needsImprovement) {
      rating = "needs-improvement";
    } else {
      rating = "poor";
    }

    return {
      value,
      rating,
      budget,
      exceedsBudget: value > budget,
    };
  }

  /**
   * Generate a comprehensive report
   */
  generateReport(): WebVitalsReport {
    const metrics = this.getMetrics();
    const regressionDetails: string[] = [];

    const ratings = {
      lcp: metrics.lcp !== null ? this.getRating("lcp", metrics.lcp) : null,
      fcp: metrics.fcp !== null ? this.getRating("fcp", metrics.fcp) : null,
      cls: metrics.cls !== null ? this.getRating("cls", metrics.cls) : null,
      ttfb: metrics.ttfb !== null ? this.getRating("ttfb", metrics.ttfb) : null,
      inp: metrics.inp !== null ? this.getRating("inp", metrics.inp) : null,
    };

    // Check for regressions against budget
    if (ratings.lcp?.exceedsBudget) {
      regressionDetails.push(
        `LCP (${ratings.lcp.value.toFixed(0)}ms) exceeds budget (${ratings.lcp.budget}ms)`,
      );
    }
    if (ratings.fcp?.exceedsBudget) {
      regressionDetails.push(
        `FCP (${ratings.fcp.value.toFixed(0)}ms) exceeds budget (${ratings.fcp.budget}ms)`,
      );
    }
    if (ratings.cls?.exceedsBudget) {
      regressionDetails.push(
        `CLS (${ratings.cls.value.toFixed(3)}) exceeds budget (${ratings.cls.budget})`,
      );
    }
    if (ratings.ttfb?.exceedsBudget) {
      regressionDetails.push(
        `TTFB (${ratings.ttfb.value.toFixed(0)}ms) exceeds budget (${ratings.ttfb.budget}ms)`,
      );
    }
    if (ratings.inp?.exceedsBudget) {
      regressionDetails.push(
        `INP (${ratings.inp.value.toFixed(0)}ms) exceeds budget (${ratings.inp.budget}ms)`,
      );
    }

    // Calculate overall score (0-100)
    const overallScore = this.calculateOverallScore(ratings);

    return {
      metrics,
      ratings,
      overallScore,
      hasRegressions: regressionDetails.length > 0,
      regressionDetails,
    };
  }

  private calculateOverallScore(ratings: WebVitalsReport["ratings"]): number {
    const scores: number[] = [];

    // Weight each metric differently based on user impact
    const weights = {
      lcp: 0.25, // Loading experience
      fcp: 0.15, // Initial paint
      cls: 0.25, // Visual stability
      ttfb: 0.1, // Server responsiveness
      inp: 0.25, // Interactivity
    };

    if (ratings.lcp) {
      scores.push(this.metricToScore(ratings.lcp.rating) * weights.lcp);
    }
    if (ratings.fcp) {
      scores.push(this.metricToScore(ratings.fcp.rating) * weights.fcp);
    }
    if (ratings.cls) {
      scores.push(this.metricToScore(ratings.cls.rating) * weights.cls);
    }
    if (ratings.ttfb) {
      scores.push(this.metricToScore(ratings.ttfb.rating) * weights.ttfb);
    }
    if (ratings.inp) {
      scores.push(this.metricToScore(ratings.inp.rating) * weights.inp);
    }

    if (scores.length === 0) return 0;

    // Normalize by actual weights used
    const totalWeight = scores.reduce((sum, _, i) => {
      const metricKeys = ["lcp", "fcp", "cls", "ttfb", "inp"] as const;
      return sum + weights[metricKeys[i]];
    }, 0);

    return Math.round(
      (scores.reduce((sum, score) => sum + score, 0) / totalWeight) * 100,
    );
  }

  private metricToScore(rating: "good" | "needs-improvement" | "poor"): number {
    switch (rating) {
      case "good":
        return 1;
      case "needs-improvement":
        return 0.5;
      case "poor":
        return 0;
    }
  }

  /**
   * Save current metrics to history
   */
  saveCurrentMetrics(): void {
    // Only save if we have at least one metric
    const hasMetrics = Object.entries(this.metrics).some(
      ([key, value]) => key !== "timestamp" && value !== null,
    );

    if (!hasMetrics) return;

    this.metrics.timestamp = Date.now();
    this.history.push({ ...this.metrics });

    // Trim to max size
    if (this.history.length > MAX_HISTORY_SIZE) {
      this.history = this.history.slice(-MAX_HISTORY_SIZE);
    }

    this.saveHistory();
    logger.log("Saved Web Vitals metrics to history");

    // Reset metrics for next page view
    this.metrics = this.createEmptyMetrics();
  }

  /**
   * Get historical metrics
   */
  getHistory(): WebVitalsMetrics[] {
    return [...this.history];
  }

  /**
   * Get trend analysis comparing recent metrics to historical average
   */
  getTrendAnalysis(): {
    metric: string;
    current: number;
    average: number;
    trend: "improving" | "stable" | "degrading";
    percentChange: number;
  }[] {
    if (this.history.length < 5) {
      return [];
    }

    const recent = this.history.slice(-5);
    const older = this.history.slice(0, -5);

    const metrics: (keyof Omit<WebVitalsMetrics, "timestamp">)[] = [
      "lcp",
      "fcp",
      "cls",
      "ttfb",
      "inp",
    ];
    const trends: ReturnType<typeof this.getTrendAnalysis> = [];

    for (const metric of metrics) {
      const recentValues = recent
        .map((m) => m[metric])
        .filter((v): v is number => v !== null);
      const olderValues = older
        .map((m) => m[metric])
        .filter((v): v is number => v !== null);

      if (recentValues.length === 0 || olderValues.length === 0) continue;

      const recentAvg =
        recentValues.reduce((a, b) => a + b, 0) / recentValues.length;
      const olderAvg =
        olderValues.reduce((a, b) => a + b, 0) / olderValues.length;

      const percentChange = ((recentAvg - olderAvg) / olderAvg) * 100;

      let trend: "improving" | "stable" | "degrading";
      // For CLS, lower is better; for others, lower is also better
      if (Math.abs(percentChange) < 5) {
        trend = "stable";
      } else if (percentChange < 0) {
        trend = "improving";
      } else {
        trend = "degrading";
      }

      trends.push({
        metric: metric.toUpperCase(),
        current: recentAvg,
        average: olderAvg,
        trend,
        percentChange,
      });
    }

    return trends;
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.history = [];
    localStorage.removeItem(STORAGE_KEY);
    logger.log("Web Vitals history cleared");
  }

  /**
   * Check if monitoring is initialized
   */
  isMonitoringActive(): boolean {
    return this.isInitialized;
  }
}

// Export singleton instance methods
export const webVitalsMonitor = WebVitalsMonitor.getInstance();

/**
 * React hook for accessing Web Vitals metrics
 */
export function useWebVitals() {
  const monitor = WebVitalsMonitor.getInstance();

  return {
    init: () => monitor.init(),
    getMetrics: () => monitor.getMetrics(),
    getBudget: () => monitor.getBudget(),
    setBudget: (budget: Partial<PerformanceBudget>) =>
      monitor.setBudget(budget),
    generateReport: () => monitor.generateReport(),
    getHistory: () => monitor.getHistory(),
    getTrendAnalysis: () => monitor.getTrendAnalysis(),
    clearHistory: () => monitor.clearHistory(),
    subscribe: (callback: MetricUpdateCallback) => monitor.subscribe(callback),
    isActive: () => monitor.isMonitoringActive(),
  };
}
