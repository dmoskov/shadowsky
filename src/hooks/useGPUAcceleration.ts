/**
 * useGPUAcceleration - React hook for intelligent GPU acceleration management
 *
 * Provides convenient access to the WillChangeManager for:
 * - Automatic scroll container registration
 * - Element-level will-change management
 * - Scroll-based GPU layer activation/deactivation
 * - Memory-efficient animation preparation
 */

import { useCallback, useEffect, useRef } from "react";
import {
  willChangeManager,
  type WillChangeConfig,
  type WillChangeProperty,
} from "../services/will-change-manager";

/**
 * Hook for registering a scroll container for GPU acceleration
 *
 * @param options - Configuration options
 * @returns Ref callback to attach to the scroll container
 *
 * @example
 * ```tsx
 * function MyFeed() {
 *   const scrollRef = useScrollContainerGPU();
 *   return (
 *     <div ref={scrollRef} className="overflow-y-auto">
 *       {items.map(item => <FeedItem key={item.id} item={item} />)}
 *     </div>
 *   );
 * }
 * ```
 */
export function useScrollContainerGPU(): (element: HTMLElement | null) => void {
  const cleanupRef = useRef<(() => void) | null>(null);

  const refCallback = useCallback((element: HTMLElement | null) => {
    // Clean up previous registration
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }

    if (element) {
      cleanupRef.current = willChangeManager.registerScrollContainer(element);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    };
  }, []);

  return refCallback;
}

/**
 * Hook for registering an element for will-change management
 *
 * @param config - Configuration for will-change behavior
 * @returns Ref callback to attach to the element
 *
 * @example
 * ```tsx
 * function AnimatedCard() {
 *   const gpuRef = useGPUAcceleration({
 *     properties: ['transform', 'opacity'],
 *     activateOnScroll: true,
 *   });
 *   return (
 *     <div ref={gpuRef} className="card">
 *       Content
 *     </div>
 *   );
 * }
 * ```
 */
export function useGPUAcceleration(
  config?: Partial<WillChangeConfig>,
): (element: HTMLElement | null) => void {
  const cleanupRef = useRef<(() => void) | null>(null);
  const configRef = useRef(config);

  // Update config ref
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  const refCallback = useCallback((element: HTMLElement | null) => {
    // Clean up previous registration
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }

    if (element) {
      cleanupRef.current = willChangeManager.register(
        element,
        configRef.current,
      );
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    };
  }, []);

  return refCallback;
}

/**
 * Hook for visibility-based GPU acceleration
 *
 * Activates GPU acceleration when element enters viewport,
 * deactivates when it leaves. Useful for heavy animated elements.
 *
 * @param options - Configuration options
 * @returns Ref callback to attach to the element
 *
 * @example
 * ```tsx
 * function HeavyAnimation() {
 *   const gpuRef = useVisibilityGPU({
 *     properties: ['transform'],
 *     margin: '200px',
 *   });
 *   return (
 *     <div ref={gpuRef} className="animated-element">
 *       Complex animation content
 *     </div>
 *   );
 * }
 * ```
 */
export function useVisibilityGPU(options?: {
  properties?: WillChangeProperty[];
  margin?: string;
  deactivateDelay?: number;
}): (element: HTMLElement | null) => void {
  return useGPUAcceleration({
    properties: options?.properties ?? ["transform"],
    activateOnVisible: true,
    activateOnScroll: false,
    intersectionMargin: options?.margin ?? "100px",
    deactivateDelay: options?.deactivateDelay ?? 200,
  });
}

/**
 * Hook for scroll-only GPU acceleration
 *
 * Activates GPU acceleration only during scroll, deactivates after.
 * Most memory-efficient option for scroll performance.
 *
 * @param options - Configuration options
 * @returns Ref callback to attach to the element
 *
 * @example
 * ```tsx
 * function FeedItem({ item }) {
 *   const gpuRef = useScrollGPU();
 *   return (
 *     <article ref={gpuRef} className="feed-item">
 *       {item.content}
 *     </article>
 *   );
 * }
 * ```
 */
export function useScrollGPU(options?: {
  properties?: WillChangeProperty[];
  deactivateDelay?: number;
}): (element: HTMLElement | null) => void {
  return useGPUAcceleration({
    properties: options?.properties ?? ["transform"],
    activateOnScroll: true,
    activateOnVisible: false,
    deactivateDelay: options?.deactivateDelay ?? 200,
  });
}

/**
 * Hook for manual GPU acceleration control
 *
 * Provides imperative control over GPU acceleration for elements
 * that need custom activation logic.
 *
 * @returns Object with activate, deactivate, and ref functions
 *
 * @example
 * ```tsx
 * function InteractiveElement() {
 *   const { ref, activate, deactivate } = useManualGPU({
 *     properties: ['transform', 'opacity'],
 *   });
 *
 *   const handleMouseEnter = () => activate();
 *   const handleMouseLeave = () => deactivate();
 *
 *   return (
 *     <div
 *       ref={ref}
 *       onMouseEnter={handleMouseEnter}
 *       onMouseLeave={handleMouseLeave}
 *     >
 *       Interactive content
 *     </div>
 *   );
 * }
 * ```
 */
export function useManualGPU(config?: Partial<WillChangeConfig>): {
  ref: (element: HTMLElement | null) => void;
  activate: () => void;
  deactivate: (delay?: number) => void;
  isActive: () => boolean;
} {
  const elementRef = useRef<HTMLElement | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const configRef = useRef(config);

  // Update config ref
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  const refCallback = useCallback((element: HTMLElement | null) => {
    // Clean up previous registration
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }

    elementRef.current = element;

    if (element) {
      cleanupRef.current = willChangeManager.register(element, {
        ...configRef.current,
        activateOnScroll: false,
        activateOnVisible: false,
      });
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    };
  }, []);

  const activate = useCallback(() => {
    if (elementRef.current) {
      willChangeManager.activate(elementRef.current);
    }
  }, []);

  const deactivate = useCallback((delay?: number) => {
    if (elementRef.current) {
      willChangeManager.deactivate(elementRef.current, delay);
    }
  }, []);

  const isActive = useCallback(() => {
    if (elementRef.current) {
      return willChangeManager.isActive(elementRef.current);
    }
    return false;
  }, []);

  return {
    ref: refCallback,
    activate,
    deactivate,
    isActive,
  };
}

/**
 * Hook for combining ref callbacks
 *
 * Useful when you need to combine GPU acceleration with other ref-based hooks.
 *
 * @param refs - Array of ref callbacks to combine
 * @returns Combined ref callback
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const gpuRef = useGPUAcceleration();
 *   const measureRef = useMeasure();
 *   const combinedRef = useCombinedRefs(gpuRef, measureRef);
 *
 *   return <div ref={combinedRef}>Content</div>;
 * }
 * ```
 */
export function useCombinedRefs<T extends HTMLElement>(
  ...refs: Array<
    ((element: T | null) => void) | React.RefObject<T | null> | null
  >
): (element: T | null) => void {
  return useCallback(
    (element: T | null) => {
      refs.forEach((ref) => {
        if (!ref) return;

        if (typeof ref === "function") {
          ref(element);
        } else if ("current" in ref) {
          (ref as React.MutableRefObject<T | null>).current = element;
        }
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    refs,
  );
}

// Re-export types for convenience
export type { WillChangeConfig, WillChangeProperty };
