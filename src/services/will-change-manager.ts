/**
 * WillChangeManager - Intelligent GPU acceleration management
 *
 * Manages will-change CSS property to optimize scroll performance while avoiding
 * memory overhead. The will-change property tells the browser to prepare for specific
 * changes, enabling GPU layer creation ahead of time.
 *
 * Key features:
 * - Dynamic will-change application based on scroll state
 * - Automatic cleanup to prevent memory leaks
 * - Batched DOM operations for performance
 * - Intersection Observer-based lazy activation
 * - Respects reduced motion preferences
 */

import { createLogger } from "../utils/logger";

const logger = createLogger("WillChangeManager");

/**
 * Properties that can be hinted for GPU acceleration
 */
export type WillChangeProperty =
  | "transform"
  | "opacity"
  | "scroll-position"
  | "contents"
  | "auto";

/**
 * Configuration for a managed element
 */
export interface WillChangeConfig {
  /** Properties to hint for optimization */
  properties: WillChangeProperty[];
  /** Whether to activate based on scroll proximity */
  activateOnScroll?: boolean;
  /** Delay before removing will-change after scroll stops (ms) */
  deactivateDelay?: number;
  /** Whether to activate when element enters viewport */
  activateOnVisible?: boolean;
  /** Margin for intersection observer (e.g., "100px") */
  intersectionMargin?: string;
}

/**
 * Internal tracked element state
 */
interface TrackedElement {
  element: HTMLElement;
  config: WillChangeConfig;
  isActive: boolean;
  deactivateTimer?: ReturnType<typeof setTimeout>;
  observer?: IntersectionObserver;
}

/**
 * Scroll container registration
 */
interface ScrollContainer {
  element: HTMLElement;
  isScrolling: boolean;
  scrollTimer?: ReturnType<typeof setTimeout>;
  managedElements: Set<HTMLElement>;
}

class WillChangeManagerService {
  private trackedElements = new Map<HTMLElement, TrackedElement>();
  private scrollContainers = new Map<HTMLElement, ScrollContainer>();
  private isReducedMotion = false;
  private isInitialized = false;
  private pendingActivations = new Set<HTMLElement>();
  private pendingDeactivations = new Set<HTMLElement>();
  private rafId: number | null = null;

  // Default configuration
  private readonly defaultConfig: WillChangeConfig = {
    properties: ["transform"],
    activateOnScroll: true,
    deactivateDelay: 200,
    activateOnVisible: false,
    intersectionMargin: "100px",
  };

  /**
   * Initialize the manager
   */
  init(): void {
    if (this.isInitialized) return;

    // Check for reduced motion preference
    this.checkReducedMotion();

    // Listen for preference changes
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    mediaQuery.addEventListener("change", this.handleReducedMotionChange);

    // Also check data attribute
    this.checkReducedMotionAttribute();
    const observer = new MutationObserver(this.checkReducedMotionAttribute);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-reduce-motion"],
    });

    this.isInitialized = true;
    logger.log("WillChangeManager initialized");
  }

  /**
   * Clean up the manager
   */
  destroy(): void {
    // Clean up all tracked elements
    this.trackedElements.forEach((tracked) => {
      this.cleanupTrackedElement(tracked);
    });
    this.trackedElements.clear();

    // Clean up scroll containers
    this.scrollContainers.forEach((container) => {
      container.element.removeEventListener("scroll", this.handleScroll);
      if (container.scrollTimer) {
        clearTimeout(container.scrollTimer);
      }
    });
    this.scrollContainers.clear();

    // Cancel pending RAF
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    this.isInitialized = false;
    logger.log("WillChangeManager destroyed");
  }

  /**
   * Register a scroll container for GPU acceleration management
   */
  registerScrollContainer(element: HTMLElement): () => void {
    if (this.scrollContainers.has(element)) {
      return () => this.unregisterScrollContainer(element);
    }

    const container: ScrollContainer = {
      element,
      isScrolling: false,
      managedElements: new Set(),
    };

    this.scrollContainers.set(element, container);

    // Add scroll listener
    element.addEventListener("scroll", this.handleScroll, { passive: true });

    logger.log("Registered scroll container");

    return () => this.unregisterScrollContainer(element);
  }

  /**
   * Unregister a scroll container
   */
  unregisterScrollContainer(element: HTMLElement): void {
    const container = this.scrollContainers.get(element);
    if (!container) return;

    element.removeEventListener("scroll", this.handleScroll);

    if (container.scrollTimer) {
      clearTimeout(container.scrollTimer);
    }

    // Deactivate all managed elements
    container.managedElements.forEach((el) => {
      this.deactivateElement(el);
    });

    this.scrollContainers.delete(element);
    logger.log("Unregistered scroll container");
  }

  /**
   * Register an element for will-change management
   */
  register(
    element: HTMLElement,
    config?: Partial<WillChangeConfig>,
  ): () => void {
    const fullConfig = { ...this.defaultConfig, ...config };

    // Find parent scroll container
    const scrollContainer = this.findScrollContainer(element);

    const tracked: TrackedElement = {
      element,
      config: fullConfig,
      isActive: false,
    };

    // Set up intersection observer if needed
    if (fullConfig.activateOnVisible) {
      tracked.observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              this.scheduleActivation(element);
            } else {
              this.scheduleDeactivation(element, fullConfig.deactivateDelay);
            }
          });
        },
        {
          rootMargin: fullConfig.intersectionMargin,
          threshold: 0,
        },
      );
      tracked.observer.observe(element);
    }

    this.trackedElements.set(element, tracked);

    // Add to scroll container's managed elements
    if (scrollContainer) {
      const container = this.scrollContainers.get(scrollContainer);
      if (container) {
        container.managedElements.add(element);
      }
    }

    return () => this.unregister(element);
  }

  /**
   * Unregister an element
   */
  unregister(element: HTMLElement): void {
    const tracked = this.trackedElements.get(element);
    if (!tracked) return;

    this.cleanupTrackedElement(tracked);
    this.trackedElements.delete(element);

    // Remove from scroll containers
    this.scrollContainers.forEach((container) => {
      container.managedElements.delete(element);
    });

    // Remove from pending operations
    this.pendingActivations.delete(element);
    this.pendingDeactivations.delete(element);
  }

  /**
   * Manually activate GPU acceleration for an element
   */
  activate(element: HTMLElement): void {
    const tracked = this.trackedElements.get(element);
    if (!tracked || tracked.isActive || this.isReducedMotion) return;

    this.scheduleActivation(element);
  }

  /**
   * Manually deactivate GPU acceleration for an element
   */
  deactivate(element: HTMLElement, delay?: number): void {
    const tracked = this.trackedElements.get(element);
    if (!tracked || !tracked.isActive) return;

    this.scheduleDeactivation(element, delay ?? tracked.config.deactivateDelay);
  }

  /**
   * Activate GPU acceleration for all elements in a scroll container
   */
  activateScrollContainer(scrollContainer: HTMLElement): void {
    const container = this.scrollContainers.get(scrollContainer);
    if (!container || this.isReducedMotion) return;

    container.managedElements.forEach((el) => {
      this.scheduleActivation(el);
    });
  }

  /**
   * Deactivate GPU acceleration for all elements in a scroll container
   */
  deactivateScrollContainer(
    scrollContainer: HTMLElement,
    delay?: number,
  ): void {
    const container = this.scrollContainers.get(scrollContainer);
    if (!container) return;

    container.managedElements.forEach((el) => {
      const tracked = this.trackedElements.get(el);
      this.scheduleDeactivation(
        el,
        delay ??
          tracked?.config.deactivateDelay ??
          this.defaultConfig.deactivateDelay,
      );
    });
  }

  /**
   * Check if an element is currently GPU accelerated
   */
  isActive(element: HTMLElement): boolean {
    return this.trackedElements.get(element)?.isActive ?? false;
  }

  /**
   * Get current stats
   */
  getStats(): {
    trackedElements: number;
    activeElements: number;
    scrollContainers: number;
  } {
    let activeCount = 0;
    this.trackedElements.forEach((tracked) => {
      if (tracked.isActive) activeCount++;
    });

    return {
      trackedElements: this.trackedElements.size,
      activeElements: activeCount,
      scrollContainers: this.scrollContainers.size,
    };
  }

  // Private methods

  private handleScroll = (event: Event): void => {
    const target = event.target as HTMLElement;
    const container = this.scrollContainers.get(target);
    if (!container) return;

    // Mark as scrolling
    if (!container.isScrolling) {
      container.isScrolling = true;

      // Activate all managed elements
      if (!this.isReducedMotion) {
        container.managedElements.forEach((el) => {
          const tracked = this.trackedElements.get(el);
          if (tracked?.config.activateOnScroll) {
            this.scheduleActivation(el);
          }
        });
      }
    }

    // Clear existing timer
    if (container.scrollTimer) {
      clearTimeout(container.scrollTimer);
    }

    // Set timer for scroll end
    container.scrollTimer = setTimeout(() => {
      container.isScrolling = false;

      // Deactivate managed elements after delay
      container.managedElements.forEach((el) => {
        const tracked = this.trackedElements.get(el);
        if (tracked?.config.activateOnScroll) {
          this.scheduleDeactivation(el, tracked.config.deactivateDelay);
        }
      });
    }, 150);
  };

  private scheduleActivation(element: HTMLElement): void {
    if (this.isReducedMotion) return;

    // Remove from deactivation if pending
    this.pendingDeactivations.delete(element);
    const tracked = this.trackedElements.get(element);
    if (tracked?.deactivateTimer) {
      clearTimeout(tracked.deactivateTimer);
      tracked.deactivateTimer = undefined;
    }

    // Add to pending activations
    this.pendingActivations.add(element);

    // Schedule batch update
    this.scheduleBatchUpdate();
  }

  private scheduleDeactivation(element: HTMLElement, delay?: number): void {
    const tracked = this.trackedElements.get(element);
    if (!tracked) return;

    // Clear any existing deactivation timer
    if (tracked.deactivateTimer) {
      clearTimeout(tracked.deactivateTimer);
    }

    const deactivateDelay = delay ?? this.defaultConfig.deactivateDelay ?? 200;

    tracked.deactivateTimer = setTimeout(() => {
      this.pendingActivations.delete(element);
      this.pendingDeactivations.add(element);
      this.scheduleBatchUpdate();
    }, deactivateDelay);
  }

  private scheduleBatchUpdate(): void {
    if (this.rafId !== null) return;

    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      this.processBatchUpdate();
    });
  }

  private processBatchUpdate(): void {
    // Process activations
    this.pendingActivations.forEach((element) => {
      this.activateElement(element);
    });
    this.pendingActivations.clear();

    // Process deactivations
    this.pendingDeactivations.forEach((element) => {
      this.deactivateElement(element);
    });
    this.pendingDeactivations.clear();
  }

  private activateElement(element: HTMLElement): void {
    const tracked = this.trackedElements.get(element);
    if (!tracked || tracked.isActive || this.isReducedMotion) return;

    const willChangeValue = tracked.config.properties.join(", ");
    element.style.willChange = willChangeValue;
    tracked.isActive = true;
  }

  private deactivateElement(element: HTMLElement): void {
    const tracked = this.trackedElements.get(element);
    if (!tracked || !tracked.isActive) return;

    element.style.willChange = "auto";
    tracked.isActive = false;
  }

  private cleanupTrackedElement(tracked: TrackedElement): void {
    // Clear timers
    if (tracked.deactivateTimer) {
      clearTimeout(tracked.deactivateTimer);
    }

    // Disconnect observer
    if (tracked.observer) {
      tracked.observer.disconnect();
    }

    // Reset will-change
    tracked.element.style.willChange = "";
  }

  private findScrollContainer(element: HTMLElement): HTMLElement | null {
    let current = element.parentElement;

    while (current) {
      if (this.scrollContainers.has(current)) {
        return current;
      }

      const overflow = getComputedStyle(current).overflow;
      if (overflow === "auto" || overflow === "scroll") {
        // Auto-register this as a scroll container
        this.registerScrollContainer(current);
        return current;
      }

      current = current.parentElement;
    }

    return null;
  }

  private checkReducedMotion = (): void => {
    this.isReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
  };

  private handleReducedMotionChange = (event: MediaQueryListEvent): void => {
    this.isReducedMotion = event.matches;

    if (this.isReducedMotion) {
      // Deactivate all elements immediately
      this.trackedElements.forEach((tracked) => {
        if (tracked.isActive) {
          tracked.element.style.willChange = "auto";
          tracked.isActive = false;
        }
      });
    }
  };

  private checkReducedMotionAttribute = (): void => {
    const attrValue =
      document.documentElement.getAttribute("data-reduce-motion");
    if (attrValue === "true") {
      this.isReducedMotion = true;
    }
  };
}

// Export singleton instance
export const willChangeManager = new WillChangeManagerService();

// Auto-initialize on import in browser environment
if (typeof window !== "undefined") {
  willChangeManager.init();
}
