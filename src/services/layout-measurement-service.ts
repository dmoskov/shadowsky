/**
 * Layout Measurement Batching Service
 *
 * Optimizes DOM layout measurements by batching getBoundingClientRect() calls
 * into single requestAnimationFrame callbacks. This prevents layout thrashing
 * by:
 *
 * 1. Queuing measurement requests instead of forcing synchronous layouts
 * 2. Reading all queued elements in a single RAF frame
 * 3. Providing cached values for elements measured in the same frame
 * 4. Supporting callbacks for async notification of measurement results
 *
 * @module services/layout-measurement-service
 */

import { createLogger } from "../utils/logger";

const logger = createLogger("LayoutMeasurement");

// ============================================================================
// Types
// ============================================================================

/**
 * Measurement result containing DOMRect-like properties
 */
export interface MeasurementResult {
  /** Element top position relative to viewport */
  top: number;
  /** Element right position relative to viewport */
  right: number;
  /** Element bottom position relative to viewport */
  bottom: number;
  /** Element left position relative to viewport */
  left: number;
  /** Element width */
  width: number;
  /** Element height */
  height: number;
  /** Element x position (same as left) */
  x: number;
  /** Element y position (same as top) */
  y: number;
  /** Timestamp when measurement was taken */
  timestamp: number;
}

/**
 * Callback function that receives measurement result
 */
export type MeasurementCallback = (result: MeasurementResult) => void;

/**
 * Priority levels for measurement requests
 */
export type MeasurementPriority = "high" | "normal" | "low";

/**
 * Options for measurement requests
 */
export interface MeasurementOptions {
  /** Priority level (default: "normal") */
  priority?: MeasurementPriority;
  /** Skip cache and force fresh measurement */
  forceRefresh?: boolean;
}

/**
 * Internal measurement request
 */
interface MeasurementRequest {
  id: string;
  element: Element;
  callback: MeasurementCallback;
  priority: MeasurementPriority;
  timestamp: number;
}

/**
 * Cached measurement entry
 */
interface CachedMeasurement {
  result: MeasurementResult;
  frameId: number;
}

// ============================================================================
// Service Implementation
// ============================================================================

/**
 * Singleton service for batching DOM layout measurements using requestAnimationFrame
 */
class LayoutMeasurementService {
  private static instance: LayoutMeasurementService;

  // Measurement request queue
  private pendingRequests: Map<string, MeasurementRequest> = new Map();

  // Frame-level cache for measurements
  private measurementCache: Map<Element, CachedMeasurement> = new Map();

  // Current frame ID for cache invalidation
  private currentFrameId = 0;

  // RAF scheduling state
  private rafId: number | null = null;
  private isScheduled = false;

  // Request ID counter
  private requestCounter = 0;

  // Statistics
  private stats = {
    totalRequests: 0,
    batchedMeasurements: 0,
    cacheHits: 0,
    framesProcessed: 0,
  };

  private constructor() {
    // Initialize service
  }

  /**
   * Get singleton instance
   */
  static getInstance(): LayoutMeasurementService {
    if (!LayoutMeasurementService.instance) {
      LayoutMeasurementService.instance = new LayoutMeasurementService();
    }
    return LayoutMeasurementService.instance;
  }

  /**
   * Reset instance (primarily for testing)
   */
  static resetInstance(): void {
    if (LayoutMeasurementService.instance) {
      LayoutMeasurementService.instance.cleanup();
      LayoutMeasurementService.instance =
        undefined as unknown as LayoutMeasurementService;
    }
  }

  /**
   * Request a measurement for an element
   *
   * The measurement will be batched with other requests and executed
   * in the next animation frame. The callback will be called with the
   * measurement result.
   *
   * @param element - DOM element to measure
   * @param callback - Function to call with measurement result
   * @param options - Measurement options
   * @returns Request ID that can be used to cancel the request
   *
   * @example
   * // Basic usage
   * const requestId = layoutMeasurementService.measureElement(
   *   buttonRef.current,
   *   (rect) => {
   *     setPosition({ x: rect.left, y: rect.bottom });
   *   }
   * );
   *
   * @example
   * // High priority measurement
   * layoutMeasurementService.measureElement(
   *   element,
   *   (rect) => updatePosition(rect),
   *   { priority: 'high' }
   * );
   */
  measureElement(
    element: Element | null,
    callback: MeasurementCallback,
    options: MeasurementOptions = {}
  ): string | null {
    if (!element) {
      logger.warn("[LayoutMeasurement] measureElement called with null element");
      return null;
    }

    const id = `measure-${++this.requestCounter}`;
    const priority = options.priority ?? "normal";

    this.stats.totalRequests++;

    // Check cache first (if not forcing refresh)
    if (!options.forceRefresh) {
      const cached = this.measurementCache.get(element);
      if (cached && cached.frameId === this.currentFrameId) {
        // Cache hit - call callback immediately with cached result
        this.stats.cacheHits++;

        // Use microtask to maintain consistent async behavior
        queueMicrotask(() => {
          callback(cached.result);
        });

        return id;
      }
    }

    // Queue the measurement request
    const request: MeasurementRequest = {
      id,
      element,
      callback,
      priority,
      timestamp: performance.now(),
    };

    this.pendingRequests.set(id, request);

    // Schedule batch processing if not already scheduled
    if (!this.isScheduled) {
      this.scheduleBatch();
    }

    return id;
  }

  /**
   * Measure an element synchronously
   *
   * WARNING: This forces a synchronous layout. Use only when absolutely
   * necessary (e.g., immediate position calculations that can't be deferred).
   *
   * @param element - DOM element to measure
   * @returns Measurement result or null if element is invalid
   */
  measureElementSync(element: Element | null): MeasurementResult | null {
    if (!element) {
      return null;
    }

    // Check cache first
    const cached = this.measurementCache.get(element);
    if (cached && cached.frameId === this.currentFrameId) {
      this.stats.cacheHits++;
      return cached.result;
    }

    // Force synchronous measurement
    const rect = element.getBoundingClientRect();
    const result = this.domRectToResult(rect);

    // Cache the result
    this.measurementCache.set(element, {
      result,
      frameId: this.currentFrameId,
    });

    return result;
  }

  /**
   * Measure multiple elements in batch
   *
   * @param elements - Array of elements to measure
   * @param callback - Function called with array of results
   * @param options - Measurement options
   * @returns Array of request IDs
   */
  measureElements(
    elements: (Element | null)[],
    callback: (results: (MeasurementResult | null)[]) => void,
    options: MeasurementOptions = {}
  ): string[] {
    const validElements = elements.filter((el): el is Element => el !== null);

    if (validElements.length === 0) {
      queueMicrotask(() => callback(elements.map(() => null)));
      return [];
    }

    const results: (MeasurementResult | null)[] = new Array(elements.length).fill(null);
    const requestIds: string[] = [];
    let completedCount = 0;

    elements.forEach((element, index) => {
      if (!element) {
        return;
      }

      const requestId = this.measureElement(
        element,
        (result) => {
          results[index] = result;
          completedCount++;

          // Call callback when all measurements are complete
          if (completedCount === validElements.length) {
            callback(results);
          }
        },
        options
      );

      if (requestId) {
        requestIds.push(requestId);
      }
    });

    return requestIds;
  }

  /**
   * Cancel a pending measurement request
   *
   * @param requestId - ID of the request to cancel
   * @returns true if request was cancelled, false if not found
   */
  cancelRequest(requestId: string): boolean {
    return this.pendingRequests.delete(requestId);
  }

  /**
   * Invalidate cache for specific element
   *
   * Use this when an element's layout has changed and you need fresh measurements.
   *
   * @param element - Element to invalidate cache for
   */
  invalidateCache(element: Element): void {
    this.measurementCache.delete(element);
  }

  /**
   * Clear all cached measurements
   *
   * Use this when many elements have changed or on major layout changes.
   */
  clearCache(): void {
    this.measurementCache.clear();
    this.currentFrameId++;
  }

  /**
   * Schedule batch processing in the next animation frame
   */
  private scheduleBatch(): void {
    if (this.isScheduled) {
      return;
    }

    this.isScheduled = true;

    this.rafId = requestAnimationFrame(() => {
      this.processBatch();
    });
  }

  /**
   * Process all pending measurement requests
   */
  private processBatch(): void {
    this.isScheduled = false;
    this.rafId = null;
    this.currentFrameId++;
    this.stats.framesProcessed++;

    if (this.pendingRequests.size === 0) {
      return;
    }

    // Sort requests by priority
    const sortedRequests = Array.from(this.pendingRequests.values()).sort(
      (a, b) => {
        const priorityOrder = { high: 0, normal: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
    );

    // Batch read all measurements first (read phase)
    const measurements = new Map<MeasurementRequest, MeasurementResult>();

    for (const request of sortedRequests) {
      // Check cache
      const cached = this.measurementCache.get(request.element);
      if (cached && cached.frameId === this.currentFrameId) {
        this.stats.cacheHits++;
        measurements.set(request, cached.result);
        continue;
      }

      // Read from DOM
      const rect = request.element.getBoundingClientRect();
      const result = this.domRectToResult(rect);

      // Cache the result
      this.measurementCache.set(request.element, {
        result,
        frameId: this.currentFrameId,
      });

      measurements.set(request, result);
      this.stats.batchedMeasurements++;
    }

    // Clear pending requests before callbacks (in case callbacks add new requests)
    this.pendingRequests.clear();

    // Execute all callbacks (write phase)
    for (const [request, result] of measurements) {
      try {
        request.callback(result);
      } catch (error) {
        logger.error(
          `[LayoutMeasurement] Error in callback for request ${request.id}:`,
          error
        );
      }
    }

    logger.debug(
      `[LayoutMeasurement] Processed ${measurements.size} measurements in frame ${this.currentFrameId}`
    );
  }

  /**
   * Convert DOMRect to MeasurementResult
   */
  private domRectToResult(rect: DOMRect): MeasurementResult {
    return {
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      left: rect.left,
      width: rect.width,
      height: rect.height,
      x: rect.x,
      y: rect.y,
      timestamp: performance.now(),
    };
  }

  /**
   * Get service statistics
   */
  getStats(): {
    totalRequests: number;
    batchedMeasurements: number;
    cacheHits: number;
    framesProcessed: number;
    pendingRequests: number;
    cacheSize: number;
  } {
    return {
      ...this.stats,
      pendingRequests: this.pendingRequests.size,
      cacheSize: this.measurementCache.size,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalRequests: 0,
      batchedMeasurements: 0,
      cacheHits: 0,
      framesProcessed: 0,
    };
  }

  /**
   * Clean up all resources
   */
  cleanup(): void {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    this.pendingRequests.clear();
    this.measurementCache.clear();
    this.isScheduled = false;

    logger.debug("[LayoutMeasurement] Service cleaned up");
  }
}

// ============================================================================
// React Hook
// ============================================================================

/**
 * Hook for using layout measurements in React components
 *
 * @example
 * function MyComponent() {
 *   const [position, setPosition] = useState({ x: 0, y: 0 });
 *   const buttonRef = useRef<HTMLButtonElement>(null);
 *
 *   const handleClick = () => {
 *     layoutMeasurementService.measureElement(
 *       buttonRef.current,
 *       (rect) => setPosition({ x: rect.left, y: rect.bottom })
 *     );
 *   };
 *
 *   return <button ref={buttonRef} onClick={handleClick}>Click</button>;
 * }
 */

// ============================================================================
// Exports
// ============================================================================

/**
 * Singleton instance export
 */
export const layoutMeasurementService = LayoutMeasurementService.getInstance();

/**
 * Reset instance for testing
 */
export const resetLayoutMeasurementService =
  LayoutMeasurementService.resetInstance;

/**
 * Convenience function for measuring a single element
 */
export const measureElement = (
  element: Element | null,
  callback: MeasurementCallback,
  options?: MeasurementOptions
) => layoutMeasurementService.measureElement(element, callback, options);

/**
 * Convenience function for measuring multiple elements
 */
export const measureElements = (
  elements: (Element | null)[],
  callback: (results: (MeasurementResult | null)[]) => void,
  options?: MeasurementOptions
) => layoutMeasurementService.measureElements(elements, callback, options);

/**
 * Convenience function for synchronous measurement (use sparingly)
 */
export const measureElementSync = (element: Element | null) =>
  layoutMeasurementService.measureElementSync(element);

/**
 * Convenience function to invalidate element cache
 */
export const invalidateMeasurementCache = (element: Element) =>
  layoutMeasurementService.invalidateCache(element);

/**
 * Convenience function to clear all measurement cache
 */
export const clearMeasurementCache = () =>
  layoutMeasurementService.clearCache();
