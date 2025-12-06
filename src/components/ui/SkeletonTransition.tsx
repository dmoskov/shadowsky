import React, { useCallback, useEffect, useRef, useState } from "react";

/**
 * Skeleton Transition System
 *
 * Provides smooth morphing transitions from skeleton loading states to
 * real content, eliminating jarring instant-replace effects.
 *
 * Features:
 * - Smooth crossfade between skeleton and content
 * - Optional morph/scale effect for natural appearance
 * - Staggered reveal for list items
 * - Reduced-motion support for accessibility
 * - GPU-accelerated animations for smooth performance
 */

type TransitionVariant = "fade" | "morph" | "blur" | "slide-up" | "scale";

interface SkeletonTransitionProps {
  /** Whether the content is loading */
  isLoading: boolean;
  /** The skeleton component to show while loading */
  skeleton: React.ReactNode;
  /** The actual content to reveal */
  children: React.ReactNode;
  /** Transition variant */
  variant?: TransitionVariant;
  /** Transition duration in milliseconds */
  duration?: number;
  /** Delay before transition starts (ms) */
  delay?: number;
  /** Additional CSS classes */
  className?: string;
  /** Callback when transition completes */
  onTransitionComplete?: () => void;
  /** Accessibility label */
  "aria-label"?: string;
}

/**
 * SkeletonTransition - Wrapper component for smooth skeleton-to-content transitions
 *
 * Usage:
 * ```tsx
 * <SkeletonTransition
 *   isLoading={isLoading}
 *   skeleton={<PostSkeleton />}
 *   variant="morph"
 * >
 *   <Post {...postData} />
 * </SkeletonTransition>
 * ```
 */
export const SkeletonTransition: React.FC<SkeletonTransitionProps> = ({
  isLoading,
  skeleton,
  children,
  variant = "fade",
  duration = 300,
  delay = 0,
  className = "",
  onTransitionComplete,
  "aria-label": ariaLabel,
}) => {
  const [showSkeleton, setShowSkeleton] = useState(isLoading);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const transitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handle loading state changes
  useEffect(() => {
    if (isLoading) {
      // When loading starts, show skeleton immediately
      setShowSkeleton(true);
      setIsTransitioning(false);
    } else if (showSkeleton) {
      // When loading ends, start the transition
      setIsTransitioning(true);

      // Clear any existing timeout
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }

      // Wait for delay, then start hiding skeleton
      transitionTimeoutRef.current = setTimeout(() => {
        setShowSkeleton(false);

        // Wait for animation to complete
        setTimeout(() => {
          setIsTransitioning(false);
          onTransitionComplete?.();
        }, duration);
      }, delay);
    }

    return () => {
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }
    };
  }, [isLoading, showSkeleton, delay, duration, onTransitionComplete]);

  // Get CSS transition styles based on variant
  const getTransitionStyles = (): string => {
    const baseStyles = "skeleton-transition-container";

    const variantStyles: Record<TransitionVariant, string> = {
      fade: "skeleton-transition-fade",
      morph: "skeleton-transition-morph",
      blur: "skeleton-transition-blur",
      "slide-up": "skeleton-transition-slide-up",
      scale: "skeleton-transition-scale",
    };

    return `${baseStyles} ${variantStyles[variant]}`;
  };

  return (
    <div
      ref={containerRef}
      className={`${getTransitionStyles()} ${className}`}
      style={
        {
          "--skeleton-transition-duration": `${duration}ms`,
        } as React.CSSProperties
      }
      data-loading={isLoading}
      data-transitioning={isTransitioning}
      data-skeleton-visible={showSkeleton}
      role={isLoading ? "status" : undefined}
      aria-label={isLoading ? ariaLabel || "Loading" : undefined}
      aria-busy={isLoading}
    >
      {/* Skeleton layer */}
      <div
        className="skeleton-transition-skeleton"
        aria-hidden={!showSkeleton}
        data-visible={showSkeleton}
      >
        {skeleton}
      </div>

      {/* Content layer */}
      <div
        className="skeleton-transition-content"
        aria-hidden={isLoading}
        data-visible={!showSkeleton}
      >
        {children}
      </div>
    </div>
  );
};

interface SkeletonTransitionListProps {
  /** Whether the content is loading */
  isLoading: boolean;
  /** Skeleton component for each item */
  skeleton: React.ReactNode;
  /** Number of skeleton items to show when loading */
  skeletonCount?: number;
  /** The actual content items */
  children: React.ReactNode;
  /** Stagger delay between items (ms) */
  staggerDelay?: number;
  /** Base transition duration (ms) */
  duration?: number;
  /** Transition variant */
  variant?: TransitionVariant;
  /** Additional CSS classes */
  className?: string;
  /** Item wrapper class */
  itemClassName?: string;
}

/**
 * SkeletonTransitionList - Staggered transition for lists of items
 *
 * Usage:
 * ```tsx
 * <SkeletonTransitionList
 *   isLoading={isLoading}
 *   skeleton={<PostSkeleton />}
 *   skeletonCount={5}
 *   staggerDelay={50}
 * >
 *   {posts.map(post => <Post key={post.id} {...post} />)}
 * </SkeletonTransitionList>
 * ```
 */
export const SkeletonTransitionList: React.FC<SkeletonTransitionListProps> = ({
  isLoading,
  skeleton,
  skeletonCount = 5,
  children,
  staggerDelay = 50,
  duration = 300,
  variant = "fade",
  className = "",
  itemClassName = "",
}) => {
  const childArray = React.Children.toArray(children);
  const variantClass = `skeleton-transition-${variant}`;

  if (isLoading) {
    return (
      <div
        className={`skeleton-transition-list skeleton-stagger ${variantClass} ${className}`}
        role="status"
        aria-label="Loading content"
      >
        {Array.from({ length: skeletonCount }).map((_, index) => (
          <div
            key={`skeleton-${index}`}
            className={`skeleton-transition-list-item ${itemClassName}`}
            style={
              {
                "--stagger-index": index,
                animationDelay: `${index * staggerDelay}ms`,
              } as React.CSSProperties
            }
          >
            {skeleton}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      className={`skeleton-transition-list skeleton-transition-list-revealed ${className}`}
    >
      {childArray.map((child, index) => (
        <div
          key={`content-${index}`}
          className={`skeleton-transition-list-item animate-skeleton-reveal ${itemClassName}`}
          style={
            {
              "--stagger-index": index,
              "--reveal-delay": `${index * staggerDelay}ms`,
              "--reveal-duration": `${duration}ms`,
              animationDelay: `${index * staggerDelay}ms`,
            } as React.CSSProperties
          }
        >
          {child}
        </div>
      ))}
    </div>
  );
};

interface UseSkeletonTransitionOptions {
  /** Minimum time to show skeleton (ms) - prevents flash for quick loads */
  minShowTime?: number;
  /** Delay before showing skeleton (ms) - prevents flash for instant loads */
  showDelay?: number;
  /** Transition duration when hiding skeleton (ms) */
  transitionDuration?: number;
}

interface UseSkeletonTransitionReturn {
  /** Whether skeleton should be visible */
  showSkeleton: boolean;
  /** Whether currently transitioning */
  isTransitioning: boolean;
  /** Start loading (show skeleton after delay) */
  startLoading: () => void;
  /** Finish loading (hide skeleton with transition) */
  finishLoading: () => void;
  /** Get props to spread on SkeletonTransition */
  getTransitionProps: () => {
    isLoading: boolean;
  };
}

/**
 * useSkeletonTransition - Hook for managing skeleton transition state
 *
 * Handles timing logic to prevent:
 * - Flash of skeleton for very fast loads (via showDelay)
 * - Flash of content before skeleton animates out (via minShowTime)
 */
export function useSkeletonTransition(
  options: UseSkeletonTransitionOptions = {},
): UseSkeletonTransitionReturn {
  const {
    minShowTime = 300,
    showDelay = 150,
    transitionDuration = 300,
  } = options;

  const [isLoading, setIsLoading] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const showStartTimeRef = useRef<number | null>(null);
  const showDelayTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const startLoading = useCallback(() => {
    setIsLoading(true);

    // Clear any pending hide
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }

    // Delay showing skeleton to prevent flash for quick loads
    showDelayTimeoutRef.current = setTimeout(() => {
      showStartTimeRef.current = Date.now();
      setShowSkeleton(true);
    }, showDelay);
  }, [showDelay]);

  const finishLoading = useCallback(() => {
    setIsLoading(false);

    // Clear show delay if still pending
    if (showDelayTimeoutRef.current) {
      clearTimeout(showDelayTimeoutRef.current);
      showDelayTimeoutRef.current = null;
    }

    // If skeleton not showing yet, nothing to hide
    if (!showSkeleton) {
      return;
    }

    // Calculate remaining min show time
    const showStartTime = showStartTimeRef.current || Date.now();
    const elapsed = Date.now() - showStartTime;
    const remainingMinTime = Math.max(0, minShowTime - elapsed);

    // Start transition after minimum show time
    setIsTransitioning(true);
    hideTimeoutRef.current = setTimeout(() => {
      setShowSkeleton(false);

      // Wait for transition to complete
      setTimeout(() => {
        setIsTransitioning(false);
      }, transitionDuration);
    }, remainingMinTime);
  }, [showSkeleton, minShowTime, transitionDuration]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (showDelayTimeoutRef.current) {
        clearTimeout(showDelayTimeoutRef.current);
      }
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  const getTransitionProps = useCallback(() => {
    return {
      isLoading: isLoading || showSkeleton,
    };
  }, [isLoading, showSkeleton]);

  return {
    showSkeleton,
    isTransitioning,
    startLoading,
    finishLoading,
    getTransitionProps,
  };
}

/**
 * ContentReveal - Simple reveal animation wrapper for newly loaded content
 *
 * Use this when you don't need a skeleton, but want smooth content entry.
 */
interface ContentRevealProps {
  /** Whether content is visible */
  isVisible: boolean;
  /** Transition variant */
  variant?: TransitionVariant;
  /** Transition duration (ms) */
  duration?: number;
  /** Children to reveal */
  children: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
}

export const ContentReveal: React.FC<ContentRevealProps> = ({
  isVisible,
  variant = "fade",
  duration = 300,
  children,
  className = "",
}) => {
  const variantClass = `content-reveal-${variant}`;

  return (
    <div
      className={`content-reveal ${variantClass} ${className}`}
      style={
        {
          "--reveal-duration": `${duration}ms`,
        } as React.CSSProperties
      }
      data-visible={isVisible}
    >
      {children}
    </div>
  );
};

export default SkeletonTransition;
