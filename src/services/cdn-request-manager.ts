/**
 * CDN Request Manager - Centralized rate limiting for cdn.bsky.app requests
 *
 * Prevents 429 errors by:
 * 1. Limiting concurrent requests
 * 2. Implementing exponential backoff on 429 responses
 * 3. Deduplicating identical requests
 * 4. Priority queuing (visible images first)
 */

import { createLogger } from "../utils/logger";
import {
  getNetworkInfo,
  subscribeToNetworkChanges,
  type NetworkInfoSnapshot,
  type PrefetchStrategy,
} from "../utils/network-info";

const logger = createLogger("CDNRequestManager");

type RequestPriority = "high" | "normal" | "low";

interface QueuedRequest {
  url: string;
  priority: RequestPriority;
  resolve: (url: string) => void;
  reject: (error: Error) => void;
  aborted: boolean;
  timestamp: number;
}

interface RequestState {
  /** URLs currently being fetched */
  inFlight: Set<string>;
  /** URLs that have been successfully loaded */
  loaded: Set<string>;
  /** URLs that failed to load */
  failed: Set<string>;
  /** Pending requests in priority queue */
  queue: QueuedRequest[];
  /** Current backoff multiplier (increases on 429) */
  backoffMultiplier: number;
  /** Timestamp of last 429 response */
  lastRateLimitHit: number;
  /** Whether we're currently in backoff mode */
  inBackoff: boolean;
}

const state: RequestState = {
  inFlight: new Set(),
  loaded: new Set(),
  failed: new Set(),
  queue: [],
  backoffMultiplier: 1,
  lastRateLimitHit: 0,
  inBackoff: false,
};

// Configuration
const CONFIG = {
  /** Base delay between requests in ms */
  baseDelayMs: 25,
  /** Minimum delay during backoff */
  minBackoffDelayMs: 100,
  /** Maximum delay during backoff */
  maxBackoffDelayMs: 5000,
  /** Backoff multiplier increase on 429 */
  backoffIncrease: 2,
  /** Backoff recovery rate (multiplier decrease per second of success) */
  backoffRecoveryRate: 0.1,
  /** Time after last 429 before starting recovery (ms) */
  recoveryDelayMs: 2000,
  /** Max items to keep in loaded/failed caches */
  maxCacheSize: 1000,
  /** How often to clean up old cache entries (ms) */
  cacheCleanupInterval: 60000,
};

// Network-aware settings
let currentStrategy: PrefetchStrategy = getNetworkInfo().prefetchStrategy;

// Flag to track if we've initialized the network subscription
let networkSubscriptionInitialized = false;

/**
 * Get the maximum concurrent requests based on network and backoff state
 */
function getMaxConcurrent(): number {
  const networkMax = currentStrategy.maxConcurrentLoads;
  // Reduce during backoff
  if (state.inBackoff) {
    return Math.max(1, Math.floor(networkMax / state.backoffMultiplier));
  }
  return networkMax;
}

/**
 * Get the delay between requests
 */
function getRequestDelay(): number {
  const networkDelay = currentStrategy.batchDelayMs || CONFIG.baseDelayMs;
  if (state.inBackoff) {
    const backoffDelay = Math.min(
      CONFIG.maxBackoffDelayMs,
      CONFIG.minBackoffDelayMs * state.backoffMultiplier,
    );
    return Math.max(networkDelay, backoffDelay);
  }
  return networkDelay;
}

/**
 * Handle a 429 response - increase backoff
 */
function handleRateLimit(): void {
  state.inBackoff = true;
  state.lastRateLimitHit = Date.now();
  state.backoffMultiplier = Math.min(
    16, // Max 16x backoff
    state.backoffMultiplier * CONFIG.backoffIncrease,
  );
  logger.log(
    `Rate limit hit, backoff multiplier: ${state.backoffMultiplier}, max concurrent: ${getMaxConcurrent()}`,
  );
}

/**
 * Handle successful request - potentially recover from backoff
 */
function handleSuccess(): void {
  if (!state.inBackoff) return;

  const timeSinceRateLimit = Date.now() - state.lastRateLimitHit;
  if (timeSinceRateLimit > CONFIG.recoveryDelayMs) {
    // Slowly recover
    state.backoffMultiplier = Math.max(
      1,
      state.backoffMultiplier - CONFIG.backoffRecoveryRate,
    );
    if (state.backoffMultiplier <= 1) {
      state.inBackoff = false;
      state.backoffMultiplier = 1;
      logger.log("Recovered from backoff");
    }
  }
}

let isProcessing = false;

/**
 * Process the request queue
 */
async function processQueue(): Promise<void> {
  if (isProcessing) return;
  if (!currentStrategy.enabled) return;
  if (state.queue.length === 0) return;

  isProcessing = true;

  try {
    while (state.queue.length > 0 && state.inFlight.size < getMaxConcurrent()) {
      // Sort by priority and timestamp (high priority first, then oldest)
      state.queue.sort((a, b) => {
        const priorityOrder = { high: 0, normal: 1, low: 2 };
        const priorityDiff =
          priorityOrder[a.priority] - priorityOrder[b.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return a.timestamp - b.timestamp;
      });

      const request = state.queue.shift();
      if (!request || request.aborted) continue;

      // Skip if already loaded or in flight
      if (state.loaded.has(request.url)) {
        request.resolve(request.url);
        continue;
      }
      if (state.inFlight.has(request.url)) {
        // Skip duplicate in-flight URL; the original request's
        // load/error handler will process the queue again
        continue;
      }

      state.inFlight.add(request.url);
      loadImage(request);

      // Add delay between requests
      const delay = getRequestDelay();
      if (delay > 0 && state.queue.length > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  } finally {
    isProcessing = false;
  }
}

/**
 * Load a single image
 */
function loadImage(request: QueuedRequest): void {
  const img = new Image();

  img.onload = () => {
    state.inFlight.delete(request.url);
    state.loaded.add(request.url);
    handleSuccess();
    request.resolve(request.url);
    img.onload = null;
    img.onerror = null;
    // Continue processing queue
    processQueue();
    // Cleanup cache if needed
    cleanupCache();
  };

  img.onerror = () => {
    state.inFlight.delete(request.url);

    // Check if this might be a 429 (we can't directly access status from Image)
    // We'll use fetch to check for 429s on failure
    fetch(request.url, { method: "HEAD", mode: "no-cors" }).catch(() => {
      // If HEAD fails, likely rate limited
      handleRateLimit();
    });

    state.failed.add(request.url);
    request.reject(new Error(`Failed to load image: ${request.url}`));
    img.onload = null;
    img.onerror = null;
    processQueue();
  };

  img.src = request.url;
}

/**
 * Clean up old cache entries to prevent memory bloat
 */
function cleanupCache(): void {
  if (state.loaded.size > CONFIG.maxCacheSize) {
    const entriesToRemove = state.loaded.size - CONFIG.maxCacheSize;
    const iterator = state.loaded.values();
    for (let i = 0; i < entriesToRemove; i++) {
      const value = iterator.next().value;
      if (value) state.loaded.delete(value);
    }
  }
  if (state.failed.size > CONFIG.maxCacheSize) {
    state.failed.clear(); // Failed entries can be retried
  }
}

/**
 * Request an image load through the managed queue
 *
 * @param url - The image URL to load
 * @param priority - Request priority (high for visible, low for prefetch)
 * @returns Promise that resolves when the image is loaded
 */
export function requestImage(
  url: string,
  priority: RequestPriority = "normal",
): { promise: Promise<string>; abort: () => void } {
  // Return immediately if already loaded
  if (state.loaded.has(url)) {
    return {
      promise: Promise.resolve(url),
      abort: () => {},
    };
  }

  // Check if there's already a pending request for this URL
  const existingRequest = state.queue.find((r) => r.url === url && !r.aborted);
  if (existingRequest) {
    // Upgrade priority if needed
    if (
      priority === "high" ||
      (priority === "normal" && existingRequest.priority === "low")
    ) {
      existingRequest.priority = priority;
    }
    return {
      promise: new Promise((resolve, reject) => {
        // Add a second resolver for this URL
        state.queue.push({
          url,
          priority,
          resolve,
          reject,
          aborted: false,
          timestamp: Date.now(),
        });
      }),
      abort: () => {
        existingRequest.aborted = true;
      },
    };
  }

  let request: QueuedRequest;
  const promise = new Promise<string>((resolve, reject) => {
    request = {
      url,
      priority,
      resolve,
      reject,
      aborted: false,
      timestamp: Date.now(),
    };
    state.queue.push(request);
  });

  // Start processing if not already
  processQueue();

  return {
    promise,
    abort: () => {
      if (request) {
        request.aborted = true;
      }
    },
  };
}

/**
 * Check if a URL is a Bluesky CDN URL
 */
export function isBskyCdnUrl(url: string): boolean {
  return url?.includes("cdn.bsky.app") || false;
}

/**
 * Get current queue statistics (for debugging)
 */
export function getQueueStats(): {
  inFlight: number;
  queued: number;
  loaded: number;
  failed: number;
  backoffMultiplier: number;
  inBackoff: boolean;
  maxConcurrent: number;
} {
  return {
    inFlight: state.inFlight.size,
    queued: state.queue.filter((r) => !r.aborted).length,
    loaded: state.loaded.size,
    failed: state.failed.size,
    backoffMultiplier: state.backoffMultiplier,
    inBackoff: state.inBackoff,
    maxConcurrent: getMaxConcurrent(),
  };
}

/**
 * Clear all caches and reset state (for testing)
 */
export function resetCdnManager(): void {
  state.inFlight.clear();
  state.loaded.clear();
  state.failed.clear();
  state.queue = [];
  state.backoffMultiplier = 1;
  state.lastRateLimitHit = 0;
  state.inBackoff = false;
}

// Expose for debugging
if (typeof window !== "undefined") {
  (window as any).__cdnRequestManager = {
    getStats: getQueueStats,
    reset: resetCdnManager,
  };
}

// Subscribe to network changes (deferred to avoid initialization order issues)
if (typeof window !== "undefined" && !networkSubscriptionInitialized) {
  networkSubscriptionInitialized = true;
  // Use setTimeout to ensure all module initialization is complete
  setTimeout(() => {
    subscribeToNetworkChanges((info: NetworkInfoSnapshot) => {
      currentStrategy = info.prefetchStrategy;
      // Process queue when network improves
      processQueue();
    });
  }, 0);
}
