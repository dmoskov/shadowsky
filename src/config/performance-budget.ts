/**
 * Performance Budget Configuration
 *
 * Defines acceptable thresholds for Core Web Vitals metrics.
 * Values are based on Google's recommendations for good user experience.
 *
 * @see https://web.dev/vitals/
 */

import { PerformanceBudget } from "../services/web-vitals-monitor";

/**
 * Default performance budget for production use
 *
 * Metric targets:
 * - LCP (Largest Contentful Paint): < 2.5s for good UX
 * - FCP (First Contentful Paint): < 1.8s for good UX
 * - CLS (Cumulative Layout Shift): < 0.1 for good UX
 * - TTFB (Time to First Byte): < 800ms for good UX
 * - INP (Interaction to Next Paint): < 200ms for good UX
 */
export const PRODUCTION_BUDGET: PerformanceBudget = {
  lcp: 2500, // 2.5 seconds
  fcp: 1800, // 1.8 seconds
  cls: 0.1, // Layout shift score
  ttfb: 800, // 800 milliseconds
  inp: 200, // 200 milliseconds
};

/**
 * Strict budget for development to catch issues early
 */
export const STRICT_BUDGET: PerformanceBudget = {
  lcp: 2000, // 2 seconds
  fcp: 1500, // 1.5 seconds
  cls: 0.05, // Very low layout shift
  ttfb: 500, // 500 milliseconds
  inp: 150, // 150 milliseconds
};

/**
 * Relaxed budget for slow networks / devices
 */
export const RELAXED_BUDGET: PerformanceBudget = {
  lcp: 4000, // 4 seconds
  fcp: 3000, // 3 seconds
  cls: 0.25, // Needs improvement threshold
  ttfb: 1800, // 1.8 seconds
  inp: 500, // 500 milliseconds
};

/**
 * Budget presets for different environments
 */
export type BudgetPreset = "strict" | "production" | "relaxed" | "custom";

export function getBudgetForPreset(preset: BudgetPreset): PerformanceBudget {
  switch (preset) {
    case "strict":
      return STRICT_BUDGET;
    case "production":
      return PRODUCTION_BUDGET;
    case "relaxed":
      return RELAXED_BUDGET;
    case "custom":
      return PRODUCTION_BUDGET; // Default to production when custom
  }
}

/**
 * Metric display names and descriptions
 */
export const METRIC_INFO = {
  lcp: {
    name: "Largest Contentful Paint",
    shortName: "LCP",
    description:
      "Measures loading performance. The time it takes for the largest content element to become visible.",
    unit: "ms",
    goodThreshold: 2500,
    poorThreshold: 4000,
  },
  fcp: {
    name: "First Contentful Paint",
    shortName: "FCP",
    description:
      "Measures perceived load speed. The time it takes for the first piece of content to appear.",
    unit: "ms",
    goodThreshold: 1800,
    poorThreshold: 3000,
  },
  cls: {
    name: "Cumulative Layout Shift",
    shortName: "CLS",
    description:
      "Measures visual stability. The total of all unexpected layout shifts during the page lifecycle.",
    unit: "",
    goodThreshold: 0.1,
    poorThreshold: 0.25,
  },
  ttfb: {
    name: "Time to First Byte",
    shortName: "TTFB",
    description:
      "Measures server responsiveness. The time it takes for the browser to receive the first byte of response.",
    unit: "ms",
    goodThreshold: 800,
    poorThreshold: 1800,
  },
  inp: {
    name: "Interaction to Next Paint",
    shortName: "INP",
    description:
      "Measures interactivity. The latency of all user interactions throughout the page lifecycle.",
    unit: "ms",
    goodThreshold: 200,
    poorThreshold: 500,
  },
} as const;

/**
 * Format metric value for display
 */
export function formatMetricValue(
  metric: keyof typeof METRIC_INFO,
  value: number,
): string {
  const info = METRIC_INFO[metric];
  if (metric === "cls") {
    return value.toFixed(3);
  }
  return `${Math.round(value)}${info.unit}`;
}

/**
 * Get color class based on metric rating
 */
export function getRatingColor(
  rating: "good" | "needs-improvement" | "poor",
): string {
  switch (rating) {
    case "good":
      return "text-green-600 dark:text-green-400";
    case "needs-improvement":
      return "text-yellow-600 dark:text-yellow-400";
    case "poor":
      return "text-red-600 dark:text-red-400";
  }
}

/**
 * Get background color class based on metric rating
 */
export function getRatingBgColor(
  rating: "good" | "needs-improvement" | "poor",
): string {
  switch (rating) {
    case "good":
      return "bg-green-100 dark:bg-green-900/30";
    case "needs-improvement":
      return "bg-yellow-100 dark:bg-yellow-900/30";
    case "poor":
      return "bg-red-100 dark:bg-red-900/30";
  }
}
