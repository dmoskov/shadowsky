/**
 * Lightweight perf instrumentation for ad-hoc investigation.
 *
 * Gated behind debug mode (window.enableDebug() or ?debug=true) so it adds
 * effectively zero overhead in normal use. When enabled it wraps work in the
 * User Timing API, so a measured block shows up as a named bar in the DevTools
 * Performance panel and via performance.getEntriesByType("measure"), and warns
 * in the console when a block exceeds one frame's budget (~50ms) — which is
 * what makes "the app feels janky" actionable ("notifications:aggregate took
 * 180ms").
 */

import { isDebugEnabled } from "../shared/debug";
import { createLogger } from "./logger";

const logger = createLogger("Perf");

// One dropped frame at 60fps. Blocks longer than this are worth a look.
const SLOW_THRESHOLD_MS = 50;

function hasUserTiming(): boolean {
  return (
    typeof performance !== "undefined" &&
    typeof performance.measure === "function"
  );
}

/**
 * Measure a synchronous block. Returns the wrapped function's result so it can
 * be dropped in around an existing call:
 *   const events = measureSync("notifications:aggregate", () => aggregate(...));
 */
export function measureSync<T>(name: string, fn: () => T): T {
  if (!isDebugEnabled() || !hasUserTiming()) return fn();

  const start = performance.now();
  try {
    return fn();
  } finally {
    const duration = performance.now() - start;
    try {
      // Modern User Timing: record the block without leaving stray marks.
      performance.measure(name, { start, duration });
    } catch {
      // Older engines without the options form — the warning below still works.
    }
    if (duration >= SLOW_THRESHOLD_MS) {
      logger.warn(`slow: ${name} took ${duration.toFixed(1)}ms`);
    }
  }
}
