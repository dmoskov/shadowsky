/**
 * RAF Scroll Batching Service
 *
 * Optimizes scroll performance by batching multiple scroll event handlers
 * into single requestAnimationFrame callbacks. This ensures smooth 60fps
 * scrolling by:
 *
 * 1. Coalescing multiple scroll events into single RAF frames
 * 2. Preventing layout thrashing by batching DOM reads
 * 3. Providing scroll state (position, direction, velocity) to subscribers
 * 4. Managing cleanup on component unmount
 *
 * @module services/scroll-batching-service
 */

import { debug } from "@bsky/shared";

// ============================================================================
// Types
// ============================================================================

/**
 * Current scroll state provided to subscribers
 */
export interface ScrollState {
  /** Current scroll position (Y axis) */
  scrollY: number;
  /** Current scroll position (X axis) */
  scrollX: number;
  /** Previous scroll position (Y axis) */
  previousScrollY: number;
  /** Scroll direction: 1 = down, -1 = up, 0 = stationary */
  direction: -1 | 0 | 1;
  /** Scroll velocity in pixels per frame */
  velocity: number;
  /** Timestamp of the scroll event */
  timestamp: number;
  /** Whether user is actively scrolling */
  isScrolling: boolean;
  /** Source element that triggered the scroll */
  source: ScrollSource;
}

/**
 * Source of scroll events
 */
export type ScrollSource = "window" | "element";

/**
 * Callback function that receives scroll state
 */
export type ScrollCallback = (state: ScrollState) => void;

/**
 * Priority levels for scroll callbacks
 * Higher priority callbacks are executed first
 */
export type ScrollPriority = "high" | "normal" | "low";

/**
 * Subscription options
 */
export interface ScrollSubscriptionOptions {
  /** Priority level (default: "normal") */
  priority?: ScrollPriority;
  /** Only fire when scroll direction changes */
  onDirectionChange?: boolean;
  /** Minimum scroll delta to trigger callback */
  threshold?: number;
  /** Element to watch (default: window) */
  element?: HTMLElement | null;
}

/**
 * Internal subscriber entry
 */
interface Subscriber {
  id: string;
  callback: ScrollCallback;
  options: Required<ScrollSubscriptionOptions>;
  lastScrollY: number;
  lastDirection: -1 | 0 | 1;
}

/**
 * Element-specific scroll tracking
 */
interface ElementScrollTracker {
  element: HTMLElement;
  subscribers: Map<string, Subscriber>;
  rafId: number | null;
  isScheduled: boolean;
  lastScrollY: number;
  lastScrollX: number;
  lastTimestamp: number;
  scrollEndTimer: ReturnType<typeof setTimeout> | null;
  isScrolling: boolean;
  boundHandler: (e: Event) => void;
}

// ============================================================================
// Service Implementation
// ============================================================================

/**
 * Singleton service for batching scroll events using requestAnimationFrame
 */
class ScrollBatchingService {
  private static instance: ScrollBatchingService;

  // Window scroll tracking
  private windowSubscribers: Map<string, Subscriber> = new Map();
  private windowRafId: number | null = null;
  private windowIsScheduled = false;
  private windowLastScrollY = 0;
  private windowLastTimestamp = 0;
  private windowScrollEndTimer: ReturnType<typeof setTimeout> | null = null;
  private windowIsScrolling = false;
  private windowBoundHandler: ((e: Event) => void) | null = null;

  // Element scroll tracking
  private elementTrackers: Map<HTMLElement, ElementScrollTracker> = new Map();

  // Subscriber ID counter
  private subscriberCounter = 0;

  // Scroll end delay (ms) - time after last scroll event to consider scrolling "stopped"
  private scrollEndDelay = 150;

  private constructor() {
    // Initialize window scroll listener lazily
  }

  /**
   * Get singleton instance
   */
  static getInstance(): ScrollBatchingService {
    if (!ScrollBatchingService.instance) {
      ScrollBatchingService.instance = new ScrollBatchingService();
    }
    return ScrollBatchingService.instance;
  }

  /**
   * Reset instance (primarily for testing)
   */
  static resetInstance(): void {
    if (ScrollBatchingService.instance) {
      ScrollBatchingService.instance.cleanup();
      ScrollBatchingService.instance =
        undefined as unknown as ScrollBatchingService;
    }
  }

  /**
   * Subscribe to scroll events
   *
   * @param callback - Function to call on scroll
   * @param options - Subscription options
   * @returns Unsubscribe function
   *
   * @example
   * // Basic window scroll subscription
   * const unsubscribe = scrollBatchingService.subscribe((state) => {
   *   console.log('Scroll position:', state.scrollY);
   * });
   *
   * @example
   * // Element scroll with threshold
   * const unsubscribe = scrollBatchingService.subscribe(
   *   (state) => updateUI(state),
   *   { element: containerRef.current, threshold: 50 }
   * );
   */
  subscribe(
    callback: ScrollCallback,
    options: ScrollSubscriptionOptions = {},
  ): () => void {
    const id = `scroll-sub-${++this.subscriberCounter}`;

    const normalizedOptions: Required<ScrollSubscriptionOptions> = {
      priority: options.priority ?? "normal",
      onDirectionChange: options.onDirectionChange ?? false,
      threshold: options.threshold ?? 0,
      element: options.element ?? null,
    };

    const subscriber: Subscriber = {
      id,
      callback,
      options: normalizedOptions,
      lastScrollY: 0,
      lastDirection: 0,
    };

    if (normalizedOptions.element) {
      this.addElementSubscriber(normalizedOptions.element, subscriber);
    } else {
      this.addWindowSubscriber(subscriber);
    }

    debug.log(
      `[ScrollBatching] Subscribed: ${id} (${normalizedOptions.element ? "element" : "window"})`,
    );

    return () => this.unsubscribe(id, normalizedOptions.element);
  }

  /**
   * Add window scroll subscriber
   */
  private addWindowSubscriber(subscriber: Subscriber): void {
    this.windowSubscribers.set(subscriber.id, subscriber);

    // Initialize window listener if first subscriber
    if (this.windowSubscribers.size === 1) {
      this.initWindowListener();
    }
  }

  /**
   * Add element scroll subscriber
   */
  private addElementSubscriber(
    element: HTMLElement,
    subscriber: Subscriber,
  ): void {
    let tracker = this.elementTrackers.get(element);

    if (!tracker) {
      tracker = this.createElementTracker(element);
      this.elementTrackers.set(element, tracker);
    }

    tracker.subscribers.set(subscriber.id, subscriber);
  }

  /**
   * Create tracker for an element
   */
  private createElementTracker(element: HTMLElement): ElementScrollTracker {
    const tracker: ElementScrollTracker = {
      element,
      subscribers: new Map(),
      rafId: null,
      isScheduled: false,
      lastScrollY: element.scrollTop,
      lastScrollX: element.scrollLeft,
      lastTimestamp: performance.now(),
      scrollEndTimer: null,
      isScrolling: false,
      boundHandler: () => {},
    };

    // Create bound handler
    tracker.boundHandler = () => this.scheduleElementUpdate(tracker);

    // Add passive scroll listener
    element.addEventListener("scroll", tracker.boundHandler, { passive: true });

    return tracker;
  }

  /**
   * Initialize window scroll listener
   */
  private initWindowListener(): void {
    if (typeof window === "undefined") return;

    this.windowLastScrollY = window.scrollY;
    this.windowLastTimestamp = performance.now();

    this.windowBoundHandler = () => this.scheduleWindowUpdate();
    window.addEventListener("scroll", this.windowBoundHandler, {
      passive: true,
    });
  }

  /**
   * Schedule RAF update for window scroll
   */
  private scheduleWindowUpdate(): void {
    if (this.windowIsScheduled) return;

    this.windowIsScheduled = true;
    this.windowIsScrolling = true;

    // Clear existing scroll end timer
    if (this.windowScrollEndTimer) {
      clearTimeout(this.windowScrollEndTimer);
    }

    // Schedule scroll end detection
    this.windowScrollEndTimer = setTimeout(() => {
      this.windowIsScrolling = false;
      // Trigger one more update to notify subscribers of scroll end
      this.scheduleWindowUpdate();
    }, this.scrollEndDelay);

    this.windowRafId = requestAnimationFrame(() => {
      this.processWindowScroll();
      this.windowIsScheduled = false;
    });
  }

  /**
   * Process window scroll and notify subscribers
   */
  private processWindowScroll(): void {
    const now = performance.now();
    const currentScrollY = window.scrollY;
    const currentScrollX = window.scrollX;

    const deltaY = currentScrollY - this.windowLastScrollY;
    const deltaTime = now - this.windowLastTimestamp;

    const direction: -1 | 0 | 1 = deltaY > 0 ? 1 : deltaY < 0 ? -1 : 0;
    const velocity = deltaTime > 0 ? Math.abs(deltaY) / (deltaTime / 16.67) : 0;

    const state: ScrollState = {
      scrollY: currentScrollY,
      scrollX: currentScrollX,
      previousScrollY: this.windowLastScrollY,
      direction,
      velocity,
      timestamp: now,
      isScrolling: this.windowIsScrolling,
      source: "window",
    };

    // Update last values
    this.windowLastScrollY = currentScrollY;
    this.windowLastTimestamp = now;

    // Notify subscribers by priority
    this.notifySubscribers(this.windowSubscribers, state);
  }

  /**
   * Schedule RAF update for element scroll
   */
  private scheduleElementUpdate(tracker: ElementScrollTracker): void {
    if (tracker.isScheduled) return;

    tracker.isScheduled = true;
    tracker.isScrolling = true;

    // Clear existing scroll end timer
    if (tracker.scrollEndTimer) {
      clearTimeout(tracker.scrollEndTimer);
    }

    // Schedule scroll end detection
    tracker.scrollEndTimer = setTimeout(() => {
      tracker.isScrolling = false;
      // Trigger one more update to notify subscribers of scroll end
      this.scheduleElementUpdate(tracker);
    }, this.scrollEndDelay);

    tracker.rafId = requestAnimationFrame(() => {
      this.processElementScroll(tracker);
      tracker.isScheduled = false;
    });
  }

  /**
   * Process element scroll and notify subscribers
   */
  private processElementScroll(tracker: ElementScrollTracker): void {
    const now = performance.now();
    const currentScrollY = tracker.element.scrollTop;
    const currentScrollX = tracker.element.scrollLeft;

    const deltaY = currentScrollY - tracker.lastScrollY;
    const deltaTime = now - tracker.lastTimestamp;

    const direction: -1 | 0 | 1 = deltaY > 0 ? 1 : deltaY < 0 ? -1 : 0;
    const velocity = deltaTime > 0 ? Math.abs(deltaY) / (deltaTime / 16.67) : 0;

    const state: ScrollState = {
      scrollY: currentScrollY,
      scrollX: currentScrollX,
      previousScrollY: tracker.lastScrollY,
      direction,
      velocity,
      timestamp: now,
      isScrolling: tracker.isScrolling,
      source: "element",
    };

    // Update last values
    tracker.lastScrollY = currentScrollY;
    tracker.lastScrollX = currentScrollX;
    tracker.lastTimestamp = now;

    // Notify subscribers by priority
    this.notifySubscribers(tracker.subscribers, state);
  }

  /**
   * Notify subscribers with priority ordering
   */
  private notifySubscribers(
    subscribers: Map<string, Subscriber>,
    state: ScrollState,
  ): void {
    // Sort by priority
    const sorted = Array.from(subscribers.values()).sort((a, b) => {
      const priorityOrder = { high: 0, normal: 1, low: 2 };
      return (
        priorityOrder[a.options.priority] - priorityOrder[b.options.priority]
      );
    });

    for (const subscriber of sorted) {
      const { options, lastScrollY, lastDirection } = subscriber;

      // Check threshold
      if (options.threshold > 0) {
        const delta = Math.abs(state.scrollY - lastScrollY);
        if (delta < options.threshold) continue;
      }

      // Check direction change filter
      if (options.onDirectionChange && state.direction === lastDirection) {
        continue;
      }

      // Update subscriber state
      subscriber.lastScrollY = state.scrollY;
      subscriber.lastDirection = state.direction;

      // Call subscriber
      try {
        subscriber.callback(state);
      } catch (error) {
        debug.error(
          `[ScrollBatching] Error in subscriber ${subscriber.id}:`,
          error,
        );
      }
    }
  }

  /**
   * Unsubscribe from scroll events
   */
  private unsubscribe(id: string, element: HTMLElement | null): void {
    if (element) {
      const tracker = this.elementTrackers.get(element);
      if (tracker) {
        tracker.subscribers.delete(id);

        // Clean up tracker if no more subscribers
        if (tracker.subscribers.size === 0) {
          this.cleanupElementTracker(tracker);
          this.elementTrackers.delete(element);
        }
      }
    } else {
      this.windowSubscribers.delete(id);

      // Clean up window listener if no more subscribers
      if (this.windowSubscribers.size === 0) {
        this.cleanupWindowListener();
      }
    }

    debug.log(
      `[ScrollBatching] Unsubscribed: ${id} (${element ? "element" : "window"})`,
    );
  }

  /**
   * Clean up element tracker
   */
  private cleanupElementTracker(tracker: ElementScrollTracker): void {
    tracker.element.removeEventListener("scroll", tracker.boundHandler);

    if (tracker.rafId) {
      cancelAnimationFrame(tracker.rafId);
    }

    if (tracker.scrollEndTimer) {
      clearTimeout(tracker.scrollEndTimer);
    }

    tracker.subscribers.clear();
  }

  /**
   * Clean up window listener
   */
  private cleanupWindowListener(): void {
    if (this.windowBoundHandler) {
      window.removeEventListener("scroll", this.windowBoundHandler);
      this.windowBoundHandler = null;
    }

    if (this.windowRafId) {
      cancelAnimationFrame(this.windowRafId);
      this.windowRafId = null;
    }

    if (this.windowScrollEndTimer) {
      clearTimeout(this.windowScrollEndTimer);
      this.windowScrollEndTimer = null;
    }

    this.windowIsScheduled = false;
    this.windowIsScrolling = false;
  }

  /**
   * Clean up all resources
   */
  cleanup(): void {
    // Clean up all element trackers
    for (const tracker of this.elementTrackers.values()) {
      this.cleanupElementTracker(tracker);
    }
    this.elementTrackers.clear();

    // Clean up window listener
    this.cleanupWindowListener();
    this.windowSubscribers.clear();

    debug.log("[ScrollBatching] Cleaned up all scroll subscriptions");
  }

  /**
   * Get service statistics
   */
  getStats(): {
    windowSubscribers: number;
    elementTrackers: number;
    totalSubscribers: number;
    isWindowScrolling: boolean;
  } {
    let totalElementSubscribers = 0;
    for (const tracker of this.elementTrackers.values()) {
      totalElementSubscribers += tracker.subscribers.size;
    }

    return {
      windowSubscribers: this.windowSubscribers.size,
      elementTrackers: this.elementTrackers.size,
      totalSubscribers: this.windowSubscribers.size + totalElementSubscribers,
      isWindowScrolling: this.windowIsScrolling,
    };
  }
}

// ============================================================================
// Exports
// ============================================================================

/**
 * Singleton instance export
 */
export const scrollBatchingService = ScrollBatchingService.getInstance();

/**
 * Reset instance for testing
 */
export const resetScrollBatchingService = ScrollBatchingService.resetInstance;
